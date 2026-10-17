function membershipAccessError(user) {
  if (user.membershipStatus === 'APPROVED') return null;
  if (user.membershipStatus === 'REJECTED') {
    return { code: 'MEMBERSHIP_REJECTED', error: 'Yêu cầu tham gia CLB đã bị từ chối. Vui lòng liên hệ admin.' };
  }
  return { code: 'MEMBERSHIP_PENDING', error: 'Tài khoản đang chờ admin duyệt. Bạn chỉ có thể vào CLB sau khi được chấp thuận.' };
}

module.exports = { membershipAccessError };
