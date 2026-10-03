const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { balanceTeams, getSuggestedTeamCounts } = require('../services/team-balancer.service');
const { checkUnpaidPreviousPayment } = require('./vote.controller');

const prisma = new PrismaClient();

const normalizeTimeSlots = (timeSlots, fallbackStartTime, fallbackEndTime) => {
  const slots = Array.isArray(timeSlots) && timeSlots.length
    ? timeSlots
    : [{ startTime: fallbackStartTime, endTime: fallbackEndTime }];

  const normalized = slots.map(slot => ({
    startTime: String(slot.startTime || '').trim(),
    endTime: String(slot.endTime || '').trim(),
  }));
  const validTime = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const hasInvalid = normalized.some(slot => (
    !validTime.test(slot.startTime)
    || !validTime.test(slot.endTime)
    || slot.startTime >= slot.endTime
  ));
  const uniqueKeys = new Set(normalized.map(slot => `${slot.startTime}-${slot.endTime}`));

  if (hasInvalid || uniqueKeys.size !== normalized.length || normalized.length > 20) return null;
  return normalized;
};

const isGoogleMapsUrl = (value) => {
  if (!value) return true;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    const isGoogleHost = hostname === 'google.com' || hostname.endsWith('.google.com');
    const isShortMapsUrl = hostname === 'maps.app.goo.gl'
      || (hostname === 'goo.gl' && url.pathname.startsWith('/maps'));
    const isGoogleMapsPath = url.pathname.startsWith('/maps') || hostname === 'maps.google.com';

    return url.protocol === 'https:'
      && (isShortMapsUrl || (isGoogleHost && isGoogleMapsPath));
  } catch {
    return false;
  }
};

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
        timeSlots: {
          include: {
            _count: { select: { votes: { where: { vote: { status: 'JOIN' } } } } },
          },
          orderBy: [{ startTime: 'asc' }, { endTime: 'asc' }],
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
 * GET /api/sessions/:sessionId
 * Lấy chi tiết một session
 */
const getSession = async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
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
            timeSlotVotes: { select: { timeSlotId: true } },
          },
          orderBy: { votedAt: 'asc' },
        },
        timeSlots: {
          include: {
            votes: {
              where: { vote: { status: 'JOIN' } },
              include: {
                vote: {
                  include: {
                    user: { select: { id: true, displayName: true, avatar: true } },
                  },
                },
              },
            },
          },
          orderBy: [{ startTime: 'asc' }, { endTime: 'asc' }],
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

    // Kiểm tra xem user hiện tại có nợ tiền sân ở trận đấu trước không
    let unpaidPreviousPayment = null;
    if (req.user?.id) {
      unpaidPreviousPayment = await checkUnpaidPreviousPayment(req.user.id, session);
    }

    res.json({ session: { ...session, unpaidPreviousPayment } });
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
      location, googleMapsUrl, minPlayers, maxPlayers, voteDeadline, timeSlots,
    } = req.body;

    if (!isGoogleMapsUrl(googleMapsUrl)) {
      return res.status(400).json({ error: 'Vui lòng nhập link Google Maps hợp lệ' });
    }

    const normalizedTimeSlots = normalizeTimeSlots(timeSlots, startTime, endTime);
    if (!normalizedTimeSlots) {
      return res.status(400).json({ error: 'Danh sách khung giờ không hợp lệ hoặc bị trùng' });
    }

    const session = await prisma.session.create({
      data: {
        title,
        playDate: new Date(playDate),
        startTime: normalizedTimeSlots[0].startTime,
        endTime: normalizedTimeSlots[0].endTime,
        location,
        googleMapsUrl: googleMapsUrl || null,
        minPlayers: parseInt(minPlayers),
        maxPlayers: parseInt(maxPlayers),
        voteDeadline: voteDeadline ? new Date(voteDeadline) : null,
        createdById: req.user.id,
        timeSlots: { create: normalizedTimeSlots },
      },
      include: {
        createdBy: {
          select: { id: true, displayName: true },
        },
        timeSlots: true,
      },
    });

    res.status(201).json({ message: 'Session created', session });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/sessions/:sessionId
 * Admin cập nhật session (đặt sân, chọn người thanh toán, v.v.)
 */
const updateSession = async (req, res, next) => {
  try {
    const { sessionId: id } = req.params;
    const updateData = {};
    let normalizedTimeSlots;
    const existingSession = await prisma.session.findUnique({
      where: { id },
      select: { id: true, status: true, cancellationNote: true },
    });
    if (!existingSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Chỉ cho phép update các field hợp lệ
    const allowedFields = [
      'title', 'playDate', 'startTime', 'endTime',
      'location', 'googleMapsUrl', 'minPlayers', 'maxPlayers', 'totalCost',
      'payerId', 'status', 'voteDeadline', 'splitCount', 'cancellationNote',
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
        } else if (field === 'splitCount') {
          updateData[field] = req.body[field] !== null && req.body[field] !== '' ? parseInt(req.body[field]) : null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    if (updateData.cancellationNote !== undefined) {
      updateData.cancellationNote = updateData.cancellationNote === null
        ? null
        : String(updateData.cancellationNote).trim() || null;
      if (updateData.cancellationNote?.length > 500) {
        return res.status(400).json({ error: 'Ghi chú hủy trận tối đa 500 ký tự' });
      }
    }

    const resultingStatus = updateData.status || existingSession.status;
    const resultingCancellationNote = updateData.cancellationNote !== undefined
      ? updateData.cancellationNote
      : existingSession.cancellationNote;
    if (resultingStatus === 'CANCELLED' && !resultingCancellationNote) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do hủy trận đấu' });
    }

    if (updateData.status && updateData.status !== 'CANCELLED') {
      updateData.cancellationNote = null;
    }

    if (!isGoogleMapsUrl(updateData.googleMapsUrl)) {
      return res.status(400).json({ error: 'Vui lòng nhập link Google Maps hợp lệ' });
    }


    if (req.body.timeSlots !== undefined) {
      const candidateTimeSlots = normalizeTimeSlots(req.body.timeSlots, req.body.startTime, req.body.endTime);
      if (!candidateTimeSlots) {
        return res.status(400).json({ error: 'Danh sách khung giờ không hợp lệ hoặc bị trùng' });
      }
      const existingTimeSlots = await prisma.sessionTimeSlot.findMany({
        where: { sessionId: id },
        select: { startTime: true, endTime: true },
        orderBy: [{ startTime: 'asc' }, { endTime: 'asc' }],
      });
      const slotKey = slots => slots
        .map(slot => `${slot.startTime}-${slot.endTime}`)
        .sort()
        .join('|');
      if (slotKey(candidateTimeSlots) !== slotKey(existingTimeSlots)) {
        normalizedTimeSlots = candidateTimeSlots;
        if (['BOOKED', 'COMPLETED'].includes(existingSession.status)
          || ['BOOKED', 'COMPLETED'].includes(updateData.status)) {
          return res.status(400).json({ error: 'Không thể thay đổi các khung giờ sau khi đã chốt sân' });
        }
        updateData.startTime = normalizedTimeSlots[0].startTime;
        updateData.endTime = normalizedTimeSlots[0].endTime;
        updateData.selectedTimeSlotId = null;
      } else {
        delete updateData.startTime;
        delete updateData.endTime;
      }
    }

    if (updateData.status === 'BOOKED') {
      const rankedSlots = await prisma.sessionTimeSlot.findMany({
        where: { sessionId: id },
        include: {
          _count: { select: { votes: { where: { vote: { status: 'JOIN' } } } } },
        },
        orderBy: [{ startTime: 'asc' }, { endTime: 'asc' }],
      });
      const requestedSlot = req.body.selectedTimeSlotId
        ? rankedSlots.find(slot => slot.id === req.body.selectedTimeSlotId)
        : null;
      const selectedSlot = requestedSlot || rankedSlots.reduce((best, slot) => (
        !best || slot._count.votes > best._count.votes ? slot : best
      ), null);

      if (req.body.selectedTimeSlotId && !requestedSlot) {
        return res.status(400).json({ error: 'Khung giờ được chọn không thuộc trận đấu này' });
      }
      if (selectedSlot) {
        updateData.selectedTimeSlotId = selectedSlot.id;
        updateData.startTime = selectedSlot.startTime;
        updateData.endTime = selectedSlot.endTime;
      }
    }

    const session = await prisma.$transaction(async tx => {
      if (normalizedTimeSlots) {
        await tx.sessionTimeSlot.deleteMany({ where: { sessionId: id } });
      }
      return tx.session.update({
      where: { id },
      data: {
        ...updateData,
        ...(normalizedTimeSlots ? { timeSlots: { create: normalizedTimeSlots } } : {}),
      },
      include: {
        createdBy: {
          select: { id: true, displayName: true, avatar: true },
        },
        payer: {
          select: { id: true, displayName: true, bankInfo: true, avatar: true },
        },
        timeSlots: {
          include: {
            _count: { select: { votes: { where: { vote: { status: 'JOIN' } } } } },
          },
          orderBy: [{ startTime: 'asc' }, { endTime: 'asc' }],
        },
      },
      });
    });

    // Nếu session chuyển sang BOOKED và có totalCost, tạo payment records
    if (updateData.status === 'BOOKED' && updateData.totalCost) {
      const joinedVotes = await prisma.vote.findMany({
        where: { sessionId: id, status: 'JOIN' },
      });

      const amountPerPerson = Math.round(parseFloat(updateData.totalCost) / (updateData.splitCount || joinedVotes.length));

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
 * POST /api/sessions/:sessionId/cancel
 * Admin hủy session
 */
const deleteSession = async (req, res, next) => {
  try {
    const cancellationNote = String(req.body?.cancellationNote || '').trim();
    if (!cancellationNote) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do hủy trận đấu' });
    }
    if (cancellationNote.length > 500) {
      return res.status(400).json({ error: 'Ghi chú hủy trận tối đa 500 ký tự' });
    }

    const session = await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { status: 'CANCELLED', cancellationNote },
    });

    res.json({ message: 'Session cancelled', session });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/sessions/:sessionId/force
 * Admin xóa vĩnh viễn session (hard delete) cùng tất cả votes và payments liên quan
 */
const adminDeleteSession = async (req, res, next) => {
  try {
    const { sessionId: id } = req.params;

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
 * GET /api/sessions/:sessionId/teams/suggestions
 * Gợi ý số lượng đội có thể chia dựa trên số người vote
 */
const getTeamSuggestions = async (req, res, next) => {
  try {
    const { sessionId: id } = req.params;
    const joinCount = await prisma.vote.count({
      where: { sessionId: id, status: 'JOIN' },
    });
    const guestCount = await prisma.guestPlayer.count({
      where: { sessionId: id, status: 'PLAYING' },
    });
    const totalPlayers = joinCount + guestCount;
    const suggestions = getSuggestedTeamCounts(totalPlayers);
    res.json({ totalJoin: totalPlayers, memberCount: joinCount, guestCount, suggestions });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sessions/:sessionId/teams/generate
 * Chạy thuật toán chia team cân bằng theo Tier & Thủ môn
 */
const generateTeams = async (req, res, next) => {
  try {
    const { sessionId: id } = req.params;
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
 * PUT /api/sessions/:sessionId/teams
 * Lưu cấu hình chia đội chính thức vào Session
 */
const saveTeams = async (req, res, next) => {
  try {
    const { sessionId: id } = req.params;
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
 * DELETE /api/sessions/:sessionId/teams
 * Xóa danh sách đội đã chia
 */
const deleteTeams = async (req, res, next) => {
  try {
    const { sessionId: id } = req.params;

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
