import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EVENT_TYPES, EventType } from '../../event/execution-event.schema';

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    const result = value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return result.length > 0 ? result : undefined;
  }

  const parsed = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}

function toNumberOrDefault(value: unknown, fallback: number): unknown {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return value;
  }

  return value;
}

export class ListExecutionEventsQueryDto {
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsIn(EVENT_TYPES, { each: true })
  type?: EventType[];

  @IsOptional()
  @IsString()
  step_id?: string;

  @IsOptional()
  @IsISO8601()
  occurred_from?: string;

  @IsOptional()
  @IsISO8601()
  occurred_to?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => toNumberOrDefault(value, 50))
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
