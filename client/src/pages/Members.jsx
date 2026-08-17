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
    if (filter === 'no-tier') return !m.tier;
    return m.tier === filter;
  });

  const stats = {
    total: members.length,
    admins: members.filter(m => m.role === 'ADMIN').length,
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
          <h1 className="page-title">Thành viên CLB 👥</h1>
          <p className="page-subtitle">
            {stats.total} thành viên · {stats.withTier} đã xếp hạng
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="members-stats">
        <div className="member-stat">
          <span className="member-stat-number">{stats.total}</span>
          <span className="member-stat-label">Tổng</span>
        </div>
        <div className="member-stat">
          <span className="member-stat-number member-stat-admin">{stats.admins}</span>
          <span className="member-stat-label">Admin</span>
        </div>
        <div className="member-stat">
          <span className="member-stat-number member-stat-tier">{stats.withTier}</span>
          <span className="member-stat-label">Có tier</span>
        </div>
        <div className="member-stat">
          <span className="member-stat-number member-stat-notier">{stats.noTier}</span>
          <span className="member-stat-label">Chưa xếp</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error} <button onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span>✅</span> {success} <button onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="filter-tabs">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'admin', label: '👑 Admin' },
          { key: 'S', label: '🏆 Tier S' },
          { key: 'A', label: '🥇 Tier A' },
          { key: 'B', label: '🥈 Tier B' },
          { key: 'C', label: '🥉 Tier C' },
          { key: 'D', label: '📋 Tier D' },
          { key: 'no-tier', label: '❓ Chưa xếp' },
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
          <div className="empty-state-icon">👥</div>
          <p className="empty-state-title">Không tìm thấy thành viên</p>
          <p>Thử thay đổi bộ lọc</p>
        </div>
      ) : (
        <div className="members-grid stagger-children">
          {filteredMembers.map(member => (
            <div key={member.id} className="member-card card card-hover" id={`member-${member.id}`}>
              <div className="member-card-top">
                <div className="member-avatar-large">
                  {member.displayName?.[0]?.toUpperCase()}
                </div>
                <div className="member-card-info">
                  <h3 className="member-name">{member.displayName}</h3>
                  <span className="member-username">@{member.username}</span>
                  <div className="member-badges">
                    {member.role === 'ADMIN' && (
                      <span className="badge badge-admin">👑 Admin</span>
                    )}
                    {member.tier ? (
                      <span className={`badge member-tier-badge ${TIER_COLORS[member.tier] || ''}`}>
                        ⭐ Tier {member.tier}
                      </span>
                    ) : (
                      <span className="badge member-tier-badge tier-none">Chưa xếp hạng</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="member-card-details">
                <div className="member-detail">
                  <span className="member-detail-icon">⚽</span>
                  <span>{member._count?.votes || 0} trận đã tham gia</span>
                </div>
                {member.phone && (
                  <div className="member-detail">
                    <span className="member-detail-icon">📱</span>
                    <span>{member.phone}</span>
                  </div>
                )}
                <div className="member-detail">
                  <span className="member-detail-icon">📅</span>
                  <span>Tham gia {formatDate(member.createdAt)}</span>
                </div>
              </div>

              {/* Admin: Edit Tier */}
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
                          {saving ? '...' : '💾 Lưu'}
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
                        ✏️ Đổi tier
                      </button>
                      {member.role !== 'ADMIN' && member.id !== user?.id && (
                        <button
                          className="btn btn-danger-solid btn-sm"
                          onClick={() => handleDeleteMember(member)}
                          id={`btn-delete-member-${member.id}`}
                        >
                          🗑️ Xóa
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
