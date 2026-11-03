const router = require('express').Router();
const { createFeedback, getFeedbacks, updateFeedback } = require('../controllers/feedback.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/', createFeedback);
router.get('/', requireAdmin, getFeedbacks);
router.put('/:id', requireAdmin, updateFeedback);

module.exports = router;
