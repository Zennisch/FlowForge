'use client';

import { Check, ChevronDown, Copy, Info, X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';

import ZButton from '@/components/primary/ZButton';
import { cn } from '@/components/primary/utils';
import type { StepType, TriggerType } from '@/types/workflow.types';

interface InspectorSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  hasError?: boolean;
  badge?: ReactNode;
  description?: string;
  tone?: 'default' | 'danger';
}

export function InspectorSection({
  title,
  children,
  defaultOpen = false,
  hasError = false,
  badge,
  description,
  tone = 'default',
}: InspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen || hasError);
  const isDanger = tone === 'danger';

  useEffect(() => {
    if (hasError) {
      setOpen(true);
    }
  }, [hasError]);

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border bg-(--color-surface-base)',
        isDanger ? 'border-red-200 bg-red-50' : 'border-(--color-border)',
        hasError ? 'ring-2 ring-red-100' : ''
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <span className="min-w-0">
          <span
            className={cn(
              'block text-sm font-semibold',
              isDanger ? 'text-red-700' : 'text-(--color-text-primary)'
            )}
          >
            {title}
          </span>
          {description ? (
            <span
              className={cn(
                'mt-0.5 block text-xs',
                isDanger ? 'text-red-600' : 'text-(--color-text-secondary)'
              )}
            >
              {description}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          {hasError ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
              Error
            </span>
          ) : null}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open ? 'rotate-180' : '')}
          />
        </span>
      </button>

      {open ? <div className="border-t border-(--color-border) p-3">{children}</div> : null}
    </section>
  );
}

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 text-(--color-text-secondary)" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-(--color-border) bg-(--color-surface-base) px-3 py-2 text-xs font-normal leading-5 text-(--color-text-secondary) shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

interface DocEntry {
  title: string;
  summary: string;
  bullets: string[];
  example: string;
}

const STEP_DOCS: Record<StepType, DocEntry> = {
  http: {
    title: 'HTTP Step',
    summary: 'Call an external HTTP endpoint and expose the response to later steps.',
    bullets: ['Use method/url for the request.', 'Optional headers/body are passed as JSON objects.'],
    example: JSON.stringify(
      {
        method: 'POST',
        url: 'https://api.example.com/orders',
        headers: { 'Content-Type': 'application/json' },
        body: { orderId: '{{trigger.orderId}}' },
      },
      null,
      2
    ),
  },
  transform: {
    title: 'Transform Step',
    summary: 'Map fields from previous step outputs into a new object.',
    bullets: ['mapping keys become output fields.', 'Values can reference paths from upstream data.'],
    example: JSON.stringify(
      {
        mapping: {
          todoTitle: 'data.title',
          isDone: 'data.completed',
        },
      },
      null,
      2
    ),
  },
  store: {
    title: 'Store Step',
    summary: 'Persist a selected payload into the configured storage target.',
    bullets: ['Use collection/table for the target.', 'dataPath points to the payload to store.'],
    example: JSON.stringify(
      {
        collection: 'todos',
        dataPath: 'extract_data.output',
      },
      null,
      2
    ),
  },
  branch: {
    title: 'Branch Step',
    summary: 'Choose the next step based on a field value.',
    bullets: ['cases are evaluated in order.', 'default is used when no case matches.'],
    example: JSON.stringify(
      {
        field: 'isDone',
        cases: [{ value: true, next: 'store_done' }],
        default: 'store_pending',
      },
      null,
      2
    ),
  },
};

const TRIGGER_DOCS: Record<TriggerType, DocEntry> = {
  manual: {
    title: 'Manual Trigger',
    summary: 'Run this workflow manually from the dashboard or API.',
    bullets: ['Use additional config only for metadata needed by your app.'],
    example: JSON.stringify({ source: 'dashboard' }, null, 2),
  },
  webhook: {
    title: 'Webhook Trigger',
    summary: 'Expose an HTTP endpoint that starts the workflow when called.',
    bullets: ['Path should be stable and readable.', 'Secret validation can protect signed requests.'],
    example: JSON.stringify(
      {
        method: 'POST',
        path: 'order-created',
        requireSignature: true,
      },
      null,
      2
    ),
  },
  schedule: {
    title: 'Schedule Trigger',
    summary: 'Run this workflow on a cron schedule in a selected timezone.',
    bullets: ['Use standard cron syntax.', 'Timezone controls when the cron is evaluated.'],
    example: JSON.stringify(
      {
        cron: '0 */6 * * *',
        timezone: 'Asia/Tokyo',
      },
      null,
      2
    ),
  },
};

export function SchemaLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="text-xs font-medium text-(--color-primary) transition-colors hover:text-(--color-primary-hover)"
      onClick={onClick}
    >
      View Schema
    </button>
  );
}

export function InspectorDocsSlideOver({
  open,
  kind,
  stepType,
  triggerType,
  onClose,
}: {
  open: boolean;
  kind: 'step' | 'trigger';
  stepType?: StepType;
  triggerType?: TriggerType;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const entry = kind === 'step' ? STEP_DOCS[stepType ?? 'http'] : TRIGGER_DOCS[triggerType ?? 'manual'];

  const copyExample = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(entry.example);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1400);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-(--color-overlay-modal)">
      <aside className="h-full w-full max-w-105 overflow-y-auto border-l border-(--color-border) bg-(--color-surface-base) shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-(--color-border) bg-(--color-surface-base) px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-(--color-text-primary)">{entry.title}</h3>
            <p className="mt-1 text-xs leading-5 text-(--color-text-secondary)">{entry.summary}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-secondary) transition-colors hover:bg-(--color-surface-muted)"
            aria-label="Close schema"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3">
            <p className="text-xs font-semibold text-(--color-text-primary)">Notes</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-(--color-text-secondary)">
              {entry.bullets.map((bullet) => (
                <li key={bullet}>- {bullet}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-(--color-text-primary)">Example JSON</p>
              <ZButton
                size="xs"
                variant="secondary"
                iconStart={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                onClick={() => {
                  void copyExample();
                }}
              >
                Copy Example
              </ZButton>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-(--json-bg) p-3 text-xs leading-5 text-(--json-brace)">
              {entry.example}
            </pre>
          </div>
        </div>
      </aside>
    </div>
  );
}
