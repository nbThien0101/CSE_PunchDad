const { PrismaClient } = require('@prisma/client');
const pushService = require('../services/push.service');
const notificationService = require('../services/notification.service');

const prisma = new PrismaClient();

const VALID_SEND_TARGETS = new Set(['ALL', 'USERS', 'SESSION_JOINED', 'SESSION_UNPAID']);

/**
 * GET /api/notifications/config
 * Trả về cấu hình Push Notification công khai (gồm VAPID Public Key cho iOS PWA / Web Push).
 */
const getPushConfig = (req, res) => {
  res.json(pushService.getPushCapabilities());
};

/**
 * GET /api/notifications
 * Lấy danh sách thông báo in-app của người dùng hiện tại.
 */
const listNotifications = async (req, res, next, dbClient = prisma) => {
  try {
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where = {
      userId: req.user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      dbClient.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbClient.notification.count({ where }),
      dbClient.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Lấy số lượng thông báo chưa đọc để hiển thị badge trên mobile app.
 */
const getUnreadCount = async (req, res, next, dbClient = prisma) => {
  try {
    const unreadCount = await dbClient.notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notifications/:id/read
 * Đánh dấu một thông báo là đã đọc.
 */
const markAsRead = async (req, res, next, dbClient = prisma) => {
  try {
    const { id } = req.params;
    const existing = await dbClient.notification.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }

    const notification = existing.isRead
      ? existing
      : await dbClient.notification.update({
          where: { id },
          data: { isRead: true, readAt: new Date() },
        });

    res.json({ message: 'Đã đánh dấu đã đọc', notification });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notifications/read-all
 * Đánh dấu toàn bộ thông báo của user hiện tại là đã đọc.
 */
const markAllAsRead = async (req, res, next, dbClient = prisma) => {
  try {
    const result = await dbClient.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      updatedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notifications/:id
 * Xóa một thông báo của user hiện tại.
 */
const deleteNotification = async (req, res, next, dbClient = prisma) => {
  try {
    const result = await dbClient.notification.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }

    res.json({ message: 'Đã xóa thông báo' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/subscriptions
 * Liệt kê các thiết bị/trình duyệt đang đăng ký nhận push của user hiện tại.
 */
const listSubscriptions = async (req, res, next, dbClient = prisma) => {
  try {
    const subscriptions = await dbClient.pushSubscription.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });

    res.json({
      subscriptions: subscriptions.map(notificationService.sanitizeSubscriptionSummary),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/subscriptions
 * Đăng ký thiết bị nhận push notification (Android APK FCM/Expo hoặc iOS PWA Web Push).
 */
const registerPushSubscription = async (req, res, next, dbClient = prisma) => {
  try {
    const result = await notificationService.registerSubscription(
      {
        userId: req.user.id,
        body: req.body,
        userAgent: req.headers['user-agent'],
      },
      dbClient
    );

    if (result.error) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    res.status(201).json({
      message: 'Đã đăng ký thiết bị nhận thông báo',
      subscription: result.subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notifications/subscriptions
 * DELETE /api/notifications/subscriptions/:id
 * Hủy đăng ký nhận push theo subscriptionId, endpoint hoặc device token.
 */
const unregisterPushSubscription = async (req, res, next, dbClient = prisma) => {
  try {
    const paramId = req.params?.id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const query = req.query && typeof req.query === 'object' ? req.query : {};

    const result = await notificationService.unregisterSubscription(
      {
        userId: req.user.id,
        subscriptionId: paramId || body.subscriptionId || query.subscriptionId,
        endpoint: body.endpoint || query.endpoint,
        token: body.token || body.deviceToken || query.token,
        channel: body.channel || query.channel,
      },
      dbClient
    );

    if (result.error) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    if (paramId && result.deletedCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đăng ký thiết bị' });
    }

    res.json({
      message: result.deletedCount > 0
        ? 'Đã hủy đăng ký nhận thông báo'
        : 'Không tìm thấy thiết bị cần hủy',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/test
 * Gửi push notification thử nghiệm tới chính các thiết bị đã đăng ký của user hiện tại.
 */
const sendTestNotification = async (
  req,
  res,
  next,
  dbClient = prisma,
  pushTransport = pushService
) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : '🔔 Thử nghiệm thông báo CSE HitDad';
    const messageBody = typeof body.body === 'string' && body.body.trim()
      ? body.body.trim()
      : 'Push notification đang hoạt động bình thường trên thiết bị của bạn!';
    const url = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : '/';
    const subscriptionId = typeof body.subscriptionId === 'string' && body.subscriptionId.trim()
      ? body.subscriptionId.trim()
      : null;

    if (title.length > 120) {
      return res.status(400).json({ error: 'Tiêu đề tối đa 120 ký tự' });
    }
    if (messageBody.length > 500) {
      return res.status(400).json({ error: 'Nội dung thông báo tối đa 500 ký tự' });
    }

    if (subscriptionId) {
      const targetSub = await dbClient.pushSubscription.findFirst({
        where: { id: subscriptionId, userId: req.user.id },
      });
      if (!targetSub) {
        return res.status(404).json({ error: 'Không tìm thấy thiết bị đăng ký của bạn' });
      }
      if (!targetSub.isActive) {
        return res.status(400).json({ error: 'Thiết bị này đang bị vô hiệu hóa, vui lòng đăng ký lại subscription' });
      }
    }

    const report = await notificationService.dispatchNotificationToUsers(
      {
        userIds: [req.user.id],
        type: 'TEST_PUSH',
        title,
        body: messageBody,
        url,
        data: body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {},
        subscriptionIds: subscriptionId ? [subscriptionId] : null,
      },
      dbClient,
      pushTransport
    );

    const hasSuccess = report.sent > 0;
    const message = report.attempted === 0
      ? 'Đã lưu thông báo trong hộp thư, nhưng tài khoản của bạn chưa đăng ký thiết bị push nào.'
      : hasSuccess
        ? `Đã gửi push thử nghiệm tới ${report.sent}/${report.attempted} thiết bị.`
        : 'Chưa thể gửi push tới thiết bị. Kiểm tra cấu hình VAPID/FCM hoặc trạng thái token trong results.';

    res.json({
      message,
      notificationId: report.notificationIds[0] || null,
      summary: {
        attempted: report.attempted,
        sent: report.sent,
        failed: report.failed,
        skipped: report.skippedCount,
      },
      results: report.results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/send
 * Admin gửi thông báo tùy chỉnh / nhắc lịch / nhắc đóng tiền đến thành viên.
 */
const sendAdminNotification = async (
  req,
  res,
  next,
  dbClient = prisma,
  pushTransport = pushService
) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
    const target = typeof body.target === 'string' ? body.target.trim().toUpperCase() : 'ALL';
    const type = typeof body.type === 'string' && body.type.trim()
      ? body.type.trim().toUpperCase()
      : 'ANNOUNCEMENT';
    const url = typeof body.url === 'string' && body.url.trim()
      ? body.url.trim()
      : (body.sessionId ? `/sessions/${body.sessionId}` : '/');
    const excludeSelf = Boolean(body.excludeSelf);

    if (title.length < 2 || title.length > 120) {
      return res.status(400).json({ error: 'Tiêu đề thông báo phải từ 2 đến 120 ký tự' });
    }
    if (messageBody.length < 2 || messageBody.length > 1000) {
      return res.status(400).json({ error: 'Nội dung thông báo phải từ 2 đến 1000 ký tự' });
    }
    if (!VALID_SEND_TARGETS.has(target)) {
      return res.status(400).json({ error: 'Đối tượng nhận không hợp lệ (hỗ trợ ALL, USERS, SESSION_JOINED, SESSION_UNPAID)' });
    }

    let targetUserIds = [];

    if (target === 'ALL') {
      const users = await dbClient.user.findMany({
        where: { membershipStatus: 'APPROVED' },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    } else if (target === 'USERS') {
      const requestedIds = Array.isArray(body.userIds)
        ? [...new Set(body.userIds.filter((id) => typeof id === 'string' && id.trim()))]
        : [];
      if (requestedIds.length === 0 || requestedIds.length > 200) {
        return res.status(400).json({ error: 'userIds phải là mảng chứa từ 1 đến 200 ID người dùng' });
      }
      const validUsers = await dbClient.user.findMany({
        where: { id: { in: requestedIds }, membershipStatus: 'APPROVED' },
        select: { id: true },
      });
      targetUserIds = validUsers.map((u) => u.id);
    } else {
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!sessionId) {
        return res.status(400).json({ error: 'Vui lòng cung cấp sessionId cho đối tượng theo trận đấu' });
      }
      const session = await dbClient.session.findUnique({
        where: { id: sessionId },
        select: { id: true },
      });
      if (!session) {
        return res.status(404).json({ error: 'Không tìm thấy trận đấu' });
      }

      if (target === 'SESSION_JOINED') {
        const votes = await dbClient.vote.findMany({
          where: { sessionId, status: 'JOIN' },
          select: { userId: true },
        });
        targetUserIds = votes.map((v) => v.userId);
      } else {
        const unpaidPayments = await dbClient.payment.findMany({
          where: { sessionId, status: { not: 'CONFIRMED' } },
          select: { userId: true },
        });
        targetUserIds = unpaidPayments.map((p) => p.userId);
      }
    }

    const filteredIds = excludeSelf
      ? targetUserIds.filter((id) => id !== req.user.id)
      : targetUserIds;

    if (filteredIds.length === 0) {
      return res.json({
        message: 'Không có người nhận phù hợp',
        recipientCount: 0,
        notificationIds: [],
        deliverySummary: { attempted: 0, sent: 0, failed: 0, skipped: 0 },
      });
    }

    const report = await notificationService.dispatchNotificationToUsers(
      {
        userIds: filteredIds,
        type,
        title,
        body: messageBody,
        url,
        data: {
          ...(body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {}),
          ...(body.sessionId ? { sessionId: body.sessionId } : {}),
        },
      },
      dbClient,
      pushTransport
    );

    res.json({
      message: `Đã gửi thông báo đến ${report.recipientCount} thành viên`,
      recipientCount: report.recipientCount,
      notificationIds: report.notificationIds,
      deliverySummary: {
        attempted: report.attempted,
        sent: report.sent,
        failed: report.failed,
        skipped: report.skippedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPushConfig,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  listSubscriptions,
  registerPushSubscription,
  unregisterPushSubscription,
  sendTestNotification,
  sendAdminNotification,
};
