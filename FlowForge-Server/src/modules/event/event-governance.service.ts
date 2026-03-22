import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventLegalHold, EventLegalHoldDocument } from './event-legal-hold.schema';
import { EventRetentionClass, ExecutionEvent, ExecutionEventDocument } from './execution-event.schema';

const LEGAL_HOLD_EXPIRATION_DATE = new Date('9999-12-31T00:00:00.000Z');
const DEFAULT_EVENT_RETENTION_DAYS = 90;

export interface ExecutionLegalHoldState {
  active: boolean;
  reason: string | null;
  set_by_owner_id: string | null;
  created_at: Date | null;
  released_at: Date | null;
}

@Injectable()
export class EventGovernanceService {
  constructor(
    @InjectModel(EventLegalHold.name)
    private readonly legalHoldModel: Model<EventLegalHoldDocument>,
    @InjectModel(ExecutionEvent.name)
    private readonly eventModel: Model<ExecutionEventDocument>,
  ) {}

  async isExecutionOnLegalHold(executionId: string): Promise<boolean> {
    const hold = await this.legalHoldModel
      .findOne({ execution_id: new Types.ObjectId(executionId), active: true })
      .select({ _id: 1 })
      .lean()
      .exec();

    return Boolean(hold);
  }

  async getExecutionLegalHoldState(executionId: string): Promise<ExecutionLegalHoldState> {
    const hold = await this.legalHoldModel
      .findOne({ execution_id: new Types.ObjectId(executionId) })
      .select({
        active: 1,
        reason: 1,
        set_by_owner_id: 1,
        created_at: 1,
        released_at: 1,
      })
      .lean()
      .exec();

    if (!hold) {
      return {
        active: false,
        reason: null,
        set_by_owner_id: null,
        created_at: null,
        released_at: null,
      };
    }

    return {
      active: Boolean(hold.active),
      reason: hold.reason ?? null,
      set_by_owner_id: hold.set_by_owner_id
        ? hold.set_by_owner_id.toString()
        : null,
      created_at: hold.created_at ?? null,
      released_at: hold.released_at ?? null,
    };
  }

  async placeExecutionLegalHold(
    executionId: string,
    ownerId: string,
    reason?: string,
  ): Promise<void> {
    const executionObjectId = new Types.ObjectId(executionId);

    await this.legalHoldModel.findOneAndUpdate(
      { execution_id: executionObjectId },
      {
        $set: {
          active: true,
          reason: reason?.trim() || null,
          set_by_owner_id: new Types.ObjectId(ownerId),
          released_at: null,
        },
        $setOnInsert: {
          execution_id: executionObjectId,
          created_at: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    await this.eventModel
      .updateMany(
        { execution_id: executionObjectId },
        {
          $set: {
            legal_hold: true,
            legal_hold_at: new Date(),
            expires_at: LEGAL_HOLD_EXPIRATION_DATE,
          },
        },
      )
      .exec();
  }

  async releaseExecutionLegalHold(executionId: string): Promise<void> {
    const executionObjectId = new Types.ObjectId(executionId);

    await this.legalHoldModel
      .findOneAndUpdate(
        { execution_id: executionObjectId, active: true },
        {
          $set: {
            active: false,
            released_at: new Date(),
          },
        },
        {
          returnDocument: 'after',
        },
      )
      .exec();

    const heldEvents = await this.eventModel
      .find({ execution_id: executionObjectId, legal_hold: true })
      .select({ _id: 1, occurred_at: 1, retention_class: 1 })
      .exec();

    for (const event of heldEvents) {
      const expiresAt = this.computeExpiresAt(event.occurred_at, event.retention_class);
      await this.eventModel
        .updateOne(
          { _id: event._id },
          {
            $set: {
              legal_hold: false,
              expires_at: expiresAt,
            },
            $unset: {
              legal_hold_at: '',
            },
          },
        )
        .exec();
    }
  }

  computeExpiresAt(occurredAt: Date, retentionClass: EventRetentionClass): Date {
    const retentionDays = this.resolveRetentionDays(retentionClass);
    return new Date(occurredAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  }

  private resolveRetentionDays(retentionClass?: EventRetentionClass): number {
    const configured =
      retentionClass === 'security'
        ? process.env.EVENT_RETENTION_DAYS_SECURITY
        : retentionClass === 'compliance'
          ? process.env.EVENT_RETENTION_DAYS_COMPLIANCE
          : process.env.EVENT_RETENTION_DAYS_OPERATIONAL;

    const parsed = this.parseRetentionDays(configured);
    return parsed ?? DEFAULT_EVENT_RETENTION_DAYS;
  }

  private parseRetentionDays(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed) || parsed < 1) {
      return undefined;
    }

    return Math.floor(parsed);
  }
}
