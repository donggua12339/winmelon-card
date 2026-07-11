import { IsString, MinLength, MaxLength } from 'class-validator';

export class ImportStockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  productId!: string;

  /**
   * CSV 文本内容，每行一条卡密。
   * - 支持双引号包裹（含逗号或换行）
   * - 行尾 \n 或 \r\n 均可
   * - 单次最多 5000 条，单条最长 4096 字符
   */
  @IsString()
  @MinLength(1)
  @MaxLength(20 * 1024 * 1024) // 20MB 上限
  csvContent!: string;
}
