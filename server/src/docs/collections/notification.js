/**
 * Notification Collection: Push Notification đa nền tảng (Android APK FCM/Expo + iOS PWA Web Push) & Hộp thư thông báo
 */
const {
  bearer, ref, jsonBody, jsonResponse, errorResponse, pathParam, messageSchema,
  commonAuthErrors, commonAdminErrors,
} = require('./helpers');

const CHANNELS = ['WEB_PUSH', 'FCM', 'EXPO'];
const PLATFORMS = ['IOS_PWA', 'ANDROID_APK', 'WEB', 'OTHER'];
const SEND_TARGETS = ['ALL', 'USERS', 'SESSION_JOINED', 'SESSION_UNPAID'];

module.exports = {
  tag: {
    name: 'Notification',
    description: 'Push notification đa nền tảng (Android APK qua FCM/Expo, iOS PWA qua Web Push VAPID) và hộp thư thông báo in-app',
  },
  schemas: {
    PushConfigResponse: {
      type: 'object',
      properties: {
        webPushEnabled: { type: 'boolean', example: true, description: 'true nếu server đã cấu hình VAPID keys cho iOS PWA / Web Push' },
        vapidPublicKey: { type: 'string', nullable: true, example: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8' },
        fcmEnabled: { type: 'boolean', example: true, description: 'true nếu server đã cấu hình Firebase Admin SDK cho Android APK' },
        expoEnabled: { type: 'boolean', example: true, description: 'Hỗ trợ Expo Push Token (ExponentPushToken[...])' },
        supportedChannels: { type: 'array', items: { type: 'string', enum: CHANNELS }, example: CHANNELS },
      },
    },
    PushSubscriptionSummary: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        channel: { type: 'string', enum: CHANNELS, example: 'WEB_PUSH' },
        platform: { type: 'string', enum: PLATFORMS, example: 'IOS_PWA' },
        deviceName: { type: 'string', nullable: true, example: 'iPhone 15 Safari PWA' },
        appVersion: { type: 'string', nullable: true, example: '1.0.0' },
        endpointOrigin: { type: 'string', nullable: true, example: 'https://web.push.apple.com' },
        tokenPreview: { type: 'string', nullable: true, example: '…abcd1234' },
        isActive: { type: 'boolean', example: true },
        failureCount: { type: 'integer', example: 0 },
        lastError: { type: 'string', nullable: true },
        lastSuccessAt: { type: 'string', format: 'date-time', nullable: true },
        lastUsedAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    RegisterPushSubscriptionBody: {
      type: 'object',
      description: 'Đăng ký thiết bị nhận push: truyền `subscription` (cho iOS PWA / Web Push) hoặc `token` (cho Android APK FCM / Expo).',
      properties: {
        channel: { type: 'string', enum: CHANNELS, example: 'WEB_PUSH', description: 'Tuỳ chọn, server tự suy luận nếu bỏ trống' },
        platform: { type: 'string', enum: PLATFORMS, example: 'IOS_PWA' },
        deviceName: { type: 'string', maxLength: 120, example: 'iPhone 15 Safari PWA' },
        appVersion: { type: 'string', maxLength: 40, example: '1.0.0' },
        token: { type: 'string', example: 'fcm_device_token_or_ExponentPushToken[...]', description: 'Dùng cho kênh FCM hoặc EXPO trên Android APK' },
        subscription: {
          type: 'object',
          description: 'Dữ liệu PushSubscription.toJSON() trả về từ browser/iOS PWA',
          properties: {
            endpoint: { type: 'string', format: 'uri', example: 'https://web.push.apple.com/Q1234567890' },
            keys: {
              type: 'object',
              properties: {
                p256dh: { type: 'string', example: 'BK_HYU6aHDsRCGpbhREzIIrYNchnvvfo0EHUa0WtY1tkJZeKpJawVKULk76ZSbz2G9Sudg3_y7cIsXqvo7iZgcQ' },
                auth: { type: 'string', example: '3G4tVWgTxzrrHdkFzgqhdA' },
              },
            },
          },
        },
      },
    },
    UnregisterPushSubscriptionBody: {
      type: 'object',
      description: 'Truyền ít nhất một trong các trường để hủy đăng ký thiết bị hiện tại khi logout.',
      properties: {
        subscriptionId: { type: 'string', format: 'uuid' },
        endpoint: { type: 'string', format: 'uri' },
        token: { type: 'string' },
        channel: { type: 'string', enum: CHANNELS },
      },
    },
    NotificationItem: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        type: { type: 'string', example: 'SESSION_BOOKED' },
        title: { type: 'string', example: '🏟️ Đã chốt sân thi đấu!' },
        body: { type: 'string', example: 'Đá bóng tối thứ 5 lúc 18:00-19:30 tại Sân bóng Chảo Lửa.' },
        data: { type: 'object', nullable: true, example: { sessionId: 's1234567-89ab-cdef-0123-456789abcdef', url: '/sessions/s123' } },
        isRead: { type: 'boolean', example: false },
        readAt: { type: 'string', format: 'date-time', nullable: true },
        pushStatus: { type: 'string', enum: ['PENDING', 'SENT', 'PARTIAL', 'FAILED', 'SKIPPED', 'NO_DEVICE'], example: 'SENT' },
        pushSentCount: { type: 'integer', example: 2 },
        pushFailedCount: { type: 'integer', example: 0 },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    TestPushBody: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 120, example: '🔔 Thử nghiệm thông báo CSE HitDad' },
        body: { type: 'string', maxLength: 500, example: 'Kiểm tra push notification trên Android APK / iOS PWA' },
        url: { type: 'string', example: '/sessions/123' },
        subscriptionId: { type: 'string', format: 'uuid', description: 'Tuỳ chọn: chỉ test một thiết bị cụ thể' },
        data: { type: 'object' },
      },
    },
    SendAdminNotificationBody: {
      type: 'object',
      required: ['title', 'body'],
      properties: {
        title: { type: 'string', minLength: 2, maxLength: 120, example: '📢 Nhắc đóng tiền sân' },
        body: { type: 'string', minLength: 2, maxLength: 1000, example: 'Anh em vui lòng chuyển khoản tiền sân trận tối thứ 5 nhé!' },
        target: { type: 'string', enum: SEND_TARGETS, default: 'ALL' },
        userIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Bắt buộc khi target = USERS' },
        sessionId: { type: 'string', format: 'uuid', description: 'Bắt buộc khi target = SESSION_JOINED hoặc SESSION_UNPAID' },
        type: { type: 'string', example: 'ANNOUNCEMENT' },
        url: { type: 'string', example: '/sessions/abc' },
        excludeSelf: { type: 'boolean', default: false },
        data: { type: 'object' },
      },
    },
  },
  paths: {
    '/api/notifications/config': {
      get: {
        tags: ['Notification'],
        summary: 'Lấy cấu hình Push & VAPID Public Key',
        description: 'Endpoint công khai trả về `vapidPublicKey` để iOS PWA gọi `pushManager.subscribe()` và trạng thái cấu hình của các kênh Web Push / FCM / Expo.',
        responses: {
          200: jsonResponse('Cấu hình push hiện tại của server', ref('PushConfigResponse')),
        },
      },
    },
    '/api/notifications/subscriptions': {
      get: {
        tags: ['Notification'],
        summary: 'Danh sách thiết bị đã đăng ký nhận push của tôi',
        security: bearer,
        responses: {
          200: jsonResponse('Danh sách thiết bị đăng ký push', {
            type: 'object',
            properties: {
              subscriptions: { type: 'array', items: ref('PushSubscriptionSummary') },
            },
          }),
          ...commonAuthErrors,
        },
      },
      post: {
        tags: ['Notification'],
        summary: 'Đăng ký hoặc làm mới thiết bị nhận Push Notification',
        description: 'Dùng chung cho cả Android APK (FCM / Expo token) và iOS PWA (Web Push `PushSubscription`). Tự động cập nhật chủ sở hữu nếu đổi tài khoản trên cùng thiết bị.',
        security: bearer,
        requestBody: jsonBody(ref('RegisterPushSubscriptionBody')),
        responses: {
          201: jsonResponse('Đăng ký thiết bị thành công', messageSchema('Đã đăng ký thiết bị nhận thông báo', {
            subscription: ref('PushSubscriptionSummary'),
          })),
          400: errorResponse('Thiếu hoặc sai định dạng subscription / token'),
          ...commonAuthErrors,
        },
      },
      delete: {
        tags: ['Notification'],
        summary: 'Hủy đăng ký thiết bị theo endpoint hoặc token',
        description: 'Mobile app / PWA gọi khi người dùng đăng xuất hoặc tắt thông báo (truyền qua JSON body hoặc query params).',
        security: bearer,
        parameters: [
          { name: 'subscriptionId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
          { name: 'endpoint', in: 'query', required: false, schema: { type: 'string', format: 'uri' } },
          { name: 'token', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'channel', in: 'query', required: false, schema: { type: 'string', enum: CHANNELS } },
        ],
        requestBody: jsonBody(ref('UnregisterPushSubscriptionBody'), false),
        responses: {
          200: jsonResponse('Kết quả hủy đăng ký', messageSchema('Đã hủy đăng ký nhận thông báo', {
            deletedCount: { type: 'integer', example: 1 },
          })),
          400: errorResponse('Thiếu subscriptionId, endpoint hoặc token'),
          ...commonAuthErrors,
        },
      },
    },
    '/api/notifications/subscriptions/{id}': {
      delete: {
        tags: ['Notification'],
        summary: 'Xóa một thiết bị đăng ký push theo ID',
        security: bearer,
        parameters: [pathParam('id', 'Subscription ID (UUID)')],
        responses: {
          200: jsonResponse('Đã hủy đăng ký thiết bị', messageSchema('Đã hủy đăng ký nhận thông báo', {
            deletedCount: { type: 'integer', example: 1 },
          })),
          ...commonAuthErrors,
          404: errorResponse('Không tìm thấy đăng ký thiết bị'),
        },
      },
    },
    '/api/notifications/test': {
      post: {
        tags: ['Notification'],
        summary: 'Gửi push notification thử nghiệm tới thiết bị của chính mình',
        description: 'Tạo một thông báo `TEST_PUSH` và gửi trực tiếp tới các thiết bị đang active của chính tài khoản đang đăng nhập, trả về báo cáo chi tiết từng thiết bị.',
        security: bearer,
        requestBody: jsonBody(ref('TestPushBody'), false),
        responses: {
          200: jsonResponse('Kết quả gửi push thử nghiệm', {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Đã gửi push thử nghiệm tới 1/1 thiết bị.' },
              notificationId: { type: 'string', format: 'uuid', nullable: true },
              summary: {
                type: 'object',
                properties: {
                  attempted: { type: 'integer', example: 1 },
                  sent: { type: 'integer', example: 1 },
                  failed: { type: 'integer', example: 0 },
                  skipped: { type: 'integer', example: 0 },
                },
              },
              results: { type: 'array', items: { type: 'object' } },
            },
          }),
          400: errorResponse('Dữ liệu không hợp lệ hoặc thiết bị đang bị vô hiệu hóa'),
          ...commonAuthErrors,
          404: errorResponse('Không tìm thấy thiết bị đăng ký'),
          429: errorResponse('Gửi test push quá nhanh'),
        },
      },
    },
    '/api/notifications/send': {
      post: {
        tags: ['Notification'],
        summary: 'Gửi thông báo tùy chỉnh / nhắc lịch / nhắc đóng tiền (Admin)',
        security: bearer,
        requestBody: jsonBody(ref('SendAdminNotificationBody')),
        responses: {
          200: jsonResponse('Đã gửi thông báo', {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Đã gửi thông báo đến 14 thành viên' },
              recipientCount: { type: 'integer', example: 14 },
              notificationIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
              deliverySummary: {
                type: 'object',
                properties: {
                  attempted: { type: 'integer', example: 18 },
                  sent: { type: 'integer', example: 17 },
                  failed: { type: 'integer', example: 1 },
                  skipped: { type: 'integer', example: 0 },
                },
              },
            },
          }),
          400: errorResponse('Dữ liệu hoặc đối tượng nhận không hợp lệ'),
          ...commonAdminErrors,
          404: errorResponse('Không tìm thấy trận đấu'),
        },
      },
    },
    '/api/notifications': {
      get: {
        tags: ['Notification'],
        summary: 'Lấy danh sách thông báo in-app của tôi',
        security: bearer,
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
          { name: 'unreadOnly', in: 'query', required: false, schema: { type: 'boolean', default: false } },
        ],
        responses: {
          200: jsonResponse('Danh sách thông báo và phân trang', {
            type: 'object',
            properties: {
              notifications: { type: 'array', items: ref('NotificationItem') },
              unreadCount: { type: 'integer', example: 3 },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer', example: 1 },
                  limit: { type: 'integer', example: 20 },
                  total: { type: 'integer', example: 42 },
                  totalPages: { type: 'integer', example: 3 },
                },
              },
            },
          }),
          ...commonAuthErrors,
        },
      },
    },
    '/api/notifications/unread-count': {
      get: {
        tags: ['Notification'],
        summary: 'Đếm số thông báo chưa đọc',
        security: bearer,
        responses: {
          200: jsonResponse('Số thông báo chưa đọc', {
            type: 'object',
            properties: { unreadCount: { type: 'integer', example: 3 } },
          }),
          ...commonAuthErrors,
        },
      },
    },
    '/api/notifications/read-all': {
      put: {
        tags: ['Notification'],
        summary: 'Đánh dấu tất cả thông báo là đã đọc',
        security: bearer,
        responses: {
          200: jsonResponse('Đã đánh dấu đã đọc tất cả', messageSchema('Đã đánh dấu tất cả thông báo là đã đọc', {
            updatedCount: { type: 'integer', example: 5 },
          })),
          ...commonAuthErrors,
        },
      },
    },
    '/api/notifications/{id}/read': {
      put: {
        tags: ['Notification'],
        summary: 'Đánh dấu một thông báo là đã đọc',
        security: bearer,
        parameters: [pathParam('id', 'Notification ID (UUID)')],
        responses: {
          200: jsonResponse('Đã đánh dấu đã đọc', messageSchema('Đã đánh dấu đã đọc', {
            notification: ref('NotificationItem'),
          })),
          ...commonAuthErrors,
          404: errorResponse('Không tìm thấy thông báo'),
        },
      },
    },
    '/api/notifications/{id}': {
      delete: {
        tags: ['Notification'],
        summary: 'Xóa một thông báo của tôi',
        security: bearer,
        parameters: [pathParam('id', 'Notification ID (UUID)')],
        responses: {
          200: jsonResponse('Đã xóa thông báo', messageSchema('Đã xóa thông báo')),
          ...commonAuthErrors,
          404: errorResponse('Không tìm thấy thông báo'),
        },
      },
    },
  },
};
