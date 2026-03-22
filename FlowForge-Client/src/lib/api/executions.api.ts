import type {
  Execution,
  ExecutionEvent,
  ExecutionEventsQuery,
  ExecutionEventsResponse,
  ExecutionListQuery,
  ExecutionListResponse,
  ExecutionLegalHoldResponse,
  ExecutionLegalHoldState,
  ExecutionSummaryQuery,
  ExecutionSummaryResponse,
  ReleaseExecutionLegalHoldResponse,
  SetExecutionLegalHoldResponse,
  StepExecution,
  TriggerType,
} from '@/types/execution.types';

import { apiClient } from './client';

interface RawExecution {
  id?: string;
  _id?: string;
  workflow_id?: string;
  workflowId?: string;
  owner_id?: string;
  ownerId?: string;
  status: Execution['status'];
  trigger_type?: TriggerType;
  triggerType?: TriggerType;
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
  step_executions?: RawStepExecution[];
  stepExecutions?: RawStepExecution[];
}

interface RawStepExecution {
  id?: string;
  _id?: string;
  execution_id?: string;
  executionId?: string;
  step_id?: string;
  stepId?: string;
  status?: StepExecution['status'];
  attempt?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  error?: string | null;
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

interface RawPageInfo {
  limit: number;
  cursor: string | null;
  next_cursor: string | null;
  has_next_page: boolean;
}

interface RawExecutionListResponse {
  items: RawExecution[];
  page_info: RawPageInfo;
}

interface RawExecutionEventsResponse {
  items: RawExecutionEvent[];
  page_info: RawPageInfo;
}

interface RawExecutionSummaryResponse {
  counts: ExecutionSummaryResponse['counts'];
  total: number;
}

interface RawLegalHoldState {
  active?: boolean;
  reason?: string | null;
  set_by_owner_id?: string | null;
  created_at?: string | null;
  released_at?: string | null;
}

interface RawLegalHoldResponse {
  execution_id: string;
  legal_hold: RawLegalHoldState | boolean;
  reason?: string | null;
}

function normalizePageInfo(raw: RawPageInfo): ExecutionListResponse['pageInfo'] {
  return {
    limit: raw.limit,
    cursor: raw.cursor,
    nextCursor: raw.next_cursor,
    hasNextPage: raw.has_next_page,
  };
}

function buildExecutionListQueryParams(
  query: ExecutionListQuery
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};

  if (query.status?.length) {
    params.status = query.status.join(',');
  }

  if (query.workflowId) {
    params.workflow_id = query.workflowId;
  }

  if (query.triggerType?.length) {
    params.trigger_type = query.triggerType.join(',');
  }

  if (query.startedFrom) {
    params.started_from = query.startedFrom;
  }

  if (query.startedTo) {
    params.started_to = query.startedTo;
  }

  if (query.completedFrom) {
    params.completed_from = query.completedFrom;
  }

  if (query.completedTo) {
    params.completed_to = query.completedTo;
  }

  if (query.hasErrors !== undefined) {
    params.has_errors = query.hasErrors;
  }

  if (query.q) {
    params.q = query.q;
  }

  if (query.cursor) {
    params.cursor = query.cursor;
  }

  if (query.limit !== undefined) {
    params.limit = query.limit;
  }

  return params;
}

function buildExecutionSummaryQueryParams(query: ExecutionSummaryQuery): Record<string, string> {
  const params: Record<string, string> = {};

  if (query.workflowId) {
    params.workflow_id = query.workflowId;
  }

  if (query.startedFrom) {
    params.started_from = query.startedFrom;
  }

  if (query.startedTo) {
    params.started_to = query.startedTo;
  }

  return params;
}

function buildExecutionEventsQueryParams(
  query: ExecutionEventsQuery
): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  if (query.type?.length) {
    params.type = query.type.join(',');
  }

  if (query.stepId) {
    params.step_id = query.stepId;
  }

  if (query.occurredFrom) {
    params.occurred_from = query.occurredFrom;
  }

  if (query.occurredTo) {
    params.occurred_to = query.occurredTo;
  }

  if (query.cursor) {
    params.cursor = query.cursor;
  }

  if (query.limit !== undefined) {
    params.limit = query.limit;
  }

  return params;
}

function normalizeExecution(raw: RawExecution): Execution {
  const rawStepExecutions = raw.stepExecutions ?? raw.step_executions ?? [];

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
    stepExecutions: rawStepExecutions.map((stepExecution) =>
      normalizeStepExecution(stepExecution, raw.id ?? raw._id ?? '')
    ),
  };
}

function normalizeStepExecution(raw: RawStepExecution, fallbackExecutionId: string): StepExecution {
  return {
    id: raw.id ?? raw._id ?? '',
    executionId: raw.executionId ?? raw.execution_id ?? fallbackExecutionId,
    stepId: raw.stepId ?? raw.step_id ?? '',
    status: raw.status ?? 'queued',
    attempt: raw.attempt ?? 0,
    input: raw.input ?? {},
    output: raw.output ?? null,
    error: raw.error ?? null,
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

function normalizeLegalHoldState(raw: RawLegalHoldResponse): ExecutionLegalHoldState {
  if (typeof raw.legal_hold === 'boolean') {
    return {
      active: raw.legal_hold,
      reason: raw.reason ?? null,
      setByOwnerId: null,
      createdAt: null,
      releasedAt: null,
    };
  }

  return {
    active: Boolean(raw.legal_hold.active),
    reason: raw.legal_hold.reason ?? null,
    setByOwnerId: raw.legal_hold.set_by_owner_id ?? null,
    createdAt: raw.legal_hold.created_at ?? null,
    releasedAt: raw.legal_hold.released_at ?? null,
  };
}

function normalizeLegalHoldResponse(raw: RawLegalHoldResponse): ExecutionLegalHoldResponse {
  return {
    executionId: raw.execution_id,
    legalHold: normalizeLegalHoldState(raw),
  };
}

export const executionsApi = {
  async list(query: ExecutionListQuery = {}): Promise<ExecutionListResponse> {
    const params = buildExecutionListQueryParams(query);
    const { data } = await apiClient.get<RawExecution[] | RawExecutionListResponse>('/executions', {
      params,
    });

    if (Array.isArray(data)) {
      return {
        items: data.map(normalizeExecution),
        pageInfo: {
          limit: data.length,
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };
    }

    return {
      items: data.items.map(normalizeExecution),
      pageInfo: normalizePageInfo(data.page_info),
    };
  },

  async get(id: string): Promise<Execution> {
    const { data } = await apiClient.get<RawExecution>(`/executions/${id}`);
    return normalizeExecution(data);
  },

  async getEvents(id: string, query: ExecutionEventsQuery = {}): Promise<ExecutionEventsResponse> {
    const params = buildExecutionEventsQueryParams(query);
    const { data } = await apiClient.get<RawExecutionEvent[] | RawExecutionEventsResponse>(
      `/executions/${id}/events`,
      { params }
    );

    if (Array.isArray(data)) {
      return {
        items: data.map(normalizeExecutionEvent),
        pageInfo: {
          limit: data.length,
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };
    }

    return {
      items: data.items.map(normalizeExecutionEvent),
      pageInfo: normalizePageInfo(data.page_info),
    };
  },

  async getSummary(query: ExecutionSummaryQuery = {}): Promise<ExecutionSummaryResponse> {
    const params = buildExecutionSummaryQueryParams(query);
    const { data } = await apiClient.get<RawExecutionSummaryResponse>('/executions/summary', {
      params,
    });

    return {
      counts: data.counts,
      total: data.total,
    };
  },

  async cancel(id: string): Promise<Execution> {
    const { data } = await apiClient.post<RawExecution>(`/executions/${id}/cancel`);
    return normalizeExecution(data);
  },

  async getLegalHold(id: string): Promise<ExecutionLegalHoldResponse> {
    const { data } = await apiClient.get<RawLegalHoldResponse>(`/executions/${id}/legal-hold`);
    return normalizeLegalHoldResponse(data);
  },

  async setLegalHold(id: string, reason?: string): Promise<SetExecutionLegalHoldResponse> {
    const body = reason?.trim() ? { reason: reason.trim() } : {};
    const { data } = await apiClient.post<RawLegalHoldResponse>(
      `/executions/${id}/legal-hold`,
      body
    );
    return normalizeLegalHoldResponse(data);
  },

  async releaseLegalHold(id: string): Promise<ReleaseExecutionLegalHoldResponse> {
    const { data } = await apiClient.delete<RawLegalHoldResponse>(`/executions/${id}/legal-hold`);
    return normalizeLegalHoldResponse(data);
  },
};
