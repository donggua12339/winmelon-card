import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me-on-first-login';

  if (adminPassword === 'change-me-on-first-login') {
    console.warn('⚠️  使用默认管理员密码，请立即修改！');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // 平台商户（MVP 单商户自营）
  const merchant = await prisma.merchant.upsert({
    where: { code: 'main' },
    update: {},
    create: {
      code: 'main',
      name: 'WM 官方自营',
      contactEmail: adminEmail,
      status: 'ACTIVE',
      commissionRate: 0,
      balance: 0,
    },
  });

  const shop = await prisma.shop.upsert({
    where: { code: 'main' },
    update: {},
    create: {
      merchantId: merchant.id,
      code: 'main',
      name: 'WM 官方自营店',
      announcement: '欢迎光临 WM 官方虚拟卡密交易平台',
      isOnline: true,
    },
  });

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      merchantId: merchant.id,
      isActive: true,
    },
  });

  // 默认支付通道占位
  await prisma.paymentChannel.upsert({
    where: { code: 'epay' },
    update: {},
    create: {
      code: 'epay',
      name: '易支付',
      isAvailable: false,
      config: '{}',
    },
  });

  // 默认系统配置
  await prisma.systemConfig.upsert({
    where: { key: 'site.name' },
    update: {},
    create: { key: 'site.name', value: 'WM 官方虚拟卡密交易平台' },
  });

  console.log('✅ Seed 完成');
  console.log(`   - 商户：${merchant.code} (${merchant.id})`);
  console.log(`   - 店铺：${shop.code} (${shop.id})`);
  console.log(`   - 管理员：${adminUsername}`);
}

main()
  .catch((err) => {
    console.error('❌ Seed 失败：', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
