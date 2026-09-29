import { useState, useEffect, useMemo } from 'react';
import { usersAPI, votesAPI } from '../../services/api';
import Modal from '../Modal/Modal';
import './AdminAdjustVoteModal.css';

export default function AdminAdjustVoteModal({
  isOpen,
  onClose,
  session,
  preselectedUserId,
  onSuccess,
}) {
  const [members, setMembers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(preselectedUserId || '');
  const [targetStatus, setTargetStatus] = useState('JOIN'); // 'JOIN' | 'DECLINE' | 'NONE'
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Tải danh sách thành viên CLB
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchMembers = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await usersAPI.getMembers();
        if (isMounted) {
          setMembers(res.members || []);
        }
      } catch {
        if (isMounted) {
          setError('Không thể tải danh sách thành viên câu lạc bộ');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMembers();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Cập nhật selectedUserId và trạng thái mặc định khi preselectedUserId thay đổi hoặc mở modal
  useEffect(() => {
    if (preselectedUserId) {
      setSelectedUserId(preselectedUserId);
      const currentVote = session?.votes?.find(
        (v) => (v.user?.id || v.userId) === preselectedUserId
      );
      if (currentVote) {
        // Gợi ý chuyển đổi trạng thái đối nghịch
        setTargetStatus(currentVote.status === 'JOIN' ? 'DECLINE' : 'JOIN');
      } else {
        setTargetStatus('JOIN');
      }
    } else {
      setSelectedUserId('');
      setTargetStatus('JOIN');
    }
    setReason('');
    setError('');
  }, [preselectedUserId, isOpen, session?.votes]);

  // Map vote hiện tại của user trong session
  const currentVoteMap = useMemo(() => {
    const map = new Map();
    if (session?.votes) {
      session.votes.forEach((v) => {
        const uId = v.user?.id || v.userId;
        if (uId) {
          map.set(uId, v);
        }
      });
    }
    return map;
  }, [session?.votes]);

  // Lọc thành viên theo từ khóa tìm kiếm
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.displayName?.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q) ||
        m.tier?.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedUserId),
    [members, selectedUserId]
  );

  const selectedUserCurrentVote = selectedUserId ? currentVoteMap.get(selectedUserId) : null;

  const handleSelectMember = (userId) => {
    setSelectedUserId(userId);
    const vote = currentVoteMap.get(userId);
    if (vote) {
      setTargetStatus(vote.status === 'JOIN' ? 'DECLINE' : 'JOIN');
    } else {
      setTargetStatus('JOIN');
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Vui lòng chọn thành viên cần điều chỉnh');
      return;
    }

    if (!session?.id) {
      setError('Thiếu thông tin trận đấu');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await votesAPI.adminAdjust({
        sessionId: session.id,
        userId: selectedUserId,
        status: targetStatus,
        reason: reason.trim(),
      });

      if (res.error) {
        setError(res.error);
      } else {
        if (onSuccess) {
          onSuccess(res.message);
        }
        onClose();
      }
    } catch (err) {
      setError(err?.message || 'Có lỗi xảy ra khi điều chỉnh bình chọn');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnBackdrop={!submitting}>
      <div className="admin-vote-modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
        <div className="admin-vote-modal-header">
          <div className="admin-vote-header-info">
            <span className="admin-vote-header-badge">Admin Control</span>
            <h2 className="admin-vote-modal-title">Điều chỉnh bình chọn người chơi</h2>
            <p className="admin-vote-modal-sub">
              Trận đấu: <strong>{session?.title}</strong>
            </p>
          </div>
          <button
            type="button"
            className="admin-vote-close-btn"
            onClick={onClose}
            disabled={submitting}
            title="Đóng"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-vote-modal-body">
          {error && (
            <div className="admin-vote-alert alert-error">
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* Chọn thành viên */}
          <div className="admin-vote-form-group">
            <label className="admin-vote-form-label">
              Thành viên cần điều chỉnh <span className="text-danger">*</span>
            </label>

            {loading ? (
              <div className="admin-vote-loading-text">
                <span className="spinner-sm"></span> Đang tải danh sách thành viên...
              </div>
            ) : (
              <>
                <div className="admin-vote-search-box">
                  <span className="admin-vote-search-icon">🔍</span>
                  <input
                    type="text"
                    className="form-input admin-vote-search-input"
                    placeholder="Tìm theo tên hoặc username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={submitting}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="admin-vote-clear-search"
                      onClick={() => setSearchQuery('')}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="admin-vote-member-list">
                  {filteredMembers.map((member) => {
                    const vote = currentVoteMap.get(member.id);
                    const isSelected = member.id === selectedUserId;

                    return (
                      <div
                        key={member.id}
                        className={`admin-vote-member-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectMember(member.id)}
                      >
                        <div className="admin-vote-member-avatar">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.displayName} />
                          ) : (
                            member.displayName?.[0] || '?'
                          )}
                        </div>
                        <div className="admin-vote-member-info">
                          <span className="admin-vote-member-name">
                            {member.displayName}
                            {member.tier && (
                              <span className={`badge member-tier-badge tier-${member.tier.toLowerCase()}`}>
                                {member.tier}
                              </span>
                            )}
                            {member.isGoalkeeper && (
                              <span className="admin-vote-gk-tag" title="Thủ môn">
                                🧤 GK
                              </span>
                            )}
                          </span>
                          <span className="admin-vote-member-sub">@{member.username}</span>
                        </div>

                        <div className="admin-vote-current-status-tag">
                          {vote ? (
                            vote.status === 'JOIN' ? (
                              <span className="status-tag status-tag-join">
                                🟢 Đang tham gia
                              </span>
                            ) : (
                              <span className="status-tag status-tag-decline">
                                🔴 Báo vắng
                              </span>
                            )
                          ) : (
                            <span className="status-tag status-tag-none">
                              ⚪ Chưa bình chọn
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredMembers.length === 0 && (
                    <div className="admin-vote-empty-search">
                      Không tìm thấy thành viên phù hợp
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Trạng thái được chọn */}
          {selectedMember && (
            <div className="admin-vote-selected-preview">
              <div className="preview-label">Đang chọn:</div>
              <div className="preview-user">
                <strong>{selectedMember.displayName}</strong>
                <span>
                  (Hiện tại:{' '}
                  {selectedUserCurrentVote
                    ? selectedUserCurrentVote.status === 'JOIN'
                      ? 'Đang tham gia'
                      : 'Đang báo vắng'
                    : 'Chưa bình chọn'}
                  )
                </span>
              </div>
            </div>
          )}

          {/* Chọn trạng thái mới */}
          <div className="admin-vote-form-group">
            <label className="admin-vote-form-label">
              Trạng thái bình chọn mới <span className="text-danger">*</span>
            </label>

            <div className="admin-vote-status-options">
              <label
                className={`admin-status-option ${targetStatus === 'JOIN' ? 'active join-active' : ''}`}
              >
                <input
                  type="radio"
                  name="targetStatus"
                  value="JOIN"
                  checked={targetStatus === 'JOIN'}
                  onChange={() => setTargetStatus('JOIN')}
                  disabled={submitting}
                />
                <div className="status-option-content">
                  <div className="status-option-title">🟢 Tham gia (JOIN)</div>
                  <div className="status-option-desc">Ghi nhận tham gia thi đấu</div>
                </div>
              </label>

              <label
                className={`admin-status-option ${targetStatus === 'DECLINE' ? 'active decline-active' : ''}`}
              >
                <input
                  type="radio"
                  name="targetStatus"
                  value="DECLINE"
                  checked={targetStatus === 'DECLINE'}
                  onChange={() => setTargetStatus('DECLINE')}
                  disabled={submitting}
                />
                <div className="status-option-content">
                  <div className="status-option-title">🔴 Báo vắng (DECLINE)</div>
                  <div className="status-option-desc">Chuyển sang danh sách vắng mặt</div>
                </div>
              </label>

              <label
                className={`admin-status-option ${targetStatus === 'NONE' ? 'active none-active' : ''}`}
              >
                <input
                  type="radio"
                  name="targetStatus"
                  value="NONE"
                  checked={targetStatus === 'NONE'}
                  onChange={() => setTargetStatus('NONE')}
                  disabled={submitting}
                />
                <div className="status-option-content">
                  <div className="status-option-title">🗑️ Hủy bình chọn (NONE)</div>
                  <div className="status-option-desc">Xóa hoàn toàn lượt vote của user</div>
                </div>
              </label>
            </div>
          </div>

          {/* Lý do / Ghi chú */}
          <div className="admin-vote-form-group">
            <label className="admin-vote-form-label">
              Lý do / Ghi chú điều chỉnh <span className="text-muted">(tùy chọn)</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={
                targetStatus === 'DECLINE'
                  ? 'Ví dụ: Báo bận gia đình qua Zalo, chấn thương đột xuất...'
                  : 'Ví dụ: Admin đăng ký hộ, xác nhận tham gia trực tiếp...'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Ghi chú quyền admin */}
          <div className="admin-vote-notice">
            <span className="notice-icon">ℹ️</span>
            <span>
              Quyền Admin: Thao tác có hiệu lực ngay cả khi danh sách đã chốt hoặc đã quá hạn bình chọn.
            </span>
          </div>

          {/* Footer buttons */}
          <div className="admin-vote-modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !selectedUserId}
            >
              {submitting ? 'Đang lưu...' : 'Xác nhận điều chỉnh'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
