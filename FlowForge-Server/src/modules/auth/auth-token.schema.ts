import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../users/user.schema';

export type AuthTokenDocument = HydratedDocument<AuthToken>;

export enum AuthTokenType {
  VerifyEmail = 'verify_email',
  ResetPassword = 'reset_password',
}

@Schema({
  collection: 'auth_tokens',
  timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class AuthToken {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({
    required: true,
    enum: [AuthTokenType.VerifyEmail, AuthTokenType.ResetPassword],
    index: true,
  })
  type: AuthTokenType;

  @Prop({ required: true, unique: true })
  token_hash: string;

  @Prop({ required: true })
  expires_at: Date;

  @Prop({ default: null })
  consumed_at: Date | null;

  created_at: Date;
}

export const AuthTokenSchema = SchemaFactory.createForClass(AuthToken);

AuthTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
AuthTokenSchema.index({ user_id: 1, type: 1, consumed_at: 1 });
