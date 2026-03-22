export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'compensating';

export type TriggerType = 'manual' | 'webhook' | 'schedule';

export type StepStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

export type EventType =
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.cancelled'
  | 'execution.compensating'
  | 'step.queued'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.skipped'
  | 'step.retrying'
  | 'step.compensation.started'
  | 'step.compensation.completed'
  | 'step.compensation.failed';

export interface StepExecution {
  id: string;
  executionId: string;
  stepId: string;
  status: StepStatus;
  attempt: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  ownerId: string;
  status: ExecutionStatus;
  triggerType: TriggerType;
  triggerPayload: Record<string, unknown>;
  context: Record<string, unknown>;
  idempotencyKey?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  stepExecutions?: StepExecution[];
}

export interface ExecutionEvent {
  id: string;
  executionId: string;
  type: EventType;
  payload: Record<string, unknown>;
  stepId?: string;
  createdAt: string;
}

export interface ExecutionPageInfo {
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface ExecutionListResponse {
  items: Execution[];
  pageInfo: ExecutionPageInfo;
}

export interface ExecutionEventsResponse {
  items: ExecutionEvent[];
  pageInfo: ExecutionPageInfo;
}

export interface ExecutionSummaryResponse {
  counts: Record<ExecutionStatus, number>;
  total: number;
}

export interface ExecutionLegalHoldState {
  active: boolean;
  reason: string | null;
  setByOwnerId: string | null;
  createdAt: string | null;
  releasedAt: string | null;
}

export interface ExecutionLegalHoldResponse {
  executionId: string;
  legalHold: ExecutionLegalHoldState;
}

export type SetExecutionLegalHoldResponse = ExecutionLegalHoldResponse;

export type ReleaseExecutionLegalHoldResponse = ExecutionLegalHoldResponse;

export interface ExecutionListQuery {
  status?: ExecutionStatus[];
  workflowId?: string;
  triggerType?: TriggerType[];
  startedFrom?: string;
  startedTo?: string;
  completedFrom?: string;
  completedTo?: string;
  hasErrors?: boolean;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface ExecutionSummaryQuery {
  workflowId?: string;
  startedFrom?: string;
  startedTo?: string;
}

export interface ExecutionEventsQuery {
  type?: EventType[];
  stepId?: string;
  occurredFrom?: string;
  occurredTo?: string;
  cursor?: string;
  limit?: number;
}

export const ACTIVE_STATUSES: ExecutionStatus[] = ['pending', 'running', 'compensating'];
