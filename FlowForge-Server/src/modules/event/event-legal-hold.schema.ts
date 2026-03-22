import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EventLegalHoldDocument = HydratedDocument<EventLegalHold>;

@Schema({ collection: 'event_legal_holds' })
export class EventLegalHold {
  @Prop({
    type: Types.ObjectId,
    ref: 'Execution',
    required: true,
    unique: true,
  })
  execution_id: Types.ObjectId;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop({ default: null })
  reason: string | null;

  @Prop({ required: true })
  set_by_owner_id: Types.ObjectId;

  @Prop({ required: true, default: () => new Date() })
  created_at: Date;

  @Prop({ default: null })
  released_at: Date | null;
}

export const EventLegalHoldSchema =
  SchemaFactory.createForClass(EventLegalHold);

EventLegalHoldSchema.index({ active: 1, created_at: -1 });
