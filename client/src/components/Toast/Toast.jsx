import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.25 4.25L19 7" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
};

const TITLES = {
  success: 'Thao tác thành công',
  error: 'Có lỗi xảy ra',
};

export default function Toast({ message, type = 'success', onClose, duration = 4500 }) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => closeRef.current?.(), duration);
    return () => window.clearTimeout(timer);
  }, [message, type, duration]);

  if (!message) return null;

  return createPortal(
    <div className="toast-viewport" aria-live={type === 'error' ? 'assertive' : 'polite'}>
      <div className={`app-toast app-toast-${type}`} role={type === 'error' ? 'alert' : 'status'}>
        <span className="app-toast-accent" aria-hidden="true" />
        <span className="app-toast-icon">{ICONS[type]}</span>
        <span className="app-toast-content">
          <strong>{TITLES[type]}</strong>
          <span>{message}</span>
        </span>
        <button className="app-toast-close" type="button" onClick={onClose} aria-label="Đóng thông báo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
        <span className="app-toast-progress" style={{ '--toast-duration': `${duration}ms` }} aria-hidden="true" />
      </div>
    </div>,
    document.body,
  );
}
