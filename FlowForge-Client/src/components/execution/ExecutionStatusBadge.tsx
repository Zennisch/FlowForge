import type { ExecutionStatus } from '@/types/execution.types';

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
}

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  running: 'bg-blue-100 text-blue-700',
  compensating: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-orange-100 text-orange-700',
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
