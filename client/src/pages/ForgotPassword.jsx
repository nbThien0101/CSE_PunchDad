import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Auth.css';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1 = input email, 2 = verify OTP, 3 = new password, 4 = success
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef([]);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // ====== BƯỚC 1: Gửi OTP ======
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError('');

    const input = emailOrUsername.trim();
    if (!input) {
      setError('Vui lòng nhập Email hoặc Tên đăng nhập');
      return;
    }

    setLoading(true);
    try {
      const data = await authAPI.forgotPasswordSendOTP(input);
      if (data.error) {
        setError(data.error);
      } else {
        setResolvedEmail(data.email);
        setMaskedEmail(data.maskedEmail || data.email);
        setStep(2);
        setCountdown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ====== OTP input handlers ======
  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);

    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  // ====== Gửi lại OTP ======
  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);

    try {
      const data = await authAPI.forgotPasswordSendOTP(resolvedEmail);
      if (data.error) {
        setError(data.error);
      } else {
        setCountdown(60);
        setOtpDigits(['', '', '', '', '', '']);
        setResetToken('');
        otpRefs.current[0]?.focus();
      }
    } catch {
      setError('Gửi lại mã OTP thất bại');
    } finally {
      setLoading(false);
    }
  };

  // ====== BƯỚC 2: Xác thực OTP ======
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }

    setLoading(true);
    try {
      const data = await authAPI.forgotPasswordVerifyOTP(resolvedEmail, otp);
      if (data.error) {
        setError(data.error);
      } else {
        setResetToken(data.resetToken);
        setStep(3);
      }
    } catch {
      setError('Xác thực OTP thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ====== BƯỚC 3: Đặt lại mật khẩu ======
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      const data = await authAPI.resetPassword({
        email: resolvedEmail,
        resetToken,
        newPassword,
      });

      if (data.error) {
        setError(data.error);
      } else {
        setSuccessMsg(data.message || 'Đặt lại mật khẩu thành công!');
        setStep(4);
      }
    } catch {
      setError('Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-slide-up">
        <div className="auth-header">
          <img src="/logo.png" alt="CSE PunchDad" className="auth-logo-img" />
          <h1 className="auth-title">Quên mật khẩu</h1>
          <p className="auth-subtitle">Khôi phục quyền truy cập vào tài khoản CLB</p>
        </div>

        {/* Step Indicator (1 -> 2 -> 3) */}
        {step <= 3 && (
          <>
            <div className="step-indicator">
              <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>
                <span>1</span>
              </div>
              <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
              <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>
                <span>2</span>
              </div>
              <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
              <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>
                <span>3</span>
              </div>
            </div>
            <div className="step-labels" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <span className={step === 1 ? 'active' : ''}>Tìm tài khoản</span>
              <span className={step === 2 ? 'active' : ''}>Xác thực OTP</span>
              <span className={step === 3 ? 'active' : ''}>Mật khẩu mới</span>
            </div>
          </>
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

        {/* ====== STEP 1: Nhập Email hoặc Username ====== */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="forgot-input">
                Email hoặc Tên đăng nhập
              </label>
              <input
                id="forgot-input"
                type="text"
                className="form-input"
                placeholder="Nhập email hoặc username đã đăng ký..."
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
                autoFocus
              />
              <span className="form-hint" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Hệ thống sẽ gửi mã xác thực 6 số đến email gắn liền với tài khoản của bạn.
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={loading}
              id="btn-forgot-send-otp"
            >
              {loading ? <span className="spinner spinner-sm"></span> : null}
              {loading ? 'Đang kiểm tra & gửi mã...' : 'Gửi mã xác nhận →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Link to="/login" className="btn btn-ghost btn-sm">
                ← Quay lại đăng nhập
              </Link>
            </div>
          </form>
        )}

        {/* ====== STEP 2: Nhập OTP ====== */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="auth-form">
            <div className="otp-section animate-fade-in">
              <div className="otp-email-display">
                <span className="otp-email-icon">📧</span>
                <div>
                  <p className="otp-email-text">Mã xác nhận đã gửi đến</p>
                  <p className="otp-email-address">{maskedEmail}</p>
                </div>
              </div>

              <div className="otp-inputs" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`otp-input ${digit ? 'filled' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    id={`forgot-otp-input-${index}`}
                  />
                ))}
              </div>

              <div className="otp-resend">
                {countdown > 0 ? (
                  <span className="otp-countdown">
                    Gửi lại mã sau <strong>{countdown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleResendOTP}
                    disabled={loading}
                    id="btn-forgot-resend-otp"
                  >
                    🔄 Gửi lại mã OTP
                  </button>
                )}
              </div>
            </div>

            <div className="otp-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setStep(1);
                  setError('');
                  setOtpDigits(['', '', '', '', '', '']);
                }}
                disabled={loading}
                id="btn-forgot-back-step1"
              >
                ← Quay lại
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || otpDigits.join('').length !== 6}
                id="btn-forgot-verify-otp"
              >
                {loading ? <span className="spinner spinner-sm"></span> : null}
                {loading ? 'Đang xác thực...' : 'Xác thực OTP →'}
              </button>
            </div>
          </form>
        )}

        {/* ====== STEP 3: Mật khẩu mới ====== */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="auth-form animate-fade-in">
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">
                Mật khẩu mới
              </label>
              <div className="password-input-wrapper">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input password-input"
                  placeholder="Tối thiểu 6 ký tự..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="2" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-new-password">
                Xác nhận mật khẩu mới
              </label>
              <div className="password-input-wrapper">
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input password-input"
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="2" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={loading}
              id="btn-submit-reset-password"
            >
              {loading ? <span className="spinner spinner-sm"></span> : null}
              {loading ? 'Đang đổi mật khẩu...' : 'Lưu mật khẩu mới'}
            </button>
          </form>
        )}

        {/* ====== STEP 4: Thành công ====== */}
        {step === 4 && (
          <div className="auth-form animate-fade-in" style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '2rem'
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Đặt lại mật khẩu thành công!
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {successMsg || 'Mật khẩu của bạn đã được cập nhật. Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay.'}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => navigate('/login')}
              id="btn-go-to-login"
            >
              Đăng nhập ngay →
            </button>
          </div>
        )}

        {step < 4 && (
          <p className="auth-switch">
            Nhớ lại mật khẩu? <Link to="/login">Đăng nhập</Link>
          </p>
        )}
      </div>
    </div>
  );
}
