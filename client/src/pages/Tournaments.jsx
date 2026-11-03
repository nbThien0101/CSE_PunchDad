import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tournamentsAPI } from '../services/api';
import { Badge, Button, Card, Input, Select } from '../components/ui/index.jsx';
import Modal from '../components/Modal/Modal';
import Toast from '../components/Toast/Toast';
import './Tournaments.css';

const PHASE_CONFIG = {
  DRAFT: { label: 'Đang mở đăng ký', badgeClass: 'badge-confirmed' },
  REGISTRATION_CLOSED: { label: 'Đã chốt đăng ký', badgeClass: 'badge-pending' },
  GROUP_STAGE: { label: 'Vòng bảng', badgeClass: 'badge-pending' },
  KNOCKOUT: { label: 'Vòng Knockout', badgeClass: 'badge-booked' },
  COMPLETED: { label: 'Đã hoàn tất', badgeClass: 'badge-completed' },
};

const TEAM_OPTIONS = [
  { value: 2, title: '2 đội', sub: 'Chung kết' },
  { value: 4, title: '4 đội', sub: '2 Bán kết + CK' },
  { value: 6, title: '6 đội', sub: '2 Bảng A & B' },
  { value: 8, title: '8 đội', sub: '2 Bảng 4 đội' },
];

const PLAYER_OPTIONS = [
  { value: 5, title: '5 người', sub: 'Futsal chuẩn' },
  { value: 6, title: '6 người', sub: '5 chính + 1 dự bị' },
  { value: 7, title: '7 người', sub: '5 chính + 2 dự bị' },
  { value: 8, title: '8 người', sub: '5 chính + 3 dự bị' },
];

export default function Tournaments() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modal tạo giải đấu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [teamCount, setTeamCount] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState(7);
  const [hasPenalty, setHasPenalty] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await tournamentsAPI.list();
      setTournaments(res.tournaments || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tải danh sách giải đấu' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập tên giải đấu' });
      return;
    }

    try {
      setSubmitting(true);
      await tournamentsAPI.create({
        title: title.trim(),
        settings: {
          teamCount: Number(teamCount),
          playersPerTeam: Number(playersPerTeam),
          hasPenalty,
        },
      });

      setToast({ type: 'success', message: 'Tạo giải đấu thành công!' });
      setIsModalOpen(false);
      setTitle('');
      fetchTournaments();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tạo giải đấu' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải danh sách giải đấu...</p>
      </div>
    );
  }

  return (
    <div className="tournaments-page animate-fade-in">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="tournaments-header">
        <div className="tournaments-header-title">
          <h1 className="page-title">Giải đấu & Sự kiện CLB</h1>
          <p className="page-subtitle">
            Các giải cúp futsal thường niên, giải giao lưu & sự kiện thể thao nội bộ CSE
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <Button
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            + Tạo giải đấu mới
          </Button>
        )}
      </div>

      {tournaments.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">🏆</div>
          <p className="empty-state-title">Chưa có giải đấu nào</p>
          <p className="empty-state-desc">
            {user?.role === 'ADMIN'
              ? 'Bấm nút "+ Tạo giải đấu mới" ở trên để khởi tạo giải futsal cho CLB.'
              : 'Hãy đón chờ ban quản trị mở giải đấu mới sắp tới!'}
          </p>
        </div>
      ) : (
        <div className="tournaments-grid">
          {tournaments.map((t) => {
            const phaseInfo = PHASE_CONFIG[t.phase] || { label: t.phase, badgeClass: 'badge-completed' };
            const regCount = t.state?.registrations?.length || 0;
            const teamsCount = t.settings?.teamCount || t.state?.teams?.length || 4;

            return (
              <Card key={t.id} className="tournament-card card card-hover">
                <div>
                  <Badge className={`badge ${phaseInfo.badgeClass}`}>
                    <span className="badge-dot" />
                    {phaseInfo.label}
                  </Badge>
                </div>

                <h3 className="tournament-card-title">{t.title}</h3>

                <div className="tournament-card-stats">
                  <div>
                    <span>Thể thức:</span>
                    <strong>Futsal 5v5 ({teamsCount} đội)</strong>
                  </div>
                  <div>
                    <span>Đã đăng ký:</span>
                    <strong>{regCount} cầu thủ</strong>
                  </div>
                  <div>
                    <span>Luân lưu Pen:</span>
                    <strong>{t.settings?.hasPenalty !== false ? 'Có' : 'Không'}</strong>
                  </div>
                </div>

                {t.myRegistration && (
                  <div className="tournament-my-reg-tag">
                    <span>✓</span> Bạn đã đăng ký ({t.myRegistration.positions?.join(', ')})
                  </div>
                )}

                <Link
                  to={`/tournaments/${t.id}`}
                  className="btn btn-primary tournament-card-btn"
                >
                  {t.phase === 'DRAFT' ? 'Đăng ký & Xem chi tiết →' : 'Xem diễn biến & Bảng điểm →'}
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Khởi tạo giải đấu */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ariaLabel="Khởi tạo giải đấu mới"
      >
        <div className="confirm-dialog" style={{ maxWidth: '580px' }}>
          <h2>Khởi tạo giải đấu Futsal mới</h2>
          <form onSubmit={handleCreateTournament}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="tournament-title">
                Tên giải đấu *
              </label>
              <Input
                id="tournament-title"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Cúp Futsal CSE HitDad Mùa Thu 2026..."
                required
              />
            </div>

            {/* Mục 1: Số đội tham gia */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Số đội tham gia</span>
                <strong style={{ color: 'var(--primary-600)', fontSize: '0.95rem' }}>{teamCount} đội</strong>
              </label>
              <div className="tournament-option-grid">
                {TEAM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`tournament-option-card ${teamCount === opt.value ? 'is-selected' : ''}`}
                    onClick={() => setTeamCount(opt.value)}
                  >
                    <span className="opt-title">{opt.title}</span>
                    <span className="opt-sub">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mục 2: Số cầu thủ mỗi đội */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Số cầu thủ mỗi đội</span>
                <strong style={{ color: 'var(--primary-600)', fontSize: '0.95rem' }}>{playersPerTeam} người</strong>
              </label>
              <div className="tournament-option-grid">
                {PLAYER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`tournament-option-card ${playersPerTeam === opt.value ? 'is-selected' : ''}`}
                    onClick={() => setPlayersPerTeam(opt.value)}
                  >
                    <span className="opt-title">{opt.title}</span>
                    <span className="opt-sub">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Banner tóm tắt quy mô giải đấu */}
            <div className="tournament-summary-banner">
              <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
              <span>
                Quy mô: <strong>{teamCount} đội</strong> × <strong>{playersPerTeam} cầu thủ</strong> = tối đa <strong>{teamCount * playersPerTeam} cầu thủ</strong> tham dự giải.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={hasPenalty}
                  onChange={(e) => setHasPenalty(e.target.checked)}
                />
                Áp dụng sút luân lưu Pen khi hòa trong các trận Knockout
              </label>
            </div>

            <div className="modal-form-actions">
              <Button
                className="btn btn-outline"
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                Hủy
              </Button>
              <Button
                className="btn btn-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Đang khởi tạo...' : 'Tạo giải đấu'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
