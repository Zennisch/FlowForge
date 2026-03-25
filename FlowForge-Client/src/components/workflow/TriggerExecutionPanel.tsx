'use client';

import { json, jsonParseLinter } from '@codemirror/lang-json';
import { lintGutter, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';

import ZButton from '@/components/primary/ZButton';
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

  const editorExtensions = useMemo(() => [json(), linter(jsonParseLinter()), lintGutter()], []);

  const editorTheme = useMemo(
    () =>
      EditorView.theme({
        '&': {
          fontSize: '13px',
        },
        '.cm-scroller': {
          fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        },
        '.cm-gutters': {
          borderRight: '1px solid #e4e4e7',
          backgroundColor: '#fafafa',
          color: '#71717a',
        },
        '.cm-content': {
          padding: '12px 0',
        },
        '.cm-line': {
          padding: '0 12px',
        },
        '.cm-activeLine': {
          backgroundColor: '#f8fafc',
        },
      }),
    []
  );

  const payloadHasSyntaxError = useMemo(() => {
    if (!payloadInput.trim()) {
      return false;
    }

    try {
      JSON.parse(payloadInput);
      return false;
    } catch {
      return true;
    }
  }, [payloadInput]);

  const runExecution = async () => {
    if (!workflow) {
      return;
    }

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

  const formatPayload = () => {
    if (!payloadInput.trim()) {
      return;
    }

    try {
      const payload = parsePayload(payloadInput);
      setPayloadInput(payload ? JSON.stringify(payload, null, 2) : '');
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Payload JSON is invalid.');
    }
  };

  return (
    <AnimatePresence>
      {open && workflow ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
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

          <motion.aside
            className="absolute right-0 top-0 flex h-dvh max-h-dvh w-full flex-col border-l border-(--color-border) shadow-xl sm:w-176"
            initial={{ x: '100%', backgroundColor: '#ffffff' }}
            animate={{ x: 0, backgroundColor: '#ffffff' }}
            exit={{ x: '100%', backgroundColor: '#ffffff' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-(--color-border) bg-white px-5 py-4">
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

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="trigger-workflow-payload"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Payload (JSON object)
                  </label>
                  <button
                    type="button"
                    onClick={formatPayload}
                    disabled={triggerWorkflowMutation.isPending}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {'{}'} Format JSON
                  </button>
                </div>

                <div
                  className={`overflow-hidden rounded-md border bg-white transition-colors focus-within:border-(--color-primary) ${
                    payloadHasSyntaxError ? 'border-red-400' : 'border-zinc-300'
                  }`}
                >
                  <CodeMirror
                    id="trigger-workflow-payload"
                    value={payloadInput}
                    onChange={(value) => {
                      setPayloadInput(value);
                    }}
                    placeholder={['{', '  "orderId": "A-1001",', '  "source": "manual"', '}'].join(
                      '\n'
                    )}
                    height="320px"
                    basicSetup={{
                      lineNumbers: true,
                      highlightActiveLineGutter: true,
                      foldGutter: false,
                      autocompletion: false,
                    }}
                    extensions={editorExtensions}
                    theme={editorTheme}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="trigger-workflow-idempotency-key"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Idempotency key
                  </label>
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center text-zinc-400"
                    title="Optional. Providing a unique key ensures that retrying this execution will not result in duplicate side effects."
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>

                <input
                  id="trigger-workflow-idempotency-key"
                  type="text"
                  placeholder="optional-unique-key"
                  value={idempotencyKey}
                  onChange={(event) => {
                    setIdempotencyKey(event.target.value);
                  }}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-(--color-primary)"
                />

                <p className="text-xs text-zinc-500">
                  Optional. Providing a unique key ensures that retrying this execution will not
                  result in duplicate side effects.
                </p>
              </div>

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

            <div className="mt-auto flex items-center justify-end gap-2 border-t border-(--color-border) bg-white px-5 py-3">
              <ZButton
                size="sm"
                variant="secondary"
                onClick={onClose}
                disabled={triggerWorkflowMutation.isPending}
              >
                Cancel
              </ZButton>
              <ZButton
                size="sm"
                onClick={() => {
                  void runExecution();
                }}
                loading={triggerWorkflowMutation.isPending}
                loadingText="Running..."
                disabled={triggerWorkflowMutation.isPending}
              >
                Run Execution
              </ZButton>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
