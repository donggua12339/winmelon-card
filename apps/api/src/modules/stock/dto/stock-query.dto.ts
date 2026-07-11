import { IsString, IsOptional, IsInt, Min, Max, Type } from 'class-validator';

export class StockQueryDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  status?: 'AVAILABLE' | 'LOCKED' | 'SOLD' | 'DISABLED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;
}
