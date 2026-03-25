'use client';

import { Trash2 } from 'lucide-react';

import ZButton from '@/components/primary/ZButton';
import ZSelect from '@/components/primary/ZSelect';
import ZTextInput from '@/components/primary/ZTextInput';
import type { BuilderEdgeDraft } from '@/lib/workflow-builder/types';
import type { BuilderStepDraft, WorkflowBuilderDraft } from '@/lib/workflow-builder/types';
import type { StepInspectorPanelKind } from '@/lib/workflow-builder/types';

import { JsonCodeEditor } from '../JsonCodeEditor';

interface StepInspectorPanelProps {
  step: BuilderStepDraft;
  activePanel: StepInspectorPanelKind;
  draft: WorkflowBuilderDraft;
  fieldErrors: Record<string, string>;
  onUpdateStep: (stepKey: string, updater: (step: BuilderStepDraft) => BuilderStepDraft) => void;
  onUpdateEdgeCondition: (edgeKey: string, condition: string) => void;
  onRemoveEdge: (edgeKey: string) => void;
  onDeleteStep: (stepKey: string) => void;
}

const backoffOptions = [
  { label: 'Exponential', value: 'exponential' },
  { label: 'Fixed', value: 'fixed' },
] as const;

export function StepInspectorPanel({
  step,
  activePanel,
  draft,
  fieldErrors,
  onUpdateStep,
  onUpdateEdgeCondition,
  onRemoveEdge,
  onDeleteStep,
}: StepInspectorPanelProps) {
  const outgoingEdges = draft.edges.filter((edge) => edge.fromStepKey === step.key);
  const stepNameByKey = new Map(draft.steps.map((item) => [item.key, item.id]));

  return (
    <div className="space-y-5">
      {activePanel === 'retry' ? (
        <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
          <h3 className="text-sm font-semibold text-(--color-text-primary)">Retry & Error Handling</h3>
          <div className="mt-3 space-y-3">
            <ZTextInput
              label="Max attempts"
              fullWidth
              type="number"
              value={String(step.maxAttempts)}
              error={fieldErrors[`step:${step.key}:maxAttempts`]}
              onChange={(event) => {
                const nextValue = Number(event.target.value || 0);
                onUpdateStep(step.key, (current) => ({
                  ...current,
                  maxAttempts: Number.isNaN(nextValue) ? 0 : nextValue,
                }));
              }}
            />
            <ZSelect
              label="Backoff"
              fullWidth
              options={backoffOptions.map((option) => ({ ...option }))}
              value={step.backoff}
              onChange={(value) => {
                onUpdateStep(step.key, (current) => ({
                  ...current,
                  backoff: value as BuilderStepDraft['backoff'],
                }));
              }}
            />
          </div>
        </section>
      ) : null}

      {activePanel === 'config' ? (
        <>
          <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
            <h3 className="text-sm font-semibold text-(--color-text-primary)">Step Config (JSON)</h3>
            <div className="mt-3">
              <JsonCodeEditor
                value={step.configText}
                onChange={(value) => {
                  onUpdateStep(step.key, (current) => ({ ...current, configText: value }));
                }}
              />
              {fieldErrors[`step:${step.key}:configText`] ? (
                <p className="mt-2 text-xs text-(--color-error)">
                  {fieldErrors[`step:${step.key}:configText`]}
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
            <h3 className="text-sm font-semibold text-(--color-text-primary)">Outgoing Edges</h3>
            <p className="mt-1 text-xs text-(--color-text-secondary)">
              Manage conditions for edges starting from this step.
            </p>

            <div className="mt-3 space-y-3">
              {outgoingEdges.length === 0 ? (
                <p className="rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-xs text-(--color-text-secondary)">
                  No outgoing edges yet. Connect this node to another step from the canvas.
                </p>
              ) : null}

              {outgoingEdges.map((edge) => (
                <OutgoingEdgeRow
                  key={edge.key}
                  edge={edge}
                  targetLabel={stepNameByKey.get(edge.toStepKey) ?? edge.toStepKey}
                  fieldError={fieldErrors[`edge:${edge.key}:to`]}
                  onUpdateEdgeCondition={onUpdateEdgeCondition}
                  onRemoveEdge={onRemoveEdge}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
        <p className="mt-1 text-xs text-red-600">
          Deleting this step removes all connected edges in the workflow graph.
        </p>
        <div className="mt-3">
          <ZButton
            variant="ghost"
            className="border border-red-300 text-red-700 hover:bg-red-100"
            iconStart={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              onDeleteStep(step.key);
            }}
          >
            Delete Step
          </ZButton>
        </div>
      </section>
    </div>
  );
}

function OutgoingEdgeRow({
  edge,
  targetLabel,
  fieldError,
  onUpdateEdgeCondition,
  onRemoveEdge,
}: {
  edge: BuilderEdgeDraft;
  targetLabel: string;
  fieldError?: string;
  onUpdateEdgeCondition: (edgeKey: string, condition: string) => void;
  onRemoveEdge: (edgeKey: string) => void;
}) {
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-(--color-text-primary)">To: {targetLabel}</p>
        <button
          type="button"
          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          onClick={() => {
            onRemoveEdge(edge.key);
          }}
        >
          Remove
        </button>
      </div>

      <ZTextInput
        label="Condition"
        fullWidth
        value={edge.condition}
        placeholder="Optional condition"
        onChange={(event) => {
          onUpdateEdgeCondition(edge.key, event.target.value);
        }}
      />

      {fieldError ? <p className="mt-1 text-xs text-(--color-error)">{fieldError}</p> : null}
    </div>
  );
}
