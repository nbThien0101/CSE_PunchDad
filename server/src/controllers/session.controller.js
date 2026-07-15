const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

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
          select: { id: true, displayName: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true },
        },
        votes: {
          include: {
            user: {
              select: { id: true, displayName: true },
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
          select: { id: true, displayName: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true, phone: true },
        },
        votes: {
          include: {
            user: {
              select: { id: true, displayName: true },
            },
          },
          orderBy: { votedAt: 'asc' },
        },
        payments: {
          include: {
            user: {
              select: { id: true, displayName: true },
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
        if (field === 'playDate' || field === 'voteDeadline') {
          updateData[field] = new Date(req.body[field]);
        } else if (field === 'minPlayers' || field === 'maxPlayers') {
          updateData[field] = parseInt(req.body[field]);
        } else if (field === 'totalCost') {
          updateData[field] = parseFloat(req.body[field]);
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
          select: { id: true, displayName: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true },
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

module.exports = {
  getSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
};
