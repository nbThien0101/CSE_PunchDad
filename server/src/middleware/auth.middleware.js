const { verifyToken } = require('../services/token.service');
const { PrismaClient } = require('@prisma/client');
const { membershipAccessError } = require('../utils/membership');

const prisma = new PrismaClient();

/**
 * Middleware xác thực JWT token
 * Gắn user info vào req.user nếu token hợp lệ
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token, 'access');

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        authVersion: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        membershipStatus: true,
        tier: true,
        isGoalkeeper: true,
        phone: true,
        bankInfo: true,
        avatar: true,
      },
    });

    if (!user || user.authVersion !== decoded.authVersion) {
      return res.status(401).json({ error: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.' });
    }

    const accessError = membershipAccessError(user);
    if (accessError) return res.status(403).json(accessError);

    const { authVersion, ...publicUser } = user;
    req.user = publicUser;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware kiểm tra quyền Admin
 * Phải dùng sau middleware authenticate
 */
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Middleware kiểm tra quyền Admin hoặc chính user đó
 */
const requireAdminOrSelf = (req, res, next) => {
  const targetUserId = req.params.userId;
  if (req.user.role !== 'ADMIN' && req.user.id !== targetUserId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireAdminOrSelf };
