import { Injectable } from '@nestjs/common';

/**
 * 雪花 ID 生成器（简化版）
 * 结构：[1bit 符号] [41bit 毫秒时间戳] [10bit 机器] [12bit 序列]
 * 用于订单号、卡密 ID 等，防枚举
 */
@Injectable()
export class SnowflakeService {
  private static readonly EPOCH = 1704067200000; // 2024-01-01 UTC
  private static readonly MACHINE_ID_BITS = 10n;
  private static readonly SEQUENCE_BITS = 12n;
  private static readonly MAX_SEQUENCE = (1n << SnowflakeService.SEQUENCE_BITS) - 1n;
  private static readonly MACHINE_SHIFT = SnowflakeService.SEQUENCE_BITS;
  private static readonly TIMESTAMP_SHIFT = SnowflakeService.SEQUENCE_BITS + SnowflakeService.MACHINE_ID_BITS;

  private readonly machineId: bigint;
  private lastTimestamp = -1n;
  private sequence = 0n;

  constructor(machineId = 1n) {
    if (machineId < 0n || machineId >= 1n << SnowflakeService.MACHINE_ID_BITS) {
      throw new Error(`machineId 必须在 0 ~ ${(1n << SnowflakeService.MACHINE_ID_BITS) - 1n} 之间`);
    }
    this.machineId = machineId;
  }

  next(): string {
    const now = BigInt(Date.now());
    if (now === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & SnowflakeService.MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // 当前毫秒序列耗尽，等待下一毫秒
        while (BigInt(Date.now()) <= this.lastTimestamp) {
          // spin
        }
      }
    } else if (now < this.lastTimestamp) {
      throw new Error('时钟回拨，拒绝生成 ID');
    } else {
      this.sequence = 0n;
    }
    this.lastTimestamp = now;
    const ts = now - BigInt(SnowflakeService.EPOCH);
    const id =
      (ts << SnowflakeService.TIMESTAMP_SHIFT) |
      (this.machineId << SnowflakeService.MACHINE_SHIFT) |
      this.sequence;
    return id.toString();
  }
}
