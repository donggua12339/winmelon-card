import { IsString, IsEmail, MaxLength } from 'class-validator';

export class QueryOrderDto {
  @IsString()
  @MaxLength(32)
  orderNo!: string;

  @IsEmail()
  @MaxLength(255)
  buyerEmail!: string;
}
