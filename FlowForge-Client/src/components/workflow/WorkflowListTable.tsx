'use client';

import type { Workflow } from '@/types/workflow.types';
import type { WorkflowInsightItem } from '@/types/workflow.types';
import { WorkflowListRow } from '@/components/workflow/WorkflowListRow';

interface WorkflowListTableProps {
  workflows: Workflow[];
  insights?: Record<string, WorkflowInsightItem>;
  onDelete: (workflow: Workflow) => void;
  onTrigger: (workflow: Workflow) => void;
  onCopyId: (workflowId: string) => Promise<void>;
}

export function WorkflowListTable({
  workflows,
  insights = {},
  onDelete,
  onTrigger,
  onCopyId,
}: WorkflowListTableProps) {
  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-surface-base) shadow-sm">
      <div className="max-h-[calc(100vh-20rem)] overflow-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse">
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead className="sticky top-0 z-20 border-b border-(--color-border) bg-(--color-surface-muted)">
            <tr>
              <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              </th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Workflow
              </th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Trigger
              </th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Topology
              </th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Status
              </th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Last Execution
              </th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Activity
              </th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Updated
              </th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-(--color-border-subtle) bg-(--color-surface-base)">
            {workflows.map((workflow) => (
              <WorkflowListRow
                key={workflow.id}
                workflow={workflow}
                insight={insights[workflow.id]}
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
