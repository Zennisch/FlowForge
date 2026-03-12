import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StepExecutionDocument = HydratedDocument<StepExecution>;
export type StepStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class StepExecution {
  @Prop({ type: Types.ObjectId, ref: 'Execution', required: true })
  execution_id: Types.ObjectId;

  @Prop({ required: true })
  step_id: string;

  @Prop({
    enum: ['queued', 'running', 'completed', 'failed', 'skipped'],
    default: 'queued',
  })
  status: StepStatus;

  @Prop({ default: 0 })
  attempt: number;

  @Prop({ type: Object, default: {} })
  input: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  output: Record<string, unknown> | null;

  @Prop({ default: null })
  error: string | null;

  @Prop()
  started_at?: Date;

  @Prop()
  completed_at?: Date;
}

export const StepExecutionSchema = SchemaFactory.createForClass(StepExecution);

