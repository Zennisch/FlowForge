'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Database, GitBranch, Globe, Plus, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';

import ZButton from '@/components/primary/ZButton';
import ZSelect from '@/components/primary/ZSelect';
import type { StepInspectorPanelKind } from '@/lib/workflow-builder/types';
import type { StepType } from '@/types/workflow.types';

interface StepNodeData {
  stepId: string;
  stepType: StepType;
  activePanel: StepInspectorPanelKind;
  onCreateStep: (fromStepKey: string, type: StepType) => void;
  onStepIdChange: (stepKey: string, nextId: string) => void;
  onStepTypeChange: (stepKey: string, nextType: StepType) => void;
  onStepPanelChange: (stepKey: string, panel: StepInspectorPanelKind) => void;
  stepKey: string;
}

const STEP_OPTIONS: { label: string; value: StepType }[] = [
  { label: 'HTTP Step', value: 'http' },
  { label: 'Transform Step', value: 'transform' },
  { label: 'Store Step', value: 'store' },
  { label: 'Branch Step', value: 'branch' },
];

function getTypeIcon(type: StepType) {
  switch (type) {
    case 'http':
      return Globe;
    case 'transform':
      return Shuffle;
    case 'store':
      return Database;
    case 'branch':
      return GitBranch;
    default:
      return Globe;
  }
}

export function StepNode({ data, selected }: NodeProps<StepNodeData>) {
  const [open, setOpen] = useState(false);
  const Icon = useMemo(() => getTypeIcon(data.stepType), [data.stepType]);

  return (
    <div
      className={`relative min-w-64 rounded-2xl border bg-(--color-surface-raised) p-4 shadow-sm ${
        selected ? 'border-(--color-primary)' : 'border-(--color-border)'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-(--color-border-hover)" />

      <div className="flex items-start justify-between gap-2.5">
        <div className="nodrag nowheel flex min-w-0 flex-1 flex-col gap-2" data-node-control="true">
          <ZSelect
            size="sm"
            fullWidth
            value={data.stepType}
            options={[
              { label: 'HTTP', value: 'http' },
              { label: 'TRANSFORM', value: 'transform' },
              { label: 'STORE', value: 'store' },
              { label: 'BRANCH', value: 'branch' },
            ]}
            onChange={(value) => {
              data.onStepTypeChange(data.stepKey, value as StepType);
            }}
          />

          <input
            type="text"
            value={data.stepId}
            onChange={(event) => {
              data.onStepIdChange(data.stepKey, event.target.value);
            }}
            className="w-full rounded-lg border border-(--color-border) bg-(--color-surface-base) px-2.5 py-1.5 text-sm font-semibold text-(--color-text-primary) outline-none transition-colors focus:border-(--color-primary)"
          />
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-surface-muted) text-(--color-primary)">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <div
        className="nodrag nowheel mt-3 space-y-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-2.5"
        data-node-control="true"
      >
        <div className="grid grid-cols-2 gap-2">
          <ZButton
            size="xs"
            variant={data.activePanel === 'retry' ? 'primary' : 'secondary'}
            onClick={(event) => {
              event.stopPropagation();
              data.onStepPanelChange(data.stepKey, 'retry');
            }}
          >
            Retry & Error
          </ZButton>
          <ZButton
            size="xs"
            variant={data.activePanel === 'config' ? 'primary' : 'secondary'}
            onClick={(event) => {
              event.stopPropagation();
              data.onStepPanelChange(data.stepKey, 'config');
            }}
          >
            Step Config
          </ZButton>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <ZButton
          size="xs"
          variant="secondary"
          iconStart={<Plus className="h-3.5 w-3.5" />}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          Add Next
        </ZButton>
      </div>

      {open ? (
        <div className="absolute right-4 top-[calc(100%+8px)] z-20 w-44 rounded-xl border border-(--color-border) bg-(--color-surface-base) p-2 shadow-lg">
          {STEP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="block w-full rounded-lg px-2.5 py-2 text-left text-xs font-medium text-(--color-text-secondary) transition-colors hover:bg-(--color-surface-hover) hover:text-(--color-text-primary)"
              onClick={() => {
                data.onCreateStep(data.stepKey, option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-(--color-primary)" />
    </div>
  );
}
