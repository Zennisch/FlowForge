'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  TimerReset,
  XCircle,
} from 'lucide-react';

import { ExecutionStatusBadge } from '@/components/execution/ExecutionStatusBadge';
import { cn } from '@/components/primary/utils';
import { WorkflowTriggerType } from '@/components/workflow/WorkflowTriggerType';
import { useRefreshFeedback } from '@/hooks/useRefreshFeedback';
import { useCancelExecution, useExecutionSummary, useExecutions } from '@/hooks/useExecutions';
import type { Execution, ExecutionStatus } from '@/types/execution.types';

const CANCELLABLE_STATUSES: ExecutionStatus[] = ['pending', 'running'];
const PAGE_LIMIT = 20;
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

function compactId(value: string): string {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 6)}..${value.slice(-4)}`;
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
    title: new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(date),
  };
}

function formatDuration(execution: Execution): string | null {
  if (!execution.startedAt || !execution.completedAt) {
    return null;
  }

  const startedAt = new Date(execution.startedAt).getTime();
  const completedAt = new Date(execution.completedAt).getTime();
  if (Number.isNaN(startedAt) || Number.isNaN(completedAt) || completedAt < startedAt) {
    return null;
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

function ExecutionDateTime({ value }: { value?: string }) {
  const formatted = formatDateTimeParts(value);

  return (
    <div className="leading-tight" title={formatted.title}>
      <div className="font-medium text-(--color-text-primary)">{formatted.date}</div>
      <div className="mt-1 text-xs text-(--color-text-secondary)">{formatted.time}</div>
    </div>
  );
}

export default function ExecutionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copiedExecutionId, setCopiedExecutionId] = useState<string | null>(null);
  const initialFilter = searchParams.get('status');
  const initialStatus =
    initialFilter && STATUS_FILTERS.includes(initialFilter as 'all' | ExecutionStatus)
      ? (initialFilter as 'all' | ExecutionStatus)
      : 'all';
  const [statusFilter, setStatusFilter] = useState<'all' | ExecutionStatus>(initialStatus);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const executionListQueryInput = useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : [statusFilter],
      cursor,
      limit: PAGE_LIMIT,
    }),
    [statusFilter, cursor]
  );

  const executionsQuery = useExecutions(executionListQueryInput);
  const summaryQuery = useExecutionSummary();
  const cancelExecutionMutation = useCancelExecution();
  const handleRefresh = useCallback(
    () => Promise.allSettled([executionsQuery.refetch(), summaryQuery.refetch()]),
    [executionsQuery, summaryQuery]
  );
  const { isRefreshing, hasRefreshCompleted, runRefresh } = useRefreshFeedback(handleRefresh);

  const executions = executionsQuery.data?.items ?? [];
  const pageInfo = executionsQuery.data?.pageInfo;
  const summary = summaryQuery.data;
  const hasRowActions = executions.some((execution) => isCancellable(execution.status));

  const summaryCards = useMemo(
    () => [
      {
        key: 'total',
        label: 'Total',
        value: summary?.total ?? 0,
        icon: Activity,
        className: 'border-(--color-border) bg-(--color-surface-base) text-(--color-primary)',
        valueClassName: 'text-(--color-text-primary)',
      },
      {
        key: 'failed',
        label: 'Failed',
        value: summary?.counts.failed ?? 0,
        icon: XCircle,
        className:
          'border-red-200 bg-red-50/70 text-red-600 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-200',
        valueClassName: 'text-red-700 dark:text-red-100',
      },
      {
        key: 'running',
        label: 'Running',
        value: summary?.counts.running ?? 0,
        icon: Loader2,
        className:
          'border-blue-200 bg-blue-50/70 text-blue-600 dark:border-blue-500/35 dark:bg-blue-500/10 dark:text-blue-200',
        valueClassName: 'text-blue-700 dark:text-blue-100',
      },
      {
        key: 'completed',
        label: 'Completed',
        value: summary?.counts.completed ?? 0,
        icon: CheckCircle2,
        className:
          'border-emerald-200 bg-emerald-50/70 text-emerald-600 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200',
        valueClassName: 'text-emerald-700 dark:text-emerald-100',
      },
      {
        key: 'pending',
        label: 'Pending',
        value: summary?.counts.pending ?? 0,
        icon: TimerReset,
        className:
          'border-slate-200 bg-slate-50/80 text-slate-500 dark:border-slate-500/35 dark:bg-slate-500/10 dark:text-slate-200',
        valueClassName: 'text-slate-700 dark:text-slate-100',
      },
      {
        key: 'compensating',
        label: 'Compensating',
        value: summary?.counts.compensating ?? 0,
        icon: RotateCcw,
        className:
          'border-amber-200 bg-amber-50/70 text-amber-600 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200',
        valueClassName: 'text-amber-700 dark:text-amber-100',
      },
      {
        key: 'cancelled',
        label: 'Cancelled',
        value: summary?.counts.cancelled ?? 0,
        icon: Ban,
        className:
          'border-orange-200 bg-orange-50/70 text-orange-600 dark:border-orange-500/35 dark:bg-orange-500/10 dark:text-orange-200',
        valueClassName: 'text-orange-700 dark:text-orange-100',
      },
    ],
    [summary]
  );

  function onChangeStatus(nextStatus: 'all' | ExecutionStatus): void {
    setStatusFilter(nextStatus);
    setCursor(undefined);
    setCursorStack([]);
  }

  function goToNextPage(): void {
    if (!pageInfo?.nextCursor) {
      return;
    }

    setCursorStack((previous) => [...previous, pageInfo.cursor ?? '']);
    setCursor(pageInfo.nextCursor);
  }

  function goToPreviousPage(): void {
    if (cursorStack.length === 0) {
      return;
    }

    const previousCursor = cursorStack[cursorStack.length - 1] || undefined;
    setCursorStack((previous) => previous.slice(0, previous.length - 1));
    setCursor(previousCursor);
  }

  async function copyExecutionId(executionId: string): Promise<void> {
    await navigator.clipboard.writeText(executionId);
    setCopiedExecutionId(executionId);
    window.setTimeout(() => {
      setCopiedExecutionId((current) => (current === executionId ? null : current));
    }, 1200);
  }

  return (
    <main className="mx-auto w-full px-3 py-3 sm:px-4 sm:py-4">
      <section className="rounded-lg border border-(--color-border) bg-(--color-surface-base) p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {summaryCards.map((card) => (
            <div
              key={card.key}
              className={cn('rounded-lg border p-3', card.className)}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                  {card.label}
                </p>
                <card.icon
                  className={cn(
                    'h-4 w-4',
                    card.key === 'running' && card.value > 0 ? 'animate-spin' : ''
                  )}
                  aria-hidden="true"
                />
              </div>
              <p className={cn('mt-2 text-2xl font-semibold', card.valueClassName)}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-muted) px-2 py-2">
          <div className="flex items-center gap-2 text-xs text-(--color-text-secondary)">
            <Activity className="h-4 w-4 text-(--color-primary)" aria-hidden="true" />
            <span>{executions.length} executions shown</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                void runRefresh();
              }}
              disabled={isRefreshing}
              aria-live="polite"
              className="inline-flex h-8 min-w-[6.75rem] items-center gap-1.5 rounded-md border border-(--color-border) bg-(--color-surface-base) px-2.5 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', isRefreshing ? 'animate-spin' : '')}
                aria-hidden="true"
              />
              {isRefreshing ? 'Refreshing...' : hasRefreshCompleted ? 'Updated' : 'Refresh'}
            </button>

            {STATUS_FILTERS.map((status) => {
              const active = statusFilter === status;

              return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  onChangeStatus(status);
                }}
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'border-(--color-primary) bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-100'
                    : 'border-(--color-border) bg-(--color-surface-base) text-(--color-text-secondary) hover:border-(--color-primary) hover:text-(--color-primary)',
                ].join(' ')}
              >
                {formatFilterLabel(status)}
              </button>
              );
            })}
          </div>
        </div>

        {executionsQuery.isPending ? (
          <div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6 text-sm text-(--color-text-secondary) dark:bg-blue-500/10">
            Loading executions...
          </div>
        ) : null}

        {executionsQuery.isError ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
            <p className="text-sm text-red-700 dark:text-red-200">{executionsQuery.error.message}</p>
            <button
              type="button"
              onClick={() => {
                void executionsQuery.refetch();
              }}
              className="mt-3 rounded-lg border border-red-200 bg-(--color-surface-base) px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/15"
            >
              Retry
            </button>
          </div>
        ) : null}

        {cancelExecutionMutation.isError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
            <p className="text-sm text-red-700 dark:text-red-200">{cancelExecutionMutation.error.message}</p>
          </div>
        ) : null}

        {!executionsQuery.isPending && !executionsQuery.isError && executions.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6 text-center dark:bg-blue-500/10">
            <p className="text-base font-medium text-(--color-text-primary)">No executions found</p>
            <p className="mt-2 text-sm text-(--color-text-secondary)">
              Try another filter or trigger a workflow to start collecting executions.
            </p>
          </div>
        ) : null}

        {!executionsQuery.isPending && !executionsQuery.isError && executions.length > 0 ? (
          <div className="mt-5 rounded-lg border border-(--color-border) bg-(--color-surface-base) shadow-sm">
            <div className="max-h-[calc(100vh-23rem)] overflow-auto">
              <table className="w-full min-w-[1120px] table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: hasRowActions ? '16%' : '17%' }} />
                  <col style={{ width: hasRowActions ? '20%' : '22%' }} />
                  <col style={{ width: hasRowActions ? '11%' : '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: hasRowActions ? '14%' : '15%' }} />
                  <col style={{ width: hasRowActions ? '14%' : '15%' }} />
                  <col style={{ width: hasRowActions ? '9%' : '9%' }} />
                  {hasRowActions ? <col style={{ width: '6%' }} /> : null}
                </colgroup>
                <thead className="sticky top-0 z-20 border-b border-(--color-border) bg-(--color-surface-muted)">
                  <tr>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                      Execution ID
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                      Workflow
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                      Status
                    </th>
                    <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                      Trigger
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                      Started
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                      Completed
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                      Duration
                    </th>
                    {hasRowActions ? (
                      <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                        Actions
                      </th>
                    ) : null}
                  </tr>
                </thead>

                <tbody className="divide-y divide-(--color-border-subtle) bg-(--color-surface-base)">
                  {executions.map((execution) => {
                    const duration = formatDuration(execution);
                    const isCopied = copiedExecutionId === execution.id;
                    const workflowName =
                      execution.workflow?.name ?? compactId(execution.workflowId);
                    const workflowSubtext =
                      execution.workflow?.description?.trim() || compactId(execution.workflowId);

                    return (
                      <tr
                        key={execution.id}
                        tabIndex={0}
                        onClick={() => {
                          router.push(`/executions/${execution.id}`);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            router.push(`/executions/${execution.id}`);
                          }
                        }}
                        className="cursor-pointer text-sm transition-colors hover:bg-(--color-surface-hover) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--color-primary)"
                      >
                        <td className="px-2 py-2 align-middle">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono text-sm font-semibold text-(--color-text-primary)"
                              title={execution.id}
                            >
                              {compactId(execution.id)}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void copyExecutionId(execution.id);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--color-text-secondary) transition-colors hover:bg-(--color-surface-muted) hover:text-(--color-primary)"
                              title="Copy execution ID"
                              aria-label={`Copy execution ID ${execution.id}`}
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <Link
                            href={`/workflows/${execution.workflowId}`}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            className="block truncate font-semibold text-(--color-text-primary) transition-colors hover:text-(--color-primary)"
                            title={workflowName}
                          >
                            {workflowName}
                          </Link>
                          <div
                            className="mt-0.5 truncate text-xs text-(--color-text-secondary)"
                            title={workflowSubtext}
                          >
                            {workflowSubtext}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <ExecutionStatusBadge status={execution.status} />
                        </td>
                        <td className="px-2 py-2 text-center align-middle">
                          <WorkflowTriggerType triggerType={execution.triggerType} />
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <ExecutionDateTime value={execution.startedAt} />
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <ExecutionDateTime value={execution.completedAt} />
                        </td>
                        <td className="px-2 py-2 align-middle text-sm text-(--color-text-secondary)">
                          {duration ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-(--color-text-secondary)" />
                              {duration}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        {hasRowActions ? (
                          <td className="px-2 py-2 text-center align-middle">
                            {isCancellable(execution.status) ? (
                              <button
                                type="button"
                                disabled={cancelExecutionMutation.isPending}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void cancelExecutionMutation.mutateAsync(execution.id);
                                }}
                                className="inline-flex rounded-md border border-orange-200 px-2 py-1 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-orange-500/40 dark:text-orange-200 dark:hover:bg-orange-500/15"
                              >
                                Cancel
                              </button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {!executionsQuery.isPending && !executionsQuery.isError ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-(--color-text-secondary)">
              Page size: {pageInfo?.limit ?? PAGE_LIMIT}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={cursorStack.length === 0 || executionsQuery.isFetching}
                className="inline-flex rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goToNextPage}
                disabled={
                  !pageInfo?.hasNextPage || !pageInfo?.nextCursor || executionsQuery.isFetching
                }
                className="inline-flex rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
