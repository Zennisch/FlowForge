import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Message, Subscription } from '@google-cloud/pubsub';
import { Model } from 'mongoose';
import { PubSubService } from '../../infra/pubsub/pubsub.provider';
import { StepJob } from '../../shared/interfaces/step-job.interface';
import { StepResult } from '../../shared/interfaces/step-result.interface';
import { computeBackoffMs } from '../../shared/utils/backoff.util';
import { CompensateService } from '../execution/compensate.service';
import {
  Execution,
  ExecutionDocument,
  ExecutionWorkflowSnapshot,
} from '../execution/execution.schema';
import {
  StepExecution,
  StepExecutionDocument,
} from '../execution/step-execution.schema';
import { StepStateService } from '../execution/step-state.service';
import { WorkflowService } from '../workflow/workflow.service';
import { EventService } from './event.service';

@Injectable()
export class EventRouterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventRouterService.name);
  private subscription: Subscription;

  constructor(
    @InjectModel(Execution.name)
    private readonly executionModel: Model<ExecutionDocument>,
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    private readonly stepStateService: StepStateService,
    private readonly compensateService: CompensateService,
    private readonly workflowService: WorkflowService,
    private readonly eventService: EventService,
    private readonly pubSubService: PubSubService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.pubSubService.getEventsSubscription();
    this.subscription.on('message', (msg: Message) => {
      void this.handleMessage(msg);
    });
    this.subscription.on('error', (err: Error) => {
      this.logger.error('Events subscription error', err.message);
    });
    this.logger.log('Orchestrator subscribed to workflow-events');
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscription.close();
  }

  private async handleMessage(message: Message): Promise<void> {
    let result: StepResult;
    try {
      result = JSON.parse(message.data.toString()) as StepResult;
    } catch {
      this.logger.error('Malformed event message; dropping');
      message.ack();
      return;
    }

    try {
      if (result.status === 'completed') {
        await this.onStepCompleted(result);
      } else {
        await this.onStepFailed(result);
      }
      message.ack();
    } catch (err) {
      this.logger.error(`Event processing failed: ${String(err)}`);
      message.nack();
    }
  }

  private async onStepCompleted(result: StepResult): Promise<void> {
    const execution = await this.executionModel.findById(result.executionId).exec();
    if (!execution) {
      this.logger.warn(`Execution ${result.executionId} not found after step completion`);
      return;
    }

    if (execution.status !== 'running') {
      this.logger.log(
        `Ignoring completed result for step "${result.stepId}" because execution ${result.executionId} is ${execution.status}`,
      );
      return;
    }

    await this.stepStateService.markCompleted(result.stepExecutionId, result.output);

    const newContext = { ...execution.context, ...result.output };
    execution.context = newContext;
    await execution.save();

    const workflow = await this.getWorkflowDefinition(execution);

    const outEdges = workflow.edges.filter((e) => e.from === result.stepId);

    if (outEdges.length === 0) {
      execution.status = 'completed';
      execution.completed_at = new Date();
      await execution.save();
      await this.eventService.append(result.executionId, 'execution.completed');
      this.logger.log(`Execution ${result.executionId} completed`);
      return;
    }

    // Branch steps signal the next step via _branch_next in output;
    // otherwise follow edges that have no condition.
    const nextEdges =
      result.output._branch_next !== undefined
        ? outEdges.filter((e) => e.to === result.output._branch_next)
        : outEdges.filter((e) => !e.condition);

    if (outEdges.length > 0 && nextEdges.length === 0) {
      this.logger.warn(
        `No valid outgoing edge from step "${result.stepId}" for execution ${result.executionId}; compensating`,
      );
      await this.compensateService.compensate(result.executionId);
      return;
    }

    for (const edge of nextEdges) {
      const nextStep = workflow.steps.find((s) => s.id === edge.to);
      if (!nextStep) continue;

      const canDispatch = await this.canDispatchFanInStep(
        execution._id,
        nextStep.id,
        workflow.edges,
      );
      if (!canDispatch) continue;

      // Only dispatch if still queued (prevents double-publish in fan-in topologies)
      const stepExecution = await this.stepExecutionModel
        .findOne({ execution_id: execution._id, step_id: nextStep.id, status: 'queued' })
        .exec();
      if (!stepExecution) continue;

      await this.eventService.append(result.executionId, 'step.queued', {}, nextStep.id);

      const job: StepJob = {
        executionId: result.executionId,
        stepId: nextStep.id,
        stepExecutionId: String(stepExecution._id),
        stepConfig: { type: nextStep.type, ...(nextStep.config as Record<string, unknown>) },
        context: newContext,
        attempt: 0,
      };
      await this.pubSubService.publishJob(job);
    }
  }

  private async canDispatchFanInStep(
    executionId: ExecutionDocument['_id'],
    stepId: string,
    edges: ReadonlyArray<{ from: string; to: string }>,
  ): Promise<boolean> {
    const parentStepIds = [
      ...new Set(edges.filter((edge) => edge.to === stepId).map((edge) => edge.from)),
    ];

    if (parentStepIds.length <= 1) {
      return true;
    }

    const completedParents = await this.stepExecutionModel
      .countDocuments({
        execution_id: executionId,
        step_id: { $in: parentStepIds },
        status: 'completed',
      })
      .exec();

    return completedParents === parentStepIds.length;
  }

  private async onStepFailed(result: StepResult): Promise<void> {
    const execution = await this.executionModel.findById(result.executionId).exec();
    if (!execution) {
      this.logger.warn(`Execution ${result.executionId} not found after step failure`);
      return;
    }

    if (execution.status !== 'running') {
      this.logger.log(
        `Ignoring failed result for step "${result.stepId}" because execution ${result.executionId} is ${execution.status}`,
      );
      return;
    }

    const workflow = await this.getWorkflowDefinition(execution);

    const step = workflow.steps.find((s) => s.id === result.stepId);
    if (!step) return;

    const maxAttempts = step.retry?.maxAttempts ?? 3;
    const backoffStrategy = step.retry?.backoff ?? 'exponential';

    if (result.attempt + 1 < maxAttempts) {
      const delayMs = computeBackoffMs(result.attempt, backoffStrategy);
      this.logger.log(
        `Retrying step "${result.stepId}" ` +
          `(attempt ${result.attempt + 1}/${maxAttempts}, delay ${delayMs}ms)`,
      );

      await this.eventService.append(
        result.executionId,
        'step.retrying',
        { attempt: result.attempt + 1, delayMs },
        result.stepId,
      );

      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

      const latestExecution = await this.executionModel
        .findById(result.executionId)
        .exec();
      if (!latestExecution || latestExecution.status !== 'running') {
        this.logger.log(
          `Skipping retry for step "${result.stepId}" because execution ${result.executionId} is no longer running`,
        );
        return;
      }

      const stepExecution = await this.stepExecutionModel
        .findById(result.stepExecutionId)
        .exec();
      if (stepExecution) {
        stepExecution.attempt = result.attempt + 1;
        stepExecution.status = 'queued';
        stepExecution.error = null;
        await stepExecution.save();
      }

      const job: StepJob = {
        executionId: result.executionId,
        stepId: result.stepId,
        stepExecutionId: result.stepExecutionId,
        stepConfig: { type: step.type, ...(step.config as Record<string, unknown>) },
        context: execution.context,
        attempt: result.attempt + 1,
      };
      await this.pubSubService.publishJob(job);
    } else {
      this.logger.warn(
        `Step "${result.stepId}" exhausted ${maxAttempts} attempts; compensating execution ${result.executionId}`,
      );
      await this.stepStateService.markFailed(
        result.stepExecutionId,
        result.error ?? 'Unknown error',
      );
      await this.compensateService.compensate(result.executionId);
    }
  }

  private async getWorkflowDefinition(
    execution: ExecutionDocument,
  ): Promise<ExecutionWorkflowSnapshot> {
    if (execution.workflow_snapshot) {
      return execution.workflow_snapshot;
    }

    // Backward-compatible fallback for executions created before snapshot rollout.
    const workflow = await this.workflowService.findOne(
      execution.workflow_id.toString(),
      execution.owner_id.toString(),
    );

    return {
      steps: workflow.steps.map((step) => ({
        id: step.id,
        type: step.type,
        config: step.config as Record<string, unknown>,
        ...(step.retry
          ? {
              retry: {
                ...(step.retry.maxAttempts !== undefined
                  ? { maxAttempts: step.retry.maxAttempts }
                  : {}),
                ...(step.retry.backoff !== undefined
                  ? { backoff: step.retry.backoff }
                  : {}),
              },
            }
          : {}),
      })),
      edges: workflow.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        ...(edge.condition !== undefined ? { condition: edge.condition } : {}),
      })),
    };
  }
}

