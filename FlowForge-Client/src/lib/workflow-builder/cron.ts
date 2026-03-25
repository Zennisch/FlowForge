import cronstrue from 'cronstrue';

export function cronToHumanText(expression: string): string {
  const value = expression.trim();
  if (!value) {
    return 'Enter a cron expression to preview its schedule.';
  }

  try {
    return cronstrue.toString(value, { use24HourTimeFormat: true });
  } catch {
    return 'Cron expression is invalid.';
  }
}
