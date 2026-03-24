import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { executionsApi } from '@/lib/api/executions.api';
import {
  ACTIVE_STATUSES,
  type ExecutionEventsQuery,
  type ExecutionListQuery,
  type ExecutionSummaryQuery,
} from '@/types/execution.types';

export const executionQueryKeys = {
  all: ['executions'] as const,
  list: (query: ExecutionListQuery) => ['executions', 'list', query] as const,
  summary: (query: ExecutionSummaryQuery) => ['executions', 'summary', query] as const,
  detail: (id: string) => ['executions', id] as const,
  legalHold: (id: string) => ['executions', id, 'legal-hold'] as const,
  events: (id: string, query: ExecutionEventsQuery) => ['executions', id, 'events', query] as const,
};

interface QueryOptions {
  enabled?: boolean;
}

export function useExecutions(query: ExecutionListQuery = {}, options: QueryOptions = {}) {
  return useQuery({
    queryKey: executionQueryKeys.list(query),
    queryFn: () => executionsApi.list(query),
    enabled: options.enabled ?? true,
  });
}

export function useWorkflowExecutions(
  workflowId: string,
  options: Pick<
    ExecutionListQuery,
    'cursor' | 'limit' | 'status' | 'startedFrom' | 'startedTo'
  > = {}
) {
  const query: ExecutionListQuery = {
    workflowId,
    cursor: options.cursor,
    limit: options.limit,
    status: options.status,
    startedFrom: options.startedFrom,
    startedTo: options.startedTo,
  };

  return useQuery({
    queryKey: executionQueryKeys.list(query),
    queryFn: () => executionsApi.list(query),
    enabled: Boolean(workflowId),
  });
}

export function useExecutionSummary(query: ExecutionSummaryQuery = {}) {
  return useQuery({
    queryKey: executionQueryKeys.summary(query),
    queryFn: () => executionsApi.getSummary(query),
  });
}

export function useExecution(id: string) {
  return useQuery({
    queryKey: executionQueryKeys.detail(id),
    queryFn: () => executionsApi.get(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.includes(status) ? 3000 : false;
    },
  });
}

export function useExecutionLegalHold(id: string) {
  return useQuery({
    queryKey: executionQueryKeys.legalHold(id),
    queryFn: () => executionsApi.getLegalHold(id),
    enabled: Boolean(id),
  });
}

export function useExecutionEvents(
  id: string,
  query: ExecutionEventsQuery = {},
  isExecutionActive = false
) {
  return useQuery({
    queryKey: executionQueryKeys.events(id, query),
    queryFn: () => executionsApi.getEvents(id, query),
    enabled: Boolean(id),
    refetchInterval: isExecutionActive ? 3000 : false,
  });
}

export function useCancelExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => executionsApi.cancel(id),
    onSuccess: (execution) => {
      queryClient.setQueryData(executionQueryKeys.detail(execution.id), execution);
      void queryClient.invalidateQueries({ queryKey: executionQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['executions', execution.id, 'events'] });
    },
  });
}

export function useSetExecutionLegalHold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      executionsApi.setLegalHold(id, reason),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: executionQueryKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: executionQueryKeys.legalHold(variables.id) });
      void queryClient.invalidateQueries({ queryKey: ['executions', variables.id, 'events'] });
    },
  });
}

export function useReleaseExecutionLegalHold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => executionsApi.releaseLegalHold(id),
    onSuccess: (_, executionId) => {
      void queryClient.invalidateQueries({ queryKey: executionQueryKeys.detail(executionId) });
      void queryClient.invalidateQueries({ queryKey: executionQueryKeys.legalHold(executionId) });
      void queryClient.invalidateQueries({ queryKey: ['executions', executionId, 'events'] });
    },
  });
}
