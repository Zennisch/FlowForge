export type StepType = 'http' | 'transform' | 'store' | 'branch';
export type TriggerType = 'manual' | 'webhook' | 'schedule';
export type WorkflowStatus = 'active' | 'inactive';
export type BackoffStrategy = 'exponential' | 'fixed';

export interface RetryPolicy {
  maxAttempts?: number;
  backoff?: BackoffStrategy;
}

export interface WorkflowStep {
  id: string;
  type: StepType;
  config?: Record<string, unknown>;
  retry?: RetryPolicy;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface WorkflowTrigger {
  type: TriggerType;
  config?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  status?: WorkflowStatus;
  trigger?: WorkflowTrigger;
  steps?: WorkflowStep[];
  edges?: WorkflowEdge[];
}

export interface UpdateWorkflowRequest extends Partial<CreateWorkflowRequest> {}

export interface TriggerExecutionRequest {
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}

export type WorkflowInsightExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'compensating';

export interface WorkflowInsightExecution {
  id: string;
  status: WorkflowInsightExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface WorkflowInsightItem {
  workflowId: string;
  lastExecution: WorkflowInsightExecution | null;
  recentExecutions: WorkflowInsightExecution[];
  counts: Record<WorkflowInsightExecutionStatus, number>;
}

export interface WorkflowInsightsSummary {
  totalWorkflows: number;
  activeWorkflows: number;
  inactiveWorkflows: number;
  executions: number;
  running: number;
  successRate: number | null;
  failureRate: number | null;
}

export interface WorkflowInsightsResponse {
  summary: WorkflowInsightsSummary;
  items: Record<string, WorkflowInsightItem>;
}

export interface WorkflowInsightsQuery {
  startedFrom?: string;
  startedTo?: string;
  historyLimit?: number;
}
