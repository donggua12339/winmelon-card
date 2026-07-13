import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @IsString()
  @MinLength(8, { message: '新密码至少 8 位' })
  @MaxLength(64)
  newPassword!: string;
}
