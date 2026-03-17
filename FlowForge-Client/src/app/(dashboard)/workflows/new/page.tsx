'use client';

import { useRouter } from 'next/navigation';

import { WorkflowForm } from '@/components/workflow/WorkflowForm';
import { useCreateWorkflow } from '@/hooks/useWorkflows';
import type { CreateWorkflowRequest } from '@/types/workflow.types';

export default function NewWorkflowPage() {
	const router = useRouter();
	const createWorkflowMutation = useCreateWorkflow();

	const handleCreateWorkflow = async (payload: CreateWorkflowRequest) => {
		const createdWorkflow = await createWorkflowMutation.mutateAsync(payload);
		router.replace(`/workflows/${createdWorkflow.id}`);
	};

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
			<section className="rounded-2xl border border-(--color-border) bg-white p-6">
				<h1 className="text-xl font-semibold text-(--color-text-primary)">Create workflow</h1>
				<p className="mt-2 text-sm text-(--color-text-secondary)">
					Define metadata, ordered steps, and DAG edges for your new workflow.
				</p>

				<div className="mt-6">
					<WorkflowForm
						mode="create"
						isPending={createWorkflowMutation.isPending}
						submitError={createWorkflowMutation.isError ? createWorkflowMutation.error.message : undefined}
						onSubmit={handleCreateWorkflow}
					/>
				</div>
			</section>
		</main>
	);
}


