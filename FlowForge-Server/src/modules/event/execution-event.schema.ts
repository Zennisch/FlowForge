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
  | 'step.retrying'
  | 'step.compensation.started'
  | 'step.compensation.completed'
  | 'step.compensation.failed';

export type EventRetentionClass = 'operational' | 'security' | 'compliance';

export const EVENT_TYPES: EventType[] = [
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
  'step.compensation.started',
  'step.compensation.completed',
  'step.compensation.failed',
];

const EVENT_RETENTION_CLASSES: EventRetentionClass[] = [
  'operational',
  'security',
  'compliance',
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

  @Prop({
    required: true,
    enum: EVENT_RETENTION_CLASSES,
    default: 'operational',
  })
  retention_class: EventRetentionClass;

  @Prop({ required: true })
  expires_at: Date;

  @Prop({ required: true, default: 0, min: 0 })
  payload_size_bytes: number;

  @Prop({ required: true, default: false })
  legal_hold: boolean;

  @Prop({ default: null })
  legal_hold_at: Date | null;

  @Prop({ default: () => new Date() })
  occurred_at: Date;
}

export const ExecutionEventSchema =
  SchemaFactory.createForClass(ExecutionEvent);

ExecutionEventSchema.index({ execution_id: 1, occurred_at: 1, _id: 1 });
ExecutionEventSchema.index({ execution_id: 1, type: 1, occurred_at: 1 });
ExecutionEventSchema.index({ legal_hold: 1, expires_at: 1 });
ExecutionEventSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
