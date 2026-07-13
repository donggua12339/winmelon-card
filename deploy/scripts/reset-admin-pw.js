const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

(async () => {
  const prisma = new PrismaClient();
  const NEW_PW = 'Admin@2026!';
  const hash = await bcrypt.hash(NEW_PW, 12);
  const result = await prisma.user.update({
    where: { username: 'admin' },
    data: { passwordHash: hash },
  });
  console.log('OK:', result.username, 'role=', result.role);
  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERR:', e.message);
  process.exit(1);
});
