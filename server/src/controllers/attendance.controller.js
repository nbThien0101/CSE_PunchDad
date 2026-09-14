const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Tính toán thời điểm bắt đầu trận đấu (Date object)
 */
function getMatchStartDateTime(playDate, startTimeStr) {
  const d = new Date(playDate);
  const [hours, minutes] = (startTimeStr || '00:00').split(':').map(Number);
  d.setHours(hours || 0, minutes || 0, 0, 0);
  return d;
}

/**
 * Tính số phút trước khi trận đấu bắt đầu
 * Dương: trước giờ đá (vd: +90 nghĩa là trước 90p)
 * Âm: sau giờ đá (vd: -15 nghĩa là sau khi trận đấu đã bắt đầu 15p)
 */
function calculateMinutesBeforeMatch(session, targetDate = new Date()) {
  const matchStart = getMatchStartDateTime(session.playDate, session.startTime);
  const diffMs = matchStart.getTime() - new Date(targetDate).getTime();
  return Math.round(diffMs / (60 * 1000));
}

/**
 * Kiểm tra việc báo vắng có bị coi là sát giờ / vi phạm hay không:
 * - Dưới 120 phút (2 tiếng) trước giờ bóng lăn HOẶC
 * - Báo vắng sau khi Admin đã chốt danh sách vote (isVoteLocked = true)
 */
function checkIsLateDecline(session, targetDate = new Date()) {
  const minutes = calculateMinutesBeforeMatch(session, targetDate);
  return minutes < 120 || Boolean(session.isVoteLocked);
}

/**
 * POST /api/sessions/:id/lock-vote
 * Admin chốt danh sách vote hoặc mở lại bình chọn
 */
const toggleLockVote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body;

    const session = await prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy trận đấu' });
    }

    const nextLockState = isLocked !== undefined ? Boolean(isLocked) : !session.isVoteLocked;

    const updated = await prisma.session.update({
      where: { id },
      data: {
        isVoteLocked: nextLockState,
        voteLockedAt: nextLockState ? new Date() : null,
      },
    });

    res.json({
      message: nextLockState ? 'Đã chốt danh sách bình chọn!' : 'Đã mở lại bình chọn!',
      isVoteLocked: updated.isVoteLocked,
      voteLockedAt: updated.voteLockedAt,
      session: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sessions/:id/attendance
 * Lấy toàn bộ dữ liệu cho Matchday Attendance Dashboard
 */
const getAttendanceDashboard = async (req, res, next) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, displayName: true, avatar: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true, avatar: true },
        },
        votes: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                tier: true,
                isGoalkeeper: true,
                phone: true,
              },
            },
          },
          orderBy: { votedAt: 'asc' },
        },
        guests: {
          orderBy: { addedAt: 'asc' },
        },
        absenceLogs: {
          include: {
            user: {
              select: { id: true, displayName: true, avatar: true, phone: true },
            },
          },
          orderBy: { reportedAt: 'desc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy trận đấu' });
    }

    const matchStart = getMatchStartDateTime(session.playDate, session.startTime);
    const now = new Date();

    // Phân loại danh sách vote
    const joined = session.votes.filter(v => v.status === 'JOIN');
    const maybe = session.votes.filter(v => v.status === 'MAYBE');
    const declined = session.votes.filter(v => v.status === 'DECLINE');

    // Thống kê thành viên điểm danh
    const attendedMembers = joined.filter(v => v.isCheckedIn);
    const unattendedMembers = joined.filter(v => !v.isCheckedIn);

    // Thống kê khách mời (guests)
    const attendedGuests = session.guests.filter(g => g.isCheckedIn);
    const reserveGuests = session.guests.filter(g => g.status === 'RESERVE');
    const playingGuests = session.guests.filter(g => g.status === 'PLAYING');

    // Xác định các trường hợp cảnh cáo:
    // 1. Late Cancellations: Báo vắng trong vòng 2 tiếng hoặc sau khi chốt vote
    const lateCancellations = session.absenceLogs.filter(log => log.isLate);

    // 2. No-Shows (Bùng kèo): Vote JOIN nhưng không đến điểm danh
    // CHỈ coi là No-Show vi phạm khi trận đấu ĐÃ BẮT ĐẦU hoặc session đã kết thúc/booked
    const isMatchStarted = now >= matchStart;
    const isSessionDone = ['BOOKED', 'COMPLETED'].includes(session.status);
    const shouldFlagNoShow = isMatchStarted || isSessionDone;

    const noShows = shouldFlagNoShow
      ? unattendedMembers.map(v => ({
          userId: v.userId,
          user: v.user,
          votedAt: v.votedAt,
          type: 'NO_SHOW',
          message: 'Đăng ký tham gia nhưng không có mặt điểm danh khi trận đấu bắt đầu',
        }))
      : [];

    const summary = {
      totalVoters: session.votes.length,
      joinedCount: joined.length,
      maybeCount: maybe.length,
      declinedCount: declined.length,
      attendedMembersCount: attendedMembers.length,
      unattendedMembersCount: unattendedMembers.length,
      attendedGuestsCount: attendedGuests.length,
      totalGuestsCount: session.guests.length,
      reserveGuestsCount: reserveGuests.length,
      playingGuestsCount: playingGuests.length,
      // Tổng số người thực tế sẵn sàng trên sân (thành viên điểm danh + khách có mặt)
      totalAttendedOnPitch: attendedMembers.length + attendedGuests.length,
      lateCancellationsCount: lateCancellations.length,
      noShowsCount: noShows.length,
      totalWarningsCount: lateCancellations.length + noShows.length,
      isMatchStarted,
      isVoteLocked: session.isVoteLocked,
      voteLockedAt: session.voteLockedAt,
      matchStartTime: matchStart.toISOString(),
      minutesToMatch: Math.round((matchStart.getTime() - now.getTime()) / (60 * 1000)),
    };

    res.json({
      session,
      joined,
      maybe,
      declined,
      guests: session.guests,
      absenceLogs: session.absenceLogs,
      warnings: {
        lateCancellations,
        noShows,
      },
      summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sessions/:id/attendance
 * Admin điểm danh 1 thành viên (Có mặt / Chưa có mặt)
 */
const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, isCheckedIn, checkInNote } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Tìm vote hiện tại
    const existingVote = await prisma.vote.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId,
        },
      },
    });

    let vote;
    if (existingVote) {
      vote = await prisma.vote.update({
        where: { id: existingVote.id },
        data: {
          isCheckedIn: Boolean(isCheckedIn),
          checkedInAt: isCheckedIn ? new Date() : null,
          checkInNote: checkInNote !== undefined ? checkInNote : existingVote.checkInNote,
        },
        include: {
          user: {
            select: { id: true, displayName: true, avatar: true, tier: true, isGoalkeeper: true },
          },
        },
      });
    } else {
      // Nếu chưa vote nhưng có mặt trên sân, tạo luôn vote JOIN kèm điểm danh
      vote = await prisma.vote.create({
        data: {
          sessionId: id,
          userId,
          status: 'JOIN',
          isCheckedIn: Boolean(isCheckedIn),
          checkedInAt: isCheckedIn ? new Date() : null,
          checkInNote: checkInNote || 'Điểm danh trực tiếp tại sân',
        },
        include: {
          user: {
            select: { id: true, displayName: true, avatar: true, tier: true, isGoalkeeper: true },
          },
        },
      });
    }

    res.json({
      message: vote.isCheckedIn ? 'Đã điểm danh có mặt' : 'Đã hủy điểm danh',
      vote,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sessions/:id/attendance/bulk
 * Admin điểm danh nhanh tất cả người đã vote JOIN hoặc hủy tất cả
 */
const bulkAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isCheckedIn } = req.body;

    const checked = Boolean(isCheckedIn);

    const result = await prisma.vote.updateMany({
      where: {
        sessionId: id,
        status: 'JOIN',
      },
      data: {
        isCheckedIn: checked,
        checkedInAt: checked ? new Date() : null,
      },
    });

    res.json({
      message: checked ? `Đã điểm danh toàn bộ (${result.count} người)` : 'Đã hủy điểm danh toàn bộ',
      count: result.count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sessions/:id/guests
 * Admin thêm khách mời mới (Guest player)
 * Mặc định nằm trong danh sách Dự bị (status = RESERVE)
 */
const addGuest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, tier, isGoalkeeper, note, status, isCheckedIn } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên khách mời không được để trống' });
    }

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy trận đấu' });
    }

    const checked = Boolean(isCheckedIn);

    const guest = await prisma.guestPlayer.create({
      data: {
        sessionId: id,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        tier: tier || 'C',
        isGoalkeeper: Boolean(isGoalkeeper),
        status: status || 'RESERVE', // Mặc định là dự bị
        isCheckedIn: checked,
        checkedInAt: checked ? new Date() : null,
        note: note ? note.trim() : null,
      },
    });

    res.status(201).json({
      message: 'Đã thêm khách mời vào danh sách dự bị',
      guest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/sessions/:id/guests/:guestId
 * Admin cập nhật thông tin khách mời (đổi trạng thái dự bị / đá chính, điểm danh, sửa thông tin)
 */
const updateGuest = async (req, res, next) => {
  try {
    const { id, guestId } = req.params;
    const { name, phone, tier, isGoalkeeper, status, isCheckedIn, note } = req.body;

    const existingGuest = await prisma.guestPlayer.findUnique({
      where: { id: guestId },
    });

    if (!existingGuest || existingGuest.sessionId !== id) {
      return res.status(404).json({ error: 'Không tìm thấy khách mời' });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (phone !== undefined) data.phone = phone ? phone.trim() : null;
    if (tier !== undefined) data.tier = tier;
    if (isGoalkeeper !== undefined) data.isGoalkeeper = Boolean(isGoalkeeper);
    if (status !== undefined) data.status = status;
    if (note !== undefined) data.note = note ? note.trim() : null;

    if (isCheckedIn !== undefined) {
      data.isCheckedIn = Boolean(isCheckedIn);
      data.checkedInAt = Boolean(isCheckedIn) ? (existingGuest.checkedInAt || new Date()) : null;
    }

    const updatedGuest = await prisma.guestPlayer.update({
      where: { id: guestId },
      data,
    });

    res.json({
      message: 'Cập nhật khách mời thành công',
      guest: updatedGuest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/sessions/:id/guests/:guestId
 * Admin xóa khách mời khỏi trận đấu
 */
const deleteGuest = async (req, res, next) => {
  try {
    const { id, guestId } = req.params;

    const existing = await prisma.guestPlayer.findUnique({
      where: { id: guestId },
    });

    if (!existing || existing.sessionId !== id) {
      return res.status(404).json({ error: 'Không tìm thấy khách mời' });
    }

    await prisma.guestPlayer.delete({
      where: { id: guestId },
    });

    res.json({ message: 'Đã xóa khách mời khỏi trận đấu' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sessions/:id/recalculate-payments
 * Tính toán lại tiền sân dựa trên số người THỰC TẾ CÓ MẶT (Attended Members + Attended Guests)
 */
const recalculatePayments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        votes: {
          where: { isCheckedIn: true },
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
        guests: {
          where: { isCheckedIn: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy trận đấu' });
    }

    if (!session.totalCost || Number(session.totalCost) <= 0) {
      return res.status(400).json({ error: 'Trận đấu chưa có tổng chi phí tiền sân để chia' });
    }

    const attendedMembers = session.votes;
    const attendedGuests = session.guests;
    const totalAttendees = attendedMembers.length + attendedGuests.length;

    if (totalAttendees === 0) {
      return res.status(400).json({ error: 'Chưa có thành viên hoặc khách mời nào được điểm danh có mặt!' });
    }

    const totalCostNumber = parseFloat(session.totalCost);
    const amountPerPerson = Math.round(totalCostNumber / totalAttendees);

    const payerId = session.payerId;

    // Các thành viên có mặt (trừ người thanh toán / payer)
    const membersToPay = attendedMembers.filter(v => v.userId !== payerId);

    // Cập nhật hoặc tạo payments cho các thành viên có mặt
    // Xóa các payment PENDING của những người vắng mặt không đi
    const attendedUserIds = attendedMembers.map(v => v.userId);
    await prisma.payment.deleteMany({
      where: {
        sessionId: id,
        status: 'PENDING',
        userId: { notIn: attendedUserIds },
      },
    });

    // Cập nhật số tiền mới cho payments hiện có và tạo mới nếu chưa có
    for (const member of membersToPay) {
      await prisma.payment.upsert({
        where: {
          sessionId_userId: {
            sessionId: id,
            userId: member.userId,
          },
        },
        update: {
          amount: amountPerPerson,
        },
        create: {
          sessionId: id,
          userId: member.userId,
          amount: amountPerPerson,
          status: 'PENDING',
        },
      });
    }

    // Nếu người thanh toán (payer) có payment trước đó thì xóa bỏ
    if (payerId) {
      await prisma.payment.deleteMany({
        where: { sessionId: id, userId: payerId },
      });
    }

    const updatedPayments = await prisma.payment.findMany({
      where: { sessionId: id },
      include: {
        user: { select: { id: true, displayName: true, avatar: true } },
      },
    });

    res.json({
      message: `Đã tính lại tiền sân: ${amountPerPerson.toLocaleString('vi-VN')}đ/người (${totalAttendees} người có mặt: ${attendedMembers.length} thành viên + ${attendedGuests.length} khách)`,
      amountPerPerson,
      totalAttendees,
      attendedMembersCount: attendedMembers.length,
      attendedGuestsCount: attendedGuests.length,
      payments: updatedPayments,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMatchStartDateTime,
  calculateMinutesBeforeMatch,
  checkIsLateDecline,
  toggleLockVote,
  getAttendanceDashboard,
  updateAttendance,
  bulkAttendance,
  addGuest,
  updateGuest,
  deleteGuest,
  recalculatePayments,
};
