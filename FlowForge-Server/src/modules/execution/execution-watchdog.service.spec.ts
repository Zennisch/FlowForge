import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CompensateService } from './compensate.service';
import { ExecutionWatchdogService } from './execution-watchdog.service';
import { Execution } from './execution.schema';
import { StepExecution } from './step-execution.schema';
import { StepStateService } from './step-state.service';

const mockExecutionFindExec = jest.fn();
const mockExecutionFindByIdExec = jest.fn();
const mockStepFindExec = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecutionModel: any = {
  find: jest.fn().mockReturnValue({
    limit: jest.fn().mockReturnValue({ exec: mockExecutionFindExec }),
  }),
  findById: jest.fn().mockReturnValue({ exec: mockExecutionFindByIdExec }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStepExecutionModel: any = {
  find: jest.fn().mockReturnValue({
    limit: jest.fn().mockReturnValue({ exec: mockStepFindExec }),
  }),
};

describe('ExecutionWatchdogService', () => {
  let service: ExecutionWatchdogService;
  let stepStateService: StepStateService;
  let compensateService: CompensateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionWatchdogService,
        {
          provide: getModelToken(Execution.name),
          useValue: mockExecutionModel,
        },
        {
          provide: getModelToken(StepExecution.name),
          useValue: mockStepExecutionModel,
        },
        {
          provide: StepStateService,
          useValue: { markFailed: jest.fn() },
        },
        {
          provide: CompensateService,
          useValue: { compensate: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<ExecutionWatchdogService>(ExecutionWatchdogService);
    stepStateService = module.get<StepStateService>(StepStateService);
    compensateService = module.get<CompensateService>(CompensateService);
  });

  it('fails timed-out running step and compensates the execution once', async () => {
    const executionId = new Types.ObjectId();
    const stepExecutionId = new Types.ObjectId();

    mockStepFindExec.mockResolvedValue([
      {
        _id: stepExecutionId,
        execution_id: executionId,
        status: 'running',
        timeout_ms: 15000,
      },
    ]);
    mockExecutionFindExec.mockResolvedValue([]);
    jest.spyOn(stepStateService, 'markFailed').mockResolvedValue({} as never);
    mockExecutionFindByIdExec.mockResolvedValue({
      _id: executionId,
      status: 'running',
    });

    await service.scanForTimeouts();

    expect(stepStateService.markFailed).toHaveBeenCalledWith(
      stepExecutionId.toString(),
      'Step timed out after 15000ms',
    );
    expect(compensateService.compensate).toHaveBeenCalledWith(
      executionId.toString(),
      'timeout',
    );
  });

  it('compensates timed-out running execution even when no step timeout is found', async () => {
    const executionId = new Types.ObjectId();

    mockStepFindExec.mockResolvedValue([]);
    mockExecutionFindExec.mockResolvedValue([
      { _id: executionId, status: 'running' },
    ]);
    mockExecutionFindByIdExec.mockResolvedValue({
      _id: executionId,
      status: 'running',
    });

    await service.scanForTimeouts();

    expect(stepStateService.markFailed).not.toHaveBeenCalled();
    expect(compensateService.compensate).toHaveBeenCalledWith(
      executionId.toString(),
      'timeout',
    );
  });

  it('skips compensation when timed-out step is already terminal', async () => {
    const executionId = new Types.ObjectId();
    const stepExecutionId = new Types.ObjectId();

    mockStepFindExec.mockResolvedValue([
      {
        _id: stepExecutionId,
        execution_id: executionId,
        status: 'running',
      },
    ]);
    mockExecutionFindExec.mockResolvedValue([]);
    jest.spyOn(stepStateService, 'markFailed').mockResolvedValue(null);

    await service.scanForTimeouts();

    expect(compensateService.compensate).not.toHaveBeenCalled();
  });
});
