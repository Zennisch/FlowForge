import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExecutionEvent, ExecutionEventSchema } from './execution-event.schema';
import { EventService } from './event.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExecutionEvent.name, schema: ExecutionEventSchema },
    ]),
  ],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}

