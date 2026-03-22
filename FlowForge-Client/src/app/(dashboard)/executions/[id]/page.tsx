'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { EventTimeline } from '@/components/execution/EventTimeline';
import { ExecutionStatusBadge } from '@/components/execution/ExecutionStatusBadge';
import { StepStatusTable } from '@/components/execution/StepStatusTable';
import {
	useCancelExecution,
	useExecution,
	useExecutionEvents,
	useExecutionLegalHold,
	useReleaseExecutionLegalHold,
	useSetExecutionLegalHold,
} from '@/hooks/useExecutions';
import {
	ACTIVE_STATUSES,
	type ExecutionEvent,
	type ExecutionStatus,
	type StepExecution,
} from '@/types/execution.types';

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

function getLegalHoldBadge(
	legalHoldState: { active: boolean } | undefined,
	isLoading: boolean,
): { label: string; className: string } {
	if (isLoading) {
		return {
			label: 'Legal hold: loading',
			className: 'border-(--color-border) bg-slate-100 text-(--color-text-secondary)',
		};
	}

	if (legalHoldState?.active) {
		return {
			label: 'Legal hold: enabled',
			className: 'border-amber-300 bg-amber-50 text-amber-800',
		};
	}

	return {
		label: 'Legal hold: disabled',
		className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
	};
}

function isCancellable(status: ExecutionStatus): boolean {
	return status === 'pending' || status === 'running';
}

function deriveStepExecutionsFromEvents(executionId: string, events: ExecutionEvent[]): StepExecution[] {
	if (events.length === 0) {
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
	const [legalHoldReason, setLegalHoldReason] = useState('');
	const [legalHoldMessage, setLegalHoldMessage] = useState<string | null>(null);

	const executionQuery = useExecution(executionId);
	const legalHoldQuery = useExecutionLegalHold(executionId);
	const executionStatus = executionQuery.data?.status;
	const isExecutionActive = Boolean(executionStatus && ACTIVE_STATUSES.includes(executionStatus));
	const eventsQuery = useExecutionEvents(executionId, { limit: 200 }, isExecutionActive);
	const cancelExecutionMutation = useCancelExecution();
	const setLegalHoldMutation = useSetExecutionLegalHold();
	const releaseLegalHoldMutation = useReleaseExecutionLegalHold();

	const execution = executionQuery.data;
	const legalHold = legalHoldQuery.data?.legalHold;
	const legalHoldBadge = getLegalHoldBadge(legalHold, legalHoldQuery.isPending);
	const stepsFromExecution = execution?.stepExecutions ?? [];
	const events = eventsQuery.data?.items ?? [];
	const stepsFromEvents = deriveStepExecutionsFromEvents(executionId, events);
	const stepExecutions = stepsFromExecution.length > 0 ? stepsFromExecution : stepsFromEvents;
	const isLegalHoldMutating = setLegalHoldMutation.isPending || releaseLegalHoldMutation.isPending;

	async function handlePlaceLegalHold(): Promise<void> {
		if (!executionId) {
			return;
		}

		const result = await setLegalHoldMutation.mutateAsync({
			id: executionId,
			reason: legalHoldReason,
		});

		setLegalHoldReason(result.legalHold.reason ?? '');
		setLegalHoldMessage('Legal hold has been enabled for this execution.');
	}

	async function handleReleaseLegalHold(): Promise<void> {
		if (!executionId) {
			return;
		}

		const result = await releaseLegalHoldMutation.mutateAsync(executionId);
		setLegalHoldReason(result.legalHold.reason ?? '');
		setLegalHoldMessage('Legal hold has been released for this execution.');
	}

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
			<section className="rounded-2xl border border-(--color-border) bg-white p-6 shadow-[0_16px_44px_-28px_rgba(37,99,235,0.55)]">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-2xl font-semibold text-(--color-text-primary)">Execution details</h1>
							<span
								className={[
									'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
									legalHoldBadge.className,
								].join(' ')}
							>
								{legalHoldBadge.label}
							</span>
						</div>
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

				{setLegalHoldMutation.isError ? (
					<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
						<p className="text-sm text-red-700">{setLegalHoldMutation.error.message}</p>
					</div>
				) : null}

				{releaseLegalHoldMutation.isError ? (
					<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
						<p className="text-sm text-red-700">{releaseLegalHoldMutation.error.message}</p>
					</div>
				) : null}

				{legalHoldQuery.isError ? (
					<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
						<p className="text-sm text-red-700">{legalHoldQuery.error.message}</p>
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
							<h2 className="text-lg font-semibold text-(--color-text-primary)">Compliance controls</h2>
							<p className="mt-1 text-sm text-(--color-text-secondary)">
								Apply or release legal hold to protect execution events from retention cleanup.
							</p>
							<div className="mt-3 rounded-xl border border-(--color-border) bg-slate-50/50 p-4">
								<div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
									<input
										type="text"
										value={legalHoldReason}
										onChange={(event) => {
											setLegalHoldReason(event.target.value);
										}}
										placeholder="Optional reason for legal hold"
										className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none"
									/>
									<button
										type="button"
										onClick={() => {
											void handlePlaceLegalHold();
										}}
										disabled={isLegalHoldMutating}
										className="inline-flex rounded-lg border border-(--color-primary) px-3 py-2 text-sm font-medium text-(--color-primary) transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
									>
										Place legal hold
									</button>
									<button
										type="button"
										onClick={() => {
											void handleReleaseLegalHold();
										}}
										disabled={isLegalHoldMutating}
										className="inline-flex rounded-lg border border-(--color-border) px-3 py-2 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
									>
										Release legal hold
									</button>
								</div>
								{legalHoldMessage ? (
									<p className="mt-2 text-sm text-emerald-700">{legalHoldMessage}</p>
								) : null}
								{legalHoldQuery.isPending ? (
									<p className="mt-1 text-xs text-(--color-text-secondary)">Loading legal hold state...</p>
								) : null}
								{legalHold ? (
									<div className="mt-2 space-y-1 text-xs text-(--color-text-secondary)">
										<p>Current legal hold state: {legalHold.active ? 'enabled' : 'disabled'}</p>
										<p>Reason: {legalHold.reason?.trim() ? legalHold.reason : 'N/A'}</p>
										<p>Set by owner: {legalHold.setByOwnerId ?? 'N/A'}</p>
										<p>Created at: {formatDateTime(legalHold.createdAt ?? undefined)}</p>
										<p>Released at: {formatDateTime(legalHold.releasedAt ?? undefined)}</p>
									</div>
								) : null}
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
								<div className="text-right">
									{eventsQuery.isFetching ? (
										<span className="text-xs text-(--color-text-secondary)">Updating...</span>
									) : null}
									<p className="text-xs text-(--color-text-secondary)">
										Loaded {events.length} events
										{eventsQuery.data?.pageInfo.hasNextPage ? ' (more available)' : ''}
									</p>
								</div>
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

