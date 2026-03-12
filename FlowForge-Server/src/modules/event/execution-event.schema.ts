import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExecutionEventDocument = HydratedDocument<ExecutionEvent>;
export type EventType =
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.cancelled'
  | 'execution.compensating'
  | 'step.queued'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.skipped'
  | 'step.retrying';

const EVENT_TYPES: EventType[] = [
  'execution.started',
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
  'execution.compensating',
  'step.queued',
  'step.started',
  'step.completed',
  'step.failed',
  'step.skipped',
  'step.retrying',
];

@Schema()
export class ExecutionEvent {
  @Prop({ type: Types.ObjectId, ref: 'Execution', required: true })
  execution_id: Types.ObjectId;

  @Prop({ default: null })
  step_id: string | null;

  @Prop({ required: true, enum: EVENT_TYPES })
  type: EventType;

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({ default: () => new Date() })
  occurred_at: Date;
}

export const ExecutionEventSchema = SchemaFactory.createForClass(ExecutionEvent);

