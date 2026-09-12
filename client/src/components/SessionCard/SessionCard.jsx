import { Link } from 'react-router-dom';
import './SessionCard.css';

const STATUS_CONFIG = {
  VOTING: { label: 'Đang bình chọn', className: 'badge-voting' },
  CONFIRMED: { label: 'Đủ người chơi', className: 'badge-confirmed' },
  BOOKED: { label: 'Đã đặt sân', className: 'badge-booked' },
  COMPLETED: { label: 'Đã kết thúc', className: 'badge-completed' },
  CANCELLED: { label: 'Đã hủy', className: 'badge-cancelled' },
};

export default function SessionCard({ session, currentUser, onVote }) {
  const config = STATUS_CONFIG[session.status] || STATUS_CONFIG.VOTING;
  const joinCount = session._count?.votes ?? session.votes?.filter(v => v.status === 'JOIN').length ?? 0;
  const userVote = session.votes?.find(v => v.user?.id === currentUser?.id || v.userId === currentUser?.id);
  const progress = session.minPlayers > 0 ? Math.min((joinCount / session.minPlayers) * 100, 100) : 0;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return `${days[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`;
  };

  return (
    <div className={`session-card card card-hover ${session.status === 'CANCELLED' ? 'cancelled' : ''}`}>
      <div className="session-card-top">
        <span className={`badge ${config.className}`}>
          <span className="badge-dot"></span>
          {config.label}
        </span>
        <span className="session-date">{formatDate(session.playDate)}</span>
      </div>

      <Link to={`/sessions/${session.id}`} className="session-card-title">
        {session.title}
      </Link>

      <div className="session-card-info">
        <div className="info-item">
          <span className="info-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </span>
          <span>{session.location}</span>
        </div>
        <div className="info-item">
          <span className="info-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </span>
          <span>{session.startTime} - {session.endTime}</span>
        </div>
        <div className="info-item">
          <span className="info-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </span>
          <span>{joinCount} / {session.minPlayers} người (tối đa {session.maxPlayers})</span>
        </div>
      </div>

      {/* Progress bar */}
      {session.status === 'VOTING' && (
        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="progress-text">
            {progress >= 100 ? 'Đã đủ số lượng người chơi' : `Cần thêm ${session.minPlayers - joinCount} người`}
          </span>
        </div>
      )}

      {/* Vote buttons */}
      {session.status === 'VOTING' && (
        <div className="session-card-actions">
          <button
            className={`vote-btn vote-join ${userVote?.status === 'JOIN' ? 'active' : ''}`}
            onClick={() => onVote(session.id, 'JOIN')}
          >
            {userVote?.status === 'JOIN' && '✓ '}Tham gia
          </button>
          <button
            className={`vote-btn vote-decline ${userVote?.status === 'DECLINE' ? 'active' : ''}`}
            onClick={() => onVote(session.id, 'DECLINE')}
          >
            {userVote?.status === 'DECLINE' && '✓ '}Báo vắng
          </button>
          <button
            className={`vote-btn vote-maybe ${userVote?.status === 'MAYBE' ? 'active' : ''}`}
            onClick={() => onVote(session.id, 'MAYBE')}
          >
            {userVote?.status === 'MAYBE' && '✓ '}Cân nhắc
          </button>
        </div>
      )}

      {/* Total cost if booked */}
      {session.totalCost && session.status !== 'CANCELLED' && (
        <div className="session-cost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-2px' }}>
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
          {Number(session.totalCost).toLocaleString('vi-VN')}đ
          <span className="cost-per-person">
            (~{Math.round(Number(session.totalCost) / (joinCount || 1)).toLocaleString('vi-VN')}đ/người)
          </span>
        </div>
      )}

      <Link to={`/sessions/${session.id}`} className="session-card-link">
        Xem chi tiết →
      </Link>
    </div>
  );
}
