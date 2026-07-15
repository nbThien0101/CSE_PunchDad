const router = require('express').Router();
const { castVote, updateVote, getSessionVotes } = require('../controllers/vote.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/', castVote);
router.put('/:id', updateVote);
router.get('/session/:sessionId', getSessionVotes);

module.exports = router;
