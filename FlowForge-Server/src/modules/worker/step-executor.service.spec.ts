import { BadRequestException } from '@nestjs/common';
import { StepExecutorService } from './step-executor.service';

describe('StepExecutorService', () => {
  const httpHandler = { execute: jest.fn() };
  const transformHandler = { execute: jest.fn() };
  const storeHandler = { execute: jest.fn() };
  const branchHandler = { execute: jest.fn() };

  let service: StepExecutorService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new StepExecutorService(
      httpHandler as never,
      transformHandler as never,
      storeHandler as never,
      branchHandler as never,
    );
  });

  it('dispatches to http handler when runtime config is valid', async () => {
    httpHandler.execute.mockResolvedValue({ ok: true });

    await expect(
      service.execute({
        executionId: 'exec-1',
        stepId: 'http-1',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'http',
          url: 'https://example.com/api',
          method: 'GET',
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(httpHandler.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid http runtime config before handler execution', async () => {
    await expect(
      service.execute({
        executionId: 'exec-1',
        stepId: 'http-1',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'http',
          method: 'GET',
        },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(httpHandler.execute).not.toHaveBeenCalled();
  });

  it('rejects invalid branch runtime config before handler execution', async () => {
    await expect(
      service.execute({
        executionId: 'exec-1',
        stepId: 'branch-1',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'branch',
          cases: [{ value: 'approved', next: 'next-step' }],
        },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(branchHandler.execute).not.toHaveBeenCalled();
  });

  it('preserves unknown step type behavior', async () => {
    await expect(
      service.execute({
        executionId: 'exec-1',
        stepId: 'unknown-1',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'custom-type',
        },
      }),
    ).rejects.toThrow('Unknown step type: "custom-type"');
  });
});
