import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RetryPolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @IsOptional()
  @IsEnum(['exponential', 'fixed'])
  backoff?: 'exponential' | 'fixed';
}

export class CompensationPolicyDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(['noop', 'http'])
  type?: 'noop' | 'http';

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  retry?: RetryPolicyDto;
}

export class WorkflowStepDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsEnum(['http', 'transform', 'store', 'branch'])
  type: 'http' | 'transform' | 'store' | 'branch';

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  retry?: RetryPolicyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompensationPolicyDto)
  compensation?: CompensationPolicyDto;
}

export class WorkflowEdgeDto {
  @IsString()
  @MinLength(1)
  from: string;

  @IsString()
  @MinLength(1)
  to: string;

  @IsOptional()
  @IsString()
  condition?: string;
}

export class WorkflowTriggerDto {
  @IsEnum(['manual', 'webhook', 'schedule'])
  type: 'manual' | 'webhook' | 'schedule';

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateWorkflowDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowTriggerDto)
  trigger?: WorkflowTriggerDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps?: WorkflowStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges?: WorkflowEdgeDto[];
}
