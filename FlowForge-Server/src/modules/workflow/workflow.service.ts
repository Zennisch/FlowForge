import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { validateCronExpression } from 'cron';
import { Model, Types } from 'mongoose';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ValidateDagService } from './validate-dag.service';
import { Workflow, WorkflowDocument } from './workflow.schema';

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
    this.validateTriggerConfig(dto.trigger);

    const steps = dto.steps ?? [];
    const edges = dto.edges ?? [];
    this.validateDagService.validate(steps, edges);

    const workflow = new this.workflowModel({
      ...dto,
      owner_id: new Types.ObjectId(ownerId),
    });
    return workflow.save();
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateWorkflowDto,
  ): Promise<WorkflowDocument> {
    const workflow = await this.findOne(id, ownerId);
    this.validateTriggerConfig(dto.trigger ?? workflow.trigger);

    const steps = dto.steps ?? workflow.steps;
    const edges = dto.edges ?? workflow.edges;
    this.validateDagService.validate(steps, edges);

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
}

