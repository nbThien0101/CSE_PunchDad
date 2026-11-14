const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const pushService = require('../src/services/push.service');
const notificationService = require('../src/services/notification.service');
const notificationController = require('../src/controllers/notification.controller');
const notificationRoutes = require('../src/routes/notification.routes');

const invoke = async (handler, req, ...extraArgs) => {
  const result = { status: 200, payload: null, nextError: null };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(data) {
      result.payload = data;
      return this;
    },
  };
  await handler(req, res, (err) => {
    result.nextError = err || null;
  }, ...extraArgs);
  if (result.nextError) throw result.nextError;
  return result;
};

// ==========================================
// 1. Push Transport Service Tests
// ==========================================

test('push.service: getVapidConfig normalizes subject and rejects placeholders', () => {
  const unconfigured = pushService.getVapidConfig({});
  assert.equal(unconfigured.enabled, false);
  assert.equal(unconfigured.publicKey, null);

  const placeholder = pushService.getVapidConfig({
    VAPID_PUBLIC_KEY: 'your-vapid-public-key-placeholder-1234567890',
    VAPID_PRIVATE_KEY: 'your-vapid-private-key-placeholder-1234567890',
  });
  assert.equal(placeholder.enabled, false);

  const valid = pushService.getVapidConfig({
    VAPID_PUBLIC_KEY: '"BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8"',
    VAPID_PRIVATE_KEY: '"abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH"',
    VAPID_SUBJECT: 'club@hitdad.vn',
  });
  assert.equal(valid.enabled, true);
  assert.equal(valid.subject, 'mailto:club@hitdad.vn');
});

test('push.service: getFirebaseCredentialConfig supports raw JSON, base64 JSON, and separate vars', () => {
  const sa = {
    project_id: 'hitdad-test',
    client_email: 'firebase@hitdad-test.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n',
  };

  const fromRaw = pushService.getFirebaseCredentialConfig({
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(sa),
  });
  assert.equal(fromRaw.projectId, 'hitdad-test');
  assert.equal(fromRaw.clientEmail, sa.client_email);
  assert.ok(fromRaw.privateKey.includes('\nABC\n'));

  const fromBase64 = pushService.getFirebaseCredentialConfig({
    FIREBASE_SERVICE_ACCOUNT_JSON: Buffer.from(JSON.stringify(sa)).toString('base64'),
  });
  assert.equal(fromBase64.projectId, 'hitdad-test');

  const fromVars = pushService.getFirebaseCredentialConfig({
    FIREBASE_PROJECT_ID: 'hitdad-vars',
    FIREBASE_CLIENT_EMAIL: 'sa@hitdad-vars.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'line1\\nline2',
  });
  assert.equal(fromVars.projectId, 'hitdad-vars');
  assert.equal(fromVars.privateKey, 'line1\nline2');
});

test('push.service: buildPushPayload enforces limits and preserves deep-link metadata', () => {
  const payload = pushService.buildPushPayload({
    notificationId: 'notif-1',
    type: 'SESSION_BOOKED',
    title: 'A'.repeat(200),
    body: 'B'.repeat(700),
    url: '/sessions/s-1',
    data: { sessionId: 's-1', ignored: undefined },
  });

  assert.equal(payload.title.length, 120);
  assert.ok(payload.title.endsWith('…'));
  assert.equal(payload.body.length, 500);
  assert.equal(payload.url, '/sessions/s-1');
  assert.equal(payload.data.sessionId, 's-1');
  assert.equal(payload.data.notificationId, 'notif-1');
  assert.equal(Object.hasOwn(payload.data, 'ignored'), false);
});

test('push.service: real web-push VAPID key generation and encryption request formatting works', async () => {
  const mod = await import('web-push');
  const webPush = mod.default || mod;
  const keys = webPush.generateVAPIDKeys();
  const clientEcdh = crypto.createECDH('prime256v1');
  clientEcdh.generateKeys();

  const details = webPush.generateRequestDetails(
    {
      endpoint: 'https://web.push.apple.com/QTestEndpointForIosPwa',
      keys: {
        p256dh: clientEcdh.getPublicKey().toString('base64url'),
        auth: crypto.randomBytes(16).toString('base64url'),
      },
    },
    JSON.stringify({ title: 'Test iOS PWA', body: 'Hello from HitDad' }),
    {
      vapidDetails: {
        subject: 'mailto:csepunchdad@gmail.com',
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      },
      TTL: 86400,
      urgency: 'high',
    }
  );

  assert.equal(details.method, 'POST');
  assert.ok(details.headers.Authorization.startsWith('vapid '));
  assert.ok(details.body.length > 0);
});

test('push.service: sendWebPush handles SKIPPED, SENT, and 410 Gone deactivation', async () => {
  const skipped = await pushService.sendWebPush(
    { endpoint: 'https://web.push.apple.com/123', p256dh: 'a'.repeat(32), auth: 'b'.repeat(20) },
    { title: 'Hi', body: 'Test' },
    { env: {} }
  );
  assert.equal(skipped.status, 'SKIPPED');

  const envWithVapid = {
    VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8',
    VAPID_PRIVATE_KEY: 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH',
    VAPID_SUBJECT: 'mailto:test@hitdad.vn',
  };

  let capturedOptions;
  const sent = await pushService.sendWebPush(
    { endpoint: 'https://web.push.apple.com/123', p256dh: 'a'.repeat(32), auth: 'b'.repeat(20) },
    { title: 'Hi', body: 'Test' },
    {
      env: envWithVapid,
      webPush: {
        async sendNotification(sub, data, options) {
          capturedOptions = { sub, data, options };
          return { statusCode: 201 };
        },
      },
    }
  );
  assert.equal(sent.ok, true);
  assert.equal(sent.status, 'SENT');
  assert.equal(capturedOptions.options.urgency, 'high');
  assert.equal(capturedOptions.options.vapidDetails.subject, 'mailto:test@hitdad.vn');

  const gone = await pushService.sendWebPush(
    { endpoint: 'https://web.push.apple.com/123', p256dh: 'a'.repeat(32), auth: 'b'.repeat(20) },
    { title: 'Hi', body: 'Test' },
    {
      env: envWithVapid,
      webPush: {
        async sendNotification() {
          const err = new Error('Gone');
          err.statusCode = 410;
          throw err;
        },
      },
    }
  );
  assert.equal(gone.ok, false);
  assert.equal(gone.permanent, true);
});

test('push.service: sendFcmPush stringifies data and flags unregistered tokens', async () => {
  let sentMessage;
  const ok = await pushService.sendFcmPush(
    { deviceToken: 'fcm-token-1234567890' },
    {
      title: 'Match',
      body: 'Booked',
      data: { sessionId: 's-1', amount: 50000 },
    },
    {
      fcmMessaging: {
        async send(msg) {
          sentMessage = msg;
          return 'projects/demo/messages/1';
        },
      },
    }
  );
  assert.equal(ok.ok, true);
  assert.equal(sentMessage.data.amount, '50000');
  assert.equal(sentMessage.android.priority, 'high');

  const dead = await pushService.sendFcmPush(
    { deviceToken: 'dead-token-1234567890' },
    { title: 'Match', body: 'Booked', data: {} },
    {
      fcmMessaging: {
        async send() {
          const err = new Error('Not registered');
          err.code = 'messaging/registration-token-not-registered';
          throw err;
        },
      },
    }
  );
  assert.equal(dead.ok, false);
  assert.equal(dead.permanent, true);
});

test('push.service: sendExpoPush handles ok ticket and DeviceNotRegistered', async () => {
  const ok = await pushService.sendExpoPush(
    { deviceToken: 'ExponentPushToken[abc123]' },
    { title: 'Test', body: 'Body', data: { url: '/' } },
    {
      fetch: async () => ({
        ok: true,
        async json() {
          return { data: { status: 'ok', id: 'ticket-1' } };
        },
      }),
    }
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.ticketId, 'ticket-1');

  const unregistered = await pushService.sendExpoPush(
    { deviceToken: 'ExponentPushToken[dead]' },
    { title: 'Test', body: 'Body', data: {} },
    {
      fetch: async () => ({
        ok: true,
        async json() {
          return {
            data: {
              status: 'error',
              message: 'Device not registered',
              details: { error: 'DeviceNotRegistered' },
            },
          };
        },
      }),
    }
  );
  assert.equal(unregistered.ok, false);
  assert.equal(unregistered.permanent, true);
});

// ==========================================
// 2. Notification Orchestration & Subscription Tests
// ==========================================

test('notification.service: normalizeSubscriptionInput infers iOS PWA Web Push, FCM, and Expo accurately', () => {
  const iosPwa = notificationService.normalizeSubscriptionInput(
    {
      subscription: {
        endpoint: 'https://web.push.apple.com/Q123',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7Dk',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      },
      deviceName: 'iPhone 15',
    },
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  );
  assert.equal(iosPwa.error, undefined);
  assert.equal(iosPwa.data.channel, 'WEB_PUSH');
  assert.equal(iosPwa.data.platform, 'IOS_PWA');

  const httpRejected = notificationService.normalizeSubscriptionInput({
    subscription: {
      endpoint: 'http://localhost:8080/push',
      keys: { p256dh: 'a'.repeat(32), auth: 'b'.repeat(20) },
    },
  });
  assert.ok(httpRejected.error);

  const fcm = notificationService.normalizeSubscriptionInput({
    token: 'dQw4w9WgXcQ:APA91bFcmTokenSample123456',
    deviceName: 'Pixel 8 APK',
  });
  assert.equal(fcm.data.channel, 'FCM');
  assert.equal(fcm.data.platform, 'ANDROID_APK');

  const expo = notificationService.normalizeSubscriptionInput({
    token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  });
  assert.equal(expo.data.channel, 'EXPO');
  assert.equal(expo.data.platform, 'ANDROID_APK');

  const invalidExpo = notificationService.normalizeSubscriptionInput({
    channel: 'EXPO',
    token: 'not-an-expo-token',
  });
  assert.ok(invalidExpo.error);
});

test('notification.service: registerSubscription reassigns device ownership cleanly and masks sensitive keys', async () => {
  const store = new Map();
  const mockDb = {
    pushSubscription: {
      async upsert({ where, create, update }) {
        const existing = store.get(where.subscriptionKey);
        const record = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { id: 'sub-1', ...create, createdAt: new Date(), updatedAt: new Date() };
        store.set(where.subscriptionKey, record);
        return record;
      },
    },
  };

  const first = await notificationService.registerSubscription({
    userId: 'user-A',
    userAgent: 'iPhone Safari',
    body: {
      subscription: {
        endpoint: 'https://web.push.apple.com/device-xyz',
        keys: { p256dh: 'p256dhKeyValue123456', auth: 'authSecret12345678' },
      },
    },
  }, mockDb);

  assert.equal(first.subscription.endpointOrigin, 'https://web.push.apple.com');
  assert.equal(Object.hasOwn(first.subscription, 'p256dh'), false);
  assert.equal(Object.hasOwn(first.subscription, 'auth'), false);

  const second = await notificationService.registerSubscription({
    userId: 'user-B',
    userAgent: 'iPhone Safari',
    body: {
      subscription: {
        endpoint: 'https://web.push.apple.com/device-xyz',
        keys: { p256dh: 'p256dhKeyValue123456', auth: 'authSecret12345678' },
      },
    },
  }, mockDb);

  assert.equal(store.size, 1);
  assert.equal([...store.values()][0].userId, 'user-B');
  assert.equal(second.subscription.isActive, true);
});

test('notification.service: dispatchNotificationToUsers creates notifications and deactivates dead devices', async () => {
  const notifications = [];
  const subscriptions = [
    {
      id: 'sub-ok',
      userId: 'u1',
      channel: 'WEB_PUSH',
      platform: 'IOS_PWA',
      endpoint: 'https://web.push.apple.com/ok',
      p256dh: 'a'.repeat(32),
      auth: 'b'.repeat(20),
      deviceName: 'iPhone 15',
      isActive: true,
      failureCount: 2,
    },
    {
      id: 'sub-dead',
      userId: 'u1',
      channel: 'FCM',
      platform: 'ANDROID_APK',
      deviceToken: 'dead-fcm-token',
      deviceName: 'Old Android',
      isActive: true,
      failureCount: 0,
    },
  ];

  const mockDb = {
    user: { async findMany() { return []; } },
    notification: {
      async createMany({ data }) {
        notifications.push(...data);
      },
      async update({ where, data }) {
        const target = notifications.find((n) => n.id === where.id);
        Object.assign(target, data);
        return target;
      },
    },
    pushSubscription: {
      async findMany() {
        return subscriptions.filter((s) => s.isActive);
      },
      async update({ where, data }) {
        const sub = subscriptions.find((s) => s.id === where.id);
        Object.assign(sub, data);
        return sub;
      },
    },
  };

  const mockTransport = {
    buildPushPayload: pushService.buildPushPayload,
    async sendToSubscription(sub) {
      if (sub.id === 'sub-ok') return { ok: true, status: 'SENT', permanent: false, statusCode: 201 };
      return { ok: false, status: 'FAILED', permanent: true, error: 'messaging/registration-token-not-registered' };
    },
  };

  const report = await notificationService.dispatchNotificationToUsers(
    {
      userIds: ['u1', 'u1', 'u2'],
      excludeUserId: 'u2',
      type: 'SESSION_CREATED',
      title: 'Kèo mới',
      body: 'Thứ 5 đá nhé',
      url: '/sessions/1',
    },
    mockDb,
    mockTransport
  );

  assert.equal(report.recipientCount, 1);
  assert.equal(report.attempted, 2);
  assert.equal(report.sent, 1);
  assert.equal(report.failed, 1);
  assert.equal(notifications[0].pushStatus, 'PARTIAL');
  assert.equal(subscriptions[0].failureCount, 0);
  assert.equal(subscriptions[0].isActive, true);
  assert.equal(subscriptions[1].isActive, false);
});

test('notification.service: notifySessionBooked merges payment amount without duplicate notifications per user', async () => {
  const createdNotifications = [];
  const mockDb = {
    user: { async findMany() { return []; } },
    vote: {
      async findMany() {
        return [{ userId: 'player-1' }, { userId: 'player-2' }, { userId: 'payer-1' }];
      },
    },
    notification: {
      async createMany({ data }) { createdNotifications.push(...data); },
      async update() {},
    },
    pushSubscription: { async findMany() { return []; } },
  };

  await notificationService.notifySessionBooked(
    {
      id: 'session-1',
      title: 'Giao hữu thứ 7',
      playDate: new Date('2026-11-21T00:00:00.000Z'),
      startTime: '18:00',
      endTime: '19:30',
      location: 'Sân Chảo Lửa',
      payerId: 'payer-1',
    },
    {
      paymentsCreated: [
        { userId: 'player-1', amount: 50000 },
        { userId: 'player-2', amount: 50000 },
      ],
    },
    mockDb
  );

  assert.equal(createdNotifications.length, 3);
  const byUser = Object.fromEntries(createdNotifications.map((n) => [n.userId, n]));
  assert.ok(byUser['player-1'].body.includes('50.000đ'));
  assert.ok(byUser['player-2'].body.includes('50.000đ'));
  assert.ok(!byUser['payer-1'].body.includes('50.000đ'));
});

// ==========================================
// 3. Controller & Route Security Tests
// ==========================================

test('notification.controller: test push targets only req.user.id and validates subscription ownership', async () => {
  const mockDb = {
    user: { async findMany() { return []; } },
    pushSubscription: {
      async findFirst({ where }) {
        return where.userId === 'user-1' && where.id === 'sub-1'
          ? { id: 'sub-1', userId: 'user-1', isActive: true }
          : null;
      },
      async findMany() {
        return [{ id: 'sub-1', userId: 'user-1', channel: 'EXPO', platform: 'ANDROID_APK', deviceToken: 'ExponentPushToken[ok]', isActive: true }];
      },
      async update() {},
    },
    notification: {
      async createMany() {},
      async update() {},
    },
  };

  const foreignSub = await invoke(
    notificationController.sendTestNotification,
    { user: { id: 'user-1' }, body: { subscriptionId: 'sub-of-user-2' } },
    mockDb,
    pushService
  );
  assert.equal(foreignSub.status, 404);

  const ok = await invoke(
    notificationController.sendTestNotification,
    { user: { id: 'user-1' }, body: { subscriptionId: 'sub-1', title: 'Ping' } },
    mockDb,
    {
      buildPushPayload: pushService.buildPushPayload,
      async sendToSubscription() {
        return { ok: true, status: 'SENT', permanent: false };
      },
    }
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.payload.summary.sent, 1);
  assert.equal(ok.payload.summary.attempted, 1);
});

test('notification.controller: sendAdminNotification resolves SESSION_UNPAID and handles missing session', async () => {
  const created = [];
  const mockDb = {
    user: { async findMany() { return []; } },
    session: {
      async findUnique({ where }) {
        return where.id === 's-1' ? { id: 's-1' } : null;
      },
    },
    payment: {
      async findMany() {
        return [{ userId: 'debtor-1' }, { userId: 'debtor-2' }];
      },
    },
    pushSubscription: { async findMany() { return []; } },
    notification: {
      async createMany({ data }) { created.push(...data); },
      async update() {},
    },
  };

  const missing = await invoke(
    notificationController.sendAdminNotification,
    { user: { id: 'admin-1' }, body: { title: 'Nhắc', body: 'Đóng tiền', target: 'SESSION_UNPAID', sessionId: 'not-found' } },
    mockDb,
    pushService
  );
  assert.equal(missing.status, 404);

  const ok = await invoke(
    notificationController.sendAdminNotification,
    { user: { id: 'admin-1' }, body: { title: 'Nhắc tiền sân', body: 'Vui lòng CK', target: 'SESSION_UNPAID', sessionId: 's-1' } },
    mockDb,
    pushService
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.payload.recipientCount, 2);
  assert.deepEqual(created.map((n) => n.userId), ['debtor-1', 'debtor-2']);
});

test('notification.controller: inbox markAsRead and delete enforce user ownership', async () => {
  const rows = [
    { id: 'n-1', userId: 'u-1', isRead: false, readAt: null },
    { id: 'n-2', userId: 'u-2', isRead: false, readAt: null },
  ];
  const mockDb = {
    notification: {
      async findFirst({ where }) {
        return rows.find((r) => r.id === where.id && r.userId === where.userId) || null;
      },
      async update({ where, data }) {
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
      async deleteMany({ where }) {
        const idx = rows.findIndex((r) => r.id === where.id && r.userId === where.userId);
        if (idx === -1) return { count: 0 };
        rows.splice(idx, 1);
        return { count: 1 };
      },
    },
  };

  const foreignRead = await invoke(
    notificationController.markAsRead,
    { user: { id: 'u-1' }, params: { id: 'n-2' } },
    mockDb
  );
  assert.equal(foreignRead.status, 404);

  const ownRead = await invoke(
    notificationController.markAsRead,
    { user: { id: 'u-1' }, params: { id: 'n-1' } },
    mockDb
  );
  assert.equal(ownRead.status, 200);
  assert.equal(ownRead.payload.notification.isRead, true);

  const foreignDelete = await invoke(
    notificationController.deleteNotification,
    { user: { id: 'u-1' }, params: { id: 'n-2' } },
    mockDb
  );
  assert.equal(foreignDelete.status, 404);
  assert.equal(rows.length, 2);
});

test('notification.routes: static routes precede :id param routes and requireAdmin protects /send', () => {
  const routeLayers = notificationRoutes.stack
    .filter((l) => l.route)
    .map((l) => ({
      path: l.route.path,
      methods: Object.keys(l.route.methods),
      middlewareNames: l.route.stack.map((s) => s.name),
    }));

  const paths = routeLayers.map((r) => `${r.methods[0].toUpperCase()} ${r.path}`);
  assert.ok(paths.indexOf('DELETE /subscriptions') < paths.indexOf('DELETE /:id'));
  assert.ok(paths.indexOf('PUT /read-all') < paths.indexOf('PUT /:id/read'));

  const sendLayer = routeLayers.find((r) => r.path === '/send' && r.methods.includes('post'));
  assert.ok(sendLayer.middlewareNames.includes('requireAdmin'));
});
