import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ApplyMerchantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  contactName!: string;

  @IsEmail()
  @MaxLength(255)
  contactEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  merchantName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  shopName!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,32}$/, {
    message: '店铺码只能包含小写字母、数字、短横线，3-32 位',
  })
  shopCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  businessScope?: string;
}
