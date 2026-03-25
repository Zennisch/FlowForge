'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelBottomClose, PanelBottomOpen, X } from 'lucide-react';

import { buildCreateWorkflowPayload } from '@/lib/workflow-builder/payload';
import type { WorkflowBuilderEditorProps } from '@/lib/workflow-builder/types';
import type { StepInspectorPanelKind } from '@/lib/workflow-builder/types';
import type { StepType } from '@/types/workflow.types';
import ZButton from '@/components/primary/ZButton';

import { StepInspectorPanel } from './inspector/StepInspectorPanel';
import { TriggerInspectorPanel } from './inspector/TriggerInspectorPanel';
import { WorkflowMetaInspectorPanel } from './inspector/WorkflowMetaInspectorPanel';
import { WorkflowBuilderToolbar } from './WorkflowBuilderToolbar';
import { WorkflowGraphCanvas } from './WorkflowGraphCanvas';
import { useWorkflowBuilderState } from './useWorkflowBuilderState';

export function WorkflowBuilderEditor({
  mode,
  initialWorkflow,
  isPending,
  submitError,
  onSubmit,
}: WorkflowBuilderEditorProps) {
  const {
    draft,
    selection,
    selectedStep,
    setSelection,
    updateDraft,
    addStep,
    addEdge,
    deleteStep,
    updateStep,
    updateStepPosition,
    updateEdgeCondition,
    removeEdge,
    resetFromWorkflow,
  } = useWorkflowBuilderState({ workflow: initialWorkflow });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  useEffect(() => {
    resetFromWorkflow(initialWorkflow);
    setFieldErrors({});
  }, [initialWorkflow, resetFromWorkflow]);

  const saveWorkflow = async () => {
    const result = buildCreateWorkflowPayload(draft);
    setFieldErrors(result.validation.fieldErrors);

    if (!result.payload || !result.validation.isValid) {
      return;
    }

    await onSubmit(result.payload);
  };

  const inspectorTitle = useMemo(() => {
    if (selection.kind === 'trigger') {
      return 'Trigger Inspector';
    }

    if (selection.kind === 'step') {
      return selectedStep ? `Step: ${selectedStep.id || selectedStep.type}` : 'Step Inspector';
    }

    return 'Workflow Summary';
  }, [selection.kind, selectedStep]);

  useEffect(() => {
    setMobileInspectorOpen(true);
  }, [selection]);

  const handleStepIdChange = useCallback(
    (stepKey: string, nextId: string) => {
      updateStep(stepKey, (current) => ({ ...current, id: nextId }));
    },
    [updateStep]
  );

  const handleStepTypeChange = useCallback(
    (stepKey: string, nextType: StepType) => {
      updateStep(stepKey, (current) => ({ ...current, type: nextType }));
    },
    [updateStep]
  );

  const handleStepPanelChange = useCallback(
    (stepKey: string, panel: StepInspectorPanelKind) => {
      setSelection({ kind: 'step', stepKey, panel });
    },
    [setSelection]
  );

  return (
    <div className="space-y-4">
      <WorkflowBuilderToolbar
        mode={mode}
        draft={draft}
        pending={isPending}
        onUpdate={updateDraft}
        onSave={() => {
          void saveWorkflow();
        }}
      />

      {fieldErrors.name ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {fieldErrors.name}
        </p>
      ) : null}

      {fieldErrors.steps ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {fieldErrors.steps}
        </p>
      ) : null}

      {submitError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </p>
      ) : null}

      <div className="grid gap-4 lg:h-[calc(100vh-260px)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="h-full">
          <WorkflowGraphCanvas
            draft={draft}
            selection={selection}
            onSelectionChange={setSelection}
            onAddStep={addStep}
            onAddEdge={addEdge}
            onStepPositionChange={updateStepPosition}
            onStepIdChange={handleStepIdChange}
            onStepTypeChange={handleStepTypeChange}
            onStepPanelChange={handleStepPanelChange}
          />
        </section>

        <aside className="hidden h-full rounded-2xl border border-(--color-border) bg-(--color-surface-muted) p-4 lg:block">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">{inspectorTitle}</h2>
            <p className="mt-1 text-xs text-(--color-text-secondary)">
              Sidebar changes based on current canvas selection.
            </p>
          </div>

          <div className="h-[calc(100%-50px)] overflow-y-auto pr-1">
            {selection.kind === 'trigger' ? (
              <TriggerInspectorPanel draft={draft} fieldErrors={fieldErrors} onUpdate={updateDraft} />
            ) : null}

            {selection.kind === 'step' && selectedStep ? (
              <StepInspectorPanel
                draft={draft}
                step={selectedStep}
                activePanel={selection.kind === 'step' ? selection.panel : 'retry'}
                fieldErrors={fieldErrors}
                onUpdateStep={updateStep}
                onUpdateEdgeCondition={updateEdgeCondition}
                onRemoveEdge={removeEdge}
                onDeleteStep={deleteStep}
              />
            ) : null}

            {selection.kind === 'canvas' ? <WorkflowMetaInspectorPanel draft={draft} /> : null}
          </div>
        </aside>
      </div>

      <div className="lg:hidden">
        <div className="fixed bottom-4 right-4 z-30">
          <ZButton
            size="sm"
            iconStart={
              mobileInspectorOpen ? (
                <PanelBottomClose className="h-4 w-4" />
              ) : (
                <PanelBottomOpen className="h-4 w-4" />
              )
            }
            onClick={() => {
              setMobileInspectorOpen((current) => !current);
            }}
          >
            {mobileInspectorOpen ? 'Hide Inspector' : 'Open Inspector'}
          </ZButton>
        </div>

        {mobileInspectorOpen ? (
          <div className="fixed inset-0 z-20 flex items-end bg-(--color-overlay-modal)">
            <div className="max-h-[82vh] w-full rounded-t-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-(--color-text-primary)">{inspectorTitle}</h2>
                  <p className="text-xs text-(--color-text-secondary)">
                    Contextual inspector for current canvas selection.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border) text-(--color-text-secondary)"
                  onClick={() => {
                    setMobileInspectorOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[68vh] overflow-y-auto pr-1">
                {selection.kind === 'trigger' ? (
                  <TriggerInspectorPanel
                    draft={draft}
                    fieldErrors={fieldErrors}
                    onUpdate={updateDraft}
                  />
                ) : null}

                {selection.kind === 'step' && selectedStep ? (
                  <StepInspectorPanel
                    draft={draft}
                    step={selectedStep}
                    activePanel={selection.kind === 'step' ? selection.panel : 'retry'}
                    fieldErrors={fieldErrors}
                    onUpdateStep={updateStep}
                    onUpdateEdgeCondition={updateEdgeCondition}
                    onRemoveEdge={removeEdge}
                    onDeleteStep={deleteStep}
                  />
                ) : null}

                {selection.kind === 'canvas' ? <WorkflowMetaInspectorPanel draft={draft} /> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
