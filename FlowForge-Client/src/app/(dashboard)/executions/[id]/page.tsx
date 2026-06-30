'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Clock,
  LockKeyhole,
  RefreshCw,
  Shield,
  TimerReset,
} from 'lucide-react';

import { ExecutionStatusBadge } from '@/components/execution/ExecutionStatusBadge';
import { ExecutionVisualTrace } from '@/components/execution/ExecutionVisualTrace';
import {
  ExecutionLevelEvents,
  StepExecutionTimeline,
} from '@/components/execution/StepExecutionTimeline';
import ZModal from '@/components/primary/ZModal';
import { cn } from '@/components/primary/utils';
import { WorkflowTriggerType } from '@/components/workflow/WorkflowTriggerType';
import {
  useCancelExecution,
  useExecution,
  useExecutionEvents,
  useExecutionLegalHold,
  useReleaseExecutionLegalHold,
  useSetExecutionLegalHold,
} from '@/hooks/useExecutions';
import { useWorkflow } from '@/hooks/useWorkflows';
import {
  ACTIVE_STATUSES,
  type Execution,
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

function compactId(value: string): string {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 6)}..${value.slice(-4)}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDateTimeParts(value?: string): { date: string; time: string; title?: string } {
  if (!value) {
    return { date: 'N/A', time: '-' };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: 'N/A', time: '-' };
  }

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return {
    date: isToday
      ? 'Today'
      : new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(date),
    time: new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
    title: formatDateTime(value),
  };
}

function formatDuration(startedAt?: string, completedAt?: string, status?: ExecutionStatus): string {
  if (!startedAt) {
    return 'N/A';
  }

  const startTime = new Date(startedAt).getTime();
  if (Number.isNaN(startTime)) {
    return 'N/A';
  }

  if (!completedAt) {
    return status === 'running' || status === 'pending' || status === 'compensating'
      ? 'Running'
      : 'N/A';
  }

  const endTime = new Date(completedAt).getTime();
  if (Number.isNaN(endTime) || endTime < startTime) {
    return 'N/A';
  }

  const elapsedSeconds = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function isCancellable(status: ExecutionStatus): boolean {
  return status === 'pending' || status === 'running';
}

function deriveStepExecutionsFromEvents(
  executionId: string,
  events: ExecutionEvent[]
): StepExecution[] {
  if (events.length === 0) {
    return [];
  }

  const steps = new Map<string, StepExecution>();

  for (const event of events) {
    if (!event.stepId) {
      continue;
    }

    const current = steps.get(event.stepId) ?? {
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
      const input = event.payload.input;
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        current.input = input as Record<string, unknown>;
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

function SummaryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
}) {
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface-base) px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
        <Icon className="h-3.5 w-3.5 text-(--color-primary)" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-(--color-text-primary)">{value}</div>
    </div>
  );
}

function ExecutionDateTime({ value }: { value?: string }) {
  const formatted = formatDateTimeParts(value);

  return (
    <div
      className="truncate text-sm font-semibold text-(--color-text-primary)"
      title={formatted.title}
    >
      {formatted.date} · {formatted.time}
    </div>
  );
}

function LegalHoldModal({
  isOpen,
  onClose,
  legalHold,
  isLoading,
  reason,
  message,
  isMutating,
  onReasonChange,
  onPlace,
  onRelease,
}: {
  isOpen: boolean;
  onClose: () => void;
  legalHold:
    | {
        active: boolean;
        reason: string | null;
        setByOwnerId: string | null;
        createdAt: string | null;
        releasedAt: string | null;
      }
    | undefined;
  isLoading: boolean;
  reason: string;
  message: string | null;
  isMutating: boolean;
  onReasonChange: (value: string) => void;
  onPlace: () => void;
  onRelease: () => void;
}) {
  return (
    <ZModal
      isOpen={isOpen}
      onClose={onClose}
      header="Legal hold"
      size="lg"
      bodyClassName="p-5"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onRelease}
            disabled={isMutating}
            className="inline-flex items-center gap-2 rounded-lg border border-(--color-border) px-3 py-2 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
          >
            Release hold
          </button>
          <button
            type="button"
            onClick={onPlace}
            disabled={isMutating}
            className="inline-flex items-center gap-2 rounded-lg border border-(--color-primary) bg-(--color-primary) px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Place hold
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-(--color-text-secondary)">
          Protect execution events from retention cleanup when an audit or investigation needs them.
        </p>
        <input
          type="text"
          value={reason}
          onChange={(event) => {
            onReasonChange(event.target.value);
          }}
          placeholder="Optional reason for legal hold"
          className="w-full rounded-lg border border-(--color-border) bg-(--color-surface-base) px-3 py-2 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none"
        />
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm">
          {isLoading ? (
            <p className="text-(--color-text-secondary)">Loading legal hold state...</p>
          ) : (
            <div className="grid gap-2 text-xs text-(--color-text-secondary) sm:grid-cols-2">
              <p>
                <span className="font-semibold text-(--color-text-primary)">State:</span>{' '}
                {legalHold?.active ? 'Enabled' : 'Disabled'}
              </p>
              <p>
                <span className="font-semibold text-(--color-text-primary)">Reason:</span>{' '}
                {legalHold?.reason?.trim() ? legalHold.reason : 'N/A'}
              </p>
              <p>
                <span className="font-semibold text-(--color-text-primary)">Set by:</span>{' '}
                {legalHold?.setByOwnerId ?? 'N/A'}
              </p>
              <p>
                <span className="font-semibold text-(--color-text-primary)">Created:</span>{' '}
                {formatDateTime(legalHold?.createdAt)}
              </p>
              <p>
                <span className="font-semibold text-(--color-text-primary)">Released:</span>{' '}
                {formatDateTime(legalHold?.releasedAt)}
              </p>
            </div>
          )}
        </div>
      </div>
    </ZModal>
  );
}

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const executionId = getExecutionId(params.id);
  const [legalHoldReason, setLegalHoldReason] = useState('');
  const [legalHoldMessage, setLegalHoldMessage] = useState<string | null>(null);
  const [isLegalHoldModalOpen, setIsLegalHoldModalOpen] = useState(false);
  const [eventsCursor, setEventsCursor] = useState<string | undefined>(undefined);
  const [eventsCursorStack, setEventsCursorStack] = useState<string[]>([]);
  const [selectedTraceStepId, setSelectedTraceStepId] = useState<string | null>(null);

  const executionQuery = useExecution(executionId);
  const execution = executionQuery.data;
  const workflowQuery = useWorkflow(execution?.workflowId ?? '');
  const legalHoldQuery = useExecutionLegalHold(executionId);
  const executionStatus = execution?.status;
  const isExecutionActive = Boolean(executionStatus && ACTIVE_STATUSES.includes(executionStatus));
  const eventsQueryInput = useMemo(
    () => ({
      limit: 200,
      cursor: eventsCursor,
    }),
    [eventsCursor]
  );
  const shouldPollEvents = isExecutionActive && !eventsCursor;
  const eventsQuery = useExecutionEvents(executionId, eventsQueryInput, shouldPollEvents);
  const cancelExecutionMutation = useCancelExecution();
  const setLegalHoldMutation = useSetExecutionLegalHold();
  const releaseLegalHoldMutation = useReleaseExecutionLegalHold();

  const legalHold = legalHoldQuery.data?.legalHold;
  const stepsFromExecution = execution?.stepExecutions ?? [];
  const events = eventsQuery.data?.items ?? [];
  const stepEvents = events.filter((event) => Boolean(event.stepId));
  const executionLevelEvents = events.filter((event) => !event.stepId);
  const eventsPageInfo = eventsQuery.data?.pageInfo;
  const stepsFromEvents = deriveStepExecutionsFromEvents(executionId, stepEvents);
  const stepExecutions = stepsFromExecution.length > 0 ? stepsFromExecution : stepsFromEvents;
  const isLegalHoldMutating = setLegalHoldMutation.isPending || releaseLegalHoldMutation.isPending;

  useEffect(() => {
    setEventsCursor(undefined);
    setEventsCursorStack([]);
    setSelectedTraceStepId(null);
  }, [executionId]);

  useEffect(() => {
    setLegalHoldReason(legalHold?.reason ?? '');
  }, [legalHold?.reason]);

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

  function goToNextEventsPage(): void {
    if (!eventsPageInfo?.nextCursor) {
      return;
    }

    setEventsCursorStack((previous) => [...previous, eventsPageInfo.cursor ?? '']);
    setEventsCursor(eventsPageInfo.nextCursor);
  }

  function goToPreviousEventsPage(): void {
    if (eventsCursorStack.length === 0) {
      return;
    }

    const previousCursor = eventsCursorStack[eventsCursorStack.length - 1] || undefined;
    setEventsCursorStack((previous) => previous.slice(0, previous.length - 1));
    setEventsCursor(previousCursor);
  }

  function jumpToLatestEventsPage(): void {
    setEventsCursor(undefined);
    setEventsCursorStack([]);
  }

  const workflowLabel = execution?.workflow?.name ?? compactId(execution?.workflowId ?? '');
  const duration = execution
    ? formatDuration(execution.startedAt, execution.completedAt, execution.status)
    : 'N/A';

  return (
    <main className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface-base) p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/executions"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border) text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
                  aria-label="Back to executions"
                  title="Back to executions"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="truncate text-xl font-semibold text-(--color-text-primary)">
                  {workflowLabel || 'Execution'}
                </h1>
                {execution ? <ExecutionStatusBadge status={execution.status} /> : null}
                {execution ? <WorkflowTriggerType triggerType={execution.triggerType} /> : null}
              </div>
              <p className="mt-1 text-sm text-(--color-text-secondary)">
                Execution {compactId(executionId)}
                {execution?.workflow?.description ? ` · ${execution.workflow.description}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLegalHoldMessage(null);
                  setIsLegalHoldModalOpen(true);
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  legalHold?.active
                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/20'
                    : 'border-(--color-border) text-(--color-text-secondary) hover:border-(--color-primary) hover:text-(--color-primary)'
                )}
              >
                {legalHold?.active ? (
                  <LockKeyhole className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {legalHold?.active ? 'Hold enabled' : 'Legal hold'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void executionQuery.refetch();
                  void legalHoldQuery.refetch();
                  void eventsQuery.refetch();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-(--color-primary) px-3 py-2 text-sm font-medium text-(--color-primary) transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/15"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              {execution && isCancellable(execution.status) ? (
                <button
                  type="button"
                  disabled={cancelExecutionMutation.isPending}
                  onClick={() => {
                    void cancelExecutionMutation.mutateAsync(execution.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-orange-500/40 dark:text-orange-200 dark:hover:bg-orange-500/15"
                >
                  <Ban className="h-4 w-4" />
                  {cancelExecutionMutation.isPending ? 'Cancelling...' : 'Cancel'}
                </button>
              ) : null}
            </div>
          </div>

          {execution ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryMetric label="Execution ID" value={compactId(execution.id)} icon={Shield} />
              <div className="rounded-xl border border-(--color-border) bg-(--color-surface-base) px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                  <Clock className="h-3.5 w-3.5 text-(--color-primary)" />
                  Started
                </div>
                <div className="mt-1 text-sm">
                  <ExecutionDateTime value={execution.startedAt} />
                </div>
              </div>
              <div className="rounded-xl border border-(--color-border) bg-(--color-surface-base) px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                  <Clock className="h-3.5 w-3.5 text-(--color-primary)" />
                  Completed
                </div>
                <div className="mt-1 text-sm">
                  <ExecutionDateTime value={execution.completedAt} />
                </div>
              </div>
              <SummaryMetric label="Duration" value={duration} icon={TimerReset} />
              <SummaryMetric
                label="Workflow"
                value={execution.workflow?.name ?? compactId(execution.workflowId)}
                icon={Shield}
              />
            </div>
          ) : null}
        </div>

        {executionQuery.isPending ? (
          <div className="rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6 text-sm text-(--color-text-secondary) dark:bg-blue-500/10">
            Loading execution details...
          </div>
        ) : null}

        {executionQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
            <p className="text-sm text-red-700 dark:text-red-200">{executionQuery.error.message}</p>
            <button
              type="button"
              onClick={() => {
                void executionQuery.refetch();
              }}
              className="mt-3 rounded-lg border border-red-200 bg-(--color-surface-base) px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/15"
            >
              Retry
            </button>
          </div>
        ) : null}

        {cancelExecutionMutation.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
            <p className="text-sm text-red-700 dark:text-red-200">{cancelExecutionMutation.error.message}</p>
          </div>
        ) : null}

        {setLegalHoldMutation.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
            <p className="text-sm text-red-700 dark:text-red-200">{setLegalHoldMutation.error.message}</p>
          </div>
        ) : null}

        {releaseLegalHoldMutation.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
            <p className="text-sm text-red-700 dark:text-red-200">{releaseLegalHoldMutation.error.message}</p>
          </div>
        ) : null}

        {legalHoldQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
            <p className="text-sm text-red-700 dark:text-red-200">{legalHoldQuery.error.message}</p>
          </div>
        ) : null}

        {execution ? (
          <section className="rounded-xl border border-(--color-border) bg-(--color-surface-base) p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-(--color-text-primary)">
                  Visual trace
                </h2>
                <p className="mt-1 text-xs text-(--color-text-secondary)">
                  Read-only workflow path with visited, failed, running, and skipped branches.
                </p>
              </div>
              {workflowQuery.isFetching ? (
                <span className="text-xs text-(--color-text-secondary)">Loading graph...</span>
              ) : null}
            </div>

            {workflowQuery.isError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
                <p className="text-sm text-red-700 dark:text-red-200">{workflowQuery.error.message}</p>
              </div>
            ) : (
              <div className="mb-5">
                <ExecutionVisualTrace
                  workflow={workflowQuery.data}
                  steps={stepExecutions}
                  selectedStepId={selectedTraceStepId}
                  onStepSelect={setSelectedTraceStepId}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-(--color-text-primary)">
                  Step timeline
                </h2>
                <p className="mt-1 text-xs text-(--color-text-secondary)">
                  {eventsQuery.isFetching ? 'Updating...' : 'Loaded'} {events.length} events
                  {eventsPageInfo?.hasNextPage ? ' · more available' : ''}
                  {shouldPollEvents ? ' · live polling' : ' · polling paused'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-(--color-text-secondary)">
                  Page size {eventsPageInfo?.limit ?? 200}
                </span>
                <button
                  type="button"
                  onClick={goToPreviousEventsPage}
                  disabled={eventsCursorStack.length === 0 || eventsQuery.isFetching}
                  className="inline-flex rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={goToNextEventsPage}
                  disabled={
                    !eventsPageInfo?.hasNextPage ||
                    !eventsPageInfo?.nextCursor ||
                    eventsQuery.isFetching
                  }
                  className="inline-flex rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={jumpToLatestEventsPage}
                  disabled={!eventsCursor && eventsCursorStack.length === 0}
                  className="inline-flex rounded-lg border border-(--color-primary) px-3 py-1.5 text-sm font-medium text-(--color-primary) transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-blue-500/15"
                >
                  Latest
                </button>
              </div>
            </div>

            {eventsQuery.isError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
                <p className="text-sm text-red-700 dark:text-red-200">{eventsQuery.error.message}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <StepExecutionTimeline
                  executionId={execution.id}
                  steps={stepExecutions}
                  events={stepEvents}
                  selectedStepId={selectedTraceStepId}
                  onSelectedStepChange={setSelectedTraceStepId}
                />
                <ExecutionLevelEvents events={executionLevelEvents} />
              </div>
            )}
          </section>
        ) : null}
      </div>

      <LegalHoldModal
        isOpen={isLegalHoldModalOpen}
        onClose={() => {
          setIsLegalHoldModalOpen(false);
        }}
        legalHold={legalHold}
        isLoading={legalHoldQuery.isPending}
        reason={legalHoldReason}
        message={legalHoldMessage}
        isMutating={isLegalHoldMutating}
        onReasonChange={setLegalHoldReason}
        onPlace={() => {
          void handlePlaceLegalHold();
        }}
        onRelease={() => {
          void handleReleaseLegalHold();
        }}
      />
    </main>
  );
}
