import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { promises as dns } from 'node:dns';
import { HttpHandler } from './http.handler';

jest.mock('axios');
jest.mock('node:dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLookup = dns.lookup as jest.MockedFunction<typeof dns.lookup>;

describe('HttpHandler', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.HTTP_STEP_ALLOWED_HOSTS;
    delete process.env.HTTP_STEP_ALLOW_PRIVATE_NETWORK_TARGETS;
    mockedAxios.request.mockReset();
    mockedLookup.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('executes outbound request for public host', async () => {
    mockedLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ] as never);
    mockedAxios.request.mockResolvedValue({ status: 200, data: { ok: true } });

    const handler = new HttpHandler(new ConfigService());

    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'step-http',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'http',
          url: 'https://api.example.com/resource',
          method: 'POST',
          headers: { 'x-test': '1' },
          body: { ping: 'pong' },
        },
      }),
    ).resolves.toEqual({ status: 200, data: { ok: true } });

    expect(mockedLookup).toHaveBeenCalledWith('api.example.com', {
      all: true,
      verbatim: true,
    });
    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/resource',
        method: 'post',
      }),
    );
  });

  it('rejects localhost targets', async () => {
    const handler = new HttpHandler(new ConfigService());

    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'step-http',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'http',
          url: 'http://localhost:8080/internal',
        },
      }),
    ).rejects.toThrow('blocked by outbound policy');

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects private IP literal targets', async () => {
    const handler = new HttpHandler(new ConfigService());

    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'step-http',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'http',
          url: 'http://192.168.1.2/admin',
        },
      }),
    ).rejects.toThrow('blocked by outbound policy');

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects hosts resolving to private network addresses', async () => {
    mockedLookup.mockResolvedValue([
      { address: '10.0.0.9', family: 4 },
    ] as never);

    const handler = new HttpHandler(new ConfigService());

    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'step-http',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'http',
          url: 'https://evil.example.test/path',
        },
      }),
    ).rejects.toThrow('resolves to blocked IP');

    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects hosts not in configured allowlist', async () => {
    process.env.HTTP_STEP_ALLOWED_HOSTS = 'api.allowed.test,*.trusted.example';

    const handler = new HttpHandler(new ConfigService());

    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'step-http',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'http',
          url: 'https://api.not-allowed.test/data',
        },
      }),
    ).rejects.toThrow('is not in HTTP_STEP_ALLOWED_HOSTS');

    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('rejects non-http protocols', async () => {
    const handler = new HttpHandler(new ConfigService());

    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'step-http',
        stepExecutionId: 'step-exec-1',
        attempt: 0,
        context: {},
        stepConfig: {
          type: 'http',
          url: 'file:///etc/passwd',
        },
      }),
    ).rejects.toThrow('only supports http/https protocols');

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });
});
