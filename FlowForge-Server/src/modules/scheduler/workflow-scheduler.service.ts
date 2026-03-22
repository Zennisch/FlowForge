import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, validateCronExpression } from 'cron';
import { Model } from 'mongoose';
import { ExecutionService } from '../execution/execution.service';
import { Workflow, WorkflowDocument } from '../workflow/workflow.schema';
import { SchedulerLock, SchedulerLockDocument } from './scheduler-lock.schema';

type ScheduledWorkflow = {
  workflowId: string;
  ownerId: string;
  cron: string;
  timezone?: string;
};

@Injectable()
export class WorkflowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowSchedulerService.name);
  private readonly instanceId = randomUUID();
  private readonly leaderLeaseDurationMs = 45_000;
  private readonly leaderLockId = 'workflow-scheduler-leader';
  private readonly jobConfigs = new Map<
    string,
    { cron: string; timezone?: string }
  >();
  private isLeader = false;

  constructor(
    @InjectModel(Workflow.name)
    private readonly workflowModel: Model<WorkflowDocument>,
    @InjectModel(SchedulerLock.name)
    private readonly schedulerLockModel: Model<SchedulerLockDocument>,
    private readonly executionService: ExecutionService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshSchedules();
  }

  @Cron('*/30 * * * * *')
  async refreshSchedulesPeriodically(): Promise<void> {
    await this.refreshSchedules();
  }

  async onModuleDestroy(): Promise<void> {
    this.clearManagedJobs();
    if (this.isLeader) {
      await this.releaseLeadership();
    }
  }

  async refreshSchedules(): Promise<void> {
    const hasLeadership = await this.tryAcquireLeadership();

    if (!hasLeadership) {
      if (this.isLeader) {
        this.logger.warn(
          'Scheduler leadership lost; clearing local workflow cron jobs',
        );
      }
      this.isLeader = false;
      this.clearManagedJobs();
      return;
    }

    if (!this.isLeader) {
      this.logger.log(
        `Scheduler leadership acquired by instance ${this.instanceId}`,
      );
    }
    this.isLeader = true;

    const workflows = await this.workflowModel
      .find({ status: 'active', 'trigger.type': 'schedule' })
      .exec();

    const desired = new Map<string, ScheduledWorkflow>();

    for (const workflow of workflows) {
      const cron = this.getCronExpression(workflow.trigger?.config);
      if (!cron) {
        this.logger.warn(
          `Skipping schedule for workflow ${String(workflow._id)} because trigger.config.cron is missing`,
        );
        continue;
      }

      const cronValidation = validateCronExpression(cron);
      if (!cronValidation.valid) {
        this.logger.warn(
          `Skipping schedule for workflow ${String(workflow._id)} because cron is invalid`,
        );
        continue;
      }

      const timezone = this.getTimezone(workflow.trigger?.config);
      if (timezone && !this.isValidTimezone(timezone)) {
        this.logger.warn(
          `Skipping schedule for workflow ${String(workflow._id)} because timezone is invalid`,
        );
        continue;
      }

      desired.set(String(workflow._id), {
        workflowId: String(workflow._id),
        ownerId: workflow.owner_id.toString(),
        cron,
        timezone,
      });
    }

    this.syncJobs(desired);
  }

  private clearManagedJobs(): void {
    const jobs = this.schedulerRegistry.getCronJobs();
    for (const [name, job] of jobs) {
      if (!name.startsWith('workflow:')) {
        continue;
      }
      job.stop();
      this.schedulerRegistry.deleteCronJob(name);
      this.jobConfigs.delete(name.replace('workflow:', ''));
    }
  }

  private async tryAcquireLeadership(): Promise<boolean> {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + this.leaderLeaseDurationMs);

    try {
      const lock = await this.schedulerLockModel
        .findOneAndUpdate(
          {
            _id: this.leaderLockId,
            $or: [{ lease_until: { $lte: now } }, { owner: this.instanceId }],
          },
          {
            $set: {
              owner: this.instanceId,
              lease_until: leaseUntil,
            },
            $setOnInsert: {
              _id: this.leaderLockId,
            },
          },
          {
            returnDocument: 'after',
            upsert: true,
          },
        )
        .exec();

      return lock?.owner === this.instanceId;
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        return false;
      }
      this.logger.error(
        'Failed to acquire scheduler leadership lock',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  private async releaseLeadership(): Promise<void> {
    try {
      await this.schedulerLockModel
        .findOneAndUpdate(
          {
            _id: this.leaderLockId,
            owner: this.instanceId,
          },
          {
            $set: {
              lease_until: new Date(0),
            },
          },
        )
        .exec();
    } catch (error: unknown) {
      this.logger.error(
        'Failed to release scheduler leadership lock',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeMongoError = error as { code?: number };
    return maybeMongoError.code === 11000;
  }

  private syncJobs(desired: Map<string, ScheduledWorkflow>): void {
    const existingJobs = this.schedulerRegistry.getCronJobs();

    for (const [name, job] of existingJobs) {
      if (!name.startsWith('workflow:')) {
        continue;
      }

      const workflowId = name.replace('workflow:', '');
      const config = desired.get(workflowId);

      if (!config) {
        job.stop();
        this.schedulerRegistry.deleteCronJob(name);
        this.jobConfigs.delete(workflowId);
        continue;
      }

      const currentConfig = this.jobConfigs.get(workflowId);
      if (
        currentConfig?.cron === config.cron &&
        (currentConfig.timezone ?? '') === (config.timezone ?? '')
      ) {
        desired.delete(workflowId);
        continue;
      }

      job.stop();
      this.schedulerRegistry.deleteCronJob(name);
      this.jobConfigs.delete(workflowId);
    }

    for (const [workflowId, config] of desired) {
      const jobName = `workflow:${workflowId}`;
      const job = new CronJob(
        config.cron,
        () => {
          void this.handleTick(config);
        },
        null,
        false,
        config.timezone,
      );

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();
      this.jobConfigs.set(workflowId, {
        cron: config.cron,
        timezone: config.timezone,
      });
      this.logger.log(
        `Registered schedule ${jobName} (${config.cron}${
          config.timezone ? ` @ ${config.timezone}` : ''
        })`,
      );
    }
  }

  private async handleTick(config: ScheduledWorkflow): Promise<void> {
    try {
      await this.executionService.trigger(
        config.workflowId,
        config.ownerId,
        {},
        {
          triggerType: 'schedule',
          payload: {
            cron: config.cron,
            timezone: config.timezone,
            scheduled_at: new Date().toISOString(),
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed scheduled trigger for workflow ${config.workflowId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private getCronExpression(
    config?: Record<string, unknown>,
  ): string | undefined {
    if (!config) {
      return undefined;
    }

    const cron = config.cron;
    if (typeof cron !== 'string') {
      return undefined;
    }

    const value = cron.trim();
    return value.length > 0 ? value : undefined;
  }

  private getTimezone(config?: Record<string, unknown>): string | undefined {
    if (!config) {
      return undefined;
    }

    const timezone = config.timezone;
    if (typeof timezone !== 'string') {
      return undefined;
    }

    const value = timezone.trim();
    return value.length > 0 ? value : undefined;
  }

  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
