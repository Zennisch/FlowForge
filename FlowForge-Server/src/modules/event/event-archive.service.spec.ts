import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EventArchiveService } from './event-archive.service';
import { ExecutionEventArchive } from './execution-event-archive.schema';
import { ExecutionEvent } from './execution-event.schema';

const mockFindExec = jest.fn();
const mockFindLimit = jest.fn();
const mockFindSort = jest.fn();
const mockBulkWrite = jest.fn();
const mockDeleteManyExec = jest.fn();

const mockEventModel = {
  find: jest.fn().mockReturnValue({ sort: mockFindSort }),
  deleteMany: jest.fn().mockReturnValue({ exec: mockDeleteManyExec }),
};

mockFindSort.mockReturnValue({ limit: mockFindLimit });
mockFindLimit.mockReturnValue({ exec: mockFindExec });

const mockArchiveModel = {
  bulkWrite: mockBulkWrite,
};

describe('EventArchiveService', () => {
  let service: EventArchiveService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.EVENT_ARCHIVE_ENABLED = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventArchiveService,
        {
          provide: getModelToken(ExecutionEvent.name),
          useValue: mockEventModel,
        },
        {
          provide: getModelToken(ExecutionEventArchive.name),
          useValue: mockArchiveModel,
        },
      ],
    }).compile();

    service = module.get<EventArchiveService>(EventArchiveService);
  });

  afterEach(() => {
    delete process.env.EVENT_ARCHIVE_ENABLED;
    delete process.env.EVENT_ARCHIVE_BATCH_SIZE;
    delete process.env.EVENT_ARCHIVE_INTERVAL_MS;
  });

  it('archives expired events and removes them from hot collection', async () => {
    const sourceId = new Types.ObjectId();
    const executionId = new Types.ObjectId();
    mockFindExec.mockResolvedValue([
      {
        _id: sourceId,
        execution_id: executionId,
        step_id: 'step-1',
        type: 'step.completed',
        payload: { ok: true },
        retention_class: 'operational',
        expires_at: new Date('2026-03-01T00:00:00.000Z'),
        payload_size_bytes: 12,
        occurred_at: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);
    mockBulkWrite.mockResolvedValue({});
    mockDeleteManyExec.mockResolvedValue({ deletedCount: 1 });

    const result = await service.archiveExpiredEvents(
      new Date('2026-03-02T00:00:00.000Z'),
    );

    expect(result).toBe(1);
    expect(mockEventModel.find).toHaveBeenCalledWith({
      expires_at: { $lte: new Date('2026-03-02T00:00:00.000Z') },
      legal_hold: { $ne: true },
    });
    expect(mockArchiveModel.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { source_event_id: sourceId },
            upsert: true,
          }),
        }),
      ]),
      { ordered: false },
    );
    expect(mockEventModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: [sourceId] },
    });
  });

  it('returns zero without touching models when archive is disabled', async () => {
    process.env.EVENT_ARCHIVE_ENABLED = 'false';

    const result = await service.archiveExpiredEvents();

    expect(result).toBe(0);
    expect(mockEventModel.find).not.toHaveBeenCalled();
    expect(mockArchiveModel.bulkWrite).not.toHaveBeenCalled();
    expect(mockEventModel.deleteMany).not.toHaveBeenCalled();
  });

  it('returns zero when no expired events are found', async () => {
    mockFindExec.mockResolvedValue([]);

    const result = await service.archiveExpiredEvents();

    expect(result).toBe(0);
    expect(mockArchiveModel.bulkWrite).not.toHaveBeenCalled();
    expect(mockEventModel.deleteMany).not.toHaveBeenCalled();
  });
});
