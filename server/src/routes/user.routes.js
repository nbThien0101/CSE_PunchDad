const router = require('express').Router();
const { getAllMembers, updateUserTier, updateUserGoalkeeper, deleteMember, updateProfile, uploadQRCode, getQRCode, deleteQRCode, uploadAvatar, deleteAvatar, changePassword } = require('../controllers/user.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Tất cả routes đều yêu cầu authentication
router.use(authenticate);

router.get('/members', getAllMembers);
router.put('/:userId/tier', requireAdmin, updateUserTier);
router.put('/:userId/goalkeeper', requireAdmin, updateUserGoalkeeper);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.put('/avatar', uploadAvatar);
router.delete('/avatar', deleteAvatar);
router.put('/qr-code', uploadQRCode);
router.get('/:id/qr-code', getQRCode);
router.delete('/qr-code', deleteQRCode);
router.delete('/:userId', requireAdmin, deleteMember);

module.exports = router;
