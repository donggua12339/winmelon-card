const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
(async () => {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('Admin@2026!', 12);
  const result = await prisma.user.update({
    where: { username: 'admin' },
    data: { passwordHash: hash },
  });
  console.log('OK:', result.username);
  await prisma.$disconnect();
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });