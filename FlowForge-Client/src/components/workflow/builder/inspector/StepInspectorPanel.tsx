'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import ZButton from '@/components/primary/ZButton';
import ZSelect from '@/components/primary/ZSelect';
import ZTextInput from '@/components/primary/ZTextInput';
import type { BuilderEdgeDraft } from '@/lib/workflow-builder/types';
import type { BuilderStepDraft, WorkflowBuilderDraft } from '@/lib/workflow-builder/types';
import type { StepInspectorPanelKind } from '@/lib/workflow-builder/types';
import type { StepType } from '@/types/workflow.types';

import { JsonCodeEditor } from '../JsonCodeEditor';
import {
  InfoTooltip,
  InspectorDocsSlideOver,
  InspectorSection,
  SchemaLink,
} from './InspectorPrimitives';

interface StepInspectorPanelProps {
  step: BuilderStepDraft;
  activePanel: StepInspectorPanelKind;
  draft: WorkflowBuilderDraft;
  fieldErrors: Record<string, string>;
  onChangePanel: (panel: StepInspectorPanelKind) => void;
  onUpdateStep: (stepKey: string, updater: (step: BuilderStepDraft) => BuilderStepDraft) => void;
  onUpdateEdgeCondition: (edgeKey: string, condition: string) => void;
  onRemoveEdge: (edgeKey: string) => void;
  onDeleteStep: (stepKey: string) => void;
}

const backoffOptions = [
  { label: 'Exponential', value: 'exponential' },
  { label: 'Fixed', value: 'fixed' },
] as const;

const stepTypeOptions: { label: string; value: StepType }[] = [
  { label: 'HTTP', value: 'http' },
  { label: 'TRANSFORM', value: 'transform' },
  { label: 'STORE', value: 'store' },
  { label: 'BRANCH', value: 'branch' },
];

export function StepInspectorPanel({
  step,
  activePanel,
  draft,
  fieldErrors,
  onChangePanel,
  onUpdateStep,
  onUpdateEdgeCondition,
  onRemoveEdge,
  onDeleteStep,
}: StepInspectorPanelProps) {
  const [docsOpen, setDocsOpen] = useState(false);
  const outgoingEdges = draft.edges.filter((edge) => edge.fromStepKey === step.key);
  const stepNameByKey = new Map(draft.steps.map((item) => [item.key, item.id]));
  const hasBasicsError =
    Boolean(fieldErrors[`step:${step.key}:id`]) || Boolean(fieldErrors[`step:${step.key}:maxAttempts`]);
  const hasConfigError = Boolean(fieldErrors[`step:${step.key}:configText`]);
  const hasEdgeError = outgoingEdges.some((edge) => fieldErrors[`edge:${edge.key}:to`]);
  const hasRetryData = step.maxAttempts !== 3 || step.backoff !== 'exponential';

  return (
    <div className="relative space-y-3">
      <InspectorDocsSlideOver
        open={docsOpen}
        kind="step"
        stepType={step.type}
        onClose={() => {
          setDocsOpen(false);
        }}
      />

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="truncate text-xs text-(--color-text-secondary)">Step: {step.id || step.type}</p>
        <SchemaLink
          onClick={() => {
            setDocsOpen(true);
          }}
        />
      </div>

      <InspectorSection title="Step Basics" defaultOpen hasError={hasBasicsError}>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-(--color-text-secondary)">
            <span>Step ID</span>
            <InfoTooltip text="Unique identifier used by edges and downstream step references." />
          </div>
          <ZTextInput
            fullWidth
            value={step.id}
            error={fieldErrors[`step:${step.key}:id`]}
            onChange={(event) => {
              onUpdateStep(step.key, (current) => ({ ...current, id: event.target.value }));
            }}
          />
          <div className="flex items-center gap-1.5 text-xs font-medium text-(--color-text-secondary)">
            <span>Step Type</span>
            <InfoTooltip text="Controls which config shape this step expects at runtime." />
          </div>
          <ZSelect
            fullWidth
            options={stepTypeOptions}
            value={step.type}
            onChange={(value) => {
              onUpdateStep(step.key, (current) => ({ ...current, type: value as StepType }));
            }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <ZButton
            size="xs"
            variant={activePanel === 'config' ? 'primary' : 'secondary'}
            onClick={() => {
              onChangePanel('config');
            }}
          >
            Step Config
          </ZButton>
          <ZButton
            size="xs"
            variant={activePanel === 'retry' ? 'primary' : 'secondary'}
            onClick={() => {
              onChangePanel('retry');
            }}
          >
            Retry & Error
          </ZButton>
        </div>
      </InspectorSection>

      {activePanel === 'retry' ? (
        <InspectorSection
          title="Retry & Error Handling"
          defaultOpen={hasRetryData}
          hasError={Boolean(fieldErrors[`step:${step.key}:maxAttempts`])}
          badge={
            hasRetryData ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                Custom
              </span>
            ) : null
          }
        >
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
        </InspectorSection>
      ) : null}

      {activePanel === 'config' ? (
        <>
          <InspectorSection title="Step Config (JSON)" hasError={hasConfigError}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-(--color-text-secondary)">
                <span>Config payload</span>
                <InfoTooltip text="JSON passed to the selected step type. Use View Schema for examples." />
              </div>
              <SchemaLink
                onClick={() => {
                  setDocsOpen(true);
                }}
              />
            </div>
            <div className="mt-3">
              <JsonCodeEditor
                value={step.configText}
                modalTitle={`Step Config: ${step.id || step.type}`}
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
          </InspectorSection>

          <InspectorSection
            title="Outgoing Edges"
            description="Manage conditions for edges starting from this step."
            defaultOpen={outgoingEdges.length > 0}
            hasError={hasEdgeError}
            badge={
              outgoingEdges.length > 0 ? (
                <span className="rounded-full bg-(--color-surface-muted) px-2 py-0.5 text-[11px] font-medium text-(--color-text-secondary)">
                  {outgoingEdges.length}
                </span>
              ) : null
            }
          >
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
          </InspectorSection>
        </>
      ) : null}

      <InspectorSection
        title="Danger Zone"
        description="Deleting this step removes all connected edges in the workflow graph."
        tone="danger"
      >
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
      </InspectorSection>
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

      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-(--color-text-secondary)">
        <span>Condition</span>
        <InfoTooltip text="Optional expression used to decide whether this edge can run." />
      </div>
      <ZTextInput
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
