const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

/**
 * Custom response handler for rate limit exceeded
 */
const createLimitHandler = (message, windowMinutes) => (req, res) => {
  res.status(429).json({
    error: message || `Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${windowMinutes} phút.`,
    retryAfterMinutes: windowMinutes,
    statusCode: 429,
  });
};

/**
 * 1. Global API Rate Limiter
 * Áp dụng cho toàn bộ API routes:
 * 200 requests / 15 phút trên mỗi IP
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: (req) => {
    // Không áp dụng cho health check endpoint
    return req.path === '/api/health' || req.path === '/health';
  },
  handler: createLimitHandler('Bạn đã vượt quá giới hạn yêu cầu cho phép (200 requests/15 phút). Vui lòng thử lại sau.', 15),
});

/**
 * 2. Speed Bump / Slow Down
 * Khi client gửi hơn 80 requests / 15 phút, bắt đầu làm chậm dần response
 * Mỗi request vượt ngưỡng sẽ bị delay thêm 300ms (tối đa 2 giây)
 * Giúp làm nản lòng botnet/scraper mà không làm gián đoạn người dùng thật
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 80,
  delayMs: (hits) => (hits - 80) * 300,
  maxDelayMs: 2000,
  skip: (req) => req.path === '/api/health' || req.path === '/health',
});

/**
 * 3. Auth Rate Limiter (Login, Register, Verify OTP)
 * Chống brute-force mật khẩu và credential stuffing
 * Tối đa 15 requests / 15 phút trên mỗi IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler('Quá nhiều yêu cầu đăng nhập/xác thực từ IP của bạn. Vui lòng đợi 15 phút trước khi thử lại.', 15),
});

/**
 * 4. OTP Request Limiter (Gửi mã OTP qua Email)
 * Cực kỳ quan trọng để bảo vệ quota email Brevo và tránh spam hộp thư
 * Tối đa 5 lần yêu cầu gửi mã OTP / 15 phút trên mỗi IP
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler('Bạn đã yêu cầu gửi mã OTP quá nhiều lần. Để bảo mật hệ thống, vui lòng thử lại sau 15 phút.', 15),
});

/**
 * 5. Compute Limiter (Thuật toán CPU-intensive: Chia đội hình)
 * Tối đa 20 lần tính toán / 1 phút trên mỗi IP
 */
const computeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler('Thao tác tính toán chia đội hình đang được gọi quá nhanh. Vui lòng đợi 1 phút.', 1),
});

module.exports = {
  globalLimiter,
  speedLimiter,
  authLimiter,
  otpLimiter,
  computeLimiter,
};
