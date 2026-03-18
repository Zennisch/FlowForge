export type ExecutionStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'compensating';

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
	| 'step.retrying';

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
	triggerType: string;
	triggerPayload: Record<string, unknown>;
	context: Record<string, unknown>;
	idempotencyKey?: string;
	startedAt?: string;
	completedAt?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface ExecutionEvent {
	id: string;
	executionId: string;
	type: EventType;
	payload: Record<string, unknown>;
	stepId?: string;
	createdAt: string;
}

export const ACTIVE_STATUSES: ExecutionStatus[] = ['pending', 'running', 'compensating'];
