'use client';

import { useMemo, useState } from 'react';
import { Activity, CheckCircle2, DatabaseZap, PlayCircle, RefreshCw, XCircle } from 'lucide-react';

import { DeleteWorkflowModal } from '@/components/workflow/DeleteWorkflowModal';
import { TriggerExecutionPanel } from '@/components/workflow/TriggerExecutionPanel';
import {
  WorkflowListFilters,
  type WorkflowFilter,
} from '@/components/workflow/WorkflowListFilters';
import { WorkflowListTable } from '@/components/workflow/WorkflowListTable';
import { useDeleteWorkflow, useWorkflowInsights, useWorkflows } from '@/hooks/useWorkflows';
import type { Workflow } from '@/types/workflow.types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load workflows. Please try again.';
}

function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${Math.round(value * 100)}%`;
}

export default function WorkflowsPage() {
  const insightsWindow = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      startedFrom: yesterday.toISOString(),
      startedTo: now.toISOString(),
      historyLimit: 10,
    };
  }, []);
  const workflowsQuery = useWorkflows();
  const insightsQuery = useWorkflowInsights(insightsWindow);
  const deleteWorkflowMutation = useDeleteWorkflow();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [triggerWorkflow, setTriggerWorkflow] = useState<Workflow | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkflowFilter>('all');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const deleteErrorMessage = useMemo(
    () =>
      deleteWorkflowMutation.isError ? getErrorMessage(deleteWorkflowMutation.error) : undefined,
    [deleteWorkflowMutation.error, deleteWorkflowMutation.isError]
  );

  const handleDeleteClick = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    deleteWorkflowMutation.reset();
  };

  const handleCopyId = async (workflowId: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setInfoMessage('Clipboard is not available in this browser context.');
      return;
    }

    try {
      await navigator.clipboard.writeText(workflowId);
      setInfoMessage(`Copied ID: ${workflowId}`);
    } catch {
      setInfoMessage('Unable to copy workflow ID.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedWorkflow) {
      return;
    }

    try {
      await deleteWorkflowMutation.mutateAsync(selectedWorkflow.id);
      setSelectedWorkflow(null);
    } catch {
      // Error is surfaced through deleteWorkflowMutation.error.
    }
  };

  const filteredWorkflows = useMemo(() => {
    const workflows = workflowsQuery.data ?? [];
    if (statusFilter === 'all') {
      return workflows;
    }

    return workflows.filter((workflow) => workflow.status === statusFilter);
  }, [statusFilter, workflowsQuery.data]);

  const summary = insightsQuery.data?.summary;
  const statCards = useMemo(
    () => [
      {
        key: 'total',
        label: 'Total workflows',
        value: summary?.totalWorkflows ?? workflowsQuery.data?.length ?? 0,
        detail: `${summary?.activeWorkflows ?? 0} active / ${summary?.inactiveWorkflows ?? 0} inactive`,
        icon: DatabaseZap,
      },
      {
        key: 'executions',
        label: 'Executions 24h',
        value: summary?.executions ?? 0,
        detail: `${summary?.running ?? 0} running now`,
        icon: PlayCircle,
      },
      {
        key: 'success',
        label: 'Success rate',
        value: formatRate(summary?.successRate),
        detail: 'Completed terminal runs',
        icon: CheckCircle2,
      },
      {
        key: 'failure',
        label: 'Failure rate',
        value: formatRate(summary?.failureRate),
        detail: 'Failed terminal runs',
        icon: XCircle,
      },
    ],
    [summary, workflowsQuery.data?.length]
  );

  return (
    <main className="mx-auto w-full px-3 py-3 sm:px-4 sm:py-4">
      <section className="rounded-lg border border-(--color-border) bg-(--color-surface-base) p-3 shadow-sm">
        {infoMessage ? (
          <div className="mb-2 rounded-md border border-(--color-border) bg-(--color-surface-muted) px-2.5 py-1.5 text-[11px] text-(--color-text-secondary)">
            {infoMessage}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.key}
                className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-muted) px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                    {card.label}
                  </p>
                  <Icon className="h-4 w-4 text-(--color-primary)" aria-hidden="true" />
                </div>
                <p className="mt-1 text-2xl font-semibold text-(--color-text-primary)">
                  {card.value}
                </p>
                <p className="mt-0.5 truncate text-xs text-(--color-text-secondary)">
                  {card.detail}
                </p>
              </div>
            );
          })}
        </div>

        {insightsQuery.isError ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
            Workflow insights are unavailable. The list below is still current.
          </div>
        ) : null}

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-muted) px-2 py-2">
            <div className="flex items-center gap-2 text-xs text-(--color-text-secondary)">
              <Activity className="h-4 w-4 text-(--color-primary)" aria-hidden="true" />
              <span>{filteredWorkflows.length} workflows shown</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  void workflowsQuery.refetch();
                  void insightsQuery.refetch();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--color-border) bg-(--color-surface-base) px-2.5 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Refresh
              </button>
            <WorkflowListFilters
              value={statusFilter}
              onChange={setStatusFilter}
              label="Status"
              compact
            />
            </div>
          </div>

          <div>
            {workflowsQuery.isPending ? (
              <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-muted) p-4 text-center">
                <p className="text-sm text-(--color-text-secondary)">Loading workflows...</p>
              </div>
            ) : null}

            {workflowsQuery.isError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{getErrorMessage(workflowsQuery.error)}</p>
                <button
                  type="button"
                  onClick={() => {
                    void workflowsQuery.refetch();
                  }}
                  className="mt-2 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {!workflowsQuery.isPending &&
            !workflowsQuery.isError &&
            filteredWorkflows.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-muted) p-6 text-center">
                <div>
                  <DatabaseZap className="mx-auto h-5 w-5 text-zinc-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                    No workflow data
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Zero rows match current filter.
                  </p>
                </div>
              </div>
            ) : null}

            {!workflowsQuery.isPending &&
            !workflowsQuery.isError &&
            filteredWorkflows.length > 0 ? (
              <WorkflowListTable
                workflows={filteredWorkflows}
                insights={insightsQuery.data?.items}
                onDelete={handleDeleteClick}
                onTrigger={setTriggerWorkflow}
                onCopyId={handleCopyId}
              />
            ) : null}
          </div>
        </div>
      </section>

      <DeleteWorkflowModal
        open={Boolean(selectedWorkflow)}
        workflowName={selectedWorkflow?.name}
        isPending={deleteWorkflowMutation.isPending}
        errorMessage={deleteErrorMessage}
        onClose={() => {
          if (!deleteWorkflowMutation.isPending) {
            setSelectedWorkflow(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />

      <TriggerExecutionPanel
        open={Boolean(triggerWorkflow)}
        workflow={triggerWorkflow}
        onClose={() => {
          setTriggerWorkflow(null);
        }}
      />
    </main>
  );
}
