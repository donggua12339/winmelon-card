import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  // P1-6: 优先从 cookie 读，body 可选
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  refreshToken?: string;
}
