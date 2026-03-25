'use client';

import Link from 'next/link';
import { useState } from 'react';

import { WorkflowBuilderEditor } from '@/components/workflow/builder/WorkflowBuilderEditor';
import { useCreateWorkflow } from '@/hooks/useWorkflows';
import type { CreateWorkflowRequest } from '@/types/workflow.types';

export default function NewWorkflowPage() {
  const createWorkflowMutation = useCreateWorkflow();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCreateWorkflow = async (payload: CreateWorkflowRequest) => {
    await createWorkflowMutation.mutateAsync(payload);
    setSuccessMessage('Workflow created successfully.');
  };

  return (
    <main className="w-full px-4 py-6 sm:px-6 sm:py-8">
      <section className="rounded-2xl border border-(--color-border) bg-white p-6">
        <div className='flex flex-row gap-2'>
          <h1 className="text-xl font-semibold text-(--color-text-primary)">Create workflow</h1>
          <p className="mt-2 text-sm text-(--color-text-secondary)">
            Build your workflow directly on canvas and configure nodes in the contextual inspector.
          </p>
        </div>

        {successMessage ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <span>{successMessage}</span>
            <Link
              href="/workflows"
              className="rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              Back to workflows
            </Link>
          </div>
        ) : null}

        <div className="mt-6">
          <WorkflowBuilderEditor
            mode="create"
            isPending={createWorkflowMutation.isPending}
            submitError={
              createWorkflowMutation.isError ? createWorkflowMutation.error.message : undefined
            }
            onSubmit={async (payload) => {
              setSuccessMessage(null);
              await handleCreateWorkflow(payload);
            }}
          />
        </div>
      </section>
    </main>
  );
}
