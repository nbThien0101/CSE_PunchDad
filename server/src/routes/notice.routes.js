const router = require('express').Router();
const {
  getSummary,
  getNotices,
  createNotice,
  markRead,
  archiveNotice,
} = require('../controllers/notice.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/summary', getSummary);
router.get('/', getNotices);
router.post('/', requireAdmin, createNotice);
router.put('/:id/read', markRead);
router.put('/:id/archive', requireAdmin, archiveNotice);

module.exports = router;
