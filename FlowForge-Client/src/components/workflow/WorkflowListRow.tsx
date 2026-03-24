'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';

import ZButton from '@/components/primary/ZButton';
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

export function WorkflowListRow({ workflow, onDelete, onTrigger, onCopyId }: WorkflowListRowProps) {
  const isActive = workflow.status === 'active';
  const triggerConfigSize = Object.keys(workflow.trigger.config ?? {}).length;
  const stepCount = workflow.steps.length;
  const edgeCount = workflow.edges.length;
  const density = stepCount > 0 ? (edgeCount / stepCount).toFixed(2) : '0.00';
  const stepTypeCounts = workflow.steps.reduce<Record<string, number>>((accumulator, step) => {
    accumulator[step.type] = (accumulator[step.type] ?? 0) + 1;
    return accumulator;
  }, {});
  const stepTypeSummary = Object.entries(stepTypeCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([stepType, count]) => `${stepType.slice(0, 2)}:${count}`)
    .join(' ');

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

      <td className="px-2 py-2 text-center align-middle font-mono text-xs text-zinc-600 sm:px-2.5 dark:text-zinc-300">
        <div className="truncate" title={workflow.id}>
          {compactId(workflow.id)}
        </div>
        <div className="truncate text-zinc-500 dark:text-zinc-400" title={workflow.ownerId}>
          o:{compactId(workflow.ownerId)}
        </div>
      </td>

      <td className="px-2 py-2 align-middle sm:px-2.5">
        <Link
          href={`/workflows/${workflow.id}`}
          className="block truncate font-semibold uppercase tracking-wide text-(--color-text-primary) transition-colors hover:text-(--color-primary)"
          title={workflow.name}
        >
          {workflow.name}
        </Link>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-center align-middle font-mono text-xs text-zinc-600 sm:px-2.5 dark:text-zinc-300">
        <div title={stepTypeSummary || 'n/a'}>{stepTypeSummary || 'na:0'}</div>
        <div className="text-zinc-500 dark:text-zinc-400">n:{Object.keys(stepTypeCounts).length}</div>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-center align-middle sm:px-2.5">
        <WorkflowTriggerType triggerType={workflow.trigger.type} />
        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">cfg:{triggerConfigSize}</div>
      </td>

      <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-center align-middle text-zinc-600 sm:px-2.5 dark:text-zinc-300">
        <div>s:{stepCount}</div>
        <div>e:{edgeCount}</div>
        <div>e/s:{density}</div>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-center align-middle sm:px-2.5">
        <span
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
            isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-200/70 text-zinc-600',
          ].join(' ')}
        >
          <span
            className={[
              'inline-flex h-1.5 w-1.5 rounded-full',
              isActive ? 'bg-emerald-500' : 'bg-zinc-400',
            ].join(' ')}
          />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-center align-middle text-xs text-(--color-text-secondary) sm:px-2.5">
        <div title={formatAbsoluteDateTime(workflow.updatedAt)}>
          u:{formatRelativeTime(workflow.updatedAt)}
        </div>
        <div title={formatAbsoluteDateTime(workflow.createdAt)}>
          c:{formatRelativeTime(workflow.createdAt)}
        </div>
      </td>

      <td className="px-2 py-2 text-center align-middle sm:px-2.5">
        <WorkflowContextMenu workflow={workflow} onDelete={onDelete} onCopyId={onCopyId} />
      </td>
    </tr>
  );
}
