import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: true })
  email_verified: boolean;

  @Prop({ default: null })
  email_verified_at: Date | null;

  @Prop({ default: null })
  password_changed_at: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
