'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { EventTimeline } from '@/components/execution/EventTimeline';
import { ExecutionStatusBadge } from '@/components/execution/ExecutionStatusBadge';
import { StepStatusTable } from '@/components/execution/StepStatusTable';
import { useCancelExecution, useExecution, useExecutionEvents } from '@/hooks/useExecutions';
import { ACTIVE_STATUSES, type ExecutionStatus, type StepExecution } from '@/types/execution.types';

function getExecutionId(value: string | string[] | undefined): string {
	if (Array.isArray(value)) {
		return value[0] ?? '';
	}

	return value ?? '';
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

function isCancellable(status: ExecutionStatus): boolean {
	return status === 'pending' || status === 'running';
}

function deriveStepExecutionsFromEvents(executionId: string, events: ReturnType<typeof useExecutionEvents>['data']): StepExecution[] {
	if (!events || events.length === 0) {
		return [];
	}

	const steps = new Map<string, StepExecution>();

	for (const event of events) {
		if (!event.stepId) {
			continue;
		}

		const current =
			steps.get(event.stepId) ?? {
				id: event.stepId,
				executionId,
				stepId: event.stepId,
				status: 'queued',
				attempt: 0,
				input: {},
				output: null,
				error: null,
			};

		if (event.type === 'step.queued') {
			current.status = 'queued';
		}

		if (event.type === 'step.started') {
			current.status = 'running';
			current.startedAt = event.createdAt;
			const attempt = event.payload.attempt;
			if (typeof attempt === 'number') {
				current.attempt = attempt;
			}
		}

		if (event.type === 'step.completed') {
			current.status = 'completed';
			current.completedAt = event.createdAt;
			const output = event.payload.output;
			if (output && typeof output === 'object' && !Array.isArray(output)) {
				current.output = output as Record<string, unknown>;
			}
		}

		if (event.type === 'step.failed') {
			current.status = 'failed';
			current.completedAt = event.createdAt;
			const error = event.payload.error;
			if (typeof error === 'string') {
				current.error = error;
			}
			const attempt = event.payload.attempt;
			if (typeof attempt === 'number') {
				current.attempt = attempt;
			}
		}

		if (event.type === 'step.skipped') {
			current.status = 'skipped';
			current.completedAt = event.createdAt;
		}

		steps.set(event.stepId, current);
	}

	return Array.from(steps.values());
}

export default function ExecutionDetailPage() {
	const params = useParams<{ id: string | string[] }>();
	const executionId = getExecutionId(params.id);

	const executionQuery = useExecution(executionId);
	const executionStatus = executionQuery.data?.status;
	const isExecutionActive = Boolean(executionStatus && ACTIVE_STATUSES.includes(executionStatus));
	const eventsQuery = useExecutionEvents(executionId, isExecutionActive);
	const cancelExecutionMutation = useCancelExecution();

	const execution = executionQuery.data;
	const stepsFromExecution = execution?.stepExecutions ?? [];
	const stepsFromEvents = deriveStepExecutionsFromEvents(executionId, eventsQuery.data);
	const stepExecutions = stepsFromExecution.length > 0 ? stepsFromExecution : stepsFromEvents;
	const events = eventsQuery.data ?? [];

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
			<section className="rounded-2xl border border-(--color-border) bg-white p-6 shadow-[0_16px_44px_-28px_rgba(37,99,235,0.55)]">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-2xl font-semibold text-(--color-text-primary)">Execution details</h1>
						<p className="mt-1 text-sm text-(--color-text-secondary)">
							Detailed execution monitor with live polling and step-level state.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Link
							href="/executions"
							className="inline-flex rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
						>
							Back to executions
						</Link>

						<button
							type="button"
							onClick={() => {
								void executionQuery.refetch();
								void eventsQuery.refetch();
							}}
							className="inline-flex rounded-lg border border-(--color-primary) px-3 py-1.5 text-sm font-medium text-(--color-primary) transition-colors hover:bg-blue-50"
						>
							Refresh
						</button>

						{execution && isCancellable(execution.status) ? (
							<button
								type="button"
								disabled={cancelExecutionMutation.isPending}
								onClick={() => {
									void cancelExecutionMutation.mutateAsync(execution.id);
								}}
								className="inline-flex rounded-lg border border-orange-200 px-3 py-1.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{cancelExecutionMutation.isPending ? 'Cancelling...' : 'Cancel execution'}
							</button>
						) : null}
					</div>
				</div>

				{executionQuery.isPending ? (
					<div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6 text-sm text-(--color-text-secondary)">
						Loading execution details...
					</div>
				) : null}

				{executionQuery.isError ? (
					<div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
						<p className="text-sm text-red-700">{executionQuery.error.message}</p>
						<button
							type="button"
							onClick={() => {
								void executionQuery.refetch();
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

				{execution ? (
					<div className="mt-6 space-y-6">
						<div className="grid gap-3 rounded-xl border border-(--color-border) bg-blue-50/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
							<div>
								<p className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Execution ID</p>
								<p className="mt-1 text-sm font-semibold text-(--color-text-primary)">{execution.id}</p>
							</div>
							<div>
								<p className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Workflow ID</p>
								<p className="mt-1 text-sm font-semibold text-(--color-text-primary)">{execution.workflowId}</p>
							</div>
							<div>
								<p className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Status</p>
								<p className="mt-1"><ExecutionStatusBadge status={execution.status} /></p>
							</div>
							<div>
								<p className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Trigger</p>
								<p className="mt-1 text-sm font-semibold capitalize text-(--color-text-primary)">{execution.triggerType}</p>
							</div>
							<div>
								<p className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Started</p>
								<p className="mt-1 text-sm text-(--color-text-primary)">{formatDateTime(execution.startedAt)}</p>
							</div>
							<div>
								<p className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Completed</p>
								<p className="mt-1 text-sm text-(--color-text-primary)">{formatDateTime(execution.completedAt)}</p>
							</div>
							<div className="sm:col-span-2">
								<p className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Polling</p>
								<p className="mt-1 text-sm text-(--color-text-primary)">
									{isExecutionActive ? 'Active (every 3s)' : 'Stopped (terminal state)'}
								</p>
							</div>
						</div>

						<div>
							<h2 className="text-lg font-semibold text-(--color-text-primary)">Step status</h2>
							<p className="mt-1 text-sm text-(--color-text-secondary)">
								Current per-step state with attempt, input/output and error snapshots.
							</p>
							<div className="mt-3">
								<StepStatusTable steps={stepExecutions} />
							</div>
						</div>

						<div>
							<div className="flex items-center justify-between gap-2">
								<div>
									<h2 className="text-lg font-semibold text-(--color-text-primary)">Event timeline</h2>
									<p className="mt-1 text-sm text-(--color-text-secondary)">
										Immutable event stream for this execution.
									</p>
								</div>
								{eventsQuery.isFetching ? (
									<span className="text-xs text-(--color-text-secondary)">Updating...</span>
								) : null}
							</div>

							{eventsQuery.isError ? (
								<div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
									<p className="text-sm text-red-700">{eventsQuery.error.message}</p>
								</div>
							) : (
								<div className="mt-3">
									<EventTimeline events={events} />
								</div>
							)}
						</div>
					</div>
				) : null}
			</section>
		</main>
	);
}

