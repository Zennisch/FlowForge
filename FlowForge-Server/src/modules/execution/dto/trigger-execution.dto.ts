import { IsObject, IsOptional, IsString } from 'class-validator';

export class TriggerExecutionDto {
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  idempotency_key?: string;
}

