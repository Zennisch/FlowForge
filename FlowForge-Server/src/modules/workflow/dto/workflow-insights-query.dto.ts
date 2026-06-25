import { Transform } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

function toNumberOrDefault(value: unknown, fallback: number): unknown {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}

export class WorkflowInsightsQueryDto {
  @IsOptional()
  @IsISO8601()
  started_from?: string;

  @IsOptional()
  @IsISO8601()
  started_to?: string;

  @IsOptional()
  @Transform(({ value }) => toNumberOrDefault(value, 10))
  @IsInt()
  @Min(5)
  @Max(10)
  history_limit = 10;
}
