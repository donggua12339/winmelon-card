// 独立测试邮件脚本（不依赖编译后的 MailService）
const nodemailer = require('nodemailer');

const USER = process.env.MAIL_USER || '1660069758@qq.com';
const PASS = process.env.MAIL_PASS || 'cpgsuujblyisjiig';
const TO = process.env.ALERT_EMAIL || '1660069758@qq.com';

const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: { user: USER, pass: PASS },
});

(async () => {
  console.log('sending test mail to', TO);
  try {
    const info = await transporter.sendMail({
      from: `"WM 卡密平台" <${USER}>`,
      to: TO,
      subject: '[WM 测试] 邮件告警系统验证',
      html: `
        <h2 style="color:#7c3aed;">WM 卡密平台 - 邮件测试</h2>
        <p>这是一封来自 WM Card 系统的测试邮件。</p>
        <p>如果你收到了，说明：</p>
        <ul>
          <li>✅ QQ SMTP 配置正确</li>
          <li>✅ 授权码有效</li>
          <li>✅ 卡密交付邮件 + 监控告警邮件都能正常发送</li>
        </ul>
        <p style="color:#64748b;font-size:12px;">发送时间：${new Date().toISOString()}</p>
      `,
    });
    console.log('OK, messageId:', info.messageId);
    process.exit(0);
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
  }
})();
