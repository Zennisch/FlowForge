import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { Method } from 'axios';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
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
  private readonly allowedHosts: string[];
  private readonly allowPrivateNetworkTargets: boolean;

  constructor(private readonly config: ConfigService) {
    const rawAllowedHosts =
      this.config.get<string>('HTTP_STEP_ALLOWED_HOSTS') ?? '';
    this.allowedHosts = rawAllowedHosts
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    this.allowPrivateNetworkTargets = this.parseBoolean(
      this.config.get<string>('HTTP_STEP_ALLOW_PRIVATE_NETWORK_TARGETS'),
      false,
    );
  }

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
    const targetUrl = this.parseAndValidateTargetUrl(rawUrl);
    const targetHostname = targetUrl.hostname.toLowerCase();

    this.assertHostAllowed(targetHostname);
    await this.assertHostIsSafeTarget(targetHostname);

    const method = this.resolveHttpMethod(config.method);
    const timeoutMs = this.resolveTimeout(config.timeoutMs, 10_000);
    const headers = this.resolveHeaders(config.headers, params.idempotencyKey);
    const body = this.resolveBody(config.body, params);

    const response = await axios.request({
      url: targetUrl.toString(),
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

  private parseAndValidateTargetUrl(rawUrl: unknown): URL {
    if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
      throw new Error('Compensation HTTP config.url is required');
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`Compensation HTTP url is invalid: "${String(rawUrl)}"`);
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error(
        `Compensation HTTP only supports http/https protocols: "${rawUrl}"`,
      );
    }

    return parsed;
  }

  private assertHostAllowed(hostname: string): void {
    if (this.allowedHosts.length === 0) {
      return;
    }

    const allowed = this.allowedHosts.some((entry) => {
      if (entry.startsWith('*.')) {
        const suffix = entry.slice(2);
        return hostname === suffix || hostname.endsWith(`.${suffix}`);
      }

      return hostname === entry || hostname.endsWith(`.${entry}`);
    });

    if (!allowed) {
      throw new Error(
        `Compensation HTTP target host "${hostname}" is not in HTTP_STEP_ALLOWED_HOSTS`,
      );
    }
  }

  private async assertHostIsSafeTarget(hostname: string): Promise<void> {
    if (this.allowPrivateNetworkTargets) {
      return;
    }

    if (this.isBlockedLocalHostname(hostname)) {
      throw new Error(
        `Compensation HTTP target host "${hostname}" is blocked by outbound policy`,
      );
    }

    if (isIP(hostname) !== 0) {
      if (this.isPrivateOrReservedIp(hostname)) {
        throw new Error(
          `Compensation HTTP target IP "${hostname}" is blocked by outbound policy`,
        );
      }
      return;
    }

    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) {
      throw new Error(
        `Compensation HTTP target host "${hostname}" does not resolve to an IP`,
      );
    }

    for (const address of addresses) {
      if (this.isPrivateOrReservedIp(address.address)) {
        throw new Error(
          `Compensation HTTP target host "${hostname}" resolves to blocked IP "${address.address}"`,
        );
      }
    }
  }

  private isBlockedLocalHostname(hostname: string): boolean {
    const lower = hostname.toLowerCase();

    if (
      lower === 'localhost' ||
      lower.endsWith('.localhost') ||
      lower === 'metadata.google.internal' ||
      lower.endsWith('.internal') ||
      lower === 'host.docker.internal'
    ) {
      return true;
    }

    if (!lower.includes('.')) {
      return true;
    }

    return false;
  }

  private isPrivateOrReservedIp(ip: string): boolean {
    const ipVersion = isIP(ip);
    if (ipVersion === 4) {
      return this.isPrivateOrReservedIpv4(ip);
    }
    if (ipVersion === 6) {
      return this.isPrivateOrReservedIpv6(ip);
    }
    return true;
  }

  private isPrivateOrReservedIpv4(ip: string): boolean {
    const octets = ip.split('.').map((part) => Number(part));
    if (octets.length !== 4 || octets.some(Number.isNaN)) {
      return true;
    }

    const [a, b] = octets;

    if (a === 10 || a === 127) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 100 && b >= 64 && b <= 127) {
      return true;
    }
    if (a === 198 && (b === 18 || b === 19)) {
      return true;
    }
    if (a === 0) {
      return true;
    }
    if (a >= 224) {
      return true;
    }

    return false;
  }

  private isPrivateOrReservedIpv6(ip: string): boolean {
    const lower = ip.toLowerCase();

    if (lower === '::1' || lower === '::') {
      return true;
    }
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return true;
    }

    if (lower.startsWith('::ffff:')) {
      const mappedIpv4 = lower.replace('::ffff:', '');
      return this.isPrivateOrReservedIpv4(mappedIpv4);
    }

    return false;
  }

  private parseBoolean(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined) {
      return fallback;
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
    return fallback;
  }
}
