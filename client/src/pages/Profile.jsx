import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';
import './Profile.css';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    phone: user?.phone || '',
    bankInfo: user?.bankInfo || '',
    isGoalkeeper: user?.isGoalkeeper || false,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // QR Code state
  const [qrImage, setQrImage] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  // Load QR code on mount
  useEffect(() => {
    loadQRCode();
  }, []);

  const loadQRCode = async () => {
    try {
      setQrLoading(true);
      const data = await usersAPI.getQRCode(user.id);
      setQrImage(data.qrCodeImage || null);
    } catch {
      // No QR code yet — that's fine
    } finally {
      setQrLoading(false);
    }
  };

  // ====== Avatar Handlers ======
  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Chỉ chấp nhận ảnh đại diện định dạng PNG, JPEG hoặc WebP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh gốc tối đa 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        // Center crop square
        const minSide = Math.min(width, height);
        const startX = (width - minSide) / 2;
        const startY = (height - minSide) / 2;

        const outDim = Math.min(minSide, maxDim);
        canvas.width = outDim;
        canvas.height = outDim;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, outDim, outDim);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarPreview(compressedBase64);
        setError('');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!avatarPreview) return;

    setAvatarUploading(true);
    setError('');

    try {
      const data = await usersAPI.uploadAvatar(avatarPreview);
      if (data.error) {
        setError(data.error);
      } else {
        updateUser({ avatar: data.avatar });
        setAvatarPreview(null);
        setSuccess('Cập nhật ảnh đại diện thành công!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Upload ảnh đại diện thất bại, vui lòng thử lại');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('Bạn có chắc muốn xóa ảnh đại diện?')) return;

    setError('');
    try {
      const data = await usersAPI.deleteAvatar();
      if (data.error) {
        setError(data.error);
      } else {
        updateUser({ avatar: null });
        setAvatarPreview(null);
        setSuccess('Đã xóa ảnh đại diện');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Xóa ảnh đại diện thất bại, vui lòng thử lại');
    }
  };

  const handleCancelAvatar = () => {
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCancel = () => {
    setForm({
      displayName: user?.displayName || '',
      phone: user?.phone || '',
      bankInfo: user?.bankInfo || '',
      isGoalkeeper: user?.isGoalkeeper || false,
    });
    setEditing(false);
    setError('');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const data = await usersAPI.updateProfile(form);
      if (data.error) {
        setError(data.error);
      } else {
        updateUser(data.user);
        setSuccess('Cập nhật thông tin thành công!');
        setEditing(false);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  };

  // QR Code handlers
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP');
      return;
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Ảnh QR code tối đa 2MB');
      return;
    }

    // Read as Base64 and show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setQrPreview(event.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadQR = async () => {
    if (!qrPreview) return;

    setQrUploading(true);
    setError('');

    try {
      const data = await usersAPI.uploadQRCode(qrPreview);
      if (data.error) {
        setError(data.error);
      } else {
        setQrImage(qrPreview);
        setQrPreview(null);
        setSuccess('Upload QR code thành công!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Upload thất bại, vui lòng thử lại');
    } finally {
      setQrUploading(false);
    }
  };

  const handleDeleteQR = async () => {
    if (!confirm('Bạn có chắc muốn xóa ảnh QR code?')) return;

    try {
      const data = await usersAPI.deleteQRCode();
      if (data.error) {
        setError(data.error);
      } else {
        setQrImage(null);
        setQrPreview(null);
        setSuccess('Đã xóa QR code');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Xóa thất bại, vui lòng thử lại');
    }
  };

  const handleCancelPreview = () => {
    setQrPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="profile-page animate-fade-in">
      <h1 className="page-title">Hồ sơ cá nhân</h1>
      <p className="page-subtitle">Quản lý thông tin tài khoản và phương thức nhận tiền</p>

      {success && (
        <div className="alert alert-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ====== Profile Info Card ====== */}
      <div className="profile-card card">
        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            <div
              className={`profile-avatar ${avatarPreview ? 'has-preview' : ''}`}
              onClick={() => avatarInputRef.current?.click()}
              title="Nhấn để đổi ảnh đại diện"
            >
              {(avatarPreview || user?.avatar) ? (
                <img
                  src={avatarPreview || user.avatar}
                  alt={user?.displayName}
                  className="profile-avatar-img"
                />
              ) : (
                user?.displayName?.[0]?.toUpperCase()
              )}
              <div className="profile-avatar-badge" title="Đổi ảnh đại diện">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              </div>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarSelect}
              style={{ display: 'none' }}
              id="input-avatar-upload"
            />
          </div>

          <div className="profile-header-info">
            <h2 className="profile-name">{user?.displayName}</h2>
            <span className="profile-username">@{user?.username}</span>
            {user?.role === 'ADMIN' && <span className="badge badge-admin" style={{ marginLeft: 8 }}>Admin</span>}

            {avatarPreview && (
              <div className="avatar-preview-actions animate-fade-in">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleUploadAvatar}
                  disabled={avatarUploading}
                  id="btn-save-avatar"
                >
                  {avatarUploading ? (
                    <><span className="spinner spinner-sm"></span> Lưu...</>
                  ) : (
                    'Lưu ảnh'
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancelAvatar}
                  disabled={avatarUploading}
                  id="btn-cancel-avatar"
                >
                  Hủy
                </button>
              </div>
            )}

            {!avatarPreview && user?.avatar && (
              <div className="avatar-delete-link">
                <button
                  type="button"
                  className="btn-text-danger"
                  onClick={handleDeleteAvatar}
                  id="btn-delete-avatar"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Xóa ảnh đại diện
                </button>
              </div>
            )}
          </div>

          {!editing && (
            <button
              className="btn btn-outline btn-sm profile-edit-btn"
              onClick={() => setEditing(true)}
              id="btn-edit-profile"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Chỉnh sửa
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSaveProfile} className="profile-edit-form animate-fade-in">
            <div className="form-group">
              <label className="form-label">Tên hiển thị <span className="required">*</span></label>
              <input
                type="text"
                name="displayName"
                value={form.displayName}
                onChange={handleChange}
                className="form-input"
                placeholder="Nhập tên hiển thị"
                maxLength={50}
                required
                id="input-display-name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Số điện thoại</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="form-input"
                placeholder="VD: 0901234567"
                id="input-phone"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Thông tin ngân hàng</label>
              <input
                type="text"
                name="bankInfo"
                value={form.bankInfo}
                onChange={handleChange}
                className="form-input"
                placeholder="VD: Vietcombank - 1234567890 - Nguyen Van A"
                id="input-bank-info"
              />
              <span className="form-hint">Số tài khoản, ngân hàng, tên chủ TK</span>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <input
                type="checkbox"
                id="input-is-goalkeeper"
                name="isGoalkeeper"
                checked={form.isGoalkeeper}
                onChange={(e) => setForm(prev => ({ ...prev, isGoalkeeper: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: 'var(--primary-600)', cursor: 'pointer' }}
              />
              <label htmlFor="input-is-goalkeeper" className="form-label" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                Tôi có thể bắt gôn (Thủ môn / GK)
              </label>
            </div>

            <div className="profile-edit-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                id="btn-save-profile"
              >
                {saving ? (
                  <><span className="spinner spinner-sm"></span> Đang lưu...</>
                ) : (
                  'Lưu thay đổi'
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancel}
                disabled={saving}
                id="btn-cancel-edit"
              >
                Hủy
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-fields">
            <div className="profile-field">
              <span className="profile-field-label">Số điện thoại</span>
              <span className="profile-field-value">{user?.phone || 'Chưa cập nhật'}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Thông tin ngân hàng</span>
              <span className="profile-field-value">{user?.bankInfo || 'Chưa cập nhật'}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Vị trí thi đấu</span>
              <span className="profile-field-value">
                {user?.isGoalkeeper ? (
                  <span className="badge-gk">Thủ môn (GK)</span>
                ) : (
                  'Cầu thủ sân'
                )}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Vai trò</span>
              <span className="profile-field-value">{user?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ====== QR Code Card ====== */}
      <div className="profile-qr-card card">
        <div className="profile-qr-header">
          <h3>Mã QR thanh toán</h3>
          <p className="text-muted">Hình ảnh mã QR ngân hàng để các thành viên quét chuyển tiền</p>
        </div>

        {qrLoading ? (
          <div className="qr-loading">
            <div className="spinner"></div>
            <span>Đang tải...</span>
          </div>
        ) : (
          <div className="qr-content">
            {/* Current QR or Preview */}
            {(qrPreview || qrImage) && (
              <div className="qr-image-container animate-fade-in">
                <img
                  src={qrPreview || qrImage}
                  alt="QR Code"
                  className={`qr-image ${qrPreview ? 'qr-preview-border' : ''}`}
                />
                {qrPreview && (
                  <span className="qr-preview-badge">Xem trước</span>
                )}
              </div>
            )}

            {/* Upload area when no image and no preview */}
            {!qrImage && !qrPreview && (
              <div
                className="qr-upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="qr-upload-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </div>
                <p className="qr-upload-text">Nhấn để tải lên ảnh mã QR</p>
                <p className="qr-upload-hint">PNG, JPEG, WebP • Tối đa 2MB</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="qr-file-input"
              id="input-qr-upload"
            />

            {/* Action buttons */}
            <div className="qr-actions">
              {qrPreview ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={handleUploadQR}
                    disabled={qrUploading}
                    id="btn-confirm-qr"
                  >
                    {qrUploading ? (
                      <><span className="spinner spinner-sm"></span> Đang tải lên...</>
                    ) : (
                      'Xác nhận lưu QR'
                    )}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={handleCancelPreview}
                    disabled={qrUploading}
                    id="btn-cancel-qr"
                  >
                    Hủy
                  </button>
                </>
              ) : qrImage ? (
                <>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    id="btn-change-qr"
                  >
                    Đổi ảnh khác
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleDeleteQR}
                    id="btn-delete-qr"
                  >
                    Xóa mã QR
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* ====== Danger Zone ====== */}
      <div className="profile-danger card">
        <h3>Phiên làm việc</h3>
        <p className="text-muted" style={{ marginBottom: 'var(--space-4)', fontSize: '0.85rem' }}>
          Đăng xuất khỏi tài khoản trên thiết bị này
        </p>
        <button className="btn btn-danger btn-sm" onClick={logout} id="btn-logout-profile">
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
