'use client';

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
} from 'reactflow';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BuilderSelection, WorkflowBuilderDraft } from '@/lib/workflow-builder/types';
import type { StepType } from '@/types/workflow.types';

import { StepNode } from './nodes/StepNode';
import { TriggerNode } from './nodes/TriggerNode';

import 'reactflow/dist/style.css';

interface WorkflowGraphCanvasProps {
  draft: WorkflowBuilderDraft;
  selection: BuilderSelection;
  onSelectionChange: (selection: BuilderSelection) => void;
  onAddStep: (type: StepType, fromStepKey?: string) => void;
  onAddEdge: (fromStepKey: string, toStepKey: string) => void;
  onStepPositionChange: (stepKey: string, position: { x: number; y: number }) => void;
}

const TRIGGER_NODE_ID = 'trigger';

const nodeTypes = {
  trigger: TriggerNode,
  step: StepNode,
};

function stepNodeId(stepKey: string): string {
  return `step:${stepKey}`;
}

function parseStepKey(nodeId: string): string | null {
  if (!nodeId.startsWith('step:')) {
    return null;
  }

  return nodeId.slice(5);
}

export function WorkflowGraphCanvas({
  draft,
  selection,
  onSelectionChange,
  onAddStep,
  onAddEdge,
  onStepPositionChange,
}: WorkflowGraphCanvasProps) {
  const baseNodes = useMemo<Node[]>(() => {
    const graphNodes: Node[] = [
      {
        id: TRIGGER_NODE_ID,
        type: 'trigger',
        position: { x: 80, y: 48 },
        data: {
          title: 'Trigger',
          subtitle: draft.trigger.type,
          onCreateStep: (type: StepType) => onAddStep(type),
        },
        draggable: false,
      },
    ];

    draft.steps.forEach((step) => {
      graphNodes.push({
        id: stepNodeId(step.key),
        type: 'step',
        position: step.position,
        data: {
          stepKey: step.key,
          stepId: step.id,
          stepType: step.type,
          onCreateStep: (fromStepKey: string, type: StepType) => onAddStep(type, fromStepKey),
        },
      });
    });

    return graphNodes;
  }, [
    draft.steps,
    draft.trigger.type,
    onAddStep,
  ]);

  const [graphNodes, setGraphNodes] = useState<Node[]>(baseNodes);

  useEffect(() => {
    setGraphNodes((currentNodes) => {
      const byId = new Map(currentNodes.map((node) => [node.id, node]));
      return baseNodes.map((node) => {
        if (node.id === TRIGGER_NODE_ID) {
          return node;
        }

        const existing = byId.get(node.id);
        if (!existing) {
          return node;
        }

        // Preserve in-progress drag coordinates while still refreshing node data props.
        return {
          ...node,
          position: existing.position,
        };
      });
    });
  }, [baseNodes]);

  const edges = useMemo<Edge[]>(() => {
    return draft.edges.map((edge) => {
      return {
        id: edge.key,
        source: stepNodeId(edge.fromStepKey),
        target: stepNodeId(edge.toStepKey),
        label: edge.condition || undefined,
        animated: false,
        style: { stroke: 'var(--color-border-hover)', strokeWidth: 2 },
        labelStyle: {
          fontSize: 11,
          fill: 'var(--color-text-secondary)',
        },
      };
    });
  }, [draft.edges]);

  const defaultViewport = useMemo(() => ({ x: -90, y: 0, zoom: 0.9 }), []);

  const onNodesChange = useCallback<OnNodesChange>((changes) => {
    setGraphNodes((nodes) => applyNodeChanges(changes, nodes));
  }, []);

  const onEdgesChange = useCallback<OnEdgesChange>(() => {
    // Edge editing by drag/selection will be expanded in next iteration.
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceKey = parseStepKey(connection.source ?? '');
      const targetKey = parseStepKey(connection.target ?? '');

      if (!sourceKey || !targetKey) {
        return;
      }

      onAddEdge(sourceKey, targetKey);
    },
    [onAddEdge]
  );

  const selectedNodeId =
    selection.kind === 'trigger'
      ? TRIGGER_NODE_ID
      : selection.kind === 'step'
        ? stepNodeId(selection.stepKey)
        : '';

  const decoratedNodes = useMemo(
    () =>
      graphNodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [graphNodes, selectedNodeId]
  );

  return (
    <div className="h-full min-h-0 w-full overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface-muted)">
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        defaultViewport={defaultViewport}
        minZoom={0.35}
        maxZoom={1.5}
        onNodeDragStop={(_, node) => {
          const stepKey = parseStepKey(node.id);
          if (!stepKey) {
            return;
          }

          onStepPositionChange(stepKey, node.position);
        }}
        onNodeClick={(event, node) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-node-control="true"]')) {
            return;
          }

          if (node.id === TRIGGER_NODE_ID) {
            onSelectionChange({ kind: 'trigger' });
            return;
          }

          const stepKey = parseStepKey(node.id);
          if (stepKey) {
            onSelectionChange({
              kind: 'step',
              stepKey,
              panel:
                selection.kind === 'step' && selection.stepKey === stepKey
                  ? selection.panel
                  : 'retry',
            });
          }
        }}
        onPaneClick={() => {
          onSelectionChange({ kind: 'canvas' });
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="var(--color-border-subtle)" />
        <MiniMap
          className="ff-workflow-minimap"
          zoomable
          pannable
          nodeColor="var(--color-primary)"
          maskColor="color-mix(in srgb, var(--color-surface-base), transparent 35%)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
