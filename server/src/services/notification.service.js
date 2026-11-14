const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const pushService = require('./push.service');

const prisma = new PrismaClient();

const VALID_CHANNELS = new Set(['WEB_PUSH', 'FCM', 'EXPO']);
const VALID_PLATFORMS = new Set(['IOS_PWA', 'ANDROID_APK', 'WEB', 'OTHER']);
const MAX_CONSECUTIVE_FAILURES = 5;
const DISPATCH_CONCURRENCY = 10;

const hasPushTables = (dbClient) => Boolean(
  dbClient
  && typeof dbClient.pushSubscription?.findMany === 'function'
  && typeof dbClient.notification?.createMany === 'function'
  && typeof dbClient.user?.findMany === 'function'
);

const computeSubscriptionKey = (channel, identifier) => (
  crypto.createHash('sha256').update(`${channel}:${identifier}`).digest('hex')
);

const formatDateShort = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const formatCurrencyVnd = (amount) => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0đ';
  return `${Math.round(num).toLocaleString('vi-VN')}đ`;
};

const inferWebPlatform = (userAgent) => (
  /iphone|ipad|ipod/i.test(String(userAgent || '')) ? 'IOS_PWA' : 'WEB'
);

const isValidBase64Key = (value) => (
  typeof value === 'string'
  && value.length >= 16
  && value.length <= 512
  && /^[A-Za-z0-9+/_-]+={0,2}$/.test(value)
);

/**
 * Chuẩn hóa và kiểm tra dữ liệu đăng ký thiết bị push từ Mobile APK (FCM/Expo) hoặc iOS PWA (Web Push).
 */
const normalizeSubscriptionInput = (body, userAgent = '') => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Dữ liệu đăng ký push không hợp lệ' };
  }

  const rawSub = body.subscription && typeof body.subscription === 'object' && !Array.isArray(body.subscription)
    ? body.subscription
    : body;

  const rawEndpoint = typeof rawSub.endpoint === 'string' ? rawSub.endpoint.trim() : '';
  const rawToken = typeof body.token === 'string'
    ? body.token.trim()
    : (typeof body.deviceToken === 'string' ? body.deviceToken.trim() : '');

  let channel = typeof body.channel === 'string' ? body.channel.trim().toUpperCase() : '';
  if (!channel) {
    if (rawEndpoint) {
      channel = 'WEB_PUSH';
    } else if (/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(rawToken)) {
      channel = 'EXPO';
    } else if (rawToken) {
      channel = 'FCM';
    }
  }

  if (!VALID_CHANNELS.has(channel)) {
    return { error: 'Kênh push không hợp lệ (hỗ trợ WEB_PUSH, FCM, EXPO)' };
  }

  let platform = typeof body.platform === 'string' ? body.platform.trim().toUpperCase() : '';
  if (platform && !VALID_PLATFORMS.has(platform)) {
    return { error: 'Nền tảng không hợp lệ (hỗ trợ IOS_PWA, ANDROID_APK, WEB, OTHER)' };
  }

  const deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 120) || null : null;
  const appVersion = typeof body.appVersion === 'string' ? body.appVersion.trim().slice(0, 40) || null : null;
  const safeUserAgent = typeof body.userAgent === 'string'
    ? body.userAgent.trim().slice(0, 500) || null
    : (typeof userAgent === 'string' ? userAgent.trim().slice(0, 500) || null : null);

  if (channel === 'WEB_PUSH') {
    if (!rawEndpoint || rawEndpoint.length > 2048) {
      return { error: 'Web Push endpoint không hợp lệ' };
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawEndpoint);
    } catch {
      return { error: 'Web Push endpoint phải là một URL hợp lệ' };
    }

    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) {
      return { error: 'Web Push endpoint phải sử dụng giao thức HTTPS' };
    }

    const keys = rawSub.keys && typeof rawSub.keys === 'object' && !Array.isArray(rawSub.keys)
      ? rawSub.keys
      : {};
    const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
    const auth = typeof keys.auth === 'string' ? keys.auth.trim() : '';

    if (!isValidBase64Key(p256dh) || !isValidBase64Key(auth)) {
      return { error: 'Thiếu hoặc sai định dạng khóa mã hóa Web Push (keys.p256dh, keys.auth)' };
    }

    return {
      data: {
        channel,
        platform: platform || inferWebPlatform(safeUserAgent),
        subscriptionKey: computeSubscriptionKey(channel, rawEndpoint),
        endpoint: rawEndpoint,
        p256dh,
        auth,
        deviceToken: null,
        deviceName,
        appVersion,
        userAgent: safeUserAgent,
      },
    };
  }

  if (!rawToken || rawToken.length < 10 || rawToken.length > 4096) {
    return { error: 'Device push token không hợp lệ' };
  }

  if (channel === 'EXPO' && !/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(rawToken)) {
    return { error: 'Expo push token phải có dạng ExponentPushToken[...] hoặc ExpoPushToken[...]' };
  }

  return {
    data: {
      channel,
      platform: platform || 'ANDROID_APK',
      subscriptionKey: computeSubscriptionKey(channel, rawToken),
      endpoint: null,
      p256dh: null,
      auth: null,
      deviceToken: rawToken,
      deviceName,
      appVersion,
      userAgent: safeUserAgent,
    },
  };
};

/**
 * Ẩn các trường nhạy cảm (p256dh, auth, toàn bộ deviceToken) khi trả danh sách thiết bị về client.
 */
const sanitizeSubscriptionSummary = (subscription) => {
  let endpointOrigin = null;
  if (subscription.endpoint) {
    try {
      endpointOrigin = new URL(subscription.endpoint).origin;
    } catch {
      endpointOrigin = null;
    }
  }

  const tokenPreview = subscription.deviceToken
    ? `…${subscription.deviceToken.slice(-8)}`
    : null;

  return {
    id: subscription.id,
    channel: subscription.channel,
    platform: subscription.platform,
    deviceName: subscription.deviceName,
    appVersion: subscription.appVersion,
    endpointOrigin,
    tokenPreview,
    isActive: subscription.isActive,
    failureCount: subscription.failureCount,
    lastError: subscription.lastError,
    lastSuccessAt: subscription.lastSuccessAt,
    lastUsedAt: subscription.lastUsedAt,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
};

/**
 * Đăng ký hoặc làm mới push subscription cho user hiện tại.
 * Nếu thiết bị đổi tài khoản đăng nhập trên cùng trình duyệt/máy, quyền sở hữu tự chuyển sang user mới.
 */
const registerSubscription = async ({ userId, body, userAgent }, dbClient = prisma) => {
  const normalized = normalizeSubscriptionInput(body, userAgent);
  if (normalized.error) {
    return { error: normalized.error, statusCode: 400 };
  }

  const now = new Date();
  const payload = normalized.data;

  const subscription = await dbClient.pushSubscription.upsert({
    where: { subscriptionKey: payload.subscriptionKey },
    update: {
      userId,
      channel: payload.channel,
      platform: payload.platform,
      endpoint: payload.endpoint,
      p256dh: payload.p256dh,
      auth: payload.auth,
      deviceToken: payload.deviceToken,
      deviceName: payload.deviceName,
      appVersion: payload.appVersion,
      userAgent: payload.userAgent,
      isActive: true,
      failureCount: 0,
      lastError: null,
      lastUsedAt: now,
    },
    create: {
      userId,
      ...payload,
      isActive: true,
      failureCount: 0,
      lastUsedAt: now,
    },
  });

  return { subscription: sanitizeSubscriptionSummary(subscription) };
};

/**
 * Hủy đăng ký thiết bị push (gọi khi user logout hoặc tắt thông báo trên thiết bị).
 */
const unregisterSubscription = async ({ userId, subscriptionId, endpoint, token, channel }, dbClient = prisma) => {
  if (typeof subscriptionId === 'string' && subscriptionId.trim()) {
    const result = await dbClient.pushSubscription.deleteMany({
      where: { id: subscriptionId.trim(), userId },
    });
    return { deletedCount: result.count };
  }

  if (typeof endpoint === 'string' && endpoint.trim()) {
    const key = computeSubscriptionKey('WEB_PUSH', endpoint.trim());
    const result = await dbClient.pushSubscription.deleteMany({
      where: { userId, subscriptionKey: key },
    });
    return { deletedCount: result.count };
  }

  if (typeof token === 'string' && token.trim()) {
    const trimmedToken = token.trim();
    const normalizedChannel = typeof channel === 'string' ? channel.trim().toUpperCase() : '';
    const candidateKeys = VALID_CHANNELS.has(normalizedChannel)
      ? [computeSubscriptionKey(normalizedChannel, trimmedToken)]
      : [
          computeSubscriptionKey('FCM', trimmedToken),
          computeSubscriptionKey('EXPO', trimmedToken),
        ];

    const result = await dbClient.pushSubscription.deleteMany({
      where: { userId, subscriptionKey: { in: candidateKeys } },
    });
    return { deletedCount: result.count };
  }

  return { error: 'Vui lòng cung cấp subscriptionId, endpoint hoặc token để hủy đăng ký', statusCode: 400 };
};

const runInChunks = async (items, chunkSize, handler) => {
  const results = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(handler));
    results.push(...chunkResults);
  }
  return results;
};

const updateSubscriptionDeliveryState = async (subscription, delivery, dbClient) => {
  if (typeof dbClient.pushSubscription?.update !== 'function') return;
  const now = new Date();

  if (delivery.ok) {
    await dbClient.pushSubscription.update({
      where: { id: subscription.id },
      data: {
        failureCount: 0,
        lastError: null,
        lastSuccessAt: now,
        lastUsedAt: now,
      },
    }).catch(() => {});
    return;
  }

  if (delivery.status === 'SKIPPED') {
    return;
  }

  const nextFailures = (subscription.failureCount || 0) + 1;
  const shouldDeactivate = Boolean(delivery.permanent) || nextFailures >= MAX_CONSECUTIVE_FAILURES;

  await dbClient.pushSubscription.update({
    where: { id: subscription.id },
    data: {
      failureCount: nextFailures,
      isActive: shouldDeactivate ? false : subscription.isActive,
      lastError: String(delivery.error || 'Delivery failed').slice(0, 500),
      lastUsedAt: now,
    },
  }).catch(() => {});
};

const resolveNotificationPushStatus = ({ totalDevices, sent, failed, skipped }) => {
  if (totalDevices === 0) return 'NO_DEVICE';
  if (sent > 0 && failed === 0) return 'SENT';
  if (sent > 0 && failed > 0) return 'PARTIAL';
  if (sent === 0 && failed === 0 && skipped > 0) return 'SKIPPED';
  return 'FAILED';
};

/**
 * Lưu thông báo in-app và gửi push notification đến danh sách userIds.
 */
const dispatchNotificationToUsers = async (
  {
    userIds = [],
    type = 'GENERAL',
    title,
    body,
    data = {},
    url = '/',
    excludeUserId = null,
    subscriptionIds = null,
  },
  dbClient = prisma,
  pushTransport = pushService
) => {
  if (!hasPushTables(dbClient)) {
    return {
      skipped: true,
      recipientCount: 0,
      notificationIds: [],
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedCount: 0,
      results: [],
    };
  }

  const targetUserIds = [...new Set(
    (Array.isArray(userIds) ? userIds : [])
      .filter((id) => typeof id === 'string' && id.trim() && id !== excludeUserId)
  )];

  if (targetUserIds.length === 0) {
    return {
      recipientCount: 0,
      notificationIds: [],
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedCount: 0,
      results: [],
    };
  }

  const cleanTitle = String(title || 'CSE HitDad').trim().slice(0, 120);
  const cleanBody = String(body || '').trim().slice(0, 1000);
  const cleanType = String(type || 'GENERAL').trim().toUpperCase().slice(0, 60);
  const targetUrl = typeof url === 'string' && url.trim() ? url.trim() : '/';
  const payloadData = {
    ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
    url: targetUrl,
  };

  const notifications = targetUserIds.map((userId) => ({
    id: crypto.randomUUID(),
    userId,
    type: cleanType,
    title: cleanTitle,
    body: cleanBody,
    data: payloadData,
    pushStatus: 'PENDING',
    pushSentCount: 0,
    pushFailedCount: 0,
  }));

  await dbClient.notification.createMany({
    data: notifications,
  });

  const subWhere = {
    userId: { in: targetUserIds },
    isActive: true,
  };
  if (Array.isArray(subscriptionIds) && subscriptionIds.length > 0) {
    subWhere.id = { in: subscriptionIds };
  }

  const subscriptions = await dbClient.pushSubscription.findMany({
    where: subWhere,
  });

  const subscriptionsByUser = new Map();
  for (const sub of subscriptions) {
    if (!subscriptionsByUser.has(sub.userId)) {
      subscriptionsByUser.set(sub.userId, []);
    }
    subscriptionsByUser.get(sub.userId).push(sub);
  }

  const deliveryJobs = [];
  for (const notif of notifications) {
    const userSubs = subscriptionsByUser.get(notif.userId) || [];
    const payload = pushTransport.buildPushPayload({
      notificationId: notif.id,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      url: targetUrl,
      data: payloadData,
    });

    for (const sub of userSubs) {
      deliveryJobs.push({ notif, sub, payload });
    }
  }

  const jobResults = await runInChunks(deliveryJobs, DISPATCH_CONCURRENCY, async ({ notif, sub, payload }) => {
    const delivery = await pushTransport.sendToSubscription(sub, payload);
    await updateSubscriptionDeliveryState(sub, delivery, dbClient);
    return {
      notificationId: notif.id,
      userId: sub.userId,
      subscriptionId: sub.id,
      channel: sub.channel,
      platform: sub.platform,
      deviceName: sub.deviceName,
      status: delivery.status,
      ok: delivery.ok,
      permanent: Boolean(delivery.permanent),
      statusCode: delivery.statusCode || null,
      error: delivery.error || null,
    };
  });

  const statsByNotification = new Map();
  for (const notif of notifications) {
    statsByNotification.set(notif.id, {
      totalDevices: (subscriptionsByUser.get(notif.userId) || []).length,
      sent: 0,
      failed: 0,
      skipped: 0,
    });
  }

  let sent = 0;
  let failed = 0;
  let skippedCount = 0;

  for (const item of jobResults) {
    const entry = statsByNotification.get(item.notificationId);
    if (item.status === 'SENT') {
      sent += 1;
      entry.sent += 1;
    } else if (item.status === 'SKIPPED') {
      skippedCount += 1;
      entry.skipped += 1;
    } else {
      failed += 1;
      entry.failed += 1;
    }
  }

  if (typeof dbClient.notification?.update === 'function') {
    await runInChunks(notifications, DISPATCH_CONCURRENCY, async (notif) => {
      const entry = statsByNotification.get(notif.id);
      const pushStatus = resolveNotificationPushStatus(entry);
      await dbClient.notification.update({
        where: { id: notif.id },
        data: {
          pushStatus,
          pushSentCount: entry.sent,
          pushFailedCount: entry.failed,
        },
      }).catch(() => {});
    });
  }

  return {
    recipientCount: targetUserIds.length,
    notificationIds: notifications.map((n) => n.id),
    attempted: deliveryJobs.length,
    sent,
    failed,
    skippedCount,
    results: jobResults,
  };
};

// ==========================================
// Domain Event Triggers (Non-blocking helpers)
// ==========================================

const getApprovedMemberIds = async (dbClient = prisma) => {
  if (!hasPushTables(dbClient)) return [];
  const users = await dbClient.user.findMany({
    where: { membershipStatus: 'APPROVED' },
    select: { id: true },
  });
  return users.map((u) => u.id);
};

const getSessionJoinedUserIds = async (sessionId, dbClient = prisma) => {
  if (!dbClient?.vote?.findMany) return [];
  const votes = await dbClient.vote.findMany({
    where: { sessionId, status: 'JOIN' },
    select: { userId: true },
  });
  return votes.map((v) => v.userId);
};

const notifySessionCreated = async (session, actorUserId = null, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !session) return null;
  const userIds = await getApprovedMemberIds(dbClient);
  const dateLabel = formatDateShort(session.playDate);
  const timeLabel = `${session.startTime}-${session.endTime}`;

  return dispatchNotificationToUsers({
    userIds,
    excludeUserId: actorUserId,
    type: 'SESSION_CREATED',
    title: '⚽ Có kèo đá bóng mới!',
    body: `${session.title}${dateLabel ? ` • ${dateLabel}` : ''} (${timeLabel}) tại ${session.location}. Vào bình chọn ngay!`,
    url: `/sessions/${session.id}`,
    data: { sessionId: session.id },
  }, dbClient);
};

const notifySessionConfirmed = async (session, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !session) return null;
  const joinedIds = await getSessionJoinedUserIds(session.id, dbClient);
  const admins = await dbClient.user.findMany({
    where: { role: 'ADMIN', membershipStatus: 'APPROVED' },
    select: { id: true },
  });
  const userIds = [...joinedIds, ...admins.map((a) => a.id), session.createdById].filter(Boolean);

  return dispatchNotificationToUsers({
    userIds,
    type: 'SESSION_CONFIRMED',
    title: '✅ Trận đấu đã đủ người!',
    body: `Trận "${session.title}" đã đạt tối thiểu ${session.minPlayers} người tham gia.`,
    url: `/sessions/${session.id}`,
    data: { sessionId: session.id },
  }, dbClient);
};

const notifySessionBooked = async (session, { paymentsCreated = [] } = {}, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !session) return null;

  const dateLabel = formatDateShort(session.playDate);
  const timeLabel = `${session.startTime}-${session.endTime}`;
  const paymentByUser = new Map();
  for (const p of paymentsCreated) {
    if (p?.userId) paymentByUser.set(p.userId, p.amount);
  }

  const joinedIds = await getSessionJoinedUserIds(session.id, dbClient);
  const payerIds = session.payerId ? [session.payerId] : [];
  const allRecipients = [...new Set([...joinedIds, ...payerIds, ...paymentByUser.keys()])];

  // Nhóm thành viên có khoản tiền sân: gửi kèm số tiền để tránh gửi 2 thông báo trùng
  const usersWithoutPayment = allRecipients.filter((id) => !paymentByUser.has(id));
  const results = [];

  if (usersWithoutPayment.length > 0) {
    results.push(await dispatchNotificationToUsers({
      userIds: usersWithoutPayment,
      type: 'SESSION_BOOKED',
      title: '🏟️ Đã chốt sân thi đấu!',
      body: `${session.title}${dateLabel ? ` • ${dateLabel}` : ''} lúc ${timeLabel} tại ${session.location}.`,
      url: `/sessions/${session.id}`,
      data: { sessionId: session.id },
    }, dbClient));
  }

  // Nhóm người có cùng mức tiền sân -> gom theo số tiền
  const usersByAmount = new Map();
  for (const [userId, amount] of paymentByUser.entries()) {
    const key = String(amount);
    if (!usersByAmount.has(key)) usersByAmount.set(key, []);
    usersByAmount.get(key).push(userId);
  }

  for (const [amount, userIds] of usersByAmount.entries()) {
    results.push(await dispatchNotificationToUsers({
      userIds,
      type: 'SESSION_BOOKED',
      title: '🏟️ Đã chốt sân & chia tiền!',
      body: `${session.title} (${timeLabel}) tại ${session.location}. Tiền sân dự kiến: ${formatCurrencyVnd(amount)}/người.`,
      url: `/sessions/${session.id}`,
      data: { sessionId: session.id, amount: Number(amount) },
    }, dbClient));
  }

  return results;
};

const notifySessionCancelled = async (session, actorUserId = null, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !session) return null;
  const userIds = await getApprovedMemberIds(dbClient);
  const reasonText = session.cancellationNote ? ` Lý do: ${session.cancellationNote}` : '';

  return dispatchNotificationToUsers({
    userIds,
    excludeUserId: actorUserId,
    type: 'SESSION_CANCELLED',
    title: '❌ Trận đấu đã bị hủy',
    body: `"${session.title}" đã bị hủy.${reasonText}`,
    url: `/sessions/${session.id}`,
    data: { sessionId: session.id },
  }, dbClient);
};

const notifyTeamsPublished = async (session, actorUserId = null, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !session) return null;
  const userIds = await getSessionJoinedUserIds(session.id, dbClient);

  return dispatchNotificationToUsers({
    userIds,
    excludeUserId: actorUserId,
    type: 'TEAMS_PUBLISHED',
    title: '👕 Đã có danh sách chia đội!',
    body: `Đội hình trận "${session.title}" đã được cập nhật. Vào app xem đội của bạn nhé!`,
    url: `/sessions/${session.id}`,
    data: { sessionId: session.id },
  }, dbClient);
};

const notifyVoteLocked = async (session, isVoteLocked, actorUserId = null, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !session) return null;
  const userIds = await getApprovedMemberIds(dbClient);

  return dispatchNotificationToUsers({
    userIds,
    excludeUserId: actorUserId,
    type: isVoteLocked ? 'VOTE_LOCKED' : 'VOTE_UNLOCKED',
    title: isVoteLocked ? '🔒 Đã chốt danh sách bình chọn' : '🔓 Đã mở lại bình chọn',
    body: isVoteLocked
      ? `Admin đã chốt danh sách tham gia trận "${session.title}".`
      : `Admin đã mở lại bình chọn cho trận "${session.title}".`,
    url: `/sessions/${session.id}`,
    data: { sessionId: session.id, isVoteLocked },
  }, dbClient);
};

const notifyPaymentMarkedPaid = async ({ payment, payerId, senderName, sessionTitle }, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !payment || !payerId || payerId === payment.userId) return null;

  return dispatchNotificationToUsers({
    userIds: [payerId],
    type: 'PAYMENT_MARKED_PAID',
    title: '💰 Có thành viên báo đã chuyển tiền',
    body: `${senderName || 'Một thành viên'} đã đánh dấu thanh toán ${formatCurrencyVnd(payment.amount)} cho trận "${sessionTitle || 'đá bóng'}".`,
    url: `/sessions/${payment.sessionId}`,
    data: { sessionId: payment.sessionId, paymentId: payment.id },
  }, dbClient);
};

const notifyPaymentConfirmed = async ({ payment, sessionTitle }, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !payment?.userId) return null;

  return dispatchNotificationToUsers({
    userIds: [payment.userId],
    type: 'PAYMENT_CONFIRMED',
    title: '✅ Đã xác nhận tiền sân',
    body: `Khoản thanh toán ${formatCurrencyVnd(payment.amount)} cho trận "${sessionTitle || 'đá bóng'}" đã được xác nhận.`,
    url: `/sessions/${payment.sessionId}`,
    data: { sessionId: payment.sessionId, paymentId: payment.id },
  }, dbClient);
};

const notifyPaymentsRecalculated = async ({ session, payments }, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !session || !Array.isArray(payments) || payments.length === 0) return null;
  const pendingPayments = payments.filter((p) => p.status !== 'CONFIRMED' && p.userId !== session.payerId);
  if (pendingPayments.length === 0) return null;

  const amount = pendingPayments[0].amount;
  return dispatchNotificationToUsers({
    userIds: pendingPayments.map((p) => p.userId),
    type: 'PAYMENT_RECALCULATED',
    title: '💸 Cập nhật tiền sân thực tế',
    body: `Tiền sân trận "${session.title}" sau điểm danh là ${formatCurrencyVnd(amount)}/người.`,
    url: `/sessions/${session.id}`,
    data: { sessionId: session.id, amount: Number(amount) },
  }, dbClient);
};

const notifyAdminsNewMembershipRequest = async (applicant, dbClient = prisma) => {
  if (!hasPushTables(dbClient) || !applicant) return null;
  const admins = await dbClient.user.findMany({
    where: { role: 'ADMIN', membershipStatus: 'APPROVED' },
    select: { id: true },
  });
  if (admins.length === 0) return null;

  return dispatchNotificationToUsers({
    userIds: admins.map((a) => a.id),
    type: 'MEMBERSHIP_REQUEST',
    title: '🙋 Có đơn gia nhập CLB mới',
    body: `${applicant.displayName} (@${applicant.username}) vừa đăng ký và đang chờ duyệt.`,
    url: '/members',
    data: { applicantId: applicant.id },
  }, dbClient);
};

module.exports = {
  computeSubscriptionKey,
  normalizeSubscriptionInput,
  sanitizeSubscriptionSummary,
  registerSubscription,
  unregisterSubscription,
  dispatchNotificationToUsers,
  notifySessionCreated,
  notifySessionConfirmed,
  notifySessionBooked,
  notifySessionCancelled,
  notifyTeamsPublished,
  notifyVoteLocked,
  notifyPaymentMarkedPaid,
  notifyPaymentConfirmed,
  notifyPaymentsRecalculated,
  notifyAdminsNewMembershipRequest,
};
