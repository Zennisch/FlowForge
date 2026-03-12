import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExecutionDocument = HydratedDocument<Execution>;
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'compensating';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Execution {
  @Prop({ type: Types.ObjectId, ref: 'Workflow', required: true })
  workflow_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner_id: Types.ObjectId;

  @Prop({
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'compensating'],
    default: 'pending',
  })
  status: ExecutionStatus;

  @Prop({ enum: ['manual', 'webhook', 'schedule'], default: 'manual' })
  trigger_type: string;

  @Prop({ type: Object, default: {} })
  trigger_payload: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  context: Record<string, unknown>;

  @Prop({ unique: true, sparse: true })
  idempotency_key?: string;

  @Prop()
  started_at?: Date;

  @Prop()
  completed_at?: Date;
}

export const ExecutionSchema = SchemaFactory.createForClass(Execution);

