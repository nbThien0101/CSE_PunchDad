import { Link } from 'react-router-dom';
import './SessionCard.css';

const STATUS_CONFIG = {
  VOTING: { label: 'Đang vote', className: 'badge-voting', icon: '🗳️' },
  CONFIRMED: { label: 'Đủ người', className: 'badge-confirmed', icon: '✅' },
  BOOKED: { label: 'Đã đặt sân', className: 'badge-booked', icon: '📍' },
  COMPLETED: { label: 'Hoàn thành', className: 'badge-completed', icon: '🏁' },
  CANCELLED: { label: 'Đã hủy', className: 'badge-cancelled', icon: '❌' },
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
          {config.icon} {config.label}
        </span>
        <span className="session-date">{formatDate(session.playDate)}</span>
      </div>

      <Link to={`/sessions/${session.id}`} className="session-card-title">
        {session.title}
      </Link>

      <div className="session-card-info">
        <div className="info-item">
          <span className="info-icon">📍</span>
          <span>{session.location}</span>
        </div>
        <div className="info-item">
          <span className="info-icon">⏰</span>
          <span>{session.startTime} - {session.endTime}</span>
        </div>
        <div className="info-item">
          <span className="info-icon">👥</span>
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
            {progress >= 100 ? '✅ Đủ người!' : `Cần thêm ${session.minPlayers - joinCount} người`}
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
            👍 Tham gia {userVote?.status === 'JOIN' ? '✓' : ''}
          </button>
          <button
            className={`vote-btn vote-decline ${userVote?.status === 'DECLINE' ? 'active' : ''}`}
            onClick={() => onVote(session.id, 'DECLINE')}
          >
            👎 Không
          </button>
          <button
            className={`vote-btn vote-maybe ${userVote?.status === 'MAYBE' ? 'active' : ''}`}
            onClick={() => onVote(session.id, 'MAYBE')}
          >
            🤔 Có thể
          </button>
        </div>
      )}

      {/* Total cost if booked */}
      {session.totalCost && session.status !== 'CANCELLED' && (
        <div className="session-cost">
          💰 {Number(session.totalCost).toLocaleString('vi-VN')}đ
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
