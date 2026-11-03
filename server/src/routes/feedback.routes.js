const router = require('express').Router();
const { deprecate } = require('../middleware/deprecation.middleware');
const { createFeedback, getFeedbacks, updateFeedback } = require('../controllers/feedback.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/', createFeedback);
router.get('/', requireAdmin, getFeedbacks);
router.patch('/:feedbackId', requireAdmin, updateFeedback);
router.put('/:feedbackId', requireAdmin, deprecate('/api/feedback/:feedbackId'), updateFeedback);

module.exports = router;
