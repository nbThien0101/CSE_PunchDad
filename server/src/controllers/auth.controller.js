const bcrypt = require('bcryptjs');
const { generateTokens, verifyToken } = require('../services/token.service');
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới (yêu cầu OTP đã xác thực)
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, displayName, phone, email, verificationToken } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    // Kiểm tra verificationToken
    if (typeof verificationToken !== 'string' || !/^[a-f0-9]{64}$/.test(verificationToken) || !normalizedEmail) {
      return res.status(400).json({ error: 'Cần xác thực email trước khi đăng ký' });
    }

    // Verify token hợp lệ
    const tokenRecord = await prisma.otpVerification.findFirst({
      where: {
        email: normalizedEmail,
        otp: `verified_${verificationToken}`,
        used: false,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!tokenRecord) {
      return res.status(400).json({ error: 'Token xác thực không hợp lệ hoặc đã hết hạn. Vui lòng xác thực lại.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.otpVerification.updateMany({
        where: { id: tokenRecord.id, used: false, expiresAt: { gte: new Date() } },
        data: { used: true },
      });
      if (claimed.count !== 1) return null;
      return tx.user.create({
        data: {
          username: username.trim(),
          passwordHash,
          displayName: displayName.trim(),
          phone: phone ? phone.trim() : null,
          email: normalizedEmail,
        },
        select: {
          id: true,
          authVersion: true,
          username: true,
          email: true,
          displayName: true,
          phone: true,
          bankInfo: true,
          role: true,
          tier: true,
          isGoalkeeper: true,
          avatar: true,
          createdAt: true,
        },
      });
    });
    if (!user) return res.status(400).json({ error: 'Token xác thực đã được sử dụng hoặc hết hạn' });

    const tokens = generateTokens(user);
    const { authVersion, ...publicUser } = user;

    res.status(201).json({
      message: 'Registration successful',
      user: publicUser,
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Đăng nhập
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const identifier = (username || '').trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: 'insensitive' } },
          { email: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Tên đăng nhập / email hoặc mật khẩu không đúng' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Tên đăng nhập / email hoặc mật khẩu không đúng' });
    }

    const tokens = generateTokens(user);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        phone: user.phone,
        bankInfo: user.bankInfo,
        role: user.role,
        tier: user.tier,
        isGoalkeeper: user.isGoalkeeper,
        avatar: user.avatar,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (typeof refreshToken !== 'string' || !refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = verifyToken(refreshToken, 'refresh');
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, authVersion: true },
    });
    if (!user || user.authVersion !== decoded.authVersion) {
      return res.status(401).json({ error: 'Phiên đăng nhập không còn hợp lệ' });
    }
    const tokens = generateTokens(user);

    res.json(tokens);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại
 */
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { register, login, refresh, getMe };
