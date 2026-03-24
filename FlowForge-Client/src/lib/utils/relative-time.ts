const SECOND_IN_MS = 1000;
const MINUTE_IN_MS = 60 * SECOND_IN_MS;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const WEEK_IN_MS = 7 * DAY_IN_MS;
const MONTH_IN_MS = 30 * DAY_IN_MS;
const YEAR_IN_MS = 365 * DAY_IN_MS;

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(value: string | Date, locale = 'en'): string {
  const date = toDate(value);
  if (!date) {
    return 'Unknown';
  }

  const now = Date.now();
  const elapsed = date.getTime() - now;
  const absElapsed = Math.abs(elapsed);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absElapsed < MINUTE_IN_MS) {
    return formatter.format(Math.round(elapsed / SECOND_IN_MS), 'second');
  }

  if (absElapsed < HOUR_IN_MS) {
    return formatter.format(Math.round(elapsed / MINUTE_IN_MS), 'minute');
  }

  if (absElapsed < DAY_IN_MS) {
    return formatter.format(Math.round(elapsed / HOUR_IN_MS), 'hour');
  }

  if (absElapsed < WEEK_IN_MS) {
    return formatter.format(Math.round(elapsed / DAY_IN_MS), 'day');
  }

  if (absElapsed < MONTH_IN_MS) {
    return formatter.format(Math.round(elapsed / WEEK_IN_MS), 'week');
  }

  if (absElapsed < YEAR_IN_MS) {
    return formatter.format(Math.round(elapsed / MONTH_IN_MS), 'month');
  }

  return formatter.format(Math.round(elapsed / YEAR_IN_MS), 'year');
}

export function formatAbsoluteDateTime(value: string | Date, locale = 'vi-VN'): string {
  const date = toDate(value);
  if (!date) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
