import { useEffect, useMemo, useState } from 'react';
import { feedbackAPI } from '../services/api';
import Toast from '../components/Toast/Toast';
import './FeedbackAdmin.css';

const CATEGORY_META = {
  BUG: { label: 'Báo lỗi', icon: '🐞', className: 'bug' },
  FEATURE: { label: 'Đề xuất', icon: '💡', className: 'feature' },
  UX: { label: 'Trải nghiệm', icon: '✨', className: 'ux' },
  OTHER: { label: 'Khác', icon: '💬', className: 'other' },
};

const STATUS_META = {
  NEW: { label: 'Mới', className: 'new' },
  REVIEWING: { label: 'Đang xem xét', className: 'reviewing' },
  RESOLVED: { label: 'Đã xử lý', className: 'resolved' },
};

const RATING_LABELS = ['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Rất tốt'];

export default function FeedbackAdmin() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState({ total: 0, NEW: 0, REVIEWING: 0, RESOLVED: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [draftStatus, setDraftStatus] = useState('NEW');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = useMemo(
    () => feedbacks.find((item) => item.id === selectedId) || null,
    [feedbacks, selectedId],
  );

  const loadFeedbacks = async () => {
    setLoading(true);
    try {
      const result = await feedbackAPI.getAll({ status: statusFilter, category: categoryFilter });
      if (result.error) throw new Error(result.error);
      setFeedbacks(result.feedbacks || []);
      setStats(result.stats || {});
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách phản hồi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, [statusFilter, categoryFilter]);

  const openFeedback = (item) => {
    setSelectedId(item.id);
    setDraftStatus(item.status);
    setAdminNote(item.adminNote || '');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await feedbackAPI.update(selected.id, { status: draftStatus, adminNote });
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedbacks((items) => items.map((item) => item.id === selected.id ? result.feedback : item));
      setSuccess('Đã lưu trạng thái và ghi chú phản hồi');
      setSelectedId(null);
      const refreshed = await feedbackAPI.getAll({ status: statusFilter, category: categoryFilter });
      if (!refreshed.error) {
        setFeedbacks(refreshed.feedbacks || []);
        setStats(refreshed.stats || {});
      }
    } catch {
      setError('Không thể cập nhật phản hồi');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (value) => new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

  return (
    <div className="feedback-admin-page animate-fade-in">
      <Toast message={error} type="error" onClose={() => setError('')} duration={6000} />
      {!error && <Toast message={success} type="success" onClose={() => setSuccess('')} />}

      <div className="feedback-admin-header">
        <div>
          <span className="feedback-admin-eyebrow">Trung tâm phản hồi</span>
          <h1 className="page-title">Ý kiến người dùng</h1>
          <p className="page-subtitle">Lắng nghe, ưu tiên và theo dõi những điều cần cải thiện.</p>
        </div>
        <button className="btn btn-outline btn-sm" type="button" onClick={loadFeedbacks} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 11a8.1 8.1 0 1 0 .5 4M20 4v7h-7" /></svg>
          Làm mới
        </button>
      </div>

      <div className="feedback-stats">
        {[
          { key: 'total', label: 'Tổng phản hồi', icon: '◈' },
          { key: 'NEW', label: 'Chưa xem', icon: '●' },
          { key: 'REVIEWING', label: 'Đang xem xét', icon: '◷' },
          { key: 'RESOLVED', label: 'Đã xử lý', icon: '✓' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`feedback-stat-card ${item.key !== 'total' && statusFilter === item.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(item.key === 'total' || statusFilter === item.key ? '' : item.key)}
          >
            <span className={`feedback-stat-icon ${item.key.toLowerCase()}`}>{item.icon}</span>
            <span><strong>{stats[item.key] || 0}</strong><small>{item.label}</small></span>
          </button>
        ))}
      </div>

      <div className="feedback-toolbar">
        <div className="feedback-filter-group">
          {[
            { value: '', label: 'Tất cả' },
            ...Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, label: `${meta.icon} ${meta.label}` })),
          ].map((item) => (
            <button key={item.value || 'all'} type="button" className={categoryFilter === item.value ? 'active' : ''} onClick={() => setCategoryFilter(item.value)}>{item.label}</button>
          ))}
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="feedback-loading"><div className="spinner" /><p>Đang tải phản hồi...</p></div>
      ) : feedbacks.length === 0 ? (
        <div className="feedback-empty"><span>💬</span><h3>Chưa có phản hồi phù hợp</h3><p>Các phản hồi mới của thành viên sẽ xuất hiện tại đây.</p></div>
      ) : (
        <div className="feedback-list">
          {feedbacks.map((item) => {
            const category = CATEGORY_META[item.category] || CATEGORY_META.OTHER;
            const status = STATUS_META[item.status] || STATUS_META.NEW;
            return (
              <article key={item.id} className={`feedback-card ${item.status === 'NEW' ? 'unread' : ''}`}>
                <div className="feedback-card-main">
                  <div className={`feedback-category-icon ${category.className}`}>{category.icon}</div>
                  <div className="feedback-card-content">
                    <div className="feedback-card-meta">
                      <span className={`feedback-category-badge ${category.className}`}>{category.label}</span>
                      <span className={`feedback-status-badge ${status.className}`}>{status.label}</span>
                      <time>{formatTime(item.createdAt)}</time>
                    </div>
                    <p>{item.message}</p>
                    <div className="feedback-author-row">
                      <span className="feedback-author-avatar">
                        {item.user.avatar ? <img src={item.user.avatar} alt="" /> : item.user.displayName?.[0]?.toUpperCase()}
                      </span>
                      <span><strong>{item.user.displayName}</strong><small>@{item.user.username}</small></span>
                      {item.rating && <span className="feedback-rating-summary">{'★'.repeat(item.rating)}<small>{RATING_LABELS[item.rating]}</small></span>}
                      {item.pagePath && <code title={item.pagePath}>{item.pagePath}</code>}
                    </div>
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => openFeedback(item)}>Xem & xử lý</button>
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="feedback-drawer-backdrop" onClick={() => setSelectedId(null)} role="presentation">
          <aside className="feedback-drawer" onClick={(event) => event.stopPropagation()} aria-label="Chi tiết phản hồi">
            <div className="feedback-drawer-header">
              <div><span>Chi tiết phản hồi</span><h2>{CATEGORY_META[selected.category]?.icon} {CATEGORY_META[selected.category]?.label}</h2></div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Đóng">×</button>
            </div>
            <div className="feedback-drawer-body">
              <div className="feedback-drawer-author"><strong>{selected.user.displayName}</strong><span>@{selected.user.username} · {formatTime(selected.createdAt)}</span></div>
              {selected.rating && <div className="feedback-drawer-rating"><span>{'★'.repeat(selected.rating)}{'☆'.repeat(5 - selected.rating)}</span>{RATING_LABELS[selected.rating]}</div>}
              <div className="feedback-message-box">{selected.message}</div>
              {selected.pagePath && <div className="feedback-context"><span>Trang được gửi từ</span><code>{selected.pagePath}</code></div>}
              <label>Trạng thái
                <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
                  {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                </select>
              </label>
              <label>Ghi chú nội bộ
                <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value.slice(0, 2000))} rows="5" placeholder="Thêm ghi chú cho admin và đội ngũ dev..." />
              </label>
            </div>
            <div className="feedback-drawer-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setSelectedId(null)}>Hủy</button>
              <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cập nhật'}</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
