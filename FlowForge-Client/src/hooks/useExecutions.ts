import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { executionsApi } from '@/lib/api/executions.api';
import { ACTIVE_STATUSES } from '@/types/execution.types';

export const executionQueryKeys = {
	all: ['executions'] as const,
	detail: (id: string) => ['executions', id] as const,
	events: (id: string) => ['executions', id, 'events'] as const,
	byWorkflow: (workflowId: string) => ['executions', 'workflow', workflowId] as const,
};

export function useExecutions() {
	return useQuery({
		queryKey: executionQueryKeys.all,
		queryFn: () => executionsApi.list(),
	});
}

export function useWorkflowExecutions(workflowId: string) {
	return useQuery({
		queryKey: executionQueryKeys.byWorkflow(workflowId),
		queryFn: async () => {
			const executions = await executionsApi.list();
			return executions.filter((execution) => execution.workflowId === workflowId);
		},
		enabled: Boolean(workflowId),
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

export function useExecutionEvents(id: string, isExecutionActive = false) {
	return useQuery({
		queryKey: executionQueryKeys.events(id),
		queryFn: () => executionsApi.getEvents(id),
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
			void queryClient.invalidateQueries({ queryKey: executionQueryKeys.byWorkflow(execution.workflowId) });
			void queryClient.invalidateQueries({ queryKey: executionQueryKeys.events(execution.id) });
		},
	});
}
