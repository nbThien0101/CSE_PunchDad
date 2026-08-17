const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/users/members
 * Lấy danh sách tất cả thành viên CLB
 */
const getAllMembers = async (req, res, next) => {
  try {
    const members = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        tier: true,
        phone: true,
        createdAt: true,
        _count: {
          select: {
            votes: { where: { status: 'JOIN' } },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    });

    res.json({ members });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:userId/tier
 * Admin cập nhật tier cho thành viên
 */
const updateUserTier = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { tier } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { tier: tier?.trim() || null },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        tier: true,
      },
    });

    res.json({
      message: `Cập nhật tier thành công`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/profile
 * Cập nhật thông tin cá nhân
 */
const updateProfile = async (req, res, next) => {
  try {
    const { displayName, phone, bankInfo } = req.body;

    // Validate displayName is required
    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'Tên hiển thị không được để trống' });
    }

    if (displayName.trim().length > 50) {
      return res.status(400).json({ error: 'Tên hiển thị tối đa 50 ký tự' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        displayName: displayName.trim(),
        phone: phone?.trim() || null,
        bankInfo: bankInfo?.trim() || null,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        phone: true,
        bankInfo: true,
      },
    });

    res.json({
      message: 'Cập nhật thông tin thành công',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/qr-code
 * Upload ảnh QR code (Base64)
 */
const uploadQRCode = async (req, res, next) => {
  try {
    const { qrCodeImage } = req.body;

    if (!qrCodeImage) {
      return res.status(400).json({ error: 'Ảnh QR code không được để trống' });
    }

    // Validate Base64 format — must start with data:image/
    const validPrefixes = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,', 'data:image/jpg;base64,'];
    const isValidFormat = validPrefixes.some(prefix => qrCodeImage.startsWith(prefix));

    if (!isValidFormat) {
      return res.status(400).json({ error: 'Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP' });
    }

    // Check size — Base64 is ~33% larger than original, limit ~2MB original ≈ ~2.7MB Base64
    const base64Data = qrCodeImage.split(',')[1];
    const sizeInBytes = Buffer.from(base64Data, 'base64').length;
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (sizeInBytes > maxSize) {
      return res.status(400).json({ error: 'Ảnh QR code tối đa 2MB' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { qrCodeImage },
    });

    res.json({ message: 'Upload QR code thành công' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:id/qr-code
 * Lấy ảnh QR code của user
 */
const getQRCode = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        qrCodeImage: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    res.json({
      userId: user.id,
      displayName: user.displayName,
      qrCodeImage: user.qrCodeImage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/qr-code
 * Xóa ảnh QR code
 */
const deleteQRCode = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { qrCodeImage: null },
    });

    res.json({ message: 'Xóa QR code thành công' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:userId
 * Admin xóa thành viên khỏi CLB
 */
const deleteMember = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Không cho phép admin xóa chính mình
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Không thể xóa chính mình' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    // Không cho phép xóa admin khác
    if (targetUser.role === 'ADMIN') {
      return res.status(403).json({ error: 'Không thể xóa tài khoản Admin' });
    }

    // Xóa tất cả dữ liệu liên quan trong transaction
    await prisma.$transaction(async (tx) => {
      // Xóa payments của user
      await tx.payment.deleteMany({ where: { userId } });
      // Xóa votes của user
      await tx.vote.deleteMany({ where: { userId } });
      // Gỡ user khỏi payer của sessions (set null)
      await tx.session.updateMany({
        where: { payerId: userId },
        data: { payerId: null },
      });
      // Xóa user
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ message: `Đã xóa thành viên ${targetUser.displayName}` });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllMembers, updateUserTier, deleteMember, updateProfile, uploadQRCode, getQRCode, deleteQRCode };
