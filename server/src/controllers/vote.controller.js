const { PrismaClient } = require('@prisma/client');
const { calculateMinutesBeforeMatch, checkIsLateDecline } = require('./attendance.controller');

const prisma = new PrismaClient();

/**
 * Kiểm tra xem user có khoản thanh toán nào chưa hoàn tất ở các trận đấu trước không.
 * @param {string} userId - ID của user cần kiểm tra
 * @param {object} session - Session hiện tại đang được vote/xem (cần id, playDate)
 * @param {object} [dbClient] - Prisma client (tùy chọn)
 * @returns {Promise<object|null>} Trả về thông tin khoản nợ hoặc null nếu không nợ
 */
const checkUnpaidPreviousPayment = async (userId, session, dbClient = prisma) => {
  if (!userId || !session) return null;

  const unpaidPayments = await dbClient.payment.findMany({
    where: {
      userId,
      status: { not: 'CONFIRMED' },
      session: {
        id: { not: session.id },
        status: { not: 'CANCELLED' },
        playDate: { lte: session.playDate },
      },
    },
    include: {
      session: {
        select: {
          id: true,
          title: true,
          playDate: true,
          startTime: true,
          location: true,
        },
      },
    },
    orderBy: [
      { session: { playDate: 'desc' } },
      { session: { createdAt: 'desc' } },
    ],
  });

  if (!unpaidPayments || unpaidPayments.length === 0) {
    return null;
  }

  const latestUnpaid = unpaidPayments[0];
  const totalDebt = unpaidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const formatDateStr = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const formattedDate = formatDateStr(latestUnpaid.session.playDate);
  const formattedAmount = Math.round(Number(latestUnpaid.amount)).toLocaleString('vi-VN');

  let errorMessage = '';
  if (unpaidPayments.length === 1) {
    errorMessage = `Bạn chưa thanh toán tiền sân ở trận đấu trước (${latestUnpaid.session.title} ngày ${formattedDate}: ${formattedAmount}đ). Vui lòng hoàn tất thanh toán trước khi bình chọn tham gia.`;
  } else {
    errorMessage = `Bạn còn ${unpaidPayments.length} trận đấu trước chưa thanh toán tiền sân (gần nhất: ${latestUnpaid.session.title}, tổng nợ: ${Math.round(totalDebt).toLocaleString('vi-VN')}đ). Vui lòng hoàn tất thanh toán trước khi bình chọn tham gia.`;
  }

  return {
    hasUnpaid: true,
    count: unpaidPayments.length,
    totalDebt,
    latestPaymentId: latestUnpaid.id,
    sessionId: latestUnpaid.session.id,
    sessionTitle: latestUnpaid.session.title,
    playDate: latestUnpaid.session.playDate,
    amount: Number(latestUnpaid.amount),
    errorMessage,
  };
};

/**
 * POST /api/votes
 * User vote cho một session
 */
const castVote = async (req, res, next) => {
  try {
    const { sessionId, status, reason } = req.body;

    if (!sessionId || !status) {
      return res.status(400).json({ error: 'sessionId and status are required' });
    }

    if (!['JOIN', 'DECLINE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be JOIN or DECLINE' });
    }

    // Kiểm tra session tồn tại
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Chỉ cho phép vote khi session đang ở VOTING hoặc CONFIRMED (chưa book / completed / cancelled)
    if (!['VOTING', 'CONFIRMED'].includes(session.status)) {
      return res.status(400).json({ error: 'Trận đấu không còn nhận bình chọn' });
    }

    // Kiểm tra session đã bị Admin chốt danh sách vote chưa
    if (session.isVoteLocked && status !== 'DECLINE') {
      return res.status(400).json({
        error: 'Admin đã chốt danh sách bình chọn. Vui lòng liên hệ Admin nếu muốn tham gia.',
        isVoteLocked: true,
      });
    }

    // Kiểm tra deadline
    if (session.voteDeadline && new Date() > session.voteDeadline && status !== 'DECLINE') {
      return res.status(400).json({ error: 'Đã hết hạn bình chọn' });
    }

    // Kiểm tra chưa thanh toán trận đấu trước
    if (status !== 'DECLINE') {
      const unpaidCheck = await checkUnpaidPreviousPayment(req.user.id, session);
      if (unpaidCheck) {
        return res.status(400).json({
          error: unpaidCheck.errorMessage,
          unpaidPayment: unpaidCheck,
        });
      }
    }

    // Lấy vote cũ nếu có để kiểm tra việc chuyển trạng thái sang DECLINE
    const existingVote = await prisma.vote.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId: req.user.id,
        },
      },
    });

    // Nếu chuyển sang DECLINE (đặc biệt khi trước đó đã vote JOIN hoặc đang sát giờ / đã chốt danh sách)
    let absenceLog = null;
    if (status === 'DECLINE') {
      const minutesBeforeMatch = calculateMinutesBeforeMatch(session, new Date());
      const isLate = checkIsLateDecline(session, new Date());

      // Ghi log báo vắng nếu trước đó từng vote JOIN hoặc nếu báo vắng sát giờ / sau khi chốt danh sách
      if (existingVote?.status === 'JOIN' || isLate) {
        absenceLog = await prisma.absenceLog.create({
          data: {
            sessionId,
            userId: req.user.id,
            reason: reason || (isLate ? 'Báo vắng sát giờ thi đấu' : 'Báo bận không tham gia được'),
            isLate,
            minutesBeforeMatch,
          },
        });
      }
    }

    // Upsert vote (tạo mới hoặc cập nhật nếu đã vote)
    const vote = await prisma.vote.upsert({
      where: {
        sessionId_userId: {
          sessionId,
          userId: req.user.id,
        },
      },
      update: {
        status,
        votedAt: new Date(),
        // Nếu báo vắng, reset trạng thái điểm danh
        ...(status === 'DECLINE' ? { isCheckedIn: false, checkedInAt: null } : {}),
      },
      create: {
        sessionId,
        userId: req.user.id,
        status,
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    // Kiểm tra đủ số lượng không
    if (status === 'JOIN') {
      const joinCount = await prisma.vote.count({
        where: { sessionId, status: 'JOIN' },
      });

      // Nếu đủ min_players và đang VOTING → chuyển status sang CONFIRMED
      if (joinCount >= session.minPlayers && session.status === 'VOTING') {
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'CONFIRMED' },
        });

        return res.json({
          message: 'Bình chọn thành công! Trận đấu đã đủ người tối thiểu!',
          vote,
          sessionConfirmed: true,
          joinCount,
        });
      }
    }

    // Đếm tổng joins hiện tại
    const joinCount = await prisma.vote.count({
      where: { sessionId, status: 'JOIN' },
    });

    let message = 'Đã ghi nhận bình chọn của bạn';
    if (status === 'DECLINE') {
      if (absenceLog?.isLate) {
        message = 'Đã ghi nhận báo vắng. Lưu ý: Bạn báo vắng sát giờ thi đấu (dưới 2 tiếng hoặc sau khi chốt danh sách).';
      } else {
        message = 'Đã ghi nhận báo vắng thành công.';
      }
    }

    res.json({
      message,
      vote,
      sessionConfirmed: false,
      joinCount,
      absenceLog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/votes/:id
 * Cập nhật vote
 */
const updateVote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['JOIN', 'DECLINE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be JOIN or DECLINE' });
    }

    // Kiểm tra vote thuộc về user hiện tại
    const existingVote = await prisma.vote.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!existingVote) {
      return res.status(404).json({ error: 'Vote not found' });
    }

    if (existingVote.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own vote' });
    }

    const session = existingVote.session;

    if (!['VOTING', 'CONFIRMED'].includes(session.status)) {
      return res.status(400).json({ error: 'Trận đấu không còn nhận bình chọn' });
    }

    if (session.isVoteLocked && status !== 'DECLINE') {
      return res.status(400).json({
        error: 'Admin đã chốt danh sách bình chọn. Vui lòng liên hệ Admin nếu muốn tham gia.',
        isVoteLocked: true,
      });
    }

    // Kiểm tra deadline
    if (session.voteDeadline && new Date() > session.voteDeadline && status !== 'DECLINE') {
      return res.status(400).json({ error: 'Đã hết hạn bình chọn' });
    }

    // Kiểm tra chưa thanh toán trận đấu trước
    if (status !== 'DECLINE') {
      const unpaidCheck = await checkUnpaidPreviousPayment(req.user.id, session);
      if (unpaidCheck) {
        return res.status(400).json({
          error: unpaidCheck.errorMessage,
          unpaidPayment: unpaidCheck,
        });
      }
    }

    let absenceLog = null;
    if (status === 'DECLINE') {
      const minutesBeforeMatch = calculateMinutesBeforeMatch(session, new Date());
      const isLate = checkIsLateDecline(session, new Date());

      if (existingVote.status === 'JOIN' || isLate) {
        absenceLog = await prisma.absenceLog.create({
          data: {
            sessionId: session.id,
            userId: req.user.id,
            reason: reason || (isLate ? 'Báo vắng sát giờ thi đấu' : 'Báo bận không tham gia được'),
            isLate,
            minutesBeforeMatch,
          },
        });
      }
    }

    const vote = await prisma.vote.update({
      where: { id },
      data: {
        status,
        votedAt: new Date(),
        ...(status === 'DECLINE' ? { isCheckedIn: false, checkedInAt: null } : {}),
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    let message = 'Cập nhật bình chọn thành công';
    if (status === 'DECLINE') {
      if (absenceLog?.isLate) {
        message = 'Đã ghi nhận báo vắng. Lưu ý: Bạn báo vắng sát giờ thi đấu (dưới 2 tiếng hoặc sau khi chốt danh sách).';
      } else {
        message = 'Đã ghi nhận báo vắng.';
      }
    }

    res.json({ message, vote, absenceLog });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/votes/session/:sessionId
 * Lấy danh sách votes của một session
 */
const getSessionVotes = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const votes = await prisma.vote.findMany({
      where: { sessionId },
      include: {
        user: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
      orderBy: { votedAt: 'asc' },
    });

    const summary = {
      join: votes.filter(v => v.status === 'JOIN').length,
      decline: votes.filter(v => v.status === 'DECLINE').length,
      maybe: votes.filter(v => v.status === 'MAYBE').length,
      total: votes.length,
    };

    res.json({ votes, summary });
  } catch (error) {
    next(error);
  }
};

module.exports = { castVote, updateVote, getSessionVotes, checkUnpaidPreviousPayment };
