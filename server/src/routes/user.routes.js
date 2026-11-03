const router = require('express').Router();
const { deprecate } = require('../middleware/deprecation.middleware');
const { getAllMembers, exportMembersExcel, updateUserTier, updateUserGoalkeeper, deleteMember, updateProfile, uploadQRCode, getQRCode, deleteQRCode, uploadAvatar, deleteAvatar, changePassword } = require('../controllers/user.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { getMembershipRequests, getMembershipRequestCount, reviewMembershipRequest } = require('../controllers/user.controller');

// Tất cả routes đều yêu cầu authentication
router.use(authenticate);

router.get('/', getAllMembers);
router.get('/members', deprecate('/api/users'), getAllMembers);
router.get('/export-excel', requireAdmin, exportMembersExcel);
router.get('/membership-requests', requireAdmin, getMembershipRequests);
router.get('/membership-requests/count', requireAdmin, getMembershipRequestCount);
router.patch('/membership-requests/:userId', requireAdmin, reviewMembershipRequest);
router.put('/membership-requests/:userId', requireAdmin, deprecate('/api/users/membership-requests/:userId'), reviewMembershipRequest);
router.patch('/:userId/tier', requireAdmin, updateUserTier);
router.put('/:userId/tier', requireAdmin, deprecate('/api/users/:userId/tier'), updateUserTier);
router.patch('/:userId/goalkeeper', requireAdmin, updateUserGoalkeeper);
router.put('/:userId/goalkeeper', requireAdmin, deprecate('/api/users/:userId/goalkeeper'), updateUserGoalkeeper);
router.patch('/me', updateProfile);
router.put('/profile', deprecate('/api/users/me'), updateProfile);
router.put('/me/password', changePassword);
router.put('/change-password', deprecate('/api/users/me/password'), changePassword);
router.put('/me/avatar', uploadAvatar);
router.put('/avatar', deprecate('/api/users/me/avatar'), uploadAvatar);
router.delete('/me/avatar', deleteAvatar);
router.delete('/avatar', deprecate('/api/users/me/avatar'), deleteAvatar);
router.put('/me/qr-code', uploadQRCode);
router.put('/qr-code', deprecate('/api/users/me/qr-code'), uploadQRCode);
router.get('/:userId/qr-code', getQRCode);
router.delete('/me/qr-code', deleteQRCode);
router.delete('/qr-code', deprecate('/api/users/me/qr-code'), deleteQRCode);
router.delete('/:userId', requireAdmin, deleteMember);

module.exports = router;
