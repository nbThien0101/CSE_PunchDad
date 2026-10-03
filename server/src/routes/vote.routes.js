const router = require('express').Router();
const { castVote, updateVote, getSessionVotes, adminAdjustVote } = require('../controllers/vote.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { deprecate } = require('../middleware/deprecation.middleware');

router.use(authenticate);

router.post('/', castVote);
router.post('/admin/adjust', requireAdmin, adminAdjustVote);
router.patch('/:voteId', updateVote);
router.put('/:voteId', deprecate('/api/votes/:voteId'), updateVote);
router.get('/session/:sessionId', deprecate('/api/sessions/:sessionId/votes'), getSessionVotes);

module.exports = router;
