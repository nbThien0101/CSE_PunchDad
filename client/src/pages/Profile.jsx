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

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCancel = () => {
    setForm({
      displayName: user?.displayName || '',
      phone: user?.phone || '',
      bankInfo: user?.bankInfo || '',
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
      <h1 className="page-title">👤 Hồ sơ cá nhân</h1>
      <p className="page-subtitle">Quản lý thông tin tài khoản của bạn</p>

      {success && <div className="alert alert-success"><span>✅</span> {success}</div>}
      {error && <div className="alert alert-error"><span>❌</span> {error}</div>}

      {/* ====== Profile Info Card ====== */}
      <div className="profile-card card">
        <div className="profile-header">
          <div className="profile-avatar">
            {user?.displayName?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="profile-name">{user?.displayName}</h2>
            <span className="profile-username">@{user?.username}</span>
            {user?.role === 'ADMIN' && <span className="badge badge-admin" style={{ marginLeft: 8 }}>Admin</span>}
          </div>
          {!editing && (
            <button
              className="btn btn-outline btn-sm profile-edit-btn"
              onClick={() => setEditing(true)}
              id="btn-edit-profile"
            >
              ✏️ Chỉnh sửa
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSaveProfile} className="profile-edit-form animate-fade-in">
            <div className="form-group">
              <label className="form-label">📛 Tên hiển thị <span className="required">*</span></label>
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
              <label className="form-label">📱 Số điện thoại</label>
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
              <label className="form-label">🏦 Thông tin ngân hàng</label>
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
                  '💾 Lưu thay đổi'
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
              <span className="profile-field-label">📱 Số điện thoại</span>
              <span className="profile-field-value">{user?.phone || 'Chưa cập nhật'}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">🏦 Thông tin ngân hàng</span>
              <span className="profile-field-value">{user?.bankInfo || 'Chưa cập nhật'}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">🔑 Vai trò</span>
              <span className="profile-field-value">{user?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ====== QR Code Card ====== */}
      <div className="profile-qr-card card">
        <div className="profile-qr-header">
          <h3>📱 QR Code thanh toán</h3>
          <p className="text-muted">Ảnh mã QR để nhận thanh toán từ thành viên khác</p>
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
                <div className="qr-upload-icon">📷</div>
                <p className="qr-upload-text">Nhấn để chọn ảnh QR code</p>
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
                      <><span className="spinner spinner-sm"></span> Đang upload...</>
                    ) : (
                      '✅ Xác nhận upload'
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
                    🔄 Đổi ảnh
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleDeleteQR}
                    id="btn-delete-qr"
                  >
                    🗑️ Xóa
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* ====== Danger Zone ====== */}
      <div className="profile-danger card">
        <h3>⚠️ Khu vực nguy hiểm</h3>
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
