const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { sendOTPEmail } = require('../services/email.service');

const prisma = new PrismaClient();

/**
 * Tạo mã OTP 6 số ngẫu nhiên
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * POST /api/auth/send-otp
 * Gửi mã OTP đến email
 */
const sendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email không được để trống' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    // Kiểm tra email đã được dùng bởi user khác chưa
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email này đã được sử dụng' });
    }

    // Rate limiting: Không cho gửi lại trong 60 giây
    const recentOTP = await prisma.otpVerification.findFirst({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // 60 giây trước
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOTP) {
      const secondsLeft = Math.ceil(
        (new Date(recentOTP.createdAt).getTime() + 60000 - Date.now()) / 1000
      );
      return res.status(429).json({
        error: `Vui lòng đợi ${secondsLeft} giây trước khi gửi lại`,
        retryAfter: secondsLeft,
      });
    }

    // Tạo OTP mới
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    // Lưu vào DB
    await prisma.otpVerification.create({
      data: {
        email,
        otp,
        expiresAt,
      },
    });

    // Gửi email
    await sendOTPEmail(email, otp);

    res.json({
      message: 'Mã OTP đã được gửi đến email của bạn',
      email,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    next(error);
  }
};

/**
 * POST /api/auth/verify-otp
 * Xác thực mã OTP
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email và mã OTP không được để trống' });
    }

    // Tìm OTP hợp lệ (chưa dùng + chưa hết hạn)
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        email,
        otp,
        used: false,
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    // Đánh dấu OTP đã sử dụng
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Tạo token xác thực tạm thời (lưu email đã verified, dùng cho bước register)
    // Dùng crypto để tạo token ngẫu nhiên
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Lưu token vào OTP record (re-use field otp để đơn giản)
    await prisma.otpVerification.create({
      data: {
        email,
        otp: `verified_${verificationToken}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Token hợp lệ 10 phút
        used: false,
      },
    });

    res.json({
      message: 'Xác thực OTP thành công',
      verificationToken,
      email,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { sendOTP, verifyOTP };
