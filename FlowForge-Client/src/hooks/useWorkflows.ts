import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { workflowsApi } from '@/lib/api/workflows.api';
import type {
  CreateWorkflowRequest,
  TriggerExecutionRequest,
  UpdateWorkflowRequest,
} from '@/types/workflow.types';

export const workflowQueryKeys = {
  all: ['workflows'] as const,
  detail: (id: string) => ['workflows', id] as const,
};

export function useWorkflows() {
  return useQuery({
    queryKey: workflowQueryKeys.all,
    queryFn: () => workflowsApi.list(),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: workflowQueryKeys.detail(id),
    queryFn: () => workflowsApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWorkflowRequest) => workflowsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workflowQueryKeys.all });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWorkflowRequest }) =>
      workflowsApi.update(id, payload),
    onSuccess: (workflow) => {
      queryClient.setQueryData(workflowQueryKeys.detail(workflow.id), workflow);
      void queryClient.invalidateQueries({ queryKey: workflowQueryKeys.all });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workflowsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workflowQueryKeys.all });
    },
  });
}

export function useTriggerWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }: { id: string; request?: TriggerExecutionRequest }) =>
      workflowsApi.trigger(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });
}
