const router = require('express').Router();
const { updateProfile, uploadQRCode, getQRCode, deleteQRCode } = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Tất cả routes đều yêu cầu authentication
router.use(authenticate);

router.put('/profile', updateProfile);
router.put('/qr-code', uploadQRCode);
router.get('/:id/qr-code', getQRCode);
router.delete('/qr-code', deleteQRCode);

module.exports = router;
