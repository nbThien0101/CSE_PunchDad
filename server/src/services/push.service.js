const fs = require('node:fs');

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const FIREBASE_APP_NAME = 'cse-hitdad-push';
const DEFAULT_PUSH_TIMEOUT_MS = 10000;
const PERMANENT_FCM_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

let cachedWebPushModule = null;

const stripQuotes = (value) => String(value || '').replace(/^["']|["']$/g, '').trim();

const truncateText = (value, maxLength) => {
  const str = String(value || '').trim();
  if (str.length <= maxLength) return str;
  return `${str.slice(0, Math.max(0, maxLength - 1))}…`;
};

const isPlaceholderValue = (value) => (
  !value || /your[-_ ]|change[-_ ]?this|example/i.test(value)
);

/**
 * Đọc cấu hình VAPID cho Web Push (iOS PWA & Web Browser).
 */
const getVapidConfig = (env = process.env) => {
  const publicKey = stripQuotes(env.VAPID_PUBLIC_KEY);
  const privateKey = stripQuotes(env.VAPID_PRIVATE_KEY);
  const smtpEmail = stripQuotes(env.SMTP_EMAIL);

  let subject = stripQuotes(env.VAPID_SUBJECT);
  if (!subject) {
    subject = smtpEmail ? `mailto:${smtpEmail}` : 'https://cse-punchdad-api.onrender.com';
  } else if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    subject = `mailto:${subject}`;
  }

  const enabled = !isPlaceholderValue(publicKey)
    && !isPlaceholderValue(privateKey)
    && publicKey.length >= 32
    && privateKey.length >= 32;

  return {
    enabled,
    publicKey: enabled ? publicKey : null,
    privateKey: enabled ? privateKey : null,
    subject,
  };
};

/**
 * Đọc cấu hình Firebase Service Account cho FCM (Android APK).
 * Hỗ trợ 3 dạng: FIREBASE_SERVICE_ACCOUNT_JSON (raw hoặc base64),
 * cặp biến FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY,
 * hoặc đường dẫn file FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS.
 */
const getFirebaseCredentialConfig = (env = process.env) => {
  const rawJson = stripQuotes(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (rawJson && !isPlaceholderValue(rawJson)) {
    try {
      const jsonText = rawJson.startsWith('{')
        ? rawJson
        : Buffer.from(rawJson, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonText);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
        };
      }
    } catch (error) {
      console.error('❌ Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', error.message);
    }
  }

  const projectId = stripQuotes(env.FIREBASE_PROJECT_ID);
  const clientEmail = stripQuotes(env.FIREBASE_CLIENT_EMAIL);
  const privateKey = stripQuotes(env.FIREBASE_PRIVATE_KEY);
  if (!isPlaceholderValue(projectId) && !isPlaceholderValue(clientEmail) && !isPlaceholderValue(privateKey)) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  }

  const filePath = stripQuotes(env.FIREBASE_SERVICE_ACCOUNT_PATH || env.GOOGLE_APPLICATION_CREDENTIALS);
  if (filePath && fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
        };
      }
    } catch (error) {
      console.error('❌ Invalid Firebase credential file:', error.message);
    }
  }

  return null;
};

/**
 * Báo cáo các kênh push notification hiện khả dụng trên server.
 */
const getPushCapabilities = (env = process.env) => {
  const vapid = getVapidConfig(env);
  const fcmEnabled = Boolean(getFirebaseCredentialConfig(env));

  return {
    webPushEnabled: vapid.enabled,
    vapidPublicKey: vapid.publicKey,
    fcmEnabled,
    expoEnabled: true,
    supportedChannels: ['WEB_PUSH', 'FCM', 'EXPO'],
  };
};

/**
 * Chuẩn hóa payload gửi xuống thiết bị để giữ kích thước dưới ngưỡng 4KB của Web Push / APNs.
 */
const buildPushPayload = ({ notificationId, type = 'GENERAL', title, body, url = '/', data = {} }) => {
  const safeData = {};
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        safeData[key] = value;
      }
    }
  }

  const targetUrl = typeof url === 'string' && url.trim()
    ? url.trim()
    : (typeof safeData.url === 'string' && safeData.url.trim() ? safeData.url.trim() : '/');

  return {
    notificationId: notificationId || null,
    type: String(type || 'GENERAL'),
    title: truncateText(title || 'CSE HitDad', 120),
    body: truncateText(body || '', 500),
    url: targetUrl,
    data: {
      ...safeData,
      type: String(type || 'GENERAL'),
      url: targetUrl,
      ...(notificationId ? { notificationId } : {}),
    },
    timestamp: new Date().toISOString(),
  };
};

const loadWebPush = async () => {
  if (!cachedWebPushModule) {
    const imported = await import('web-push');
    cachedWebPushModule = imported.default || imported;
  }
  return cachedWebPushModule;
};

const getFirebaseMessaging = (env = process.env) => {
  const credentialConfig = getFirebaseCredentialConfig(env);
  if (!credentialConfig) return null;

  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  const { getMessaging } = require('firebase-admin/messaging');

  let app = getApps().find((item) => item.name === FIREBASE_APP_NAME);
  if (!app) {
    app = initializeApp({ credential: cert(credentialConfig) }, FIREBASE_APP_NAME);
  }
  return getMessaging(app);
};

const toFcmStringData = (payload) => {
  const result = {};
  const entries = Object.entries(payload.data || {});
  for (const [key, value] of entries) {
    if (value === undefined || value === null) continue;
    result[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return result;
};

/**
 * Gửi thông báo qua Web Push API + VAPID (dành cho iOS Safari PWA & Web).
 */
const sendWebPush = async (subscription, payload, deps = {}) => {
  const env = deps.env || process.env;
  const vapid = getVapidConfig(env);
  if (!vapid.enabled) {
    return {
      ok: false,
      status: 'SKIPPED',
      permanent: false,
      error: 'VAPID_NOT_CONFIGURED',
    };
  }

  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return {
      ok: false,
      status: 'FAILED',
      permanent: true,
      error: 'Incomplete Web Push subscription keys',
    };
  }

  try {
    const webPush = deps.webPush || await loadWebPush();
    const response = await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: vapid.subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
        TTL: 86400,
        urgency: 'high',
        timeout: DEFAULT_PUSH_TIMEOUT_MS,
      }
    );

    return {
      ok: true,
      status: 'SENT',
      permanent: false,
      statusCode: response?.statusCode || 201,
    };
  } catch (error) {
    const statusCode = error?.statusCode || null;
    const permanent = statusCode === 404 || statusCode === 410;
    return {
      ok: false,
      status: 'FAILED',
      permanent,
      statusCode,
      error: error?.body || error?.message || 'Web Push delivery failed',
    };
  }
};

/**
 * Gửi thông báo qua Firebase Cloud Messaging (dành cho Android APK native / React Native / Flutter / Capacitor).
 */
const sendFcmPush = async (subscription, payload, deps = {}) => {
  const env = deps.env || process.env;
  if (!subscription.deviceToken) {
    return {
      ok: false,
      status: 'FAILED',
      permanent: true,
      error: 'Missing FCM deviceToken',
    };
  }

  let messaging;
  try {
    messaging = deps.fcmMessaging || getFirebaseMessaging(env);
  } catch (error) {
    return {
      ok: false,
      status: 'FAILED',
      permanent: false,
      error: `Firebase init error: ${error.message}`,
    };
  }

  if (!messaging) {
    return {
      ok: false,
      status: 'SKIPPED',
      permanent: false,
      error: 'FCM_NOT_CONFIGURED',
    };
  }

  try {
    const messageId = await messaging.send({
      token: subscription.deviceToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: toFcmStringData(payload),
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    return {
      ok: true,
      status: 'SENT',
      permanent: false,
      messageId,
    };
  } catch (error) {
    const errorCode = error?.code || error?.errorInfo?.code || '';
    const permanent = PERMANENT_FCM_ERROR_CODES.has(errorCode);
    return {
      ok: false,
      status: 'FAILED',
      permanent,
      error: errorCode ? `${errorCode}: ${error.message}` : (error?.message || 'FCM delivery failed'),
    };
  }
};

/**
 * Gửi thông báo qua Expo Push API (dành cho Android APK dùng expo-notifications).
 */
const sendExpoPush = async (subscription, payload, deps = {}) => {
  const env = deps.env || process.env;
  const fetchFn = deps.fetch || fetch;
  if (!subscription.deviceToken) {
    return {
      ok: false,
      status: 'FAILED',
      permanent: true,
      error: 'Missing Expo push token',
    };
  }

  const headers = {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const expoAccessToken = stripQuotes(env.EXPO_ACCESS_TOKEN);
  if (expoAccessToken && !isPlaceholderValue(expoAccessToken)) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }

  try {
    const response = await fetchFn(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(DEFAULT_PUSH_TIMEOUT_MS),
      body: JSON.stringify({
        to: subscription.deviceToken,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: 'FAILED',
        permanent: false,
        statusCode: response.status,
        error: json?.errors?.[0]?.message || `Expo Push HTTP ${response.status}`,
      };
    }

    const ticket = Array.isArray(json.data) ? json.data[0] : json.data;
    if (ticket?.status === 'error') {
      const permanent = ticket?.details?.error === 'DeviceNotRegistered';
      return {
        ok: false,
        status: 'FAILED',
        permanent,
        error: ticket.message || ticket?.details?.error || 'Expo push ticket error',
      };
    }

    return {
      ok: true,
      status: 'SENT',
      permanent: false,
      ticketId: ticket?.id || null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'FAILED',
      permanent: false,
      error: error?.message || 'Expo Push request failed',
    };
  }
};

/**
 * Điều phối gửi push notification theo đúng kênh của thiết bị.
 */
const sendToSubscription = async (subscription, payload, deps = {}) => {
  switch (subscription.channel) {
    case 'WEB_PUSH':
      return sendWebPush(subscription, payload, deps);
    case 'FCM':
      return sendFcmPush(subscription, payload, deps);
    case 'EXPO':
      return sendExpoPush(subscription, payload, deps);
    default:
      return {
        ok: false,
        status: 'FAILED',
        permanent: true,
        error: `Unsupported push channel: ${subscription.channel}`,
      };
  }
};

module.exports = {
  getVapidConfig,
  getFirebaseCredentialConfig,
  getPushCapabilities,
  buildPushPayload,
  sendWebPush,
  sendFcmPush,
  sendExpoPush,
  sendToSubscription,
};
