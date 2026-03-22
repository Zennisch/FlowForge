'use client';

import Link from 'next/link';

import type { Workflow } from '@/types/workflow.types';

interface WorkflowCardProps {
  workflow: Workflow;
  onDelete: (workflow: Workflow) => void;
  isDeleting: boolean;
}

function formatUpdatedAt(value: string): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function WorkflowCard({ workflow, onDelete, isDeleting }: WorkflowCardProps) {
  const isActive = workflow.status === 'active';

  return (
    <article className="rounded-2xl border border-(--color-border) bg-white p-5 shadow-[0_10px_35px_-24px_rgba(37,99,235,0.55)] transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-(--color-text-primary)">{workflow.name}</h2>
          <p className="mt-2 text-sm text-(--color-text-secondary)">
            {workflow.description?.trim() || 'No description yet.'}
          </p>
        </div>

        <span
          className={[
            'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
            isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
          ].join(' ')}
        >
          {workflow.status}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-(--color-border) bg-blue-50/40 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Steps</dt>
          <dd className="mt-1 font-semibold text-(--color-text-primary)">
            {workflow.steps.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Edges</dt>
          <dd className="mt-1 font-semibold text-(--color-text-primary)">
            {workflow.edges.length}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs uppercase tracking-wide text-(--color-text-secondary)">Updated</dt>
          <dd className="mt-1 font-semibold text-(--color-text-primary)">
            {formatUpdatedAt(workflow.updatedAt)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/workflows/${workflow.id}`}
          className="rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
        >
          View details
        </Link>

        <Link
          href={`/workflows/${workflow.id}/executions`}
          className="rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
        >
          Executions
        </Link>

        <button
          type="button"
          onClick={() => onDelete(workflow)}
          disabled={isDeleting}
          className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </article>
  );
}
