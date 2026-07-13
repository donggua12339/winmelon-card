import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SetShopDomainDto {
  @IsString()
  @MinLength(4)
  @MaxLength(255)
  @Matches(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i, {
    message: '域名格式不正确（如 shop.example.com）',
  })
  domain!: string;
}
