import type {
	CreateWorkflowRequest,
	TriggerExecutionRequest,
	UpdateWorkflowRequest,
	Workflow,
	WorkflowEdge,
	WorkflowStatus,
	WorkflowStep,
	WorkflowTrigger,
} from '@/types/workflow.types';

import { apiClient } from './client';

interface RawWorkflow {
	id?: string;
	_id?: string;
	owner_id?: string;
	ownerId?: string;
	name: string;
	description?: string;
	status?: WorkflowStatus;
	trigger?: WorkflowTrigger;
	steps?: WorkflowStep[];
	edges?: WorkflowEdge[];
	created_at?: string;
	createdAt?: string;
	updated_at?: string;
	updatedAt?: string;
}

interface RawTriggerResponse {
	executionId?: string;
	id?: string;
	_id?: string;
}

function normalizeWorkflow(raw: RawWorkflow): Workflow {
	return {
		id: raw.id ?? raw._id ?? '',
		ownerId: raw.ownerId ?? raw.owner_id ?? '',
		name: raw.name,
		description: raw.description,
		status: raw.status ?? 'active',
		trigger: raw.trigger ?? { type: 'manual', config: {} },
		steps: raw.steps ?? [],
		edges: raw.edges ?? [],
		createdAt: raw.createdAt ?? raw.created_at ?? '',
		updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
	};
}

export const workflowsApi = {
	async list(): Promise<Workflow[]> {
		const { data } = await apiClient.get<RawWorkflow[]>('/workflows');
		return data.map(normalizeWorkflow);
	},

	async get(id: string): Promise<Workflow> {
		const { data } = await apiClient.get<RawWorkflow>(`/workflows/${id}`);
		return normalizeWorkflow(data);
	},

	async create(payload: CreateWorkflowRequest): Promise<Workflow> {
		const { data } = await apiClient.post<RawWorkflow>('/workflows', payload);
		return normalizeWorkflow(data);
	},

	async update(id: string, payload: UpdateWorkflowRequest): Promise<Workflow> {
		const { data } = await apiClient.patch<RawWorkflow>(`/workflows/${id}`, payload);
		return normalizeWorkflow(data);
	},

	async remove(id: string): Promise<void> {
		await apiClient.delete(`/workflows/${id}`);
	},

	async trigger(id: string, request?: TriggerExecutionRequest): Promise<{ executionId?: string }> {
		const body: { payload?: Record<string, unknown>; idempotency_key?: string } = {};

		if (request?.payload) {
			body.payload = request.payload;
		}

		if (request?.idempotencyKey) {
			body.idempotency_key = request.idempotencyKey;
		}

		const { data } = await apiClient.post<RawTriggerResponse>(`/workflows/${id}/trigger`, body);

		return {
			executionId: data.executionId ?? data.id ?? data._id,
		};
	},
};

