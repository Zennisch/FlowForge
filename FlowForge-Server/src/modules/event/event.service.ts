import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EventType,
  ExecutionEvent,
  ExecutionEventDocument,
} from './execution-event.schema';

@Injectable()
export class EventService {
  constructor(
    @InjectModel(ExecutionEvent.name)
    private readonly eventModel: Model<ExecutionEventDocument>,
  ) {}

  append(
    executionId: string,
    type: EventType,
    payload: Record<string, unknown> = {},
    stepId: string | null = null,
  ): Promise<ExecutionEventDocument> {
    const event = new this.eventModel({
      execution_id: new Types.ObjectId(executionId),
      step_id: stepId,
      type,
      payload,
      occurred_at: new Date(),
    });
    return event.save();
  }

  findByExecutionId(executionId: string): Promise<ExecutionEventDocument[]> {
    return this.eventModel
      .find({ execution_id: new Types.ObjectId(executionId) })
      .sort({ occurred_at: 1 })
      .exec();
  }
}

