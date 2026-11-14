const router = require('express').Router();
const {
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
} = require('../controllers/notification.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { pushTestLimiter } = require('../middleware/security.middleware');

// Public endpoint để iOS PWA / Mobile App lấy VAPID public key và các kênh hỗ trợ
router.get('/config', getPushConfig);

// Tất cả routes bên dưới đều yêu cầu đăng nhập & tài khoản đã duyệt
router.use(authenticate);

// Quản lý thiết bị đăng ký push (Android APK FCM/Expo & iOS PWA Web Push)
router.get('/subscriptions', listSubscriptions);
router.post('/subscriptions', registerPushSubscription);
router.delete('/subscriptions', unregisterPushSubscription);
router.delete('/subscriptions/:id', unregisterPushSubscription);

// Gửi test & Admin broadcast
router.post('/test', pushTestLimiter, sendTestNotification);
router.post('/send', requireAdmin, sendAdminNotification);

// Hộp thư thông báo in-app
router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
