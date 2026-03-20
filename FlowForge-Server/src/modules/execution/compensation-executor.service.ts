import { Injectable } from '@nestjs/common';
import axios, { Method } from 'axios';
import { ExecutionWorkflowSnapshotCompensationPolicy } from './execution.schema';

interface ExecuteCompensationParams {
  executionId: string;
  stepExecutionId: string;
  stepId: string;
  idempotencyKey: string;
  compensation: ExecutionWorkflowSnapshotCompensationPolicy;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  context: Record<string, unknown>;
}

@Injectable()
export class CompensationExecutorService {
  async execute(
    params: ExecuteCompensationParams,
  ): Promise<Record<string, unknown>> {
    const type = params.compensation.type ?? 'noop';

    if (type === 'noop') {
      return { mode: 'noop', applied: true };
    }

    if (type === 'http') {
      return this.executeHttp(params);
    }

    throw new Error(`Unsupported compensation type: ${String(type)}`);
  }

  private async executeHttp(
    params: ExecuteCompensationParams,
  ): Promise<Record<string, unknown>> {
    const config = params.compensation.config ?? {};
    const rawUrl = config.url;
    if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
      throw new Error('Compensation HTTP config.url is required');
    }

    const method = this.resolveHttpMethod(config.method);
    const timeoutMs = this.resolveTimeout(config.timeoutMs, 10_000);
    const headers = this.resolveHeaders(config.headers, params.idempotencyKey);
    const body = this.resolveBody(config.body, params);

    const response = await axios.request({
      url: rawUrl,
      method,
      data: body,
      timeout: timeoutMs,
      headers,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      throw new Error(
        `Compensation HTTP request failed with status ${response.status}`,
      );
    }

    return {
      mode: 'http',
      applied: true,
      status: response.status,
    };
  }

  private resolveHttpMethod(value: unknown): Method {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return 'POST';
    }
    return value.trim().toUpperCase() as Method;
  }

  private resolveTimeout(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
      }
    }
    return fallback;
  }

  private resolveHeaders(
    value: unknown,
    idempotencyKey: string,
  ): Record<string, string> {
    const baseHeaders: Record<string, string> = {
      'x-compensation-idempotency-key': idempotencyKey,
    };

    if (!value || typeof value !== 'object') {
      return baseHeaders;
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, headerValue]) => typeof headerValue === 'string')
      .map(([headerName, headerValue]) => [headerName, headerValue as string]);

    if (entries.length === 0) {
      return baseHeaders;
    }

    return { ...baseHeaders, ...Object.fromEntries(entries) };
  }

  private resolveBody(
    configuredBody: unknown,
    params: ExecuteCompensationParams,
  ): Record<string, unknown> {
    if (configuredBody && typeof configuredBody === 'object') {
      return configuredBody as Record<string, unknown>;
    }

    return {
      executionId: params.executionId,
      stepExecutionId: params.stepExecutionId,
      stepId: params.stepId,
      input: params.input,
      output: params.output,
      context: params.context,
    };
  }
}
