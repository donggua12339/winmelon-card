import { IsString, IsInt, IsOptional, IsEmail, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  shopCode!: string;

  @IsEmail()
  @MaxLength(255)
  buyerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  buyerContact?: string;

  @IsString()
  @MaxLength(64)
  idempotencyKey!: string;

  items!: CreateOrderItemDto[];
}
