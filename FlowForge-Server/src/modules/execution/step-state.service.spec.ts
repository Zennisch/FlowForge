import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EventService } from '../event/event.service';
import { Execution } from './execution.schema';
import { StepExecution } from './step-execution.schema';
import { StepStateService } from './step-state.service';

// ─── Mongoose model mock ──────────────────────────────────────────────────────

const mockStepSave = jest.fn();
const mockStepFindByIdExec = jest.fn();
const mockStepFindOneAndUpdateExec = jest.fn();
const mockExecutionFindByIdExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStepExecutionModel: any = {};
mockStepExecutionModel.findById = jest
  .fn()
  .mockReturnValue({ exec: mockStepFindByIdExec });
mockStepExecutionModel.findOneAndUpdate = jest
  .fn()
  .mockReturnValue({ exec: mockStepFindOneAndUpdateExec });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecutionModel: any = {};
mockExecutionModel.findById = jest
  .fn()
  .mockReturnValue({ exec: mockExecutionFindByIdExec });

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const executionId = new Types.ObjectId();
const stepExecutionId = new Types.ObjectId().toHexString();

const makeStepDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: stepExecutionId,
  execution_id: { toHexString: () => executionId.toHexString() },
  step_id: 'step-1',
  status: 'queued',
  attempt: 0,
  input: {},
  output: null,
  error: null,
  save: mockStepSave,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StepStateService', () => {
  let service: StepStateService;
  let eventService: EventService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StepStateService,
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

    service = module.get<StepStateService>(StepStateService);
    eventService = module.get<EventService>(EventService);
  });

  // ── markRunning ─────────────────────────────────────────────────────────────

  describe('markRunning', () => {
    it('sets status to running and sets started_at', async () => {
      const doc = makeStepDoc({ status: 'running', started_at: new Date() });
      mockStepFindByIdExec.mockResolvedValue(makeStepDoc());
      mockExecutionFindByIdExec.mockResolvedValue({
        status: 'running',
        workflow_snapshot: {
          steps: [{ id: 'step-1', config: {} }],
        },
      });
      mockStepFindOneAndUpdateExec.mockResolvedValue(doc);

      const result = await service.markRunning(stepExecutionId);

      expect(result.status).toBe('running');
      expect(result.started_at).toBeInstanceOf(Date);
      expect(mockStepExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: stepExecutionId, status: 'queued' },
        {
          $set: {
            status: 'running',
            started_at: expect.any(Date),
            timeout_ms: 300000,
            timeout_at: expect.any(Date),
          },
        },
        { returnDocument: 'after' },
      );
    });

    it('appends a step.started event', async () => {
      const doc = makeStepDoc({ status: 'running', started_at: new Date() });
      mockStepFindByIdExec.mockResolvedValue(makeStepDoc());
      mockExecutionFindByIdExec.mockResolvedValue({
        status: 'running',
        workflow_snapshot: {
          steps: [{ id: 'step-1', config: {} }],
        },
      });
      mockStepFindOneAndUpdateExec.mockResolvedValue(doc);

      await service.markRunning(stepExecutionId);

      expect(eventService.append).toHaveBeenCalledWith(
        executionId.toHexString(),
        'step.started',
        { attempt: 0 },
        'step-1',
      );
    });

    it('throws NotFoundException when step execution does not exist', async () => {
      mockStepFindByIdExec.mockResolvedValue(null);

      await expect(service.markRunning(stepExecutionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns null when step cannot transition from queued to running', async () => {
      mockStepFindByIdExec.mockResolvedValue(makeStepDoc());
      mockExecutionFindByIdExec.mockResolvedValue({
        status: 'running',
        workflow_snapshot: {
          steps: [{ id: 'step-1', config: {} }],
        },
      });
      mockStepFindOneAndUpdateExec.mockResolvedValue(null);

      const result = await service.markRunning(stepExecutionId);

      expect(result).toBeNull();
      expect(eventService.append).not.toHaveBeenCalled();
    });

    it('returns null when execution is not running', async () => {
      const doc = makeStepDoc({ status: 'queued' });
      mockStepFindByIdExec.mockResolvedValue(doc);
      mockExecutionFindByIdExec.mockResolvedValue({ status: 'cancelled' });

      const result = await service.markRunning(stepExecutionId);

      expect(result).toBeNull();
      expect(mockStepExecutionModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(eventService.append).not.toHaveBeenCalled();
    });

    it('uses per-step timeout from workflow snapshot config when provided', async () => {
      mockStepFindByIdExec.mockResolvedValue(makeStepDoc());
      mockExecutionFindByIdExec.mockResolvedValue({
        status: 'running',
        workflow_snapshot: {
          steps: [{ id: 'step-1', config: { timeoutMs: 15000 } }],
        },
      });
      mockStepFindOneAndUpdateExec.mockResolvedValue(
        makeStepDoc({
          status: 'running',
          timeout_ms: 15000,
          timeout_at: new Date(),
        }),
      );

      await service.markRunning(stepExecutionId);

      expect(mockStepExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: stepExecutionId, status: 'queued' },
        {
          $set: expect.objectContaining({
            timeout_ms: 15000,
            timeout_at: expect.any(Date),
          }),
        },
        { returnDocument: 'after' },
      );
    });
  });

  // ── markCompleted ───────────────────────────────────────────────────────────

  describe('markCompleted', () => {
    it('sets status to completed, stores output and sets completed_at', async () => {
      const output = { result: 42 };
      const doc = makeStepDoc({
        status: 'completed',
        output,
        completed_at: new Date(),
      });
      mockStepFindOneAndUpdateExec.mockResolvedValue(doc);

      const result = await service.markCompleted(stepExecutionId, output);

      expect(result.status).toBe('completed');
      expect(result.output).toEqual(output);
      expect(result.completed_at).toBeInstanceOf(Date);
    });

    it('appends a step.completed event', async () => {
      const doc = makeStepDoc({ status: 'running' });
      mockStepFindOneAndUpdateExec.mockResolvedValue(doc);

      const output = { result: 'ok' };
      await service.markCompleted(stepExecutionId, output);

      expect(eventService.append).toHaveBeenCalledWith(
        executionId.toHexString(),
        'step.completed',
        { output },
        'step-1',
      );
    });

    it('throws NotFoundException when step execution does not exist', async () => {
      mockStepFindOneAndUpdateExec.mockResolvedValue(null);
      mockStepFindByIdExec.mockResolvedValue(null);

      await expect(service.markCompleted(stepExecutionId, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns null when step is already terminal (duplicate completion)', async () => {
      mockStepFindOneAndUpdateExec.mockResolvedValue(null);
      mockStepFindByIdExec.mockResolvedValue(
        makeStepDoc({ status: 'completed' }),
      );

      const result = await service.markCompleted(stepExecutionId, {
        result: 'dup',
      });

      expect(result).toBeNull();
      expect(eventService.append).not.toHaveBeenCalled();
    });
  });

  // ── markFailed ──────────────────────────────────────────────────────────────

  describe('markFailed', () => {
    it('sets status to failed, stores error and sets completed_at', async () => {
      const doc = makeStepDoc({
        status: 'failed',
        error: 'timeout',
        completed_at: new Date(),
      });
      mockStepFindOneAndUpdateExec.mockResolvedValue(doc);

      const result = await service.markFailed(stepExecutionId, 'timeout');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('timeout');
      expect(result.completed_at).toBeInstanceOf(Date);
    });

    it('appends a step.failed event with error and attempt', async () => {
      const doc = makeStepDoc({ status: 'running', attempt: 2 });
      mockStepFindOneAndUpdateExec.mockResolvedValue(doc);

      await service.markFailed(stepExecutionId, 'connection refused');

      expect(eventService.append).toHaveBeenCalledWith(
        executionId.toHexString(),
        'step.failed',
        { error: 'connection refused', attempt: 2 },
        'step-1',
      );
    });

    it('throws NotFoundException when step execution does not exist', async () => {
      mockStepFindOneAndUpdateExec.mockResolvedValue(null);
      mockStepFindByIdExec.mockResolvedValue(null);

      await expect(
        service.markFailed(stepExecutionId, 'some error'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns null when step is already terminal (duplicate failure)', async () => {
      mockStepFindOneAndUpdateExec.mockResolvedValue(null);
      mockStepFindByIdExec.mockResolvedValue(makeStepDoc({ status: 'failed' }));

      const result = await service.markFailed(stepExecutionId, 'duplicate');

      expect(result).toBeNull();
      expect(eventService.append).not.toHaveBeenCalled();
    });
  });
});
