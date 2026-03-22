import { Injectable } from '@nestjs/common';
import { StepJob } from '../../../shared/interfaces/step-job.interface';

@Injectable()
export class TransformHandler {
  async execute(job: StepJob): Promise<Record<string, unknown>> {
    const { mapping } = job.stepConfig as {
      mapping?: Record<string, string>;
    };

    if (!mapping) return {};

    const result: Record<string, unknown> = {};
    for (const [outKey, sourcePath] of Object.entries(mapping)) {
      result[outKey] = this.getByPath(job.context, sourcePath);
    }
    return result;
  }

  private getByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc !== null && acc !== undefined && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
