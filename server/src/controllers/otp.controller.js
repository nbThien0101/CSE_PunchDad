const crypto = require('crypto');
const bcrypt = require('bcryptjs');
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
    const { email, phone, username } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email không được để trống' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    // Validate phone if provided
    if (phone && phone.trim()) {
      const cleanPhone = phone.trim().replace(/[\s.-]/g, '');
      const phoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ error: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam gồm 10 chữ số (VD: 0901234567)' });
      }
    }

    // Check username uniqueness if provided
    if (username && username.trim()) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: username.trim() },
      });
      if (existingUsername) {
        return res.status(409).json({ error: 'Tên đăng nhập này đã được sử dụng' });
      }
    }

    // Kiểm tra email đã được dùng bởi user khác chưa
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email này đã được sử dụng' });
    }

    // Rate limiting: Không cho gửi lại trong 60 giây
    const recentOTP = await prisma.otpVerification.findFirst({
      where: {
        email: normalizedEmail,
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
        email: normalizedEmail,
        otp,
        expiresAt,
      },
    });

    // Gửi email
    await sendOTPEmail(normalizedEmail, otp);

    res.json({
      message: 'Mã OTP đã được gửi đến email của bạn',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi gửi email OTP' });
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

    const normalizedEmail = email.trim().toLowerCase();

    // Tìm OTP hợp lệ (chưa dùng + chưa hết hạn)
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        email: normalizedEmail,
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
        email: normalizedEmail,
        otp: `verified_${verificationToken}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Token hợp lệ 10 phút
        used: false,
      },
    });

    res.json({
      message: 'Xác thực OTP thành công',
      verificationToken,
      email: normalizedEmail,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password/send-otp
 * Gửi mã OTP khôi phục mật khẩu
 */
const forgotPasswordSendOTP = async (req, res, next) => {
  try {
    const { emailOrUsername } = req.body;
    const input = (emailOrUsername || '').trim();

    if (!input) {
      return res.status(400).json({ error: 'Vui lòng nhập Email hoặc Tên đăng nhập' });
    }

    // Tìm user theo email hoặc username (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: input.toLowerCase(), mode: 'insensitive' } },
          { username: { equals: input, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, username: true, displayName: true },
    });

    if (!user || !user.email) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản với thông tin này' });
    }

    const targetEmail = user.email.toLowerCase();

    // Rate limiting: Không cho gửi lại trong 60 giây
    const recentOTP = await prisma.otpVerification.findFirst({
      where: {
        email: targetEmail,
        otp: { startsWith: 'forgot_' },
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOTP) {
      const secondsLeft = Math.ceil(
        (new Date(recentOTP.createdAt).getTime() + 60000 - Date.now()) / 1000
      );
      return res.status(429).json({
        error: `Vui lòng đợi ${secondsLeft} giây trước khi gửi lại mã`,
        retryAfter: secondsLeft,
      });
    }

    // Tạo OTP 6 số mới
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    // Lưu vào DB với prefix 'forgot_'
    await prisma.otpVerification.create({
      data: {
        email: targetEmail,
        otp: `forgot_${otp}`,
        expiresAt,
      },
    });

    // Gửi email OTP dạng FORGOT_PASSWORD
    await sendOTPEmail(targetEmail, otp, 'FORGOT_PASSWORD');

    // Che bớt email để bảo mật: vd v***g@gmail.com
    const [localPart, domain] = targetEmail.split('@');
    const maskedLocal = localPart.length <= 3
      ? localPart[0] + '***'
      : localPart[0] + '***' + localPart.slice(-1);
    const maskedEmail = `${maskedLocal}@${domain}`;

    res.json({
      message: 'Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn',
      email: targetEmail,
      maskedEmail,
    });
  } catch (error) {
    console.error('Forgot password send OTP error:', error);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi gửi mã OTP' });
  }
};

/**
 * POST /api/auth/forgot-password/verify-otp
 * Xác thực mã OTP để đặt lại mật khẩu
 */
const forgotPasswordVerifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email và mã OTP không được để trống' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Tìm OTP 'forgot_' hợp lệ
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        email: normalizedEmail,
        otp: `forgot_${otp}`,
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

    // Tạo resetToken ngẫu nhiên
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Lưu token vào DB với prefix 'reset_' (hiệu lực 10 phút)
    await prisma.otpVerification.create({
      data: {
        email: normalizedEmail,
        otp: `reset_${resetToken}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
      },
    });

    res.json({
      message: 'Xác thực OTP thành công',
      resetToken,
      email: normalizedEmail,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password/reset
 * Đặt mật khẩu mới bằng resetToken
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ error: 'Thiếu thông tin đặt lại mật khẩu' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Kiểm tra resetToken hợp lệ
    const tokenRecord = await prisma.otpVerification.findFirst({
      where: {
        email: normalizedEmail,
        otp: `reset_${resetToken}`,
        used: false,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!tokenRecord) {
      return res.status(400).json({ error: 'Phiên đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng thử lại từ đầu.' });
    }

    // Tìm user theo email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    // Hash mật khẩu mới
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Cập nhật mật khẩu trong DB
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Đánh dấu token đã sử dụng
    await prisma.otpVerification.update({
      where: { id: tokenRecord.id },
      data: { used: true },
    });

    res.json({
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  forgotPasswordSendOTP,
  forgotPasswordVerifyOTP,
  resetPassword,
};
