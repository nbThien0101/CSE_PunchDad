const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SESSION_ID = 'f44e54b5-5786-4bae-90de-cdd96ae0e5fa';

const MOCK_PLAYERS = [
  { username: 'quanghai', displayName: 'Nguyễn Quang Hải', tier: 'S', isGoalkeeper: false },
  { username: 'vanlam', displayName: 'Đặng Văn Lâm', tier: 'S', isGoalkeeper: true },
  { username: 'hoangduc', displayName: 'Nguyễn Hoàng Đức', tier: 'S', isGoalkeeper: false },
  { username: 'tanphi', displayName: 'Bùi Tấn Trường', tier: 'A', isGoalkeeper: true },
  { username: 'congphuong', displayName: 'Nguyễn Công Phượng', tier: 'A', isGoalkeeper: false },
  { username: 'tienlinh', displayName: 'Nguyễn Tiến Linh', tier: 'A', isGoalkeeper: false },
  { username: 'quehai', displayName: 'Quế Ngọc Hải', tier: 'A', isGoalkeeper: false },
  { username: 'nguyenmanh', displayName: 'Trần Nguyên Mạnh', tier: 'B', isGoalkeeper: true },
  { username: 'duymanh', displayName: 'Đỗ Duy Mạnh', tier: 'B', isGoalkeeper: false },
  { username: 'vanhau', displayName: 'Đoàn Văn Hậu', tier: 'B', isGoalkeeper: false },
  { username: 'vantoan', displayName: 'Nguyễn Văn Toàn', tier: 'B', isGoalkeeper: false },
  { username: 'tuananh', displayName: 'Nguyễn Tuấn Anh', tier: 'B', isGoalkeeper: false },
  { username: 'dinhbac', displayName: 'Nguyễn Đình Bắc', tier: 'B', isGoalkeeper: false },
  { username: 'vanthanh', displayName: 'Vũ Văn Thanh', tier: 'B', isGoalkeeper: false },
  { username: 'tuanhai', displayName: 'Phạm Tuấn Hải', tier: 'C', isGoalkeeper: false },
  { username: 'thanhtrieu', displayName: 'Nguyễn Thanh Khôi', tier: 'C', isGoalkeeper: false },
  { username: 'trungkiet', displayName: 'Võ Trung Kiệt', tier: 'C', isGoalkeeper: false },
  { username: 'baothien', displayName: 'Nguyễn Bảo Thiện', tier: 'C', isGoalkeeper: false },
  { username: 'dinhviet', displayName: 'Trần Đình Việt', tier: 'C', isGoalkeeper: false },
  { username: 'minhvuong', displayName: 'Trần Minh Vương', tier: 'C', isGoalkeeper: false },
  { username: 'xuanmanh', displayName: 'Phạm Xuân Mạnh', tier: 'D', isGoalkeeper: false },
  { username: 'ducchien', displayName: 'Nguyễn Đức Chiến', tier: 'D', isGoalkeeper: false },
  { username: 'vanvi', displayName: 'Nguyễn Văn Vĩ', tier: 'D', isGoalkeeper: false },
  { username: 'ngoctan', displayName: 'Lê Ngọc Tân', tier: 'D', isGoalkeeper: false },
];

async function seed() {
  const passwordHash = await bcrypt.hash('123456', 10);

  console.log(`Bắt đầu seed 24 cầu thủ cho session ${SESSION_ID}...`);

  for (let i = 0; i < MOCK_PLAYERS.length; i++) {
    const p = MOCK_PLAYERS[i];

    // Tạo hoặc cập nhật user
    const user = await prisma.user.upsert({
      where: { username: p.username },
      update: {
        displayName: p.displayName,
        tier: p.tier,
        isGoalkeeper: p.isGoalkeeper,
      },
      create: {
        username: p.username,
        passwordHash,
        displayName: p.displayName,
        tier: p.tier,
        isGoalkeeper: p.isGoalkeeper,
        role: 'MEMBER',
      },
    });

    // Tạo vote JOIN với thời gian cách nhau 10 phút để có thứ tự vote rõ ràng
    const votedAt = new Date(Date.now() - (MOCK_PLAYERS.length - i) * 600000);

    await prisma.vote.upsert({
      where: {
        sessionId_userId: {
          sessionId: SESSION_ID,
          userId: user.id,
        },
      },
      update: {
        status: 'JOIN',
        votedAt,
      },
      create: {
        sessionId: SESSION_ID,
        userId: user.id,
        status: 'JOIN',
        votedAt,
      },
    });
  }

  const count = await prisma.vote.count({
    where: { sessionId: SESSION_ID, status: 'JOIN' },
  });

  console.log(`Thành công! Tổng số người vote JOIN cho session hiện tại: ${count}`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
