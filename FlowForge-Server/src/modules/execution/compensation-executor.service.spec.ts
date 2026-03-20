import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { promises as dns } from 'node:dns';
import { CompensationExecutorService } from './compensation-executor.service';

jest.mock('axios');
jest.mock('node:dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLookup = dns.lookup as jest.MockedFunction<typeof dns.lookup>;

describe('CompensationExecutorService', () => {
  let service: CompensationExecutorService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.HTTP_STEP_ALLOWED_HOSTS;
    delete process.env.HTTP_STEP_ALLOW_PRIVATE_NETWORK_TARGETS;
    jest.clearAllMocks();
    service = new CompensationExecutorService(new ConfigService());
    mockedLookup.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
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
    mockedLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ] as never);
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

  it('rejects localhost target for HTTP compensation', async () => {
    await expect(
      service.execute({
        executionId: 'exec-1',
        stepExecutionId: 'step-exec-1',
        stepId: 'step-1',
        idempotencyKey: 'exec-1:step-exec-1',
        compensation: {
          enabled: true,
          type: 'http',
          config: { url: 'http://localhost:8080/undo' },
        },
        input: {},
        output: null,
        context: {},
      }),
    ).rejects.toThrow('blocked by outbound policy');

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects host resolving to private IP for HTTP compensation', async () => {
    mockedLookup.mockResolvedValue([
      { address: '10.10.0.5', family: 4 },
    ] as never);

    await expect(
      service.execute({
        executionId: 'exec-1',
        stepExecutionId: 'step-exec-1',
        stepId: 'step-1',
        idempotencyKey: 'exec-1:step-exec-1',
        compensation: {
          enabled: true,
          type: 'http',
          config: { url: 'https://rollback.evil.test/path' },
        },
        input: {},
        output: null,
        context: {},
      }),
    ).rejects.toThrow('resolves to blocked IP');

    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects host outside allowlist for HTTP compensation', async () => {
    process.env.HTTP_STEP_ALLOWED_HOSTS = 'undo.allowed.test,*.trusted.example';
    service = new CompensationExecutorService(new ConfigService());

    await expect(
      service.execute({
        executionId: 'exec-1',
        stepExecutionId: 'step-exec-1',
        stepId: 'step-1',
        idempotencyKey: 'exec-1:step-exec-1',
        compensation: {
          enabled: true,
          type: 'http',
          config: { url: 'https://api.other.test/undo' },
        },
        input: {},
        output: null,
        context: {},
      }),
    ).rejects.toThrow('is not in HTTP_STEP_ALLOWED_HOSTS');

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects non-http protocol for HTTP compensation', async () => {
    await expect(
      service.execute({
        executionId: 'exec-1',
        stepExecutionId: 'step-exec-1',
        stepId: 'step-1',
        idempotencyKey: 'exec-1:step-exec-1',
        compensation: {
          enabled: true,
          type: 'http',
          config: { url: 'file:///etc/passwd' },
        },
        input: {},
        output: null,
        context: {},
      }),
    ).rejects.toThrow('only supports http/https protocols');

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });
});
