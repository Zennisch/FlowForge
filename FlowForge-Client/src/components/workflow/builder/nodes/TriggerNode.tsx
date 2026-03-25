'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Plus, Zap } from 'lucide-react';
import { useState } from 'react';

import ZButton from '@/components/primary/ZButton';
import type { StepType } from '@/types/workflow.types';

interface TriggerNodeData {
  title: string;
  subtitle: string;
  onCreateStep: (type: StepType) => void;
}

const STEP_OPTIONS: { label: string; value: StepType }[] = [
  { label: 'HTTP Step', value: 'http' },
  { label: 'Transform Step', value: 'transform' },
  { label: 'Store Step', value: 'store' },
  { label: 'Branch Step', value: 'branch' },
];

export function TriggerNode({ data, selected }: NodeProps<TriggerNodeData>) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`relative min-w-64 rounded-2xl border bg-(--color-surface-raised) p-4 shadow-sm ${
        selected ? 'border-(--color-primary)' : 'border-(--color-border)'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-(--color-text-secondary)">
            Trigger Node
          </p>
          <h3 className="mt-1 text-base font-semibold text-(--color-text-primary)">{data.title}</h3>
          <p className="mt-1 text-xs text-(--color-text-secondary)">{data.subtitle}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-surface-muted) text-(--color-primary)">
          <Zap className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <ZButton
          size="xs"
          variant="secondary"
          iconStart={<Plus className="h-3.5 w-3.5" />}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          Add Step
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
                data.onCreateStep(option.value);
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
