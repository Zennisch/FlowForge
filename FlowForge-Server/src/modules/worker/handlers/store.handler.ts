import { Injectable } from '@nestjs/common';
import { StepJob } from '../../../shared/interfaces/step-job.interface';

@Injectable()
export class StoreHandler {
  async execute(job: StepJob): Promise<Record<string, unknown>> {
    const { data } = job.stepConfig as { data?: Record<string, unknown> };
    return data ?? {};
  }
}

