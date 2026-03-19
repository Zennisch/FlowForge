import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PubSubService } from '../../infra/pubsub/pubsub.provider';
import { EventService } from '../event/event.service';
import { WorkflowService } from '../workflow/workflow.service';
import { TriggerExecutionDto } from './dto/trigger-execution.dto';
import { ExecutionService } from './execution.service';
import { Execution } from './execution.schema';
import { StepExecution } from './step-execution.schema';

// ─── Mongoose model mocks ─────────────────────────────────────────────────────

const mockExecutionSave = jest.fn();
const mockExecutionFindOneExec = jest.fn();
const mockExecutionFindByIdExec = jest.fn();
const mockExecutionFindSortExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecutionModel: any = jest
  .fn()
  .mockImplementation((dto: Record<string, unknown>) => ({
    ...dto,
    _id: new Types.ObjectId(),
    save: mockExecutionSave,
  }));

mockExecutionModel.findOne = jest
  .fn()
  .mockReturnValue({ exec: mockExecutionFindOneExec });
mockExecutionModel.findById = jest
  .fn()
  .mockReturnValue({ exec: mockExecutionFindByIdExec });
mockExecutionModel.find = jest.fn().mockReturnValue({
  sort: jest.fn().mockReturnValue({ exec: mockExecutionFindSortExec }),
});

const mockStepSave = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStepExecutionModel: any = jest
  .fn()
  .mockImplementation((dto: Record<string, unknown>) => ({
    ...dto,
    _id: new Types.ObjectId(),
    save: mockStepSave,
  }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ownerId = new Types.ObjectId().toHexString();
const otherOwnerId = new Types.ObjectId().toHexString();
const workflowId = new Types.ObjectId().toHexString();
const executionId = new Types.ObjectId().toHexString();

const makeWorkflowDoc = (steps: { id: string }[] = []) => ({
  _id: workflowId,
  owner_id: { toString: () => ownerId },
  name: 'Test Workflow',
  steps,
  edges: [],
});

const makeExecutionDoc = (
  overrides: Record<string, unknown> = {},
) => ({
  _id: executionId,
  owner_id: { toString: () => ownerId },
  status: 'running',
  save: mockExecutionSave,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExecutionService', () => {
  let service: ExecutionService;
  let workflowService: WorkflowService;
  let eventService: EventService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionService,
        { provide: getModelToken(Execution.name), useValue: mockExecutionModel },
        {
          provide: getModelToken(StepExecution.name),
          useValue: mockStepExecutionModel,
        },
        {
          provide: WorkflowService,
          useValue: { findOne: jest.fn(), findActiveWebhookWorkflow: jest.fn() },
        },
        {
          provide: EventService,
          useValue: { append: jest.fn().mockResolvedValue({}), findByExecutionId: jest.fn() },
        },
        {
          provide: PubSubService,
          useValue: { publishJob: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<ExecutionService>(ExecutionService);
    workflowService = module.get<WorkflowService>(WorkflowService);
    eventService = module.get<EventService>(EventService);
  });

  // ── trigger ─────────────────────────────────────────────────────────────────

  describe('trigger', () => {
    it('creates an execution and step executions for each workflow step', async () => {
      const steps = [{ id: 'step-1' }, { id: 'step-2' }];
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc(steps) as never);
      mockExecutionFindOneExec.mockResolvedValue(null);
      const savedExec = makeExecutionDoc();
      mockExecutionSave.mockResolvedValue(savedExec);
      mockStepSave.mockResolvedValue({});

      const dto: TriggerExecutionDto = { payload: { foo: 'bar' } };
      const result = await service.trigger(workflowId, ownerId, dto);

      expect(workflowService.findOne).toHaveBeenCalledWith(workflowId, ownerId);
      expect(mockExecutionModel).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow_id: expect.any(Types.ObjectId),
          owner_id: expect.any(Types.ObjectId),
          status: 'running',
          trigger_payload: { foo: 'bar' },
        }),
      );
      expect(mockStepExecutionModel).toHaveBeenCalledTimes(2);
      expect(mockStepExecutionModel).toHaveBeenCalledWith(
        expect.objectContaining({ step_id: 'step-1', status: 'queued' }),
      );
      expect(mockStepExecutionModel).toHaveBeenCalledWith(
        expect.objectContaining({ step_id: 'step-2', status: 'queued' }),
      );
      expect(eventService.append).toHaveBeenCalledWith(
        expect.any(String),
        'execution.started',
        expect.any(Object),
      );
      expect(result).toEqual(savedExec);
    });

    it('does not create step executions when workflow has no steps', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc([]) as never);
      mockExecutionFindOneExec.mockResolvedValue(null);
      mockExecutionSave.mockResolvedValue(makeExecutionDoc());

      await service.trigger(workflowId, ownerId, {});

      expect(mockStepExecutionModel).not.toHaveBeenCalled();
    });

    it('throws ConflictException when idempotency key already exists', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);
      mockExecutionFindOneExec.mockResolvedValue(makeExecutionDoc());

      await expect(
        service.trigger(workflowId, ownerId, { idempotency_key: 'dup-key' }),
      ).rejects.toThrow(ConflictException);

      expect(mockExecutionModel).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }));
    });

    it('does not check idempotency when no key is provided', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);
      mockExecutionSave.mockResolvedValue(makeExecutionDoc());

      await service.trigger(workflowId, ownerId, {});

      expect(mockExecutionModel.findOne).not.toHaveBeenCalled();
    });

    it('handles undefined dto when request body is omitted', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);
      mockExecutionSave.mockResolvedValue(makeExecutionDoc());

      await expect(
        service.trigger(
          workflowId,
          ownerId,
          undefined as unknown as TriggerExecutionDto,
        ),
      ).resolves.toBeDefined();
      expect(mockExecutionModel.findOne).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException from WorkflowService', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockRejectedValue(new NotFoundException());

      await expect(
        service.trigger(workflowId, ownerId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from WorkflowService', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockRejectedValue(new ForbiddenException());

      await expect(
        service.trigger(workflowId, ownerId, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates execution with schedule trigger type when called by scheduler', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc([]) as never);
      mockExecutionSave.mockResolvedValue(makeExecutionDoc());

      await service.trigger(
        workflowId,
        ownerId,
        {},
        {
          triggerType: 'schedule',
          payload: {
            cron: '*/5 * * * *',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        },
      );

      expect(mockExecutionModel).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_type: 'schedule',
          trigger_payload: {
            cron: '*/5 * * * *',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        }),
      );
      expect(eventService.append).toHaveBeenCalledWith(
        expect.any(String),
        'execution.started',
        expect.objectContaining({ trigger_type: 'schedule' }),
      );
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all executions for the given owner', async () => {
      const docs = [makeExecutionDoc(), makeExecutionDoc()];
      mockExecutionFindSortExec.mockResolvedValue(docs);

      const result = await service.findAll(ownerId);

      expect(mockExecutionModel.find).toHaveBeenCalledWith({
        owner_id: expect.any(Types.ObjectId),
      });
      expect(result).toEqual(docs);
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the execution when it exists and belongs to the owner', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);

      const result = await service.findOne(executionId, ownerId);

      expect(mockExecutionModel.findById).toHaveBeenCalledWith(executionId);
      expect(result).toEqual(doc);
    });

    it('throws NotFoundException when execution does not exist', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(null);

      await expect(
        service.findOne(executionId, ownerId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when execution belongs to another owner', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);

      await expect(
        service.findOne(executionId, otherOwnerId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── cancel ───────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels a running execution and appends an event', async () => {
      const doc = makeExecutionDoc({ status: 'running' });
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockExecutionSave.mockResolvedValue(doc);

      const result = await service.cancel(executionId, ownerId);

      expect(result.status).toBe('cancelled');
      expect(result.completed_at).toBeInstanceOf(Date);
      expect(mockExecutionSave).toHaveBeenCalled();
      expect(eventService.append).toHaveBeenCalledWith(
        expect.any(String),
        'execution.cancelled',
      );
    });

    it('cancels a pending execution', async () => {
      const doc = makeExecutionDoc({ status: 'pending' });
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockExecutionSave.mockResolvedValue(doc);

      const result = await service.cancel(executionId, ownerId);

      expect(result.status).toBe('cancelled');
    });

    it('throws ConflictException when execution is already completed', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(
        makeExecutionDoc({ status: 'completed' }),
      );

      await expect(
        service.cancel(executionId, ownerId),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when execution is already cancelled', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(
        makeExecutionDoc({ status: 'cancelled' }),
      );

      await expect(
        service.cancel(executionId, ownerId),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when execution has failed', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(
        makeExecutionDoc({ status: 'failed' }),
      );

      await expect(
        service.cancel(executionId, ownerId),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException from findOne', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(null);

      await expect(
        service.cancel(executionId, ownerId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findEvents ───────────────────────────────────────────────────────────────

  describe('findEvents', () => {
    it('returns events for the execution after verifying ownership', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      const events = [{ type: 'execution.started' }];
      jest
        .spyOn(eventService, 'findByExecutionId')
        .mockResolvedValue(events as never);

      const result = await service.findEvents(executionId, ownerId);

      expect(eventService.findByExecutionId).toHaveBeenCalledWith(executionId);
      expect(result).toEqual(events);
    });

    it('throws ForbiddenException when execution belongs to another owner', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(makeExecutionDoc());

      await expect(
        service.findEvents(executionId, otherOwnerId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── triggerByWebhook ───────────────────────────────────────────────────────

  describe('triggerByWebhook', () => {
    it('finds webhook workflow and delegates to trigger with webhook options', async () => {
      const webhookWorkflow = { _id: workflowId };
      const payload = { body: { foo: 'bar' } };

      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue(webhookWorkflow as never);
      const triggerSpy = jest
        .spyOn(service, 'trigger')
        .mockResolvedValue(makeExecutionDoc() as never);

      await service.triggerByWebhook(ownerId, 'orders-created', payload);

      expect(
        (workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }).findActiveWebhookWorkflow,
      ).toHaveBeenCalledWith(ownerId, 'orders-created');
      expect(triggerSpy).toHaveBeenCalledWith(
        workflowId,
        ownerId,
        {},
        {
          triggerType: 'webhook',
          payload,
        },
      );
    });

    it('throws UnauthorizedException when webhook secret is configured but missing', async () => {
      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue({
          _id: workflowId,
          trigger: { config: { secret: 'top-secret' } },
        } as never);

      await expect(
        service.triggerByWebhook(ownerId, 'orders-created', { body: {} }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when webhook secret is invalid', async () => {
      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue({
          _id: workflowId,
          trigger: { config: { secret: 'top-secret' } },
        } as never);

      await expect(
        service.triggerByWebhook(
          ownerId,
          'orders-created',
          { body: {} },
          'wrong-secret',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('triggers execution when webhook secret matches', async () => {
      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue({
          _id: workflowId,
          trigger: { config: { secret: 'top-secret' } },
        } as never);
      const triggerSpy = jest
        .spyOn(service, 'trigger')
        .mockResolvedValue(makeExecutionDoc() as never);

      await service.triggerByWebhook(
        ownerId,
        'orders-created',
        { body: { ok: true } },
        'top-secret',
      );

      expect(triggerSpy).toHaveBeenCalledWith(
        workflowId,
        ownerId,
        {},
        {
          triggerType: 'webhook',
          payload: { body: { ok: true } },
        },
      );
    });
  });
});
