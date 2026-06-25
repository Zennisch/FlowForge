import type {
  CreateWorkflowRequest,
  TriggerExecutionRequest,
  UpdateWorkflowRequest,
  Workflow,
  WorkflowEdge,
  WorkflowInsightExecution,
  WorkflowInsightExecutionStatus,
  WorkflowInsightItem,
  WorkflowInsightsQuery,
  WorkflowInsightsResponse,
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

interface RawWorkflowInsightExecution {
  id?: string;
  _id?: string;
  status: WorkflowInsightExecutionStatus;
  started_at?: string;
  startedAt?: string;
  completed_at?: string;
  completedAt?: string;
  created_at?: string;
  createdAt?: string;
}

interface RawWorkflowInsightItem {
  workflow_id?: string;
  workflowId?: string;
  last_execution?: RawWorkflowInsightExecution | null;
  lastExecution?: RawWorkflowInsightExecution | null;
  recent_executions?: RawWorkflowInsightExecution[];
  recentExecutions?: RawWorkflowInsightExecution[];
  counts?: Record<WorkflowInsightExecutionStatus, number>;
}

interface RawWorkflowInsightsResponse {
  summary: {
    total_workflows?: number;
    totalWorkflows?: number;
    active_workflows?: number;
    activeWorkflows?: number;
    inactive_workflows?: number;
    inactiveWorkflows?: number;
    executions?: number;
    running?: number;
    success_rate?: number | null;
    successRate?: number | null;
    failure_rate?: number | null;
    failureRate?: number | null;
  };
  items: Record<string, RawWorkflowInsightItem>;
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

function buildWorkflowInsightsQueryParams(
  query: WorkflowInsightsQuery
): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  if (query.startedFrom) {
    params.started_from = query.startedFrom;
  }

  if (query.startedTo) {
    params.started_to = query.startedTo;
  }

  if (query.historyLimit !== undefined) {
    params.history_limit = query.historyLimit;
  }

  return params;
}

function normalizeInsightExecution(raw: RawWorkflowInsightExecution): WorkflowInsightExecution {
  return {
    id: raw.id ?? raw._id ?? '',
    status: raw.status,
    startedAt: raw.startedAt ?? raw.started_at,
    completedAt: raw.completedAt ?? raw.completed_at,
    createdAt: raw.createdAt ?? raw.created_at,
  };
}

function normalizeInsightItem(
  fallbackWorkflowId: string,
  raw: RawWorkflowInsightItem
): WorkflowInsightItem {
  const lastExecution = raw.lastExecution ?? raw.last_execution ?? null;
  const recentExecutions = raw.recentExecutions ?? raw.recent_executions ?? [];

  return {
    workflowId: raw.workflowId ?? raw.workflow_id ?? fallbackWorkflowId,
    lastExecution: lastExecution ? normalizeInsightExecution(lastExecution) : null,
    recentExecutions: recentExecutions.map(normalizeInsightExecution),
    counts: {
      pending: raw.counts?.pending ?? 0,
      running: raw.counts?.running ?? 0,
      completed: raw.counts?.completed ?? 0,
      failed: raw.counts?.failed ?? 0,
      cancelled: raw.counts?.cancelled ?? 0,
      compensating: raw.counts?.compensating ?? 0,
    },
  };
}

function normalizeWorkflowInsights(raw: RawWorkflowInsightsResponse): WorkflowInsightsResponse {
  return {
    summary: {
      totalWorkflows: raw.summary.totalWorkflows ?? raw.summary.total_workflows ?? 0,
      activeWorkflows: raw.summary.activeWorkflows ?? raw.summary.active_workflows ?? 0,
      inactiveWorkflows: raw.summary.inactiveWorkflows ?? raw.summary.inactive_workflows ?? 0,
      executions: raw.summary.executions ?? 0,
      running: raw.summary.running ?? 0,
      successRate: raw.summary.successRate ?? raw.summary.success_rate ?? null,
      failureRate: raw.summary.failureRate ?? raw.summary.failure_rate ?? null,
    },
    items: Object.fromEntries(
      Object.entries(raw.items ?? {}).map(([workflowId, item]) => [
        workflowId,
        normalizeInsightItem(workflowId, item),
      ])
    ),
  };
}

export const workflowsApi = {
  async list(): Promise<Workflow[]> {
    const { data } = await apiClient.get<RawWorkflow[]>('/workflows');
    return data.map(normalizeWorkflow);
  },

  async getInsights(query: WorkflowInsightsQuery = {}): Promise<WorkflowInsightsResponse> {
    const params = buildWorkflowInsightsQueryParams(query);
    const { data } = await apiClient.get<RawWorkflowInsightsResponse>('/workflows/insights', {
      params,
    });
    return normalizeWorkflowInsights(data);
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
