import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EventService } from '../event/event.service';
import { CompensateService } from './compensate.service';
import { Execution } from './execution.schema';
import { StepExecution } from './step-execution.schema';

// ─── Mongoose model mocks ──────────────────────────────────────────────────────

const mockExecutionSave = jest.fn();
const mockExecutionFindByIdExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecutionModel: any = {};
mockExecutionModel.findById = jest
  .fn()
  .mockReturnValue({ exec: mockExecutionFindByIdExec });

const mockUpdateManyExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStepExecutionModel: any = {};
mockStepExecutionModel.updateMany = jest
  .fn()
  .mockReturnValue({ exec: mockUpdateManyExec });

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const executionId = new Types.ObjectId().toHexString();

const makeExecutionDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: executionId,
  status: 'running',
  save: mockExecutionSave,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CompensateService', () => {
  let service: CompensateService;
  let eventService: EventService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompensateService,
        {
          provide: getModelToken(Execution.name),
          useValue: mockExecutionModel,
        },
        {
          provide: getModelToken(StepExecution.name),
          useValue: mockStepExecutionModel,
        },
        {
          provide: EventService,
          useValue: { append: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<CompensateService>(CompensateService);
    eventService = module.get<EventService>(EventService);
  });

  // ── compensate ──────────────────────────────────────────────────────────────

  describe('compensate', () => {
    it('transitions execution from running → compensating → failed', async () => {
      const doc = makeExecutionDoc({ status: 'running' });
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockUpdateManyExec.mockResolvedValue({ modifiedCount: 1 });
      mockExecutionSave.mockResolvedValue(doc);

      const result = await service.compensate(executionId);

      expect(result.status).toBe('failed');
      expect(result.completed_at).toBeInstanceOf(Date);
    });

    it('calls updateMany to mark all queued/running steps as failed', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockUpdateManyExec.mockResolvedValue({ modifiedCount: 3 });
      mockExecutionSave.mockResolvedValue(doc);

      await service.compensate(executionId);

      expect(mockStepExecutionModel.updateMany).toHaveBeenCalledWith(
        {
          execution_id: expect.any(Types.ObjectId),
          status: { $in: ['queued', 'running'] },
        },
        {
          $set: expect.objectContaining({
            status: 'failed',
            error: 'Execution compensated',
          }),
        },
      );
    });

    it('appends execution.compensating and execution.failed events', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockUpdateManyExec.mockResolvedValue({});
      mockExecutionSave.mockResolvedValue(doc);

      await service.compensate(executionId);

      expect(eventService.append).toHaveBeenCalledWith(
        executionId,
        'execution.compensating',
      );
      expect(eventService.append).toHaveBeenCalledWith(
        executionId,
        'execution.failed',
        { reason: 'compensation' },
      );
    });

    it('saves execution twice (once for compensating, once for failed)', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockUpdateManyExec.mockResolvedValue({});
      mockExecutionSave.mockResolvedValue(doc);

      await service.compensate(executionId);

      expect(mockExecutionSave).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException when execution does not exist', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(null);

      await expect(service.compensate(executionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('uses timeout reason when compensation is triggered by watchdog', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockUpdateManyExec.mockResolvedValue({ modifiedCount: 1 });
      mockExecutionSave.mockResolvedValue(doc);

      await service.compensate(executionId, 'timeout');

      expect(mockStepExecutionModel.updateMany).toHaveBeenCalledWith(
        expect.any(Object),
        {
          $set: expect.objectContaining({
            status: 'failed',
            error: 'Execution timed out',
          }),
        },
      );
      expect(eventService.append).toHaveBeenCalledWith(
        executionId,
        'execution.failed',
        { reason: 'timeout' },
      );
    });
  });
});
