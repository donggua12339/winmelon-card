import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';

export interface EncryptedPayload {
  /** 密文（base64） */
  ciphertext: string;
  /** 初始化向量（base64） */
  iv: string;
  /** 认证标签（base64） */
  tag: string;
}

/**
 * AES-256-GCM 卡密加密服务
 * 详见 SECURITY-BASELINE.md §6.1
 */
@Injectable()
export class AesGcmService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('CARD_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error('CARD_ENCRYPTION_KEY 未配置，请检查 .env');
    }
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      throw new Error('CARD_ENCRYPTION_KEY 必须为 32 字节 base64 编码');
    }
    this.key = buf;
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  decrypt(payload: EncryptedPayload): string {
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }

  sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
