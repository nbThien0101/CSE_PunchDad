const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const PLAYERS_DATA = [
  // Tier S+ / S (6 players - 3 GKs, 3 Outfield)
  { name: 'Hồ Văn Ý', tier: 'S+', positions: ['GK'], isGoalkeeper: true, note: 'Thủ môn xuất sắc nhất futsal VN' },
  { name: 'Nguyễn Quang Hải', tier: 'S+', positions: ['ALA_LEFT', 'PIVOT'], isGoalkeeper: false, note: 'Chân trái khéo léo, sút phạt tốt' },
  { name: 'Nguyễn Hoàng Đức', tier: 'S+', positions: ['PIVOT', 'ALA_LEFT'], isGoalkeeper: false, note: 'Kỹ thuật cá nhân điêu luyện' },
  { name: 'Đặng Văn Lâm', tier: 'S', positions: ['GK'], isGoalkeeper: true, note: 'Thể hình tốt, phản xạ nhanh' },
  { name: 'Quế Ngọc Hải', tier: 'S', positions: ['FIXO'], isGoalkeeper: false, note: 'Thủ lĩnh hàng phòng ngự' },
  { name: 'Bùi Tấn Trường', tier: 'S', positions: ['GK'], isGoalkeeper: true, note: 'Kinh nghiệm dạn dày' },

  // Tier A+ / A (12 players - 2 GKs, 10 Outfield)
  { name: 'Phan Văn Đức', tier: 'A+', positions: ['ALA_LEFT'], isGoalkeeper: false, note: 'Tốc độ, dứt điểm sắc bén' },
  { name: 'Vũ Văn Thanh', tier: 'A+', positions: ['ALA_RIGHT'], isGoalkeeper: false, note: 'Thể lực dồi dào, lên công về thủ' },
  { name: 'Đoàn Văn Hậu', tier: 'A+', positions: ['FIXO'], isGoalkeeper: false, note: 'Tranh chấp bóng bổng mạnh mẽ' },
  { name: 'Nguyễn Tiến Linh', tier: 'A+', positions: ['PIVOT'], isGoalkeeper: false, note: 'Chớp thời cơ trong vòng cấm' },
  { name: 'Đỗ Hùng Dũng', tier: 'A+', positions: ['FIXO', 'ALA_LEFT'], isGoalkeeper: false, note: 'Cầm trịch tuyến giữa' },
  { name: 'Nguyễn Văn Toàn', tier: 'A+', positions: ['ALA_RIGHT'], isGoalkeeper: false, note: 'Bứt tốc phá bẫy việt vị' },
  { name: 'Trần Nguyên Mạnh', tier: 'A', positions: ['GK'], isGoalkeeper: true, note: 'Bắt bóng bổng chắc tay' },
  { name: 'Bùi Tiến Dũng', tier: 'A', positions: ['GK'], isGoalkeeper: true, note: 'Bắt penalty cực hay' },
  { name: 'Nguyễn Tuấn Anh', tier: 'A', positions: ['ALA_LEFT', 'FIXO'], isGoalkeeper: false, note: 'Chuyền bóng mềm mại' },
  { name: 'Nguyễn Phong Hồng Duy', tier: 'A', positions: ['ALA_LEFT'], isGoalkeeper: false, note: 'Leo biên thần tốc' },
  { name: 'Phạm Đức Huy', tier: 'A', positions: ['FIXO'], isGoalkeeper: false, note: 'Đá quyết liệt, lăn xả' },
  { name: 'Hà Đức Chinh', tier: 'A', positions: ['PIVOT'], isGoalkeeper: false, note: 'Tì đè làm tường' },

  // Tier B+ / B (12 players - 2 GKs, 10 Outfield)
  { name: 'Nguyễn Đình Triệu', tier: 'B+', positions: ['GK'], isGoalkeeper: true, note: 'Ra vào hợp lý' },
  { name: 'Lương Xuân Trường', tier: 'B+', positions: ['FIXO'], isGoalkeeper: false, note: 'Kiến tạo tầm xa' },
  { name: 'Nguyễn Công Phượng', tier: 'B+', positions: ['PIVOT', 'ALA_LEFT'], isGoalkeeper: false, note: 'Rê dắt tạo đột biến' },
  { name: 'Bùi Hoàng Việt Anh', tier: 'B+', positions: ['FIXO'], isGoalkeeper: false, note: 'Đọc tình huống thông minh' },
  { name: 'Nguyễn Thanh Bình', tier: 'B+', positions: ['FIXO'], isGoalkeeper: false, note: 'Thể lực sung mãn' },
  { name: 'Phạm Tuấn Hải', tier: 'B+', positions: ['PIVOT'], isGoalkeeper: false, note: 'Năng nổ, pressing rát' },
  { name: 'Quan Văn Chuẩn', tier: 'B', positions: ['GK'], isGoalkeeper: true, note: 'Chơi chân tốt' },
  { name: 'Nhâm Mạnh Dũng', tier: 'B', positions: ['PIVOT'], isGoalkeeper: false, note: 'Không chiến tốt' },
  { name: 'Châu Ngọc Quang', tier: 'B', positions: ['ALA_RIGHT'], isGoalkeeper: false, note: 'Cần cù, hỗ trợ phòng ngự' },
  { name: 'Lê Phạm Thành Long', tier: 'B', positions: ['FIXO'], isGoalkeeper: false, note: 'Phân phối bóng nhịp nhàng' },
  { name: 'Triệu Việt Hưng', tier: 'B', positions: ['ALA_LEFT'], isGoalkeeper: false, note: 'Đột phá cánh trái' },
  { name: 'Trương Tiến Anh', tier: 'B', positions: ['ALA_RIGHT'], isGoalkeeper: false, note: 'Chạy cánh dẻo dai' },

  // Tier C+ / C (8 players - 8 Outfield)
  { name: 'Khuất Văn Khang', tier: 'C+', positions: ['ALA_LEFT'], isGoalkeeper: false, note: 'Trẻ khỏe, khéo léo' },
  { name: 'Nguyễn Thái Sơn', tier: 'C+', positions: ['FIXO'], isGoalkeeper: false, note: 'Chạy không biết mệt' },
  { name: 'Đinh Thanh Bình', tier: 'C+', positions: ['PIVOT'], isGoalkeeper: false, note: 'Tì đè nhiệt tình' },
  { name: 'Nguyễn Đức Chiến', tier: 'C+', positions: ['FIXO'], isGoalkeeper: false, note: 'Đánh chặn từ xa' },
  { name: 'Giáp Tuấn Dương', tier: 'C+', positions: ['FIXO'], isGoalkeeper: false, note: 'Kèm người sát sao' },
  { name: 'Hoàng Thái Bình', tier: 'C', positions: ['ALA_LEFT'], isGoalkeeper: false, note: 'Tạt bóng chuẩn xác' },
  { name: 'Võ Minh Trọng', tier: 'C', positions: ['ALA_LEFT'], isGoalkeeper: false, note: 'Tốc độ cánh trái' },
  { name: 'Lê Văn Đô', tier: 'C', positions: ['ALA_RIGHT'], isGoalkeeper: false, note: 'Sút xa uy lực' },

  // Tier D+ / D (4 players - 1 GK, 3 Outfield)
  { name: 'Nguyễn Văn Việt', tier: 'D+', positions: ['GK'], isGoalkeeper: true, note: 'Thủ môn trẻ tiềm năng' },
  { name: 'Nguyễn Văn Tùng', tier: 'D+', positions: ['PIVOT'], isGoalkeeper: false, note: 'Tiền đạo trẻ càn lướt' },
  { name: 'Bùi Vĩ Hào', tier: 'D+', positions: ['PIVOT'], isGoalkeeper: false, note: 'Dứt điểm nhanh' },
  { name: 'Trần Nam Hải', tier: 'D', positions: ['FIXO'], isGoalkeeper: false, note: 'Phòng ngự cơ bản' },
];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run demo tournament seed in production environment.');
  }
  console.log('⚽ Bắt đầu seed 42 thành viên cho giải CSE Cup 2026...');

  const passwordHash = await bcrypt.hash('player123', 10);
  const seededUsers = [];

  for (let i = 0; i < PLAYERS_DATA.length; i++) {
    const item = PLAYERS_DATA[i];
    const username = `csecup_player_${i + 1}`;
    const email = `${username}@csecup.vn`;

    const user = await prisma.user.upsert({
      where: { username },
      update: {
        displayName: item.name,
        tier: item.tier,
        isGoalkeeper: item.isGoalkeeper,
        membershipStatus: 'APPROVED',
      },
      create: {
        username,
        email,
        passwordHash,
        displayName: item.name,
        role: 'MEMBER',
        tier: item.tier,
        isGoalkeeper: item.isGoalkeeper,
        membershipStatus: 'APPROVED',
        phone: `0988${String(i + 1).padStart(6, '0')}`,
      },
    });

    seededUsers.push({
      ...user,
      preferredPositions: item.positions,
      note: item.note,
    });
  }

  console.log(`✅ Đã upsert ${seededUsers.length} user với đầy đủ Tier vào cơ sở dữ liệu.`);

  // Tìm Admin để gán làm creator nếu chưa có tournament
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminId = admin ? admin.id : seededUsers[0].id;

  // Tìm hoặc tạo Tournament "CSE Cup 2026"
  let tournament = await prisma.tournament.findFirst({
    where: { title: 'CSE Cup 2026' },
  });

  const teamColors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0d9488'];
  const initialTeams = [];
  for (let i = 1; i <= 6; i++) {
    const group = i <= 3 ? 'A' : 'B';
    initialTeams.push({
      id: `team-${i}`,
      name: `Đội ${String.fromCharCode(64 + i)}`,
      color: teamColors[i - 1],
      group,
      captainId: null,
      captainName: null,
      totalTierScore: 0,
      averageTierScore: 0,
      players: [],
    });
  }

  const registrations = seededUsers.map((u, idx) => ({
    userId: u.id,
    displayName: u.displayName,
    username: u.username,
    avatar: u.avatar || null,
    tier: u.tier,
    positions: u.preferredPositions,
    note: u.note,
    registeredAt: new Date(Date.now() - (42 - idx) * 60000).toISOString(),
  }));

  const tournamentSettings = {
    format: 'FUTSAL_5V5',
    teamCount: 6,
    playersPerTeam: 7,
    hasPenalty: true,
  };

  const newState = {
    phase: 'DRAFT',
    settings: tournamentSettings,
    registrations,
    teams: initialTeams,
    fixtures: [],
  };

  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        title: 'CSE Cup 2026',
        createdById: adminId,
        organizerIds: [adminId],
        state: newState,
        revision: 0,
      },
    });
    console.log(`✅ Đã tạo mới giải đấu: CSE Cup 2026 (ID: ${tournament.id})`);
  } else {
    tournament = await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        state: newState,
        revision: { increment: 1 },
      },
    });
    console.log(`✅ Đã cập nhật giải đấu CSE Cup 2026 (ID: ${tournament.id}) với 42 cầu thủ.`);
  }

  console.log(`🎉 Hoàn tất! Giải CSE Cup 2026 đã sẵn sàng:`);
  console.log(`   - Số đội: 6 đội`);
  console.log(`   - Số cầu thủ mỗi đội: 7 người`);
  console.log(`   - Tổng số cầu thủ đã đăng ký: ${registrations.length} người (mỗi người đều có Tier & vị trí)`);
  console.log(`   - Có 8 thủ môn (đảm bảo mỗi đội đều có ít nhất 1 thủ môn khi chia đội).`);
}

seed()
  .catch((e) => {
    console.error('❌ Lỗi khi seed CSE Cup 2026:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
