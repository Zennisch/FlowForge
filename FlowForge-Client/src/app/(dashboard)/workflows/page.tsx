'use client';

import { useMemo, useState } from 'react';
import { DatabaseZap } from 'lucide-react';

import { DeleteWorkflowModal } from '@/components/workflow/DeleteWorkflowModal';
import { TriggerExecutionPanel } from '@/components/workflow/TriggerExecutionPanel';
import {
  WorkflowListFilters,
  type WorkflowFilter,
} from '@/components/workflow/WorkflowListFilters';
import { WorkflowListTable } from '@/components/workflow/WorkflowListTable';
import { useDeleteWorkflow, useWorkflows } from '@/hooks/useWorkflows';
import type { Workflow } from '@/types/workflow.types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load workflows. Please try again.';
}

export default function WorkflowsPage() {
  const workflowsQuery = useWorkflows();
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

  return (
    <main className="mx-auto h-screen w-full px-3 py-3 sm:px-4 sm:py-4">
      <section className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {infoMessage ? (
          <div className="mb-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {infoMessage}
          </div>
        ) : null}

        <div className="min-h-0 flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-end rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <WorkflowListFilters
              value={statusFilter}
              onChange={setStatusFilter}
              label="Status"
              compact
            />
          </div>

          <div className="min-h-0 flex-1">
            {workflowsQuery.isPending ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
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
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
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
