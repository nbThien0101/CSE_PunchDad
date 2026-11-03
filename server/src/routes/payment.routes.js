const router = require('express').Router();
const { deprecate } = require('../middleware/deprecation.middleware');
const {
  getSessionPayments,
  markAsPaid,
  confirmPayment,
  createPayOSLink,
  handlePayOSWebhook,
  checkPayOSStatus,
  confirmPayOSWebhook,
} = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

// ==========================================
// Public Webhook Routes (Không yêu cầu JWT)
// PayOS Server gửi webhook xác thực qua Checksum
// ==========================================
router.post('/payos-webhook', handlePayOSWebhook);

// ==========================================
// Authenticated Payment Routes
// ==========================================
router.use(authenticate);

router.get('/session/:sessionId', deprecate('/api/sessions/:sessionId/payments'), getSessionPayments);
router.post('/:paymentId/mark-paid', markAsPaid);
router.put('/:paymentId/mark-paid', deprecate('/api/payments/:paymentId/mark-paid'), markAsPaid);
router.post('/:paymentId/confirm', confirmPayment);
router.put('/:paymentId/confirm', deprecate('/api/payments/:paymentId/confirm'), confirmPayment);

// PayOS Endpoints
router.post('/payos-confirm-webhook', confirmPayOSWebhook);
router.post('/:paymentId/payos-link', createPayOSLink);
router.get('/:paymentId/payos-status', checkPayOSStatus);

module.exports = router;
