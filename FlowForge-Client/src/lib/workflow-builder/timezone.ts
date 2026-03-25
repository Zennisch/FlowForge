import { getTimeZones } from '@vvo/tzdb';

const timezoneOptions = getTimeZones()
  .map((zone) => zone.name)
  .filter((name, index, arr) => arr.indexOf(name) === index)
  .sort((a, b) => a.localeCompare(b));

export function getTimezoneOptions(): string[] {
  return timezoneOptions;
}
