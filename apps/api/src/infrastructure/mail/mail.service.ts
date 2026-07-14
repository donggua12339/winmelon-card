import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter, type SendMailOptions } from 'nodemailer';
import { escapeHtml } from '../../common/utils/sanitize';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null = null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>('MAIL_HOST', 'smtp.qq.com');
    const port = Number(config.get<string>('MAIL_PORT', '465'));
    const user = config.get<string>('MAIL_USER');
    const pass = config.get<string>('MAIL_PASS');
    const fromName = config.get<string>('MAIL_FROM_NAME', 'WM 卡密平台');

    this.enabled = !!(user && pass);
    this.from = `"${fromName}" <${user ?? 'no-reply@wm-card.local'}>`;

    if (this.enabled) {
      const transportOptions = {
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        // 增加超时，避免 QQ SMTP 偶尔拒绝时无限挂起
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        // QQ SMTP SSL 需要正确的 TLS 选项
        tls: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2' as const,
        },
        // 禁用连接池，每次发送新建连接（避免长连接被服务端断开）
        pool: false,
      } as unknown as SendMailOptions;
      this.transporter = createTransport(transportOptions as never);
      this.logger.log(`邮件服务已配置：${user}@${host}:${port} (secure=${port === 465})`);
    } else {
      this.logger.warn('邮件服务未配置（MAIL_USER/MAIL_PASS 缺失），邮件发送将被跳过');
    }
  }

  async send(opts: MailOptions): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      this.logger.warn(`邮件发送跳过（未配置）：${opts.to} <- ${opts.subject}`);
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      this.logger.log(`邮件已发送：${opts.to} <- ${opts.subject} (id=${info.messageId})`);
      return true;
    } catch (err) {
      this.logger.error(`邮件发送失败：${opts.to} - ${(err as Error).message}`);
      return false;
    }
  }

  /** 卡密交付邮件 */
  async sendCardDelivery(opts: {
    to: string;
    orderNo: string;
    cards: { productName: string; content: string }[];
  }): Promise<boolean> {
    const cardsHtml = opts.cards
      .map(
        (c) => `
        <tr>
          <td style="padding:12px;border:1px solid #e2e8f0;background:#f8fafc;">
            <div style="font-size:13px;color:#64748b;margin-bottom:4px;">${escapeHtml(c.productName)}</div>
            <code style="font-family:monospace;font-size:15px;color:#1e293b;word-break:break-all;background:#1e293b;color:#a5b4fc;padding:8px 12px;border-radius:6px;display:inline-block;">${escapeHtml(c.content)}</code>
          </td>
        </tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>卡密交付</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
      <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">✅ 订单已交付</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">订单号 ${opts.orderNo}</p>
      </div>
      <div style="padding:24px 32px;">
        <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
          您购买的卡密已发出，请妥善保管。如有问题请保留此邮件。
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead>
            <tr>
              <th style="padding:8px 12px;background:#7c3aed;color:#fff;font-size:12px;text-align:left;border-radius:6px 6px 0 0;">卡密内容</th>
            </tr>
          </thead>
          <tbody>${cardsHtml}</tbody>
        </table>
        <div style="margin-top:24px;padding:16px;background:#fef3c7;border-radius:8px;">
          <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
            ⚠️ 安全提示：请勿向他人泄露卡密内容。本邮件由系统自动发送，请勿回复。
          </p>
        </div>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">WM 官方虚拟卡密交易平台</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    return this.send({
      to: opts.to,
      subject: `[卡密交付] 订单 ${opts.orderNo}`,
      html,
      text: `订单 ${opts.orderNo} 已交付。卡密：\n${opts.cards.map((c) => `${c.productName}: ${c.content}`).join('\n')}`,
    });
  }

  /** 监控告警邮件 */
  async sendAlert(opts: { to: string; subject: string; message: string }): Promise<boolean> {
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fef2f2;font-family:sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-left:4px solid #dc2626;padding:20px 24px;border-radius:8px;">
      <h2 style="margin:0 0 12px;color:#dc2626;font-size:18px;">⚠️ 监控告警</h2>
      <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>主题：</strong>${opts.subject}</p>
      <p style="margin:0 0 16px;color:#374151;font-size:14px;"><strong>时间：</strong>${new Date().toISOString()}</p>
      <pre style="margin:0;padding:12px;background:#f3f4f6;border-radius:6px;font-size:13px;white-space:pre-wrap;word-break:break-all;">${opts.message}</pre>
    </div>
  </div>
</body></html>`;

    return this.send({
      to: opts.to,
      subject: `[WM 告警] ${opts.subject}`,
      html,
      text: `${opts.subject}\n\n${opts.message}`,
    });
  }

  /** 订单创建（待支付）邮件 */
  async sendOrderCreated(opts: {
    to: string;
    orderNo: string;
    amount: string;
    items: { productName: string; quantity: number; price: string }[];
    payUrl: string;
    expireAt: Date;
  }): Promise<boolean> {
    const itemsHtml = opts.items
      .map(
        (it) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">${it.productName}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:14px;color:#64748b;">× ${it.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:#1e293b;font-family:monospace;">¥${it.price}</td>
        </tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
      <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">📋 订单已创建</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">订单号：${opts.orderNo}</p>
      </div>
      <div style="padding:32px;">
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:24px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;">商品</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;">数量</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;">单价</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr style="background:#fef3c7;">
              <td colspan="2" style="padding:12px;font-size:14px;color:#92400e;font-weight:600;">合计</td>
              <td style="padding:12px;text-align:right;font-size:18px;color:#dc2626;font-weight:700;font-family:monospace;">¥${opts.amount}</td>
            </tr>
          </tfoot>
        </table>
        <div style="text-align:center;margin:32px 0;">
          <a href="${opts.payUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">立即支付</a>
        </div>
        <p style="margin:16px 0 0;color:#64748b;font-size:13px;text-align:center;">
          订单将于 <strong>${opts.expireAt.toLocaleString('zh-CN')}</strong> 过期，请尽快完成支付
        </p>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">WM 官方虚拟卡密交易平台</p>
      </div>
    </div>
  </div>
</body></html>`;

    return this.send({
      to: opts.to,
      subject: `[订单创建] ${opts.orderNo} - 合计 ¥${opts.amount}`,
      html,
      text: `订单 ${opts.orderNo} 已创建，合计 ¥${opts.amount}。请尽快支付：${opts.payUrl}`,
    });
  }

  /** 商户入驻成功邮件（含初始密码） */
  async sendMerchantWelcome(opts: {
    to: string;
    merchantName: string;
    shopName: string;
    shopCode: string;
    loginUrl: string;
    initialPassword: string;
  }): Promise<boolean> {
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
      <div style="background:linear-gradient(135deg,#06b6d4,#0ea5e9);padding:32px;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">🎉 商户入驻成功</h1>
        <p style="margin:12px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">欢迎加入 WM 卡密平台！</p>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">您的商户账号已开通，登录信息如下：</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0;">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
            <span style="color:#64748b;font-size:14px;">商户名称</span>
            <span style="color:#1e293b;font-size:14px;font-weight:600;">${escapeHtml(opts.merchantName)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
            <span style="color:#64748b;font-size:14px;">店铺名称</span>
            <span style="color:#1e293b;font-size:14px;font-weight:600;">${escapeHtml(opts.shopName)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
            <span style="color:#64748b;font-size:14px;">店铺路径</span>
            <span style="color:#7c3aed;font-size:14px;font-family:monospace;">/shop/${escapeHtml(opts.shopCode)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
            <span style="color:#64748b;font-size:14px;">登录邮箱</span>
            <span style="color:#1e293b;font-size:14px;">${escapeHtml(opts.to)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;align-items:center;">
            <span style="color:#64748b;font-size:14px;">初始密码</span>
            <code style="background:#1e293b;color:#a5b4fc;padding:6px 12px;border-radius:4px;font-family:monospace;font-size:14px;">${escapeHtml(opts.initialPassword)}</code>
          </div>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${opts.loginUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#06b6d4,#0ea5e9);color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">立即登录后台</a>
        </div>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin-top:24px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
            ⚠️ 安全提示：登录后请立即修改初始密码，并开启邮箱通知接收订单动态。
          </p>
        </div>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">WM 官方虚拟卡密交易平台</p>
      </div>
    </div>
  </div>
</body></html>`;

    return this.send({
      to: opts.to,
      subject: `【WM 卡密平台】欢迎入驻 - ${opts.merchantName}`,
      html,
      text: `欢迎入驻 WM 卡密平台！\n登录邮箱：${opts.to}\n初始密码：${opts.initialPassword}\n登录地址：${opts.loginUrl}\n请尽快登录并修改密码。`,
    });
  }
}
