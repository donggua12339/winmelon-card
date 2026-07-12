// CommonJS 版 seed（绕过 ts-node ESM 问题）
const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@winmelon.cn';
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-me';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

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

  await prisma.paymentChannel.upsert({
    where: { code: 'mock' },
    update: {},
    create: {
      code: 'mock',
      name: '模拟支付（开发用）',
      isAvailable: false,
      config: JSON.stringify({ key: crypto.randomBytes(16).toString('hex') }),
    },
  });

  console.log('Seed done');
  console.log('Merchant:', merchant.id);
  console.log('Shop:', shop.id);
  console.log('Admin:', adminUsername);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
