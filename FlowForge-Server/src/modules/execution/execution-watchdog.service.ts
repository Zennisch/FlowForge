import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { CompensateService } from './compensate.service';
import { Execution, ExecutionDocument } from './execution.schema';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';
import { StepStateService } from './step-state.service';

const WATCHDOG_INTERVAL_MS = 15_000;
const WATCHDOG_BATCH_LIMIT = 100;

@Injectable()
export class ExecutionWatchdogService {
  private readonly logger = new Logger(ExecutionWatchdogService.name);
  private scanInProgress = false;

  constructor(
    @InjectModel(Execution.name)
    private readonly executionModel: Model<ExecutionDocument>,
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    private readonly stepStateService: StepStateService,
    private readonly compensateService: CompensateService,
  ) {}

  @Interval(WATCHDOG_INTERVAL_MS)
  async scanForTimeouts(): Promise<void> {
    if (this.scanInProgress) {
      return;
    }

    this.scanInProgress = true;
    const now = new Date();

    try {
      const compensatedExecutionIds = await this.handleTimedOutSteps(now);
      await this.handleTimedOutExecutions(now, compensatedExecutionIds);
    } finally {
      this.scanInProgress = false;
    }
  }

  private async handleTimedOutSteps(now: Date): Promise<Set<string>> {
    const compensatedExecutionIds = new Set<string>();
    const timedOutSteps = await this.stepExecutionModel
      .find({
        status: 'running',
        timeout_at: { $lte: now },
      })
      .limit(WATCHDOG_BATCH_LIMIT)
      .exec();

    for (const stepExecution of timedOutSteps) {
      const executionId = stepExecution.execution_id.toString();
      if (compensatedExecutionIds.has(executionId)) {
        continue;
      }

      const markedFailed = await this.stepStateService.markFailed(
        stepExecution._id.toString(),
        this.buildStepTimeoutError(stepExecution),
      );
      if (!markedFailed) {
        continue;
      }

      const compensated = await this.compensateRunningExecution(
        executionId,
        'step timeout',
      );
      if (compensated) {
        compensatedExecutionIds.add(executionId);
      }
    }

    return compensatedExecutionIds;
  }

  private async handleTimedOutExecutions(
    now: Date,
    skippedExecutionIds: Set<string>,
  ): Promise<void> {
    const timedOutExecutions = await this.executionModel
      .find({
        status: 'running',
        timeout_at: { $lte: now },
      })
      .limit(WATCHDOG_BATCH_LIMIT)
      .exec();

    for (const execution of timedOutExecutions) {
      const executionId = execution._id.toString();
      if (skippedExecutionIds.has(executionId)) {
        continue;
      }

      await this.compensateRunningExecution(executionId, 'execution timeout');
    }
  }

  private async compensateRunningExecution(
    executionId: string,
    timeoutScope: 'step timeout' | 'execution timeout',
  ): Promise<boolean> {
    const execution = await this.executionModel.findById(executionId).exec();
    if (!execution || execution.status !== 'running') {
      return false;
    }

    this.logger.warn(
      `Detected ${timeoutScope} for execution ${executionId}; starting compensation`,
    );
    await this.compensateService.compensate(executionId, 'timeout');
    return true;
  }

  private buildStepTimeoutError(stepExecution: StepExecutionDocument): string {
    if (
      typeof stepExecution.timeout_ms === 'number' &&
      Number.isFinite(stepExecution.timeout_ms) &&
      stepExecution.timeout_ms > 0
    ) {
      return `Step timed out after ${stepExecution.timeout_ms}ms`;
    }

    return 'Step timed out';
  }
}
