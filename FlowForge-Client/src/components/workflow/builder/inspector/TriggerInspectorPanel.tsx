'use client';

import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';

import ZButton from '@/components/primary/ZButton';
import ZSelect from '@/components/primary/ZSelect';
import ZSwitch from '@/components/primary/ZSwitch';
import ZTextInput from '@/components/primary/ZTextInput';
import { cronToHumanText } from '@/lib/workflow-builder/cron';
import { normalizeWebhookPath } from '@/lib/workflow-builder/helpers';
import { getTimezoneOptions } from '@/lib/workflow-builder/timezone';
import type { WorkflowBuilderDraft } from '@/lib/workflow-builder/types';

import { JsonCodeEditor } from '../JsonCodeEditor';

interface TriggerInspectorPanelProps {
  draft: WorkflowBuilderDraft;
  fieldErrors: Record<string, string>;
  onUpdate: (updater: (draft: WorkflowBuilderDraft) => WorkflowBuilderDraft) => void;
}

const triggerTypeOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'Schedule', value: 'schedule' },
] as const;

const webhookMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
] as const;

export function TriggerInspectorPanel({ draft, fieldErrors, onUpdate }: TriggerInspectorPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const timezoneOptions = useMemo(
    () => getTimezoneOptions().map((zone) => ({ label: zone, value: zone })),
    []
  );

  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
  const normalizedPath = normalizeWebhookPath(draft.trigger.webhookPath);
  const fullWebhookUrl = normalizedPath
    ? `${apiBase || ''}/webhook/${draft.id || '(user-id)'}/${normalizedPath}`
    : `${apiBase || ''}/webhook/${draft.id || '(user-id)'}/<path>`;

  const cronDescription = cronToHumanText(draft.trigger.scheduleCron);

  const copyWebhookUrl = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(fullWebhookUrl);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">General Info</h3>
        <div className="mt-3">
          <ZTextInput
            label="Description"
            multiline
            rows={3}
            fullWidth
            value={draft.description}
            onChange={(event) => {
              const value = event.target.value;
              onUpdate((current) => ({ ...current, description: value }));
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">Trigger Configuration</h3>
        <div className="mt-3 space-y-3">
          <ZSelect
            label="Trigger Type"
            fullWidth
            options={triggerTypeOptions.map((option) => ({ ...option }))}
            value={draft.trigger.type}
            onChange={(value) => {
              onUpdate((current) => ({
                ...current,
                trigger: {
                  ...current.trigger,
                  type: value as typeof draft.trigger.type,
                },
              }));
            }}
          />

          {draft.trigger.type === 'webhook' ? (
            <>
              <div className="space-y-2 rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3">
                <p className="text-xs font-medium text-(--color-text-secondary)">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <span className="truncate rounded-lg border border-(--color-border) bg-(--color-surface-base) px-2 py-2 text-xs text-(--color-text-secondary)">
                    /webhook/{draft.id || '(user-id)'}/
                  </span>
                  <div className="min-w-0 flex-1">
                    <ZTextInput
                      fullWidth
                      value={draft.trigger.webhookPath}
                      placeholder="workflow-order-sync"
                      error={fieldErrors['trigger.webhookPath']}
                      onChange={(event) => {
                        const value = event.target.value;
                        onUpdate((current) => ({
                          ...current,
                          trigger: { ...current.trigger, webhookPath: value },
                        }));
                      }}
                    />
                  </div>
                  <ZButton
                    size="sm"
                    variant="secondary"
                    iconStart={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    onClick={() => {
                      void copyWebhookUrl();
                    }}
                  >
                    {copied ? 'Copied' : 'Copy URL'}
                  </ZButton>
                </div>
                <p className="truncate text-xs text-(--color-text-secondary)">{fullWebhookUrl}</p>
              </div>

              <ZSelect
                label="Method"
                fullWidth
                options={webhookMethodOptions.map((option) => ({ ...option }))}
                value={draft.trigger.webhookMethod}
                onChange={(value) => {
                  onUpdate((current) => ({
                    ...current,
                    trigger: {
                      ...current.trigger,
                      webhookMethod: value as typeof draft.trigger.webhookMethod,
                    },
                  }));
                }}
              />

              <ZTextInput
                label="Webhook Secret"
                fullWidth
                type={showSecret ? 'text' : 'password'}
                value={draft.trigger.webhookSecret}
                iconEnd={
                  <button
                    type="button"
                    className="text-(--color-text-secondary)"
                    onClick={() => {
                      setShowSecret((current) => !current);
                    }}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                onChange={(event) => {
                  const value = event.target.value;
                  onUpdate((current) => ({
                    ...current,
                    trigger: { ...current.trigger, webhookSecret: value },
                  }));
                }}
              />

              <ZSwitch
                label="Require signature validation"
                checked={draft.trigger.webhookRequireSignature}
                onChange={(event) => {
                  const checked = event.target.checked;
                  onUpdate((current) => ({
                    ...current,
                    trigger: { ...current.trigger, webhookRequireSignature: checked },
                  }));
                }}
              />
            </>
          ) : null}

          {draft.trigger.type === 'schedule' ? (
            <>
              <ZTextInput
                label="Cron Expression"
                fullWidth
                value={draft.trigger.scheduleCron}
                error={fieldErrors['trigger.scheduleCron']}
                placeholder="0 */5 * * *"
                onChange={(event) => {
                  const value = event.target.value;
                  onUpdate((current) => ({
                    ...current,
                    trigger: { ...current.trigger, scheduleCron: value },
                  }));
                }}
              />
              <p className="rounded-lg bg-(--color-surface-muted) px-3 py-2 text-xs text-(--color-text-secondary)">
                {cronDescription}
              </p>

              <ZSelect
                label="Timezone"
                fullWidth
                searchable
                options={timezoneOptions}
                value={draft.trigger.scheduleTimezone}
                error={fieldErrors['trigger.scheduleTimezone']}
                onChange={(value) => {
                  onUpdate((current) => ({
                    ...current,
                    trigger: {
                      ...current.trigger,
                      scheduleTimezone: value as string,
                    },
                  }));
                }}
              />
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-base) p-4">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">Additional Config (JSON)</h3>
        <p className="mt-1 text-xs text-(--color-text-secondary)">
          Extra keys merged into trigger.config while preserving reserved fields.
        </p>
        <div className="mt-3">
          <JsonCodeEditor
            value={draft.trigger.additionalConfigText}
            onChange={(value) => {
              onUpdate((current) => ({
                ...current,
                trigger: { ...current.trigger, additionalConfigText: value },
              }));
            }}
          />
          {fieldErrors['trigger.additionalConfigText'] ? (
            <p className="mt-2 text-xs text-(--color-error)">{fieldErrors['trigger.additionalConfigText']}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
