import { IsIn } from 'class-validator';

export class UpdateProductStatusDto {
  @IsIn(['ONLINE', 'OFFLINE'])
  status!: 'ONLINE' | 'OFFLINE';
}
