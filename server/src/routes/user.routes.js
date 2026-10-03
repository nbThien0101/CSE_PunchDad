const router = require('express').Router();
const { getAllMembers, updateUserTier, updateUserGoalkeeper, deleteMember, updateProfile, uploadQRCode, getQRCode, deleteQRCode, uploadAvatar, deleteAvatar, changePassword } = require('../controllers/user.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { deprecate } = require('../middleware/deprecation.middleware');

// Tất cả routes đều yêu cầu authentication
router.use(authenticate);

router.get('/', getAllMembers);
router.patch('/me', updateProfile);
router.put('/me/password', changePassword);
router.put('/me/avatar', uploadAvatar);
router.delete('/me/avatar', deleteAvatar);
router.put('/me/qr-code', uploadQRCode);
router.delete('/me/qr-code', deleteQRCode);
router.patch('/:userId/tier', requireAdmin, updateUserTier);
router.patch('/:userId/goalkeeper', requireAdmin, updateUserGoalkeeper);

// Deprecated wire routes retained for deployed clients.
router.get('/members', deprecate('/api/users'), getAllMembers);
router.put('/profile', deprecate('/api/users/me'), updateProfile);
router.put('/change-password', deprecate('/api/users/me/password'), changePassword);
router.put('/avatar', deprecate('/api/users/me/avatar'), uploadAvatar);
router.delete('/avatar', deprecate('/api/users/me/avatar'), deleteAvatar);
router.put('/qr-code', deprecate('/api/users/me/qr-code'), uploadQRCode);
router.delete('/qr-code', deprecate('/api/users/me/qr-code'), deleteQRCode);
router.put('/:userId/tier', requireAdmin, deprecate('/api/users/:userId/tier'), updateUserTier);
router.put('/:userId/goalkeeper', requireAdmin, deprecate('/api/users/:userId/goalkeeper'), updateUserGoalkeeper);

router.get('/:userId/qr-code', getQRCode);
router.delete('/:userId', requireAdmin, deleteMember);

module.exports = router;
