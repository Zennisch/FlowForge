import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SchedulerLockDocument = HydratedDocument<SchedulerLock>;

@Schema({
  collection: 'scheduler_locks',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class SchedulerLock {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  owner: string;

  @Prop({ required: true })
  lease_until: Date;
}

export const SchedulerLockSchema = SchemaFactory.createForClass(SchedulerLock);

SchedulerLockSchema.index({ lease_until: 1 }, { expireAfterSeconds: 0 });
