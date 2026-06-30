'use client';

import MonacoEditor from '@monaco-editor/react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Loader2,
  PlayCircle,
  SkipForward,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/components/primary/utils';
import type { ExecutionEvent, StepExecution, StepStatus } from '@/types/execution.types';

interface StepExecutionTimelineProps {
  executionId: string;
  steps: StepExecution[];
  events: ExecutionEvent[];
  selectedStepId?: string | null;
  onSelectedStepChange?: (stepId: string) => void;
}

type StepTab = 'input' | 'output' | 'error' | 'events';

interface StepDebugGroup {
  id: string;
  executionId: string;
  stepId: string;
  status: StepStatus;
  attempt: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt?: string;
  completedAt?: string;
  events: ExecutionEvent[];
}

const STEP_STATUS_CONFIG: Record<
  StepStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    badgeClassName: string;
    iconClassName: string;
  }
> = {
  queued: {
    label: 'Queued',
    icon: Clock3,
    badgeClassName: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
    iconClassName: 'text-slate-500',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    badgeClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
    iconClassName: 'text-blue-600',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    badgeClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
    iconClassName: 'text-emerald-600',
  },
  failed: {
    label: 'Failed',
    icon: AlertCircle,
    badgeClassName: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200',
    iconClassName: 'text-red-600',
  },
  skipped: {
    label: 'Skipped',
    icon: SkipForward,
    badgeClassName: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-200',
    iconClassName: 'text-zinc-500',
  },
};

const EVENT_LABELS: Partial<Record<ExecutionEvent['type'], string>> = {
  'execution.started': 'Execution started',
  'execution.completed': 'Execution completed',
  'execution.failed': 'Execution failed',
  'execution.cancelled': 'Execution cancelled',
  'execution.compensating': 'Execution compensating',
  'step.queued': 'Step queued',
  'step.started': 'Step started',
  'step.completed': 'Step completed',
  'step.failed': 'Step failed',
  'step.skipped': 'Step skipped',
  'step.retrying': 'Step retrying',
  'step.compensation.started': 'Step compensation started',
  'step.compensation.completed': 'Step compensation completed',
  'step.compensation.failed': 'Step compensation failed',
};

function formatEventLabel(type: ExecutionEvent['type']): string {
  return EVENT_LABELS[type] ?? type;
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function getObjectFromPayload(payload: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = payload[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function getErrorFromPayload(payload: Record<string, unknown>): string | null {
  const error = payload.error;
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    return formatJson(error);
  }

  return null;
}

function deriveStatusFromEvents(events: ExecutionEvent[]): StepStatus {
  let status: StepStatus = 'queued';

  for (const event of events) {
    if (event.type === 'step.started' || event.type === 'step.retrying') {
      status = 'running';
    }

    if (event.type === 'step.completed') {
      status = 'completed';
    }

    if (event.type === 'step.failed') {
      status = 'failed';
    }

    if (event.type === 'step.skipped') {
      status = 'skipped';
    }
  }

  return status;
}

function buildStepGroups(
  executionId: string,
  steps: StepExecution[],
  events: ExecutionEvent[]
): StepDebugGroup[] {
  const eventsByStep = new Map<string, ExecutionEvent[]>();

  for (const event of events) {
    if (!event.stepId) {
      continue;
    }

    eventsByStep.set(event.stepId, [...(eventsByStep.get(event.stepId) ?? []), event]);
  }

  const groups = new Map<string, StepDebugGroup>();

  for (const step of steps) {
    groups.set(step.stepId, {
      id: step.id || step.stepId,
      executionId: step.executionId || executionId,
      stepId: step.stepId,
      status: step.status,
      attempt: step.attempt,
      input: step.input ?? {},
      output: step.output ?? null,
      error: step.error ?? null,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      events: eventsByStep.get(step.stepId) ?? [],
    });
  }

  for (const [stepId, stepEvents] of eventsByStep.entries()) {
    if (groups.has(stepId)) {
      const group = groups.get(stepId);
      if (group) {
        group.events = stepEvents;
      }
      continue;
    }

    let attempt = 0;
    let startedAt: string | undefined;
    let completedAt: string | undefined;
    let input: Record<string, unknown> = {};
    let output: Record<string, unknown> | null = null;
    let error: string | null = null;

    for (const event of stepEvents) {
      const eventAttempt = event.payload.attempt;
      if (typeof eventAttempt === 'number') {
        attempt = eventAttempt;
      }

      if (event.type === 'step.started') {
        startedAt = event.createdAt;
        input = getObjectFromPayload(event.payload, 'input') ?? input;
      }

      if (event.type === 'step.completed') {
        completedAt = event.createdAt;
        output = getObjectFromPayload(event.payload, 'output') ?? output;
      }

      if (event.type === 'step.failed') {
        completedAt = event.createdAt;
        error = getErrorFromPayload(event.payload) ?? error;
      }
    }

    groups.set(stepId, {
      id: stepId,
      executionId,
      stepId,
      status: deriveStatusFromEvents(stepEvents),
      attempt,
      input,
      output,
      error,
      startedAt,
      completedAt,
      events: stepEvents,
    });
  }

  return Array.from(groups.values());
}

function formatDateTime(value?: string): string {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(startedAt?: string, completedAt?: string, status?: StepStatus): string {
  if (!startedAt) {
    return 'Not started';
  }

  const startTime = new Date(startedAt).getTime();
  if (Number.isNaN(startTime)) {
    return 'N/A';
  }

  if (!completedAt) {
    return status === 'running' ? 'Running' : 'In progress';
  }

  const endTime = new Date(completedAt).getTime();
  if (Number.isNaN(endTime) || endTime < startTime) {
    return 'N/A';
  }

  const elapsedSeconds = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function defaultOpenStepId(groups: StepDebugGroup[]): string | null {
  return (
    groups.find((group) => group.status === 'failed')?.stepId ??
    groups.find((group) => group.status === 'running')?.stepId ??
    groups[0]?.stepId ??
    null
  );
}

function useEditorTheme(): 'light' | 'vs-dark' {
  const [editorTheme, setEditorTheme] = useState<'light' | 'vs-dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => {
      setEditorTheme(root.classList.contains('dark') ? 'vs-dark' : 'light');
    };
    const observer = new MutationObserver(updateTheme);

    updateTheme();
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  return editorTheme;
}

function getTabValue(group: StepDebugGroup, tab: StepTab): { value: string; empty: string } {
  if (tab === 'input') {
    return {
      value: Object.keys(group.input).length > 0 ? formatJson(group.input) : '',
      empty: 'No input captured',
    };
  }

  if (tab === 'output') {
    return { value: formatJson(group.output), empty: 'No output captured' };
  }

  if (tab === 'error') {
    return { value: group.error ?? '', empty: 'No error' };
  }

  return {
    value: formatJson(
      group.events.map((event) => ({
        type: event.type,
        stepId: event.stepId,
        occurredAt: event.createdAt,
        payload: event.payload,
      }))
    ),
    empty: 'No raw events captured',
  };
}

function CodePanel({
  value,
  empty,
  language = 'json',
}: {
  value: string;
  empty: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const hasValue = value.trim().length > 0;
  const editorTheme = useEditorTheme();

  async function handleCopy(): Promise<void> {
    if (!hasValue) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface-muted)">
      <div className="flex items-center justify-between border-b border-(--color-border) px-2 py-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-(--color-text-secondary)">
          {language === 'json' ? 'JSON' : 'Text'}
        </span>
        <button
          type="button"
          disabled={!hasValue}
          onClick={() => {
            void handleCopy();
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--color-text-secondary) transition-colors hover:bg-(--color-surface-base) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Copy content"
          title="Copy"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {hasValue ? (
        <MonacoEditor
          value={value}
          language={language}
          height="260px"
          theme={editorTheme}
          options={{
            automaticLayout: true,
            domReadOnly: true,
            folding: false,
            lineNumbers: 'on',
            minimap: { enabled: false },
            readOnly: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: 'off',
          }}
        />
      ) : (
        <div className="flex min-h-[180px] items-center justify-center px-4 text-sm text-(--color-text-secondary)">
          {empty}
        </div>
      )}
    </div>
  );
}

function StepEvents({ events }: { events: ExecutionEvent[] }) {
  if (events.length === 0) {
    return <CodePanel value="" empty="No raw events captured" />;
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="rounded-lg border border-(--color-border) bg-(--color-surface-base) p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-(--color-text-primary)">
              {formatEventLabel(event.type)}
            </span>
            <span className="text-xs text-(--color-text-secondary)">
              {formatDateTime(event.createdAt)}
            </span>
          </div>
          <div className="mt-2">
            <CodePanel value={formatJson(event.payload)} empty="No payload captured" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StepAccordionItem({
  group,
  isOpen,
  onToggle,
}: {
  group: StepDebugGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [activeTab, setActiveTab] = useState<StepTab>('output');
  const statusConfig = STEP_STATUS_CONFIG[group.status];
  const StatusIcon = statusConfig.icon;
  const duration = formatDuration(group.startedAt, group.completedAt, group.status);
  const tabValue = getTabValue(group, activeTab);

  useEffect(() => {
    if (group.status === 'failed') {
      setActiveTab('error');
      return;
    }

    setActiveTab('output');
  }, [group.status, group.stepId]);

  return (
    <article className="overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface-base) shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--color-surface-muted)"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--color-surface-muted)">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              statusConfig.iconClassName,
              group.status === 'running' && 'animate-spin'
            )}
          />
        </span>
        <span className="min-w-[12rem] flex-1">
          <span className="block text-sm font-semibold text-(--color-text-primary)">
            {group.stepId}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-(--color-text-secondary)">
            <span>Attempt {group.attempt || 0}</span>
            <span>{duration}</span>
            <span>{group.events.length} raw events</span>
          </span>
        </span>
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
            statusConfig.badgeClassName
          )}
        >
          {statusConfig.label}
        </span>
        <span className="hidden text-xs text-(--color-text-secondary) sm:inline">
          {formatDateTime(group.startedAt)} - {formatDateTime(group.completedAt)}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-(--color-text-secondary) transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen ? (
        <div className="border-t border-(--color-border) bg-(--color-surface-muted)/50 p-3">
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {(['input', 'output', 'error', 'events'] as StepTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                }}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                  activeTab === tab
                    ? 'border-(--color-primary) bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-100'
                    : 'border-(--color-border) bg-(--color-surface-base) text-(--color-text-secondary) hover:border-(--color-primary) hover:text-(--color-primary)'
                )}
              >
                {tab === 'events' ? 'Raw Events' : tab}
              </button>
            ))}
          </div>

          {activeTab === 'events' ? (
            <StepEvents events={group.events} />
          ) : (
            <CodePanel
              value={tabValue.value}
              empty={tabValue.empty}
              language={activeTab === 'error' ? 'text' : 'json'}
            />
          )}
        </div>
      ) : null}
    </article>
  );
}

export function StepExecutionTimeline({
  executionId,
  steps,
  events,
  selectedStepId,
  onSelectedStepChange,
}: StepExecutionTimelineProps) {
  const groups = useMemo(
    () => buildStepGroups(executionId, steps, events),
    [events, executionId, steps]
  );
  const [openStepId, setOpenStepId] = useState<string | null>(() => defaultOpenStepId(groups));

  useEffect(() => {
    setOpenStepId((current) => {
      if (current && groups.some((group) => group.stepId === current)) {
        return current;
      }

      return defaultOpenStepId(groups);
    });
  }, [groups]);

  useEffect(() => {
    if (!selectedStepId || !groups.some((group) => group.stepId === selectedStepId)) {
      return;
    }

    setOpenStepId(selectedStepId);
  }, [groups, selectedStepId]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-5 text-sm text-(--color-text-secondary) dark:bg-blue-500/10">
        No step execution data yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <StepAccordionItem
          key={group.stepId}
          group={group}
          isOpen={openStepId === group.stepId}
          onToggle={() => {
            setOpenStepId((current) => {
              const next = current === group.stepId ? null : group.stepId;
              if (next) {
                onSelectedStepChange?.(next);
              }
              return next;
            });
          }}
        />
      ))}
    </div>
  );
}

export function ExecutionLevelEvents({ events }: { events: ExecutionEvent[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-(--color-border) bg-(--color-surface-base)">
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => !current);
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-(--color-surface-muted)"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
          <PlayCircle className="h-4 w-4 text-(--color-primary)" />
          Execution Events
        </span>
        <span className="flex items-center gap-2 text-xs text-(--color-text-secondary)">
          {events.length} events
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
          />
        </span>
      </button>
      {isOpen ? (
        <div className="space-y-2 border-t border-(--color-border) bg-(--color-surface-muted)/50 p-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-lg border border-(--color-border) bg-(--color-surface-base) p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-(--color-text-primary)">
                  {formatEventLabel(event.type)}
                </span>
                <span className="text-xs text-(--color-text-secondary)">
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
              <div className="mt-2">
                <CodePanel value={formatJson(event.payload)} empty="No payload captured" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
