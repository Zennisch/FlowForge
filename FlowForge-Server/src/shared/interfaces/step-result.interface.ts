export interface StepResult {
  executionId: string;
  stepId: string;
  stepExecutionId: string;
  status: 'completed' | 'failed';
  output: Record<string, unknown>;
  error?: string;
  attempt: number;
}

