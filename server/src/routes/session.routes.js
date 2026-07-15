const router = require('express').Router();
const {
  getSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
} = require('../controllers/session.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { createSessionValidation } = require('../middleware/validation.middleware');

// Tất cả routes đều cần auth
router.use(authenticate);

router.get('/', getSessions);
router.get('/:id', getSession);
router.post('/', requireAdmin, createSessionValidation, createSession);
router.put('/:id', requireAdmin, updateSession);
router.delete('/:id', requireAdmin, deleteSession);

module.exports = router;
