export const WEBHOOK_RESERVED_KEYS = new Set([
  'path',
  'endpoint',
  'url',
  'method',
  'secret',
  'signingSecret',
  'token',
  'requireSignature',
  'verifySignature',
]);

export const SCHEDULE_RESERVED_KEYS = new Set(['cron', 'expression', 'timezone', 'tz']);

export function normalizeWebhookPath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

export function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseJsonObject(text: string): { value?: Record<string, unknown>; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { value: {} };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { error: 'Must be a valid JSON object.' };
    }

    return { value: parsed as Record<string, unknown> };
  } catch {
    return { error: 'Invalid JSON syntax.' };
  }
}

export function omitReservedKeys(
  value: Record<string, unknown>,
  reservedKeys: Set<string>
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !reservedKeys.has(key)));
}

export function hasReservedKeys(value: Record<string, unknown>, reservedKeys: Set<string>): boolean {
  return Object.keys(value).some((key) => reservedKeys.has(key));
}

export function createBuilderKey(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
