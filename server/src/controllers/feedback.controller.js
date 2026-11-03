const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CATEGORIES = new Set(['BUG', 'FEATURE', 'UX', 'OTHER']);
const STATUSES = new Set(['NEW', 'REVIEWING', 'RESOLVED']);

const createFeedback = async (req, res, next) => {
  try {
    const category = String(req.body.category || 'OTHER').toUpperCase();
    const message = String(req.body.message || '').trim();
    const pagePath = String(req.body.pagePath || '').trim();
    const rating = req.body.rating === null || req.body.rating === undefined || req.body.rating === ''
      ? null
      : Number(req.body.rating);

    if (!CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'Loại phản hồi không hợp lệ' });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: 'Nội dung phản hồi cần ít nhất 10 ký tự' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Nội dung phản hồi tối đa 2.000 ký tự' });
    }
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Mức đánh giá phải từ 1 đến 5' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: req.user.id,
        category,
        rating,
        message,
        pagePath: pagePath.slice(0, 300) || null,
      },
      select: { id: true, status: true, createdAt: true },
    });

    res.status(201).json({
      message: 'Cảm ơn bạn! Phản hồi đã được gửi đến đội ngũ phát triển.',
      feedback,
    });
  } catch (error) {
    next(error);
  }
};

const getFeedbacks = async (req, res, next) => {
  try {
    const status = String(req.query.status || '').toUpperCase();
    const category = String(req.query.category || '').toUpperCase();
    const where = {};

    if (status && STATUSES.has(status)) where.status = status;
    if (category && CATEGORIES.has(category)) where.category = category;

    const feedbacks = await prisma.feedback.findMany({
      where,
      include: {
        user: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const grouped = await prisma.feedback.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const stats = { total: 0, NEW: 0, REVIEWING: 0, RESOLVED: 0 };
    grouped.forEach((item) => {
      stats[item.status] = item._count._all;
      stats.total += item._count._all;
    });

    res.json({ feedbacks, stats });
  } catch (error) {
    next(error);
  }
};

const updateFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = String(req.body.status || '').toUpperCase();
    const adminNote = String(req.body.adminNote || '').trim();

    if (!STATUSES.has(status)) {
      return res.status(400).json({ error: 'Trạng thái phản hồi không hợp lệ' });
    }
    if (adminNote.length > 2000) {
      return res.status(400).json({ error: 'Ghi chú nội bộ tối đa 2.000 ký tự' });
    }

    const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy phản hồi' });

    const feedback = await prisma.feedback.update({
      where: { id },
      data: { status, adminNote: adminNote || null },
      include: {
        user: { select: { id: true, displayName: true, username: true, avatar: true } },
      },
    });

    res.json({ message: 'Đã cập nhật phản hồi', feedback });
  } catch (error) {
    next(error);
  }
};

module.exports = { createFeedback, getFeedbacks, updateFeedback };
