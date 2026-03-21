import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ExecutionEvent,
  ExecutionEventDocument,
} from './execution-event.schema';
import {
  ExecutionEventArchive,
  ExecutionEventArchiveDocument,
} from './execution-event-archive.schema';

const DEFAULT_ARCHIVE_INTERVAL_MS = 60_000;
const DEFAULT_ARCHIVE_BATCH_SIZE = 500;

@Injectable()
export class EventArchiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventArchiveService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectModel(ExecutionEvent.name)
    private readonly eventModel: Model<ExecutionEventDocument>,
    @InjectModel(ExecutionEventArchive.name)
    private readonly archiveModel: Model<ExecutionEventArchiveDocument>,
  ) {}

  onModuleInit(): void {
    if (!this.isArchiveEnabled()) {
      this.logger.log('Event archive job is disabled');
      return;
    }

    const intervalMs = this.getArchiveIntervalMs();
    this.timer = setInterval(() => {
      void this.archiveExpiredEvents();
    }, intervalMs);
    this.timer.unref();

    this.logger.log(`Event archive job enabled (interval=${intervalMs}ms)`);
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async archiveExpiredEvents(now: Date = new Date()): Promise<number> {
    if (!this.isArchiveEnabled()) {
      return 0;
    }

    if (this.running) {
      return 0;
    }

    this.running = true;
    try {
      const batchSize = this.getArchiveBatchSize();
      const expiredEvents = await this.eventModel
        .find({
          expires_at: { $lte: now },
          legal_hold: { $ne: true },
        })
        .sort({ expires_at: 1, _id: 1 })
        .limit(batchSize)
        .exec();

      if (expiredEvents.length === 0) {
        return 0;
      }

      const archiveTime = new Date();
      const operations = expiredEvents.map((event) => ({
        updateOne: {
          filter: { source_event_id: event._id },
          update: {
            $setOnInsert: {
              source_event_id: event._id,
              execution_id: event.execution_id,
              step_id: event.step_id ?? null,
              type: event.type,
              payload: event.payload,
              retention_class: event.retention_class,
              expires_at: event.expires_at,
              payload_size_bytes: event.payload_size_bytes,
              occurred_at: event.occurred_at,
              archived_at: archiveTime,
            },
          },
          upsert: true,
        },
      }));

      await this.archiveModel.bulkWrite(operations, { ordered: false });

      const sourceIds = expiredEvents.map((event) => event._id as Types.ObjectId);
      const deleteResult = await this.eventModel
        .deleteMany({ _id: { $in: sourceIds } })
        .exec();

      const deletedCount = deleteResult.deletedCount ?? 0;
      if (deletedCount > 0) {
        this.logger.log(`Archived ${deletedCount} expired execution events`);
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to archive expired execution events: ${String(error)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private isArchiveEnabled(): boolean {
    const raw = (process.env.EVENT_ARCHIVE_ENABLED ?? '').trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  private getArchiveIntervalMs(): number {
    const parsed = Number((process.env.EVENT_ARCHIVE_INTERVAL_MS ?? '').trim());
    if (!Number.isFinite(parsed) || parsed < 1_000) {
      return DEFAULT_ARCHIVE_INTERVAL_MS;
    }

    return Math.floor(parsed);
  }

  private getArchiveBatchSize(): number {
    const parsed = Number((process.env.EVENT_ARCHIVE_BATCH_SIZE ?? '').trim());
    if (!Number.isFinite(parsed) || parsed < 1) {
      return DEFAULT_ARCHIVE_BATCH_SIZE;
    }

    return Math.floor(parsed);
  }
}
