const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        phone: true,
        bankInfo: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
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
