import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';
import './Members.css';

const TIER_OPTIONS = [
  { value: '', label: 'Chưa xếp hạng', color: '' },
  { value: 'S', label: 'S', color: 'tier-s' },
  { value: 'A', label: 'A', color: 'tier-a' },
  { value: 'B', label: 'B', color: 'tier-b' },
  { value: 'C', label: 'C', color: 'tier-c' },
  { value: 'D', label: 'D', color: 'tier-d' },
];

const TIER_COLORS = {
  S: 'tier-s',
  A: 'tier-a',
  B: 'tier-b',
  C: 'tier-c',
  D: 'tier-d',
};

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTier, setEditTier] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingGkId, setTogglingGkId] = useState(null);
  const [filter, setFilter] = useState('all');

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const data = await usersAPI.getMembers();
      setMembers(data.members || []);
    } catch {
      setError('Không thể tải danh sách thành viên');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTier = (member) => {
    setEditingId(member.id);
    setEditTier(member.tier || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTier('');
  };

  const handleSaveTier = async (memberId) => {
    setSaving(true);
    try {
      const result = await usersAPI.updateTier(memberId, editTier);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.message);
        setMembers(prev =>
          prev.map(m => m.id === memberId ? { ...m, tier: editTier || null } : m)
        );
        setEditingId(null);
        setEditTier('');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Cập nhật tier thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGoalkeeper = async (member) => {
    const newStatus = !member.isGoalkeeper;
    setTogglingGkId(member.id);
    try {
      const result = await usersAPI.updateGoalkeeper(member.id, newStatus);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(
          newStatus
            ? `Đã chỉ định "${member.displayName}" làm thủ môn 🧤`
            : `Đã hủy quyền thủ môn của "${member.displayName}"`
        );
        setMembers(prev =>
          prev.map(m => m.id === member.id ? { ...m, isGoalkeeper: newStatus } : m)
        );
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Cập nhật vai trò thủ môn thất bại');
    } finally {
      setTogglingGkId(null);
    }
  };

  const handleDeleteMember = async (member) => {
    if (!window.confirm(`Bạn chắc chắn muốn xóa thành viên "${member.displayName}"?\n\nTất cả dữ liệu votes và payments của người này sẽ bị xóa vĩnh viễn!`)) return;
    try {
      const result = await usersAPI.deleteMember(member.id);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.message);
        setMembers(prev => prev.filter(m => m.id !== member.id));
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Xóa thành viên thất bại');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredMembers = members.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'admin') return m.role === 'ADMIN';
    if (filter === 'gk') return Boolean(m.isGoalkeeper);
    if (filter === 'no-tier') return !m.tier;
    return m.tier === filter;
  });

  const stats = {
    total: members.length,
    admins: members.filter(m => m.role === 'ADMIN').length,
    goalkeepers: members.filter(m => m.isGoalkeeper).length,
    withTier: members.filter(m => m.tier).length,
    noTier: members.filter(m => !m.tier).length,
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="members-page animate-fade-in">
      <div className="members-header">
        <div>
          <h1 className="page-title">Thành viên câu lạc bộ</h1>
          <p className="page-subtitle">
            {stats.total} thành viên · {stats.goalkeepers} thủ môn · {stats.withTier} đã xếp hạng trình độ
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="members-stats">
        <div className="member-stat">
          <span className="member-stat-number">{stats.total}</span>
          <span className="member-stat-label">Tổng cộng</span>
        </div>
        <div className="member-stat">
          <span className="member-stat-number member-stat-admin">{stats.admins}</span>
          <span className="member-stat-label">Ban cán sự</span>
        </div>
        <div className="member-stat">
          <span className="member-stat-number member-stat-gk">{stats.goalkeepers}</span>
          <span className="member-stat-label">Thủ môn</span>
        </div>
        <div className="member-stat">
          <span className="member-stat-number member-stat-tier">{stats.withTier}</span>
          <span className="member-stat-label">Đã xếp tier</span>
        </div>
        <div className="member-stat">
          <span className="member-stat-number member-stat-notier">{stats.noTier}</span>
          <span className="member-stat-label">Chưa xếp</span>
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

      {/* Filters */}
      <div className="filter-tabs">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'admin', label: 'Ban cán sự' },
          { key: 'gk', label: `🧤 Thủ môn (${stats.goalkeepers})` },
          { key: 'S', label: 'Tier S' },
          { key: 'A', label: 'Tier A' },
          { key: 'B', label: 'Tier B' },
          { key: 'C', label: 'Tier C' },
          { key: 'D', label: 'Tier D' },
          { key: 'no-tier', label: 'Chưa xếp hạng' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <p className="empty-state-title">Không tìm thấy thành viên</p>
          <p>Thử thay đổi bộ lọc</p>
        </div>
      ) : (
        <div className="members-grid stagger-children">
          {filteredMembers.map(member => (
            <div key={member.id} className="member-card card card-hover" id={`member-${member.id}`}>
              <div className="member-card-top">
                <div className="member-avatar-large">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.displayName} className="member-avatar-img" />
                  ) : (
                    member.displayName?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="member-card-info">
                  <h3 className="member-name">{member.displayName}</h3>
                  <span className="member-username">@{member.username}</span>
                  <div className="member-badges">
                    {member.role === 'ADMIN' && (
                      <span className="badge badge-admin">Admin</span>
                    )}
                    {member.isGoalkeeper && (
                      <span className="badge badge-gk" title="Thủ môn">
                        🧤 Thủ môn
                      </span>
                    )}
                    {member.tier ? (
                      <span className={`badge member-tier-badge ${TIER_COLORS[member.tier] || ''}`}>
                        Tier {member.tier}
                      </span>
                    ) : (
                      <span className="badge member-tier-badge tier-none">Chưa xếp hạng</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="member-card-details">
                <div className="member-detail">
                  <span className="member-detail-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </span>
                  <span>{member._count?.votes || 0} trận đã tham gia</span>
                </div>
                {member.phone && (
                  <div className="member-detail">
                    <span className="member-detail-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                    </span>
                    <span>{member.phone}</span>
                  </div>
                )}
                <div className="member-detail">
                  <span className="member-detail-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </span>
                  <span>Gia nhập {formatDate(member.createdAt)}</span>
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="member-card-admin">
                  {editingId === member.id ? (
                    <div className="tier-edit-form">
                      <select
                        className="form-input tier-select"
                        value={editTier}
                        onChange={(e) => setEditTier(e.target.value)}
                        id={`tier-select-${member.id}`}
                      >
                        {TIER_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.value ? `Tier ${opt.label}` : opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="tier-edit-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveTier(member.id)}
                          disabled={saving}
                        >
                          {saving ? '...' : 'Lưu'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="member-admin-actions">
                      <button
                        className="btn btn-outline btn-sm btn-edit-tier"
                        onClick={() => handleEditTier(member)}
                        id={`btn-edit-tier-${member.id}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Tier
                      </button>
                      <button
                        className={`btn btn-sm ${member.isGoalkeeper ? 'btn-gk-active' : 'btn-outline btn-gk-toggle'}`}
                        onClick={() => handleToggleGoalkeeper(member)}
                        disabled={togglingGkId === member.id}
                        title={member.isGoalkeeper ? 'Hủy quyền Thủ môn' : 'Chỉ định làm Thủ môn'}
                        id={`btn-toggle-gk-${member.id}`}
                      >
                        {togglingGkId === member.id ? (
                          '...'
                        ) : member.isGoalkeeper ? (
                          <>
                            <span style={{ marginRight: '4px' }}>🧤</span>
                            <span>Là GK</span>
                          </>
                        ) : (
                          <>
                            <span style={{ marginRight: '4px' }}>🧤</span>
                            <span>Gán GK</span>
                          </>
                        )}
                      </button>
                      {member.role !== 'ADMIN' && member.id !== user?.id && (
                        <button
                          className="btn btn-danger-solid btn-sm"
                          onClick={() => handleDeleteMember(member)}
                          id={`btn-delete-member-${member.id}`}
                          title="Xóa thành viên"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
