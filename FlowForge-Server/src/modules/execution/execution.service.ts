import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PubSubService } from '../../infra/pubsub/pubsub.provider';
import { StepJob } from '../../shared/interfaces/step-job.interface';
import {
  EventGovernanceService,
  ExecutionLegalHoldState,
} from '../event/event-governance.service';
import { EventService } from '../event/event.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ListExecutionEventsQueryDto } from './dto/list-execution-events-query.dto';
import { ExecutionSummaryQueryDto } from './dto/execution-summary-query.dto';
import { ListExecutionsQueryDto } from './dto/list-executions-query.dto';
import { TriggerExecutionDto } from './dto/trigger-execution.dto';
import {
  Execution,
  ExecutionDocument,
  ExecutionStatus,
  ExecutionWorkflowSnapshot,
} from './execution.schema';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';
import { WebhookNonce, WebhookNonceDocument } from './webhook-nonce.schema';
import {
  WebhookRateLimit,
  WebhookRateLimitDocument,
} from './webhook-rate-limit.schema';
import {
  TriggerRateLimit,
  TriggerRateLimitDocument,
} from './trigger-rate-limit.schema';

type TriggerType = 'manual' | 'webhook' | 'schedule';

export interface TriggerExecutionOptions {
  triggerType?: TriggerType;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface WebhookSecurityContext {
  providedSecret?: string;
  signature?: string;
  timestamp?: string;
  nonce?: string;
  method?: string;
  path?: string;
  ip?: string;
}

const DEFAULT_EXECUTION_TIMEOUT_MS = 60 * 60 * 1000;
const DEFAULT_WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const DEFAULT_WEBHOOK_NONCE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 60;
const DEFAULT_TRIGGER_PAYLOAD_MAX_BYTES = 256 * 1024;
const DEFAULT_TRIGGER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_TRIGGER_RATE_LIMIT_MAX_REQUESTS = 120;
const DEFAULT_TENANT_MAX_RUNNING_EXECUTIONS = 100;
const DEFAULT_WORKFLOW_MAX_RUNNING_EXECUTIONS = 50;
const MAX_FILTER_WINDOW_MS = 1000 * 60 * 60 * 24 * 31;
const MAX_UNFILTERED_LIMIT = 50;

interface ExecutionListPageInfo {
  limit: number;
  cursor: string | null;
  next_cursor: string | null;
  has_next_page: boolean;
}

export interface ExecutionListResponse {
  items: ExecutionDocument[];
  page_info: ExecutionListPageInfo;
}

export interface ExecutionSummaryResponse {
  counts: Record<ExecutionStatus, number>;
  total: number;
}

export interface ExecutionLegalHoldResponse {
  execution_id: string;
  legal_hold: ExecutionLegalHoldState;
}

const ALL_EXECUTION_STATUSES: ExecutionStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'compensating',
];

@Injectable()
export class ExecutionService {
  constructor(
    @InjectModel(Execution.name)
    private readonly executionModel: Model<ExecutionDocument>,
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    @InjectModel(WebhookNonce.name)
    private readonly webhookNonceModel: Model<WebhookNonceDocument>,
    @InjectModel(WebhookRateLimit.name)
    private readonly webhookRateLimitModel: Model<WebhookRateLimitDocument>,
    @InjectModel(TriggerRateLimit.name)
    private readonly triggerRateLimitModel: Model<TriggerRateLimitDocument>,
    private readonly workflowService: WorkflowService,
    private readonly eventService: EventService,
    private readonly eventGovernanceService: EventGovernanceService,
    private readonly pubSubService: PubSubService,
  ) {}

  async trigger(
    workflowId: string,
    ownerId: string,
    dto: TriggerExecutionDto = {},
    options: TriggerExecutionOptions = {},
  ): Promise<ExecutionDocument> {
    const workflow = await this.workflowService.findOne(workflowId, ownerId);
    const triggerType = options.triggerType ?? 'manual';
    const triggerPayload = options.payload ?? dto.payload ?? {};
    const normalizedIdempotencyKey = this.normalizeIdempotencyKey(
      options.idempotencyKey ?? dto.idempotency_key,
    );

    await this.enforceTriggerQuotas(
      ownerId,
      String(workflow._id),
      triggerType,
      triggerPayload,
      workflow.trigger?.config,
    );

    const workflowSnapshot = this.buildWorkflowSnapshot(workflow);
    const executionTimeoutMs = this.resolveExecutionTimeoutMs(
      workflow.trigger?.config as Record<string, unknown> | undefined,
    );
    const startedAt = new Date();
    const timeoutAt = new Date(startedAt.getTime() + executionTimeoutMs);

    let execution: ExecutionDocument;
    try {
      execution = await new this.executionModel({
        workflow_id: new Types.ObjectId(workflowId),
        owner_id: new Types.ObjectId(ownerId),
        status: 'running',
        trigger_type: triggerType,
        trigger_payload: triggerPayload,
        context: {},
        workflow_snapshot: workflowSnapshot,
        timeout_policy: { timeout_ms: executionTimeoutMs },
        timeout_at: timeoutAt,
        ...(normalizedIdempotencyKey
          ? { idempotency_key: normalizedIdempotencyKey }
          : {}),
        started_at: startedAt,
      }).save();
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'Duplicate idempotency key in this workflow scope',
        );
      }
      throw error;
    }

    const stepExecutions: StepExecutionDocument[] = [];
    for (const step of workflow.steps) {
      const stepExecution = await new this.stepExecutionModel({
        execution_id: execution._id,
        step_id: step.id,
        status: 'queued',
        attempt: 0,
        input: {},
        output: null,
        error: null,
        compensation_status: step.compensation?.enabled
          ? 'pending'
          : 'disabled',
        compensation_attempt: 0,
        compensation_error: null,
      }).save();
      stepExecutions.push(stepExecution);
    }

    await this.eventService.append(String(execution._id), 'execution.started', {
      workflow_id: workflowId,
      trigger_type: triggerType,
    });

    if (workflow.steps.length === 0) {
      execution.status = 'completed';
      execution.completed_at = new Date();
      await execution.save();
      await this.eventService.append(
        String(execution._id),
        'execution.completed',
      );
      return execution;
    }

    // Find entry steps: steps with no incoming edges
    const toStepIds = new Set(workflow.edges.map((e) => e.to));
    const entrySteps = workflow.steps.filter((s) => !toStepIds.has(s.id));

    for (const step of entrySteps) {
      const stepExecution = stepExecutions.find((se) => se.step_id === step.id);
      if (!stepExecution) continue;

      await this.eventService.append(
        String(execution._id),
        'step.queued',
        {},
        step.id,
      );

      const job: StepJob = {
        executionId: String(execution._id),
        stepId: step.id,
        stepExecutionId: String(stepExecution._id),
        stepConfig: {
          type: step.type,
          ...(step.config as Record<string, unknown>),
        },
        context: {},
        attempt: 0,
      };
      await this.pubSubService.publishJob(job);
    }

    return execution;
  }

  async triggerByWebhook(
    userId: string,
    path: string,
    payload: Record<string, unknown> = {},
    security: WebhookSecurityContext = {},
  ): Promise<ExecutionDocument> {
    const workflow = await this.workflowService.findActiveWebhookWorkflow(
      userId,
      path,
    );

    await this.enforceWebhookRateLimit(
      workflow._id,
      path,
      workflow.trigger?.config,
      security.ip,
    );

    const timestampMs = this.parseWebhookTimestampMs(security.timestamp);
    if (timestampMs === undefined) {
      throw new UnauthorizedException('Missing or invalid webhook timestamp');
    }

    const toleranceMs = this.getWebhookTimestampToleranceMs(
      workflow.trigger?.config,
    );
    if (Math.abs(Date.now() - timestampMs) > toleranceMs) {
      throw new UnauthorizedException(
        'Webhook timestamp is outside allowed tolerance',
      );
    }

    const nonce = this.normalizeWebhookNonce(security.nonce);
    if (!nonce) {
      throw new UnauthorizedException('Missing webhook nonce');
    }

    await this.registerWebhookNonce(
      workflow._id,
      nonce,
      workflow.trigger?.config,
      timestampMs,
    );

    const expectedSecret = this.getConfiguredWebhookSecret(
      workflow.trigger?.config,
    );

    if (expectedSecret) {
      const signature = this.normalizeWebhookSignature(security.signature);
      if (!signature) {
        throw new UnauthorizedException('Missing webhook signature');
      }

      const method = this.normalizeHttpMethod(security.method);
      const requestPath = this.normalizeSignedWebhookPath(
        security.path ?? path,
      );
      const bodyHash = this.hashWebhookPayloadBody(payload.body);
      const expectedSignature = this.computeWebhookSignature(
        expectedSecret,
        timestampMs,
        nonce,
        method,
        requestPath,
        bodyHash,
      );

      if (!this.secretsMatch(expectedSignature, signature)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else if (security.providedSecret) {
      throw new UnauthorizedException(
        'Webhook secret is not configured for this workflow',
      );
    }

    return this.trigger(
      String(workflow._id),
      userId,
      {},
      {
        triggerType: 'webhook',
        payload,
      },
    );
  }

  private getConfiguredWebhookSecret(
    config?: Record<string, unknown>,
  ): string | undefined {
    if (!config) {
      return undefined;
    }

    const secret = config.secret;
    if (typeof secret !== 'string') {
      return undefined;
    }

    const trimmed = secret.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private secretsMatch(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private normalizeIdempotencyKey(key?: string): string | undefined {
    if (typeof key !== 'string') {
      return undefined;
    }

    const trimmed = key.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private buildWorkflowSnapshot(workflow: {
    steps: Array<{
      id: string;
      type: 'http' | 'transform' | 'store' | 'branch';
      config?: Record<string, unknown>;
      retry?: { maxAttempts?: number; backoff?: 'exponential' | 'fixed' };
      compensation?: {
        enabled?: boolean;
        type?: 'noop' | 'http';
        config?: Record<string, unknown>;
        retry?: { maxAttempts?: number; backoff?: 'exponential' | 'fixed' };
      };
    }>;
    edges: Array<{ from: string; to: string; condition?: string }>;
  }): ExecutionWorkflowSnapshot {
    return {
      steps: workflow.steps.map((step) => ({
        id: step.id,
        type: step.type,
        config: { ...(step.config ?? {}) },
        ...(step.retry
          ? {
              retry: {
                ...(step.retry.maxAttempts !== undefined
                  ? { maxAttempts: step.retry.maxAttempts }
                  : {}),
                ...(step.retry.backoff !== undefined
                  ? { backoff: step.retry.backoff }
                  : {}),
              },
            }
          : {}),
        ...(step.compensation
          ? {
              compensation: {
                ...(step.compensation.enabled !== undefined
                  ? { enabled: step.compensation.enabled }
                  : {}),
                ...(step.compensation.type !== undefined
                  ? { type: step.compensation.type }
                  : {}),
                ...(step.compensation.config !== undefined
                  ? { config: { ...step.compensation.config } }
                  : {}),
                ...(step.compensation.retry
                  ? {
                      retry: {
                        ...(step.compensation.retry.maxAttempts !== undefined
                          ? { maxAttempts: step.compensation.retry.maxAttempts }
                          : {}),
                        ...(step.compensation.retry.backoff !== undefined
                          ? { backoff: step.compensation.retry.backoff }
                          : {}),
                      },
                    }
                  : {}),
              },
            }
          : {}),
      })),
      edges: workflow.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        ...(edge.condition !== undefined ? { condition: edge.condition } : {}),
      })),
    };
  }

  private resolveExecutionTimeoutMs(
    triggerConfig?: Record<string, unknown>,
  ): number {
    const fromConfig =
      triggerConfig?.executionTimeoutMs ?? triggerConfig?.execution_timeout_ms;
    return (
      this.parsePositiveTimeoutMs(fromConfig) ?? DEFAULT_EXECUTION_TIMEOUT_MS
    );
  }

  private parsePositiveTimeoutMs(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
      }
    }
    return undefined;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeMongoError = error as { code?: number };
    return maybeMongoError.code === 11000;
  }

  private parseWebhookTimestampMs(value?: string): number | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return undefined;
    }

    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return undefined;
      }

      // Accept both seconds and milliseconds unix timestamps.
      return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return parsed;
  }

  private normalizeWebhookNonce(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 128) {
      return undefined;
    }

    return trimmed;
  }

  private normalizeWebhookSignature(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed.toLowerCase().startsWith('sha256=')
      ? trimmed.slice('sha256='.length)
      : trimmed;
  }

  private normalizeHttpMethod(method?: string): string {
    if (!method) {
      return 'POST';
    }

    const normalized = method.trim().toUpperCase();
    return normalized.length > 0 ? normalized : 'POST';
  }

  private normalizeSignedWebhookPath(path: string): string {
    return path.trim().replace(/^\/+|\/+$/g, '');
  }

  private hashWebhookPayloadBody(body: unknown): string {
    const canonical = this.stableStringify(body ?? {});
    return createHash('sha256').update(canonical).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    const pairs = keys.map((key) => {
      const serializedKey = JSON.stringify(key);
      const serializedValue = this.stableStringify(objectValue[key]);
      return `${serializedKey}:${serializedValue}`;
    });
    return `{${pairs.join(',')}}`;
  }

  private computeWebhookSignature(
    secret: string,
    timestampMs: number,
    nonce: string,
    method: string,
    path: string,
    bodyHash: string,
  ): string {
    const payload = [
      String(Math.floor(timestampMs / 1000)),
      nonce,
      method,
      path,
      bodyHash,
    ].join('.');

    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private getWebhookTimestampToleranceMs(
    config?: Record<string, unknown>,
  ): number {
    const seconds = this.parsePositiveNumber(
      config?.webhookTimestampToleranceSeconds ??
        (config?.security as Record<string, unknown> | undefined)
          ?.timestampToleranceSeconds,
    );
    if (!seconds) {
      return DEFAULT_WEBHOOK_TIMESTAMP_TOLERANCE_MS;
    }
    return Math.floor(seconds * 1000);
  }

  private getWebhookNonceTtlMs(config?: Record<string, unknown>): number {
    const seconds = this.parsePositiveNumber(
      config?.webhookNonceTtlSeconds ??
        (config?.security as Record<string, unknown> | undefined)
          ?.nonceTtlSeconds,
    );

    if (!seconds) {
      return DEFAULT_WEBHOOK_NONCE_TTL_MS;
    }

    return Math.floor(seconds * 1000);
  }

  private getWebhookRateLimitWindowMs(
    config?: Record<string, unknown>,
  ): number {
    const securityConfig = config?.security as
      | Record<string, unknown>
      | undefined;
    const seconds = this.parsePositiveNumber(
      config?.webhookRateLimitWindowSeconds ??
        securityConfig?.rateLimitWindowSeconds ??
        (securityConfig?.rateLimit as Record<string, unknown> | undefined)
          ?.windowSeconds,
    );

    if (!seconds) {
      return DEFAULT_WEBHOOK_RATE_LIMIT_WINDOW_MS;
    }

    return Math.floor(seconds * 1000);
  }

  private getWebhookRateLimitMaxRequests(
    config?: Record<string, unknown>,
  ): number {
    const securityConfig = config?.security as
      | Record<string, unknown>
      | undefined;
    const maxRequests = this.parsePositiveNumber(
      config?.webhookRateLimitMaxRequests ??
        securityConfig?.rateLimitMaxRequests ??
        (securityConfig?.rateLimit as Record<string, unknown> | undefined)
          ?.maxRequests,
    );

    if (!maxRequests) {
      return DEFAULT_WEBHOOK_RATE_LIMIT_MAX_REQUESTS;
    }

    return Math.floor(maxRequests);
  }

  private getTriggerPayloadMaxBytes(config?: Record<string, unknown>): number {
    return (
      this.parsePositiveInteger(
        config?.triggerPayloadMaxBytes ??
          config?.trigger_payload_max_bytes ??
          process.env.TRIGGER_PAYLOAD_MAX_BYTES,
      ) ?? DEFAULT_TRIGGER_PAYLOAD_MAX_BYTES
    );
  }

  private getTriggerRateLimitWindowMs(
    config?: Record<string, unknown>,
  ): number {
    const seconds =
      this.parsePositiveInteger(
        config?.triggerRateLimitWindowSeconds ??
          config?.trigger_rate_limit_window_seconds ??
          process.env.TRIGGER_RATE_LIMIT_WINDOW_SECONDS,
      ) ?? Math.floor(DEFAULT_TRIGGER_RATE_LIMIT_WINDOW_MS / 1000);

    return seconds * 1000;
  }

  private getTriggerRateLimitMaxRequests(
    config?: Record<string, unknown>,
  ): number {
    return (
      this.parsePositiveInteger(
        config?.triggerRateLimitMaxRequests ??
          config?.trigger_rate_limit_max_requests ??
          process.env.TRIGGER_RATE_LIMIT_MAX_REQUESTS,
      ) ?? DEFAULT_TRIGGER_RATE_LIMIT_MAX_REQUESTS
    );
  }

  private getTenantMaxRunningExecutions(
    config?: Record<string, unknown>,
  ): number {
    return (
      this.parsePositiveInteger(
        config?.maxRunningExecutionsPerTenant ??
          config?.max_running_executions_per_tenant ??
          process.env.TENANT_MAX_RUNNING_EXECUTIONS,
      ) ?? DEFAULT_TENANT_MAX_RUNNING_EXECUTIONS
    );
  }

  private getWorkflowMaxRunningExecutions(
    config?: Record<string, unknown>,
  ): number {
    return (
      this.parsePositiveInteger(
        config?.maxRunningExecutionsPerWorkflow ??
          config?.max_running_executions_per_workflow ??
          process.env.WORKFLOW_MAX_RUNNING_EXECUTIONS,
      ) ?? DEFAULT_WORKFLOW_MAX_RUNNING_EXECUTIONS
    );
  }

  private parsePositiveInteger(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
      }
    }

    return undefined;
  }

  private async enforceTriggerQuotas(
    ownerId: string,
    workflowId: string,
    triggerType: TriggerType,
    payload: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<void> {
    const ownerObjectId = new Types.ObjectId(ownerId);
    const workflowObjectId = new Types.ObjectId(workflowId);

    this.enforceTriggerPayloadSize(payload, config);
    await this.enforceConcurrentExecutionQuotas(
      ownerObjectId,
      workflowObjectId,
      config,
    );
    await this.enforceTriggerRateLimit(
      ownerObjectId,
      workflowObjectId,
      triggerType,
      config,
    );
  }

  private enforceTriggerPayloadSize(
    payload: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): void {
    const maxPayloadBytes = this.getTriggerPayloadMaxBytes(config);
    const payloadBytes = Buffer.byteLength(
      this.stableStringify(payload),
      'utf8',
    );

    if (payloadBytes > maxPayloadBytes) {
      throw new HttpException(
        `Trigger payload exceeds ${maxPayloadBytes} bytes`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  }

  private async enforceConcurrentExecutionQuotas(
    ownerId: Types.ObjectId,
    workflowId: Types.ObjectId,
    config?: Record<string, unknown>,
  ): Promise<void> {
    const tenantLimit = this.getTenantMaxRunningExecutions(config);
    const workflowLimit = this.getWorkflowMaxRunningExecutions(config);

    const tenantRunning = await this.executionModel
      .countDocuments({
        owner_id: ownerId,
        status: { $in: ['pending', 'running'] },
      })
      .exec();

    if (tenantRunning >= tenantLimit) {
      throw new HttpException(
        `Tenant concurrent execution quota exceeded (${tenantLimit})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const workflowRunning = await this.executionModel
      .countDocuments({
        owner_id: ownerId,
        workflow_id: workflowId,
        status: { $in: ['pending', 'running'] },
      })
      .exec();

    if (workflowRunning >= workflowLimit) {
      throw new HttpException(
        `Workflow concurrent execution quota exceeded (${workflowLimit})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async enforceTriggerRateLimit(
    ownerId: Types.ObjectId,
    workflowId: Types.ObjectId,
    triggerType: TriggerType,
    config?: Record<string, unknown>,
  ): Promise<void> {
    const windowMs = this.getTriggerRateLimitWindowMs(config);
    const maxRequests = this.getTriggerRateLimitMaxRequests(config);
    const now = Date.now();
    const windowStartMs = Math.floor(now / windowMs) * windowMs;

    const bucket = `trigger:${triggerType}:${windowStartMs}`;

    const bucketDoc = await this.triggerRateLimitModel.findOneAndUpdate(
      {
        owner_id: ownerId,
        bucket,
      },
      {
        $setOnInsert: {
          owner_id: ownerId,
          workflow_id: workflowId,
          bucket,
          trigger_type: triggerType,
          window_started_at: new Date(windowStartMs),
          expires_at: new Date(windowStartMs + windowMs * 2),
        },
        $inc: { count: 1 },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    if (!bucketDoc) {
      throw new BadRequestException('Unable to enforce trigger rate limit');
    }

    if (bucketDoc.count > maxRequests) {
      throw new HttpException(
        'Trigger rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private parsePositiveNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return undefined;
  }

  private async registerWebhookNonce(
    workflowId: Types.ObjectId,
    nonce: string,
    config: Record<string, unknown> | undefined,
    timestampMs: number,
  ): Promise<void> {
    const nonceTtlMs = this.getWebhookNonceTtlMs(config);
    const expiresAt = new Date(Math.max(Date.now(), timestampMs + nonceTtlMs));

    try {
      await this.webhookNonceModel.create({
        workflow_id: workflowId,
        nonce,
        expires_at: expiresAt,
      });
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new UnauthorizedException('Replay webhook request detected');
      }
      throw error;
    }
  }

  private async enforceWebhookRateLimit(
    workflowId: Types.ObjectId,
    path: string,
    config: Record<string, unknown> | undefined,
    ip?: string,
  ): Promise<void> {
    const windowMs = this.getWebhookRateLimitWindowMs(config);
    const maxRequests = this.getWebhookRateLimitMaxRequests(config);
    const now = Date.now();
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const bucketIp = (ip?.trim() || 'unknown').slice(0, 128);
    const bucket = `${path}:${bucketIp}:${windowStartMs}`;

    const bucketDoc = await this.webhookRateLimitModel.findOneAndUpdate(
      {
        workflow_id: workflowId,
        bucket,
      },
      {
        $setOnInsert: {
          workflow_id: workflowId,
          bucket,
          window_started_at: new Date(windowStartMs),
          expires_at: new Date(windowStartMs + windowMs * 2),
        },
        $inc: { count: 1 },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    if (!bucketDoc) {
      throw new BadRequestException('Unable to enforce webhook rate limit');
    }

    if (bucketDoc.count > maxRequests) {
      throw new HttpException(
        'Webhook rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async findAll(
    ownerId: string,
    query: ListExecutionsQueryDto = new ListExecutionsQueryDto(),
  ): Promise<ExecutionListResponse> {
    const ownerObjectId = new Types.ObjectId(ownerId);
    const andFilters: Record<string, unknown>[] = [{ owner_id: ownerObjectId }];

    const normalizedStatuses = this.resolveStatusFilter(query);
    if (normalizedStatuses) {
      andFilters.push({ status: { $in: normalizedStatuses } });
    }

    if (query.workflow_id) {
      andFilters.push({ workflow_id: new Types.ObjectId(query.workflow_id) });
    }

    if (query.trigger_type?.length) {
      andFilters.push({ trigger_type: { $in: query.trigger_type } });
    }

    const startedAtRange = this.buildDateRange(
      query.started_from,
      query.started_to,
      'started_at',
    );
    if (startedAtRange) {
      andFilters.push({ started_at: startedAtRange });
    }

    const completedAtRange = this.buildDateRange(
      query.completed_from,
      query.completed_to,
      'completed_at',
    );
    if (completedAtRange) {
      andFilters.push({ completed_at: completedAtRange });
    }

    if (query.q?.trim()) {
      const exact = query.q.trim();
      const orFilters: Record<string, unknown>[] = [{ idempotency_key: exact }];

      if (Types.ObjectId.isValid(exact)) {
        orFilters.push({ _id: new Types.ObjectId(exact) });
      }

      andFilters.push({ $or: orFilters });
    }

    if (query.cursor) {
      const cursor = this.decodeListCursor(query.cursor);
      andFilters.push({
        $or: [
          { created_at: { $lt: cursor.created_at } },
          {
            created_at: cursor.created_at,
            _id: { $lt: cursor.id },
          },
        ],
      });
    }

    const filter =
      andFilters.length === 1 ? andFilters[0] : { $and: andFilters };

    this.validateFindAllGuardrails(andFilters, query.limit);

    const limit = query.limit;
    const docs = await this.executionModel
      .find(filter)
      .sort({ created_at: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    const hasNextPage = docs.length > limit;
    const items = hasNextPage ? docs.slice(0, limit) : docs;
    const nextCursor = hasNextPage
      ? this.encodeListCursor(items[items.length - 1])
      : null;

    return {
      items,
      page_info: {
        limit,
        cursor: query.cursor ?? null,
        next_cursor: nextCursor,
        has_next_page: hasNextPage,
      },
    };
  }

  async findSummary(
    ownerId: string,
    query: ExecutionSummaryQueryDto = new ExecutionSummaryQueryDto(),
  ): Promise<ExecutionSummaryResponse> {
    const match: Record<string, unknown> = {
      owner_id: new Types.ObjectId(ownerId),
    };

    if (query.workflow_id) {
      match.workflow_id = new Types.ObjectId(query.workflow_id);
    }

    const startedAtRange = this.buildDateRange(
      query.started_from,
      query.started_to,
      'started_at',
    );
    if (startedAtRange) {
      match.started_at = startedAtRange;
    }

    const grouped = await this.executionModel
      .aggregate<{ _id: ExecutionStatus; count: number }>([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const counts = ALL_EXECUTION_STATUSES.reduce<
      Record<ExecutionStatus, number>
    >(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        compensating: 0,
      },
    );

    for (const row of grouped) {
      if (row._id in counts) {
        counts[row._id] = row.count;
      }
    }

    return {
      counts,
      total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    };
  }

  private encodeListCursor(item: ExecutionDocument): string {
    const createdAtFromDoc =
      typeof item.get === 'function'
        ? ((item.get('created_at') as Date | undefined) ?? undefined)
        : undefined;
    const createdAtFromObject = (item as unknown as { created_at?: Date })
      .created_at;
    const createdAt = createdAtFromDoc ?? createdAtFromObject;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException('Execution cursor source is invalid');
    }

    const payload = JSON.stringify({
      created_at: createdAt.toISOString(),
      id: item._id.toString(),
    });

    return Buffer.from(payload).toString('base64url');
  }

  private decodeListCursor(cursor: string): {
    created_at: Date;
    id: Types.ObjectId;
  } {
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw) as { created_at?: string; id?: string };

      if (
        !parsed.created_at ||
        !parsed.id ||
        !Types.ObjectId.isValid(parsed.id)
      ) {
        throw new BadRequestException('Invalid cursor');
      }

      const createdAt = new Date(parsed.created_at);
      if (Number.isNaN(createdAt.getTime())) {
        throw new BadRequestException('Invalid cursor');
      }

      return { created_at: createdAt, id: new Types.ObjectId(parsed.id) };
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private resolveStatusFilter(
    query: ListExecutionsQueryDto,
  ): ExecutionStatus[] | undefined {
    const hasErrorsStatus: ExecutionStatus[] = ['failed', 'compensating'];
    const nonErrorsStatus: ExecutionStatus[] = [
      'pending',
      'running',
      'completed',
      'cancelled',
    ];

    const explicitStatuses = query.status?.length
      ? [...new Set(query.status)]
      : undefined;

    if (query.has_errors === undefined) {
      return explicitStatuses;
    }

    const targetSet = query.has_errors ? hasErrorsStatus : nonErrorsStatus;
    if (!explicitStatuses) {
      return targetSet;
    }

    const intersection = explicitStatuses.filter((status) =>
      targetSet.includes(status as ExecutionStatus),
    ) as ExecutionStatus[];

    return intersection;
  }

  private buildDateRange(
    from?: string,
    to?: string,
    fieldName?: string,
  ): Record<string, Date> | undefined {
    if (!from && !to) {
      return undefined;
    }

    const range: Record<string, Date> = {};
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (fromDate && Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName} from date`);
    }

    if (toDate && Number.isNaN(toDate.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName} to date`);
    }

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException(
        `${fieldName} from date must be before to date`,
      );
    }

    if (
      fromDate &&
      toDate &&
      toDate.getTime() - fromDate.getTime() > MAX_FILTER_WINDOW_MS
    ) {
      throw new BadRequestException(`${fieldName} date range exceeds 31 days`);
    }

    if (fromDate) {
      range.$gte = fromDate;
    }

    if (toDate) {
      range.$lte = toDate;
    }

    return range;
  }

  private validateFindAllGuardrails(
    andFilters: Record<string, unknown>[],
    limit: number,
  ): void {
    const hasAdditionalFilter = andFilters.length > 1;

    if (!hasAdditionalFilter && limit > MAX_UNFILTERED_LIMIT) {
      throw new BadRequestException(
        `Unfiltered execution list limit cannot exceed ${MAX_UNFILTERED_LIMIT}`,
      );
    }
  }

  async findOne(id: string, ownerId: string): Promise<ExecutionDocument> {
    const execution = await this.executionModel.findById(id).exec();
    if (!execution) throw new NotFoundException('Execution not found');
    if (execution.owner_id.toString() !== ownerId)
      throw new ForbiddenException('Access denied');
    return execution;
  }

  async cancel(id: string, ownerId: string): Promise<ExecutionDocument> {
    const execution = await this.findOne(id, ownerId);

    if (!['pending', 'running'].includes(execution.status)) {
      throw new ConflictException(
        `Cannot cancel execution with status '${execution.status}'`,
      );
    }

    execution.status = 'cancelled';
    execution.completed_at = new Date();
    await execution.save();

    await this.stepExecutionModel
      .updateMany(
        {
          execution_id: execution._id,
          status: { $in: ['queued', 'running'] },
        },
        {
          $set: {
            status: 'skipped',
            error: 'Execution cancelled',
            completed_at: new Date(),
          },
        },
      )
      .exec();

    await this.eventService.append(
      String(execution._id),
      'execution.cancelled',
    );

    return execution;
  }

  async findEvents(
    id: string,
    ownerId: string,
    query: ListExecutionEventsQueryDto = new ListExecutionEventsQueryDto(),
  ) {
    await this.findOne(id, ownerId);

    const occurredAtRange = this.buildDateRange(
      query.occurred_from,
      query.occurred_to,
      'occurred_at',
    );

    return this.eventService.findByExecutionId(id, {
      type: query.type,
      step_id: query.step_id,
      occurred_from: occurredAtRange?.$gte,
      occurred_to: occurredAtRange?.$lte,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async getLegalHold(
    id: string,
    ownerId: string,
  ): Promise<ExecutionLegalHoldResponse> {
    await this.findOne(id, ownerId);
    const legalHold =
      await this.eventGovernanceService.getExecutionLegalHoldState(id);

    return {
      execution_id: id,
      legal_hold: legalHold,
    };
  }

  async setLegalHold(id: string, ownerId: string, reason?: string) {
    await this.findOne(id, ownerId);
    await this.eventGovernanceService.placeExecutionLegalHold(
      id,
      ownerId,
      reason,
    );

    return {
      execution_id: id,
      legal_hold: true,
      reason: reason?.trim() || null,
    };
  }

  async releaseLegalHold(id: string, ownerId: string) {
    await this.findOne(id, ownerId);
    await this.eventGovernanceService.releaseExecutionLegalHold(id);

    return {
      execution_id: id,
      legal_hold: false,
    };
  }
}
