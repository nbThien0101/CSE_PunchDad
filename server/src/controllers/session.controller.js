const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { balanceTeams, getSuggestedTeamCounts } = require('../services/team-balancer.service');

const prisma = new PrismaClient();

/**
 * GET /api/sessions
 * Lấy danh sách tất cả sessions
 */
const getSessions = async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status) {
      where.status = status.toUpperCase();
    }

    const sessions = await prisma.session.findMany({
      where,
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
              select: { id: true, displayName: true, avatar: true },
            },
          },
        },
        _count: {
          select: {
            votes: { where: { status: 'JOIN' } },
          },
        },
      },
      orderBy: { playDate: 'desc' },
    });

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sessions/:id
 * Lấy chi tiết một session
 */
const getSession = async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: { id: true, displayName: true, avatar: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true, phone: true, avatar: true },
        },
        votes: {
          include: {
            user: {
              select: { id: true, displayName: true, avatar: true, tier: true, isGoalkeeper: true },
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
              select: { id: true, displayName: true, avatar: true },
            },
          },
          orderBy: { reportedAt: 'desc' },
        },
        payments: {
          include: {
            user: {
              select: { id: true, displayName: true, avatar: true },
            },
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sessions
 * Admin tạo session mới
 */
const createSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title, playDate, startTime, endTime,
      location, minPlayers, maxPlayers, voteDeadline,
    } = req.body;

    const session = await prisma.session.create({
      data: {
        title,
        playDate: new Date(playDate),
        startTime,
        endTime,
        location,
        minPlayers: parseInt(minPlayers),
        maxPlayers: parseInt(maxPlayers),
        voteDeadline: voteDeadline ? new Date(voteDeadline) : null,
        createdById: req.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, displayName: true },
        },
      },
    });

    res.status(201).json({ message: 'Session created', session });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/sessions/:id
 * Admin cập nhật session (đặt sân, chọn người thanh toán, v.v.)
 */
const updateSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = {};

    // Chỉ cho phép update các field hợp lệ
    const allowedFields = [
      'title', 'playDate', 'startTime', 'endTime',
      'location', 'minPlayers', 'maxPlayers', 'totalCost',
      'payerId', 'status', 'voteDeadline',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'playDate') {
          updateData[field] = new Date(req.body[field]);
        } else if (field === 'voteDeadline') {
          updateData[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else if (field === 'minPlayers' || field === 'maxPlayers') {
          updateData[field] = parseInt(req.body[field]);
        } else if (field === 'totalCost') {
          updateData[field] = req.body[field] !== null && req.body[field] !== '' ? parseFloat(req.body[field]) : null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const session = await prisma.session.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, displayName: true, avatar: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true, avatar: true },
        },
      },
    });

    // Nếu session chuyển sang BOOKED và có totalCost, tạo payment records
    if (updateData.status === 'BOOKED' && updateData.totalCost) {
      const joinedVotes = await prisma.vote.findMany({
        where: { sessionId: id, status: 'JOIN' },
      });

      const amountPerPerson = parseFloat(updateData.totalCost) / joinedVotes.length;

      // Tạo payment cho mỗi người tham gia (trừ người thanh toán)
      const paymentData = joinedVotes
        .filter(vote => vote.userId !== (updateData.payerId || session.payerId))
        .map(vote => ({
          sessionId: id,
          userId: vote.userId,
          amount: amountPerPerson,
        }));

      if (paymentData.length > 0) {
        await prisma.payment.createMany({
          data: paymentData,
          skipDuplicates: true,
        });
      }
    }

    res.json({ message: 'Session updated', session });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/sessions/:id
 * Admin hủy session
 */
const deleteSession = async (req, res, next) => {
  try {
    await prisma.session.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Session cancelled' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/sessions/:id/force
 * Admin xóa vĩnh viễn session (hard delete) cùng tất cả votes và payments liên quan
 */
const adminDeleteSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Kiểm tra session có tồn tại không
    const session = await prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Xóa vĩnh viễn session (votes và payments sẽ cascade delete)
    await prisma.session.delete({
      where: { id },
    });

    res.json({ message: 'Session permanently deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sessions/:id/teams/suggestions
 * Gợi ý số lượng đội có thể chia dựa trên số người vote
 */
const getTeamSuggestions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const joinCount = await prisma.vote.count({
      where: { sessionId: id, status: 'JOIN' },
    });
    const suggestions = getSuggestedTeamCounts(joinCount);
    res.json({ totalJoin: joinCount, suggestions });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sessions/:id/teams/generate
 * Chạy thuật toán chia team cân bằng theo Tier & Thủ môn
 */
const generateTeams = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { teamCount, goalkeeperOverrides, useAttendedOnly } = req.body;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, displayName: true, avatar: true, tier: true, isGoalkeeper: true },
            },
          },
          orderBy: { votedAt: 'asc' },
        },
        guests: {
          orderBy: { addedAt: 'asc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let candidates = session.votes;

    // Nếu chọn chỉ chia những người ĐÃ ĐIỂM DANH CÓ MẶT
    if (useAttendedOnly) {
      candidates = session.votes.filter(v => v.isCheckedIn);
      const attendedGuests = (session.guests || [])
        .filter(g => g.isCheckedIn)
        .map(g => ({
          id: g.id,
          status: 'JOIN',
          votedAt: g.addedAt,
          user: {
            id: g.id,
            displayName: `${g.name} (Khách)`,
            avatar: null,
            tier: g.tier || 'C',
            isGoalkeeper: g.isGoalkeeper,
            isGuest: true,
          },
        }));
      candidates = [...candidates, ...attendedGuests];
    } else {
      // Nếu chia bình thường nhưng có guest đang đá chính (PLAYING)
      const playingGuests = (session.guests || [])
        .filter(g => g.status === 'PLAYING')
        .map(g => ({
          id: g.id,
          status: 'JOIN',
          votedAt: g.addedAt,
          user: {
            id: g.id,
            displayName: `${g.name} (Khách)`,
            avatar: null,
            tier: g.tier || 'C',
            isGoalkeeper: g.isGoalkeeper,
            isGuest: true,
          },
        }));
      candidates = [...candidates, ...playingGuests];
    }

    const result = balanceTeams(candidates, { teamCount, goalkeeperOverrides });
    res.json({ result });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/sessions/:id/teams
 * Lưu cấu hình chia đội chính thức vào Session
 */
const saveTeams = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { teams } = req.body;

    const session = await prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updatedSession = await prisma.session.update({
      where: { id },
      data: { teams },
      include: {
        createdBy: {
          select: { id: true, displayName: true, avatar: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true, phone: true, avatar: true },
        },
        votes: {
          include: {
            user: {
              select: { id: true, displayName: true, avatar: true, tier: true, isGoalkeeper: true },
            },
          },
          orderBy: { votedAt: 'asc' },
        },
      },
    });

    res.json({ message: 'Lưu danh sách đội thành công', session: updatedSession });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/sessions/:id/teams
 * Xóa danh sách đội đã chia
 */
const deleteTeams = async (req, res, next) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updatedSession = await prisma.session.update({
      where: { id },
      data: { teams: null },
      include: {
        createdBy: {
          select: { id: true, displayName: true, avatar: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true, phone: true, avatar: true },
        },
        votes: {
          include: {
            user: {
              select: { id: true, displayName: true, avatar: true, tier: true, isGoalkeeper: true },
            },
          },
          orderBy: { votedAt: 'asc' },
        },
      },
    });

    res.json({ message: 'Đã hủy danh sách đội', session: updatedSession });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  adminDeleteSession,
  getTeamSuggestions,
  generateTeams,
  saveTeams,
  deleteTeams,
};
