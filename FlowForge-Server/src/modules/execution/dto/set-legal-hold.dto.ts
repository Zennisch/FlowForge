import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetLegalHoldDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  reason?: string;
}
