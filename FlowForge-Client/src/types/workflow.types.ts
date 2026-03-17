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

