const router = require('express').Router();
const { getSessionPayments, markAsPaid, confirmPayment } = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/session/:sessionId', getSessionPayments);
router.put('/:id/mark-paid', markAsPaid);
router.put('/:id/confirm', confirmPayment);

module.exports = router;
