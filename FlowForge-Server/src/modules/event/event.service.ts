import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EventRetentionClass,
  EventType,
  ExecutionEvent,
  ExecutionEventDocument,
} from './execution-event.schema';
import { EventGovernanceService } from './event-governance.service';

export interface ListExecutionEventsOptions {
  type?: EventType[];
  step_id?: string;
  occurred_from?: Date;
  occurred_to?: Date;
  cursor?: string;
  limit: number;
}

interface EventListPageInfo {
  limit: number;
  cursor: string | null;
  next_cursor: string | null;
  has_next_page: boolean;
}

export interface ListExecutionEventsResponse {
  items: ExecutionEventDocument[];
  page_info: EventListPageInfo;
}

@Injectable()
export class EventService {
  constructor(
    @InjectModel(ExecutionEvent.name)
    private readonly eventModel: Model<ExecutionEventDocument>,
    private readonly eventGovernanceService: EventGovernanceService,
  ) {}

  async append(
    executionId: string,
    type: EventType,
    payload: Record<string, unknown> = {},
    stepId: string | null = null,
    options: { retentionClass?: EventRetentionClass } = {},
  ): Promise<ExecutionEventDocument> {
    const retentionClass =
      options.retentionClass ?? this.resolveRetentionClassByType(type);
    const occurredAt = new Date();
    const legalHold = await this.eventGovernanceService.isExecutionOnLegalHold(executionId);
    const expiresAt = legalHold
      ? new Date('9999-12-31T00:00:00.000Z')
      : this.eventGovernanceService.computeExpiresAt(occurredAt, retentionClass);

    const event = new this.eventModel({
      execution_id: new Types.ObjectId(executionId),
      step_id: stepId,
      type,
      payload,
      retention_class: retentionClass,
      expires_at: expiresAt,
      payload_size_bytes: this.computePayloadSize(payload),
      legal_hold: legalHold,
      legal_hold_at: legalHold ? occurredAt : null,
      occurred_at: occurredAt,
    });
    return event.save();
  }

  private resolveRetentionClassByType(type: EventType): EventRetentionClass {
    const securityTypes: EventType[] = [
      'execution.failed',
      'execution.cancelled',
      'step.failed',
      'step.retrying',
      'step.compensation.failed',
    ];

    const complianceTypes: EventType[] = [
      'execution.completed',
      'execution.compensating',
      'step.compensation.started',
      'step.compensation.completed',
    ];

    if (securityTypes.includes(type)) {
      return 'security';
    }

    if (complianceTypes.includes(type)) {
      return 'compliance';
    }

    return 'operational';
  }

  async findByExecutionId(
    executionId: string,
    options: ListExecutionEventsOptions,
  ): Promise<ListExecutionEventsResponse> {
    const filter: Record<string, unknown> = {
      execution_id: new Types.ObjectId(executionId),
    };

    if (options.type?.length) {
      filter.type = { $in: options.type };
    }

    if (options.step_id !== undefined) {
      filter.step_id = options.step_id;
    }

    const occurredAtRange: Record<string, Date> = {};
    if (options.occurred_from) {
      occurredAtRange.$gte = options.occurred_from;
    }
    if (options.occurred_to) {
      occurredAtRange.$lte = options.occurred_to;
    }
    if (Object.keys(occurredAtRange).length > 0) {
      filter.occurred_at = occurredAtRange;
    }

    const andClauses: Record<string, unknown>[] = [filter];
    if (options.cursor) {
      const decodedCursor = this.decodeCursor(options.cursor);
      andClauses.push({
        $or: [
          { occurred_at: { $gt: decodedCursor.occurred_at } },
          {
            occurred_at: decodedCursor.occurred_at,
            _id: { $gt: decodedCursor.id },
          },
        ],
      });
    }

    const queryFilter = andClauses.length === 1 ? andClauses[0] : { $and: andClauses };
    const docs = await this.eventModel
      .find(queryFilter)
      .sort({ occurred_at: 1, _id: 1 })
      .limit(options.limit + 1)
      .exec();

    const hasNextPage = docs.length > options.limit;
    const items = hasNextPage ? docs.slice(0, options.limit) : docs;
    const nextCursor = hasNextPage
      ? this.encodeCursor(items[items.length - 1])
      : null;

    return {
      items,
      page_info: {
        limit: options.limit,
        cursor: options.cursor ?? null,
        next_cursor: nextCursor,
        has_next_page: hasNextPage,
      },
    };
  }

  private computePayloadSize(payload: Record<string, unknown>): number {
    try {
      return Buffer.byteLength(JSON.stringify(payload), 'utf8');
    } catch {
      return 0;
    }
  }

  private encodeCursor(item: ExecutionEventDocument): string {
    const occurredAtFromDoc =
      typeof item.get === 'function'
        ? ((item.get('occurred_at') as Date | undefined) ?? undefined)
        : undefined;
    const occurredAtFromObject = (item as unknown as { occurred_at?: Date }).occurred_at;
    const occurredAt = occurredAtFromDoc ?? occurredAtFromObject;

    if (!occurredAt || Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Event cursor source is invalid');
    }

    const payload = JSON.stringify({
      occurred_at: occurredAt.toISOString(),
      id: item._id.toString(),
    });

    return Buffer.from(payload).toString('base64url');
  }

  private decodeCursor(cursor: string): { occurred_at: Date; id: Types.ObjectId } {
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw) as { occurred_at?: string; id?: string };

      if (!parsed.occurred_at || !parsed.id || !Types.ObjectId.isValid(parsed.id)) {
        throw new BadRequestException('Invalid cursor');
      }

      const occurredAt = new Date(parsed.occurred_at);
      if (Number.isNaN(occurredAt.getTime())) {
        throw new BadRequestException('Invalid cursor');
      }

      return { occurred_at: occurredAt, id: new Types.ObjectId(parsed.id) };
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }
}

