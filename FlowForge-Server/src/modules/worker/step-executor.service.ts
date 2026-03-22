import { Injectable, Logger } from '@nestjs/common';
import { StepJob } from '../../shared/interfaces/step-job.interface';
import { validateWorkflowStepConfigs } from '../workflow/step-config.validator';
import { BranchHandler } from './handlers/branch.handler';
import { HttpHandler } from './handlers/http.handler';
import { StoreHandler } from './handlers/store.handler';
import { TransformHandler } from './handlers/transform.handler';

@Injectable()
export class StepExecutorService {
  private readonly logger = new Logger(StepExecutorService.name);

  constructor(
    private readonly httpHandler: HttpHandler,
    private readonly transformHandler: TransformHandler,
    private readonly storeHandler: StoreHandler,
    private readonly branchHandler: BranchHandler,
  ) {}

  async execute(job: StepJob): Promise<Record<string, unknown>> {
    const { type } = job.stepConfig;
    this.logger.log(
      `Executing step "${job.stepId}" (type: ${type}, attempt: ${job.attempt})`,
    );

    switch (type) {
      case 'http':
        this.validateRuntimeStepConfig('http', job);
        return this.httpHandler.execute(job);
      case 'transform':
        this.validateRuntimeStepConfig('transform', job);
        return this.transformHandler.execute(job);
      case 'store':
        this.validateRuntimeStepConfig('store', job);
        return this.storeHandler.execute(job);
      case 'branch':
        this.validateRuntimeStepConfig('branch', job);
        return this.branchHandler.execute(job);
      default:
        throw new Error(`Unknown step type: "${String(type)}"`);
    }
  }

  private validateRuntimeStepConfig(
    type: 'http' | 'transform' | 'store' | 'branch',
    job: StepJob,
  ): void {
    validateWorkflowStepConfigs([
      {
        id: job.stepId,
        type,
        config: job.stepConfig,
      },
    ]);
  }
}
