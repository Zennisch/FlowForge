'use client';

import { Save } from 'lucide-react';

import ZButton from '@/components/primary/ZButton';
import ZSwitch from '@/components/primary/ZSwitch';
import ZTextInput from '@/components/primary/ZTextInput';
import type { WorkflowBuilderDraft } from '@/lib/workflow-builder/types';

interface WorkflowMetaInspectorPanelProps {
  draft: WorkflowBuilderDraft;
  pending?: boolean;
  onSave?: () => void;
  onUpdate?: (updater: (draft: WorkflowBuilderDraft) => WorkflowBuilderDraft) => void;
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

export function WorkflowMetaInspectorPanel({
  draft,
  pending = false,
  onSave,
  onUpdate,
}: WorkflowMetaInspectorPanelProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">Workflow Summary</h3>
        <p className="mt-1 text-xs text-(--color-text-secondary)">
          Update workflow details and save from this panel.
        </p>

        <div className="mt-3 space-y-3">
          <ZTextInput
            fullWidth
            value={draft.name}
            placeholder="Workflow title"
            onChange={(event) => {
              const name = event.target.value;
              onUpdate?.((current) => ({ ...current, name }));
            }}
          />

          <ZTextInput
            fullWidth
            multiline
            rows={3}
            value={draft.description}
            placeholder="Workflow description"
            onChange={(event) => {
              const description = event.target.value;
              onUpdate?.((current) => ({ ...current, description }));
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <ZSwitch
              label={draft.status === 'active' ? 'Active' : 'Inactive'}
              checked={draft.status === 'active'}
              onChange={(event) => {
                const checked = event.target.checked;
                onUpdate?.((current) => ({
                  ...current,
                  status: checked ? 'active' : 'inactive',
                }));
              }}
            />

            <ZButton
              size="sm"
              iconStart={<Save className="h-4 w-4" />}
              loading={pending}
              loadingText="Saving..."
              disabled={pending}
              onClick={() => {
                onSave?.();
              }}
            >
              Save Workflow
            </ZButton>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">Workflow Metadata</h3>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-text-secondary)">ID</dt>
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
