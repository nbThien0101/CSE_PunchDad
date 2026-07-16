import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import './Profile.css';

export default function Profile() {
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    phone: user?.phone || '',
    bankInfo: user?.bankInfo || '',
  });
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="profile-page animate-fade-in">
      <h1 className="page-title">👤 Hồ sơ cá nhân</h1>
      <p className="page-subtitle">Quản lý thông tin tài khoản của bạn</p>

      {success && <div className="alert alert-success"><span>✅</span> {success}</div>}

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
        </div>

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
      </div>

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
