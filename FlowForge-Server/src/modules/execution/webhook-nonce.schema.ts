import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WebhookNonceDocument = HydratedDocument<WebhookNonce>;

@Schema({
  collection: 'webhook_nonces',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class WebhookNonce {
  @Prop({ type: Types.ObjectId, ref: 'Workflow', required: true })
  workflow_id: Types.ObjectId;

  @Prop({ required: true })
  nonce: string;

  @Prop({ required: true })
  expires_at: Date;
}

export const WebhookNonceSchema = SchemaFactory.createForClass(WebhookNonce);

WebhookNonceSchema.index({ workflow_id: 1, nonce: 1 }, { unique: true });
WebhookNonceSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
