import { IsString, MaxLength, IsArray, IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  rateLimitPerMin?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
