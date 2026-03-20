import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Message, Subscription } from '@google-cloud/pubsub';
import { PubSubService } from '../../infra/pubsub/pubsub.provider';
import { StepJob } from '../../shared/interfaces/step-job.interface';
import { StepResult } from '../../shared/interfaces/step-result.interface';
import { StepStateService } from '../execution/step-state.service';
import { StepExecutorService } from './step-executor.service';

@Injectable()
export class ConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name);
  private subscription: Subscription;

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly stepStateService: StepStateService,
    private readonly stepExecutorService: StepExecutorService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.pubSubService.getJobsSubscription();
    this.subscription.on('message', (msg: Message) => {
      void this.handleMessage(msg);
    });
    this.subscription.on('error', (err: Error) => {
      this.logger.error('Jobs subscription error', err.message);
    });
    this.logger.log('Worker subscribed to workflow-jobs');
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscription.close();
  }

  private async handleMessage(message: Message): Promise<void> {
    let job: StepJob;
    try {
      job = JSON.parse(message.data.toString()) as StepJob;
    } catch {
      this.logger.error('Malformed job message; dropping', message.data.toString());
      message.ack();
      return;
    }

    if (job.notBefore) {
      const notBeforeMs = Date.parse(job.notBefore);
      if (Number.isFinite(notBeforeMs)) {
        const remainingMs = notBeforeMs - Date.now();
        if (remainingMs > 0) {
          const delaySeconds = Math.max(1, Math.min(600, Math.ceil(remainingMs / 1000)));
          this.logger.log(
            `Deferring step "${job.stepId}" for execution ${job.executionId} ` +
              `for ${delaySeconds}s until ${job.notBefore}`,
          );
          try {
            message.modAck(delaySeconds);
          } catch (err) {
            this.logger.error(
              `Failed to defer job for step "${job.stepId}": ${String(err)}`,
            );
            message.nack();
          }
          return;
        }
      }
    }

    try {
      const started = await this.stepStateService.markRunning(job.stepExecutionId);
      if (!started) {
        this.logger.log(
          `Dropping stale job for step "${job.stepId}" in execution ${job.executionId}`,
        );
        message.ack();
        return;
      }
    } catch (err) {
      this.logger.error(
        `markRunning failed for step "${job.stepId}": ${String(err)}`,
      );
      message.nack();
      return;
    }

    let output: Record<string, unknown>;
    try {
      output = await this.stepExecutorService.execute(job);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Step "${job.stepId}" failed (attempt ${job.attempt}): ${error}`,
      );
      const result: StepResult = {
        executionId: job.executionId,
        stepId: job.stepId,
        stepExecutionId: job.stepExecutionId,
        status: 'failed',
        output: {},
        error,
        attempt: job.attempt,
      };
      try {
        await this.pubSubService.publishResult(result);
      } catch (pubErr) {
        this.logger.error(`Failed to publish failure result: ${String(pubErr)}`);
        message.nack();
        return;
      }
      message.ack();
      return;
    }

    const result: StepResult = {
      executionId: job.executionId,
      stepId: job.stepId,
      stepExecutionId: job.stepExecutionId,
      status: 'completed',
      output,
      attempt: job.attempt,
    };
    try {
      await this.pubSubService.publishResult(result);
    } catch (pubErr) {
      this.logger.error(`Failed to publish success result: ${String(pubErr)}`);
      message.nack();
      return;
    }
    message.ack();
  }
}

