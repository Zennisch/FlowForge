'use client';

import type { WorkflowBuilderDraft } from '@/lib/workflow-builder/types';

interface WorkflowMetaInspectorPanelProps {
  draft: WorkflowBuilderDraft;
}

function formatDate(value?: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function WorkflowMetaInspectorPanel({ draft }: WorkflowMetaInspectorPanelProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">Workflow Metadata</h3>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-text-secondary)">Workflow ID</dt>
            <dd className="w-full truncate text-right font-medium text-(--color-text-primary)">
              {draft.id || 'New workflow'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-text-secondary)">Status</dt>
            <dd className="font-medium capitalize text-(--color-text-primary)">{draft.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-text-secondary)">Created</dt>
            <dd className="font-medium text-(--color-text-primary)">{formatDate(draft.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-text-secondary)">Updated</dt>
            <dd className="font-medium text-(--color-text-primary)">{formatDate(draft.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">Graph Statistics</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-(--color-text-secondary)">Nodes</p>
            <p className="mt-1 text-lg font-semibold text-(--color-text-primary)">{draft.steps.length + 1}</p>
          </div>
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-(--color-text-secondary)">Edges</p>
            <p className="mt-1 text-lg font-semibold text-(--color-text-primary)">{draft.edges.length}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
