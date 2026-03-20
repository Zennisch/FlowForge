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

export interface ExecutionWorkflowSnapshotRetryPolicy {
  maxAttempts?: number;
  backoff?: 'exponential' | 'fixed';
}

export interface ExecutionWorkflowSnapshotStep {
  id: string;
  type: 'http' | 'transform' | 'store' | 'branch';
  config: Record<string, unknown>;
  retry?: ExecutionWorkflowSnapshotRetryPolicy;
}

export interface ExecutionWorkflowSnapshotEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface ExecutionWorkflowSnapshot {
  steps: ExecutionWorkflowSnapshotStep[];
  edges: ExecutionWorkflowSnapshotEdge[];
}

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

  @Prop({ type: Object, required: true })
  workflow_snapshot: ExecutionWorkflowSnapshot;

  @Prop()
  idempotency_key?: string;

  @Prop()
  started_at?: Date;

  @Prop()
  completed_at?: Date;
}

export const ExecutionSchema = SchemaFactory.createForClass(Execution);

ExecutionSchema.index(
  { owner_id: 1, workflow_id: 1, idempotency_key: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotency_key: { $exists: true, $type: 'string' },
    },
  },
);

