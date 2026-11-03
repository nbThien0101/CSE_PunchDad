import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { noticesAPI, tournamentsAPI } from '../services/api';
import { Alert, Badge, Button, Card, Input, Select, Textarea } from '../components/ui/index.jsx';
import Modal from '../components/Modal/Modal';
import { useConfirmation } from '../components/Modal/ConfirmDialog';
import Toast from '../components/Toast/Toast';
import './Notices.css';

export default function Notices() {
  const { user } = useAuth();
  const { confirm, confirmationDialog } = useConfirmation();
  const [notices, setNotices] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'
  const [toast, setToast] = useState(null);

  // Modal tạo thông báo (Admin)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const res = await noticesAPI.list();
      setNotices(res.notices || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tải thông báo' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      const res = await tournamentsAPI.list();
      setTournaments(res.tournaments || []);
    } catch {
      // Bỏ qua nếu chưa tải được danh sách giải
    }
  };

  useEffect(() => {
    fetchNotices();
    if (user?.role === 'ADMIN') {
      fetchTournaments();
    }
  }, [user]);

  const handleMarkRead = async (id) => {
    try {
      await noticesAPI.markRead(id);
      setNotices((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      window.dispatchEvent(new Event('club-notices-changed'));
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Thao tác thất bại' });
    }
  };

  const handleArchive = async (notice) => {
    const isConfirmed = await confirm(`Bạn có chắc muốn lưu trữ thông báo "${notice.title}"?`);
    if (!isConfirmed) return;

    try {
      await noticesAPI.archive(notice.id);
      setNotices((prev) => prev.filter((n) => n.id !== notice.id));
      setToast({ type: 'success', message: 'Đã lưu trữ thông báo' });
      window.dispatchEvent(new Event('club-notices-changed'));
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể lưu trữ' });
    }
  };

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setToast({ type: 'error', message: 'Vui lòng điền đầy đủ tiêu đề và nội dung' });
      return;
    }

    try {
      setSubmitting(true);
      await noticesAPI.create({
        title: title.trim(),
        body: body.trim(),
        tournamentId: selectedTournamentId || null,
      });

      setToast({ type: 'success', message: 'Đã đăng thông báo thành công!' });
      setIsCreateModalOpen(false);
      setTitle('');
      setBody('');
      setSelectedTournamentId('');
      fetchNotices();
      window.dispatchEvent(new Event('club-notices-changed'));
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tạo thông báo' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredNotices = notices.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    return true;
  });

  const unreadCount = notices.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải bảng tin...</p>
      </div>
    );
  }

  return (
    <div className="notices-page animate-fade-in">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="notices-header">
        <div className="notices-header-title">
          <h1 className="page-title">Bảng tin & Thông báo CLB</h1>
          <p className="page-subtitle">
            Cập nhật tin tức, quy định giải đấu và quyết định quan trọng của CLB HitDad
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <Button
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Đăng thông báo mới
          </Button>
        )}
      </div>

      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          Tất cả ({notices.length})
        </button>
        <button
          className={`filter-tab ${filter === 'UNREAD' ? 'active' : ''}`}
          onClick={() => setFilter('UNREAD')}
        >
          Chưa đọc ({unreadCount})
        </button>
      </div>

      {filteredNotices.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">📢</div>
          <p className="empty-state-title">Không có thông báo nào</p>
          <p className="empty-state-desc">
            {filter === 'UNREAD'
              ? 'Bạn đã đọc hết tất cả thông báo hiện có!'
              : 'Hiện tại chưa có thông báo nào mới từ Ban Quản Trị.'}
          </p>
        </div>
      ) : (
        <div className="notices-list">
          {filteredNotices.map((notice) => (
            <Card
              key={notice.id}
              className={`notice-card card card-hover ${!notice.isRead ? 'unread' : ''}`}
            >
              <div className="notice-header-row">
                <h3 className="notice-title">
                  {notice.title}
                  {!notice.isRead && (
                    <Badge className="badge badge-admin">Mới</Badge>
                  )}
                </h3>
              </div>

              <div className="notice-meta">
                <span>Người đăng: <strong>{notice.author?.displayName || 'Ban Quản Trị'}</strong></span>
                <span>•</span>
                <span>{new Date(notice.createdAt).toLocaleString('vi-VN')}</span>
              </div>

              <p className="notice-body">{notice.body}</p>

              <div className="notice-footer">
                {notice.tournament && (
                  <Link
                    to={`/tournaments/${notice.tournament.id}`}
                    className="notice-link-tournament"
                  >
                    🏆 Giải đấu: {notice.tournament.title} →
                  </Link>
                )}

                <div className="notice-card-actions">
                  {!notice.isRead && (
                    <Button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleMarkRead(notice.id)}
                    >
                      Đánh dấu đã đọc
                    </Button>
                  )}

                  {user?.role === 'ADMIN' && (
                    <Button
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--danger-500)', borderColor: 'var(--danger-100)' }}
                      onClick={() => handleArchive(notice)}
                    >
                      Lưu trữ
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Đăng thông báo mới (Admin) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        ariaLabel="Đăng thông báo mới"
      >
        <div className="confirm-dialog" style={{ maxWidth: '560px' }}>
          <h2>Đăng thông báo mới cho CLB</h2>
          <form onSubmit={handleCreateNotice}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="notice-title">
                Tiêu đề thông báo *
              </label>
              <Input
                id="notice-title"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Mở đăng ký Giải Futsal Mùa Thu 2026..."
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="notice-body">
                Nội dung thông báo *
              </label>
              <Textarea
                id="notice-body"
                className="form-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Nhập chi tiết thông báo, quy định, thể thức..."
                rows={5}
                required
              />
            </div>

            {tournaments.length > 0 && (
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="notice-tournament">
                  Liên kết giải đấu (tùy chọn)
                </label>
                <Select
                  id="notice-tournament"
                  className="form-select"
                  value={selectedTournamentId}
                  onChange={(e) => setSelectedTournamentId(e.target.value)}
                >
                  <option value="">-- Không liên kết giải đấu --</option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.phase === 'DRAFT' ? 'Đang mở đăng ký' : 'Đang diễn ra'})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="modal-form-actions">
              <Button
                className="btn btn-outline"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Hủy
              </Button>
              <Button
                className="btn btn-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Đang đăng...' : 'Đăng thông báo'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {confirmationDialog}
    </div>
  );
}
