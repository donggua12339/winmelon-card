import { IsString, MinLength, MaxLength } from 'class-validator';

export class ActivateDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}
