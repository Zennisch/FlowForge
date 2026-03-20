import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventService } from '../event/event.service';
import {
  Execution,
  ExecutionDocument,
  ExecutionWorkflowSnapshotCompensationPolicy,
} from './execution.schema';
import { CompensationExecutorService } from './compensation-executor.service';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';

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
        { type: compensation.type ?? 'noop' },
        stepExecution.step_id,
      );

      try {
        const result = await this.compensationExecutor.execute({
          executionId,
          stepExecutionId: stepExecution._id.toHexString(),
          stepId: stepExecution.step_id,
          compensation,
          input: stepExecution.input,
          output: stepExecution.output,
          context: execution.context,
        });

        await this.eventService.append(
          executionId,
          'step.compensation.completed',
          { type: compensation.type ?? 'noop', result },
          stepExecution.step_id,
        );
      } catch (error) {
        compensationFailures += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown compensation failure';
        this.logger.warn(
          `Compensation failed for step "${stepExecution.step_id}" in execution ${executionId}: ${message}`,
        );

        await this.eventService.append(
          executionId,
          'step.compensation.failed',
          { type: compensation.type ?? 'noop', error: message },
          stepExecution.step_id,
        );
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
}

