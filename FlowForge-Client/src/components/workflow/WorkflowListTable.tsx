'use client';

import type { Workflow } from '@/types/workflow.types';
import { WorkflowListRow } from '@/components/workflow/WorkflowListRow';

interface WorkflowListTableProps {
  workflows: Workflow[];
  onDelete: (workflow: Workflow) => void;
  onTrigger: (workflow: Workflow) => void;
  onCopyId: (workflowId: string) => Promise<void>;
}

export function WorkflowListTable({
  workflows,
  onDelete,
  onTrigger,
  onCopyId,
}: WorkflowListTableProps) {
  return (
    <div className="h-full rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="h-full overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '17.5%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-2.5">
                
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-2.5">
                ID
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-2.5">
                Workflow
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-2.5">
                Trigger
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-2.5">
                Topology
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-2.5">
                Status
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-2.5">
                Updated
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-2.5">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="bg-white dark:bg-zinc-950">
            {workflows.map((workflow) => (
              <WorkflowListRow
                key={workflow.id}
                workflow={workflow}
                onDelete={onDelete}
                onTrigger={onTrigger}
                onCopyId={onCopyId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
