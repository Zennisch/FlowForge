import { Injectable } from '@nestjs/common';
import { StepJob } from '../../../shared/interfaces/step-job.interface';

interface BranchCase {
  value: unknown;
  next: string;
}

@Injectable()
export class BranchHandler {
  async execute(job: StepJob): Promise<Record<string, unknown>> {
    const config = job.stepConfig as unknown as {
      field: string;
      cases: BranchCase[];
      default?: string;
    };

    const actual = this.getByPath(job.context, config.field);
    const matched = (config.cases ?? []).find((c) => c.value === actual);
    const nextStep = matched?.next ?? config.default;

    if (!nextStep) {
      throw new Error(
        `Branch step "${job.stepId}" has no matching case for field "${config.field}" and no default path`,
      );
    }

    return { _branch_next: nextStep };
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
