import { useState, useEffect, useRef } from 'react';
import { attendanceAPI, usersAPI } from '../../services/api';
import Modal from '../Modal/Modal';
import AdminAdjustVoteModal from '../Vote/AdminAdjustVoteModal';
import { matchesAttendanceSearch } from '../../utils/attendance';
import './AttendanceDashboardModal.css';

export default function AttendanceDashboardModal({
  session,
  onClose,
  onSessionUpdated,
  onOpenTeamGenerator,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'guests' | 'warnings'
  const [rosterFilter, setRosterFilter] = useState('ALL'); // 'ALL' | 'ATTENDED' | 'UNATTENDED' | 'DECLINED'
  const [showAdminVoteModal, setShowAdminVoteModal] = useState(false);
  const [adminVoteTargetUserId, setAdminVoteTargetUserId] = useState('');
  const [search, setSearch] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [pendingCheckIns, setPendingCheckIns] = useState({});
  const pendingCheckInKeys = useRef(new Set());
  const refreshVersion = useRef(0);
  const busy = Boolean(actionLoading) || Object.keys(pendingCheckIns).length > 0;

  // Guest Form State
  const [guestForm, setGuestForm] = useState({
    name: '',
    tier: 'C',
    isGoalkeeper: false,
    status: 'RESERVE', // Mặc định vào danh sách dự bị
    phone: '',
    note: '',
  });

  useEffect(() => {
    fetchDashboard();
  }, [session?.id]);

  const fetchDashboard = async () => {
    const version = ++refreshVersion.current;
    try {
      const res = await attendanceAPI.getDashboard(session.id);
      if (res.error) throw new Error(res.error);
      if (version === refreshVersion.current) setData(res);
    } catch {
      if (version === refreshVersion.current) setError('Không thể tải dữ liệu điểm danh');
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  };

  const notifySuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleToggleLockVote = async () => {
    setActionLoading('lock');
    setError('');
    try {
      const isCurrentlyLocked = Boolean(data?.session?.isVoteLocked);
      const res = await attendanceAPI.toggleLockVote(session.id, !isCurrentlyLocked);
      if (res.error) throw new Error(res.error);
      notifySuccess(res.message);
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Lỗi khi thay đổi trạng thái chốt bình chọn');
    } finally {
      setActionLoading('');
    }
  };

  const handleCheckIn = async (userId, currentCheckedIn) => {
    const key = `member-${userId}`;
    if (pendingCheckInKeys.current.has(key) || actionLoading) return;
    pendingCheckInKeys.current.add(key);
    setPendingCheckIns(prev => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await attendanceAPI.checkIn(session.id, userId, !currentCheckedIn);
      if (res.error) throw new Error(res.error);
      setData(prev => ({ ...prev, joined: prev.joined.map(v => v.userId === userId
        ? { ...v, isCheckedIn: !currentCheckedIn, checkedInAt: res.vote?.checkedInAt || new Date().toISOString() } : v) }));
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Không thể cập nhật điểm danh');
    } finally {
      pendingCheckInKeys.current.delete(key);
      setPendingCheckIns(prev => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const handleBulkCheckIn = async (isCheckedIn) => {
    if (busy) return;
    if (!window.confirm(isCheckedIn
      ? 'Đánh dấu TẤT CẢ thành viên đăng ký là có mặt? Chỉ thực hiện khi đã kiểm tra đầy đủ.'
      : 'Hủy điểm danh của TẤT CẢ thành viên đăng ký?')) return;
    setActionLoading('bulk');
    setError('');
    try {
      const res = await attendanceAPI.bulkCheckIn(session.id, isCheckedIn);
      if (res.error) throw new Error(res.error);
      notifySuccess(res.message);
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Lỗi điểm danh hàng loạt');
    } finally {
      setActionLoading('');
    }
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    if (!guestForm.name.trim()) return;

    setActionLoading('add-guest');
    setError('');
    try {
      const res = await attendanceAPI.addGuest(session.id, guestForm);
      if (res.error) throw new Error(res.error);
      notifySuccess(res.message);
      setShowGuestForm(false);
      setGuestForm({
        name: '',
        tier: 'C',
        isGoalkeeper: false,
        status: 'RESERVE',
        phone: '',
        note: '',
      });
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Không thể thêm khách mời');
    } finally {
      setActionLoading('');
    }
  };

  const handleToggleGuestAttendance = async (guest) => {
    const key = `guest-${guest.id}`;
    if (pendingCheckInKeys.current.has(key) || actionLoading) return;
    pendingCheckInKeys.current.add(key);
    setPendingCheckIns(prev => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await attendanceAPI.updateGuest(session.id, guest.id, {
        isCheckedIn: !guest.isCheckedIn,
      });
      if (res.error) throw new Error(res.error);
      setData(prev => ({ ...prev, guests: prev.guests.map(g => g.id === guest.id
        ? { ...g, isCheckedIn: !guest.isCheckedIn } : g) }));
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Lỗi cập nhật điểm danh khách');
    } finally {
      pendingCheckInKeys.current.delete(key);
      setPendingCheckIns(prev => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const handleToggleGuestStatus = async (guest) => {
    const nextStatus = guest.status === 'RESERVE' ? 'PLAYING' : 'RESERVE';
    setActionLoading(`guest-status-${guest.id}`);
    try {
      const res = await attendanceAPI.updateGuest(session.id, guest.id, {
        status: nextStatus,
        isCheckedIn: nextStatus === 'PLAYING' ? true : guest.isCheckedIn,
      });
      if (res.error) throw new Error(res.error);
      notifySuccess(
        nextStatus === 'PLAYING'
          ? `Đã đôn ${guest.name} lên đá chính và điểm danh có mặt`
          : `Đã chuyển ${guest.name} về danh sách dự bị`
      );
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Lỗi cập nhật trạng thái khách');
    } finally {
      setActionLoading('');
    }
  };

  const handleDeleteGuest = async (guestId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khách mời này?')) return;
    setActionLoading(`guest-delete-${guestId}`);
    try {
      const res = await attendanceAPI.deleteGuest(session.id, guestId);
      if (res.error) throw new Error(res.error);
      notifySuccess('Đã xóa khách mời');
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Lỗi xóa khách mời');
    } finally {
      setActionLoading('');
    }
  };

  const handleToggleMemberGK = async (userId, currentGK) => {
    setActionLoading(`gk-${userId}`);
    try {
      const res = await usersAPI.updateGoalkeeper(userId, !currentGK);
      if (res.error) throw new Error(res.error);
      setData(prev => {
        if (!prev) return prev;
        const updateVote = v => v.userId === userId ? { ...v, user: { ...v.user, isGoalkeeper: !currentGK } } : v;
        return {
          ...prev,
          joined: prev.joined?.map(updateVote),
          maybe: prev.maybe?.map(updateVote),
        };
      });
      notifySuccess(!currentGK ? 'Đã chỉ định vai trò thủ môn 🧤' : 'Đã hủy vai trò thủ môn');
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Lỗi cập nhật vai trò thủ môn');
    } finally {
      setActionLoading('');
    }
  };

  const handleToggleGuestGK = async (guest) => {
    setActionLoading(`guest-gk-${guest.id}`);
    try {
      const res = await attendanceAPI.updateGuest(session.id, guest.id, {
        isGoalkeeper: !guest.isGoalkeeper,
      });
      if (res.error) throw new Error(res.error);
      notifySuccess(!guest.isGoalkeeper ? `Đã chỉ định ${guest.name} làm thủ môn 🧤` : `Đã hủy thủ môn của ${guest.name}`);
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch {
      setError('Lỗi cập nhật thủ môn cho khách');
    } finally {
      setActionLoading('');
    }
  };

  const handleRecalculatePayments = async () => {
    if (!window.confirm('Bạn có chắc muốn tính lại tiền sân dựa trên số người thực tế ĐÃ ĐIỂM DANH CÓ MẶT?')) return;
    setActionLoading('recalc-payment');
    setError('');
    try {
      const res = await attendanceAPI.recalculatePayments(session.id);
      if (res.error) throw new Error(res.error);
      notifySuccess(res.message);
      await fetchDashboard();
      if (onSessionUpdated) onSessionUpdated();
    } catch (err) {
      setError(err?.message || 'Không thể tính lại tiền sân');
    } finally {
      setActionLoading('');
    }
  };

  if (!session) return null;

  const summary = data?.summary || {};
  const isLocked = Boolean(data?.session?.isVoteLocked);

  // Lọc danh sách vote theo bộ lọc
  const filteredJoined = (data?.joined || []).filter((v) => {
    if (rosterFilter === 'ATTENDED') return v.isCheckedIn;
    if (rosterFilter === 'UNATTENDED') return !v.isCheckedIn;
    return true;
  });
  const displayRoster = (rosterFilter === 'DECLINED' ? (data?.declined || []) : filteredJoined)
    .filter(v => matchesAttendanceSearch(v.user?.displayName, search));
  const displayGuests = (data?.guests || []).filter(g => matchesAttendanceSearch(g.name, search));

  const lateWarnings = data?.warnings?.lateCancellations || [];
  const noShowWarnings = data?.warnings?.noShows || [];
  const totalWarnings = lateWarnings.length + noShowWarnings.length;

  return (
    <Modal isOpen={true} onClose={onClose} closeOnBackdrop={!busy && !showAdminVoteModal} closeOnEsc={!busy && !showAdminVoteModal}
      className="attendance-modal-wrapper" overlayClassName="attendance-overlay">
      <div className="attendance-modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="attendance-modal-header">
        <div className="attendance-header-top">
          <div className="attendance-title-area">
            <h2 className="attendance-title">
              <span>📋</span> Điểm Danh Trên Sân
            </h2>
            <p className="attendance-subtitle">
              {session.startTime} - {session.endTime} · {session.location}
            </p>
          </div>

          <div className="attendance-header-actions">
            {/* Nút Chốt danh sách vote */}
            <button
              className={`btn-lock-toggle ${isLocked ? 'is-locked' : 'is-unlocked'}`}
              onClick={handleToggleLockVote}
              disabled={busy || loading}
              title={isLocked ? 'Click để mở lại bình chọn' : 'Click để chốt danh sách vote'}
              id="btn-toggle-vote-lock"
            >
              {isLocked ? (
                <>🔒 <span>Đã chốt</span></>
              ) : (
                <>🔓 <span>Chốt vote</span></>
              )}
            </button>

            <button className="attendance-close-btn" onClick={onClose} disabled={busy} id="btn-close-attendance-modal" aria-label="Đóng">
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Compact Stats Bar (Horizontal Chips) */}
      <div className="attendance-stats-bar">
        <div className="stat-chip stat-chip-attended">
          <span className="stat-chip-num">{summary.attendedMembersCount || 0}</span>
          <span className="stat-chip-lbl">/ {summary.joinedCount || 0} có mặt</span>
        </div>

        <div className="stat-chip stat-chip-absent">
          <span className="stat-chip-num">{summary.unattendedMembersCount || 0}</span>
          <span className="stat-chip-lbl">chưa đến</span>
        </div>

        <div className="stat-chip stat-chip-guests">
          <span className="stat-chip-num">{summary.totalGuestsCount || 0}</span>
          <span className="stat-chip-lbl">khách</span>
        </div>

        <div className="stat-chip stat-chip-ready">
          <span className="stat-chip-num">{summary.totalAttendedOnPitch || 0}</span>
          <span className="stat-chip-lbl">sẵn sàng</span>
        </div>

        {summary.totalWarningsCount > 0 && (
          <div
            className="stat-chip stat-chip-warnings"
            onClick={() => setActiveTab('warnings')}
            title="Bấm để xem danh sách vi phạm"
          >
            <span className="stat-chip-num">⚠️ {summary.totalWarningsCount}</span>
            <span className="stat-chip-lbl">cảnh báo</span>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error" role="alert" style={{ margin: '8px 18px 0' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>✕</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status" style={{ margin: '8px 18px 0' }}>
          <span>{success}</span>
          <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="attendance-nav-tabs">
        <button
          className={`attendance-tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
          onClick={() => { setActiveTab('roster'); setSearch(''); }}
          id="tab-btn-roster"
        >
          <span>👥 Điểm danh</span>
          <span className="tab-badge">{data?.joined?.length || 0}</span>
        </button>

        <button
          className={`attendance-tab-btn ${activeTab === 'guests' ? 'active' : ''}`}
          onClick={() => { setActiveTab('guests'); setSearch(''); }}
          id="tab-btn-guests"
        >
          <span>🌟 Khách mời</span>
          <span className="tab-badge">{data?.guests?.length || 0}</span>
        </button>

        <button
          className={`attendance-tab-btn ${activeTab === 'warnings' ? 'active' : ''}`}
          onClick={() => { setActiveTab('warnings'); setSearch(''); }}
          id="tab-btn-warnings"
        >
          <span>⚠️ Cảnh cáo</span>
          {totalWarnings > 0 && <span className="tab-badge tab-badge-warning">{totalWarnings}</span>}
        </button>
      </div>

      {/* Modal Body */}
      <div className="attendance-modal-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
            <span className="spinner"></span> Đang tải dữ liệu điểm danh...
          </div>
        ) : (
          <>
            {/* TAB 1: Roster List */}
            {activeTab === 'roster' && (
              <div className="roster-tab-content">
                <div className="roster-toolbar">
                  <div className="attendance-search">
                    <label className="sr-only" htmlFor="attendance-search-members">Tìm thành viên</label>
                    <input id="attendance-search-members" type="search" placeholder="Tìm tên thành viên…"
                      value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
                    {search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">✕</button>}
                  </div>
                  <div className="roster-filters">
                    <button
                      className={`roster-filter-btn ${rosterFilter === 'ALL' ? 'active' : ''}`}
                      onClick={() => setRosterFilter('ALL')}
                    >
                      Tất cả ({data?.joined?.length || 0})
                    </button>
                    <button
                      className={`roster-filter-btn ${rosterFilter === 'ATTENDED' ? 'active' : ''}`}
                      onClick={() => setRosterFilter('ATTENDED')}
                    >
                      Đã đến ({summary.attendedMembersCount || 0})
                    </button>
                    <button
                      className={`roster-filter-btn ${rosterFilter === 'UNATTENDED' ? 'active' : ''}`}
                      onClick={() => setRosterFilter('UNATTENDED')}
                    >
                      Chưa đến ({summary.unattendedMembersCount || 0})
                    </button>
                    {data?.declined?.length > 0 && (
                      <button
                        className={`roster-filter-btn ${rosterFilter === 'DECLINED' ? 'active' : ''}`}
                        onClick={() => setRosterFilter('DECLINED')}
                        style={rosterFilter === 'DECLINED' ? { borderColor: '#ef4444', color: '#b91c1c' } : { color: '#ef4444' }}
                      >
                        Báo vắng ({data?.declined?.length || 0})
                      </button>
                    )}
                  </div>

                  <details className="attendance-management">
                    <summary>Thao tác quản lý</summary>
                    <div className="roster-bulk-actions">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setAdminVoteTargetUserId('');
                        setShowAdminVoteModal(true);
                      }}
                      id="btn-attendance-adjust-vote"
                      disabled={busy}
                      title="Admin điều chỉnh hoặc đăng ký vote cho bất kỳ thành viên nào"
                    >
                      ⚙️ Điều chỉnh vote
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleBulkCheckIn(true)}
                      disabled={busy || loading}
                      id="btn-bulk-checkin"
                    >
                      Điểm danh tất cả
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleBulkCheckIn(false)}
                      disabled={busy || loading}
                      id="btn-bulk-uncheckin"
                    >
                      Hủy điểm danh
                    </button>
                  </div>
                  </details>
                </div>

                <div className="roster-grid">
                  {displayRoster.map((vote) => (
                    <div
                      key={vote.id}
                      className={`roster-card ${vote.isCheckedIn ? 'is-checked-in' : ''} ${vote.status === 'DECLINE' ? 'is-declined' : ''}`}
                    >
                      <div className="roster-card-left">
                        <div className="roster-avatar">
                          {vote.user?.avatar ? (
                            <img src={vote.user.avatar} alt={vote.user.displayName} />
                          ) : (
                            vote.user?.displayName?.[0] || '?'
                          )}
                        </div>
                        <div className="roster-player-meta">
                          <span className="roster-player-name">{vote.user?.displayName}</span>
                          <div className="roster-tags">
                            {vote.user?.tier && (
                              <span className={`badge member-tier-badge tier-${vote.user.tier.toLowerCase()}`} style={{ fontSize: '0.62rem', padding: '1px 4px' }}>
                                {vote.user.tier}
                              </span>
                            )}
                            <details className="attendance-player-options">
                              <summary>Tùy chọn</summary>
                              <button type="button" className="attendance-edit-vote" disabled={busy} onClick={() => {
                                setAdminVoteTargetUserId(vote.userId); setShowAdminVoteModal(true);
                              }}>Điều chỉnh vote</button>
                            {vote.user?.isGoalkeeper ? (
                              <button
                                type="button"
                                className="badge-gk-mini badge-gk-clickable"
                                onClick={() => handleToggleMemberGK(vote.userId, true)}
                                disabled={busy}
                                title="Bấm để hủy chỉ định thủ môn"
                              >
                                {actionLoading === `gk-${vote.userId}` ? '...' : '🧤 Thủ môn'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="badge-gk-mini badge-gk-add"
                                onClick={() => handleToggleMemberGK(vote.userId, false)}
                                disabled={busy}
                                title="Bấm để chỉ định làm thủ môn"
                              >
                                {actionLoading === `gk-${vote.userId}` ? '...' : '+ GK'}
                              </button>
                            )}
                            </details>
                            {vote.user?.isGoalkeeper && <span className="attendance-gk-label">🧤 GK</span>}
                          </div>
                          {vote.isCheckedIn && vote.checkedInAt && (
                            <span className="checkin-time-text">
                              ✓ Có mặt {new Date(vote.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {vote.status === 'DECLINE' ? (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: '#10b981', color: '#047857', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                          disabled={busy}
                          onClick={() => {
                            setAdminVoteTargetUserId(vote.userId);
                            setShowAdminVoteModal(true);
                          }}
                        >
                          Đổi sang Tham gia
                        </button>
                      ) : (
                        <button
                          className={`btn-checkin-toggle ${vote.isCheckedIn ? 'active' : 'inactive'}`}
                          onClick={() => handleCheckIn(vote.userId, vote.isCheckedIn)}
                          disabled={Boolean(actionLoading) || pendingCheckIns[`member-${vote.userId}`]}
                          aria-pressed={Boolean(vote.isCheckedIn)}
                          aria-label={`${vote.isCheckedIn ? 'Hủy điểm danh' : 'Điểm danh'} ${vote.user?.displayName}`}
                          id={`btn-checkin-${vote.userId}`}
                        >
                          {pendingCheckIns[`member-${vote.userId}`] ? 'Đang lưu…' : vote.isCheckedIn ? '✓ Có mặt' : '+ Có mặt'}
                        </button>
                      )}
                    </div>
                  ))}
                  {displayRoster.length === 0 && (
                    <p style={{ color: '#64748b', fontSize: '0.9rem', gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0' }}>
                      Không có thành viên nào thỏa điều kiện lọc
                    </p>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: Guests & Reserves */}
            {activeTab === 'guests' && (
              <div className="guests-tab-content">
                <div className="attendance-guest-toolbar">
                  <div className="attendance-search">
                    <label className="sr-only" htmlFor="attendance-search-guests">Tìm khách mời</label>
                    <input id="attendance-search-guests" type="search" placeholder="Tìm tên khách mời…"
                      value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
                    {search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">✕</button>}
                  </div>
                  <button type="button" className="btn btn-outline" aria-expanded={showGuestForm}
                    onClick={() => setShowGuestForm(prev => !prev)} disabled={busy}>
                    {showGuestForm ? 'Đóng biểu mẫu' : '+ Thêm khách'}
                  </button>
                </div>
                {/* Form Thêm Guest */}
                {showGuestForm && <div className="guest-form-card">
                  <h3 className="guest-form-title">
                    <span>➕</span> Thêm khách mời mới (vào danh sách Dự bị)
                  </h3>
                  <form onSubmit={handleAddGuest} className="guest-form-clean">
                    <div className="guest-form-input-group">
                      <input
                        type="text"
                        className="form-input guest-name-input"
                        placeholder="Nhập tên khách mời (vd: Bạn Hùng, Minh Guest)..."
                        aria-label="Tên khách mời"
                        value={guestForm.name}
                        onChange={(e) => setGuestForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        id="input-guest-name"
                      />
                    </div>

                    <div className="guest-form-controls-row">
                      <select
                        className="form-input guest-tier-select"
                        value={guestForm.tier}
                        onChange={(e) => setGuestForm((prev) => ({ ...prev, tier: e.target.value }))}
                        id="select-guest-tier"
                        aria-label="Trình độ khách mời"
                      >
                        <option value="S">Tier S (Rất hay)</option>
                        <option value="A">Tier A (Hay)</option>
                        <option value="B">Tier B (Khá)</option>
                        <option value="C">Tier C (Trung bình)</option>
                        <option value="D">Tier D (Mới chơi)</option>
                      </select>

                      <label className="guest-gk-checkbox-label">
                        <input
                          type="checkbox"
                          checked={guestForm.isGoalkeeper}
                          onChange={(e) => setGuestForm((prev) => ({ ...prev, isGoalkeeper: e.target.checked }))}
                        />
                        <span>Thủ môn (GK)</span>
                      </label>

                      <button
                        type="submit"
                        className="btn btn-primary btn-sm btn-add-guest-submit"
                        disabled={busy}
                        id="btn-submit-add-guest"
                      >
                        {actionLoading === 'add-guest' ? 'Đang thêm...' : '+ Thêm khách'}
                      </button>
                    </div>
                  </form>
                </div>}

                {/* Danh sách Guest */}
                <div className="guest-list-section">
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                    Danh sách khách mời trong trận ({data?.guests?.length || 0}):
                  </h4>

                  {displayGuests.map((guest) => (
                    <div
                      key={guest.id}
                      className={`guest-card ${guest.status === 'PLAYING' ? 'is-playing' : 'is-reserve'}`}
                    >
                      <div className="guest-card-left">
                        <div className="roster-avatar" style={{ background: '#f1f5f9' }}>
                          {guest.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="guest-card-meta">
                          <div className="guest-name-row">
                            <strong className="guest-display-name">{guest.name}</strong>
                            <span className={`badge member-tier-badge tier-${guest.tier?.toLowerCase()}`} style={{ fontSize: '0.62rem', padding: '1px 4px' }}>
                              Tier {guest.tier}
                            </span>
                            {guest.isGoalkeeper && <span className="attendance-gk-label">🧤 GK</span>}
                          </div>
                          <details className="attendance-player-options">
                            <summary>Tùy chọn khách</summary>
                            {guest.isGoalkeeper ? (
                              <button
                                type="button"
                                className="badge-gk-mini badge-gk-clickable"
                                onClick={() => handleToggleGuestGK(guest)}
                                disabled={busy}
                                title="Bấm để hủy chỉ định thủ môn"
                              >
                                {actionLoading === `guest-gk-${guest.id}` ? '...' : '🧤 Thủ môn'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="badge-gk-mini badge-gk-add"
                                onClick={() => handleToggleGuestGK(guest)}
                                disabled={busy}
                                title="Bấm để chỉ định khách làm thủ môn"
                              >
                                {actionLoading === `guest-gk-${guest.id}` ? '...' : '+ GK'}
                              </button>
                            )}
                            <button className="btn btn-outline btn-sm" onClick={() => handleToggleGuestStatus(guest)}
                              disabled={busy} id={`btn-guest-toggle-status-${guest.id}`}>
                              {guest.status === 'RESERVE' ? '⬆ Đôn lên đá chính' : '⬇ Chuyển về dự bị'}
                            </button>
                            <button className="btn btn-ghost btn-sm btn-delete-guest" onClick={() => handleDeleteGuest(guest.id)}
                              disabled={busy} id={`btn-guest-delete-${guest.id}`}>Xóa khách</button>
                          </details>
                          <div className="guest-status-row">
                            {guest.status === 'PLAYING' ? (
                              <span className="badge-guest-playing">Đá chính</span>
                            ) : (
                              <span className="badge-guest-reserve">Dự bị</span>
                            )}
                            {guest.isCheckedIn ? (
                              <span className="guest-checkin-status attended">✓ Đã đến</span>
                            ) : (
                              <span className="guest-checkin-status absent">Chưa đến</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="guest-actions">
                        <button
                          className={`btn-checkin-toggle ${guest.isCheckedIn ? 'active' : 'inactive'}`}
                          onClick={() => handleToggleGuestAttendance(guest)}
                          disabled={Boolean(actionLoading) || pendingCheckIns[`guest-${guest.id}`]}
                          aria-pressed={Boolean(guest.isCheckedIn)}
                          aria-label={`${guest.isCheckedIn ? 'Hủy điểm danh' : 'Điểm danh'} ${guest.name}`}
                          id={`btn-guest-checkin-${guest.id}`}
                        >
                          {pendingCheckIns[`guest-${guest.id}`] ? 'Đang lưu…' : guest.isCheckedIn ? '✓ Có mặt' : '+ Có mặt'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {(!data?.guests || data.guests.length === 0) && (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                      Chưa có khách mời nào được thêm vào trận đấu này.
                    </p>
                  )}
                  {data?.guests?.length > 0 && displayGuests.length === 0 && (
                    <p className="attendance-empty">Không tìm thấy khách mời. Hãy thử tên khác.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Warnings & Absence Logs */}
            {activeTab === 'warnings' && (
              <div className="warnings-tab-content">
                {/* 1. Báo vắng sát giờ */}
                <div className="warning-block">
                  <h3 className="warning-block-title" style={{ color: '#b45309' }}>
                    <span>⚠️</span> Báo vắng sát giờ (Trong vòng 2 tiếng hoặc sau chốt vote):
                  </h3>

                  {lateWarnings.length > 0 ? (
                    lateWarnings.map((log) => (
                      <div key={log.id} className="warning-card warning-card-late">
                        <div className="warning-card-left">
                          <div className="roster-avatar">{log.user?.displayName?.[0]}</div>
                          <div className="warning-user-meta">
                            <strong className="warning-user-name">{log.user?.displayName}</strong>
                            <div className="warning-reason">Lý do: "{log.reason || 'Không nêu'}"</div>
                          </div>
                        </div>
                        <div className="warning-card-right">
                          <span className="warning-badge-tag late">
                            {log.minutesBeforeMatch !== null
                              ? log.minutesBeforeMatch > 0
                                ? `Trước ${log.minutesBeforeMatch}p`
                                : `Sau giờ đá ${Math.abs(log.minutesBeforeMatch)}p`
                              : 'Sát giờ'}
                          </span>
                          <div className="warning-date-text">
                            {new Date(log.reportedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                      Không có trường hợp báo vắng sát giờ nào.
                    </p>
                  )}
                </div>

                {/* 2. Bùng kèo / No-Show */}
                <div className="warning-block">
                  <h3 className="warning-block-title" style={{ color: '#dc2626' }}>
                    <span>🚨</span> Chưa có mặt tại sân:
                  </h3>

                  {noShowWarnings.length > 0 ? (
                    noShowWarnings.map((w) => (
                      <div key={w.userId} className="warning-card warning-card-danger">
                        <div className="warning-card-left">
                          <div className="roster-avatar">{w.user?.displayName?.[0]}</div>
                          <div className="warning-user-meta">
                            <strong className="warning-user-name">{w.user?.displayName}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                              Đã vote Tham gia lúc {new Date(w.votedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} nhưng chưa đến
                            </div>
                          </div>
                        </div>
                        <div className="warning-card-right">
                          <span className="warning-badge-tag danger">Chưa đến</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                      Tất cả thành viên đăng ký đều đã có mặt đầy đủ!
                    </p>
                  )}
                </div>

                {/* 3. Lịch sử báo vắng hợp lệ */}
                {data?.absenceLogs?.filter((l) => !l.isLate).length > 0 && (
                  <div className="warning-block" style={{ marginTop: '20px' }}>
                    <h3 className="warning-block-title" style={{ color: '#475569' }}>
                      <span>ℹ️</span> Lịch sử Báo Vắng Đúng Giờ:
                    </h3>
                    {data.absenceLogs
                      .filter((l) => !l.isLate)
                      .map((log) => (
                        <div key={log.id} className="warning-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div>
                            <strong>{log.user?.displayName}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Lý do: "{log.reason || 'Bận việc'}"
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(log.reportedAt).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="attendance-modal-footer">
        <div className="attendance-footer-summary">
          Quân số: <strong>{summary.totalAttendedOnPitch || 0}</strong> ({summary.attendedMembersCount || 0} tv + {summary.attendedGuestsCount || 0} khách)
        </div>

        <div className="attendance-footer-actions">
          {session.totalCost && (
            <button
              className="btn-payment-recalc"
              onClick={handleRecalculatePayments}
              disabled={busy || loading}
              title="Chia đều tiền sân theo số người thực tế có mặt"
              id="btn-recalc-payments-attendance"
            >
              💰 Chia tiền
            </button>
          )}

          {onOpenTeamGenerator && (
            <button
              className="btn-team-rebalance"
              onClick={() => {
                onClose();
                onOpenTeamGenerator(true); // useAttendedOnly = true
              }}
              id="btn-team-gen-attendance"
              disabled={busy || loading || (summary.totalAttendedOnPitch || 0) < 4}
            >
              ⚽ Chia đội
            </button>
          )}

          <button className="btn btn-outline btn-sm" disabled={busy} onClick={onClose} id="btn-close-attendance-footer">
            Đóng
          </button>
        </div>
      </div>
      </div>

      {showAdminVoteModal && (
        <AdminAdjustVoteModal
          isOpen={showAdminVoteModal}
          onClose={() => {
            setShowAdminVoteModal(false);
            setAdminVoteTargetUserId('');
          }}
          session={session}
          preselectedUserId={adminVoteTargetUserId}
          onSuccess={async (msg) => {
            notifySuccess(msg);
            await fetchDashboard();
            if (onSessionUpdated) onSessionUpdated();
          }}
        />
      )}
    </Modal>
  );
}
