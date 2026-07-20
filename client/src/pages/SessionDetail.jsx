import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionsAPI, votesAPI, paymentsAPI, usersAPI } from '../services/api';
import './SessionDetail.css';

const STATUS_CONFIG = {
  VOTING: { label: 'Đang vote', className: 'badge-voting', icon: '🗳️' },
  CONFIRMED: { label: 'Đủ người', className: 'badge-confirmed', icon: '✅' },
  BOOKED: { label: 'Đã đặt sân', className: 'badge-booked', icon: '📍' },
  COMPLETED: { label: 'Hoàn thành', className: 'badge-completed', icon: '🏁' },
  CANCELLED: { label: 'Đã hủy', className: 'badge-cancelled', icon: '❌' },
};

export default function SessionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [payerQR, setPayerQR] = useState(null);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [success, setSuccess] = useState('');

  // Admin booking form
  const [bookForm, setBookForm] = useState({
    totalCost: '',
    payerId: '',
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const sessionData = await sessionsAPI.getById(id);
      setSession(sessionData.session);

      if (['BOOKED', 'COMPLETED'].includes(sessionData.session?.status)) {
        const paymentData = await paymentsAPI.getBySession(id);
        setPayments(paymentData.payments || []);
        setPaymentSummary(paymentData.summary);

        // Fetch payer's QR code
        const payerId = sessionData.session?.payer?.id;
        if (payerId) {
          try {
            const qrData = await usersAPI.getQRCode(payerId);
            setPayerQR(qrData.qrCodeImage || null);
          } catch {
            // No QR code available — that's ok
          }
        }
      }
    } catch {
      setError('Không thể tải session');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (status) => {
    setActionLoading('vote');
    try {
      const result = await votesAPI.cast({ sessionId: id, status });
      setSuccess(result.message);
      await fetchData();
    } catch {
      setError('Vote thất bại');
    } finally {
      setActionLoading('');
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!bookForm.totalCost || !bookForm.payerId) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    setActionLoading('book');
    try {
      await sessionsAPI.update(id, {
        status: 'BOOKED',
        totalCost: parseFloat(bookForm.totalCost),
        payerId: bookForm.payerId,
      });
      setSuccess('Đặt sân thành công!');
      await fetchData();
    } catch {
      setError('Đặt sân thất bại');
    } finally {
      setActionLoading('');
    }
  };

  const handleMarkPaid = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await paymentsAPI.markAsPaid(paymentId);
      setSuccess('Đã đánh dấu chuyển tiền');
      await fetchData();
    } catch {
      setError('Thao tác thất bại');
    } finally {
      setActionLoading('');
    }
  };

  const handleConfirmPayment = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      const result = await paymentsAPI.confirm(paymentId);
      setSuccess(result.message);
      await fetchData();
    } catch {
      setError('Xác nhận thất bại');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Bạn chắc chắn muốn hủy session này?')) return;
    setActionLoading('cancel');
    try {
      await sessionsAPI.delete(id);
      setSuccess('Session đã hủy');
      await fetchData();
    } catch {
      setError('Hủy thất bại');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner"></div><p>Đang tải...</p></div>;
  }

  if (!session) {
    return <div className="empty-state"><p>Session không tồn tại</p></div>;
  }

  const config = STATUS_CONFIG[session.status];
  const joinedVotes = session.votes?.filter(v => v.status === 'JOIN') || [];
  const declinedVotes = session.votes?.filter(v => v.status === 'DECLINE') || [];
  const maybeVotes = session.votes?.filter(v => v.status === 'MAYBE') || [];
  const userVote = session.votes?.find(v => v.user?.id === user?.id);
  const isAdmin = user?.role === 'ADMIN';
  const isPayer = session.payer?.id === user?.id;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="session-detail animate-fade-in">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} id="btn-back">
        ← Quay lại
      </button>

      {/* Header */}
      <div className="detail-header">
        <div>
          <span className={`badge ${config.className}`}>{config.icon} {config.label}</span>
          <h1 className="detail-title">{session.title}</h1>
          <p className="detail-creator">Tạo bởi {session.createdBy?.displayName}</p>
        </div>
        {isAdmin && !['COMPLETED', 'CANCELLED'].includes(session.status) && (
          <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={actionLoading === 'cancel'}>
            {actionLoading === 'cancel' ? 'Đang hủy...' : '❌ Hủy session'}
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && <div className="alert alert-error"><span>⚠️</span> {error} <button onClick={() => setError('')}>✕</button></div>}
      {success && <div className="alert alert-success"><span>✅</span> {success} <button onClick={() => setSuccess('')}>✕</button></div>}

      {/* Info Grid */}
      <div className="detail-info-grid">
        <div className="info-block">
          <span className="info-block-icon">📅</span>
          <div>
            <span className="info-block-label">Ngày chơi</span>
            <span className="info-block-value">{formatDate(session.playDate)}</span>
          </div>
        </div>
        <div className="info-block">
          <span className="info-block-icon">⏰</span>
          <div>
            <span className="info-block-label">Thời gian</span>
            <span className="info-block-value">{session.startTime} - {session.endTime}</span>
          </div>
        </div>
        <div className="info-block">
          <span className="info-block-icon">📍</span>
          <div>
            <span className="info-block-label">Địa điểm</span>
            <span className="info-block-value">{session.location}</span>
          </div>
        </div>
        <div className="info-block">
          <span className="info-block-icon">👥</span>
          <div>
            <span className="info-block-label">Số người</span>
            <span className="info-block-value">{joinedVotes.length} / {session.minPlayers} (tối đa {session.maxPlayers})</span>
          </div>
        </div>
      </div>

      {/* Vote Section */}
      {session.status === 'VOTING' && (
        <div className="detail-section">
          <h2 className="section-title">🗳️ Vote của bạn</h2>
          <div className="vote-actions">
            {['JOIN', 'DECLINE', 'MAYBE'].map(status => (
              <button
                key={status}
                className={`btn ${
                  status === 'JOIN' ? 'btn-success' :
                  status === 'DECLINE' ? 'btn-danger' : 'btn-warning'
                } ${userVote?.status === status ? '' : 'btn-outline'}`}
                onClick={() => handleVote(status)}
                disabled={actionLoading === 'vote'}
              >
                {status === 'JOIN' ? '👍 Tham gia' :
                 status === 'DECLINE' ? '👎 Không đi' : '🤔 Có thể'}
                {userVote?.status === status && ' ✓'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Votes List */}
      <div className="detail-section">
        <h2 className="section-title">👥 Danh sách vote ({session.votes?.length || 0})</h2>
        <div className="votes-table">
          {joinedVotes.length > 0 && (
            <div className="vote-group">
              <h3 className="vote-group-title">👍 Tham gia ({joinedVotes.length})</h3>
              <div className="vote-list">
                {joinedVotes.map(v => (
                  <span key={v.id} className="vote-chip vote-chip-join">{v.user?.displayName}</span>
                ))}
              </div>
            </div>
          )}
          {maybeVotes.length > 0 && (
            <div className="vote-group">
              <h3 className="vote-group-title">🤔 Có thể ({maybeVotes.length})</h3>
              <div className="vote-list">
                {maybeVotes.map(v => (
                  <span key={v.id} className="vote-chip vote-chip-maybe">{v.user?.displayName}</span>
                ))}
              </div>
            </div>
          )}
          {declinedVotes.length > 0 && (
            <div className="vote-group">
              <h3 className="vote-group-title">👎 Không đi ({declinedVotes.length})</h3>
              <div className="vote-list">
                {declinedVotes.map(v => (
                  <span key={v.id} className="vote-chip vote-chip-decline">{v.user?.displayName}</span>
                ))}
              </div>
            </div>
          )}
          {!session.votes?.length && <p className="text-muted">Chưa có ai vote</p>}
        </div>
      </div>

      {/* Admin: Book Session */}
      {isAdmin && session.status === 'CONFIRMED' && (
        <div className="detail-section">
          <h2 className="section-title">📝 Đặt sân (Admin)</h2>
          <form className="book-form" onSubmit={handleBook}>
            <div className="form-group">
              <label className="form-label" htmlFor="total-cost">Tổng tiền sân (VNĐ)</label>
              <input
                id="total-cost"
                type="number"
                className="form-input"
                placeholder="VD: 500000"
                value={bookForm.totalCost}
                onChange={(e) => setBookForm(prev => ({ ...prev, totalCost: e.target.value }))}
                required
              />
              {bookForm.totalCost && joinedVotes.length > 0 && (
                <span className="form-hint">
                  ≈ {Math.round(parseFloat(bookForm.totalCost) / joinedVotes.length).toLocaleString('vi-VN')}đ / người
                </span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="payer-select">Người thanh toán</label>
              <select
                id="payer-select"
                className="form-input"
                value={bookForm.payerId}
                onChange={(e) => setBookForm(prev => ({ ...prev, payerId: e.target.value }))}
                required
              >
                <option value="">-- Chọn người thanh toán --</option>
                {joinedVotes.map(v => (
                  <option key={v.user?.id} value={v.user?.id}>{v.user?.displayName}</option>
                ))}
                <option value={user?.id}>{user?.displayName} (Admin)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={actionLoading === 'book'}>
              {actionLoading === 'book' ? 'Đang xử lý...' : '📍 Xác nhận đặt sân'}
            </button>
          </form>
        </div>
      )}

      {/* Payment Section */}
      {['BOOKED', 'COMPLETED'].includes(session.status) && (
        <div className="detail-section">
          <h2 className="section-title">💰 Thanh toán</h2>

          {session.payer && (
            <div className="payer-info">
              <div className="payer-header">
                <span className="payer-avatar">{session.payer.displayName?.[0]?.toUpperCase()}</span>
                <div>
                  <span className="payer-name">Người nhận tiền: <strong>{session.payer.displayName}</strong></span>
                  {session.payer.bankInfo && (
                    <span className="payer-bank">🏦 {session.payer.bankInfo}</span>
                  )}
                  {session.payer.phone && (
                    <span className="payer-phone">📱 {session.payer.phone}</span>
                  )}
                </div>
              </div>
              <div className="payer-total">
                Tổng: <strong>{Number(session.totalCost).toLocaleString('vi-VN')}đ</strong>
                <span className="cost-per-person">
                  ({Math.round(Number(session.totalCost) / (joinedVotes.length || 1)).toLocaleString('vi-VN')}đ/người)
                </span>
              </div>

              {/* QR Code thanh toán */}
              {payerQR ? (
                <div className="payer-qr-section">
                  <div className="payer-qr-divider"></div>
                  <button
                    className="payer-qr-toggle"
                    onClick={() => setQrExpanded(prev => !prev)}
                    id="btn-toggle-payer-qr"
                  >
                    <span>📱 Mã QR thanh toán</span>
                    <span className={`payer-qr-arrow ${qrExpanded ? 'expanded' : ''}`}>▾</span>
                  </button>
                  {qrExpanded && (
                    <div className="payer-qr-container animate-fade-in">
                      <img
                        src={payerQR}
                        alt={`QR Code - ${session.payer.displayName}`}
                        className="payer-qr-image"
                      />
                      <p className="payer-qr-hint">
                        Quét mã QR để chuyển tiền cho <strong>{session.payer.displayName}</strong>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="payer-qr-section">
                  <div className="payer-qr-divider"></div>
                  <p className="payer-qr-empty">💡 Người nhận tiền chưa cập nhật mã QR thanh toán</p>
                </div>
              )}
            </div>
          )}

          {paymentSummary && (
            <div className="payment-summary">
              <span className="badge badge-confirmed">✅ {paymentSummary.confirmed} confirmed</span>
              <span className="badge badge-paid">💳 {paymentSummary.paid} paid</span>
              <span className="badge badge-pending">⏳ {paymentSummary.pending} pending</span>
            </div>
          )}

          <div className="payment-list">
            {payments.map(p => (
              <div key={p.id} className={`payment-item payment-${p.status.toLowerCase()}`}>
                <div className="payment-user">
                  <span className="payment-avatar">{p.user?.displayName?.[0]?.toUpperCase()}</span>
                  <div>
                    <span className="payment-name">{p.user?.displayName}</span>
                    <span className="payment-amount">{Number(p.amount).toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
                <div className="payment-actions">
                  <span className={`badge badge-${p.status.toLowerCase()}`}>
                    {p.status === 'PENDING' ? '⏳ Chưa trả' :
                     p.status === 'PAID' ? '💳 Đã chuyển' : '✅ Đã xác nhận'}
                  </span>

                  {/* User can mark their own payment as paid */}
                  {p.status === 'PENDING' && p.user?.id === user?.id && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleMarkPaid(p.id)}
                      disabled={actionLoading === p.id}
                    >
                      {actionLoading === p.id ? '...' : '💳 Đã chuyển tiền'}
                    </button>
                  )}

                  {/* Payer or admin can confirm */}
                  {p.status === 'PAID' && (isPayer || isAdmin) && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConfirmPayment(p.id)}
                      disabled={actionLoading === p.id}
                    >
                      {actionLoading === p.id ? '...' : '✅ Xác nhận nhận tiền'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
