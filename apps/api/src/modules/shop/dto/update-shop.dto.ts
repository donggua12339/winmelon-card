import { IsOptional, IsBoolean, MaxLength } from 'class-validator';

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
}
