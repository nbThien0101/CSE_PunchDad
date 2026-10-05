import { useState, useEffect, useRef } from 'react';
import { sessionsAPI } from '../../services/api';
import { swapFieldPlayers } from '../../utils/teamBalance';
import Modal from '../Modal/Modal';
import './TeamGeneratorModal.css';

export default function TeamGeneratorModal({
  session,
  onClose,
  onTeamsSaved,
  autoRebalance = false,
  useAttendedOnly = false,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [onlyAttended, setOnlyAttended] = useState(useAttendedOnly);
  const [suggestions, setSuggestions] = useState(null);
  const [teamCount, setTeamCount] = useState(2);
  const [goalkeeperOverrides, setGoalkeeperOverrides] = useState({});
  const [generatedData, setGeneratedData] = useState(autoRebalance ? null : (session?.teams || null));
  const [selectedSwapPlayer, setSelectedSwapPlayer] = useState(null);
  const requestVersion = useRef(0);

  const joinVotes = (session?.votes || [])
    .filter(v => v.status === 'JOIN' && (!onlyAttended || v.isCheckedIn))
    .sort((a, b) => new Date(a.votedAt) - new Date(b.votedAt));

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const data = await sessionsAPI.getTeamSuggestions(session.id, onlyAttended);
        if (cancelled) return;
        setSuggestions(data.suggestions);
        const savedCount = session?.teams?.teamCount;
        const defaultCount = data.suggestions?.available?.includes(savedCount)
          ? savedCount : (data.suggestions?.recommended || 2);
        setTeamCount(defaultCount);

        if (autoRebalance) {
          handleRunBalance(defaultCount, onlyAttended);
        }
      } catch {
        if (!cancelled && autoRebalance) handleRunBalance(teamCount, onlyAttended);
      }
    };
    init();
    return () => {
      cancelled = true;
      requestVersion.current++;
    };
  }, [session?.id, autoRebalance]);

  const handleToggleGK = (userId, defaultIsGK) => {
    if (loading || saving) return;
    const current = goalkeeperOverrides[userId] !== undefined ? goalkeeperOverrides[userId] : defaultIsGK;
    setGoalkeeperOverrides(prev => ({
      ...prev,
      [userId]: !current,
    }));
    setGeneratedData(null);
    setSelectedSwapPlayer(null);
    setSuccess('');
  };

  const handleRunBalance = async (targetCount = teamCount, attendedOnly = onlyAttended) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    setSuccess('');
    setGeneratedData(null);
    setSelectedSwapPlayer(null);

    try {
      const data = await sessionsAPI.getTeamSuggestions(session.id, attendedOnly);
      if (version !== requestVersion.current) return;
      if (data.error) {
        setError(data.error);
        return;
      }
      setSuggestions(data.suggestions);
      const validCount = data.suggestions.available.includes(targetCount)
        ? targetCount : data.suggestions.recommended;
      setTeamCount(validCount);
      const res = await sessionsAPI.generateTeams(session.id, {
        teamCount: validCount,
        goalkeeperOverrides,
        useAttendedOnly: attendedOnly,
      });
      if (version !== requestVersion.current) return;

      if (res.error) {
        setError(res.error);
      } else {
        setGeneratedData(res.result);
        setSuccess('Đã xáo trộn ngẫu nhiên cầu thủ cùng Tier và cân bằng đội hình!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      if (version === requestVersion.current) setError('Chia đội thất bại, vui lòng thử lại');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  const handleSaveTeams = async () => {
    if (!generatedData || loading || saving) return;
    setSaving(true);
    setError('');

    try {
      const res = await sessionsAPI.saveTeams(session.id, generatedData);
      if (res.error) {
        setError(res.error);
      } else {
        if (onTeamsSaved) onTeamsSaved(res.session);
        onClose();
      }
    } catch {
      setError('Lưu danh sách đội thất bại');
    } finally {
      setSaving(false);
    }
  };

  // Hoán đổi cầu thủ giữa các đội thủ công
  const handleSelectForSwap = (teamId, player, isGK = false) => {
    if (isGK || saving) return; // Không hoán đổi vị trí thủ môn

    if (!selectedSwapPlayer) {
      setSelectedSwapPlayer({ teamId, player });
    } else {
      if (selectedSwapPlayer.player.userId === player.userId) {
        setSelectedSwapPlayer(null); // Click lại để hủy
        return;
      }

      setGeneratedData(prev => swapFieldPlayers(prev,
        { teamId: selectedSwapPlayer.teamId, userId: selectedSwapPlayer.player.userId },
        { teamId, userId: player.userId }));
      setSelectedSwapPlayer(null);
      setSuccess('Đã hoán đổi vị trí cầu thủ!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="team-gen-modal card animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="team-gen-header">
          <div>
            <span className="team-gen-badge">Chia đội hình</span>
            <h2 className="team-gen-title">Phân chia đội hình trận đấu</h2>
            <p className="team-gen-subtitle">
              Cân bằng lực lượng theo Tier trình độ · Mỗi đội 5 người (1 Thủ môn + 4 Cầu thủ)
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        {/* Body */}
        <div className="team-gen-body">
          {error && <div className="alert alert-error"><span>{error}</span></div>}
          {success && <div className="alert alert-success"><span>{success}</span></div>}

          {/* Controls Bar */}
          <div className="team-gen-controls">
            <div className="control-group">
              <span className="control-label">Số đội thi đấu:</span>
              <div className="team-count-pills">
                {(suggestions?.available || [2, 3, 4, 5]).map(count => {
                  const isRec = count === suggestions?.recommended;
                  return (
                    <button
                      key={count}
                      type="button"
                      className={`team-pill ${teamCount === count ? 'active' : ''}`}
                      onClick={() => {
                        if (count === teamCount) return;
                        setTeamCount(count);
                        setGeneratedData(null);
                        setSelectedSwapPlayer(null);
                        setSuccess('');
                      }}
                      disabled={loading || saving}
                    >
                      {count} đội
                      {isRec && <span className="pill-rec-tag">Gợi ý</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="control-group" style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600, color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={onlyAttended}
                  disabled={loading || saving}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setOnlyAttended(next);
                    handleRunBalance(teamCount, next);
                  }}
                />
                <span>Chỉ chia người đã điểm danh</span>
              </label>
            </div>

            <button
              type="button"
              className="btn-run-balance"
              onClick={() => handleRunBalance(teamCount, onlyAttended)}
              disabled={loading || saving || (joinVotes.length + (onlyAttended ? (session.guests || []).filter(g => g.isCheckedIn).length : (session.guests || []).filter(g => g.status === 'PLAYING').length)) < 4}
              id="btn-run-balance"
            >
              {loading ? (
                <><span className="spinner spinner-sm"></span> Đang xáo trộn...</>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8"></polyline>
                    <line x1="4" y1="20" x2="21" y2="3"></line>
                    <polyline points="21 16 21 21 16 21"></polyline>
                    <line x1="15" y1="15" x2="21" y2="21"></line>
                    <line x1="4" y1="4" x2="9" y2="9"></line>
                  </svg>
                  {generatedData ? 'Xáo trộn & Chia lại' : 'Tự động cân bằng đội'}
                </>
              )}
            </button>
          </div>

          {/* Quick GK Settings */}
          <div className="voters-preview-section">
            <div className="voters-preview-header">
              <span className="voters-preview-title">
                Thành viên tham gia ({joinVotes.length + (
                  onlyAttended
                    ? (session.guests || []).filter(g => g.isCheckedIn).length
                    : (session.guests || []).filter(g => g.status === 'PLAYING').length
                )})
              </span>
              <span className="voters-preview-hint">
                Nhấn <strong>[GK]</strong> để chỉ định vị trí Thủ môn cho thành viên
              </span>
            </div>

            <div className="voters-chips-grid">
              {joinVotes.map((v, i) => {
                const user = v.user || {};
                const isGK = goalkeeperOverrides[user.id] !== undefined
                  ? goalkeeperOverrides[user.id]
                  : Boolean(user.isGoalkeeper);

                return (
                  <div key={user.id || i} className="voter-chip">
                    <span className="voter-chip-order">#{i + 1}</span>
                    <span style={{ fontWeight: 600 }}>{user.displayName}</span>
                    {user.tier ? (
                      <span className={`badge member-tier-badge tier-${user.tier.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                        {user.tier}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>-</span>
                    )}
                    <button
                      type="button"
                      className={`voter-chip-gk-toggle ${isGK ? 'active' : ''}`}
                      onClick={() => handleToggleGK(user.id, user.isGoalkeeper)}
                      title={isGK ? 'Đã chọn làm Thủ môn' : 'Đặt làm Thủ môn'}
                    >
                      GK
                    </button>
                  </div>
                );
              })}

              {/* Khách mời */}
              {(session.guests || [])
                .filter(g => onlyAttended ? g.isCheckedIn : g.status === 'PLAYING')
                .map((g, i) => {
                  const guestId = g.id;
                  const isGK = goalkeeperOverrides[guestId] !== undefined
                    ? goalkeeperOverrides[guestId]
                    : Boolean(g.isGoalkeeper);

                  return (
                    <div key={guestId} className="voter-chip" style={{ borderColor: '#fdba74', background: '#fff7ed' }}>
                      <span className="voter-chip-order" style={{ background: '#ea580c' }}>#{joinVotes.length + i + 1}</span>
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#ea580c', background: '#ffedd5', padding: '1px 5px', borderRadius: '4px' }}>
                        Khách
                      </span>
                      {g.tier ? (
                        <span className={`badge member-tier-badge tier-${g.tier.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                          {g.tier}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>-</span>
                      )}
                      <button
                        type="button"
                        className={`voter-chip-gk-toggle ${isGK ? 'active' : ''}`}
                        onClick={() => handleToggleGK(guestId, g.isGoalkeeper)}
                        title={isGK ? 'Đã chọn làm Thủ môn' : 'Đặt làm Thủ môn'}
                      >
                        GK
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Generated Teams Grid */}
          {generatedData && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#1e293b' }}>
                  Kết quả chia đội ({generatedData.teams?.length} đội)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  💡 Mẹo: Nhấn vào 2 cầu thủ sân bất kỳ để hoán đổi vị trí
                </span>
              </div>

              <div className="teams-grid">
                {generatedData.teams?.map((team) => (
                  <div key={team.id} className="team-card-gen" style={{ borderTop: `4px solid ${team.color}` }}>
                    <div className="team-card-gen-header" style={{ background: team.bg }}>
                      <span className="team-card-gen-title" style={{ color: team.color }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: team.color }}></span>
                        {team.name}
                      </span>
                      <span className="team-card-gen-score">
                        {team.totalTierScore} pts · TB {team.averageTierScore}
                      </span>
                    </div>

                    <div className="team-players-list">
                      {team.missingPlayersCount > 0 && (
                        <div className="alert alert-error">Còn thiếu {team.missingPlayersCount} cầu thủ sân</div>
                      )}
                      {/* Goalkeeper */}
                      {team.goalkeeper && (
                        <div className="player-row is-gk">
                          <div className="player-info-cell">
                            <span className="player-avatar-small">
                              {team.goalkeeper.avatar ? (
                                <img src={team.goalkeeper.avatar} alt="" />
                              ) : (
                                team.goalkeeper.displayName?.[0]
                              )}
                            </span>
                            <span className="player-name-text">{team.goalkeeper.displayName}</span>
                          </div>
                          <div className="player-tags">
                            {team.goalkeeper.tier && (
                              <span className={`badge member-tier-badge tier-${team.goalkeeper.tier.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 4px' }}>
                                {team.goalkeeper.tier}
                              </span>
                            )}
                            {team.goalkeeper.isShared || team.goalkeeper.isRotating || team.goalkeeper.isPlaceholder ? (
                              <span className="role-badge-shared-gk" title={team.goalkeeper.isShared
                                ? `Dùng chung với ${team.goalkeeper.sharedFrom}` : 'Các thành viên trong đội luân phiên bắt gôn'}>
                                {team.goalkeeper.isShared ? 'GK dùng chung' : 'GK luân phiên trong đội'}
                              </span>
                            ) : (
                              <span className="role-badge-gk">Thủ môn</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 4 Outfield Players */}
                      {team.players?.map((p) => {
                        const isSelectedForSwap = selectedSwapPlayer?.player.userId === p.userId;
                        return (
                        <div
                            key={p.userId}
                            className={`player-row ${isSelectedForSwap ? 'selected-for-swap' : ''}`}
                            onClick={() => handleSelectForSwap(team.id, p, false)}
                            style={{
                              cursor: 'pointer',
                              borderColor: isSelectedForSwap ? 'var(--primary-500)' : undefined,
                              background: isSelectedForSwap ? 'var(--primary-50)' : undefined,
                            }}
                            title="Nhấn để chọn và hoán đổi với cầu thủ khác"
                          >
                            <div className="player-info-cell">
                              <span className="player-avatar-small">
                                {p.avatar ? <img src={p.avatar} alt="" /> : p.displayName?.[0]}
                              </span>
                              <span className="player-name-text">{p.displayName}</span>
                            </div>
                            <div className="player-tags">
                              {p.tier && (
                                <span className={`badge member-tier-badge tier-${p.tier.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 4px' }}>
                                  {p.tier}
                                </span>
                              )}
                              {isSelectedForSwap && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--primary-600)', fontWeight: 700 }}>
                                  Đang chọn...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reserves Box */}
              {generatedData.reserves?.length > 0 && (
                <div className="reserves-box" style={{ marginTop: 16 }}>
                  <div className="reserves-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Danh sách dự bị / Chờ ({generatedData.reserves.length} người)
                  </div>
                  <div className="reserves-list">
                    {generatedData.reserves.map(r => (
                      <span key={r.userId} className="reserve-chip">
                        #{r.reserveOrder} {r.displayName} {r.tier ? `(${r.tier})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="team-gen-footer">
          <button type="button" className="btn-modal-cancel" onClick={onClose} disabled={saving}>
            Hủy bỏ
          </button>
          <button
            type="button"
            className="btn-modal-submit"
            onClick={handleSaveTeams}
            disabled={saving || loading || !generatedData}
            id="btn-save-teams-confirm"
          >
            {saving ? (
              <><span className="spinner spinner-sm"></span> Đang lưu...</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Lưu danh sách đội
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
