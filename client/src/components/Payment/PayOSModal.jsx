import { useState, useEffect, useRef } from 'react';
import Modal from '../Modal/Modal';
import { paymentsAPI } from '../../services/api';
import './PayOSModal.css';

export default function PayOSModal({ payment, session, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [payData, setPayData] = useState(null);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [checkingManual, setCheckingManual] = useState(false);

  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (!payment?.id) return;
    initPaymentLink();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [payment?.id]);

  // Khởi tạo link thanh toán PayOS
  const initPaymentLink = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await paymentsAPI.createPayOSLink(payment.id);

      if (res.status === 'CONFIRMED') {
        handlePaidSuccess();
        return;
      }

      setPayData(res);

      // Bắt đầu polling kiểm tra trạng thái mỗi 2.5 giây
      startPolling(payment.id);
    } catch (err) {
      console.error('Init PayOS Error:', err);
      setError(err?.message || 'Không thể tạo link thanh toán PayOS');
    } finally {
      setLoading(false);
    }
  };

  // Polling kiểm tra trạng thái giao dịch
  const startPolling = (paymentId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await paymentsAPI.getPayOSStatus(paymentId);
        if (res.status === 'CONFIRMED' || res.isPaid) {
          handlePaidSuccess();
        }
      } catch (err) {
        // Silent poll error
      }
    }, 2500);
  };

  const handlePaidSuccess = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsSuccess(true);
    setTimeout(() => {
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    }, 2500);
  };

  // Nút kiểm tra thủ công
  const handleCheckManual = async () => {
    setCheckingManual(true);
    try {
      const res = await paymentsAPI.getPayOSStatus(payment.id);
      if (res.status === 'CONFIRMED' || res.isPaid) {
        handlePaidSuccess();
      } else {
        alert('Hệ thống chưa nhận được tiền từ ngân hàng. Nếu bạn vừa chuyển, vui lòng đợi 5-10 giây để ngân hàng xử lý nhé!');
      }
    } catch (err) {
      alert('Lỗi kiểm tra: ' + (err.message || 'Không thể kết nối'));
    } finally {
      setCheckingManual(false);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // Tạo URL ảnh VietQR chuẩn
  const getVietQRImageUrl = () => {
    if (!payData) return '';
    const bin = payData.bin || '970422'; // Default MBBank
    const acc = payData.accountNumber || '';
    const amt = payData.amount || Number(payment.amount);
    const desc = payData.description || `CSE ${payment.id.slice(0, 6)}`;
    const name = payData.accountName || '';

    return `https://api.vietqr.io/image/${bin}-${acc}-compact2.png?amount=${amt}&addInfo=${encodeURIComponent(desc)}&accountName=${encodeURIComponent(name)}`;
  };

  return (
    <Modal isOpen={true} onClose={onClose} closeOnBackdrop={!isSuccess}>
      <div className="payos-modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="payos-modal-header">
          <div>
            <span className="payos-badge">⚡ VietQR · PayOS Tự Động</span>
            <h2 className="payos-modal-title">Thanh toán tiền sân bóng</h2>
            <p className="payos-modal-subtitle">
              {session?.title || 'Trận đấu CSE PunchDad'}
            </p>
          </div>
          {!isSuccess && (
            <button className="payos-close-btn" onClick={onClose} aria-label="Đóng">
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="payos-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <span className="spinner"></span> Đang tạo mã VietQR thanh toán...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <span>{error}</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={initPaymentLink}>
                Thử lại
              </button>
            </div>
          ) : isSuccess ? (
            /* Celebration Success State */
            <div className="payos-success-view">
              <div className="payos-success-icon">✓</div>
              <h3 className="payos-success-title">Thanh toán thành công!</h3>
              <p className="payos-success-desc">
                Hệ thống PayOS đã tự động gạch nợ cho bạn. Trận đấu đã được cập nhật.
              </p>
            </div>
          ) : (
            <>
              {/* Amount Highlight */}
              <div className="payos-amount-card">
                <span className="payos-amount-label">Số tiền cần chuyển:</span>
                <span className="payos-amount-value">
                  {Number(payData?.amount || payment.amount).toLocaleString('vi-VN')}đ
                </span>
              </div>

              {/* QR Code Container */}
              <div className="payos-qr-container">
                <div className="payos-qr-image-wrapper">
                  <img
                    src={getVietQRImageUrl()}
                    alt="VietQR PayOS"
                    className="payos-qr-image"
                  />
                </div>

                <div className="payos-live-status">
                  <span className="payos-pulse-dot"></span>
                  <span>Đang chờ chuyển khoản... (Tự động nhận diện)</span>
                </div>
              </div>

              {/* Transfer Details */}
              <div className="payos-details-list">
                <div className="payos-detail-row">
                  <span className="payos-detail-key">Chủ tài khoản:</span>
                  <span className="payos-detail-val">{payData?.accountName || 'NGUYEN BAO THIEN'}</span>
                </div>

                <div className="payos-detail-row">
                  <span className="payos-detail-key">Số tài khoản:</span>
                  <span className="payos-detail-val">
                    <strong>{payData?.accountNumber}</strong>
                    <button
                      className="btn-copy-chip"
                      onClick={() => handleCopy(payData?.accountNumber, 'acc')}
                      title="Sao chép số tài khoản"
                    >
                      {copiedKey === 'acc' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </span>
                </div>

                <div className="payos-detail-row">
                  <span className="payos-detail-key">Nội dung chuyển khoản:</span>
                  <span className="payos-detail-val">
                    <span className="payos-memo-highlight">{payData?.description}</span>
                    <button
                      className="btn-copy-chip"
                      onClick={() => handleCopy(payData?.description, 'desc')}
                      title="Sao chép nội dung"
                    >
                      {copiedKey === 'desc' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </span>
                </div>
              </div>

              <p className="payos-notice-text">
                ⚠️ Vui lòng giữ <strong>đúng nội dung chuyển khoản</strong> trên để hệ thống ngân hàng tự động nhận diện và gạch nợ tức thì.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && !isSuccess && (
          <div className="payos-modal-footer">
            {payData?.checkoutUrl ? (
              <a
                href={payData.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-open-payos-web"
              >
                🔗 Mở trang PayOS
              </a>
            ) : (
              <div></div>
            )}

            <button
              className="btn-check-payos-manual"
              onClick={handleCheckManual}
              disabled={checkingManual}
            >
              {checkingManual ? 'Đang kiểm tra...' : '⚡ Đã chuyển (Kiểm tra)'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
