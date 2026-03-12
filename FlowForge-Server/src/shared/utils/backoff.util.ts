const BASE_MS = 1_000;
const MAX_MS = 30_000;

export function computeBackoffMs(
  attempt: number,
  strategy: 'exponential' | 'fixed',
): number {
  if (strategy === 'fixed') return BASE_MS;
  return Math.min(BASE_MS * Math.pow(2, attempt), MAX_MS);
}

