import { IsString, MinLength, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  refreshToken!: string;
}
