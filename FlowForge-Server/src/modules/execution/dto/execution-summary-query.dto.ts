import { IsISO8601, IsMongoId, IsOptional } from 'class-validator';

export class ExecutionSummaryQueryDto {
  @IsOptional()
  @IsMongoId()
  workflow_id?: string;

  @IsOptional()
  @IsISO8601()
  started_from?: string;

  @IsOptional()
  @IsISO8601()
  started_to?: string;
}
