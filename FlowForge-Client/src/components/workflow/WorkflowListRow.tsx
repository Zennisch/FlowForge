'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';

import ZButton from '@/components/primary/ZButton';
import { cn } from '@/components/primary/utils';
import { WorkflowContextMenu } from '@/components/workflow/WorkflowContextMenu';
import { WorkflowTriggerType } from '@/components/workflow/WorkflowTriggerType';
import { formatAbsoluteDateTime, formatRelativeTime } from '@/lib/utils/relative-time';
import type { Workflow } from '@/types/workflow.types';

interface WorkflowListRowProps {
  workflow: Workflow;
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

export function WorkflowListRow({ workflow, onDelete, onTrigger, onCopyId }: WorkflowListRowProps) {
  const isActive = workflow.status === 'active';
  const stepCount = workflow.steps.length;
  const edgeCount = workflow.edges.length;
  const workflowName = toDisplayWorkflowName(workflow.name);

  return (
    <tr className="border-t border-zinc-200/70 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
      <td className="px-2 py-2 text-center align-middle sm:px-2.5">
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

      <td className="px-2 py-2 text-left align-middle font-mono text-xs text-zinc-600 sm:px-2.5 dark:text-zinc-300">
        <div className="truncate" title={workflow.id}>
          {compactId(workflow.id)}
        </div>
      </td>

      <td className="px-2 py-2 text-left align-middle sm:px-2.5">
        <Link
          href={`/workflows/${workflow.id}`}
          className="block truncate font-semibold tracking-wide text-(--color-text-primary) transition-colors hover:text-(--color-primary)"
          title={workflowName}
        >
          {workflowName}
        </Link>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-center align-middle sm:px-2.5">
        <WorkflowTriggerType triggerType={workflow.trigger.type} />
      </td>

      <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-right align-middle text-zinc-600 sm:px-2.5 dark:text-zinc-300">
        <div>
          steps:{stepCount} edges:{edgeCount}
        </div>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-center align-middle sm:px-2.5">
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

      <td className="whitespace-nowrap px-2 py-2 text-left align-middle text-xs text-(--color-text-secondary) sm:px-2.5">
        <div title={formatAbsoluteDateTime(workflow.updatedAt)}>
          {formatRelativeTime(workflow.updatedAt)}
        </div>
      </td>

      <td className="px-2 py-2 text-center align-middle sm:px-2.5">
        <WorkflowContextMenu workflow={workflow} onDelete={onDelete} onCopyId={onCopyId} />
      </td>
    </tr>
  );
}
