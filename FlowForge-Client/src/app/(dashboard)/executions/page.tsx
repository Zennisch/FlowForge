'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ExecutionStatusBadge } from '@/components/execution/ExecutionStatusBadge';
import { useCancelExecution, useExecutions } from '@/hooks/useExecutions';
import type { Execution, ExecutionStatus } from '@/types/execution.types';

const CANCELLABLE_STATUSES: ExecutionStatus[] = ['pending', 'running'];
const STATUS_FILTERS: Array<'all' | ExecutionStatus> = [
	'all',
	'pending',
	'running',
	'compensating',
	'completed',
	'failed',
	'cancelled',
];

function formatFilterLabel(status: 'all' | ExecutionStatus): string {
	if (status === 'all') {
		return 'All statuses';
	}

	if (status === 'compensating') {
		return 'Compensating';
	}

	return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(value?: string): string {
	if (!value) {
		return 'N/A';
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'N/A';
	}

	return new Intl.DateTimeFormat('vi-VN', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
}

function formatDuration(execution: Execution): string {
	if (!execution.startedAt || !execution.completedAt) {
		return '-';
	}

	const startedAt = new Date(execution.startedAt).getTime();
	const completedAt = new Date(execution.completedAt).getTime();
	if (Number.isNaN(startedAt) || Number.isNaN(completedAt) || completedAt < startedAt) {
		return '-';
	}

	const elapsedSeconds = Math.floor((completedAt - startedAt) / 1000);
	const minutes = Math.floor(elapsedSeconds / 60);
	const seconds = elapsedSeconds % 60;

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}

function isCancellable(status: ExecutionStatus): boolean {
	return CANCELLABLE_STATUSES.includes(status);
}

export default function ExecutionsPage() {
	const [statusFilter, setStatusFilter] = useState<'all' | ExecutionStatus>('all');

	const executionsQuery = useExecutions();
	const cancelExecutionMutation = useCancelExecution();

	const executions = executionsQuery.data ?? [];
	const filteredExecutions = useMemo(() => {
		if (statusFilter === 'all') {
			return executions;
		}

		return executions.filter((execution) => execution.status === statusFilter);
	}, [executions, statusFilter]);

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
			<section className="rounded-2xl border border-(--color-border) bg-white p-6 shadow-[0_16px_44px_-28px_rgba(37,99,235,0.55)]">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-2xl font-semibold text-(--color-text-primary)">Executions</h1>
						<p className="mt-1 text-sm text-(--color-text-secondary)">
							Track global execution runs and inspect real-time status across workflows.
						</p>
					</div>

					<button
						type="button"
						onClick={() => {
							void executionsQuery.refetch();
						}}
						className="inline-flex rounded-lg border border-(--color-primary) px-3 py-1.5 text-sm font-medium text-(--color-primary) transition-colors hover:bg-blue-50"
					>
						Refresh
					</button>
				</div>

				<div className="mt-5 flex flex-wrap items-center gap-2">
					{STATUS_FILTERS.map((status) => {
						const active = statusFilter === status;

						return (
							<button
								key={status}
								type="button"
								onClick={() => {
									setStatusFilter(status);
								}}
								className={[
									'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
									active
										? 'border-(--color-primary) bg-blue-100 text-(--color-primary)'
										: 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-primary)',
								].join(' ')}
							>
								{formatFilterLabel(status)}
							</button>
						);
					})}
				</div>

				{executionsQuery.isPending ? (
					<div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6 text-sm text-(--color-text-secondary)">
						Loading executions...
					</div>
				) : null}

				{executionsQuery.isError ? (
					<div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
						<p className="text-sm text-red-700">{executionsQuery.error.message}</p>
						<button
							type="button"
							onClick={() => {
								void executionsQuery.refetch();
							}}
							className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
						>
							Retry
						</button>
					</div>
				) : null}

				{cancelExecutionMutation.isError ? (
					<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
						<p className="text-sm text-red-700">{cancelExecutionMutation.error.message}</p>
					</div>
				) : null}

				{!executionsQuery.isPending && !executionsQuery.isError && filteredExecutions.length === 0 ? (
					<div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6 text-center">
						<p className="text-base font-medium text-(--color-text-primary)">No executions found</p>
						<p className="mt-2 text-sm text-(--color-text-secondary)">
							Try another filter or trigger a workflow to start collecting executions.
						</p>
					</div>
				) : null}

				{!executionsQuery.isPending && !executionsQuery.isError && filteredExecutions.length > 0 ? (
					<div className="mt-6 overflow-x-auto rounded-xl border border-(--color-border)">
						<table className="min-w-full divide-y divide-(--color-border)">
							<thead className="bg-blue-50/70">
								<tr>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
										Execution ID
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
										Workflow ID
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
										Status
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
										Trigger
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
										Started
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
										Completed
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
										Duration
									</th>
									<th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
										Actions
									</th>
								</tr>
							</thead>

							<tbody className="divide-y divide-(--color-border) bg-white">
								{filteredExecutions.map((execution) => (
									<tr key={execution.id}>
										<td className="px-4 py-3 text-sm font-medium text-(--color-text-primary)">
											{execution.id.slice(-8)}
										</td>
										<td className="px-4 py-3 text-sm text-(--color-text-secondary)">
											<Link
												href={`/workflows/${execution.workflowId}`}
												className="transition-colors hover:text-(--color-primary)"
											>
												{execution.workflowId.slice(-8)}
											</Link>
										</td>
										<td className="px-4 py-3 text-sm text-(--color-text-secondary)">
											<ExecutionStatusBadge status={execution.status} />
										</td>
										<td className="px-4 py-3 text-sm capitalize text-(--color-text-secondary)">
											{execution.triggerType}
										</td>
										<td className="px-4 py-3 text-sm text-(--color-text-secondary)">
											{formatDateTime(execution.startedAt)}
										</td>
										<td className="px-4 py-3 text-sm text-(--color-text-secondary)">
											{formatDateTime(execution.completedAt)}
										</td>
										<td className="px-4 py-3 text-sm text-(--color-text-secondary)">
											{formatDuration(execution)}
										</td>
										<td className="px-4 py-3 text-right">
											<div className="flex items-center justify-end gap-2">
												<Link
													href={`/executions/${execution.id}`}
													className="inline-flex rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
												>
													View
												</Link>

												{isCancellable(execution.status) ? (
													<button
														type="button"
														disabled={cancelExecutionMutation.isPending}
														onClick={() => {
															void cancelExecutionMutation.mutateAsync(execution.id);
														}}
														className="inline-flex rounded-lg border border-orange-200 px-3 py-1.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Cancel
													</button>
												) : null}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
			</section>
		</main>
	);
}

