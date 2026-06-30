'use client';

import Link from 'next/link';
import { useState } from 'react';

import ZButton from '@/components/primary/ZButton';
import ZModal from '@/components/primary/ZModal';
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
        <ZModal
          isOpen={Boolean(successMessage)}
          onClose={() => {
            setSuccessMessage(null);
          }}
          header="Workflow saved"
          size="sm"
          footer={
            <>
              <ZButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSuccessMessage(null);
                }}
              >
                Close
              </ZButton>
              <ZButton as={Link} href="/workflows" size="sm">
                Back to workflows
              </ZButton>
            </>
          }
        >
          <p className="text-sm text-(--color-text-secondary)">{successMessage}</p>
        </ZModal>

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
