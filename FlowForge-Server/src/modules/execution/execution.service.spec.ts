import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PubSubService } from '../../infra/pubsub/pubsub.provider';
import { EventGovernanceService } from '../event/event-governance.service';
import { EventService } from '../event/event.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ListExecutionEventsQueryDto } from './dto/list-execution-events-query.dto';
import { TriggerExecutionDto } from './dto/trigger-execution.dto';
import { ExecutionService } from './execution.service';
import { Execution } from './execution.schema';
import { StepExecution } from './step-execution.schema';
import { TriggerRateLimit } from './trigger-rate-limit.schema';
import { WebhookNonce } from './webhook-nonce.schema';
import { WebhookRateLimit } from './webhook-rate-limit.schema';

// ─── Mongoose model mocks ─────────────────────────────────────────────────────

const mockExecutionSave = jest.fn();
const mockExecutionFindByIdExec = jest.fn();
const mockExecutionFindExec = jest.fn();
const mockExecutionFindSort = jest.fn();
const mockExecutionFindLimit = jest.fn();
const mockExecutionAggregateExec = jest.fn();
const mockExecutionCountDocumentsExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecutionModel: any = jest
  .fn()
  .mockImplementation((dto: Record<string, unknown>) => ({
    ...dto,
    _id: new Types.ObjectId(),
    save: mockExecutionSave,
  }));

mockExecutionModel.findById = jest
  .fn()
  .mockReturnValue({ exec: mockExecutionFindByIdExec });
mockExecutionFindLimit.mockReturnValue({ exec: mockExecutionFindExec });
mockExecutionFindSort.mockReturnValue({ limit: mockExecutionFindLimit });
mockExecutionModel.find = jest.fn().mockReturnValue({
  sort: mockExecutionFindSort,
});
mockExecutionModel.aggregate = jest
  .fn()
  .mockReturnValue({ exec: mockExecutionAggregateExec });
mockExecutionModel.countDocuments = jest
  .fn()
  .mockReturnValue({ exec: mockExecutionCountDocumentsExec });

const mockStepSave = jest.fn();
const mockStepUpdateManyExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStepExecutionModel: any = jest
  .fn()
  .mockImplementation((dto: Record<string, unknown>) => ({
    ...dto,
    _id: new Types.ObjectId(),
    save: mockStepSave,
  }));

mockStepExecutionModel.updateMany = jest
  .fn()
  .mockReturnValue({ exec: mockStepUpdateManyExec });

const mockWebhookNonceCreate = jest.fn();

const mockWebhookNonceModel = {
  create: mockWebhookNonceCreate,
};

const mockWebhookRateLimitFindOneAndUpdate = jest.fn();

const mockWebhookRateLimitModel = {
  findOneAndUpdate: mockWebhookRateLimitFindOneAndUpdate,
};

const mockTriggerRateLimitFindOneAndUpdate = jest.fn();

const mockTriggerRateLimitModel = {
  findOneAndUpdate: mockTriggerRateLimitFindOneAndUpdate,
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ownerId = new Types.ObjectId().toHexString();
const otherOwnerId = new Types.ObjectId().toHexString();
const workflowId = new Types.ObjectId().toHexString();
const executionId = new Types.ObjectId().toHexString();

const makeWorkflowDoc = (
  steps: { id: string; type: 'http' | 'transform' | 'store' | 'branch' }[] = [],
  overrides: Record<string, unknown> = {},
) => ({
  _id: workflowId,
  owner_id: { toString: () => ownerId },
  name: 'Test Workflow',
  steps,
  edges: [],
  ...overrides,
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
  let eventGovernanceService: EventGovernanceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWebhookNonceCreate.mockResolvedValue({});
    mockWebhookRateLimitFindOneAndUpdate.mockResolvedValue({ count: 1 });
    mockTriggerRateLimitFindOneAndUpdate.mockResolvedValue({ count: 1 });
    mockExecutionCountDocumentsExec.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionService,
        { provide: getModelToken(Execution.name), useValue: mockExecutionModel },
        {
          provide: getModelToken(StepExecution.name),
          useValue: mockStepExecutionModel,
        },
        {
          provide: getModelToken(WebhookNonce.name),
          useValue: mockWebhookNonceModel,
        },
        {
          provide: getModelToken(WebhookRateLimit.name),
          useValue: mockWebhookRateLimitModel,
        },
        {
          provide: getModelToken(TriggerRateLimit.name),
          useValue: mockTriggerRateLimitModel,
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
          provide: EventGovernanceService,
          useValue: {
            isExecutionOnLegalHold: jest.fn().mockResolvedValue(false),
            placeExecutionLegalHold: jest.fn().mockResolvedValue(undefined),
            releaseExecutionLegalHold: jest.fn().mockResolvedValue(undefined),
            computeExpiresAt: jest.fn(),
          },
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
    eventGovernanceService = module.get<EventGovernanceService>(EventGovernanceService);
  });

  // ── trigger ─────────────────────────────────────────────────────────────────

  describe('trigger', () => {
    it('creates an execution and step executions for each workflow step', async () => {
      const steps = [
        { id: 'step-1', type: 'store' as const },
        { id: 'step-2', type: 'transform' as const },
      ];
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc(steps) as never);
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
          timeout_policy: { timeout_ms: 3600000 },
          timeout_at: expect.any(Date),
          workflow_snapshot: {
            steps: [
              {
                id: 'step-1',
                type: 'store',
                config: {},
              },
              {
                id: 'step-2',
                type: 'transform',
                config: {},
              },
            ],
            edges: [],
          },
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
      expect(mockExecutionModel.countDocuments).toHaveBeenCalledTimes(2);
      expect(mockTriggerRateLimitFindOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: expect.any(Types.ObjectId),
          bucket: expect.stringMatching(/^trigger:manual:/),
        }),
        expect.objectContaining({
          $inc: { count: 1 },
        }),
        expect.objectContaining({
          upsert: true,
          returnDocument: 'after',
        }),
      );
      expect(result).toEqual(savedExec);
    });

    it('throws PayloadTooLarge when trigger payload exceeds configured limit', async () => {
      process.env.TRIGGER_PAYLOAD_MAX_BYTES = '16';
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);

      try {
        await service.trigger(workflowId, ownerId, {
          payload: { value: 'x'.repeat(64) },
        });
        fail('Expected trigger to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
      } finally {
        delete process.env.TRIGGER_PAYLOAD_MAX_BYTES;
      }
      expect(mockExecutionModel).not.toHaveBeenCalled();
    });

    it('throws HttpException 429 when tenant concurrent execution quota is exceeded', async () => {
      process.env.TENANT_MAX_RUNNING_EXECUTIONS = '1';
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);
      mockExecutionCountDocumentsExec.mockResolvedValueOnce(1);

      try {
        await service.trigger(workflowId, ownerId, {});
        fail('Expected trigger to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      } finally {
        delete process.env.TENANT_MAX_RUNNING_EXECUTIONS;
      }
      expect(mockExecutionModel).not.toHaveBeenCalled();
    });

    it('throws HttpException 429 when trigger rate limit is exceeded', async () => {
      process.env.TRIGGER_RATE_LIMIT_MAX_REQUESTS = '1';
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);
      mockTriggerRateLimitFindOneAndUpdate.mockResolvedValueOnce({ count: 2 });

      try {
        await service.trigger(workflowId, ownerId, {});
        fail('Expected trigger to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      } finally {
        delete process.env.TRIGGER_RATE_LIMIT_MAX_REQUESTS;
      }
      expect(mockExecutionModel).not.toHaveBeenCalled();
    });

    it('uses workflow trigger execution timeout when configured', async () => {
      jest.spyOn(workflowService, 'findOne').mockResolvedValue(
        makeWorkflowDoc([], {
          trigger: { config: { executionTimeoutMs: 120000 } },
        }) as never,
      );
      mockExecutionSave.mockResolvedValue(makeExecutionDoc());

      await service.trigger(workflowId, ownerId, {});

      expect(mockExecutionModel).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout_policy: { timeout_ms: 120000 },
          timeout_at: expect.any(Date),
        }),
      );
    });

    it('does not create step executions when workflow has no steps', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc([]) as never);
      mockExecutionSave.mockResolvedValue(makeExecutionDoc());

      await service.trigger(workflowId, ownerId, {});

      expect(mockStepExecutionModel).not.toHaveBeenCalled();
    });

    it('throws ConflictException when idempotency key already exists', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);
      mockExecutionSave.mockRejectedValue({ code: 11000 });

      await expect(
        service.trigger(workflowId, ownerId, { idempotency_key: 'dup-key' }),
      ).rejects.toThrow(ConflictException);

      expect(mockStepExecutionModel).not.toHaveBeenCalled();
    });

    it('does not set idempotency key when no key is provided', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);
      mockExecutionSave.mockResolvedValue(makeExecutionDoc());

      await service.trigger(workflowId, ownerId, {});

      expect(mockExecutionModel).toHaveBeenCalledWith(
        expect.not.objectContaining({
          idempotency_key: expect.anything(),
        }),
      );
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
      expect(mockExecutionModel).toHaveBeenCalled();
    });

    it('trims idempotency key before persisting', async () => {
      jest
        .spyOn(workflowService, 'findOne')
        .mockResolvedValue(makeWorkflowDoc() as never);
      mockExecutionSave.mockResolvedValue(makeExecutionDoc());

      await service.trigger(workflowId, ownerId, {
        idempotency_key: '  scoped-key  ',
      });

      expect(mockExecutionModel).toHaveBeenCalledWith(
        expect.objectContaining({ idempotency_key: 'scoped-key' }),
      );
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
    it('returns cursor-paginated executions for the given owner', async () => {
      const docs = [makeExecutionDoc(), makeExecutionDoc()];
      mockExecutionFindExec.mockResolvedValue(docs);

      const result = await service.findAll(ownerId);

      expect(mockExecutionModel.find).toHaveBeenCalledWith({
        owner_id: expect.any(Types.ObjectId),
      });
      expect(mockExecutionFindSort).toHaveBeenCalledWith({ created_at: -1, _id: -1 });
      expect(mockExecutionFindLimit).toHaveBeenCalledWith(21);
      expect(result).toEqual({
        items: docs,
        page_info: {
          limit: 20,
          cursor: null,
          next_cursor: null,
          has_next_page: false,
        },
      });
    });

    it('applies status, trigger, workflow and q filters', async () => {
      mockExecutionFindExec.mockResolvedValue([]);
      const queryExecutionId = new Types.ObjectId().toHexString();
      const workflowObjectId = new Types.ObjectId().toHexString();

      await service.findAll(ownerId, {
        status: ['running'],
        trigger_type: ['manual', 'webhook'],
        workflow_id: workflowObjectId,
        q: queryExecutionId,
        limit: 10,
      });

      expect(mockExecutionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([
            { owner_id: expect.any(Types.ObjectId) },
            { status: { $in: ['running'] } },
            { workflow_id: expect.any(Types.ObjectId) },
            { trigger_type: { $in: ['manual', 'webhook'] } },
            {
              $or: [
                { idempotency_key: queryExecutionId },
                { _id: expect.any(Types.ObjectId) },
              ],
            },
          ]),
        }),
      );
      expect(mockExecutionFindLimit).toHaveBeenCalledWith(11);
    });

    it('applies cursor filter and returns next cursor when more data exists', async () => {
      const cursorSeedDate = new Date('2026-03-22T08:00:00.000Z');
      const cursorSeedId = new Types.ObjectId();
      const cursor = Buffer.from(
        JSON.stringify({ created_at: cursorSeedDate.toISOString(), id: cursorSeedId.toHexString() }),
      ).toString('base64url');
      const olderDoc = {
        ...makeExecutionDoc({ _id: new Types.ObjectId(), created_at: new Date('2026-03-22T07:00:00.000Z') }),
      };
      const overflowDoc = {
        ...makeExecutionDoc({ _id: new Types.ObjectId(), created_at: new Date('2026-03-22T06:00:00.000Z') }),
      };
      mockExecutionFindExec.mockResolvedValue([olderDoc, overflowDoc]);

      const result = await service.findAll(ownerId, {
        cursor,
        limit: 1,
      });

      expect(mockExecutionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([
            { owner_id: expect.any(Types.ObjectId) },
            {
              $or: [
                { created_at: { $lt: cursorSeedDate } },
                { created_at: cursorSeedDate, _id: { $lt: cursorSeedId } },
              ],
            },
          ]),
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.page_info.has_next_page).toBe(true);
      expect(result.page_info.next_cursor).toEqual(expect.any(String));
    });

    it('rejects invalid cursor value', async () => {
      await expect(
        service.findAll(ownerId, {
          cursor: 'invalid-cursor',
          limit: 20,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unfiltered list requests with oversized limits', async () => {
      await expect(
        service.findAll(ownerId, { limit: 80 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid started_at date ranges', async () => {
      await expect(
        service.findAll(ownerId, {
          started_from: '2026-03-20T12:00:00.000Z',
          started_to: '2026-03-19T12:00:00.000Z',
          limit: 20,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findSummary ─────────────────────────────────────────────────────────────

  describe('findSummary', () => {
    it('returns status counts with zero defaults', async () => {
      mockExecutionAggregateExec.mockResolvedValue([
        { _id: 'running', count: 3 },
        { _id: 'failed', count: 1 },
      ]);

      const result = await service.findSummary(ownerId);

      expect(mockExecutionModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            owner_id: expect.any(Types.ObjectId),
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);
      expect(result).toEqual({
        counts: {
          pending: 0,
          running: 3,
          completed: 0,
          failed: 1,
          cancelled: 0,
          compensating: 0,
        },
        total: 4,
      });
    });

    it('applies workflow and started_at window filters to summary match stage', async () => {
      mockExecutionAggregateExec.mockResolvedValue([]);
      const workflowObjectId = new Types.ObjectId().toHexString();

      await service.findSummary(ownerId, {
        workflow_id: workflowObjectId,
        started_from: '2026-03-20T00:00:00.000Z',
        started_to: '2026-03-21T00:00:00.000Z',
      });

      expect(mockExecutionModel.aggregate).toHaveBeenCalledWith([
        {
          $match: expect.objectContaining({
            owner_id: expect.any(Types.ObjectId),
            workflow_id: expect.any(Types.ObjectId),
            started_at: {
              $gte: new Date('2026-03-20T00:00:00.000Z'),
              $lte: new Date('2026-03-21T00:00:00.000Z'),
            },
          }),
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);
    });

    it('rejects invalid summary date ranges', async () => {
      await expect(
        service.findSummary(ownerId, {
          started_from: '2026-03-21T00:00:00.000Z',
          started_to: '2026-03-20T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
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
      mockStepUpdateManyExec.mockResolvedValue({ modifiedCount: 2 });

      const result = await service.cancel(executionId, ownerId);

      expect(result.status).toBe('cancelled');
      expect(result.completed_at).toBeInstanceOf(Date);
      expect(mockExecutionSave).toHaveBeenCalled();
      expect(mockStepExecutionModel.updateMany).toHaveBeenCalledWith(
        {
          execution_id: executionId,
          status: { $in: ['queued', 'running'] },
        },
        {
          $set: expect.objectContaining({
            status: 'skipped',
            error: 'Execution cancelled',
            completed_at: expect.any(Date),
          }),
        },
      );
      expect(eventService.append).toHaveBeenCalledWith(
        expect.any(String),
        'execution.cancelled',
      );
    });

    it('cancels a pending execution', async () => {
      const doc = makeExecutionDoc({ status: 'pending' });
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      mockExecutionSave.mockResolvedValue(doc);
      mockStepUpdateManyExec.mockResolvedValue({ modifiedCount: 0 });

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
      const events = {
        items: [{ type: 'execution.started' }],
        page_info: {
          limit: 50,
          cursor: null,
          next_cursor: null,
          has_next_page: false,
        },
      };
      jest
        .spyOn(eventService, 'findByExecutionId')
        .mockResolvedValue(events as never);

      const result = await service.findEvents(executionId, ownerId);

      expect(eventService.findByExecutionId).toHaveBeenCalledWith(
        executionId,
        expect.objectContaining({
          limit: 50,
          cursor: undefined,
          step_id: undefined,
          type: undefined,
          occurred_from: undefined,
          occurred_to: undefined,
        }),
      );
      expect(result).toEqual(events);
    });

    it('forwards event filters and pagination query options', async () => {
      const doc = makeExecutionDoc();
      mockExecutionFindByIdExec.mockResolvedValue(doc);
      jest.spyOn(eventService, 'findByExecutionId').mockResolvedValue({
        items: [],
        page_info: {
          limit: 10,
          cursor: 'abc',
          next_cursor: null,
          has_next_page: false,
        },
      } as never);

      const query: ListExecutionEventsQueryDto = {
        limit: 10,
        cursor: 'abc',
        step_id: 'step-1',
        type: ['step.failed'],
        occurred_from: '2026-03-01T00:00:00.000Z',
        occurred_to: '2026-03-02T00:00:00.000Z',
      };

      await service.findEvents(executionId, ownerId, query);

      expect(eventService.findByExecutionId).toHaveBeenCalledWith(
        executionId,
        expect.objectContaining({
          limit: 10,
          cursor: 'abc',
          step_id: 'step-1',
          type: ['step.failed'],
          occurred_from: expect.any(Date),
          occurred_to: expect.any(Date),
        }),
      );
    });

    it('throws ForbiddenException when execution belongs to another owner', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(makeExecutionDoc());

      await expect(
        service.findEvents(executionId, otherOwnerId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('legal hold', () => {
    it('sets legal hold for owned execution', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(makeExecutionDoc());

      const result = await service.setLegalHold(executionId, ownerId, 'compliance hold');

      expect(eventGovernanceService.placeExecutionLegalHold).toHaveBeenCalledWith(
        executionId,
        ownerId,
        'compliance hold',
      );
      expect(result).toEqual({
        execution_id: executionId,
        legal_hold: true,
        reason: 'compliance hold',
      });
    });

    it('releases legal hold for owned execution', async () => {
      mockExecutionFindByIdExec.mockResolvedValue(makeExecutionDoc());

      const result = await service.releaseLegalHold(executionId, ownerId);

      expect(eventGovernanceService.releaseExecutionLegalHold).toHaveBeenCalledWith(
        executionId,
      );
      expect(result).toEqual({
        execution_id: executionId,
        legal_hold: false,
      });
    });
  });

  // ── triggerByWebhook ───────────────────────────────────────────────────────

  describe('triggerByWebhook', () => {
    const makeSecurityContext = (overrides: Record<string, unknown> = {}) => ({
      timestamp: String(Math.floor(Date.now() / 1000)),
      nonce: 'nonce-1',
      method: 'POST',
      path: 'orders-created',
      ip: '203.0.113.1',
      ...overrides,
    });

    it('finds webhook workflow and delegates to trigger with webhook options', async () => {
      const webhookWorkflow = { _id: workflowId };
      const payload = { body: { foo: 'bar' } };

      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue(webhookWorkflow as never);
      const triggerSpy = jest
        .spyOn(service, 'trigger')
        .mockResolvedValue(makeExecutionDoc() as never);

      await service.triggerByWebhook(
        ownerId,
        'orders-created',
        payload,
        makeSecurityContext(),
      );

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
        service.triggerByWebhook(
          ownerId,
          'orders-created',
          { body: {} },
          makeSecurityContext(),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when webhook signature is invalid', async () => {
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
          makeSecurityContext({ signature: 'bad-signature' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('triggers execution when webhook signature matches', async () => {
      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue({
          _id: workflowId,
          trigger: { config: { secret: 'top-secret' } },
        } as never);
      const triggerSpy = jest
        .spyOn(service, 'trigger')
        .mockResolvedValue(makeExecutionDoc() as never);
      const payload = { body: { ok: true } };
      const security = makeSecurityContext();
      const bodyHash = (service as unknown as {
        hashWebhookPayloadBody: (body: unknown) => string;
      }).hashWebhookPayloadBody(payload.body);
      const signature = (service as unknown as {
        computeWebhookSignature: (
          secret: string,
          timestampMs: number,
          nonce: string,
          method: string,
          path: string,
          bodyHash: string,
        ) => string;
      }).computeWebhookSignature(
        'top-secret',
        Number(security.timestamp) * 1000,
        String(security.nonce),
        String(security.method),
        String(security.path),
        bodyHash,
      );

      await service.triggerByWebhook(
        ownerId,
        'orders-created',
        payload,
        { ...security, signature: `sha256=${signature}` },
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

    it('throws UnauthorizedException when webhook timestamp is stale', async () => {
      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue({ _id: workflowId } as never);

      await expect(
        service.triggerByWebhook(
          ownerId,
          'orders-created',
          { body: {} },
          makeSecurityContext({ timestamp: String(Math.floor(Date.now() / 1000) - 3600) }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when webhook nonce is replayed', async () => {
      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue({ _id: workflowId } as never);
      mockWebhookNonceCreate.mockRejectedValueOnce({ code: 11000 });

      await expect(
        service.triggerByWebhook(
          ownerId,
          'orders-created',
          { body: {} },
          makeSecurityContext(),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws HttpException 429 when webhook rate limit is exceeded', async () => {
      jest
        .spyOn(workflowService as WorkflowService & { findActiveWebhookWorkflow: jest.Mock }, 'findActiveWebhookWorkflow')
        .mockResolvedValue({ _id: workflowId } as never);
      mockWebhookRateLimitFindOneAndUpdate.mockResolvedValueOnce({ count: 999 });

      try {
        await service.triggerByWebhook(
          ownerId,
          'orders-created',
          { body: {} },
          makeSecurityContext(),
        );
        fail('Expected triggerByWebhook to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });
  });
});
