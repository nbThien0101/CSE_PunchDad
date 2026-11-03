const router = require('express').Router();
const { deprecate } = require('../middleware/deprecation.middleware');
const {
  getSessions,
  getSession,
  addTimeSlot,
  createSession,
  updateSession,
  deleteSession,
  adminDeleteSession,
  getTeamSuggestions,
  generateTeams,
  saveTeams,
  deleteTeams,
} = require('../controllers/session.controller');
const {
  toggleLockVote,
  getAttendanceDashboard,
  updateAttendance,
  bulkAttendance,
  addGuest,
  updateGuest,
  deleteGuest,
  recalculatePayments,
} = require('../controllers/attendance.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { createSessionValidation } = require('../middleware/validation.middleware');
const { computeLimiter } = require('../middleware/security.middleware');

// Tất cả routes đều cần auth
router.use(authenticate);
router.get('/:sessionId/payments', require('../controllers/payment.controller').getSessionPayments);
router.get('/:sessionId/votes', require('../controllers/vote.controller').getSessionVotes);

router.get('/', getSessions);
router.get('/:sessionId', getSession);
router.post('/', requireAdmin, createSessionValidation, createSession);
router.post('/:sessionId/time-slots', addTimeSlot);
router.patch('/:sessionId', requireAdmin, updateSession);
router.put('/:sessionId', requireAdmin, deprecate('/api/sessions/:sessionId'), updateSession);
router.delete('/:sessionId/force', requireAdmin, adminDeleteSession);
router.post('/:sessionId/cancel', requireAdmin, deleteSession);
router.delete('/:sessionId', requireAdmin, deprecate('/api/sessions/:sessionId/cancel'), deleteSession);

// Team balancing routes
router.get('/:sessionId/teams/suggestions', getTeamSuggestions);
router.post('/:sessionId/teams/generate', requireAdmin, computeLimiter, generateTeams);
router.put('/:sessionId/teams', requireAdmin, saveTeams);
router.delete('/:sessionId/teams', requireAdmin, deleteTeams);

// Attendance & Matchday Dashboard routes (Admin)
router.get('/:sessionId/attendance', getAttendanceDashboard);
router.post('/:sessionId/lock-vote', requireAdmin, toggleLockVote);
router.post('/:sessionId/attendance', requireAdmin, updateAttendance);
router.patch('/:sessionId/attendance', requireAdmin, bulkAttendance);
router.post('/:sessionId/attendance/bulk', requireAdmin, deprecate('/api/sessions/:sessionId/attendance'), bulkAttendance);
router.post('/:sessionId/guests', requireAdmin, addGuest);
router.patch('/:sessionId/guests/:guestId', requireAdmin, updateGuest);
router.put('/:sessionId/guests/:guestId', requireAdmin, deprecate('/api/sessions/:sessionId/guests/:guestId'), updateGuest);
router.delete('/:sessionId/guests/:guestId', requireAdmin, deleteGuest);
router.post('/:sessionId/recalculate-payments', requireAdmin, recalculatePayments);

module.exports = router;

