const router = require('express').Router();
const {
  getTournaments,
  getTournamentById,
  createTournament,
  executeCommand,
  streamTournament,
} = require('../controllers/tournament.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', getTournaments);
router.get('/:id', getTournamentById);
router.post('/', requireAdmin, createTournament);
router.post('/:id/commands', executeCommand);
router.get('/:id/stream', streamTournament);

module.exports = router;
