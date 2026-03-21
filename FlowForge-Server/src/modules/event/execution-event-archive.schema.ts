import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EventType } from './execution-event.schema';

export type ExecutionEventArchiveDocument = HydratedDocument<ExecutionEventArchive>;

@Schema({ collection: 'execution_events_archive' })
export class ExecutionEventArchive {
  @Prop({ type: Types.ObjectId, required: true, unique: true })
  source_event_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Execution', required: true })
  execution_id: Types.ObjectId;

  @Prop({ default: null })
  step_id: string | null;

  @Prop({ required: true })
  type: EventType;

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({ required: true })
  retention_class: 'operational' | 'security' | 'compliance';

  @Prop({ required: true })
  expires_at: Date;

  @Prop({ required: true, default: 0, min: 0 })
  payload_size_bytes: number;

  @Prop({ required: true })
  occurred_at: Date;

  @Prop({ required: true, default: () => new Date() })
  archived_at: Date;
}

export const ExecutionEventArchiveSchema =
  SchemaFactory.createForClass(ExecutionEventArchive);

ExecutionEventArchiveSchema.index({ execution_id: 1, occurred_at: 1, _id: 1 });
ExecutionEventArchiveSchema.index({ archived_at: 1 });
