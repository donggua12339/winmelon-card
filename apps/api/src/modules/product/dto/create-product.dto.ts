import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  shopId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(65535)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999.99)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999.99)
  originalPrice?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  purchaseLimit?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  isAutoDelivery?: boolean = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99999)
  sort?: number = 0;

  // SeekAll webhook: 标记此商品为 SeekAll 会员卡商品,非 SeekAll 商品留空
  @IsOptional()
  @IsEnum(['TRIAL', 'MONTHLY', 'LIFETIME'])
  seekallTier?: 'TRIAL' | 'MONTHLY' | 'LIFETIME';

  // 小城笺 webhook: 标记此商品为小城笺会员商品,非小城笺商品留空
  @IsOptional()
  @IsString()
  @MaxLength(32)
  xcjTier?: string;
}
