import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PubSubService } from '../../infra/pubsub/pubsub.provider';
import { StepJob } from '../../shared/interfaces/step-job.interface';
import { EventService } from '../event/event.service';
import { WorkflowService } from '../workflow/workflow.service';
import { TriggerExecutionDto } from './dto/trigger-execution.dto';
import { Execution, ExecutionDocument } from './execution.schema';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';

type TriggerType = 'manual' | 'webhook' | 'schedule';

export interface TriggerExecutionOptions {
  triggerType?: TriggerType;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}

@Injectable()
export class ExecutionService {
  constructor(
    @InjectModel(Execution.name)
    private readonly executionModel: Model<ExecutionDocument>,
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    private readonly workflowService: WorkflowService,
    private readonly eventService: EventService,
    private readonly pubSubService: PubSubService,
  ) {}

  async trigger(
    workflowId: string,
    ownerId: string,
    dto: TriggerExecutionDto = {},
    options: TriggerExecutionOptions = {},
  ): Promise<ExecutionDocument> {
    const workflow = await this.workflowService.findOne(workflowId, ownerId);

    const triggerType = options.triggerType ?? 'manual';
    const triggerPayload = options.payload ?? dto.payload ?? {};
    const incomingIdempotencyKey = options.idempotencyKey ?? dto.idempotency_key;

    if (incomingIdempotencyKey) {
      const existing = await this.executionModel
        .findOne({ idempotency_key: incomingIdempotencyKey })
        .exec();
      if (existing) {
        throw new ConflictException('Duplicate idempotency key');
      }
    }

    const idempotencyKey =
      incomingIdempotencyKey ?? new Types.ObjectId().toHexString();

    const execution = await new this.executionModel({
      workflow_id: new Types.ObjectId(workflowId),
      owner_id: new Types.ObjectId(ownerId),
      status: 'running',
      trigger_type: triggerType,
      trigger_payload: triggerPayload,
      context: {},
      idempotency_key: idempotencyKey,
      started_at: new Date(),
    }).save();

    const stepExecutions: StepExecutionDocument[] = [];
    for (const step of workflow.steps) {
      const stepExecution = await new this.stepExecutionModel({
        execution_id: execution._id,
        step_id: step.id,
        status: 'queued',
        attempt: 0,
        input: {},
        output: null,
        error: null,
      }).save();
      stepExecutions.push(stepExecution);
    }

    await this.eventService.append(
      String(execution._id),
      'execution.started',
      { workflow_id: workflowId, trigger_type: triggerType },
    );

    if (workflow.steps.length === 0) {
      execution.status = 'completed';
      execution.completed_at = new Date();
      await execution.save();
      await this.eventService.append(String(execution._id), 'execution.completed');
      return execution;
    }

    // Find entry steps: steps with no incoming edges
    const toStepIds = new Set(workflow.edges.map((e) => e.to));
    const entrySteps = workflow.steps.filter((s) => !toStepIds.has(s.id));

    for (const step of entrySteps) {
      const stepExecution = stepExecutions.find((se) => se.step_id === step.id);
      if (!stepExecution) continue;

      await this.eventService.append(String(execution._id), 'step.queued', {}, step.id);

      const job: StepJob = {
        executionId: String(execution._id),
        stepId: step.id,
        stepExecutionId: String(stepExecution._id),
        stepConfig: { type: step.type, ...(step.config as Record<string, unknown>) },
        context: {},
        attempt: 0,
      };
      await this.pubSubService.publishJob(job);
    }

    return execution;
  }

  async triggerByWebhook(
    userId: string,
    path: string,
    payload: Record<string, unknown> = {},
    providedSecret?: string,
  ): Promise<ExecutionDocument> {
    const workflow = await this.workflowService.findActiveWebhookWorkflow(
      userId,
      path,
    );

    const expectedSecret = this.getConfiguredWebhookSecret(
      workflow.trigger?.config,
    );

    if (expectedSecret) {
      if (!providedSecret) {
        throw new UnauthorizedException('Missing webhook secret');
      }

      if (!this.secretsMatch(expectedSecret, providedSecret)) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }

    return this.trigger(String(workflow._id), userId, {}, {
      triggerType: 'webhook',
      payload,
    });
  }

  private getConfiguredWebhookSecret(
    config?: Record<string, unknown>,
  ): string | undefined {
    if (!config) {
      return undefined;
    }

    const secret = config.secret;
    if (typeof secret !== 'string') {
      return undefined;
    }

    const trimmed = secret.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private secretsMatch(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  findAll(ownerId: string): Promise<ExecutionDocument[]> {
    return this.executionModel
      .find({ owner_id: new Types.ObjectId(ownerId) })
      .sort({ created_at: -1 })
      .exec();
  }

  async findOne(id: string, ownerId: string): Promise<ExecutionDocument> {
    const execution = await this.executionModel.findById(id).exec();
    if (!execution) throw new NotFoundException('Execution not found');
    if (execution.owner_id.toString() !== ownerId)
      throw new ForbiddenException('Access denied');
    return execution;
  }

  async cancel(id: string, ownerId: string): Promise<ExecutionDocument> {
    const execution = await this.findOne(id, ownerId);

    if (!['pending', 'running'].includes(execution.status)) {
      throw new ConflictException(
        `Cannot cancel execution with status '${execution.status}'`,
      );
    }

    execution.status = 'cancelled';
    execution.completed_at = new Date();
    await execution.save();

    await this.stepExecutionModel
      .updateMany(
        {
          execution_id: execution._id,
          status: { $in: ['queued', 'running'] },
        },
        {
          $set: {
            status: 'skipped',
            error: 'Execution cancelled',
            completed_at: new Date(),
          },
        },
      )
      .exec();

    await this.eventService.append(String(execution._id), 'execution.cancelled');

    return execution;
  }

  async findEvents(id: string, ownerId: string) {
    await this.findOne(id, ownerId);
    return this.eventService.findByExecutionId(id);
  }
}

