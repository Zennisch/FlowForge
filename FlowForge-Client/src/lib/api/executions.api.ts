import type { Execution, ExecutionEvent } from '@/types/execution.types';

import { apiClient } from './client';

interface RawExecution {
	id?: string;
	_id?: string;
	workflow_id?: string;
	workflowId?: string;
	owner_id?: string;
	ownerId?: string;
	status: Execution['status'];
	trigger_type?: string;
	triggerType?: string;
	trigger_payload?: Record<string, unknown>;
	triggerPayload?: Record<string, unknown>;
	context?: Record<string, unknown>;
	idempotency_key?: string;
	idempotencyKey?: string;
	started_at?: string;
	startedAt?: string;
	completed_at?: string;
	completedAt?: string;
	created_at?: string;
	createdAt?: string;
	updated_at?: string;
	updatedAt?: string;
}

interface RawExecutionEvent {
	id?: string;
	_id?: string;
	execution_id?: string;
	executionId?: string;
	type: ExecutionEvent['type'];
	payload?: Record<string, unknown>;
	step_id?: string;
	stepId?: string;
	created_at?: string;
	createdAt?: string;
}

function normalizeExecution(raw: RawExecution): Execution {
	return {
		id: raw.id ?? raw._id ?? '',
		workflowId: raw.workflowId ?? raw.workflow_id ?? '',
		ownerId: raw.ownerId ?? raw.owner_id ?? '',
		status: raw.status,
		triggerType: raw.triggerType ?? raw.trigger_type ?? 'manual',
		triggerPayload: raw.triggerPayload ?? raw.trigger_payload ?? {},
		context: raw.context ?? {},
		idempotencyKey: raw.idempotencyKey ?? raw.idempotency_key,
		startedAt: raw.startedAt ?? raw.started_at,
		completedAt: raw.completedAt ?? raw.completed_at,
		createdAt: raw.createdAt ?? raw.created_at,
		updatedAt: raw.updatedAt ?? raw.updated_at,
	};
}

function normalizeExecutionEvent(raw: RawExecutionEvent): ExecutionEvent {
	return {
		id: raw.id ?? raw._id ?? '',
		executionId: raw.executionId ?? raw.execution_id ?? '',
		type: raw.type,
		payload: raw.payload ?? {},
		stepId: raw.stepId ?? raw.step_id,
		createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
	};
}

export const executionsApi = {
	async list(): Promise<Execution[]> {
		const { data } = await apiClient.get<RawExecution[]>('/executions');
		return data.map(normalizeExecution);
	},

	async get(id: string): Promise<Execution> {
		const { data } = await apiClient.get<RawExecution>(`/executions/${id}`);
		return normalizeExecution(data);
	},

	async getEvents(id: string): Promise<ExecutionEvent[]> {
		const { data } = await apiClient.get<RawExecutionEvent[]>(`/executions/${id}/events`);
		return data.map(normalizeExecutionEvent);
	},

	async cancel(id: string): Promise<Execution> {
		const { data } = await apiClient.post<RawExecution>(`/executions/${id}/cancel`);
		return normalizeExecution(data);
	},
};
