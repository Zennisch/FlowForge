'use client';

import { useCallback, useMemo, useState } from 'react';

import { createBuilderKey } from '@/lib/workflow-builder/helpers';
import { workflowToBuilderDraft } from '@/lib/workflow-builder/payload';
import type { StepType } from '@/types/workflow.types';
import type {
  BuilderSelection,
  BuilderStepDraft,
  WorkflowBuilderDraft,
} from '@/lib/workflow-builder/types';
import type { Workflow } from '@/types/workflow.types';

interface UseWorkflowBuilderStateParams {
  workflow?: Workflow;
}

function createStepId(type: StepType, index: number): string {
  return `${type}-${index + 1}`;
}

function createDefaultStepPosition(index: number): { x: number; y: number } {
  return {
    x: 520,
    y: 40 + index * 178,
  };
}

export function useWorkflowBuilderState({ workflow }: UseWorkflowBuilderStateParams) {
  const [draft, setDraft] = useState<WorkflowBuilderDraft>(() => workflowToBuilderDraft(workflow));
  const [selection, setSelection] = useState<BuilderSelection>({ kind: 'trigger' });

  const selectedStep = useMemo(() => {
    if (selection.kind !== 'step') {
      return null;
    }

    return draft.steps.find((step) => step.key === selection.stepKey) ?? null;
  }, [draft.steps, selection]);

  const updateDraft = useCallback((updater: (current: WorkflowBuilderDraft) => WorkflowBuilderDraft) => {
    setDraft((current) => updater(current));
  }, []);

  const addStep = useCallback(
    (type: StepType, fromStepKey?: string) => {
      let nextStepKey = '';

      setDraft((current) => {
        const createdStep: BuilderStepDraft = {
          key: createBuilderKey('step'),
          id: createStepId(type, current.steps.length),
          type,
          position: fromStepKey
            ? (() => {
                const sourceStep = current.steps.find((step) => step.key === fromStepKey);
                if (!sourceStep) {
                  return createDefaultStepPosition(current.steps.length);
                }

                return {
                  x: sourceStep.position.x + 340,
                  y: sourceStep.position.y + 60,
                };
              })()
            : createDefaultStepPosition(current.steps.length),
          maxAttempts: 3,
          backoff: 'exponential',
          configText: '{}',
        };
        nextStepKey = createdStep.key;

        const nextEdges = [...current.edges];
        if (fromStepKey) {
          nextEdges.push({
            key: createBuilderKey('edge'),
            fromStepKey,
            toStepKey: createdStep.key,
            condition: '',
          });
        }

        return {
          ...current,
          steps: [...current.steps, createdStep],
          edges: nextEdges,
        };
      });

      if (nextStepKey) {
        setSelection({ kind: 'step', stepKey: nextStepKey, panel: 'config' });
      }
    },
    []
  );

  const addEdge = useCallback((fromStepKey: string, toStepKey: string) => {
    if (fromStepKey === toStepKey) {
      return;
    }

    setDraft((current) => {
      const duplicated = current.edges.some(
        (edge) => edge.fromStepKey === fromStepKey && edge.toStepKey === toStepKey
      );

      if (duplicated) {
        return current;
      }

      return {
        ...current,
        edges: [
          ...current.edges,
          {
            key: createBuilderKey('edge'),
            fromStepKey,
            toStepKey,
            condition: '',
          },
        ],
      };
    });
  }, []);

  const deleteStep = useCallback((stepKey: string) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.filter((step) => step.key !== stepKey),
      edges: current.edges.filter(
        (edge) => edge.fromStepKey !== stepKey && edge.toStepKey !== stepKey
      ),
    }));

    setSelection({ kind: 'canvas' });
  }, []);

  const updateStep = useCallback((stepKey: string, updater: (step: BuilderStepDraft) => BuilderStepDraft) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.key === stepKey ? updater(step) : step)),
    }));
  }, []);

  const updateStepPosition = useCallback((stepKey: string, position: { x: number; y: number }) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.key === stepKey
          ? {
              ...step,
              position,
            }
          : step
      ),
    }));
  }, []);

  const updateEdgeCondition = useCallback((edgeKey: string, condition: string) => {
    setDraft((current) => ({
      ...current,
      edges: current.edges.map((edge) =>
        edge.key === edgeKey
          ? {
              ...edge,
              condition,
            }
          : edge
      ),
    }));
  }, []);

  const removeEdge = useCallback((edgeKey: string) => {
    setDraft((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.key !== edgeKey),
    }));
  }, []);

  const resetFromWorkflow = useCallback((nextWorkflow?: Workflow) => {
    setDraft(workflowToBuilderDraft(nextWorkflow));
    setSelection({ kind: 'trigger' });
  }, []);

  return {
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
  };
}
