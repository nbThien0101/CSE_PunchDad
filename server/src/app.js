const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const voteRoutes = require('./routes/vote.routes');
const paymentRoutes = require('./routes/payment.routes');
const userRoutes = require('./routes/user.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { globalLimiter, speedLimiter } = require('./middleware/security.middleware');

const app = express();
const PORT = process.env.PORT || 5001;

// Hỗ trợ serialize BigInt sang Number khi trả JSON về client
BigInt.prototype.toJSON = function () {
  return Number(this);
};

// ==========================================
// Proxy & Security Configurations
// ==========================================
// Cho phép Express nhận diện đúng IP client qua Reverse Proxy/Cloudflare (CF-Connecting-IP, X-Forwarded-For)
app.set('trust proxy', 1);

// HTTP Security Headers (OWASP standards: chống XSS, MIME sniffing, Clickjacking, v.v.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Chống tấn công HTTP Parameter Pollution (HPP)
app.use(hpp());

// ==========================================
// CORS & Body Parsing (Giới hạn Payload tránh DoS bộ nhớ)
// ==========================================
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
      .split(',')
      .map(s => s.trim());
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // In dev mode, allow any localhost origin (Vite may pick different ports)
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Giới hạn kích thước payload request (tối đa 3MB cho avatar/base64, ngăn chặn DoS cạn kiệt RAM)
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ==========================================
// Rate Limiting & Speed Bump (Chống DoS / Scraper Flood)
// ==========================================
// Làm chậm dần response khi request dồn dập (Speed Bumps)
app.use(speedLimiter);

// Giới hạn tần suất request chung cho toàn bộ /api
app.use('/api', globalLimiter);

// ==========================================
// Routes
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);

// ==========================================
// Error Handling
// ==========================================
app.use(errorHandler);

// ==========================================
// Start Server & Slowloris Protection
// ==========================================
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🛡️  DoS/DDoS Protection active: Helmet, HPP, RateLimiters & SpeedBumps`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Chống tấn công Slowloris DoS (treo giữ kết nối HTTP chậm nhằm làm kiệt quệ socket server)
server.headersTimeout = 20000;  // Tối đa 20 giây để gửi đầy đủ HTTP headers
server.requestTimeout = 30000;  // Tối đa 30 giây cho toàn bộ vòng đời request
server.keepAliveTimeout = 5000; // Tối đa 5 giây cho kết nối keep-alive nhàn rỗi

module.exports = app;
