import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WebhookRateLimitDocument = HydratedDocument<WebhookRateLimit>;

@Schema({
  collection: 'webhook_rate_limits',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class WebhookRateLimit {
  @Prop({ type: Types.ObjectId, ref: 'Workflow', required: true })
  workflow_id: Types.ObjectId;

  @Prop({ required: true })
  bucket: string;

  @Prop({ required: true, default: 0 })
  count: number;

  @Prop({ required: true })
  window_started_at: Date;

  @Prop({ required: true })
  expires_at: Date;
}

export const WebhookRateLimitSchema =
  SchemaFactory.createForClass(WebhookRateLimit);

WebhookRateLimitSchema.index({ workflow_id: 1, bucket: 1 }, { unique: true });
WebhookRateLimitSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
