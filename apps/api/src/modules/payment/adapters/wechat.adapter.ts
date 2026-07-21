import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createSign, createVerify, createDecipheriv, randomBytes } from 'crypto';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
  NotifyResult,
  RefundParams,
  RefundResult,
} from '../payment-adapter.interface';

/**
 * 微信支付 Native（扫码）适配器 —— API v3
 *
 * config 字段（后台「支付通道配置」JSON 填写）：
 *   appId       关联的公众号/小程序/开放平台/移动应用 AppID（Native 支付必填）
 *   mchId       商户号（如 1115541771）
 *   apiV3Key    APIv3 密钥（32 字节，商户平台「账户中心→API安全」设置）
 *   serialNo    商户 API 证书序列号（apiclient_cert.pem 对应的序列号）
 *   privateKey  商户 API 私钥 apiclient_key.pem 全文（含 BEGIN/END PRIVATE KEY）
 *
 * 安全要点：
 *   1. 请求用商户私钥做 SHA256withRSA 签名（WECHATPAY2-SHA256-RSA2048）
 *   2. 回调用「平台证书」公钥验签，平台证书经 /v3/certificates 下载并用 apiV3Key 解密
 *   3. 回调业务数据 resource 用 apiV3Key 做 AES-256-GCM 解密
 *   4. 金额以「分」为单位上送，回调金额校验由 PaymentService 统一以 DB 为准
 */
export interface WechatConfig {
  appId: string;
  mchId: string;
  apiV3Key: string;
  serialNo: string;
  privateKey: string;
  /** 微信支付公钥 PEM（2024 新版公钥模式，有此字段时回调验签直接用公钥，不走 /v3/certificates） */
  platformPublicKey?: string;
}

interface CertEntry {
  pem: string;
  expiresAt: number;
}

/** 微信 API 基地址：默认直连，可设 WECHAT_API_PROXY_URL 走代理（如 Cloudflare Worker） */
const API_HOST = process.env.WECHAT_API_PROXY_URL || 'https://api.mch.weixin.qq.com';

@Injectable()
export class WechatAdapter implements PaymentAdapter {
  readonly code = 'wechat';
  private readonly logger = new Logger(WechatAdapter.name);
  /** 平台证书缓存：serialNo -> { pem, expiresAt } */
  private readonly certCache = new Map<string, CertEntry>();

  // ====================== 下单 ======================

  async createPayment(params: CreatePaymentParams, config: Record<string, unknown>): Promise<CreatePaymentResult> {
    const cfg = config as unknown as WechatConfig;
    this.assertConfig(cfg);
    this.assertAppId(cfg);

    const totalFen = this.yuanToFen(params.amount);
    const bodyObj = {
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: params.subject.slice(0, 127) || '商品',
      out_trade_no: params.orderNo,
      notify_url: params.notifyUrl,
      amount: { total: totalFen, currency: 'CNY' },
    };
    const body = JSON.stringify(bodyObj);
    const path = '/v3/pay/transactions/native';

    const resp = await this.request('POST', path, body, cfg);
    const json = (await resp.json().catch(() => ({}))) as { code_url?: string; code?: string; message?: string };

    if (!resp.ok || !json.code_url) {
      this.logger.error(`微信下单失败 status=${resp.status} code=${json.code} msg=${json.message}`);
      const detail = json.message ?? json.code ?? `HTTP ${resp.status}`;
      throw new BadRequestException(`微信支付暂不可用：${detail}`);
    }

    // code_url 形如 weixin://wxpay/bizpayurl?pr=xxx，前端 WechatPay 页渲染二维码 + 轮询
    const paymentUrl = `/payment/wechat?orderNo=${encodeURIComponent(params.orderNo)}&code=${encodeURIComponent(
      json.code_url,
    )}`;
    return { paymentUrl };
  }

  // ====================== 回调验签 + 解密 ======================

  parseNotify(
    rawBody: string,
    headers: Record<string, string | undefined>,
    config: Record<string, unknown>,
  ): NotifyResult {
    const cfg = config as unknown as WechatConfig;

    const timestamp = headers['wechatpay-timestamp'] ?? '';
    const nonce = headers['wechatpay-nonce'] ?? '';
    const signature = headers['wechatpay-signature'] ?? '';
    const serial = headers['wechatpay-serial'] ?? '';

    if (!timestamp || !nonce || !signature || !serial) {
      throw new Error('微信回调缺少签名头');
    }

    // 验签公钥选择：公钥模式（2024 新版）直接用 platformPublicKey，否则查平台证书缓存
    let verifyKey: string;
    if (cfg.platformPublicKey) {
      verifyKey = cfg.platformPublicKey;
    } else {
      const platformCert = this.getCert(serial);
      if (!platformCert) {
        throw new Error(`平台证书未缓存 serial=${serial}，需刷新`);
      }
      verifyKey = platformCert.pem;
    }

    // 验签：message = timestamp\nnonce\nbody\n
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const ok = createVerify('RSA-SHA256').update(message, 'utf8').verify(verifyKey, signature, 'base64');
    if (!ok) {
      this.logger.warn(`微信回调理签失败 serial=${serial}`);
      throw new Error('微信回调理签失败');
    }

    let body: {
      out_trade_no?: string;
      transaction_id?: string;
      trade_state?: string;
      amount?: { total?: number; payer_total?: number };
      resource?: { algorithm?: string; nonce?: string; ciphertext?: string; associated_data?: string };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error('微信回调 body 解析失败');
    }

    // 解密 resource
    let decrypted: {
      out_trade_no?: string;
      transaction_id?: string;
      trade_state?: string;
      amount?: { total?: number };
    } = {};
    if (body.resource?.nonce && body.resource.ciphertext && body.resource.associated_data !== undefined) {
      const plain = this.decryptResource(
        {
          nonce: body.resource.nonce,
          ciphertext: body.resource.ciphertext,
          associated_data: body.resource.associated_data,
        },
        cfg.apiV3Key,
      );
      decrypted = JSON.parse(plain);
    }

    const outTradeNo = decrypted.out_trade_no ?? body.out_trade_no ?? '';
    const tradeNo = decrypted.transaction_id ?? body.transaction_id ?? '';
    const tradeState = decrypted.trade_state ?? body.trade_state ?? '';
    const totalFen = decrypted.amount?.total ?? body.amount?.total ?? 0;
    const amount = this.fenToYuan(totalFen);

    return {
      outTradeNo,
      tradeNo,
      amount,
      success: tradeState === 'SUCCESS',
      raw: { trade_state: tradeState, transaction_id: tradeNo, out_trade_no: outTradeNo },
    };
  }

  // ====================== 退款 ======================

  async refund(params: RefundParams, config: Record<string, unknown>): Promise<RefundResult> {
    const cfg = config as unknown as WechatConfig;
    this.assertConfig(cfg);

    if (!params.originalTradeNo) {
      throw new Error('微信退款缺少原交易流水号 transaction_id');
    }
    const refundFen = this.yuanToFen(params.amount);
    // 全额退款时 total=refund；若调用方传了 originalAmount 则以其为准
    const totalFen = params.originalAmount ? this.yuanToFen(params.originalAmount) : refundFen;

    const bodyObj = {
      transaction_id: params.originalTradeNo,
      out_refund_no: params.refundNo,
      reason: params.reason?.slice(0, 80) || '买家退款',
      amount: { refund: refundFen, total: totalFen, currency: 'CNY' },
    };
    const body = JSON.stringify(bodyObj);
    const path = '/v3/refund/domestic/refunds';

    const resp = await this.request('POST', path, body, cfg);
    const json = (await resp.json().catch(() => ({}))) as {
      status?: string;
      refund_id?: string;
      code?: string;
      message?: string;
    };

    if (!resp.ok) {
      this.logger.error(`微信退款失败 status=${resp.status} code=${json.code} msg=${json.message}`);
      throw new BadRequestException(`微信退款失败：${json.message ?? json.code ?? resp.status}`);
    }

    // 微信退款 status: SUCCESS / PROCESSING / ABNORMAL / CLOSED
    const success = json.status === 'SUCCESS' || json.status === 'PROCESSING';
    if (!success) {
      throw new Error(`微信退款状态异常: ${json.status}`);
    }
    return {
      tradeNo: json.refund_id ?? `WX_REFUND_${params.refundNo}`,
      raw: json,
      success: true,
    };
  }

  // ====================== 平台证书管理 ======================

  /** 取缓存中的平台证书；miss 时调用方应触发 refreshPlatformCerts */
  private getCert(serial: string): CertEntry | undefined {
    const e = this.certCache.get(serial);
    if (e && e.expiresAt > Date.now()) return e;
    return undefined;
  }

  /** 下载并缓存平台证书（用商户私钥签名请求，用 apiV3Key 解密响应） */
  async refreshPlatformCerts(config: Record<string, unknown>): Promise<void> {
    const cfg = config as unknown as WechatConfig;
    this.assertConfig(cfg);
    const path = '/v3/certificates';
    const resp = await this.request('GET', path, '', cfg);
    if (!resp.ok) {
      throw new Error(`下载平台证书失败 status=${resp.status}`);
    }
    const json = (await resp.json()) as {
      data?: Array<{
        serial_no: string;
        effective_time?: string;
        expire_time?: string;
        encrypt_certificate: { algorithm: string; nonce: string; ciphertext: string; associated_data: string };
      }>;
    };
    if (!json.data?.length) throw new Error('平台证书列表为空');

    for (const item of json.data) {
      const pem = this.decryptResource(item.encrypt_certificate, cfg.apiV3Key);
      const expiresAt = item.expire_time ? new Date(item.expire_time).getTime() : Date.now() + 12 * 3600_000;
      this.certCache.set(item.serial_no, { pem, expiresAt });
    }
    this.logger.log(`微信支付平台证书已刷新，共 ${json.data.length} 张`);
  }

  // ====================== HTTP + 签名 ======================

  private async request(method: string, path: string, body: string, cfg: WechatConfig): Promise<Response> {
    const authorization = this.buildAuthHeader(method, path, body, cfg);
    const url = `${API_HOST}${path}`;
    try {
      return await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authorization,
          'User-Agent': 'wm-card-wechatpay/1.0',
        },
        body: method === 'GET' ? undefined : body,
      });
    } catch (e) {
      throw new Error(`微信支付请求异常: ${(e as Error).message}`);
    }
  }

  /**
   * 构造 Authorization 头
   * 签名串 = HTTP方法\nURL路径\n时间戳\n随机串\n请求体\n （每行以 \n 结尾，含末行）
   */
  private buildAuthHeader(method: string, path: string, body: string, cfg: WechatConfig): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString('hex');
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = createSign('RSA-SHA256').update(message, 'utf8').sign(cfg.privateKey, 'base64');
    return `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serialNo}"`;
  }

  /**
   * AES-256-GCM 解密微信 resource
   * ciphertext(base64) = 密文 || authTag(末 16 字节)
   */
  private decryptResource(
    resource: { nonce: string; ciphertext: string; associated_data: string },
    apiV3Key: string,
  ): string {
    const key = Buffer.from(apiV3Key, 'utf8');
    if (key.length !== 32) {
      throw new Error(`APIv3 密钥必须 32 字节，当前 ${key.length} 字节`);
    }
    const buf = Buffer.from(resource.ciphertext, 'base64');
    const authTag = buf.subarray(buf.length - 16);
    const enc = buf.subarray(0, buf.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, resource.nonce);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
    return plain.toString('utf8');
  }

  private assertConfig(cfg: WechatConfig): void {
    if (!cfg.mchId || !cfg.apiV3Key || !cfg.serialNo || !cfg.privateKey) {
      throw new Error('微信支付配置不完整（mchId/apiV3Key/serialNo/privateKey）');
    }
  }

  private assertAppId(cfg: WechatConfig): void {
    if (!cfg.appId) {
      throw new Error('微信支付未配置 appId，请在后台「支付配置 → 微信支付」填写关联的 AppID');
    }
  }

  private yuanToFen(yuan: string | number): number {
    return Math.round(Number(yuan) * 100);
  }

  private fenToYuan(fen: number): string {
    return (fen / 100).toFixed(2);
  }
}
