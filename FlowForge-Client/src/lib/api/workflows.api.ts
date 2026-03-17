import type {
	CreateWorkflowRequest,
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

	async trigger(id: string): Promise<{ executionId?: string; id?: string }> {
		const { data } = await apiClient.post<{ executionId?: string; id?: string }>(`/workflows/${id}/trigger`);
		return data;
	},
};

