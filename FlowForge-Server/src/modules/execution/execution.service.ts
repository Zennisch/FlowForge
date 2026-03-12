import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventService } from '../event/event.service';
import { WorkflowService } from '../workflow/workflow.service';
import { TriggerExecutionDto } from './dto/trigger-execution.dto';
import { Execution, ExecutionDocument } from './execution.schema';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';

@Injectable()
export class ExecutionService {
  constructor(
    @InjectModel(Execution.name)
    private readonly executionModel: Model<ExecutionDocument>,
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    private readonly workflowService: WorkflowService,
    private readonly eventService: EventService,
  ) {}

  async trigger(
    workflowId: string,
    ownerId: string,
    dto: TriggerExecutionDto,
  ): Promise<ExecutionDocument> {
    const workflow = await this.workflowService.findOne(workflowId, ownerId);

    if (dto.idempotency_key) {
      const existing = await this.executionModel
        .findOne({ idempotency_key: dto.idempotency_key })
        .exec();
      if (existing) {
        throw new ConflictException('Duplicate idempotency key');
      }
    }

    const idempotencyKey =
      dto.idempotency_key ?? new Types.ObjectId().toHexString();

    const execution = await new this.executionModel({
      workflow_id: new Types.ObjectId(workflowId),
      owner_id: new Types.ObjectId(ownerId),
      status: 'running',
      trigger_type: 'manual',
      trigger_payload: dto.payload ?? {},
      context: {},
      idempotency_key: idempotencyKey,
      started_at: new Date(),
    }).save();

    for (const step of workflow.steps) {
      await new this.stepExecutionModel({
        execution_id: execution._id,
        step_id: step.id,
        status: 'queued',
        attempt: 0,
        input: {},
        output: null,
        error: null,
      }).save();
    }

    await this.eventService.append(
      String(execution._id),
      'execution.started',
      { workflow_id: workflowId, trigger_type: 'manual' },
    );

    // TODO: Publish first step job(s) to Pub/Sub when PubSubService is implemented

    return execution;
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

    await this.eventService.append(String(execution._id), 'execution.cancelled');

    return execution;
  }

  async findEvents(id: string, ownerId: string) {
    await this.findOne(id, ownerId);
    return this.eventService.findByExecutionId(id);
  }
}

