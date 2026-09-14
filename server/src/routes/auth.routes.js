const router = require('express').Router();
const { register, login, refresh, getMe } = require('../controllers/auth.controller');
const {
  sendOTP,
  verifyOTP,
  forgotPasswordSendOTP,
  forgotPasswordVerifyOTP,
  resetPassword,
} = require('../controllers/otp.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { registerValidation, loginValidation } = require('../middleware/validation.middleware');
const { authLimiter, otpLimiter } = require('../middleware/security.middleware');

router.post('/register', authLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.post('/refresh', refresh);
router.get('/me', authenticate, getMe);

// OTP routes
router.post('/send-otp', otpLimiter, sendOTP);
router.post('/verify-otp', authLimiter, verifyOTP);

// Forgot Password routes
router.post('/forgot-password/send-otp', otpLimiter, forgotPasswordSendOTP);
router.post('/forgot-password/verify-otp', authLimiter, forgotPasswordVerifyOTP);
router.post('/forgot-password/reset', authLimiter, resetPassword);

module.exports = router;
