import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { computeBackoffMs } from '../../shared/utils/backoff.util';
import { EventService } from '../event/event.service';
import {
  Execution,
  ExecutionDocument,
  ExecutionWorkflowSnapshotCompensationPolicy,
} from './execution.schema';
import { CompensationExecutorService } from './compensation-executor.service';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';

const DEFAULT_COMPENSATION_MAX_ATTEMPTS = 3;
const DEFAULT_COMPENSATION_BACKOFF: 'exponential' | 'fixed' = 'exponential';

@Injectable()
export class CompensateService {
  private readonly logger = new Logger(CompensateService.name);

  constructor(
    @InjectModel(Execution.name)
    private readonly executionModel: Model<ExecutionDocument>,
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    private readonly eventService: EventService,
    private readonly compensationExecutor: CompensationExecutorService,
  ) {}

  async compensate(
    executionId: string,
    reason: 'compensation' | 'timeout' = 'compensation',
  ): Promise<ExecutionDocument> {
    const execution = await this.executionModel.findById(executionId).exec();
    if (!execution) throw new NotFoundException('Execution not found');

    const stepFailureMessage =
      reason === 'timeout' ? 'Execution timed out' : 'Execution compensated';

    execution.status = 'compensating';
    await execution.save();

    await this.eventService.append(executionId, 'execution.compensating');

    const completedCompensableSteps = await this.stepExecutionModel
      .find({
        execution_id: new Types.ObjectId(executionId),
        status: 'completed',
        compensation_status: { $in: ['pending', 'failed', 'running'] },
      })
      .sort({ completed_at: -1, updated_at: -1, created_at: -1 })
      .exec();

    let compensationFailures = 0;

    for (const stepExecution of completedCompensableSteps) {
      const compensation = this.resolveCompensationPolicy(
        execution,
        stepExecution.step_id,
      );
      if (!compensation?.enabled) {
        continue;
      }

      await this.eventService.append(
        executionId,
        'step.compensation.started',
        {
          type: compensation.type ?? 'noop',
          maxAttempts: this.resolveCompensationMaxAttempts(compensation),
        },
        stepExecution.step_id,
      );

      const succeeded = await this.runCompensationWithRetry(
        execution,
        stepExecution,
        compensation,
      );
      if (!succeeded) {
        compensationFailures += 1;
      }
    }

    await this.stepExecutionModel
      .updateMany(
        {
          execution_id: new Types.ObjectId(executionId),
          status: { $in: ['queued', 'running'] },
        },
        {
          $set: {
            status: 'failed',
            error: stepFailureMessage,
            completed_at: new Date(),
          },
        },
      )
      .exec();

    execution.status = 'failed';
    execution.completed_at = new Date();
    await execution.save();

    await this.eventService.append(executionId, 'execution.failed', { reason });

    if (compensationFailures > 0) {
      this.logger.warn(
        `Execution ${executionId} finished with ${compensationFailures} compensation failure(s)`,
      );
    }

    return execution;
  }

  private resolveCompensationPolicy(
    execution: ExecutionDocument,
    stepId: string,
  ): ExecutionWorkflowSnapshotCompensationPolicy | undefined {
    const workflowStep = execution.workflow_snapshot?.steps?.find(
      (step) => step.id === stepId,
    );
    return workflowStep?.compensation;
  }

  private resolveCompensationMaxAttempts(
    compensation: ExecutionWorkflowSnapshotCompensationPolicy,
  ): number {
    const configured = compensation.retry?.maxAttempts;
    if (
      typeof configured === 'number' &&
      Number.isFinite(configured) &&
      configured > 0
    ) {
      return Math.floor(configured);
    }
    return DEFAULT_COMPENSATION_MAX_ATTEMPTS;
  }

  private resolveCompensationBackoff(
    compensation: ExecutionWorkflowSnapshotCompensationPolicy,
  ): 'exponential' | 'fixed' {
    return compensation.retry?.backoff ?? DEFAULT_COMPENSATION_BACKOFF;
  }

  private async runCompensationWithRetry(
    execution: ExecutionDocument,
    stepExecution: StepExecutionDocument,
    compensation: ExecutionWorkflowSnapshotCompensationPolicy,
  ): Promise<boolean> {
    const maxAttempts = this.resolveCompensationMaxAttempts(compensation);
    const backoff = this.resolveCompensationBackoff(compensation);
    const executionObjectId = this.toIdString(execution._id);
    const stepExecutionObjectId = this.toIdString(stepExecution._id);
    const idempotencyKey = `${executionObjectId}:${stepExecutionObjectId}`;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await this.markCompensationRunning(stepExecution._id);

      try {
        const result = await this.compensationExecutor.execute({
          executionId: executionObjectId,
          stepExecutionId: stepExecutionObjectId,
          stepId: stepExecution.step_id,
          idempotencyKey,
          compensation,
          input: stepExecution.input,
          output: stepExecution.output,
          context: execution.context,
        });

        await this.stepExecutionModel
          .findByIdAndUpdate(stepExecution._id, {
            $set: {
              compensation_status: 'completed',
              compensation_error: null,
              compensation_completed_at: new Date(),
            },
          })
          .exec();

        await this.eventService.append(
          executionObjectId,
          'step.compensation.completed',
          {
            type: compensation.type ?? 'noop',
            attempt: attempt + 1,
            result,
          },
          stepExecution.step_id,
        );

        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown compensation failure';
        const willRetry = attempt + 1 < maxAttempts;

        await this.stepExecutionModel
          .findByIdAndUpdate(stepExecution._id, {
            $set: {
              compensation_status: 'failed',
              compensation_error: message,
            },
          })
          .exec();

        await this.eventService.append(
          executionObjectId,
          'step.compensation.failed',
          {
            type: compensation.type ?? 'noop',
            attempt: attempt + 1,
            maxAttempts,
            error: message,
            willRetry,
          },
          stepExecution.step_id,
        );

        if (!willRetry) {
          this.logger.warn(
            `Compensation failed permanently for step "${stepExecution.step_id}" in execution ${executionObjectId}: ${message}`,
          );
          return false;
        }

        const delayMs = computeBackoffMs(attempt, backoff);
        await this.sleep(delayMs);
      }
    }

    return false;
  }

  private async markCompensationRunning(stepExecutionId: Types.ObjectId): Promise<void> {
    await this.stepExecutionModel
      .findByIdAndUpdate(stepExecutionId, {
        $set: {
          compensation_status: 'running',
          compensation_started_at: new Date(),
          compensation_error: null,
        },
        $inc: { compensation_attempt: 1 },
      })
      .exec();
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private toIdString(value: unknown): string {
    if (value && typeof value === 'object' && 'toHexString' in value) {
      const maybeObjectId = value as { toHexString: () => string };
      return maybeObjectId.toHexString();
    }
    return String(value);
  }
}

