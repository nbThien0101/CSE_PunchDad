const router = require('express').Router();
const { castVote, updateVote, getSessionVotes, adminAdjustVote } = require('../controllers/vote.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/', castVote);
router.post('/admin/adjust', requireAdmin, adminAdjustVote);
router.put('/:id', updateVote);
router.get('/session/:sessionId', getSessionVotes);

module.exports = router;
