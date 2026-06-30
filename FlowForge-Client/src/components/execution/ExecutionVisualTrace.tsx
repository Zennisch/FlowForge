'use client';

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Globe,
  Loader2,
  Shuffle,
  SkipForward,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';

import { cn } from '@/components/primary/utils';
import type { StepExecution, StepStatus } from '@/types/execution.types';
import type { StepType, Workflow } from '@/types/workflow.types';

import 'reactflow/dist/style.css';

interface ExecutionVisualTraceProps {
  workflow?: Workflow;
  steps: StepExecution[];
  selectedStepId: string | null;
  onStepSelect: (stepId: string) => void;
}

interface TraceNodeData {
  title: string;
  subtitle: string;
  status: StepStatus | 'trigger' | 'not-run';
  stepType?: StepType;
}

const TRIGGER_NODE_ID = 'trigger';

const STATUS_CONFIG: Record<
  StepStatus | 'trigger' | 'not-run',
  { label: string; className: string; iconClassName: string; icon: typeof CheckCircle2 }
> = {
  trigger: {
    label: 'Trigger',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/35 dark:bg-blue-500/15 dark:text-blue-100',
    iconClassName: 'text-blue-600',
    icon: Zap,
  },
  queued: {
    label: 'Queued',
    className:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/35 dark:bg-slate-500/15 dark:text-slate-200',
    iconClassName: 'text-slate-500',
    icon: Clock3,
  },
  running: {
    label: 'Running',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/35 dark:bg-blue-500/15 dark:text-blue-100',
    iconClassName: 'text-blue-600',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-100',
    iconClassName: 'text-emerald-600',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-100',
    iconClassName: 'text-red-600',
    icon: AlertCircle,
  },
  skipped: {
    label: 'Skipped',
    className:
      'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-500/35 dark:bg-zinc-500/15 dark:text-zinc-200',
    iconClassName: 'text-zinc-500',
    icon: SkipForward,
  },
  'not-run': {
    label: 'Not run',
    className:
      'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-500/35 dark:bg-zinc-500/10 dark:text-zinc-300',
    iconClassName: 'text-zinc-400',
    icon: Clock3,
  },
};

function stepNodeId(stepId: string): string {
  return `step:${stepId}`;
}

function parseStepId(nodeId: string): string | null {
  if (!nodeId.startsWith('step:')) {
    return null;
  }

  return nodeId.slice(5);
}

function getStepIcon(type?: StepType) {
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

function computeLayout(workflow: Workflow): Map<string, { x: number; y: number }> {
  const stepIds = workflow.steps.map((step) => step.id);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  stepIds.forEach((id) => {
    incoming.set(id, 0);
    outgoing.set(id, []);
  });

  workflow.edges.forEach((edge) => {
    if (!incoming.has(edge.to) || !outgoing.has(edge.from)) {
      return;
    }

    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  });

  const queue = stepIds.filter((id) => (incoming.get(id) ?? 0) === 0);
  const level = new Map<string, number>();
  queue.forEach((id) => level.set(id, 0));

  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor];
    cursor += 1;

    const currentLevel = level.get(current) ?? 0;
    for (const child of outgoing.get(current) ?? []) {
      level.set(child, Math.max(level.get(child) ?? 0, currentLevel + 1));
      const nextIncoming = (incoming.get(child) ?? 0) - 1;
      incoming.set(child, nextIncoming);
      if (nextIncoming === 0) {
        queue.push(child);
      }
    }
  }

  const groups = new Map<number, string[]>();
  stepIds.forEach((id) => {
    const nodeLevel = level.get(id) ?? 0;
    groups.set(nodeLevel, [...(groups.get(nodeLevel) ?? []), id]);
  });

  const positions = new Map<string, { x: number; y: number }>();
  [...groups.keys()]
    .sort((a, b) => a - b)
    .forEach((nodeLevel) => {
      const ids = groups.get(nodeLevel) ?? [];
      ids.forEach((id, index) => {
        positions.set(id, {
          x: 360 + nodeLevel * 320,
          y: 40 + index * 170,
        });
      });
    });

  return positions;
}

function TraceNode({ data, selected }: NodeProps<TraceNodeData>) {
  const statusConfig = STATUS_CONFIG[data.status];
  const StatusIcon = statusConfig.icon;
  const StepIcon = data.status === 'trigger' ? Zap : getStepIcon(data.stepType);
  const isNotRun = data.status === 'not-run';

  return (
    <div
      className={cn(
        'min-w-56 rounded-xl border bg-(--color-surface-raised) p-3 shadow-sm transition-all',
        selected
          ? 'border-(--color-primary) ring-2 ring-blue-100 dark:ring-blue-500/20'
          : 'border-(--color-border)',
        isNotRun && 'opacity-50'
      )}
    >
      {data.status !== 'trigger' ? (
        <Handle
          type="target"
          position={Position.Left}
          className="h-2.5! w-2.5! border-2! border-(--color-surface-raised)! bg-(--color-border-hover)!"
          isConnectable={false}
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-(--color-text-secondary)">
            {data.subtitle}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-(--color-text-primary)">
            {data.title}
          </h3>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--color-surface-muted) text-(--color-primary)">
          <StepIcon className="h-4 w-4" />
        </span>
      </div>
      <span
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
          statusConfig.className
        )}
      >
        <StatusIcon
          className={cn(
            'h-3 w-3',
            statusConfig.iconClassName,
            data.status === 'running' && 'animate-spin'
          )}
        />
        {statusConfig.label}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        className="h-2.5! w-2.5! border-2! border-(--color-surface-raised)! bg-(--color-primary)!"
        isConnectable={false}
      />
    </div>
  );
}

const nodeTypes = {
  trace: TraceNode,
};

export function ExecutionVisualTrace({
  workflow,
  steps,
  selectedStepId,
  onStepSelect,
}: ExecutionVisualTraceProps) {
  const stepStatusById = useMemo(() => {
    return new Map(steps.map((step) => [step.stepId, step.status]));
  }, [steps]);

  const nodes = useMemo<Node<TraceNodeData>[]>(() => {
    if (!workflow) {
      return [];
    }

    const positions = computeLayout(workflow);
    const graphNodes: Node<TraceNodeData>[] = [
      {
        id: TRIGGER_NODE_ID,
        type: 'trace',
        position: { x: 40, y: 40 },
        selectable: false,
        draggable: false,
        data: {
          title: 'Trigger',
          subtitle: workflow.trigger.type,
          status: 'trigger',
        },
      },
    ];

    workflow.steps.forEach((step, index) => {
      graphNodes.push({
        id: stepNodeId(step.id),
        type: 'trace',
        position: positions.get(step.id) ?? { x: 360 + index * 320, y: 40 },
        draggable: false,
        selected: selectedStepId === step.id,
        data: {
          title: step.id,
          subtitle: `${step.type} step`,
          stepType: step.type,
          status: stepStatusById.get(step.id) ?? 'not-run',
        },
      });
    });

    return graphNodes;
  }, [selectedStepId, stepStatusById, workflow]);

  const edges = useMemo<Edge[]>(() => {
    if (!workflow) {
      return [];
    }

    const incomingStepIds = new Set(workflow.edges.map((edge) => edge.to));
    const rootStepIds = workflow.steps
      .map((step) => step.id)
      .filter((stepId) => !incomingStepIds.has(stepId));

    const triggerEdges: Edge[] = rootStepIds.map((stepId) => {
      const targetStatus = stepStatusById.get(stepId);
      const isVisited = Boolean(targetStatus);

      return {
        id: `${TRIGGER_NODE_ID}:${stepId}`,
        source: TRIGGER_NODE_ID,
        target: stepNodeId(stepId),
        type: 'smoothstep',
        animated: targetStatus === 'running',
        style: {
          stroke: isVisited ? 'var(--color-primary)' : 'var(--color-border)',
          strokeWidth: isVisited ? 2.5 : 1.5,
          opacity: isVisited ? 1 : 0.45,
        },
      };
    });

    const workflowEdges = workflow.edges.map((edge) => {
      const sourceStatus = stepStatusById.get(edge.from);
      const targetStatus = stepStatusById.get(edge.to);
      const isVisited = Boolean(sourceStatus && targetStatus);
      const isFailedPath = sourceStatus === 'failed' || targetStatus === 'failed';

      return {
        id: `${edge.from}:${edge.to}`,
        source: stepNodeId(edge.from),
        target: stepNodeId(edge.to),
        type: 'smoothstep',
        label: edge.condition || undefined,
        animated: sourceStatus === 'running',
        style: {
          stroke: isFailedPath
            ? '#ef4444'
            : isVisited
              ? 'var(--color-primary)'
              : 'var(--color-border)',
          strokeWidth: isVisited ? 2.5 : 1.5,
          opacity: isVisited ? 1 : 0.45,
        },
        labelStyle: {
          fontSize: 11,
          fill: 'var(--color-text-secondary)',
        },
      };
    });

    return [...triggerEdges, ...workflowEdges];
  }, [stepStatusById, workflow]);

  if (!workflow) {
    return (
      <div className="rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-5 text-sm text-(--color-text-secondary) dark:bg-blue-500/10">
        Loading workflow trace...
      </div>
    );
  }

  if (workflow.steps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-5 text-sm text-(--color-text-secondary) dark:bg-blue-500/10">
        This workflow has no graph steps.
      </div>
    );
  }

  return (
    <div className="h-[360px] overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface-muted)">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.35}
        maxZoom={1.35}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => {
          const stepId = parseStepId(node.id);
          if (stepId) {
            onStepSelect(stepId);
          }
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="var(--color-border-subtle)" />
        <MiniMap
          className="ff-workflow-minimap"
          zoomable
          pannable
          nodeColor={(node) => {
            const status = (node.data as TraceNodeData).status;
            if (status === 'failed') {
              return '#ef4444';
            }
            if (status === 'completed') {
              return '#10b981';
            }
            if (status === 'running') {
              return '#2563eb';
            }
            return '#94a3b8';
          }}
          maskColor="color-mix(in srgb, var(--color-surface-base), transparent 35%)"
        />
        <Controls className="ff-workflow-controls" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
