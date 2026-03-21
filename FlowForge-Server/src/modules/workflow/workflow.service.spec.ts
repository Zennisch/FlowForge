import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ValidateDagService } from './validate-dag.service';
import { Workflow } from './workflow.schema';
import { WorkflowService } from './workflow.service';

// ─── Mongoose model mock ──────────────────────────────────────────────────────

const mockSave = jest.fn();
const mockFindExec = jest.fn();
const mockFindByIdExec = jest.fn();
const mockFindOneExec = jest.fn();
const mockFindByIdAndDeleteExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWorkflowModel: any = jest
  .fn()
  .mockImplementation((dto: Record<string, unknown>) => ({
    ...dto,
    save: mockSave,
  }));

mockWorkflowModel.find = jest
  .fn()
  .mockReturnValue({ exec: mockFindExec });
mockWorkflowModel.findById = jest
  .fn()
  .mockReturnValue({ exec: mockFindByIdExec });
mockWorkflowModel.findOne = jest
  .fn()
  .mockReturnValue({ exec: mockFindOneExec });
mockWorkflowModel.findByIdAndDelete = jest
  .fn()
  .mockReturnValue({ exec: mockFindByIdAndDeleteExec });

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ownerId = new Types.ObjectId().toHexString();
const otherOwnerId = new Types.ObjectId().toHexString();
const workflowId = new Types.ObjectId().toHexString();

const makeWorkflowDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: workflowId,
  owner_id: { toString: () => ownerId },
  name: 'My Workflow',
  description: '',
  status: 'active',
  trigger: { type: 'manual', config: {} },
  steps: [],
  edges: [],
  save: mockSave,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkflowService', () => {
  let service: WorkflowService;
  let validateDagService: ValidateDagService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: getModelToken(Workflow.name),
          useValue: mockWorkflowModel,
        },
        {
          provide: ValidateDagService,
          useValue: { validate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    validateDagService = module.get<ValidateDagService>(ValidateDagService);
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all workflows for the owner', async () => {
      const docs = [makeWorkflowDoc(), makeWorkflowDoc({ name: 'Second' })];
      mockFindExec.mockResolvedValue(docs);

      const result = await service.findAll(ownerId);

      expect(mockWorkflowModel.find).toHaveBeenCalledWith({
        owner_id: expect.any(Types.ObjectId),
      });
      expect(result).toEqual(docs);
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the workflow when it exists and belongs to the owner', async () => {
      const doc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(doc);

      const result = await service.findOne(workflowId, ownerId);

      expect(mockWorkflowModel.findById).toHaveBeenCalledWith(workflowId);
      expect(result).toEqual(doc);
    });

    it('should throw NotFoundException when the workflow does not exist', async () => {
      mockFindByIdExec.mockResolvedValue(null);

      await expect(service.findOne(workflowId, ownerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when the workflow belongs to another user', async () => {
      const doc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(doc);

      await expect(service.findOne(workflowId, otherOwnerId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should validate the DAG and save the new workflow', async () => {
      const dto = { name: 'New Workflow', steps: [], edges: [] };
      const savedDoc = makeWorkflowDoc({ name: dto.name });
      mockSave.mockResolvedValue(savedDoc);

      const result = await service.create(ownerId, dto);

      expect(validateDagService.validate).toHaveBeenCalledWith([], []);
      expect(mockWorkflowModel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Workflow' }),
      );
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(savedDoc);
    });

    it('should use empty arrays when steps/edges are omitted', async () => {
      const dto = { name: 'Minimal' };
      mockSave.mockResolvedValue(makeWorkflowDoc({ name: dto.name }));

      await service.create(ownerId, dto);

      expect(validateDagService.validate).toHaveBeenCalledWith([], []);
    });

    it('should propagate BadRequestException from ValidateDagService', async () => {
      (validateDagService.validate as jest.Mock).mockImplementation(() => {
        throw new BadRequestException('Cycle detected');
      });

      await expect(
        service.create(ownerId, {
          name: 'Cyclic',
          steps: [{ id: 'a', type: 'http' }],
          edges: [{ from: 'a', to: 'a' }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when schedule trigger cron is missing', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Scheduled Workflow',
          trigger: { type: 'schedule', config: {} },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when schedule trigger cron is invalid', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Scheduled Workflow',
          trigger: {
            type: 'schedule',
            config: { cron: 'not-a-cron' },
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when schedule trigger timezone is invalid', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Scheduled Workflow',
          trigger: {
            type: 'schedule',
            config: { cron: '*/5 * * * *', timezone: 'Not/A_Timezone' },
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should create workflow when schedule trigger cron and timezone are valid', async () => {
      const savedDoc = makeWorkflowDoc({ name: 'Scheduled Workflow' });
      mockSave.mockResolvedValue(savedDoc);

      await expect(
        service.create(ownerId, {
          name: 'Scheduled Workflow',
          trigger: {
            type: 'schedule',
            config: { cron: '*/5 * * * *', timezone: 'Asia/Ho_Chi_Minh' },
          },
        }),
      ).resolves.toEqual(savedDoc);

      expect(mockSave).toHaveBeenCalled();
    });

    it('should throw BadRequestException when webhook path is missing', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Webhook Workflow',
          trigger: { type: 'webhook', config: {} },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when webhook path has invalid characters', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Webhook Workflow',
          trigger: { type: 'webhook', config: { path: 'order/new' } },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should normalize webhook path and create workflow', async () => {
      const savedDoc = makeWorkflowDoc({ name: 'Webhook Workflow' });
      mockSave.mockResolvedValue(savedDoc);

      await service.create(ownerId, {
        name: 'Webhook Workflow',
        trigger: { type: 'webhook', config: { path: '/orders-created/' } },
      });

      expect(mockWorkflowModel).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: {
            type: 'webhook',
            config: { path: 'orders-created' },
          },
        }),
      );
    });

    it('should throw BadRequestException when webhook secret is empty', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Webhook Workflow',
          trigger: {
            type: 'webhook',
            config: { path: 'orders-created', secret: '   ' },
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should trim webhook secret when valid', async () => {
      const savedDoc = makeWorkflowDoc({ name: 'Webhook Workflow' });
      mockSave.mockResolvedValue(savedDoc);

      await service.create(ownerId, {
        name: 'Webhook Workflow',
        trigger: {
          type: 'webhook',
          config: { path: 'orders-created', secret: '  top-secret  ' },
        },
      });

      expect(mockWorkflowModel).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: {
            type: 'webhook',
            config: { path: 'orders-created', secret: 'top-secret' },
          },
        }),
      );
    });

    it('should throw BadRequestException when compensation http is enabled without url', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Compensable Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'http',
              compensation: {
                enabled: true,
                type: 'http',
                config: {},
              },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow compensation http config when url is provided', async () => {
      const savedDoc = makeWorkflowDoc({ name: 'Compensable Workflow' });
      mockSave.mockResolvedValue(savedDoc);

      await expect(
        service.create(ownerId, {
          name: 'Compensable Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'http',
              config: { url: 'https://example.test/action' },
              compensation: {
                enabled: true,
                type: 'http',
                config: { url: 'https://example.test/undo' },
              },
            },
          ],
        }),
      ).resolves.toEqual(savedDoc);
    });

    it('should throw BadRequestException when http step config.url is missing', async () => {
      await expect(
        service.create(ownerId, {
          name: 'HTTP Workflow',
          steps: [{ id: 's1', type: 'http', config: {} }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when http step config.url is not http/https', async () => {
      await expect(
        service.create(ownerId, {
          name: 'HTTP Workflow',
          steps: [
            {
              id: 's1',
              type: 'http',
              config: { url: 'ftp://example.com/resource' },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when transform mapping values are not non-empty strings', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Transform Workflow',
          steps: [
            {
              id: 't1',
              type: 'transform',
              config: { mapping: { amount: 123 } },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when branch step field is missing', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Branch Workflow',
          steps: [
            {
              id: 'b1',
              type: 'branch',
              config: { cases: [{ value: 'ok', next: 'next-step' }] },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when store step config.data is not an object', async () => {
      await expect(
        service.create(ownerId, {
          name: 'Store Workflow',
          steps: [{ id: 'st1', type: 'store', config: { data: 'invalid' } }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should create workflow when step configs are valid', async () => {
      const savedDoc = makeWorkflowDoc({ name: 'Valid Config Workflow' });
      mockSave.mockResolvedValue(savedDoc);

      await expect(
        service.create(ownerId, {
          name: 'Valid Config Workflow',
          steps: [
            {
              id: 'http-step',
              type: 'http',
              config: {
                url: 'https://example.com/api',
                method: 'POST',
                headers: { 'x-trace-id': 'trace-123' },
                timeoutMs: 5000,
              },
            },
            {
              id: 'transform-step',
              type: 'transform',
              config: { mapping: { customerId: 'payload.customer.id' } },
            },
            {
              id: 'store-step',
              type: 'store',
              config: { data: { destination: 'archive' } },
            },
            {
              id: 'branch-step',
              type: 'branch',
              config: {
                field: 'payload.status',
                cases: [{ value: 'approved', next: 'store-step' }],
                default: 'store-step',
              },
            },
          ],
        }),
      ).resolves.toEqual(savedDoc);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should validate the DAG and save the updated workflow', async () => {
      const existingDoc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(existingDoc);
      mockSave.mockResolvedValue({ ...existingDoc, name: 'Updated' });

      const result = await service.update(workflowId, ownerId, {
        name: 'Updated',
      });

      expect(validateDagService.validate).toHaveBeenCalledWith(
        existingDoc.steps,
        existingDoc.edges,
      );
      expect(mockSave).toHaveBeenCalled();
      expect(result).toMatchObject({ name: 'Updated' });
    });

    it('should use dto.steps and dto.edges for validation when provided', async () => {
      const existingDoc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(existingDoc);
      mockSave.mockResolvedValue(existingDoc);

      const newSteps = [
        { id: 'x', type: 'http' as const, config: { url: 'https://example.com' } },
      ];
      const newEdges = [{ from: 'x', to: 'x' }];

      await service.update(workflowId, ownerId, {
        steps: newSteps,
        edges: newEdges,
      });

      expect(validateDagService.validate).toHaveBeenCalledWith(
        newSteps,
        newEdges,
      );
    });

    it('should throw NotFoundException when the workflow does not exist', async () => {
      mockFindByIdExec.mockResolvedValue(null);

      await expect(
        service.update(workflowId, ownerId, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on update when schedule trigger cron is invalid', async () => {
      const existingDoc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(existingDoc);

      await expect(
        service.update(workflowId, ownerId, {
          trigger: {
            type: 'schedule',
            config: { cron: 'invalid cron' },
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on update when existing schedule trigger is invalid', async () => {
      const existingDoc = makeWorkflowDoc({
        trigger: { type: 'schedule', config: { cron: 'invalid cron' } },
      });
      mockFindByIdExec.mockResolvedValue(existingDoc);

      await expect(service.update(workflowId, ownerId, { name: 'Updated' })).rejects.toThrow(
        BadRequestException,
      );

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on update when webhook path is invalid', async () => {
      const existingDoc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(existingDoc);

      await expect(
        service.update(workflowId, ownerId, {
          trigger: { type: 'webhook', config: { path: 'hooks/new' } },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should normalize webhook path on update', async () => {
      const existingDoc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(existingDoc);
      mockSave.mockResolvedValue(existingDoc);

      await service.update(workflowId, ownerId, {
        trigger: { type: 'webhook', config: { path: '/hooks-new/' } },
      });

      expect(mockSave).toHaveBeenCalled();
      expect(existingDoc.trigger).toEqual({
        type: 'webhook',
        config: { path: 'hooks-new' },
      });
    });

    it('should throw BadRequestException on update when step config is invalid', async () => {
      const existingDoc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(existingDoc);

      await expect(
        service.update(workflowId, ownerId, {
          steps: [
            {
              id: 'http-step',
              type: 'http',
              config: { method: 'GET' },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  // ── findActiveWebhookWorkflow ───────────────────────────────────────────────

  describe('findActiveWebhookWorkflow', () => {
    it('should return active webhook workflow matching user and path', async () => {
      const workflow = makeWorkflowDoc({
        trigger: { type: 'webhook', config: { path: 'orders-created' } },
      });
      mockFindOneExec.mockResolvedValue(workflow);

      const result = await service.findActiveWebhookWorkflow(
        ownerId,
        'orders-created',
      );

      expect(mockWorkflowModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          'trigger.type': 'webhook',
          'trigger.config.path': { $in: ['orders-created', '/orders-created'] },
        }),
      );
      expect(result).toEqual(workflow);
    });

    it('should throw NotFoundException for invalid user id', async () => {
      await expect(
        service.findActiveWebhookWorkflow('invalid-user-id', 'orders-created'),
      ).rejects.toThrow(NotFoundException);

      expect(mockWorkflowModel.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when webhook workflow does not exist', async () => {
      mockFindOneExec.mockResolvedValue(null);

      await expect(
        service.findActiveWebhookWorkflow(ownerId, 'orders-created'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete the workflow after ownership check', async () => {
      const doc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(doc);
      mockFindByIdAndDeleteExec.mockResolvedValue(doc);

      await service.remove(workflowId, ownerId);

      expect(mockWorkflowModel.findByIdAndDelete).toHaveBeenCalledWith(
        workflowId,
      );
      expect(mockFindByIdAndDeleteExec).toHaveBeenCalled();
    });

    it('should throw NotFoundException when the workflow does not exist', async () => {
      mockFindByIdExec.mockResolvedValue(null);

      await expect(service.remove(workflowId, ownerId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockWorkflowModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when attempting to remove another user\'s workflow', async () => {
      const doc = makeWorkflowDoc();
      mockFindByIdExec.mockResolvedValue(doc);

      await expect(service.remove(workflowId, otherOwnerId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockWorkflowModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
