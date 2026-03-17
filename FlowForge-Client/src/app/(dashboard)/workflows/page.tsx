'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DeleteWorkflowModal } from '@/components/workflow/DeleteWorkflowModal';
import { WorkflowCard } from '@/components/workflow/WorkflowCard';
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

	const deleteErrorMessage = useMemo(
		() =>
			deleteWorkflowMutation.isError
				? getErrorMessage(deleteWorkflowMutation.error)
				: undefined,
		[deleteWorkflowMutation.error, deleteWorkflowMutation.isError],
	);

	const handleDeleteClick = (workflow: Workflow) => {
		setSelectedWorkflow(workflow);
		deleteWorkflowMutation.reset();
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

	const workflows = workflowsQuery.data ?? [];

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
			<section className="rounded-2xl border border-(--color-border) bg-white p-5 shadow-[0_16px_44px_-28px_rgba(37,99,235,0.55)] sm:p-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-2xl font-semibold text-(--color-text-primary)">Workflow list</h1>
						<p className="mt-1 text-sm text-(--color-text-secondary)">
							Manage DAG workflows for your account and jump into each execution stream.
						</p>
					</div>

					<Link
						href="/workflows/new"
						className="inline-flex rounded-xl bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--color-primary-hover)"
					>
						Create workflow
					</Link>
				</div>

				{workflowsQuery.isPending ? (
					<div className="mt-8 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-8 text-center">
						<p className="text-sm text-(--color-text-secondary)">Loading workflows...</p>
					</div>
				) : null}

				{workflowsQuery.isError ? (
					<div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
						<p className="text-sm text-red-700">{getErrorMessage(workflowsQuery.error)}</p>
						<button
							type="button"
							onClick={() => {
								void workflowsQuery.refetch();
							}}
							className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
						>
							Retry
						</button>
					</div>
				) : null}

				{!workflowsQuery.isPending && !workflowsQuery.isError && workflows.length === 0 ? (
					<div className="mt-8 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-8 text-center">
						<p className="text-base font-medium text-(--color-text-primary)">No workflows yet</p>
						<p className="mt-2 text-sm text-(--color-text-secondary)">
							Create your first workflow to start running automation pipelines.
						</p>
						<Link
							href="/workflows/new"
							className="mt-4 inline-flex rounded-lg border border-(--color-primary) px-4 py-2 text-sm font-semibold text-(--color-primary) transition-colors hover:bg-blue-100"
						>
							Create now
						</Link>
					</div>
				) : null}

				{!workflowsQuery.isPending && !workflowsQuery.isError && workflows.length > 0 ? (
					<div className="mt-6 grid gap-4 lg:grid-cols-2">
						{workflows.map((workflow) => (
							<WorkflowCard
								key={workflow.id}
								workflow={workflow}
								onDelete={handleDeleteClick}
								isDeleting={
									deleteWorkflowMutation.isPending && selectedWorkflow?.id === workflow.id
								}
							/>
						))}
					</div>
				) : null}
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
		</main>
	);
}
