import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Workflow, WorkflowDocument } from '../workflow/workflow.schema';
import { ExecutionService } from '../execution/execution.service';
import { SchedulerLock } from './scheduler-lock.schema';
import { WorkflowSchedulerService } from './workflow-scheduler.service';

const mockWorkflowFindExec = jest.fn();
const mockSchedulerLockFindOneAndUpdateExec = jest.fn();

const mockWorkflowModel = {
  find: jest.fn().mockReturnValue({ exec: mockWorkflowFindExec }),
};

const mockSchedulerLockModel = {
  findOneAndUpdate: jest
    .fn()
    .mockReturnValue({ exec: mockSchedulerLockFindOneAndUpdateExec }),
};

const mockExecutionService = {
  trigger: jest.fn(),
};

const mockSchedulerRegistry = {
  getCronJobs: jest.fn().mockReturnValue(new Map()),
  addCronJob: jest.fn(),
  deleteCronJob: jest.fn(),
};

describe('WorkflowSchedulerService', () => {
  let service: WorkflowSchedulerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowSchedulerService,
        {
          provide: getModelToken(Workflow.name),
          useValue: mockWorkflowModel,
        },
        {
          provide: getModelToken(SchedulerLock.name),
          useValue: mockSchedulerLockModel,
        },
        {
          provide: ExecutionService,
          useValue: mockExecutionService,
        },
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
      ],
    }).compile();

    service = module.get<WorkflowSchedulerService>(WorkflowSchedulerService);
  });

  it('does not refresh schedules when leadership lock is not acquired', async () => {
    mockSchedulerLockFindOneAndUpdateExec.mockResolvedValue({ owner: 'other-instance' });

    await service.refreshSchedules();

    expect(mockWorkflowModel.find).not.toHaveBeenCalled();
  });

  it('does not refresh schedules when lock acquisition races and duplicate key occurs', async () => {
    mockSchedulerLockFindOneAndUpdateExec.mockRejectedValue({ code: 11000 });

    await service.refreshSchedules();

    expect(mockWorkflowModel.find).not.toHaveBeenCalled();
  });

  it('refreshes schedules when leadership is acquired', async () => {
    const serviceAsInternal = service as unknown as { instanceId: string };
    mockSchedulerLockFindOneAndUpdateExec.mockResolvedValue({
      owner: serviceAsInternal.instanceId,
    });
    mockWorkflowFindExec.mockResolvedValue([] as WorkflowDocument[]);

    await service.refreshSchedules();

    expect(mockWorkflowModel.find).toHaveBeenCalledWith({
      status: 'active',
      'trigger.type': 'schedule',
    });
  });
});
