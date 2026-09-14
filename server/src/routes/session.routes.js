const router = require('express').Router();
const {
  getSessions,
  getSession,
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

router.get('/', getSessions);
router.get('/:id', getSession);
router.post('/', requireAdmin, createSessionValidation, createSession);
router.put('/:id', requireAdmin, updateSession);
router.delete('/:id/force', requireAdmin, adminDeleteSession);
router.delete('/:id', requireAdmin, deleteSession);

// Team balancing routes
router.get('/:id/teams/suggestions', getTeamSuggestions);
router.post('/:id/teams/generate', requireAdmin, computeLimiter, generateTeams);
router.put('/:id/teams', requireAdmin, saveTeams);
router.delete('/:id/teams', requireAdmin, deleteTeams);

// Attendance & Matchday Dashboard routes (Admin)
router.get('/:id/attendance', getAttendanceDashboard);
router.post('/:id/lock-vote', requireAdmin, toggleLockVote);
router.post('/:id/attendance', requireAdmin, updateAttendance);
router.post('/:id/attendance/bulk', requireAdmin, bulkAttendance);
router.post('/:id/guests', requireAdmin, addGuest);
router.put('/:id/guests/:guestId', requireAdmin, updateGuest);
router.delete('/:id/guests/:guestId', requireAdmin, deleteGuest);
router.post('/:id/recalculate-payments', requireAdmin, recalculatePayments);

module.exports = router;

