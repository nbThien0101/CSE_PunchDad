const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Tạo Admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      displayName: 'Admin CLB',
      phone: '0901234567',
      bankInfo: 'Vietcombank - 1234567890 - NGUYEN VAN ADMIN',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin created: ${admin.displayName} (${admin.username})`);

  // Tạo một vài member mẫu
  const memberPassword = await bcrypt.hash('member123', 12);
  const members = [
    { username: 'member1', displayName: 'Nguyen Van A', phone: '0911111111' },
    { username: 'member2', displayName: 'Tran Van B', phone: '0922222222' },
    { username: 'member3', displayName: 'Le Van C', phone: '0933333333' },
  ];

  for (const member of members) {
    const user = await prisma.user.upsert({
      where: { username: member.username },
      update: {},
      create: {
        ...member,
        passwordHash: memberPassword,
        role: 'MEMBER',
      },
    });
    console.log(`✅ Member created: ${user.displayName} (${user.username})`);
  }

  console.log('\n🎉 Seed completed!');
  console.log('📋 Default accounts:');
  console.log('   Admin: admin / admin123');
  console.log('   Members: member1, member2, member3 / member123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
