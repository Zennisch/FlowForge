import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EventService } from '../event/event.service';
import { CompensationExecutorService } from './compensation-executor.service';
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
const mockStepFindExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStepExecutionModel: any = {};
mockStepExecutionModel.updateMany = jest
  .fn()
  .mockReturnValue({ exec: mockUpdateManyExec });
mockStepExecutionModel.find = jest.fn().mockReturnValue({
  sort: jest.fn().mockReturnValue({ exec: mockStepFindExec }),
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const executionId = new Types.ObjectId().toHexString();
const stepExecutionId = new Types.ObjectId().toHexString();

const makeExecutionDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: executionId,
  status: 'running',
  context: {},
  workflow_snapshot: { steps: [] },
  save: mockExecutionSave,
  ...overrides,
});

const makeCompletedStepExecution = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(stepExecutionId),
  step_id: 'reserve-inventory',
  status: 'completed',
  input: { sku: 'ABC' },
  output: { reservationId: 'rsv-1' },
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CompensateService', () => {
  let service: CompensateService;
  let eventService: EventService;
  let compensationExecutor: CompensationExecutorService;

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
        {
          provide: CompensationExecutorService,
          useValue: { execute: jest.fn().mockResolvedValue({ applied: true }) },
        },
      ],
    }).compile();

    service = module.get<CompensateService>(CompensateService);
    eventService = module.get<EventService>(EventService);
    compensationExecutor = module.get<CompensationExecutorService>(
      CompensationExecutorService,
    );
  });

  // ── compensate ──────────────────────────────────────────────────────────────

  describe('compensate', () => {
    it('transitions execution from running → compensating → failed', async () => {
      const doc = makeExecutionDoc({ status: 'running' });
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockStepFindExec.mockResolvedValue([]);
      mockUpdateManyExec.mockResolvedValue({ modifiedCount: 1 });
      mockExecutionSave.mockResolvedValue(doc);

      const result = await service.compensate(executionId);

      expect(result.status).toBe('failed');
      expect(result.completed_at).toBeInstanceOf(Date);
    });

    it('calls updateMany to mark all queued/running steps as failed', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockStepFindExec.mockResolvedValue([]);
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
      mockStepFindExec.mockResolvedValue([]);
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
      mockStepFindExec.mockResolvedValue([]);
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
      mockStepFindExec.mockResolvedValue([]);
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

    it('runs compensation for completed steps with compensation enabled', async () => {
      const stepExecution = makeCompletedStepExecution();
      const doc = makeExecutionDoc({
        workflow_snapshot: {
          steps: [
            {
              id: 'reserve-inventory',
              type: 'http',
              config: {},
              compensation: {
                enabled: true,
                type: 'http',
                config: { url: 'https://example.test/undo' },
              },
            },
          ],
          edges: [],
        },
      });

      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockStepFindExec.mockResolvedValue([stepExecution]);
      mockUpdateManyExec.mockResolvedValue({ modifiedCount: 1 });
      mockExecutionSave.mockResolvedValue(doc);

      await service.compensate(executionId);

      expect(compensationExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId,
          stepId: 'reserve-inventory',
        }),
      );
      expect(eventService.append).toHaveBeenCalledWith(
        executionId,
        'step.compensation.started',
        { type: 'http' },
        'reserve-inventory',
      );
      expect(eventService.append).toHaveBeenCalledWith(
        executionId,
        'step.compensation.completed',
        expect.objectContaining({ type: 'http' }),
        'reserve-inventory',
      );
    });

    it('skips completed steps when compensation is not enabled', async () => {
      const stepExecution = makeCompletedStepExecution({ step_id: 'transform-a' });
      const doc = makeExecutionDoc({
        workflow_snapshot: {
          steps: [
            {
              id: 'transform-a',
              type: 'transform',
              config: {},
              compensation: { enabled: false, type: 'noop', config: {} },
            },
          ],
          edges: [],
        },
      });

      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockStepFindExec.mockResolvedValue([stepExecution]);
      mockUpdateManyExec.mockResolvedValue({ modifiedCount: 1 });
      mockExecutionSave.mockResolvedValue(doc);

      await service.compensate(executionId);

      expect(compensationExecutor.execute).not.toHaveBeenCalled();
      expect(eventService.append).not.toHaveBeenCalledWith(
        executionId,
        'step.compensation.started',
        expect.anything(),
        'transform-a',
      );
    });
  });
});
