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

      const newSteps = [{ id: 'x', type: 'http' as const }];
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
