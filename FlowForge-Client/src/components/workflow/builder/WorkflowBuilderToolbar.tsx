'use client';

import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';

import ZButton from '@/components/primary/ZButton';
import ZSwitch from '@/components/primary/ZSwitch';
import ZTextInput from '@/components/primary/ZTextInput';
import type { WorkflowBuilderDraft } from '@/lib/workflow-builder/types';

interface WorkflowBuilderToolbarProps {
  mode: 'create' | 'edit';
  draft: WorkflowBuilderDraft;
  pending: boolean;
  onUpdate: (updater: (draft: WorkflowBuilderDraft) => WorkflowBuilderDraft) => void;
  onSave: () => void;
}

export function WorkflowBuilderToolbar({
  mode,
  draft,
  pending,
  onUpdate,
  onSave,
}: WorkflowBuilderToolbarProps) {
  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link
            href="/workflows"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--color-border) text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.12em] text-(--color-text-secondary)">
              Workflows / {mode === 'create' ? 'Create' : 'Update'}
            </p>
            <div className="mt-1 w-full">
              <ZTextInput
                fullWidth
                value={draft.name}
                placeholder="Untitled workflow"
                onChange={(event) => {
                  const name = event.target.value;
                  onUpdate((current) => ({ ...current, name }));
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ZSwitch
            label={draft.status === 'active' ? 'Active' : 'Inactive'}
            checked={draft.status === 'active'}
            onChange={(event) => {
              const checked = event.target.checked;
              onUpdate((current) => ({
                ...current,
                status: checked ? 'active' : 'inactive',
              }));
            }}
          />

          <ZButton
            iconStart={<Save className="h-4 w-4" />}
            loading={pending}
            loadingText="Saving..."
            onClick={onSave}
            disabled={pending}
          >
            Save Workflow
          </ZButton>
        </div>
      </div>
    </div>
  );
}
