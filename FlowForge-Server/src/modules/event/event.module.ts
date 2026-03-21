import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventGovernanceService } from './event-governance.service';
import { EventLegalHold, EventLegalHoldSchema } from './event-legal-hold.schema';
import {
  ExecutionEventArchive,
  ExecutionEventArchiveSchema,
} from './execution-event-archive.schema';
import { EventArchiveService } from './event-archive.service';
import { ExecutionEvent, ExecutionEventSchema } from './execution-event.schema';
import { EventService } from './event.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExecutionEvent.name, schema: ExecutionEventSchema },
      { name: ExecutionEventArchive.name, schema: ExecutionEventArchiveSchema },
      { name: EventLegalHold.name, schema: EventLegalHoldSchema },
    ]),
  ],
  providers: [EventService, EventArchiveService, EventGovernanceService],
  exports: [EventService, EventGovernanceService],
})
export class EventModule {}

