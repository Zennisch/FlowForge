export interface StepJob {
  executionId: string;
  stepId: string;
  stepExecutionId: string;
  stepConfig: Record<string, unknown> & { type: string };
  context: Record<string, unknown>;
  attempt: number;
  notBefore?: string;
}
