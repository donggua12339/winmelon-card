import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 雪花 ID 生成器（64 位）
 * 结构：[1bit 符号] [41bit 毫秒时间戳] [10bit 机器] [12bit 序列]
 * 用于订单号、卡密 ID 等，防枚举
 *
 * 时钟回拨保护：
 * - 回拨 ≤ 100ms：等待至 lastTimestamp
 * - 回拨 > 100ms：抛错，避免 ID 重复
 */
@Injectable()
export class SnowflakeService implements OnModuleInit {
  private readonly logger = new Logger(SnowflakeService.name);
  private static readonly EPOCH = 1704067200000; // 2024-01-01 UTC
  private static readonly MACHINE_ID_BITS = 10n;
  private static readonly SEQUENCE_BITS = 12n;
  private static readonly MAX_SEQUENCE = (1n << SnowflakeService.SEQUENCE_BITS) - 1n;
  private static readonly MACHINE_SHIFT = SnowflakeService.SEQUENCE_BITS;
  private static readonly TIMESTAMP_SHIFT = SnowflakeService.SEQUENCE_BITS + SnowflakeService.MACHINE_ID_BITS;
  private static readonly MAX_MACHINE_ID = (1n << SnowflakeService.MACHINE_ID_BITS) - 1n;
  private static readonly MAX_DRIFT_MS = 100n;

  private readonly machineId: bigint;
  private lastTimestamp = -1n;
  private sequence = 0n;

  constructor(config: ConfigService) {
    const raw = config.get<string>('SNOWFLAKE_MACHINE_ID', '1');
    const mid = BigInt(raw);
    if (mid < 0n || mid > SnowflakeService.MAX_MACHINE_ID) {
      throw new Error(`SNOWFLAKE_MACHINE_ID 必须在 0 ~ ${SnowflakeService.MAX_MACHINE_ID} 之间`);
    }
    this.machineId = mid;
  }

  onModuleInit(): void {
    this.logger.log(`Snowflake 初始化，machineId=${this.machineId}`);
  }

  next(): string {
    let now = BigInt(Date.now());

    if (now < this.lastTimestamp) {
      const drift = this.lastTimestamp - now;
      if (drift > SnowflakeService.MAX_DRIFT_MS) {
        throw new Error(`时钟回拨 ${drift}ms，超过阈值，拒绝生成 ID`);
      }
      now = this.lastTimestamp;
    }

    if (now === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & SnowflakeService.MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // spin wait（带超时保护，避免时钟卡住时死循环）
        const spinStart = Date.now();
        while (BigInt(Date.now()) <= this.lastTimestamp) {
          if (Date.now() - spinStart > 5000) {
            throw new Error('Snowflake: 时钟长时间停滞，请检查系统时间');
          }
        }
        now = BigInt(Date.now());
        this.lastTimestamp = now;
      }
    } else {
      this.sequence = 0n;
      this.lastTimestamp = now;
    }

    const ts = now - BigInt(SnowflakeService.EPOCH);
    const id =
      (ts << SnowflakeService.TIMESTAMP_SHIFT) | (this.machineId << SnowflakeService.MACHINE_SHIFT) | this.sequence;
    return id.toString();
  }
}
