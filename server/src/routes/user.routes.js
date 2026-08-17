const router = require('express').Router();
const { getAllMembers, updateUserTier, deleteMember, updateProfile, uploadQRCode, getQRCode, deleteQRCode } = require('../controllers/user.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Tất cả routes đều yêu cầu authentication
router.use(authenticate);

router.get('/members', getAllMembers);
router.put('/:userId/tier', requireAdmin, updateUserTier);
router.put('/profile', updateProfile);
router.put('/qr-code', uploadQRCode);
router.get('/:id/qr-code', getQRCode);
router.delete('/qr-code', deleteQRCode);
router.delete('/:userId', requireAdmin, deleteMember);

module.exports = router;
