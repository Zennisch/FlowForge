import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { StepJob } from '../../../shared/interfaces/step-job.interface';

@Injectable()
export class HttpHandler {
  private readonly logger = new Logger(HttpHandler.name);
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

  async execute(job: StepJob): Promise<Record<string, unknown>> {
    const config = job.stepConfig as unknown as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      timeoutMs?: number;
    };

    const targetUrl = this.parseAndValidateTargetUrl(config.url);
    const targetHostname = targetUrl.hostname.toLowerCase();

    this.assertHostAllowed(targetHostname);
    await this.assertHostIsSafeTarget(targetHostname);

    this.logger.log(`HTTP ${config.method ?? 'GET'} ${targetUrl.toString()}`);

    const response = await axios.request({
      url: targetUrl.toString(),
      method: (config.method ?? 'GET').toLowerCase(),
      headers: config.headers ?? {},
      data: config.body,
      timeout: config.timeoutMs ?? 30_000,
    });

    return { status: response.status, data: response.data as unknown };
  }

  private parseAndValidateTargetUrl(rawUrl: string): URL {
    if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
      throw new Error('HTTP step config.url is required');
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`HTTP step url is invalid: "${rawUrl}"`);
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error(
        `HTTP step only supports http/https protocols: "${rawUrl}"`,
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
        `HTTP step target host "${hostname}" is not in HTTP_STEP_ALLOWED_HOSTS`,
      );
    }
  }

  private async assertHostIsSafeTarget(hostname: string): Promise<void> {
    if (this.allowPrivateNetworkTargets) {
      return;
    }

    if (this.isBlockedLocalHostname(hostname)) {
      throw new Error(
        `HTTP step target host "${hostname}" is blocked by outbound policy`,
      );
    }

    if (isIP(hostname) !== 0) {
      if (this.isPrivateOrReservedIp(hostname)) {
        throw new Error(
          `HTTP step target IP "${hostname}" is blocked by outbound policy`,
        );
      }
      return;
    }

    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) {
      throw new Error(
        `HTTP step target host "${hostname}" does not resolve to an IP`,
      );
    }

    for (const address of addresses) {
      if (this.isPrivateOrReservedIp(address.address)) {
        throw new Error(
          `HTTP step target host "${hostname}" resolves to blocked IP "${address.address}"`,
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

    // Single-label hostnames are typically internal DNS records.
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

