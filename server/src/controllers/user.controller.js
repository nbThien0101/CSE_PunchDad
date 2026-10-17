const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/users/members
 * Lấy danh sách tất cả thành viên CLB
 */
const getAllMembers = async (req, res, next) => {
  try {
    const members = await prisma.user.findMany({
      where: { membershipStatus: 'APPROVED' },
      select: {
        id: true,
        username: true,
        email: req.user.role === 'ADMIN',
        displayName: true,
        role: true,
        tier: true,
        isGoalkeeper: true,
        phone: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            // Registration alone is not attendance; cancelled sessions never count.
            votes: {
              where: {
                status: 'JOIN',
                isCheckedIn: true,
                session: { status: 'COMPLETED' },
              },
            },
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

/** Admin inbox: persisted pending accounts also act as unread join notifications. */
const getMembershipRequests = async (req, res, next) => {
  try {
    const requests = await prisma.user.findMany({
      where: { membershipStatus: 'PENDING', role: 'MEMBER' },
      select: {
        id: true, username: true, displayName: true, email: true, phone: true,
        createdAt: true, membershipStatus: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    res.json({ requests });
  } catch (error) {
    next(error);
  }
};

const getMembershipRequestCount = async (req, res, next) => {
  try {
    const count = await prisma.user.count({ where: { membershipStatus: 'PENDING', role: 'MEMBER' } });
    res.json({ count });
  } catch (error) {
    next(error);
  }
};

const reviewMembershipRequest = async (req, res, next) => {
  try {
    const { decision } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'Quyết định duyệt không hợp lệ' });
    }
    const result = await prisma.user.updateMany({
      where: { id: req.params.userId, membershipStatus: 'PENDING', role: 'MEMBER' },
      data: {
        membershipStatus: decision,
        membershipReviewedAt: new Date(),
        membershipReviewedBy: req.user.id,
      },
    });
    if (result.count === 0) {
      return res.status(409).json({ error: 'Yêu cầu không còn chờ duyệt hoặc không tồn tại. Vui lòng tải lại danh sách.' });
    }
    res.json({ message: decision === 'APPROVED' ? 'Đã duyệt thành viên vào CLB' : 'Đã từ chối yêu cầu tham gia CLB' });
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
    const { displayName, phone, bankInfo, isGoalkeeper } = req.body;

    // Validate displayName is required
    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'Tên hiển thị không được để trống' });
    }

    if (displayName.trim().length > 50) {
      return res.status(400).json({ error: 'Tên hiển thị tối đa 50 ký tự' });
    }

    const updateData = {
      displayName: displayName.trim(),
    };

    if (phone !== undefined) {
      const cleanPhone = phone?.trim();
      if (cleanPhone) {
        const phoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
        if (!phoneRegex.test(cleanPhone.replace(/[\s.-]/g, ''))) {
          return res.status(400).json({ error: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam gồm 10 chữ số (VD: 0901234567)' });
        }
        updateData.phone = cleanPhone.replace(/[\s.-]/g, '');
      } else {
        updateData.phone = null;
      }
    }

    if (bankInfo !== undefined) {
      updateData.bankInfo = bankInfo?.trim() || null;
    }

    if (isGoalkeeper !== undefined) {
      updateData.isGoalkeeper = Boolean(isGoalkeeper);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        phone: true,
        bankInfo: true,
        avatar: true,
        tier: true,
        isGoalkeeper: true,
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

/**
 * PUT /api/users/avatar
 * Upload ảnh đại diện (Base64)
 */
const uploadAvatar = async (req, res, next) => {
  try {
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({ error: 'Ảnh đại diện không được để trống' });
    }

    // Validate Base64 format — must start with data:image/
    const validPrefixes = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,', 'data:image/jpg;base64,'];
    const isValidFormat = validPrefixes.some(prefix => avatar.startsWith(prefix));

    if (!isValidFormat) {
      return res.status(400).json({ error: 'Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP' });
    }

    // Check size — limit ~2MB
    const base64Data = avatar.split(',')[1];
    const sizeInBytes = Buffer.from(base64Data, 'base64').length;
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (sizeInBytes > maxSize) {
      return res.status(400).json({ error: 'Ảnh đại diện tối đa 2MB' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar },
      select: {
        id: true,
        displayName: true,
        avatar: true,
      },
    });

    res.json({
      message: 'Cập nhật ảnh đại diện thành công',
      avatar: updatedUser.avatar,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/avatar
 * Xóa ảnh đại diện
 */
const deleteAvatar = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: null },
    });

    res.json({ message: 'Xóa ảnh đại diện thành công' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:userId/goalkeeper
 * Admin cập nhật vai trò thủ môn cho thành viên
 */
const updateUserGoalkeeper = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isGoalkeeper } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isGoalkeeper: Boolean(isGoalkeeper) },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        tier: true,
        isGoalkeeper: true,
      },
    });

    res.json({
      message: 'Cập nhật vai trò thủ môn thành công',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/change-password
 * Đổi mật khẩu người dùng
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || !currentPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' });
    }

    // Lấy thông tin user hiện tại kèm passwordHash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra mật khẩu hiện tại
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }

    // Băm mật khẩu mới
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const changed = await prisma.user.updateMany({
      where: { id: req.user.id, passwordHash: user.passwordHash },
      data: { passwordHash, authVersion: { increment: 1 } },
    });
    if (changed.count !== 1) return res.status(409).json({ error: 'Mật khẩu vừa thay đổi. Vui lòng đăng nhập lại.' });

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMembershipRequests,
  getMembershipRequestCount,
  reviewMembershipRequest,
  getAllMembers,
  updateUserTier,
  updateUserGoalkeeper,
  deleteMember,
  updateProfile,
  uploadQRCode,
  getQRCode,
  deleteQRCode,
  uploadAvatar,
  deleteAvatar,
  changePassword,
};

