import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EventGovernanceService } from './event-governance.service';
import { EventLegalHold } from './event-legal-hold.schema';
import { ExecutionEvent } from './execution-event.schema';

const mockLegalHoldFindOneExec = jest.fn();
const mockLegalHoldFindOneLean = jest.fn();
const mockLegalHoldFindOneSelect = jest.fn();
const mockLegalHoldFindOneAndUpdateExec = jest.fn();

const mockLegalHoldModel = {
  findOne: jest.fn().mockReturnValue({
    select: mockLegalHoldFindOneSelect,
  }),
  findOneAndUpdate: jest
    .fn()
    .mockReturnValue({ exec: mockLegalHoldFindOneAndUpdateExec }),
};

mockLegalHoldFindOneSelect.mockReturnValue({ lean: mockLegalHoldFindOneLean });
mockLegalHoldFindOneLean.mockReturnValue({ exec: mockLegalHoldFindOneExec });

const mockEventFindExec = jest.fn();
const mockEventUpdateManyExec = jest.fn();
const mockEventUpdateOneExec = jest.fn();

const mockEventModel = {
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ exec: mockEventFindExec }),
  }),
  updateMany: jest.fn().mockReturnValue({ exec: mockEventUpdateManyExec }),
  updateOne: jest.fn().mockReturnValue({ exec: mockEventUpdateOneExec }),
};

describe('EventGovernanceService', () => {
  let service: EventGovernanceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventGovernanceService,
        {
          provide: getModelToken(EventLegalHold.name),
          useValue: mockLegalHoldModel,
        },
        {
          provide: getModelToken(ExecutionEvent.name),
          useValue: mockEventModel,
        },
      ],
    }).compile();

    service = module.get<EventGovernanceService>(EventGovernanceService);
  });

  it('reports legal hold status for an execution', async () => {
    mockLegalHoldFindOneExec.mockResolvedValueOnce({
      _id: new Types.ObjectId(),
    });
    await expect(
      service.isExecutionOnLegalHold(new Types.ObjectId().toHexString()),
    ).resolves.toBe(true);

    mockLegalHoldFindOneExec.mockResolvedValueOnce(null);
    await expect(
      service.isExecutionOnLegalHold(new Types.ObjectId().toHexString()),
    ).resolves.toBe(false);
  });

  it('returns legal hold state details for an execution', async () => {
    const ownerId = new Types.ObjectId();
    mockLegalHoldFindOneExec.mockResolvedValueOnce({
      active: true,
      reason: 'audit',
      set_by_owner_id: ownerId,
      created_at: new Date('2026-03-22T10:00:00.000Z'),
      released_at: null,
    });

    await expect(
      service.getExecutionLegalHoldState(new Types.ObjectId().toHexString()),
    ).resolves.toEqual({
      active: true,
      reason: 'audit',
      set_by_owner_id: ownerId.toHexString(),
      created_at: new Date('2026-03-22T10:00:00.000Z'),
      released_at: null,
    });

    mockLegalHoldFindOneExec.mockResolvedValueOnce(null);

    await expect(
      service.getExecutionLegalHoldState(new Types.ObjectId().toHexString()),
    ).resolves.toEqual({
      active: false,
      reason: null,
      set_by_owner_id: null,
      created_at: null,
      released_at: null,
    });
  });

  it('places legal hold and marks existing events as held', async () => {
    mockLegalHoldFindOneAndUpdateExec.mockResolvedValue({});
    mockEventUpdateManyExec.mockResolvedValue({ modifiedCount: 2 });

    await service.placeExecutionLegalHold(
      new Types.ObjectId().toHexString(),
      new Types.ObjectId().toHexString(),
      'investigation',
    );

    expect(mockLegalHoldModel.findOneAndUpdate).toHaveBeenCalled();
    expect(mockEventModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ execution_id: expect.any(Types.ObjectId) }),
      expect.objectContaining({
        $set: expect.objectContaining({
          legal_hold: true,
          expires_at: new Date('9999-12-31T00:00:00.000Z'),
        }),
      }),
    );
  });

  it('releases legal hold and recomputes expires_at for held events', async () => {
    mockLegalHoldFindOneAndUpdateExec.mockResolvedValue({});
    const heldEventId = new Types.ObjectId();
    mockEventFindExec.mockResolvedValue([
      {
        _id: heldEventId,
        occurred_at: new Date('2026-03-01T00:00:00.000Z'),
        retention_class: 'operational',
      },
    ]);
    mockEventUpdateOneExec.mockResolvedValue({ modifiedCount: 1 });

    await service.releaseExecutionLegalHold(new Types.ObjectId().toHexString());

    expect(mockEventModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ legal_hold: true }),
    );
    expect(mockEventModel.updateOne).toHaveBeenCalledWith(
      { _id: heldEventId },
      expect.objectContaining({
        $set: expect.objectContaining({
          legal_hold: false,
          expires_at: expect.any(Date),
        }),
      }),
    );
  });
});
