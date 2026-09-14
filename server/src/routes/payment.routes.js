const router = require('express').Router();
const {
  getSessionPayments,
  markAsPaid,
  confirmPayment,
  createPayOSLink,
  handlePayOSWebhook,
  checkPayOSStatus,
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

router.get('/session/:sessionId', getSessionPayments);
router.put('/:id/mark-paid', markAsPaid);
router.put('/:id/confirm', confirmPayment);

// PayOS Endpoints
router.post('/:id/payos-link', createPayOSLink);
router.get('/:id/payos-status', checkPayOSStatus);

module.exports = router;
