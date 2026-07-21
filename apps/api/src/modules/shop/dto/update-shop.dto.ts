import { IsOptional, IsBoolean, IsString, MaxLength } from 'class-validator';

export class UpdateShopDto {
  @IsOptional()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  announcement?: string | null;

  @IsOptional()
  footerHtml?: string | null;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  /** P1-4: 店铺装修 - banner / logo / 精选商品 */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  bannerUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  logoUrl?: string | null;

  /** JSON 数组字符串,如 '["prodId1","prodId2"]' */
  @IsOptional()
  @IsString()
  featuredProductIds?: string | null;
}
