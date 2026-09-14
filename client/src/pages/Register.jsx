import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import './Auth.css';

export default function Register() {
  const [step, setStep] = useState(1); // 1 = form info, 2 = OTP verify
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    email: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef([]);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ====== Step 1: Submit info + send OTP ======
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError('');

    // 1. Kiểm tra Tên hiển thị
    if (!form.displayName.trim() || form.displayName.trim().length < 2) {
      setError('Tên hiển thị phải có ít nhất 2 ký tự');
      return;
    }

    // 2. Kiểm tra Tên đăng nhập
    const cleanUsername = form.username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      setError('Tên đăng nhập phải từ 3 đến 30 ký tự');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError('Tên đăng nhập chỉ được chứa chữ cái, chữ số và dấu gạch dưới (_)');
      return;
    }

    // 3. Kiểm tra Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError('Email không đúng định dạng');
      return;
    }

    // 4. Kiểm tra Mật khẩu
    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    // 5. Kiểm tra Số điện thoại (Chặn ngay lập tức nếu không hợp lệ!)
    const rawPhone = form.phone ? form.phone.trim() : '';
    let cleanPhone = undefined;
    if (rawPhone) {
      cleanPhone = rawPhone.replace(/[\s.-]/g, '');
      const phoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        setError('Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam gồm 10 chữ số (VD: 0901234567)');
        return;
      }
    }

    setLoading(true);
    try {
      const data = await authAPI.sendOTP({
        email: form.email.trim(),
        phone: cleanPhone,
        username: cleanUsername,
      });
      if (data.error) {
        setError(data.error);
      } else {
        setStep(2);
        setCountdown(60);
        // Auto focus first OTP input
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch {
      setError('Gửi mã OTP thất bại, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  // ====== OTP input handlers ======
  const handleOtpChange = (index, value) => {
    // Chỉ cho phép số
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Backspace: clear current and move to previous
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);

    // Focus appropriate input
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  // ====== Resend OTP ======
  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);

    try {
      const cleanEmail = form.email.trim();
      const cleanPhone = form.phone ? form.phone.trim().replace(/[\s.-]/g, '') : undefined;
      const data = await authAPI.sendOTP({
        email: cleanEmail,
        phone: cleanPhone,
        username: form.username.trim(),
      });
      if (data.error) {
        setError(data.error);
      } else {
        setCountdown(60);
        setVerificationToken('');
        setOtpDigits(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch {
      setError('Gửi lại mã thất bại');
    } finally {
      setLoading(false);
    }
  };

  // ====== Step 2: Verify OTP + Register ======
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError('');

    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = form.email.trim();
      let token = verificationToken;

      // Nếu chưa có token xác thực, gọi verifyOTP
      if (!token) {
        const verifyData = await authAPI.verifyOTP(cleanEmail, otp);
        if (verifyData.error) {
          setError(verifyData.error);
          setLoading(false);
          return;
        }
        token = verifyData.verificationToken;
        setVerificationToken(token);
      }

      // Step 2: Register với verificationToken
      await register({
        username: form.username.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
        email: cleanEmail,
        phone: form.phone ? form.phone.trim() : undefined,
        verificationToken: token,
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
          <img src="/logo.png" alt="CSE PunchDad" className="auth-logo-img" />
          <h1 className="auth-title">Tạo tài khoản</h1>
          <p className="auth-subtitle">Tham gia CLB CSE PunchDad</p>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>
            <span>1</span>
          </div>
          <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
          <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>
            <span>2</span>
          </div>
        </div>
        <div className="step-labels">
          <span className={step === 1 ? 'active' : ''}>Thông tin</span>
          <span className={step === 2 ? 'active' : ''}>Xác thực OTP</span>
        </div>

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

        {/* ====== STEP 1: Info Form ====== */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="auth-form">
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

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                className="form-input"
                placeholder="VD: email@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
              <span className="form-hint">Dùng để nhận mã xác thực OTP</span>
            </div>

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
              <label className="form-label" htmlFor="reg-confirm">Xác nhận mật khẩu</label>
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
              id="btn-send-otp"
            >
              {loading ? <span className="spinner spinner-sm"></span> : null}
              {loading ? 'Đang gửi mã...' : 'Tiếp theo →'}
            </button>
          </form>
        )}

        {/* ====== STEP 2: OTP Verification ====== */}
        {step === 2 && (
          <form onSubmit={handleVerifyAndRegister} className="auth-form">
            <div className="otp-section animate-fade-in">
              <div className="otp-email-display">
                <span className="otp-email-icon">📧</span>
                <div>
                  <p className="otp-email-text">Mã OTP đã được gửi đến</p>
                  <p className="otp-email-address">{form.email}</p>
                </div>
              </div>

              <div className="otp-inputs" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => otpRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`otp-input ${digit ? 'filled' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    id={`otp-input-${index}`}
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
                    id="btn-resend-otp"
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
                onClick={() => { setStep(1); setError(''); setOtpDigits(['', '', '', '', '', '']); }}
                disabled={loading}
                id="btn-back-step1"
              >
                ← Quay lại
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || otpDigits.join('').length !== 6}
                id="btn-verify-register"
                style={{ flex: 1 }}
              >
                {loading ? <span className="spinner spinner-sm"></span> : null}
                {loading ? 'Đang xác thực...' : 'Xác nhận đăng ký'}
              </button>
            </div>
          </form>
        )}

        <p className="auth-switch">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
