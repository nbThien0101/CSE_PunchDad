const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Lấy thông báo chưa lưu trữ và chưa đọc bởi userId
    const unreadNotices = await prisma.notice.findMany({
      where: {
        archivedAt: null,
        reads: {
          none: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true },
    });

    res.json({
      unreadCount: unreadNotices.length,
      latestUnread: unreadNotices[0] || null,
    });
  } catch (error) {
    next(error);
  }
};

const getNotices = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const includeArchived = req.query.includeArchived === 'true' && req.user.role === 'ADMIN';

    const where = includeArchived ? {} : { archivedAt: null };

    const rawNotices = await prisma.notice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: {
          select: { id: true, displayName: true, username: true, role: true },
        },
        tournament: {
          select: { id: true, title: true },
        },
        reads: {
          where: { userId },
          select: { readAt: true },
        },
      },
    });

    const notices = rawNotices.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
      archivedAt: n.archivedAt,
      author: n.author,
      tournament: n.tournament,
      isRead: n.reads.length > 0,
    }));

    res.json({ notices, nextCursor: null });
  } catch (error) {
    next(error);
  }
};

const createNotice = async (req, res, next) => {
  try {
    const { title, body, tournamentId } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ error: 'Tiêu đề thông báo phải có ít nhất 3 ký tự' });
    }
    if (!body || typeof body !== 'string' || body.trim().length < 5) {
      return res.status(400).json({ error: 'Nội dung thông báo phải có ít nhất 5 ký tự' });
    }

    if (tournamentId) {
      const exists = await prisma.tournament.findUnique({ where: { id: tournamentId } });
      if (!exists) {
        return res.status(400).json({ error: 'Giải đấu liên kết không tồn tại' });
      }
    }

    const notice = await prisma.notice.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        authorId: req.user.id,
        tournamentId: tournamentId || null,
      },
      include: {
        author: { select: { id: true, displayName: true } },
        tournament: { select: { id: true, title: true } },
      },
    });

    res.status(201).json({
      message: 'Đã tạo thông báo thành công',
      notice: {
        ...notice,
        isRead: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await prisma.noticeRead.upsert({
      where: {
        noticeId_userId: {
          noticeId: id,
          userId,
        },
      },
      create: {
        noticeId: id,
        userId,
      },
      update: {
        readAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const archiveNotice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }

    await prisma.notice.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    res.json({ success: true, message: 'Đã lưu trữ thông báo' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
  getNotices,
  createNotice,
  markRead,
  archiveNotice,
};
