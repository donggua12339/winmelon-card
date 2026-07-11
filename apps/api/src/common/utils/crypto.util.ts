import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

/**
 * 卡密内容加解密
 * - 算法：AES-256-GCM（带认证标签，防密文篡改）
 * - 密钥：32 字节，从 env STOCK_ENCRYPTION_KEY（hex 或 base64）读取
 * - 每条卡密独立 IV，密文 + IV + tag 分别存储
 *
 * 安全要点：
 * 1. 密钥绝不进入日志、响应、审计 beforeData/afterData
 * 2. 明文仅在内存中流转，落库前必须 encrypt()
 * 3. contentHash 用于导入去重，但不可逆推明文（SHA256 + 应用层胡椒可选）
 */
@Injectable()
export class CryptoUtil {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('STOCK_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error('STOCK_ENCRYPTION_KEY 未配置');
    }
    // 支持 hex(64) 或 base64(44)
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      throw new Error('STOCK_ENCRYPTION_KEY 必须为 32 字节（hex 64 位或 base64 44 位）');
    }
    this.key = buf;
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string } {
    const iv = randomBytes(12); // GCM 推荐 12 字节
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: enc.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  decrypt(ciphertext: string, iv: string, tag: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
    return dec.toString('utf8');
  }

  hash(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }
}
