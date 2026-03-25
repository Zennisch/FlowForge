import type {
  BuildPayloadResult,
  BuilderEdgeDraft,
  BuilderStepDraft,
  WorkflowBuilderDraft,
  WorkflowBuilderValidationResult,
} from './types';
import {
  hasReservedKeys,
  isValidTimezone,
  normalizeWebhookPath,
  omitReservedKeys,
  parseJsonObject,
  SCHEDULE_RESERVED_KEYS,
  WEBHOOK_RESERVED_KEYS,
} from './helpers';
import type { Workflow } from '@/types/workflow.types';

function createDefaultStepPosition(index: number): { x: number; y: number } {
  return {
    x: 520,
    y: 40 + index * 250,
  };
}

function computeStepLayout(
  stepIds: string[],
  edges: Array<{ from: string; to: string }>
): Map<string, { x: number; y: number }> {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  stepIds.forEach((id) => {
    incoming.set(id, 0);
    outgoing.set(id, []);
  });

  edges.forEach((edge) => {
    if (!incoming.has(edge.to) || !outgoing.has(edge.from)) {
      return;
    }

    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  });

  const queue: string[] = stepIds.filter((id) => (incoming.get(id) ?? 0) === 0);
  const level = new Map<string, number>();
  queue.forEach((id) => level.set(id, 0));

  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor];
    cursor += 1;

    const currentLevel = level.get(current) ?? 0;
    const children = outgoing.get(current) ?? [];

    children.forEach((child) => {
      const nextLevel = Math.max(level.get(child) ?? 0, currentLevel + 1);
      level.set(child, nextLevel);

      const nextIncoming = (incoming.get(child) ?? 0) - 1;
      incoming.set(child, nextIncoming);
      if (nextIncoming === 0) {
        queue.push(child);
      }
    });
  }

  const groups = new Map<number, string[]>();
  stepIds.forEach((id) => {
    const nodeLevel = level.get(id) ?? 0;
    const list = groups.get(nodeLevel) ?? [];
    list.push(id);
    groups.set(nodeLevel, list);
  });

  const positions = new Map<string, { x: number; y: number }>();
  const sortedLevels = [...groups.keys()].sort((a, b) => a - b);

  sortedLevels.forEach((nodeLevel) => {
    const ids = groups.get(nodeLevel) ?? [];
    ids.sort((a, b) => a.localeCompare(b));

    ids.forEach((id, index) => {
      positions.set(id, {
        x: 420 + nodeLevel * 350,
        y: 40 + index * 250,
      });
    });
  });

  return positions;
}

function readStringFromConfig(config: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return '';
}

function readBooleanFromConfig(config: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return false;
}

function validateSteps(steps: BuilderStepDraft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Set<string>();

  if (steps.length === 0) {
    errors.steps = 'At least one step is required.';
    return errors;
  }

  steps.forEach((step) => {
    const normalizedId = step.id.trim();
    if (!normalizedId) {
      errors[`step:${step.key}:id`] = 'Step ID is required.';
    } else if (seen.has(normalizedId)) {
      errors[`step:${step.key}:id`] = 'Step ID must be unique.';
    } else {
      seen.add(normalizedId);
    }

    if (step.maxAttempts < 1 || step.maxAttempts > 10) {
      errors[`step:${step.key}:maxAttempts`] = 'Max attempts must be between 1 and 10.';
    }

    const parsedConfig = parseJsonObject(step.configText);
    if (parsedConfig.error) {
      errors[`step:${step.key}:configText`] = parsedConfig.error;
    }
  });

  return errors;
}

function validateEdges(edges: BuilderEdgeDraft[], steps: BuilderStepDraft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const stepKeySet = new Set(steps.map((step) => step.key));

  edges.forEach((edge) => {
    if (!stepKeySet.has(edge.fromStepKey)) {
      errors[`edge:${edge.key}:from`] = 'Edge source is invalid.';
    }

    if (!stepKeySet.has(edge.toStepKey)) {
      errors[`edge:${edge.key}:to`] = 'Edge target is invalid.';
    }
  });

  return errors;
}

function validateTrigger(draft: WorkflowBuilderDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const parsedAdditional = parseJsonObject(draft.trigger.additionalConfigText);

  if (parsedAdditional.error) {
    errors['trigger.additionalConfigText'] = parsedAdditional.error;
    return errors;
  }

  const additional = parsedAdditional.value ?? {};

  if (draft.trigger.type === 'webhook') {
    const webhookPath = normalizeWebhookPath(draft.trigger.webhookPath);
    if (!webhookPath) {
      errors['trigger.webhookPath'] = 'Webhook path is required.';
    } else if (!/^[A-Za-z0-9_-]+$/.test(webhookPath)) {
      errors['trigger.webhookPath'] =
        'Webhook path may only contain letters, numbers, underscore, and hyphen.';
    }

    if (hasReservedKeys(additional, WEBHOOK_RESERVED_KEYS)) {
      errors['trigger.additionalConfigText'] =
        'Additional trigger config contains reserved webhook keys.';
    }
  }

  if (draft.trigger.type === 'schedule') {
    if (!draft.trigger.scheduleCron.trim()) {
      errors['trigger.scheduleCron'] = 'Cron expression is required.';
    }

    if (
      draft.trigger.scheduleTimezone.trim() &&
      !isValidTimezone(draft.trigger.scheduleTimezone.trim())
    ) {
      errors['trigger.scheduleTimezone'] = 'Timezone must be a valid IANA timezone.';
    }

    if (hasReservedKeys(additional, SCHEDULE_RESERVED_KEYS)) {
      errors['trigger.additionalConfigText'] =
        'Additional trigger config contains reserved schedule keys.';
    }
  }

  return errors;
}

export function validateWorkflowBuilderDraft(draft: WorkflowBuilderDraft): WorkflowBuilderValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!draft.name.trim()) {
    fieldErrors.name = 'Workflow name is required.';
  }

  Object.assign(fieldErrors, validateTrigger(draft));
  Object.assign(fieldErrors, validateSteps(draft.steps));
  Object.assign(fieldErrors, validateEdges(draft.edges, draft.steps));

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export function buildCreateWorkflowPayload(draft: WorkflowBuilderDraft): BuildPayloadResult {
  const validation = validateWorkflowBuilderDraft(draft);
  if (!validation.isValid) {
    return { validation };
  }

  const parsedAdditional = parseJsonObject(draft.trigger.additionalConfigText).value ?? {};

  const triggerConfig: Record<string, unknown> =
    draft.trigger.type === 'manual'
      ? parsedAdditional
      : draft.trigger.type === 'webhook'
        ? {
            ...parsedAdditional,
            path: normalizeWebhookPath(draft.trigger.webhookPath),
            method: draft.trigger.webhookMethod,
            ...(draft.trigger.webhookSecret.trim()
              ? { secret: draft.trigger.webhookSecret.trim() }
              : {}),
            ...(draft.trigger.webhookRequireSignature ? { requireSignature: true } : {}),
          }
        : {
            ...parsedAdditional,
            cron: draft.trigger.scheduleCron.trim(),
            ...(draft.trigger.scheduleTimezone.trim()
              ? { timezone: draft.trigger.scheduleTimezone.trim() }
              : {}),
          };

  const stepByKey = new Map(draft.steps.map((step) => [step.key, step]));

  return {
    payload: {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      status: draft.status,
      trigger: {
        type: draft.trigger.type,
        config: triggerConfig,
      },
      steps: draft.steps.map((step) => ({
        id: step.id.trim(),
        type: step.type,
        config: parseJsonObject(step.configText).value ?? {},
        retry: {
          maxAttempts: step.maxAttempts,
          backoff: step.backoff,
        },
      })),
      edges: draft.edges
        .map((edge) => {
          const from = stepByKey.get(edge.fromStepKey);
          const to = stepByKey.get(edge.toStepKey);
          if (!from || !to) {
            return null;
          }

          return {
            from: from.id.trim(),
            to: to.id.trim(),
            condition: edge.condition.trim() || undefined,
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null),
    },
    validation,
  };
}

export function workflowToBuilderDraft(workflow?: Workflow): WorkflowBuilderDraft {
  if (!workflow) {
    return {
      name: '',
      description: '',
      status: 'active',
      trigger: {
        type: 'manual',
        webhookPath: '',
        webhookMethod: 'POST',
        webhookSecret: '',
        webhookRequireSignature: false,
        scheduleCron: '',
        scheduleTimezone: '',
        additionalConfigText: '{}',
      },
      steps: [],
      edges: [],
    };
  }

  const triggerConfig = workflow.trigger.config ?? {};
  const triggerType = workflow.trigger.type;

  const additionalConfig =
    triggerType === 'webhook'
      ? omitReservedKeys(triggerConfig, WEBHOOK_RESERVED_KEYS)
      : triggerType === 'schedule'
        ? omitReservedKeys(triggerConfig, SCHEDULE_RESERVED_KEYS)
        : triggerConfig;

  const stepKeyById = new Map<string, string>();
  const stepIds = workflow.steps.map((step) => step.id);
  const layout = computeStepLayout(
    stepIds,
    workflow.edges.map((edge) => ({ from: edge.from, to: edge.to }))
  );

  const steps = workflow.steps.map((step, index) => {
    const key = `step-${step.id}-${Math.random().toString(36).slice(2, 7)}`;
    stepKeyById.set(step.id, key);

    return {
      key,
      id: step.id,
      type: step.type,
      position: layout.get(step.id) ?? createDefaultStepPosition(index),
      maxAttempts: step.retry?.maxAttempts ?? 3,
      backoff: step.retry?.backoff ?? 'exponential',
      configText: JSON.stringify(step.config ?? {}, null, 2),
    };
  });

  const edges = workflow.edges
    .map((edge) => {
      const fromStepKey = stepKeyById.get(edge.from);
      const toStepKey = stepKeyById.get(edge.to);
      if (!fromStepKey || !toStepKey) {
        return null;
      }

      return {
        key: `edge-${Math.random().toString(36).slice(2, 9)}`,
        fromStepKey,
        toStepKey,
        condition: edge.condition ?? '',
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  const webhookMethod = readStringFromConfig(triggerConfig, ['method']).toUpperCase();

  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? '',
    status: workflow.status,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    trigger: {
      type: triggerType,
      webhookPath: readStringFromConfig(triggerConfig, ['path', 'endpoint', 'url']),
      webhookMethod:
        webhookMethod === 'GET' ||
        webhookMethod === 'POST' ||
        webhookMethod === 'PUT' ||
        webhookMethod === 'PATCH' ||
        webhookMethod === 'DELETE'
          ? webhookMethod
          : 'POST',
      webhookSecret: readStringFromConfig(triggerConfig, ['secret', 'signingSecret', 'token']),
      webhookRequireSignature: readBooleanFromConfig(triggerConfig, [
        'requireSignature',
        'verifySignature',
      ]),
      scheduleCron: readStringFromConfig(triggerConfig, ['cron', 'expression']),
      scheduleTimezone: readStringFromConfig(triggerConfig, ['timezone', 'tz']),
      additionalConfigText: JSON.stringify(additionalConfig, null, 2),
    },
    steps,
    edges,
  };
}
