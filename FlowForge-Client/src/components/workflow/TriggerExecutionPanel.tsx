'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import ZButton from '@/components/primary/ZButton';
import ZTextInput from '@/components/primary/ZTextInput';
import { useTriggerWorkflow } from '@/hooks/useWorkflows';
import type { Workflow } from '@/types/workflow.types';

interface TriggerExecutionPanelProps {
  open: boolean;
  workflow: Workflow | null;
  onClose: () => void;
}

function parsePayload(value: string): Record<string, unknown> | undefined {
  const text = value.trim();
  if (!text) {
    return undefined;
  }

  const parsed = JSON.parse(text) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Payload must be a valid JSON object.');
  }

  return parsed as Record<string, unknown>;
}

export function TriggerExecutionPanel({ open, workflow, onClose }: TriggerExecutionPanelProps) {
  const router = useRouter();
  const triggerWorkflowMutation = useTriggerWorkflow();
  const [payloadInput, setPayloadInput] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !triggerWorkflowMutation.isPending) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open, triggerWorkflowMutation.isPending]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    if (wasOpen && !open) {
      setPayloadInput('');
      setIdempotencyKey('');
      setFormError(null);
      triggerWorkflowMutation.reset();
    }

    wasOpenRef.current = open;
  }, [open, triggerWorkflowMutation]);

  const title = useMemo(() => {
    if (!workflow) {
      return 'Trigger workflow';
    }

    return `Trigger ${workflow.name}`;
  }, [workflow]);

  if (!open || !workflow) {
    return null;
  }

  const runExecution = async () => {
    setFormError(null);

    let payload: Record<string, unknown> | undefined;
    try {
      payload = parsePayload(payloadInput);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Payload JSON is invalid.');
      return;
    }

    const result = await triggerWorkflowMutation.mutateAsync({
      id: workflow.id,
      request: {
        payload,
        idempotencyKey: idempotencyKey.trim() || undefined,
      },
    });

    if (result.executionId) {
      router.push(`/executions/${result.executionId}`);
      return;
    }

    router.push(`/workflows/${workflow.id}/executions`);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close trigger panel"
        onClick={() => {
          if (!triggerWorkflowMutation.isPending) {
            onClose();
          }
        }}
        className="absolute inset-0 bg-(--color-overlay-modal)"
      />

      <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-(--color-border) bg-white shadow-xl sm:w-176">
        <div className="sticky top-0 flex items-center justify-between border-b border-(--color-border) bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-(--color-text-primary)">{title}</h2>
            <p className="mt-1 text-xs text-(--color-text-secondary)">
              Provide optional JSON payload and idempotency key before running this workflow.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={triggerWorkflowMutation.isPending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-(--color-text-secondary) transition-colors hover:border-(--color-border) hover:bg-(--color-surface-hover) disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
              Payload (JSON object)
            </span>
            <textarea
              value={payloadInput}
              onChange={(event) => {
                setPayloadInput(event.target.value);
              }}
              rows={11}
              placeholder='{"orderId":"A-1001","source":"manual"}'
              className="mt-1.5 w-full rounded-xl border border-(--color-border) bg-white px-3 py-2 font-mono text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-primary)"
            />
          </label>

          <ZTextInput
            label="Idempotency key"
            placeholder="optional-unique-key"
            value={idempotencyKey}
            onChange={(event) => {
              setIdempotencyKey(event.target.value);
            }}
          />

          {formError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          ) : null}

          {triggerWorkflowMutation.isError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {triggerWorkflowMutation.error.message}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-(--color-border) bg-white px-5 py-4">
          <ZButton
            variant="secondary"
            onClick={onClose}
            disabled={triggerWorkflowMutation.isPending}
          >
            Cancel
          </ZButton>
          <ZButton
            onClick={() => {
              void runExecution();
            }}
            loading={triggerWorkflowMutation.isPending}
            loadingText="Running..."
          >
            Run Execution
          </ZButton>
        </div>
      </aside>
    </div>
  );
}
