const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';

async function runTests() {
  console.log('🧪 Bắt đầu kiểm tra hệ thống Điểm danh, Khóa vote, Khách mời & Cảnh cáo...\n');
  let testSessionId = null;

  try {
    // 1. Tìm hoặc tạo tài khoản Admin & Member
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      console.log('Tạo admin test...');
      admin = await prisma.user.create({
        data: {
          username: 'test_admin_' + Date.now(),
          displayName: 'Test Admin',
          passwordHash: 'dummy',
          role: 'ADMIN',
        },
      });
    }

    let member = await prisma.user.findFirst({ where: { role: 'MEMBER' } });
    if (!member) {
      console.log('Tạo member test...');
      member = await prisma.user.create({
        data: {
          username: 'test_member_' + Date.now(),
          displayName: 'Test Member',
          passwordHash: 'dummy',
          role: 'MEMBER',
          tier: 'B',
        },
      });
    }

    // 2. Tạo trận đấu mẫu
    const now = new Date();
    const session = await prisma.session.create({
      data: {
        title: 'Trận Test Điểm Danh ' + Date.now(),
        playDate: now,
        startTime: '19:00',
        endTime: '21:00',
        location: 'Sân Bóng Test',
        minPlayers: 4,
        maxPlayers: 10,
        totalCost: 600000,
        createdById: admin.id,
        payerId: admin.id,
      },
    });
    testSessionId = session.id;
    console.log(`✅ [1/7] Tạo trận đấu mẫu thành công (ID: ${session.id})`);

    // 3. Member vote JOIN
    const voteController = require('../src/controllers/vote.controller');
    const attendanceController = require('../src/controllers/attendance.controller');

    // Simulate member voting JOIN
    let reqVote = {
      body: { sessionId: session.id, status: 'JOIN' },
      user: member,
    };
    let resVote = {
      status: (code) => ({
        json: (data) => {
          if (code >= 400) throw new Error(data.error || 'Vote failed');
          return data;
        },
      }),
      json: (data) => data,
    };
    let voteResult;
    await voteController.castVote(reqVote, resVote, (err) => {
      if (err) throw err;
    });
    console.log('✅ [2/7] Thành viên vote JOIN thành công');

    // 4. Admin chốt danh sách vote (Lock vote)
    let reqLock = {
      params: { id: session.id },
      body: { isLocked: true },
      user: admin,
    };
    let lockResult;
    let resLock = {
      json: (data) => { lockResult = data; },
      status: (code) => ({ json: (d) => d }),
    };
    await attendanceController.toggleLockVote(reqLock, resLock, (err) => { if (err) throw err; });
    if (!lockResult.isVoteLocked) throw new Error('Lock vote failed');
    console.log('✅ [3/7] Admin chốt danh sách vote thành công (isVoteLocked = true)');

    // 5. Kiểm tra: Member không thể vote JOIN nữa sau khi đã chốt
    let blocked = false;
    let reqBlocked = {
      body: { sessionId: session.id, status: 'JOIN' },
      user: member,
    };
    let resBlocked = {
      status: (code) => ({
        json: (data) => {
          if (code === 400 && data.isVoteLocked) blocked = true;
          return data;
        },
      }),
      json: (d) => d,
    };
    await voteController.castVote(reqBlocked, resBlocked, (err) => {});
    if (!blocked) throw new Error('Cơ chế khóa vote không chặn được lượt vote JOIN mới');
    console.log('✅ [4/7] Chặn vote JOIN thành công sau khi đã chốt danh sách');

    // 6. Member báo vắng (DECLINE) sau khi chốt / sát giờ -> Ghi log cảnh cáo
    let reqDecline = {
      body: { sessionId: session.id, status: 'DECLINE', reason: 'Kẹt xe đột xuất không đến kịp' },
      user: member,
    };
    let declineData;
    let resDecline = {
      json: (d) => { declineData = d; },
      status: (code) => ({ json: (d) => d }),
    };
    await voteController.castVote(reqDecline, resDecline, (err) => { if (err) throw err; });

    const absenceLog = await prisma.absenceLog.findFirst({
      where: { sessionId: session.id, userId: member.id },
    });
    if (!absenceLog || !absenceLog.isLate) {
      throw new Error('Không ghi nhận được AbsenceLog hoặc không gắn cờ isLate');
    }
    console.log(`✅ [5/7] Báo vắng thành công & ghi nhận log vi phạm sát giờ (isLate: ${absenceLog.isLate}, lý do: "${absenceLog.reason}")`);

    // 7. Thêm khách mời (Guest Player) và điểm danh
    let reqGuest = {
      params: { id: session.id },
      body: {
        name: 'Bạn Hùng (Khách)',
        tier: 'A',
        isGoalkeeper: true,
        status: 'RESERVE',
      },
      user: admin,
    };
    let guestData;
    let resGuest = {
      status: (code) => ({ json: (d) => { guestData = d; } }),
      json: (d) => { guestData = d; },
    };
    await attendanceController.addGuest(reqGuest, resGuest, (err) => { if (err) throw err; });
    const guest = guestData.guest;
    if (!guest || guest.status !== 'RESERVE') throw new Error('Thêm khách vào dự bị thất bại');
    console.log(`✅ [6/7] Thêm khách mời vào danh sách dự bị thành công: ${guest.name} (${guest.status})`);

    // Đôn khách lên đá chính và điểm danh có mặt
    await prisma.guestPlayer.update({
      where: { id: guest.id },
      data: { status: 'PLAYING', isCheckedIn: true, checkedInAt: new Date() },
    });

    // Điểm danh cho Admin
    await prisma.vote.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId: admin.id } },
      update: { status: 'JOIN', isCheckedIn: true, checkedInAt: new Date() },
      create: { sessionId: session.id, userId: admin.id, status: 'JOIN', isCheckedIn: true, checkedInAt: new Date() },
    });

    // 8. Tính lại tiền sân theo người có mặt
    let recalcData;
    let reqRecalc = {
      params: { id: session.id },
      user: admin,
    };
    let resRecalc = {
      json: (d) => { recalcData = d; },
      status: (code) => ({ json: (d) => { throw new Error(d.error); } }),
    };
    await attendanceController.recalculatePayments(reqRecalc, resRecalc, (err) => { if (err) throw err; });

    // Tổng 2 người có mặt (Admin + Guest Hùng), tổng tiền 600,000 -> 300,000đ/người
    if (recalcData.totalAttendees !== 2 || recalcData.amountPerPerson !== 300000) {
      throw new Error(`Tính tiền sân sai: mong đợi 300000đ cho 2 người, nhận được: ${recalcData.amountPerPerson}đ cho ${recalcData.totalAttendees} người`);
    }
    console.log(`✅ [7/7] Tính lại tiền sân theo người có mặt thành công: ${recalcData.amountPerPerson.toLocaleString('vi-VN')}đ/người (${recalcData.totalAttendees} người có mặt)`);

    console.log('\n🎉 TẤT CẢ 7/7 BƯỚC KIỂM TRA ĐỀU HOÀN TOÀN CHÍNH XÁC VÀ ĐẠT CHUẨN!');
  } finally {
    if (testSessionId) {
      await prisma.session.delete({ where: { id: testSessionId } }).catch(() => {});
      console.log('🧹 Dọn dẹp dữ liệu test thành công.');
    }
    await prisma.$disconnect();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Lỗi kiểm tra:', err);
    process.exit(1);
  });
