'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { WorkflowForm } from '@/components/workflow/WorkflowForm';
import { useTriggerWorkflow, useUpdateWorkflow, useWorkflow } from '@/hooks/useWorkflows';
import type { CreateWorkflowRequest } from '@/types/workflow.types';

function getWorkflowId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();
  const workflowId = getWorkflowId(params.id);

  const workflowQuery = useWorkflow(workflowId);
  const updateWorkflowMutation = useUpdateWorkflow();
  const triggerWorkflowMutation = useTriggerWorkflow();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [triggerFormError, setTriggerFormError] = useState<string | null>(null);
  const [triggerPayloadInput, setTriggerPayloadInput] = useState('');
  const [idempotencyKeyInput, setIdempotencyKeyInput] = useState('');

  const handleUpdateWorkflow = async (payload: CreateWorkflowRequest) => {
    await updateWorkflowMutation.mutateAsync({ id: workflowId, payload });
    setSaveMessage('Workflow updated successfully.');
  };

  const handleTriggerWorkflow = async () => {
    setTriggerMessage(null);
    setTriggerFormError(null);

    let parsedPayload: Record<string, unknown> | undefined;
    const payloadText = triggerPayloadInput.trim();

    if (payloadText) {
      try {
        const jsonValue: unknown = JSON.parse(payloadText);
        if (!jsonValue || Array.isArray(jsonValue) || typeof jsonValue !== 'object') {
          setTriggerFormError('Payload must be a valid JSON object.');
          return;
        }

        parsedPayload = jsonValue as Record<string, unknown>;
      } catch {
        setTriggerFormError('Payload JSON is invalid. Please review the syntax.');
        return;
      }
    }

    const trimmedIdempotencyKey = idempotencyKeyInput.trim();

    const result = await triggerWorkflowMutation.mutateAsync({
      id: workflowId,
      request: {
        payload: parsedPayload,
        idempotencyKey: trimmedIdempotencyKey || undefined,
      },
    });

    if (result.executionId) {
      router.push(`/executions/${result.executionId}`);
      return;
    }

    setTriggerMessage('Workflow triggered successfully. Execution is now running.');
    router.push(`/workflows/${workflowId}/executions`);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <section className="rounded-2xl border border-(--color-border) bg-white p-6">
        <div>
          <div>
            <h1 className="text-xl font-semibold text-(--color-text-primary)">Workflow details</h1>
            <p className="mt-2 text-sm text-(--color-text-secondary)">
              Edit workflow metadata, steps, and DAG edge configuration.
            </p>
          </div>
        </div>

        {workflowQuery.isPending ? (
          <div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6 text-sm text-(--color-text-secondary)">
            Loading workflow...
          </div>
        ) : null}

        {workflowQuery.isError ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{workflowQuery.error.message}</p>
            <button
              type="button"
              onClick={() => {
                void workflowQuery.refetch();
              }}
              className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!workflowQuery.isPending && !workflowQuery.isError && !workflowQuery.data ? (
          <div className="mt-6 rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-6">
            <p className="text-sm text-(--color-text-secondary)">Workflow not found.</p>
            <Link
              href="/workflows"
              className="mt-3 inline-flex rounded-lg border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
            >
              Back to workflows
            </Link>
          </div>
        ) : null}

        {workflowQuery.data ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-(--color-border) bg-blue-50/40 p-4">
              <h2 className="text-sm font-semibold text-(--color-text-primary)">Manual trigger</h2>
              <p className="mt-1 text-xs text-(--color-text-secondary)">
                Optional fields: payload JSON object and idempotency key.
              </p>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-(--color-text-secondary)">
                    Payload (JSON object)
                  </span>
                  <textarea
                    value={triggerPayloadInput}
                    onChange={(event) => {
                      setTriggerPayloadInput(event.target.value);
                    }}
                    rows={6}
                    placeholder='{"orderId":"A-1001","source":"manual"}'
                    className="mt-1 w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-primary)"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-(--color-text-secondary)">
                    Idempotency key
                  </span>
                  <input
                    type="text"
                    value={idempotencyKeyInput}
                    onChange={(event) => {
                      setIdempotencyKeyInput(event.target.value);
                    }}
                    placeholder="optional-unique-key"
                    className="mt-1 w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-primary)"
                  />
                </label>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleTriggerWorkflow();
                  }}
                  disabled={
                    triggerWorkflowMutation.isPending ||
                    workflowQuery.isPending ||
                    workflowQuery.isError
                  }
                  className="inline-flex rounded-xl bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--color-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {triggerWorkflowMutation.isPending ? 'Triggering...' : 'Trigger now'}
                </button>
              </div>
            </div>

            {saveMessage ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {saveMessage}
              </p>
            ) : null}

            {triggerFormError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {triggerFormError}
              </p>
            ) : null}

            {triggerMessage ? (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-(--color-text-secondary)">
                {triggerMessage}
              </p>
            ) : null}

            {triggerWorkflowMutation.isError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {triggerWorkflowMutation.error.message}
              </p>
            ) : null}

            <WorkflowForm
              mode="edit"
              initialWorkflow={workflowQuery.data}
              isPending={updateWorkflowMutation.isPending}
              submitLabel="Save changes"
              submitError={
                updateWorkflowMutation.isError ? updateWorkflowMutation.error.message : undefined
              }
              onSubmit={async (payload) => {
                setSaveMessage(null);
                await handleUpdateWorkflow(payload);
              }}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
