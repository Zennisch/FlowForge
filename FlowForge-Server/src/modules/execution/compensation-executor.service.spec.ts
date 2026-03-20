import axios from 'axios';
import { CompensationExecutorService } from './compensation-executor.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CompensationExecutorService', () => {
  let service: CompensationExecutorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CompensationExecutorService();
  });

  it('returns noop result when compensation type is noop', async () => {
    const result = await service.execute({
      executionId: 'exec-1',
      stepExecutionId: 'step-exec-1',
      stepId: 'step-1',
      idempotencyKey: 'exec-1:step-exec-1',
      compensation: { enabled: true, type: 'noop', config: {} },
      input: {},
      output: null,
      context: {},
    });

    expect(result).toEqual({ mode: 'noop', applied: true });
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('throws when compensation type is http and url is missing', async () => {
    await expect(
      service.execute({
        executionId: 'exec-1',
        stepExecutionId: 'step-exec-1',
        stepId: 'step-1',
        idempotencyKey: 'exec-1:step-exec-1',
        compensation: { enabled: true, type: 'http', config: {} },
        input: {},
        output: null,
        context: {},
      }),
    ).rejects.toThrow('Compensation HTTP config.url is required');
  });

  it('executes HTTP compensation with default payload when body is not configured', async () => {
    mockedAxios.request.mockResolvedValue({ status: 200, data: {} } as never);

    const result = await service.execute({
      executionId: 'exec-1',
      stepExecutionId: 'step-exec-1',
      stepId: 'step-1',
      idempotencyKey: 'exec-1:step-exec-1',
      compensation: {
        enabled: true,
        type: 'http',
        config: { url: 'https://example.test/undo' },
      },
      input: { a: 1 },
      output: { b: 2 },
      context: { c: 3 },
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.test/undo',
        method: 'POST',
        timeout: 10_000,
        headers: {
          'x-compensation-idempotency-key': 'exec-1:step-exec-1',
        },
      }),
    );
    expect(result).toEqual({ mode: 'http', applied: true, status: 200 });
  });
});
