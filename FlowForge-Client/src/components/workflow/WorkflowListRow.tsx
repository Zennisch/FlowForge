'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';

import ZButton from '@/components/primary/ZButton';
import { cn } from '@/components/primary/utils';
import { WorkflowContextMenu } from '@/components/workflow/WorkflowContextMenu';
import { WorkflowTriggerType } from '@/components/workflow/WorkflowTriggerType';
import { formatAbsoluteDateTime, formatRelativeTime } from '@/lib/utils/relative-time';
import type {
  Workflow,
  WorkflowInsightExecution,
  WorkflowInsightExecutionStatus,
  WorkflowInsightItem,
} from '@/types/workflow.types';

interface WorkflowListRowProps {
  workflow: Workflow;
  insight?: WorkflowInsightItem;
  onDelete: (workflow: Workflow) => void;
  onTrigger: (workflow: Workflow) => void;
  onCopyId: (workflowId: string) => Promise<void>;
}

function compactId(value: string): string {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 6)}..${value.slice(-4)}`;
}

function toDisplayWorkflowName(name: string): string {
  if (name !== name.toUpperCase()) {
    return name;
  }

  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 4 && /[a-z]/.test(word)) {
        return word.toUpperCase();
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

function getExecutionTime(execution: WorkflowInsightExecution): string | undefined {
  return execution.completedAt ?? execution.startedAt ?? execution.createdAt;
}

function getExecutionBadge(status: WorkflowInsightExecutionStatus): {
  label: string;
  className: string;
} {
  if (status === 'completed') {
    return { label: 'Success', className: 'bg-emerald-100 text-emerald-700' };
  }

  if (status === 'failed') {
    return { label: 'Failed', className: 'bg-red-100 text-red-700' };
  }

  if (status === 'running' || status === 'pending' || status === 'compensating') {
    return { label: 'Running', className: 'bg-blue-100 text-blue-700' };
  }

  return { label: 'Cancelled', className: 'bg-zinc-100 text-zinc-600' };
}

function getActivityColor(status: WorkflowInsightExecutionStatus): string {
  if (status === 'completed') {
    return 'bg-emerald-500';
  }

  if (status === 'failed') {
    return 'bg-red-500';
  }

  if (status === 'running' || status === 'pending' || status === 'compensating') {
    return 'bg-blue-500';
  }

  return 'bg-zinc-300';
}

function WorkflowActivitySparkline({ executions }: { executions: WorkflowInsightExecution[] }) {
  if (executions.length === 0) {
    return <span className="text-xs text-(--color-text-secondary)">No runs yet</span>;
  }

  const orderedExecutions = [...executions].reverse();

  return (
    <div className="flex h-8 items-end gap-1" title={`${executions.length} recent runs`}>
      {orderedExecutions.map((execution, index) => (
        <span
          key={`${execution.id}-${index}`}
          className={cn('w-1.5 rounded-t-sm', getActivityColor(execution.status))}
          style={{ height: `${12 + (index % 4) * 4}px` }}
          title={`${getExecutionBadge(execution.status).label}${
            getExecutionTime(execution) ? ` - ${formatRelativeTime(getExecutionTime(execution)!)}` : ''
          }`}
        />
      ))}
    </div>
  );
}

export function WorkflowListRow({
  workflow,
  insight,
  onDelete,
  onTrigger,
  onCopyId,
}: WorkflowListRowProps) {
  const isActive = workflow.status === 'active';
  const stepCount = workflow.steps.length;
  const edgeCount = workflow.edges.length;
  const workflowName = toDisplayWorkflowName(workflow.name);
  const lastExecution = insight?.lastExecution ?? null;
  const lastExecutionTime = lastExecution ? getExecutionTime(lastExecution) : undefined;
  const lastExecutionBadge = lastExecution ? getExecutionBadge(lastExecution.status) : null;

  return (
    <tr className="text-sm transition-colors hover:bg-(--color-surface-hover)">
      <td className="px-2 py-2 text-center align-middle">
        <ZButton
          iconOnly
          size="sm"
          variant="tertiary"
          onClick={() => {
            onTrigger(workflow);
          }}
          disabled={!isActive}
          title={isActive ? 'Trigger Workflow' : 'Workflow is inactive'}
          aria-label={isActive ? `Trigger ${workflow.name}` : `${workflow.name} is inactive`}
          className="h-7 w-7 rounded-full p-0"
          iconStart={<Play className="h-3 w-3" aria-hidden="true" />}
        />
      </td>

      <td className="px-2 py-2 text-left align-middle">
        <Link
          href={`/workflows/${workflow.id}`}
          className="block truncate font-semibold text-(--color-text-primary) transition-colors hover:text-(--color-primary)"
          title={workflowName}
        >
          {workflowName}
        </Link>
        <div
          className="mt-0.5 truncate text-xs text-(--color-text-secondary)"
          title={workflow.description ?? workflow.id}
        >
          {workflow.description?.trim() ? workflow.description : compactId(workflow.id)}
        </div>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-center align-middle">
        <WorkflowTriggerType triggerType={workflow.trigger.type} />
      </td>

      <td className="whitespace-nowrap px-2 py-2 align-middle">
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded-md bg-(--color-surface-muted) px-1.5 py-0.5 text-xs font-medium text-(--color-text-secondary)">
            {stepCount} steps
          </span>
          <span className="rounded-md bg-(--color-surface-muted) px-1.5 py-0.5 text-xs font-medium text-(--color-text-secondary)">
            {edgeCount} edges
          </span>
        </div>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-center align-middle">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
            isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-200/70 text-zinc-600'
          )}
        >
          <span
            className={cn(
              'inline-flex h-1.5 w-1.5 rounded-full',
              isActive ? 'bg-emerald-500' : 'bg-zinc-400'
            )}
          />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-left align-middle">
        {lastExecution && lastExecutionBadge ? (
          <div className="flex flex-col items-start gap-1">
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                lastExecutionBadge.className
              )}
            >
              {lastExecutionBadge.label}
            </span>
            <span
              className="text-xs text-(--color-text-secondary)"
              title={lastExecutionTime ? formatAbsoluteDateTime(lastExecutionTime) : undefined}
            >
              {lastExecutionTime ? formatRelativeTime(lastExecutionTime) : 'Unknown time'}
            </span>
          </div>
        ) : (
          <span className="text-xs text-(--color-text-secondary)">No runs yet</span>
        )}
      </td>

      <td className="px-2 py-2 text-left align-middle">
        <WorkflowActivitySparkline executions={insight?.recentExecutions ?? []} />
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-left align-middle text-xs text-(--color-text-secondary)">
        <div title={formatAbsoluteDateTime(workflow.updatedAt)}>
          {formatRelativeTime(workflow.updatedAt)}
        </div>
      </td>

      <td className="px-2 py-2 text-center align-middle">
        <WorkflowContextMenu workflow={workflow} onDelete={onDelete} onCopyId={onCopyId} />
      </td>
    </tr>
  );
}
