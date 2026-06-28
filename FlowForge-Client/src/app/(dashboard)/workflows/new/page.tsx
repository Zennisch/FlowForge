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
    <main className="h-full w-full p-3 sm:p-4">
      <div className="flex h-full min-h-0 flex-col">
        {successMessage ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <span>{successMessage}</span>
            <Link
              href="/workflows"
              className="rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              Back to workflows
            </Link>
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
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
      </div>
    </main>
  );
}
