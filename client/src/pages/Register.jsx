import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: form.username,
        password: form.password,
        displayName: form.displayName,
        phone: form.phone || undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-slide-up">
        <div className="auth-header">
          <span className="auth-icon">⚽</span>
          <h1 className="auth-title">Tạo tài khoản</h1>
          <p className="auth-subtitle">Tham gia CLB CSE PunchDad</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="reg-displayname">Tên hiển thị</label>
            <input
              id="reg-displayname"
              name="displayName"
              type="text"
              className="form-input"
              placeholder="VD: Nguyen Van A"
              value={form.displayName}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-username">Tên đăng nhập</label>
            <input
              id="reg-username"
              name="username"
              type="text"
              className="form-input"
              placeholder="VD: nguyenvana"
              value={form.username}
              onChange={handleChange}
              required
              autoComplete="username"
            />
            <span className="form-hint">3-30 ký tự, chỉ chữ và số</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Mật khẩu</label>
              <input
                id="reg-password"
                name="password"
                type="password"
                className="form-input"
                placeholder="Ít nhất 6 ký tự"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Xác nhận</label>
              <input
                id="reg-confirm"
                name="confirmPassword"
                type="password"
                className="form-input"
                placeholder="Nhập lại mật khẩu"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-phone">Số điện thoại <span className="text-muted">(tùy chọn)</span></label>
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              className="form-input"
              placeholder="VD: 0901234567"
              value={form.phone}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            disabled={loading}
            id="btn-register"
          >
            {loading ? <span className="spinner spinner-sm"></span> : null}
            {loading ? 'Đang tạo...' : 'Đăng ký'}
          </button>
        </form>

        <p className="auth-switch">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
