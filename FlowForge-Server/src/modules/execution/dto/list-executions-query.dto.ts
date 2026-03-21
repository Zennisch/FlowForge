import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const EXECUTION_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'compensating',
] as const;

const TRIGGER_TYPES = ['manual', 'webhook', 'schedule'] as const;

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

function toOptionalBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  return value;
}

export class ListExecutionsQueryDto {
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsIn(EXECUTION_STATUSES, { each: true })
  status?: Array<(typeof EXECUTION_STATUSES)[number]>;

  @IsOptional()
  @IsMongoId()
  workflow_id?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsIn(TRIGGER_TYPES, { each: true })
  trigger_type?: Array<(typeof TRIGGER_TYPES)[number]>;

  @IsOptional()
  @IsISO8601()
  started_from?: string;

  @IsOptional()
  @IsISO8601()
  started_to?: string;

  @IsOptional()
  @IsISO8601()
  completed_from?: string;

  @IsOptional()
  @IsISO8601()
  completed_to?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  has_errors?: boolean;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => toNumberOrDefault(value, 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
