import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionsAPI, votesAPI, paymentsAPI, usersAPI } from '../services/api';
import TeamGeneratorModal from '../components/TeamGenerator/TeamGeneratorModal';
import Modal from '../components/Modal/Modal';
import './SessionDetail.css';

const STATUS_CONFIG = {
  VOTING: { label: 'Đang bình chọn', className: 'badge-voting' },
  CONFIRMED: { label: 'Đủ người chơi', className: 'badge-confirmed' },
  BOOKED: { label: 'Đã đặt sân', className: 'badge-booked' },
  COMPLETED: { label: 'Đã hoàn thành', className: 'badge-completed' },
  CANCELLED: { label: 'Đã hủy', className: 'badge-cancelled' },
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

  // Admin edit session state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTeamGenModal, setShowTeamGenModal] = useState(false);
  const [autoRebalance, setAutoRebalance] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    playDate: '',
    startTime: '',
    endTime: '',
    location: '',
    minPlayers: 6,
    maxPlayers: 14,
    status: 'VOTING',
    totalCost: '',
    voteDeadline: '',
  });
  const [editLoading, setEditLoading] = useState(false);

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

  const handleForceDelete = async () => {
    if (!window.confirm('Bạn chắc chắn muốn XÓA VĨNH VIỄN session này?\n\nTất cả dữ liệu (votes, payments) sẽ bị xóa và KHÔNG THỂ khôi phục!')) return;
    if (!window.confirm('Xác nhận lần cuối: Xóa vĩnh viễn session này?')) return;
    setActionLoading('forceDelete');
    try {
      await sessionsAPI.forceDelete(id);
      navigate('/');
    } catch {
      setError('Xóa thất bại');
    } finally {
      setActionLoading('');
    }
  };

  const handleDeleteTeams = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy danh sách đội đã chia?')) return;
    setActionLoading('deleteTeams');
    try {
      const res = await sessionsAPI.deleteTeams(id);
      setSession(res.session);
      setSuccess('Đã hủy danh sách đội thi đấu');
      setTimeout(() => setSuccess(''), 2500);
    } catch {
      setError('Hủy chia đội thất bại');
    } finally {
      setActionLoading('');
    }
  };

  // ====== Admin Edit Session Handlers ======
  const handleOpenEdit = () => {
    const playDateStr = session.playDate ? new Date(session.playDate).toISOString().split('T')[0] : '';
    let voteDeadlineStr = '';
    if (session.voteDeadline) {
      const d = new Date(session.voteDeadline);
      const tzOffset = d.getTimezoneOffset() * 60000;
      voteDeadlineStr = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    }

    setEditForm({
      title: session.title || '',
      playDate: playDateStr,
      startTime: session.startTime || '17:00',
      endTime: session.endTime || '19:00',
      location: session.location || '',
      minPlayers: session.minPlayers ?? 6,
      maxPlayers: session.maxPlayers ?? 14,
      status: session.status || 'VOTING',
      totalCost: session.totalCost ? String(session.totalCost) : '',
      voteDeadline: voteDeadlineStr,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setError('');

    try {
      const payload = {
        title: editForm.title.trim(),
        playDate: editForm.playDate,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        location: editForm.location.trim(),
        minPlayers: parseInt(editForm.minPlayers, 10),
        maxPlayers: parseInt(editForm.maxPlayers, 10),
        status: editForm.status,
        voteDeadline: editForm.voteDeadline ? new Date(editForm.voteDeadline).toISOString() : null,
      };

      if (editForm.totalCost !== '') {
        payload.totalCost = parseFloat(editForm.totalCost);
      }

      const res = await sessionsAPI.update(id, payload);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess('Cập nhật thông tin session thành công!');
        setShowEditModal(false);
        await fetchData();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Cập nhật session thất bại, vui lòng thử lại');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner"></div><p>Đang tải...</p></div>;
  }

  if (!session) {
    return <div className="empty-state"><p>Session không tồn tại</p></div>;
  }

  const config = STATUS_CONFIG[session.status] || STATUS_CONFIG.VOTING;
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
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Quay lại
      </button>

      {/* Header */}
      <div className="detail-header">
        <div>
          <span className={`badge ${config.className}`}>
            <span className="badge-dot"></span>
            {config.label}
          </span>
          <h1 className="detail-title">{session.title}</h1>
          <p className="detail-creator">Tạo bởi {session.createdBy?.displayName}</p>
        </div>
        <div className="detail-header-actions">
          {isAdmin && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setAutoRebalance(Boolean(session.teams));
                setShowTeamGenModal(true);
              }}
              id="btn-open-team-gen-header"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
              {session.teams ? 'Chia lại đội' : 'Chia đội'}
            </button>
          )}
          {isAdmin && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleOpenEdit}
              id="btn-edit-session"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Chỉnh sửa
            </button>
          )}
          {isAdmin && !['COMPLETED', 'CANCELLED'].includes(session.status) && (
            <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={actionLoading === 'cancel'} id="btn-cancel-session">
              {actionLoading === 'cancel' ? 'Đang hủy...' : 'Hủy trận đấu'}
            </button>
          )}
          {isAdmin && (
            <button
              className="btn btn-danger-solid btn-sm"
              onClick={handleForceDelete}
              disabled={actionLoading === 'forceDelete'}
              id="btn-force-delete-session"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              {actionLoading === 'forceDelete' ? 'Đang xóa...' : 'Xóa trận đấu'}
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>✕</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{success}</span>
          <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>✕</button>
        </div>
      )}

      {/* Info Grid */}
      <div className="detail-info-grid">
        <div className="info-block">
          <span className="info-block-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </span>
          <div>
            <span className="info-block-label">Ngày thi đấu</span>
            <span className="info-block-value">{formatDate(session.playDate)}</span>
          </div>
        </div>
        <div className="info-block">
          <span className="info-block-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </span>
          <div>
            <span className="info-block-label">Khung giờ</span>
            <span className="info-block-value">{session.startTime} - {session.endTime}</span>
          </div>
        </div>
        <div className="info-block">
          <span className="info-block-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </span>
          <div>
            <span className="info-block-label">Địa điểm sân</span>
            <span className="info-block-value">{session.location}</span>
          </div>
        </div>
        <div className="info-block">
          <span className="info-block-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </span>
          <div>
            <span className="info-block-label">Số người tham gia</span>
            <span className="info-block-value">{joinedVotes.length} / {session.minPlayers} (tối đa {session.maxPlayers})</span>
          </div>
        </div>
      </div>

      {/* Vote Section */}
      {session.status === 'VOTING' && (
        <div className="detail-section">
          <h2 className="section-title">Bình chọn tham gia</h2>
          <div className="vote-actions">
            {[
              { id: 'JOIN', label: 'Tham gia', btnClass: 'btn-success' },
              { id: 'MAYBE', label: 'Cân nhắc', btnClass: 'btn-warning' },
              { id: 'DECLINE', label: 'Báo vắng', btnClass: 'btn-danger' },
            ].map(item => (
              <button
                key={item.id}
                className={`btn ${item.btnClass} ${userVote?.status === item.id ? '' : 'btn-outline'}`}
                onClick={() => handleVote(item.id)}
                disabled={actionLoading === 'vote'}
              >
                {item.id === 'JOIN' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
                {item.id === 'DECLINE' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                )}
                {item.label}
                {userVote?.status === item.id && ' (Đã chọn)'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Match Teams Section */}
      {session.teams && session.teams.teams && (
        <div className="detail-section match-teams-section">
          <div className="match-teams-header">
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>
                Đội hình thi đấu ({session.teams.teamCount} đội)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Đã cân bằng theo Tier · 5 người/đội · Cập nhật lúc {new Date(session.teams.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setAutoRebalance(true);
                    setShowTeamGenModal(true);
                  }}
                  id="btn-rebalance-teams"
                >
                  Chia lại
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#ef4444' }}
                  onClick={handleDeleteTeams}
                  disabled={actionLoading === 'deleteTeams'}
                  id="btn-delete-teams"
                >
                  Hủy chia đội
                </button>
              </div>
            )}
          </div>

          <div className="match-teams-grid">
            {session.teams.teams.map((t) => (
              <div key={t.id} className="match-team-card" style={{ borderTop: `4px solid ${t.color}` }}>
                <div className="match-team-header" style={{ background: t.bg }}>
                  <span className="match-team-name" style={{ color: t.color }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }}></span>
                    {t.name}
                  </span>
                  <span className="match-team-badge">
                    {t.totalTierScore} pts · TB {t.averageTierScore}
                  </span>
                </div>

                <div className="match-team-roster">
                  {/* Goalkeeper */}
                  {t.goalkeeper && (
                    <div className="match-player-row is-gk">
                      <div className="match-player-info">
                        <span className="match-player-avatar">
                          {t.goalkeeper.avatar ? <img src={t.goalkeeper.avatar} alt="" /> : t.goalkeeper.displayName?.[0]}
                        </span>
                        <span className="match-player-name">{t.goalkeeper.displayName}</span>
                      </div>
                      <div className="match-player-tags">
                        {t.goalkeeper.tier && (
                          <span className={`badge member-tier-badge tier-${t.goalkeeper.tier.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                            {t.goalkeeper.tier}
                          </span>
                        )}
                        {t.goalkeeper.isShared ? (
                          <span className="badge-shared-gk" title={`Luân phiên từ ${t.goalkeeper.sharedFrom || ''}`}>
                            GK Luân phiên
                          </span>
                        ) : (
                          <span className="badge-gk">Thủ môn</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4 Outfield Players */}
                  {t.players?.map((p) => (
                    <div key={p.userId} className="match-player-row">
                      <div className="match-player-info">
                        <span className="match-player-avatar">
                          {p.avatar ? <img src={p.avatar} alt="" /> : p.displayName?.[0]}
                        </span>
                        <span className="match-player-name">{p.displayName}</span>
                      </div>
                      <div className="match-player-tags">
                        {p.tier && (
                          <span className={`badge member-tier-badge tier-${p.tier.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                            {p.tier}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Reserves if any */}
          {session.teams.reserves?.length > 0 && (
            <div className="match-reserves-container">
              <span className="match-reserves-label">
                Dự bị ({session.teams.reserves.length} người):
              </span>
              <div className="match-reserves-chips">
                {session.teams.reserves.map(r => (
                  <span key={r.userId} className="match-reserve-chip">
                    #{r.reserveOrder} {r.displayName} {r.tier ? `(${r.tier})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite box when no teams yet */}
      {!session.teams && isAdmin && (
        <div className="detail-section team-gen-invite card">
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Chia đội hình thi đấu (5 người/đội)
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0' }}>
              {joinedVotes.length >= 4
                ? `Đã có ${joinedVotes.length} thành viên tham gia. Bạn có thể tự động cân bằng đội hình theo Tier và vị trí Thủ môn ngay bây giờ.`
                : `Hiện có ${joinedVotes.length} người tham gia. Bạn có thể mở công cụ để xem danh sách hoặc chia đội.`}
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setAutoRebalance(false);
              setShowTeamGenModal(true);
            }}
            id="btn-open-team-gen-banner"
          >
            Chia đội hình
          </button>
        </div>
      )}

      {/* Votes List */}
      <div className="detail-section">
        <h2 className="section-title">Danh sách đăng ký ({session.votes?.length || 0})</h2>
        <div className="votes-table">
          {joinedVotes.length > 0 && (
            <div className="vote-group">
              <h3 className="vote-group-title">Tham gia ({joinedVotes.length})</h3>
              <div className="vote-list">
                {joinedVotes.map(v => (
                  <span key={v.id} className="vote-chip vote-chip-join">{v.user?.displayName}</span>
                ))}
              </div>
            </div>
          )}
          {maybeVotes.length > 0 && (
            <div className="vote-group">
              <h3 className="vote-group-title">Cân nhắc ({maybeVotes.length})</h3>
              <div className="vote-list">
                {maybeVotes.map(v => (
                  <span key={v.id} className="vote-chip vote-chip-maybe">{v.user?.displayName}</span>
                ))}
              </div>
            </div>
          )}
          {declinedVotes.length > 0 && (
            <div className="vote-group">
              <h3 className="vote-group-title">Báo vắng ({declinedVotes.length})</h3>
              <div className="vote-list">
                {declinedVotes.map(v => (
                  <span key={v.id} className="vote-chip vote-chip-decline">{v.user?.displayName}</span>
                ))}
              </div>
            </div>
          )}
          {!session.votes?.length && <p className="text-muted">Chưa có ai đăng ký</p>}
        </div>
      </div>

      {/* Admin: Book Session */}
      {isAdmin && session.status === 'CONFIRMED' && (
        <div className="detail-section">
          <h2 className="section-title">Xác nhận đặt sân (Admin)</h2>
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
              <label className="form-label" htmlFor="payer-select">Người thanh toán trước</label>
              <select
                id="payer-select"
                className="form-input"
                value={bookForm.payerId}
                onChange={(e) => setBookForm(prev => ({ ...prev, payerId: e.target.value }))}
                required
              >
                <option value="">-- Chọn thành viên thanh toán --</option>
                {joinedVotes.map(v => (
                  <option key={v.user?.id} value={v.user?.id}>{v.user?.displayName}</option>
                ))}
                <option value={user?.id}>{user?.displayName} (Admin)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={actionLoading === 'book'}>
              {actionLoading === 'book' ? 'Đang xử lý...' : 'Xác nhận thông tin đặt sân'}
            </button>
          </form>
        </div>
      )}

      {/* Payment Section */}
      {['BOOKED', 'COMPLETED'].includes(session.status) && (
        <div className="detail-section">
          <h2 className="section-title">Chi phí & Thanh toán</h2>

          {session.payer && (
            <div className="payer-info">
              <div className="payer-header">
                <span className="payer-avatar">
                  {session.payer.avatar ? (
                    <img src={session.payer.avatar} alt={session.payer.displayName} className="payer-avatar-img" />
                  ) : (
                    session.payer.displayName?.[0]?.toUpperCase()
                  )}
                </span>
                <div>
                  <span className="payer-name">Người nhận tiền: <strong>{session.payer.displayName}</strong></span>
                  {session.payer.bankInfo && (
                    <span className="payer-bank">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: '-1px' }}>
                        <line x1="3" y1="21" x2="21" y2="21"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                        <polyline points="5 6 12 3 19 6"></polyline>
                        <line x1="4" y1="10" x2="4" y2="21"></line>
                        <line x1="20" y1="10" x2="20" y2="21"></line>
                      </svg>
                      {session.payer.bankInfo}
                    </span>
                  )}
                  {session.payer.phone && (
                    <span className="payer-phone">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: '-1px' }}>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      {session.payer.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="payer-total">
                Tổng cộng: <strong>{Number(session.totalCost).toLocaleString('vi-VN')}đ</strong>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                      </svg>
                      Mã QR thanh toán nhanh
                    </span>
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
                  <p className="payer-qr-empty">Người nhận tiền chưa cập nhật mã QR chuyển khoản</p>
                </div>
              )}
            </div>
          )}

          {paymentSummary && (
            <div className="payment-summary">
              <span className="badge badge-confirmed">
                <span className="badge-dot"></span>
                {paymentSummary.confirmed} Đã xác nhận
              </span>
              <span className="badge badge-paid">
                <span className="badge-dot"></span>
                {paymentSummary.paid} Đã chuyển
              </span>
              <span className="badge badge-pending">
                <span className="badge-dot"></span>
                {paymentSummary.pending} Chờ chuyển
              </span>
            </div>
          )}

          <div className="payment-list">
            {payments.map(p => (
              <div key={p.id} className={`payment-item payment-${p.status.toLowerCase()}`}>
                <div className="payment-user">
                  <span className="payment-avatar">
                    {p.user?.avatar ? (
                      <img src={p.user.avatar} alt={p.user.displayName} className="payment-avatar-img" />
                    ) : (
                      p.user?.displayName?.[0]?.toUpperCase()
                    )}
                  </span>
                  <div>
                    <span className="payment-name">{p.user?.displayName}</span>
                    <span className="payment-amount">{Number(p.amount).toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
                <div className="payment-actions">
                  <span className={`badge badge-${p.status.toLowerCase()}`}>
                    <span className="badge-dot"></span>
                    {p.status === 'PENDING' ? 'Chưa thanh toán' :
                     p.status === 'PAID' ? 'Đã chuyển tiền' : 'Đã xác nhận'}
                  </span>

                  {/* User can mark their own payment as paid */}
                  {p.status === 'PENDING' && p.user?.id === user?.id && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleMarkPaid(p.id)}
                      disabled={actionLoading === p.id}
                    >
                      {actionLoading === p.id ? '...' : 'Đã chuyển tiền'}
                    </button>
                  )}

                  {/* Payer or admin can confirm */}
                  {p.status === 'PAID' && (isPayer || isAdmin) && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConfirmPayment(p.id)}
                      disabled={actionLoading === p.id}
                    >
                      {actionLoading === p.id ? '...' : 'Xác nhận đã nhận'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====== Admin Edit Session Modal ====== */}
      <Modal isOpen={showEditModal} onClose={() => !editLoading && setShowEditModal(false)}>
        <div className="modal-card card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-badge">Quản trị viên</span>
                <h2 className="modal-title">Chỉnh sửa thông tin trận đấu</h2>
                <p className="modal-subtitle">Cập nhật lịch thi đấu, địa điểm và thiết lập số lượng người</p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
                disabled={editLoading}
                type="button"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-form">
              {/* Section 1: Thông tin cơ bản */}
              <div className="form-section">
                <div className="form-section-title">Thông tin cơ bản</div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-title">Tiêu đề trận đấu <span className="text-danger">*</span></label>
                  <input
                    id="edit-title"
                    type="text"
                    className="form-input"
                    placeholder="VD: Chiều thứ 4 (16/09/2026)"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-status">Trạng thái trận đấu</label>
                  <select
                    id="edit-status"
                    className="form-input"
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="VOTING">Đang bình chọn</option>
                    <option value="CONFIRMED">Đủ người chơi</option>
                    <option value="BOOKED">Đã đặt sân</option>
                    <option value="COMPLETED">Đã hoàn thành</option>
                    <option value="CANCELLED">Đã hủy trận</option>
                  </select>
                </div>
              </div>

              {/* Section 2: Thời gian & Địa điểm */}
              <div className="form-section">
                <div className="form-section-title">Thời gian & Địa điểm</div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-playDate">Ngày chơi <span className="text-danger">*</span></label>
                  <input
                    id="edit-playDate"
                    type="date"
                    className="form-input"
                    value={editForm.playDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, playDate: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-startTime">Giờ bắt đầu <span className="text-danger">*</span></label>
                    <input
                      id="edit-startTime"
                      type="time"
                      className="form-input"
                      value={editForm.startTime}
                      onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-endTime">Giờ kết thúc <span className="text-danger">*</span></label>
                    <input
                      id="edit-endTime"
                      type="time"
                      className="form-input"
                      value={editForm.endTime}
                      onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-location">Địa điểm sân <span className="text-danger">*</span></label>
                  <input
                    id="edit-location"
                    type="text"
                    className="form-input"
                    placeholder="VD: Sân bóng Chảo Lửa, Quận Tân Bình"
                    value={editForm.location}
                    onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Section 3: Quy mô & Chi phí */}
              <div className="form-section">
                <div className="form-section-title">Quy mô & Chi phí</div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-minPlayers">Tối thiểu (người)</label>
                    <input
                      id="edit-minPlayers"
                      type="number"
                      min="2"
                      className="form-input"
                      value={editForm.minPlayers}
                      onChange={(e) => setEditForm(prev => ({ ...prev, minPlayers: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-maxPlayers">Tối đa (người)</label>
                    <input
                      id="edit-maxPlayers"
                      type="number"
                      min={editForm.minPlayers || "2"}
                      className="form-input"
                      value={editForm.maxPlayers}
                      onChange={(e) => setEditForm(prev => ({ ...prev, maxPlayers: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-totalCost">Tổng tiền sân (VNĐ)</label>
                    <input
                      id="edit-totalCost"
                      type="number"
                      className="form-input"
                      placeholder="VD: 600000"
                      value={editForm.totalCost}
                      onChange={(e) => setEditForm(prev => ({ ...prev, totalCost: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-voteDeadline">Hạn chót bình chọn</label>
                    <input
                      id="edit-voteDeadline"
                      type="datetime-local"
                      className="form-input"
                      value={editForm.voteDeadline}
                      onChange={(e) => setEditForm(prev => ({ ...prev, voteDeadline: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowEditModal(false)}
                  disabled={editLoading}
                  id="btn-cancel-edit-modal"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={editLoading}
                  id="btn-confirm-edit-session"
                >
                  {editLoading ? (
                    <><span className="spinner spinner-sm"></span> Đang lưu...</>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      {/* ====== Team Generator Modal ====== */}
      {showTeamGenModal && (
        <TeamGeneratorModal
          session={session}
          autoRebalance={autoRebalance}
          onClose={() => {
            setShowTeamGenModal(false);
            setAutoRebalance(false);
          }}
          onTeamsSaved={(updatedSession) => {
            setSession(updatedSession);
            setSuccess('Đã lưu và cập nhật danh sách đội hình thi đấu!');
            setTimeout(() => setSuccess(''), 3000);
          }}
        />
      )}
    </div>
  );
}
