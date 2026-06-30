import type { ExecutionStatus } from '@/types/execution.types';

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
}

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
  compensating: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200',
  cancelled: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200',
};

function formatStatus(status: ExecutionStatus): string {
  if (status === 'compensating') {
    return 'Compensating';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ExecutionStatusBadge({ status }: ExecutionStatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        STATUS_STYLES[status],
      ].join(' ')}
    >
      {formatStatus(status)}
    </span>
  );
}
