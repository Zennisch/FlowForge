'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { WorkflowBuilderEditor } from '@/components/workflow/builder/WorkflowBuilderEditor';
import { useUpdateWorkflow, useWorkflow } from '@/hooks/useWorkflows';
import type { CreateWorkflowRequest } from '@/types/workflow.types';

function getWorkflowId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const workflowId = getWorkflowId(params.id);

  const workflowQuery = useWorkflow(workflowId);
  const updateWorkflowMutation = useUpdateWorkflow();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleUpdateWorkflow = async (payload: CreateWorkflowRequest) => {
    await updateWorkflowMutation.mutateAsync({ id: workflowId, payload });
    setSaveMessage('Workflow updated successfully.');
  };

  return (
    <main className="h-full w-full p-3 sm:p-4">
      <section className="flex h-full min-h-0 flex-col rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-(--color-text-primary)">Workflow details</h1>
            <p className="text-sm text-(--color-text-secondary)">
              Edit workflow metadata, steps, and DAG edge configuration.
            </p>
          </div>
        </div>

        {workflowQuery.isPending ? (
          <div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6 text-sm text-(--color-text-secondary)">
            Loading workflow...
          </div>
        ) : null}

        {workflowQuery.isError ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{workflowQuery.error.message}</p>
            <button
              type="button"
              onClick={() => {
                void workflowQuery.refetch();
              }}
              className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!workflowQuery.isPending && !workflowQuery.isError && !workflowQuery.data ? (
          <div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6">
            <p className="text-sm text-(--color-text-secondary)">Workflow not found.</p>
            <Link
              href="/workflows"
              className="mt-3 inline-flex rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
            >
              Back to workflows
            </Link>
          </div>
        ) : null}

        {workflowQuery.data ? (
          <div className="mt-3 min-h-0 flex-1 space-y-3">
            {saveMessage ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {saveMessage}
              </p>
            ) : null}

            <WorkflowBuilderEditor
              mode="edit"
              initialWorkflow={workflowQuery.data}
              isPending={updateWorkflowMutation.isPending}
              submitError={
                updateWorkflowMutation.isError ? updateWorkflowMutation.error.message : undefined
              }
              onSubmit={async (payload) => {
                setSaveMessage(null);
                await handleUpdateWorkflow(payload);
              }}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
