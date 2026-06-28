'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PanelBottomClose, PanelBottomOpen, X } from 'lucide-react';

import { buildCreateWorkflowPayload } from '@/lib/workflow-builder/payload';
import type { WorkflowBuilderEditorProps } from '@/lib/workflow-builder/types';
import ZButton from '@/components/primary/ZButton';

import { StepInspectorPanel } from './inspector/StepInspectorPanel';
import { TriggerInspectorPanel } from './inspector/TriggerInspectorPanel';
import { WorkflowMetaInspectorPanel } from './inspector/WorkflowMetaInspectorPanel';
import { WorkflowGraphCanvas } from './WorkflowGraphCanvas';
import { useWorkflowBuilderState } from './useWorkflowBuilderState';

const INSPECTOR_DEFAULT_WIDTH = 420;
const INSPECTOR_MIN_WIDTH = 360;
const INSPECTOR_MAX_WIDTH = 640;

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
  const [inspectorWidth, setInspectorWidth] = useState(INSPECTOR_DEFAULT_WIDTH);
  const splitContainerRef = useRef<HTMLDivElement>(null);

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

  const inspectorSubtitle = useMemo(() => {
    if (selection.kind === 'trigger') {
      return draft.trigger.type;
    }

    if (selection.kind === 'step' && selectedStep) {
      return selectedStep.type;
    }

    return `${draft.steps.length + 1} nodes, ${draft.edges.length} edges`;
  }, [draft.edges.length, draft.steps.length, draft.trigger.type, selectedStep, selection.kind]);

  useEffect(() => {
    setMobileInspectorOpen(true);
  }, [selection]);

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const container = splitContainerRef.current;
    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const maxWidth = Math.min(INSPECTOR_MAX_WIDTH, window.innerWidth * 0.5);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = containerRect.right - moveEvent.clientX;
      setInspectorWidth(Math.min(Math.max(nextWidth, INSPECTOR_MIN_WIDTH), maxWidth));
    };

    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-x-hidden">
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

      <div ref={splitContainerRef} className="flex min-h-0 flex-1 gap-2">
        <section className="h-full min-h-0 min-w-0 flex-1">
          <WorkflowGraphCanvas
            draft={draft}
            selection={selection}
            onSelectionChange={setSelection}
            onAddStep={addStep}
            onAddEdge={addEdge}
            onStepPositionChange={updateStepPosition}
          />
        </section>

        <button
          type="button"
          aria-label="Resize inspector"
          title="Drag to resize inspector. Double click to reset."
          className="hidden w-2 cursor-col-resize rounded-full transition-colors hover:bg-(--color-border) lg:block"
          onPointerDown={startResize}
          onDoubleClick={() => {
            setInspectorWidth(INSPECTOR_DEFAULT_WIDTH);
          }}
        />

        <aside
          className="relative hidden h-full min-h-0 min-w-0 overflow-hidden rounded-2xl lg:block"
          style={{
            flex: `0 0 ${inspectorWidth}px`,
            maxWidth: 'min(640px, 50vw)',
            minWidth: `${INSPECTOR_MIN_WIDTH}px`,
          }}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {selection.kind === 'canvas' ? (
                <WorkflowMetaInspectorPanel
                  draft={draft}
                  pending={isPending}
                  onUpdate={updateDraft}
                  onSave={() => {
                    void saveWorkflow();
                  }}
                />
              ) : null}

              {selection.kind === 'trigger' ? (
                <TriggerInspectorPanel draft={draft} fieldErrors={fieldErrors} onUpdate={updateDraft} />
              ) : null}

              {selection.kind === 'step' && selectedStep ? (
                <StepInspectorPanel
                  draft={draft}
                  step={selectedStep}
                  fieldErrors={fieldErrors}
                  onUpdateStep={updateStep}
                  onUpdateEdgeCondition={updateEdgeCondition}
                  onRemoveEdge={removeEdge}
                  onDeleteStep={deleteStep}
                />
              ) : null}
            </div>
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
                  <p className="text-xs capitalize text-(--color-text-secondary)">{inspectorSubtitle}</p>
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

              <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
                {selection.kind === 'canvas' ? (
                  <WorkflowMetaInspectorPanel
                    draft={draft}
                    pending={isPending}
                    onUpdate={updateDraft}
                    onSave={() => {
                      void saveWorkflow();
                    }}
                  />
                ) : null}

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
                    fieldErrors={fieldErrors}
                    onUpdateStep={updateStep}
                    onUpdateEdgeCondition={updateEdgeCondition}
                    onRemoveEdge={removeEdge}
                    onDeleteStep={deleteStep}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
