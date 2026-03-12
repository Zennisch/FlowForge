import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WorkflowDocument = HydratedDocument<Workflow>;

export type StepType = 'http' | 'transform' | 'store' | 'branch';
export type TriggerType = 'manual' | 'webhook' | 'schedule';
export type WorkflowStatus = 'active' | 'inactive';
export type BackoffStrategy = 'exponential' | 'fixed';

@Schema({ _id: false })
class RetryPolicy {
  @Prop({ default: 3 })
  maxAttempts: number;

  @Prop({ enum: ['exponential', 'fixed'], default: 'exponential' })
  backoff: BackoffStrategy;
}

const RetryPolicySchema = SchemaFactory.createForClass(RetryPolicy);

@Schema({ _id: false })
class WorkflowStep {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, enum: ['http', 'transform', 'store', 'branch'] })
  type: StepType;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ type: RetryPolicySchema, default: () => ({}) })
  retry: RetryPolicy;
}

const WorkflowStepSchema = SchemaFactory.createForClass(WorkflowStep);

@Schema({ _id: false })
class WorkflowEdge {
  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop()
  condition?: string;
}

const WorkflowEdgeSchema = SchemaFactory.createForClass(WorkflowEdge);

@Schema({ _id: false })
class WorkflowTrigger {
  @Prop({ required: true, enum: ['manual', 'webhook', 'schedule'], default: 'manual' })
  type: TriggerType;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;
}

const WorkflowTriggerSchema = SchemaFactory.createForClass(WorkflowTrigger);

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Workflow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner_id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: WorkflowStatus;

  @Prop({ type: WorkflowTriggerSchema, default: () => ({ type: 'manual', config: {} }) })
  trigger: WorkflowTrigger;

  @Prop({ type: [WorkflowStepSchema], default: [] })
  steps: WorkflowStep[];

  @Prop({ type: [WorkflowEdgeSchema], default: [] })
  edges: WorkflowEdge[];
}

export const WorkflowSchema = SchemaFactory.createForClass(Workflow);

