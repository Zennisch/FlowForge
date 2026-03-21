import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TriggerRateLimitDocument = HydratedDocument<TriggerRateLimit>;

@Schema({
  collection: 'trigger_rate_limits',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class TriggerRateLimit {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Workflow', required: true })
  workflow_id: Types.ObjectId;

  @Prop({ required: true, enum: ['manual', 'webhook', 'schedule'] })
  trigger_type: 'manual' | 'webhook' | 'schedule';

  @Prop({ required: true })
  bucket: string;

  @Prop({ required: true, default: 0 })
  count: number;

  @Prop({ required: true })
  window_started_at: Date;

  @Prop({ required: true })
  expires_at: Date;
}

export const TriggerRateLimitSchema =
  SchemaFactory.createForClass(TriggerRateLimit);

TriggerRateLimitSchema.index({ owner_id: 1, bucket: 1 }, { unique: true });
TriggerRateLimitSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
