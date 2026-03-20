import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PubSubService } from '../../infra/pubsub/pubsub.provider';
import { StepResult } from '../../shared/interfaces/step-result.interface';
import { CompensateService } from '../execution/compensate.service';
import { Execution } from '../execution/execution.schema';
import { StepExecution } from '../execution/step-execution.schema';
import { StepStateService } from '../execution/step-state.service';
import { WorkflowService } from '../workflow/workflow.service';
import { EventRouterService } from './event-router.service';
import { EventService } from './event.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecutionModel: any = {
  findById: jest.fn(),
};

const mockStepExecutionFindOneExec = jest.fn();
const mockStepExecutionCountDocumentsExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStepExecutionModel: any = {
  findOne: jest.fn().mockReturnValue({ exec: mockStepExecutionFindOneExec }),
  countDocuments: jest
    .fn()
    .mockReturnValue({ exec: mockStepExecutionCountDocumentsExec }),
};

describe('EventRouterService', () => {
  let service: EventRouterService;
  let workflowService: WorkflowService;
  let eventService: EventService;
  let pubSubService: PubSubService;
  let stepStateService: StepStateService;
  let compensateService: CompensateService;

  const executionId = new Types.ObjectId();
  const ownerId = new Types.ObjectId();
  const workflowId = new Types.ObjectId();

  const baseResult: StepResult = {
    executionId: executionId.toHexString(),
    stepId: 'a',
    stepExecutionId: new Types.ObjectId().toHexString(),
    status: 'completed' as const,
    output: { ok: true },
    attempt: 0,
  };

  const workflow = {
    _id: workflowId,
    owner_id: ownerId,
    steps: [
      { id: 'a', type: 'store', config: {} },
      { id: 'b', type: 'store', config: {} },
      { id: 'join', type: 'store', config: {} },
    ],
    edges: [
      { from: 'a', to: 'join' },
      { from: 'b', to: 'join' },
    ],
  };

  const makeExecutionDoc = () => ({
    _id: executionId,
    workflow_id: workflowId,
    owner_id: ownerId,
    context: {},
    status: 'running',
    save: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventRouterService,
        { provide: getModelToken(Execution.name), useValue: mockExecutionModel },
        { provide: getModelToken(StepExecution.name), useValue: mockStepExecutionModel },
        { provide: StepStateService, useValue: { markCompleted: jest.fn(), markFailed: jest.fn() } },
        { provide: CompensateService, useValue: { compensate: jest.fn() } },
        { provide: WorkflowService, useValue: { findOne: jest.fn() } },
        { provide: EventService, useValue: { append: jest.fn().mockResolvedValue({}) } },
        {
          provide: PubSubService,
          useValue: {
            publishJob: jest.fn().mockResolvedValue(undefined),
            getEventsSubscription: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventRouterService>(EventRouterService);
    workflowService = module.get<WorkflowService>(WorkflowService);
    eventService = module.get<EventService>(EventService);
    pubSubService = module.get<PubSubService>(PubSubService);
    stepStateService = module.get<StepStateService>(StepStateService);
    compensateService = module.get<CompensateService>(CompensateService);
  });

  describe('fan-in join dispatch', () => {
    it('does not dispatch join step when not all parent steps are completed', async () => {
      const executionDoc = makeExecutionDoc();

      mockExecutionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(executionDoc) });
      jest.spyOn(workflowService, 'findOne').mockResolvedValue(workflow as never);
      jest.spyOn(stepStateService, 'markCompleted').mockResolvedValue({} as never);
      mockStepExecutionCountDocumentsExec.mockResolvedValue(1);

      await (service as unknown as { onStepCompleted: (r: typeof baseResult) => Promise<void> }).onStepCompleted(
        baseResult,
      );

      expect(mockStepExecutionModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          execution_id: executionId,
          step_id: { $in: ['a', 'b'] },
          status: 'completed',
        }),
      );
      expect(mockStepExecutionModel.findOne).not.toHaveBeenCalled();
      expect(eventService.append).not.toHaveBeenCalledWith(
        baseResult.executionId,
        'step.queued',
        {},
        'join',
      );
      expect(pubSubService.publishJob).not.toHaveBeenCalled();
    });

    it('dispatches join step only after all parent steps are completed', async () => {
      const executionDoc = makeExecutionDoc();
      const queuedJoinStepExecution = { _id: new Types.ObjectId() };

      mockExecutionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(executionDoc) });
      jest.spyOn(workflowService, 'findOne').mockResolvedValue(workflow as never);
      jest.spyOn(stepStateService, 'markCompleted').mockResolvedValue({} as never);
      mockStepExecutionCountDocumentsExec.mockResolvedValue(2);
      mockStepExecutionFindOneExec.mockResolvedValue(queuedJoinStepExecution);

      await (service as unknown as { onStepCompleted: (r: typeof baseResult) => Promise<void> }).onStepCompleted(
        baseResult,
      );

      expect(eventService.append).toHaveBeenCalledWith(
        baseResult.executionId,
        'step.queued',
        {},
        'join',
      );
      expect(pubSubService.publishJob).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: baseResult.executionId,
          stepId: 'join',
          stepExecutionId: String(queuedJoinStepExecution._id),
        }),
      );
    });
  });

  describe('branch dead-end routing', () => {
    it('compensates execution when branch output does not map to any outgoing edge', async () => {
      const executionDoc = makeExecutionDoc();
      const branchWorkflow = {
        _id: workflowId,
        owner_id: ownerId,
        steps: [
          { id: 'a', type: 'branch', config: {} },
          { id: 'b', type: 'store', config: {} },
        ],
        edges: [{ from: 'a', to: 'b' }],
      };

      mockExecutionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(executionDoc),
      });
      jest.spyOn(workflowService, 'findOne').mockResolvedValue(branchWorkflow as never);
      jest.spyOn(stepStateService, 'markCompleted').mockResolvedValue({} as never);

      await (
        service as unknown as {
          onStepCompleted: (r: typeof baseResult) => Promise<void>;
        }
      ).onStepCompleted({
        ...baseResult,
        output: { _branch_next: 'missing-step' },
      });

      expect(compensateService.compensate).toHaveBeenCalledWith(baseResult.executionId);
      expect(pubSubService.publishJob).not.toHaveBeenCalled();
    });
  });
});
