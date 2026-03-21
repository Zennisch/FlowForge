import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { validateCronExpression } from 'cron';
import { Model, Types } from 'mongoose';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { validateWorkflowStepConfigs } from './step-config.validator';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ValidateDagService } from './validate-dag.service';
import { Workflow, WorkflowDocument } from './workflow.schema';

const DEFAULT_MAX_WORKFLOWS_PER_TENANT = 200;
const DEFAULT_MAX_STEPS_PER_WORKFLOW = 100;
const DEFAULT_MAX_EDGES_PER_WORKFLOW = 300;
const DEFAULT_MAX_ACTIVE_SCHEDULE_WORKFLOWS_PER_TENANT = 50;
const DEFAULT_MAX_ACTIVE_WEBHOOK_WORKFLOWS_PER_TENANT = 100;
const DEFAULT_MAX_WORKFLOW_DEFINITION_BYTES = 256 * 1024;

@Injectable()
export class WorkflowService {
  constructor(
    @InjectModel(Workflow.name)
    private readonly workflowModel: Model<WorkflowDocument>,
    private readonly validateDagService: ValidateDagService,
  ) {}

  findAll(ownerId: string): Promise<WorkflowDocument[]> {
    return this.workflowModel
      .find({ owner_id: new Types.ObjectId(ownerId) })
      .exec();
  }

  async findOne(id: string, ownerId: string): Promise<WorkflowDocument> {
    const workflow = await this.workflowModel.findById(id).exec();
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
    if (workflow.owner_id.toString() !== ownerId) {
      throw new ForbiddenException('Access denied');
    }
    return workflow;
  }

  async create(
    ownerId: string,
    dto: CreateWorkflowDto,
  ): Promise<WorkflowDocument> {
    const ownerObjectId = new Types.ObjectId(ownerId);

    await this.enforceWorkflowCountQuota(ownerObjectId);
    this.validateTriggerConfig(dto.trigger);

    const steps = dto.steps ?? [];
    const edges = dto.edges ?? [];
    this.enforceWorkflowShapeQuota(steps, edges);
    this.enforceWorkflowDefinitionSizeQuota({
      name: dto.name,
      description: dto.description,
      status: dto.status,
      trigger: dto.trigger,
      steps,
      edges,
    });

    await this.enforceActiveTriggerQuotaOnCreate(
      ownerObjectId,
      dto.status,
      dto.trigger,
    );

    this.validateDagService.validate(steps, edges);
    validateWorkflowStepConfigs(steps);
    this.validateCompensationConfig(steps);

    const workflow = new this.workflowModel({
      ...dto,
      owner_id: ownerObjectId,
    });
    return workflow.save();
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateWorkflowDto,
  ): Promise<WorkflowDocument> {
    const workflow = await this.findOne(id, ownerId);
    const ownerObjectId = new Types.ObjectId(ownerId);
    const resolvedTrigger = dto.trigger ?? workflow.trigger;
    const resolvedStatus = dto.status ?? workflow.status;

    this.validateTriggerConfig(resolvedTrigger);

    const steps = dto.steps ?? workflow.steps;
    const edges = dto.edges ?? workflow.edges;
    this.enforceWorkflowShapeQuota(steps, edges);
    this.enforceWorkflowDefinitionSizeQuota({
      name: dto.name ?? workflow.name,
      description: dto.description ?? workflow.description,
      status: resolvedStatus,
      trigger: resolvedTrigger,
      steps,
      edges,
    });

    await this.enforceActiveTriggerQuotaOnUpdate(
      ownerObjectId,
      workflow._id,
      resolvedStatus,
      resolvedTrigger,
    );

    this.validateDagService.validate(steps, edges);
    validateWorkflowStepConfigs(steps);
    this.validateCompensationConfig(steps);

    Object.assign(workflow, dto);
    return workflow.save();
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.findOne(id, ownerId);
    await this.workflowModel.findByIdAndDelete(id).exec();
  }

  async findActiveWebhookWorkflow(
    ownerId: string,
    path: string,
  ): Promise<WorkflowDocument> {
    if (!Types.ObjectId.isValid(ownerId)) {
      throw new NotFoundException('Webhook target not found');
    }

    const normalizedPath = this.normalizeWebhookPath(path);
    if (!normalizedPath) {
      throw new NotFoundException('Webhook target not found');
    }

    const workflow = await this.workflowModel
      .findOne({
        owner_id: new Types.ObjectId(ownerId),
        status: 'active',
        'trigger.type': 'webhook',
        'trigger.config.path': { $in: [normalizedPath, `/${normalizedPath}`] },
      })
      .exec();

    if (!workflow) {
      throw new NotFoundException('Webhook target not found');
    }

    return workflow;
  }

  private validateTriggerConfig(
    trigger?: { type?: string; config?: Record<string, unknown> },
  ): void {
    if (!trigger?.type) {
      return;
    }

    if (trigger.type === 'schedule') {
      this.validateScheduleTrigger(trigger);
      return;
    }

    if (trigger.type === 'webhook') {
      this.validateWebhookTrigger(trigger);
    }
  }

  private validateScheduleTrigger(
    trigger: { config?: Record<string, unknown> },
  ): void {

    const cronExpression =
      typeof trigger.config?.cron === 'string'
        ? trigger.config.cron.trim()
        : '';

    if (!cronExpression) {
      throw new BadRequestException(
        'Scheduled trigger requires trigger.config.cron',
      );
    }

    const cronValidation = validateCronExpression(cronExpression);
    if (!cronValidation.valid) {
      throw new BadRequestException('Invalid trigger.config.cron expression');
    }

    const timezone = trigger.config?.timezone;
    if (timezone === undefined || timezone === null || timezone === '') {
      return;
    }

    if (typeof timezone !== 'string') {
      throw new BadRequestException('trigger.config.timezone must be a string');
    }

    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new BadRequestException('Invalid trigger.config.timezone');
    }
  }

  private validateWebhookTrigger(
    trigger: { config?: Record<string, unknown> },
  ): void {
    const config = trigger.config ?? {};
    const pathRaw =
      typeof config.path === 'string' ? config.path : '';
    const path = this.normalizeWebhookPath(pathRaw);

    if (!path) {
      throw new BadRequestException(
        'Webhook trigger requires trigger.config.path',
      );
    }

    if (!/^[A-Za-z0-9_-]+$/.test(path)) {
      throw new BadRequestException(
        'trigger.config.path may only contain letters, numbers, underscore, and hyphen',
      );
    }

    const normalizedConfig: Record<string, unknown> = { ...config, path };

    if (config.secret !== undefined && config.secret !== null) {
      if (typeof config.secret !== 'string') {
        throw new BadRequestException('trigger.config.secret must be a string');
      }

      const secret = config.secret.trim();
      if (!secret) {
        throw new BadRequestException('trigger.config.secret cannot be empty');
      }

      normalizedConfig.secret = secret;
    }

    trigger.config = normalizedConfig;
  }

  private normalizeWebhookPath(path: string): string {
    return path.trim().replace(/^\/+|\/+$/g, '');
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

  private getMaxWorkflowsPerTenant(): number {
    return (
      this.parsePositiveInteger(process.env.WORKFLOW_MAX_PER_TENANT) ??
      DEFAULT_MAX_WORKFLOWS_PER_TENANT
    );
  }

  private getMaxStepsPerWorkflow(): number {
    return (
      this.parsePositiveInteger(process.env.WORKFLOW_MAX_STEPS_PER_WORKFLOW) ??
      DEFAULT_MAX_STEPS_PER_WORKFLOW
    );
  }

  private getMaxEdgesPerWorkflow(): number {
    return (
      this.parsePositiveInteger(process.env.WORKFLOW_MAX_EDGES_PER_WORKFLOW) ??
      DEFAULT_MAX_EDGES_PER_WORKFLOW
    );
  }

  private getMaxActiveScheduleWorkflowsPerTenant(): number {
    return (
      this.parsePositiveInteger(
        process.env.WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT,
      ) ?? DEFAULT_MAX_ACTIVE_SCHEDULE_WORKFLOWS_PER_TENANT
    );
  }

  private getMaxActiveWebhookWorkflowsPerTenant(): number {
    return (
      this.parsePositiveInteger(
        process.env.WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT,
      ) ?? DEFAULT_MAX_ACTIVE_WEBHOOK_WORKFLOWS_PER_TENANT
    );
  }

  private getMaxWorkflowDefinitionBytes(): number {
    return (
      this.parsePositiveInteger(process.env.WORKFLOW_MAX_DEFINITION_BYTES) ??
      DEFAULT_MAX_WORKFLOW_DEFINITION_BYTES
    );
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

  private async enforceWorkflowCountQuota(ownerId: Types.ObjectId): Promise<void> {
    const maxWorkflows = this.getMaxWorkflowsPerTenant();
    const currentCount = await this.workflowModel
      .countDocuments({ owner_id: ownerId })
      .exec();

    if (currentCount >= maxWorkflows) {
      throw new HttpException(
        `Workflow quota exceeded for tenant (${maxWorkflows})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private enforceWorkflowShapeQuota(
    steps: Array<unknown>,
    edges: Array<unknown>,
  ): void {
    const maxSteps = this.getMaxStepsPerWorkflow();
    const maxEdges = this.getMaxEdgesPerWorkflow();

    if (steps.length > maxSteps) {
      throw new HttpException(
        `Workflow exceeds maximum step count (${maxSteps})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (edges.length > maxEdges) {
      throw new HttpException(
        `Workflow exceeds maximum edge count (${maxEdges})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private enforceWorkflowDefinitionSizeQuota(definition: {
    name?: string;
    description?: string;
    status?: string;
    trigger?: { type?: string; config?: Record<string, unknown> };
    steps: Array<unknown>;
    edges: Array<unknown>;
  }): void {
    const maxBytes = this.getMaxWorkflowDefinitionBytes();
    const serialized = this.stableStringify(definition);
    const bytes = Buffer.byteLength(serialized, 'utf8');

    if (bytes > maxBytes) {
      throw new HttpException(
        `Workflow definition exceeds ${maxBytes} bytes`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  }

  private isActiveTriggeredWorkflow(
    status: string | undefined,
    trigger?: { type?: string },
  ): trigger is { type: 'schedule' | 'webhook' } {
    const effectiveStatus = status ?? 'active';
    if (effectiveStatus !== 'active') {
      return false;
    }

    return trigger?.type === 'schedule' || trigger?.type === 'webhook';
  }

  private getActiveTriggerLimit(triggerType: 'schedule' | 'webhook'): number {
    return triggerType === 'schedule'
      ? this.getMaxActiveScheduleWorkflowsPerTenant()
      : this.getMaxActiveWebhookWorkflowsPerTenant();
  }

  private async enforceActiveTriggerQuotaOnCreate(
    ownerId: Types.ObjectId,
    status: string | undefined,
    trigger?: { type?: string },
  ): Promise<void> {
    if (!this.isActiveTriggeredWorkflow(status, trigger)) {
      return;
    }

    const triggerType = trigger.type;
    const maxActive = this.getActiveTriggerLimit(triggerType);
    const currentCount = await this.workflowModel
      .countDocuments({
        owner_id: ownerId,
        status: 'active',
        'trigger.type': triggerType,
      })
      .exec();

    if (currentCount >= maxActive) {
      throw new HttpException(
        `Active ${triggerType} workflow quota exceeded (${maxActive})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async enforceActiveTriggerQuotaOnUpdate(
    ownerId: Types.ObjectId,
    workflowId: Types.ObjectId,
    status: string | undefined,
    trigger?: { type?: string },
  ): Promise<void> {
    if (!this.isActiveTriggeredWorkflow(status, trigger)) {
      return;
    }

    const triggerType = trigger.type;
    const maxActive = this.getActiveTriggerLimit(triggerType);
    const currentCount = await this.workflowModel
      .countDocuments({
        owner_id: ownerId,
        status: 'active',
        'trigger.type': triggerType,
        _id: { $ne: workflowId },
      })
      .exec();

    if (currentCount >= maxActive) {
      throw new HttpException(
        `Active ${triggerType} workflow quota exceeded (${maxActive})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private validateCompensationConfig(
    steps: Array<{
      id: string;
      compensation?: {
        enabled?: boolean;
        type?: 'noop' | 'http';
        config?: Record<string, unknown>;
        retry?: { maxAttempts?: number; backoff?: 'exponential' | 'fixed' };
      };
    }>,
  ): void {
    for (const step of steps) {
      const compensation = step.compensation;
      if (!compensation?.enabled) {
        continue;
      }

      const type = compensation.type ?? 'noop';
      const config = compensation.config ?? {};

      if (!['noop', 'http'].includes(type)) {
        throw new BadRequestException(
          `Step '${step.id}' has unsupported compensation.type`,
        );
      }

      if (type === 'http') {
        const url = config.url;
        if (typeof url !== 'string' || url.trim().length === 0) {
          throw new BadRequestException(
            `Step '${step.id}' compensation http requires config.url`,
          );
        }

        const method = config.method;
        if (method !== undefined) {
          if (typeof method !== 'string') {
            throw new BadRequestException(
              `Step '${step.id}' compensation http method must be a string`,
            );
          }

          const normalizedMethod = method.trim().toUpperCase();
          if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
            throw new BadRequestException(
              `Step '${step.id}' compensation http method is invalid`,
            );
          }
        }
      }

      const maxAttempts = compensation.retry?.maxAttempts;
      if (
        maxAttempts !== undefined &&
        (!Number.isFinite(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
      ) {
        throw new BadRequestException(
          `Step '${step.id}' compensation retry.maxAttempts must be between 1 and 10`,
        );
      }
    }
  }
}

