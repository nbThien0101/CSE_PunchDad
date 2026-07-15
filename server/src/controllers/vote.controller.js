const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * POST /api/votes
 * User vote cho một session
 */
const castVote = async (req, res, next) => {
  try {
    const { sessionId, status } = req.body;

    if (!sessionId || !status) {
      return res.status(400).json({ error: 'sessionId and status are required' });
    }

    if (!['JOIN', 'DECLINE', 'MAYBE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be JOIN, DECLINE, or MAYBE' });
    }

    // Kiểm tra session tồn tại và đang ở trạng thái VOTING
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'VOTING') {
      return res.status(400).json({ error: 'Session is no longer accepting votes' });
    }

    // Kiểm tra deadline
    if (session.voteDeadline && new Date() > session.voteDeadline) {
      return res.status(400).json({ error: 'Vote deadline has passed' });
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
      },
      create: {
        sessionId,
        userId: req.user.id,
        status,
      },
      include: {
        user: {
          select: { id: true, displayName: true },
        },
      },
    });

    // Kiểm tra đủ số lượng không
    if (status === 'JOIN') {
      const joinCount = await prisma.vote.count({
        where: { sessionId, status: 'JOIN' },
      });

      // Nếu đủ min_players → auto confirm
      if (joinCount >= session.minPlayers && session.status === 'VOTING') {
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'CONFIRMED' },
        });

        return res.json({
          message: 'Vote recorded! Session has been CONFIRMED - enough players!',
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

    res.json({
      message: 'Vote recorded',
      vote,
      sessionConfirmed: false,
      joinCount,
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
    const { status } = req.body;

    if (!['JOIN', 'DECLINE', 'MAYBE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be JOIN, DECLINE, or MAYBE' });
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

    if (existingVote.session.status !== 'VOTING') {
      return res.status(400).json({ error: 'Session is no longer accepting votes' });
    }

    const vote = await prisma.vote.update({
      where: { id },
      data: { status, votedAt: new Date() },
      include: {
        user: {
          select: { id: true, displayName: true },
        },
      },
    });

    res.json({ message: 'Vote updated', vote });
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
          select: { id: true, displayName: true },
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
