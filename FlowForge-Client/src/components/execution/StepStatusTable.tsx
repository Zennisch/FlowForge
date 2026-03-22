import type { StepExecution, StepStatus } from '@/types/execution.types';

interface StepStatusTableProps {
  steps: StepExecution[];
}

const STEP_STATUS_STYLES: Record<StepStatus, string> = {
  queued: 'bg-slate-100 text-slate-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-zinc-100 text-zinc-700',
};

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

function formatValue(value: Record<string, unknown> | null): string {
  if (!value) {
    return '-';
  }

  const keys = Object.keys(value);
  if (keys.length === 0) {
    return '{}';
  }

  return JSON.stringify(value);
}

export function StepStatusTable({ steps }: StepStatusTableProps) {
  if (steps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-5 text-sm text-(--color-text-secondary)">
        No step execution data available yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-(--color-border)">
      <table className="min-w-full divide-y divide-(--color-border)">
        <thead className="bg-blue-50/70">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Step
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Attempt
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Input
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Output
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Error
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Started
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Completed
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-(--color-border) bg-white">
          {steps.map((step) => (
            <tr key={step.id || step.stepId}>
              <td className="px-4 py-3 text-sm font-medium text-(--color-text-primary)">
                {step.stepId}
              </td>
              <td className="px-4 py-3 text-sm text-(--color-text-secondary)">
                <span
                  className={[
                    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                    STEP_STATUS_STYLES[step.status],
                  ].join(' ')}
                >
                  {step.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-(--color-text-secondary)">{step.attempt}</td>
              <td className="max-w-[16rem] truncate px-4 py-3 text-sm text-(--color-text-secondary)">
                {formatValue(step.input)}
              </td>
              <td className="max-w-[16rem] truncate px-4 py-3 text-sm text-(--color-text-secondary)">
                {formatValue(step.output)}
              </td>
              <td className="px-4 py-3 text-sm text-red-700">{step.error ?? '-'}</td>
              <td className="px-4 py-3 text-sm text-(--color-text-secondary)">
                {formatDateTime(step.startedAt)}
              </td>
              <td className="px-4 py-3 text-sm text-(--color-text-secondary)">
                {formatDateTime(step.completedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
