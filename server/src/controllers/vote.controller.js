const { PrismaClient } = require('@prisma/client');
const { calculateMinutesBeforeMatch, checkIsLateDecline } = require('./attendance.controller');

const prisma = new PrismaClient();

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

module.exports = { castVote, updateVote, getSessionVotes };
