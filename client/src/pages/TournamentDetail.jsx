import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tournamentsAPI, usersAPI } from '../services/api';
import { Badge, Button, Card, Input, Select } from '../components/ui/index.jsx';
import Modal from '../components/Modal/Modal';
import { useConfirmation } from '../components/Modal/ConfirmDialog';
import Toast from '../components/Toast/Toast';
import './TournamentDetail.css';

const POSITIONS = [
  { code: 'GK', display: 'GK', label: 'Thủ môn', className: 'pos-gk' },
  { code: 'FIXO', display: 'FIXO', label: 'Thòng', className: 'pos-fixo' },
  { code: 'ALA_LEFT', display: 'ALA', label: 'Cánh T', className: 'pos-ala-left' },
  { code: 'ALA_RIGHT', display: 'ALA', label: 'Cánh P', className: 'pos-ala-right' },
  { code: 'PIVOT', display: 'PIVOT', label: 'Tiền đạo', className: 'pos-pivot' },
];

const PHASE_CONFIG = {
  DRAFT: { label: 'Đang mở đăng ký', badgeClass: 'badge-confirmed' },
  REGISTRATION_CLOSED: { label: 'Đã chốt đăng ký (Xếp đội)', badgeClass: 'badge-pending' },
  GROUP_STAGE: { label: 'Vòng bảng', badgeClass: 'badge-pending' },
  KNOCKOUT: { label: 'Vòng Knockout', badgeClass: 'badge-booked' },
  COMPLETED: { label: 'Đã hoàn tất', badgeClass: 'badge-completed' },
};

const MATCH_STATUS_LABELS = {
  SCHEDULED: { label: 'Sắp diễn ra', className: 'status-scheduled' },
  LIVE: { label: 'Đang đá', className: 'status-live' },
  FINISHED: { label: 'Đã kết thúc', className: 'status-finished' },
};

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { confirm, confirmationDialog } = useConfirmation();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'arena' | 'fixtures' | 'standings' | 'teams' | 'registration'
  const [activeTab, setActiveTab] = useState(null);
  const hasInitializedTab = useRef(false);
  const [streamStatus, setStreamStatus] = useState('connecting');
  const [toast, setToast] = useState(null);

  // Form đăng ký vị trí
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [regNote, setRegNote] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  // Modal Admin thêm thành viên
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [clubMembers, setClubMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adminSelectedPositions, setAdminSelectedPositions] = useState(['FIXO']);
  const [adminNote, setAdminNote] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Trạng thái chia đội tự động & chỉnh sửa đội bằng tay
  const [balancingTeams, setBalancingTeams] = useState(false);
  const [selectedSwapPlayer, setSelectedSwapPlayer] = useState(null); // { teamId, player }
  const [savingTeams, setSavingTeams] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingTeamGroup, setEditingTeamGroup] = useState('A');

  // Modal chuyển sang vòng Knockout / Phân cặp Knockout
  const [isKnockoutModalOpen, setIsKnockoutModalOpen] = useState(false);
  const [includeBottomMatch, setIncludeBottomMatch] = useState(true);
  const [generatingKnockout, setGeneratingKnockout] = useState(false);

  // Modal cập nhật trận đấu (sửa cặp đấu, thời gian, tỷ số, cầu thủ ghi bàn/kiến tạo)
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchForm, setMatchForm] = useState({
    title: '',
    homeTeamId: '',
    awayTeamId: '',
    matchDate: '',
    matchTime: '',
    venue: '',
    homeScore: '0',
    awayScore: '0',
    homePenScore: '',
    awayPenScore: '',
    status: 'FINISHED',
    goals: [],
  });
  const [savingMatch, setSavingMatch] = useState(false);

  // Modal tạo trận đấu mới thủ công
  const [isCreateMatchModalOpen, setIsCreateMatchModalOpen] = useState(false);
  const [newMatchForm, setNewMatchForm] = useState({
    stage: 'GROUP',
    group: 'A',
    knockoutRound: 'SEMI_FINAL',
    title: '',
    homeTeamId: '',
    awayTeamId: '',
    matchDate: '',
    matchTime: '',
    venue: '',
  });
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Modal Tạo Form Bình Chọn MVP (Admin) & Bình chọn MVP (Member)
  const [isMvpModalOpen, setIsMvpModalOpen] = useState(false);
  const [mvpForm, setMvpForm] = useState({
    title: '',
    description: '',
    deadline: '',
    mode: 'ALL', // 'ALL' | 'SHORTLIST'
    candidateIds: [],
    resetVotes: false,
  });
  const [savingMvpPoll, setSavingMvpPoll] = useState(false);
  const [selectedMvpCandidateId, setSelectedMvpCandidateId] = useState('');
  const [mvpVoteComment, setMvpVoteComment] = useState('');
  const [submittingMvpVote, setSubmittingMvpVote] = useState(false);

  const abortControllerRef = useRef(null);

  const determineDefaultTab = (t) => {
    if (!t) return 'registration';
    if (['GROUP_STAGE', 'KNOCKOUT', 'COMPLETED'].includes(t.phase)) {
      return 'arena';
    }
    if (t.phase === 'REGISTRATION_CLOSED') {
      return 'teams';
    }
    return 'registration';
  };

  const applyTournamentData = (t) => {
    setTournament(t);
    if (!hasInitializedTab.current && t) {
      hasInitializedTab.current = true;
      setActiveTab(determineDefaultTab(t));
    }
    if (t?.myRegistration) {
      setSelectedPositions(t.myRegistration.positions || []);
      setRegNote(t.myRegistration.note || '');
    }
    if (t?.myMvpVote) {
      setSelectedMvpCandidateId(t.myMvpVote.candidateId || '');
      setMvpVoteComment(t.myMvpVote.comment || '');
    }
  };

  const fetchTournament = async () => {
    try {
      setLoading(true);
      const res = await tournamentsAPI.get(id);
      applyTournamentData(res.tournament);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tải thông tin giải đấu' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hasInitializedTab.current = false;
    fetchTournament();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    tournamentsAPI.watch(
      id,
      controller.signal,
      (updatedTournament) => {
        applyTournamentData(updatedTournament);
      },
      (status) => {
        setStreamStatus(status);
      }
    );

    return () => {
      controller.abort();
    };
  }, [id]);

  // ==========================================
  // 1. ĐĂNG KÝ THAM GIA GIẢI
  // ==========================================
  const togglePosition = (code) => {
    if (tournament?.phase !== 'DRAFT') return;
    setSelectedPositions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (selectedPositions.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 vị trí trên sơ đồ sân' });
      return;
    }

    try {
      setSubmittingReg(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'REGISTER', {
        positions: selectedPositions,
        note: regNote,
      });
      setTournament(res.tournament);
      setToast({ type: 'success', message: 'Đăng ký vị trí thi đấu thành công!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể đăng ký' });
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleCancelRegistration = async () => {
    const isConfirmed = await confirm('Bạn có chắc chắn muốn hủy đăng ký tham gia giải này?');
    if (!isConfirmed) return;

    try {
      setSubmittingReg(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'CANCEL_REGISTRATION', {});
      setTournament(res.tournament);
      setSelectedPositions([]);
      setRegNote('');
      setToast({ type: 'success', message: 'Đã hủy đăng ký thành công' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể hủy đăng ký' });
    } finally {
      setSubmittingReg(false);
    }
  };

  const openAddMemberModal = async () => {
    setIsAddMemberModalOpen(true);
    setSelectedUserId('');
    setAdminSelectedPositions(['FIXO']);
    setAdminNote('');
    if (clubMembers.length === 0) {
      try {
        setLoadingMembers(true);
        const res = await usersAPI.getMembers();
        setClubMembers(res.members || []);
      } catch {
        setToast({ type: 'error', message: 'Không thể tải danh sách thành viên' });
      } finally {
        setLoadingMembers(false);
      }
    }
  };

  const toggleAdminPosition = (code) => {
    setAdminSelectedPositions((prev) =>
      prev.includes(code)
        ? (prev.length > 1 ? prev.filter((p) => p !== code) : prev)
        : [...prev, code]
    );
  };

  const handleAdminAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setToast({ type: 'error', message: 'Vui lòng chọn thành viên cần thêm' });
      return;
    }
    if (adminSelectedPositions.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 vị trí thi đấu' });
      return;
    }

    try {
      setAddingMember(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'ADMIN_ADD_REGISTRATION', {
        userId: selectedUserId,
        positions: adminSelectedPositions,
        note: adminNote,
      });
      setTournament(res.tournament);
      setIsAddMemberModalOpen(false);
      setToast({ type: 'success', message: 'Đã thêm thành viên vào giải đấu thành công!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể thêm thành viên' });
    } finally {
      setAddingMember(false);
    }
  };

  const handleAdminRemoveMember = async (reg) => {
    const isConfirmed = await confirm(`Bạn có chắc muốn xóa cầu thủ "${reg.displayName}" khỏi danh sách tham gia giải?`);
    if (!isConfirmed) return;

    try {
      const res = await tournamentsAPI.command(id, tournament.revision, 'ADMIN_REMOVE_REGISTRATION', {
        userId: reg.userId,
      });
      setTournament(res.tournament);
      setToast({ type: 'success', message: `Đã xóa "${reg.displayName}" khỏi danh sách đăng ký` });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể xóa cầu thủ' });
    }
  };

  const handleLockRegistration = async () => {
    const regCount = tournament.state?.registrations?.length || 0;
    const isConfirmed = await confirm(
      `Bạn có chắc chắn muốn chốt danh sách đăng ký (${regCount} cầu thủ)? Sau khi chốt, thành viên sẽ không thể đăng ký hoặc hủy đăng ký tự do, và BTC có thể tiến hành chia đội.`
    );
    if (!isConfirmed) return;

    try {
      const res = await tournamentsAPI.command(id, tournament.revision, 'LOCK_REGISTRATION', {});
      setTournament(res.tournament);
      setActiveTab('teams');
      setToast({ type: 'success', message: 'Đã chốt danh sách đăng ký! Bạn có thể tiến hành chia đội.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể chốt danh sách đăng ký' });
    }
  };

  const handleReopenRegistration = async () => {
    const isConfirmed = await confirm(
      'Mở lại đăng ký sẽ cho phép các thành viên tiếp tục đăng ký hoặc hủy tham gia giải. Bạn có chắc chắn muốn mở lại đăng ký?'
    );
    if (!isConfirmed) return;

    try {
      const res = await tournamentsAPI.command(id, tournament.revision, 'REOPEN_REGISTRATION', {});
      setTournament(res.tournament);
      setActiveTab('registration');
      setToast({ type: 'success', message: 'Đã mở lại đăng ký cho giải đấu thành công!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể mở lại đăng ký' });
    }
  };

  // ==========================================
  // 2. CHIA ĐỘI TỰ ĐỘNG & CHUYỂN ĐỔI BẰNG TAY
  // ==========================================
  const handleAutoBalance = async () => {
    if (tournament.phase === 'DRAFT') {
      const shouldLock = await confirm(
        'Bạn cần chốt danh sách đăng ký trước khi tiến hành chia đội. Bạn có muốn chốt danh sách đăng ký và tự động chia đội ngay bây giờ không?'
      );
      if (!shouldLock) return;

      try {
        setBalancingTeams(true);
        const lockRes = await tournamentsAPI.command(id, tournament.revision, 'LOCK_REGISTRATION', {});
        const balanceRes = await tournamentsAPI.command(id, lockRes.tournament.revision, 'AUTO_BALANCE_TEAMS', {
          teamCount: tournament.settings?.teamCount || 6,
          playersPerTeam: tournament.settings?.playersPerTeam || 7,
        });
        setTournament(balanceRes.tournament);
        setSelectedSwapPlayer(null);
        setActiveTab('teams');
        setToast({
          type: 'success',
          message: `Đã chốt đăng ký và tự động chia đều ${balanceRes.tournament.state?.registrations?.length || 0} cầu thủ vào các đội!`,
        });
      } catch (err) {
        setToast({ type: 'error', message: err.message || 'Không thể chia đội tự động' });
      } finally {
        setBalancingTeams(false);
      }
      return;
    }

    const teamCount = tournament.settings?.teamCount || 6;
    const playersPerTeam = tournament.settings?.playersPerTeam || 7;
    const isConfirmed = await confirm(
      `Hệ thống sẽ tự động phân bổ ${tournament.state?.registrations?.length || 0} cầu thủ vào ${teamCount} đội theo trình độ (Tier) và vị trí thi đấu. Bạn có muốn tiếp tục?`
    );
    if (!isConfirmed) return;

    try {
      setBalancingTeams(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'AUTO_BALANCE_TEAMS', {
        teamCount,
        playersPerTeam,
      });
      setTournament(res.tournament);
      setSelectedSwapPlayer(null);
      setActiveTab('teams');
      setToast({
        type: 'success',
        message: `Đã tự động chia đều ${tournament.state?.registrations?.length || 0} cầu thủ vào ${teamCount} đội!`,
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tự động chia đội' });
    } finally {
      setBalancingTeams(false);
    }
  };

  const commitUpdatedTeams = async (nextTeams, successMessage = 'Đã cập nhật đội hình!') => {
    try {
      setSavingTeams(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'SET_TEAMS', {
        teams: nextTeams,
      });
      setTournament(res.tournament);
      setToast({ type: 'success', message: successMessage });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể lưu thay đổi đội hình' });
    } finally {
      setSavingTeams(false);
    }
  };

  const handlePlayerClickForSwap = async (teamId, player) => {
    if (!tournament?.canManage || savingTeams) return;

    if (!selectedSwapPlayer) {
      setSelectedSwapPlayer({ teamId, player });
      return;
    }

    // Nếu bấm lại chính cầu thủ đang chọn -> hủy chọn
    if (selectedSwapPlayer.player.userId === player.userId) {
      setSelectedSwapPlayer(null);
      return;
    }

    // Hoán đổi 2 cầu thủ giữa 2 đội (hoặc trong cùng 1 đội)
    const currentTeams = structuredClone(tournament.state?.teams || []);
    const sourceTeam = currentTeams.find((t) => t.id === selectedSwapPlayer.teamId);
    const targetTeam = currentTeams.find((t) => t.id === teamId);
    if (!sourceTeam || !targetTeam) {
      setSelectedSwapPlayer(null);
      return;
    }

    const idxA = sourceTeam.players.findIndex((p) => p.userId === selectedSwapPlayer.player.userId);
    const idxB = targetTeam.players.findIndex((p) => p.userId === player.userId);
    if (idxA === -1 || idxB === -1) {
      setSelectedSwapPlayer(null);
      return;
    }

    const playerA = { ...sourceTeam.players[idxA], isCaptain: false };
    const playerB = { ...targetTeam.players[idxB], isCaptain: false };

    sourceTeam.players[idxA] = playerB;
    targetTeam.players[idxB] = playerA;

    const msg = sourceTeam.id === targetTeam.id
      ? `Đã đổi thứ tự ${playerA.displayName} và ${playerB.displayName}`
      : `Đã hoán đổi ${playerA.displayName} (${sourceTeam.name}) ⇄ ${playerB.displayName} (${targetTeam.name})`;

    setSelectedSwapPlayer(null);
    await commitUpdatedTeams(currentTeams, msg);
  };

  const handleMoveSelectedPlayerToTeam = async (targetTeamId) => {
    if (!selectedSwapPlayer || !tournament?.canManage || savingTeams) return;
    if (selectedSwapPlayer.teamId === targetTeamId) return;

    const currentTeams = structuredClone(tournament.state?.teams || []);
    const targetTeam = currentTeams.find((t) => t.id === targetTeamId);
    if (!targetTeam) return;

    let movedPlayer = null;
    if (selectedSwapPlayer.teamId === '__UNASSIGNED__') {
      const reg = selectedSwapPlayer.player;
      movedPlayer = {
        userId: reg.userId,
        displayName: reg.displayName,
        username: reg.username,
        avatar: reg.avatar || null,
        tier: reg.tier || 'C',
        position: Array.isArray(reg.positions) && reg.positions.length > 0 ? reg.positions[0] : 'FIXO',
        isCaptain: false,
      };
    } else {
      const sourceTeam = currentTeams.find((t) => t.id === selectedSwapPlayer.teamId);
      if (!sourceTeam) return;
      const idx = sourceTeam.players.findIndex((p) => p.userId === selectedSwapPlayer.player.userId);
      if (idx === -1) return;
      [movedPlayer] = sourceTeam.players.splice(idx, 1);
      movedPlayer.isCaptain = false;
    }

    targetTeam.players.push(movedPlayer);
    setSelectedSwapPlayer(null);
    await commitUpdatedTeams(
      currentTeams,
      `Đã chuyển ${movedPlayer.displayName} sang ${targetTeam.name}`
    );
  };

  const handleChangeSelectedPlayerPosition = async (newPosition) => {
    if (!selectedSwapPlayer || selectedSwapPlayer.teamId === '__UNASSIGNED__' || savingTeams) return;
    const currentTeams = structuredClone(tournament.state?.teams || []);
    const team = currentTeams.find((t) => t.id === selectedSwapPlayer.teamId);
    if (!team) return;
    const p = team.players.find((x) => x.userId === selectedSwapPlayer.player.userId);
    if (!p) return;
    p.position = newPosition;
    setSelectedSwapPlayer({ teamId: team.id, player: { ...p } });
    await commitUpdatedTeams(currentTeams, `Đã đổi vị trí của ${p.displayName} thành ${newPosition}`);
  };

  const handleSetSelectedPlayerCaptain = async () => {
    if (!selectedSwapPlayer || selectedSwapPlayer.teamId === '__UNASSIGNED__' || savingTeams) return;
    const currentTeams = structuredClone(tournament.state?.teams || []);
    const team = currentTeams.find((t) => t.id === selectedSwapPlayer.teamId);
    if (!team) return;
    for (const p of team.players) {
      p.isCaptain = p.userId === selectedSwapPlayer.player.userId;
    }
    team.captainId = selectedSwapPlayer.player.userId;
    team.captainName = selectedSwapPlayer.player.displayName;
    setSelectedSwapPlayer(null);
    await commitUpdatedTeams(
      currentTeams,
      `Đã chọn ${selectedSwapPlayer.player.displayName} làm Đội trưởng ${team.name}`
    );
  };

  const handleSaveTeamMeta = async (teamId) => {
    if (!editingTeamName.trim()) return;
    const currentTeams = structuredClone(tournament.state?.teams || []);
    const team = currentTeams.find((t) => t.id === teamId);
    if (!team) return;
    team.name = editingTeamName.trim();
    team.group = editingTeamGroup;
    setEditingTeamId(null);
    await commitUpdatedTeams(currentTeams, `Đã cập nhật thông tin ${team.name}`);
  };

  // ==========================================
  // 3. KHỞI TRANH & CHUYỂN VÒNG KNOCKOUT
  // ==========================================
  const handleStartTournament = async () => {
    const isConfirmed = await confirm('Chính thức bắt đầu vòng bảng giải đấu và tạo lịch thi đấu?');
    if (!isConfirmed) return;

    try {
      const res = await tournamentsAPI.command(id, tournament.revision, 'START_TOURNAMENT', {});
      setTournament(res.tournament);
      setActiveTab('arena');
      setToast({ type: 'success', message: 'Giải đấu đã chính thức bắt đầu!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể bắt đầu giải đấu' });
    }
  };

  const openKnockoutModal = () => {
    const currentBottom = tournament?.settings?.includeBottomMatch;
    setIncludeBottomMatch(currentBottom !== undefined ? Boolean(currentBottom) : true);
    setIsKnockoutModalOpen(true);
  };

  const handleConfirmGenerateKnockout = async () => {
    try {
      setGeneratingKnockout(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'GENERATE_KNOCKOUT', {
        includeBottomMatch,
      });
      setTournament(res.tournament);
      setIsKnockoutModalOpen(false);
      setActiveTab('arena');
      setToast({
        type: 'success',
        message: 'Đã chuyển sang Vòng Knockout và tự động phân chia các cặp đấu!',
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tạo lịch vòng Knockout' });
    } finally {
      setGeneratingKnockout(false);
    }
  };

  const handleToggleBottomMatch = async () => {
    try {
      const res = await tournamentsAPI.command(id, tournament.revision, 'TOGGLE_BOTTOM_MATCH', {});
      setTournament(res.tournament);
      const hasBottom = (res.tournament.state?.fixtures || []).some((f) => f.matchCode === 'PL_BOTTOM');
      setToast({
        type: 'success',
        message: hasBottom
          ? 'Đã thêm trận đấu giữa 2 đội cuối bảng!'
          : 'Đã ẩn trận đấu giữa 2 đội cuối bảng.',
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể cập nhật trận đấu cuối bảng' });
    }
  };

  const handleCompleteTournament = async () => {
    const isConfirmed = await confirm('Hoàn tất và kết thúc giải đấu? Bạn vẫn có thể mở Form bình chọn MVP cho giải đấu.');
    if (!isConfirmed) return;

    try {
      const res = await tournamentsAPI.command(id, tournament.revision, 'ADVANCE_PHASE', {
        phase: 'COMPLETED',
      });
      setTournament(res.tournament);
      setToast({ type: 'success', message: 'Giải đấu đã hoàn tất!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Thao tác thất bại' });
    }
  };

  // ==========================================
  // 4. QUẢN LÝ TRẬN ĐẤU (SỬA CẶP ĐẤU, THỜI GIAN, TỶ SỐ, BÀN THẮNG & KIẾN TẠO)
  // ==========================================
  const openEditMatchModal = (match) => {
    setEditingMatch(match);
    setMatchForm({
      title: match.title || (match.stage === 'KNOCKOUT' ? 'Vòng Knockout' : `Vòng bảng · Bảng ${match.group || 'A'}`),
      homeTeamId: match.homeTeamId || '',
      awayTeamId: match.awayTeamId || '',
      matchDate: match.matchDate || '',
      matchTime: match.matchTime || '',
      venue: match.venue || '',
      homeScore: match.homeScore !== null && match.homeScore !== undefined ? String(match.homeScore) : '0',
      awayScore: match.awayScore !== null && match.awayScore !== undefined ? String(match.awayScore) : '0',
      homePenScore: match.homePenScore !== null && match.homePenScore !== undefined ? String(match.homePenScore) : '',
      awayPenScore: match.awayPenScore !== null && match.awayPenScore !== undefined ? String(match.awayPenScore) : '',
      status: match.status || 'SCHEDULED',
      goals: Array.isArray(match.goals) ? structuredClone(match.goals) : [],
    });
  };

  const handleScoreInputChange = (side, rawValue) => {
    const numVal = rawValue === '' ? 0 : Math.max(0, Number(rawValue) || 0);
    setMatchForm((prev) => {
      const teamId = side === 'home' ? prev.homeTeamId : prev.awayTeamId;
      const scoreField = side === 'home' ? 'homeScore' : 'awayScore';
      const nextStatus = prev.status === 'SCHEDULED' && numVal > 0 ? 'FINISHED' : prev.status;

      if (!teamId) {
        return { ...prev, [scoreField]: String(numVal), status: nextStatus };
      }

      const teamGoals = prev.goals.filter((g) => g.teamId === teamId);
      const otherGoals = prev.goals.filter((g) => g.teamId !== teamId);
      let updatedTeamGoals = [...teamGoals];

      if (numVal > teamGoals.length && numVal <= 25) {
        const toAdd = numVal - teamGoals.length;
        for (let i = 0; i < toAdd; i++) {
          updatedTeamGoals.push({
            id: `goal-${Date.now()}-${ side }-${teamGoals.length + i}-${Math.random().toString(36).slice(2, 6)}`,
            teamId,
            scorerId: '',
            scorerName: '',
            assistId: '',
            assistName: '',
            minute: '',
            count: 1,
          });
        }
      } else if (numVal < teamGoals.length) {
        // Chỉ tự động cắt bớt các dòng chưa chọn người ghi bàn ở cuối, hoặc cắt về đúng số bàn
        updatedTeamGoals = updatedTeamGoals.slice(0, numVal);
      }

      return {
        ...prev,
        [scoreField]: String(numVal),
        status: nextStatus,
        goals: [...otherGoals, ...updatedTeamGoals],
      };
    });
  };

  const handleAddGoalRow = (teamId) => {
    if (!teamId) {
      setToast({ type: 'error', message: 'Vui lòng chọn đội bóng trước khi thêm người ghi bàn' });
      return;
    }
    setMatchForm((prev) => {
      const isHome = teamId === prev.homeTeamId;
      const isAway = teamId === prev.awayTeamId;
      const currentTeamGoalCount = prev.goals.filter((g) => g.teamId === teamId).length;
      const nextGoals = [
        ...prev.goals,
        {
          id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          teamId,
          scorerId: '',
          scorerName: '',
          assistId: '',
          assistName: '',
          minute: '',
          count: 1,
        },
      ];

      const nextTeamGoalCount = currentTeamGoalCount + 1;
      const currentHomeScore = Number(prev.homeScore) || 0;
      const currentAwayScore = Number(prev.awayScore) || 0;

      return {
        ...prev,
        status: prev.status === 'SCHEDULED' ? 'FINISHED' : prev.status,
        homeScore: isHome ? String(Math.max(currentHomeScore, nextTeamGoalCount)) : prev.homeScore,
        awayScore: isAway ? String(Math.max(currentAwayScore, nextTeamGoalCount)) : prev.awayScore,
        goals: nextGoals,
      };
    });
  };

  const handleUpdateGoalRow = (goalId, field, value) => {
    const allPlayers = (tournament?.state?.teams || []).flatMap((t) => t.players || []);
    setMatchForm((prev) => {
      const nextGoals = prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const updated = { ...g, [field]: value };
        if (field === 'scorerId') {
          const found = allPlayers.find((p) => p.userId === value);
          updated.scorerName = found ? found.displayName : '';
        }
        if (field === 'assistId') {
          const found = allPlayers.find((p) => p.userId === value);
          updated.assistName = found ? found.displayName : '';
        }
        return updated;
      });
      return { ...prev, goals: nextGoals };
    });
  };

  const handleRemoveGoalRow = (goalId) => {
    setMatchForm((prev) => {
      const target = prev.goals.find((g) => g.id === goalId);
      const nextGoals = prev.goals.filter((g) => g.id !== goalId);
      if (!target) return { ...prev, goals: nextGoals };

      const isHome = target.teamId === prev.homeTeamId;
      const isAway = target.teamId === prev.awayTeamId;
      const prevTeamCount = prev.goals.filter((g) => g.teamId === target.teamId).length;
      const nextTeamCount = nextGoals.filter((g) => g.teamId === target.teamId).length;

      let nextHomeScore = prev.homeScore;
      let nextAwayScore = prev.awayScore;
      if (isHome && Number(prev.homeScore) === prevTeamCount) {
        nextHomeScore = String(nextTeamCount);
      }
      if (isAway && Number(prev.awayScore) === prevTeamCount) {
        nextAwayScore = String(nextTeamCount);
      }

      return {
        ...prev,
        homeScore: nextHomeScore,
        awayScore: nextAwayScore,
        goals: nextGoals,
      };
    });
  };

  const handleSaveMatch = async (e) => {
    e.preventDefault();
    if (!editingMatch) return;

    if (matchForm.homeTeamId && matchForm.awayTeamId && matchForm.homeTeamId === matchForm.awayTeamId) {
      setToast({ type: 'error', message: 'Đội 1 và Đội 2 không được trùng nhau' });
      return;
    }

    const isKnockout = editingMatch.stage === 'KNOCKOUT';
    const hScore = Number(matchForm.homeScore) || 0;
    const aScore = Number(matchForm.awayScore) || 0;

    if (
      isKnockout &&
      matchForm.status === 'FINISHED' &&
      hScore === aScore &&
      tournament.settings?.hasPenalty !== false
    ) {
      if (matchForm.homePenScore === '' || matchForm.awayPenScore === '') {
        setToast({
          type: 'error',
          message: 'Trận vòng Knockout có tỷ số hòa, vui lòng nhập tỷ số luân lưu Penalty để xác định đội thắng!',
        });
        return;
      }
      if (Number(matchForm.homePenScore) === Number(matchForm.awayPenScore)) {
        setToast({
          type: 'error',
          message: 'Tỷ số luân lưu Penalty không thể hòa nhau!',
        });
        return;
      }
    }

    try {
      setSavingMatch(true);
      const validGoals = matchForm.goals.filter((g) => g.scorerId);
      const res = await tournamentsAPI.command(id, tournament.revision, 'UPDATE_MATCH', {
        fixtureId: editingMatch.id,
        title: matchForm.title,
        homeTeamId: matchForm.homeTeamId || null,
        awayTeamId: matchForm.awayTeamId || null,
        matchDate: matchForm.matchDate,
        matchTime: matchForm.matchTime,
        venue: matchForm.venue,
        homeScore: matchForm.status === 'SCHEDULED' ? null : hScore,
        awayScore: matchForm.status === 'SCHEDULED' ? null : aScore,
        homePenScore: matchForm.homePenScore !== '' ? Number(matchForm.homePenScore) : null,
        awayPenScore: matchForm.awayPenScore !== '' ? Number(matchForm.awayPenScore) : null,
        goals: validGoals,
        status: matchForm.status,
      });
      setTournament(res.tournament);
      setEditingMatch(null);
      setToast({ type: 'success', message: 'Đã lưu thông tin & kết quả trận đấu!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể lưu trận đấu' });
    } finally {
      setSavingMatch(false);
    }
  };

  const handleDeleteMatch = async (fixtureId) => {
    const isConfirmed = await confirm('Bạn có chắc chắn muốn xóa trận đấu này khỏi lịch thi đấu?');
    if (!isConfirmed) return;

    try {
      setSavingMatch(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'DELETE_MATCH', {
        fixtureId,
      });
      setTournament(res.tournament);
      setEditingMatch(null);
      setToast({ type: 'success', message: 'Đã xóa trận đấu' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể xóa trận đấu' });
    } finally {
      setSavingMatch(false);
    }
  };

  const handleCreateCustomMatch = async (e) => {
    e.preventDefault();
    if (newMatchForm.homeTeamId && newMatchForm.awayTeamId && newMatchForm.homeTeamId === newMatchForm.awayTeamId) {
      setToast({ type: 'error', message: 'Hai đội trong cặp đấu không được trùng nhau' });
      return;
    }

    try {
      setCreatingMatch(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'CREATE_MATCH', newMatchForm);
      setTournament(res.tournament);
      setIsCreateMatchModalOpen(false);
      setToast({ type: 'success', message: 'Đã thêm trận đấu mới vào lịch thi đấu!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tạo trận đấu' });
    } finally {
      setCreatingMatch(false);
    }
  };

  // ==========================================
  // 5. FORM BÌNH CHỌN MVP CỦA GIẢI ĐẤU
  // ==========================================
  const openCreateMvpModal = () => {
    const existingPoll = tournament?.mvpVoting;
    const topPlayers = [
      ...(tournament?.leaderboards?.topScorers || []).slice(0, 4).map((p) => p.userId),
      ...(tournament?.leaderboards?.topAssists || []).slice(0, 4).map((p) => p.userId),
    ];
    const uniqueTopIds = Array.from(new Set(topPlayers));

    setMvpForm({
      title: existingPoll?.title || `Bình chọn Cầu thủ xuất sắc nhất (MVP) - ${tournament?.title || ''}`,
      description:
        existingPoll?.description ||
        'Trận Chung kết đã khép lại! Hãy bình chọn cho cầu thủ có màn trình diễn ấn tượng và đóng góp xuất sắc nhất giải đấu.',
      deadline: existingPoll?.deadline || '',
      mode: Array.isArray(existingPoll?.candidateIds) && existingPoll.candidateIds.length > 0 ? 'SHORTLIST' : 'ALL',
      candidateIds:
        Array.isArray(existingPoll?.candidateIds) && existingPoll.candidateIds.length > 0
          ? existingPoll.candidateIds
          : uniqueTopIds,
      resetVotes: false,
    });
    setIsMvpModalOpen(true);
  };

  const handleToggleMvpCandidate = (userId) => {
    setMvpForm((prev) => ({
      ...prev,
      candidateIds: prev.candidateIds.includes(userId)
        ? prev.candidateIds.filter((x) => x !== userId)
        : [...prev.candidateIds, userId],
    }));
  };

  const handleAutoSelectTopCandidates = () => {
    const topIds = Array.from(
      new Set([
        ...(tournament?.leaderboards?.topScorers || []).slice(0, 5).map((p) => p.userId),
        ...(tournament?.leaderboards?.topAssists || []).slice(0, 5).map((p) => p.userId),
      ])
    );
    if (topIds.length === 0) {
      const captains = (tournament?.state?.teams || [])
        .map((t) => t.captainId)
        .filter(Boolean);
      setMvpForm((prev) => ({ ...prev, mode: 'SHORTLIST', candidateIds: captains }));
    } else {
      setMvpForm((prev) => ({ ...prev, mode: 'SHORTLIST', candidateIds: topIds }));
    }
  };

  const handleSaveMvpPoll = async (e) => {
    e.preventDefault();
    if (mvpForm.mode === 'SHORTLIST' && mvpForm.candidateIds.length < 2) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 2 ứng viên đề cử trong danh sách rút gọn' });
      return;
    }

    try {
      setSavingMvpPoll(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'CREATE_MVP_POLL', {
        title: mvpForm.title,
        description: mvpForm.description,
        deadline: mvpForm.deadline || null,
        candidateIds: mvpForm.mode === 'SHORTLIST' ? mvpForm.candidateIds : null,
        resetVotes: mvpForm.resetVotes,
      });
      setTournament(res.tournament);
      setIsMvpModalOpen(false);
      setToast({
        type: 'success',
        message: 'Đã mở Form bình chọn Cầu thủ MVP của giải cho tất cả thành viên!',
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tạo form bình chọn MVP' });
    } finally {
      setSavingMvpPoll(false);
    }
  };

  const handleCastMvpVote = async (e) => {
    e.preventDefault();
    if (!selectedMvpCandidateId) {
      setToast({ type: 'error', message: 'Vui lòng chọn 1 cầu thủ để bình chọn MVP' });
      return;
    }

    try {
      setSubmittingMvpVote(true);
      const res = await tournamentsAPI.command(id, tournament.revision, 'VOTE_MVP', {
        candidateId: selectedMvpCandidateId,
        comment: mvpVoteComment,
      });
      setTournament(res.tournament);
      setToast({ type: 'success', message: 'Đã ghi nhận phiếu bầu MVP của bạn!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể gửi bình chọn MVP' });
    } finally {
      setSubmittingMvpVote(false);
    }
  };

  const handleCloseMvpPoll = async () => {
    const topCandidate = tournament?.leaderboards?.mvpCandidates?.[0];
    const isConfirmed = await confirm(
      topCandidate && topCandidate.mvpVotes > 0
        ? `Đóng cổng bình chọn và công bố "${topCandidate.displayName}" (${topCandidate.mvpVotes} phiếu) là Cầu thủ MVP của giải?`
        : 'Bạn có chắc chắn muốn đóng cổng bình chọn MVP?'
    );
    if (!isConfirmed) return;

    try {
      const res = await tournamentsAPI.command(id, tournament.revision, 'CLOSE_MVP_POLL', {
        winnerId: topCandidate?.mvpVotes > 0 ? topCandidate.userId : null,
      });
      setTournament(res.tournament);
      setToast({ type: 'success', message: 'Đã chốt kết quả bình chọn MVP của giải!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể đóng bình chọn MVP' });
    }
  };

  const handleReopenMvpPoll = async () => {
    try {
      const res = await tournamentsAPI.command(id, tournament.revision, 'REOPEN_MVP_POLL', {});
      setTournament(res.tournament);
      setToast({ type: 'success', message: 'Đã mở lại cổng bình chọn MVP!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể mở lại bình chọn' });
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải thông tin giải đấu...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="empty-state card">
        <p className="empty-state-title">Không tìm thấy giải đấu</p>
        <div style={{ marginTop: '16px' }}>
          <Link to="/tournaments" className="btn btn-primary">
            Quay lại danh sách giải đấu
          </Link>
        </div>
      </div>
    );
  }

  const teams = tournament.state?.teams || [];
  const registrations = tournament.state?.registrations || [];
  const fixtures = tournament.state?.fixtures || [];
  const standings = tournament.standings || [];
  const topScorers = tournament.leaderboards?.topScorers || [];
  const topAssists = tournament.leaderboards?.topAssists || [];
  const mvpCandidates = tournament.leaderboards?.mvpCandidates || [];
  const mvpWinner = tournament.leaderboards?.mvpWinner || null;
  const mvpVoting = tournament.mvpVoting || null;
  const isFinalFinished = Boolean(tournament.isFinalFinished);
  const currentTab = activeTab || determineDefaultTab(tournament);
  const phaseInfo = PHASE_CONFIG[tournament.phase] || { label: tournament.phase, badgeClass: 'badge-completed' };

  const groupFixtures = fixtures.filter((f) => f.stage === 'GROUP');
  const knockoutFixtures = fixtures.filter((f) => f.stage === 'KNOCKOUT');
  const hasBottomMatch = knockoutFixtures.some((f) => f.matchCode === 'PL_BOTTOM');

  const assignedUserIdSet = new Set(teams.flatMap((t) => (t.players || []).map((p) => p.userId)));
  const unassignedRegistrations = registrations.filter((r) => !assignedUserIdSet.has(r.userId));

  // Helper render 1 thẻ trận đấu (Fixture Card) với thời gian, cặp đấu, tỉ số và danh sách ghi bàn/kiến tạo
  const renderFixtureCard = (match) => {
    const homeTeam = teams.find((t) => t.id === match.homeTeamId);
    const awayTeam = teams.find((t) => t.id === match.awayTeamId);
    const isFinished = match.status === 'FINISHED';
    const isLive = match.status === 'LIVE';
    const matchGoals = Array.isArray(match.goals) ? match.goals : [];
    const homeGoals = matchGoals.filter((g) => g.teamId === match.homeTeamId);
    const awayGoals = matchGoals.filter((g) => g.teamId === match.awayTeamId);
    const statusInfo = MATCH_STATUS_LABELS[match.status] || MATCH_STATUS_LABELS.SCHEDULED;

    return (
      <Card
        key={match.id}
        className={`fixture-card card card-hover ${match.stage === 'KNOCKOUT' ? 'fixture-card-knockout' : ''}`}
      >
        <div className="fixture-card-top">
          <div className="fixture-meta-badges">
            <span className={`fixture-stage-tag ${match.stage === 'KNOCKOUT' ? 'is-knockout' : ''}`}>
              {match.title || (match.stage === 'KNOCKOUT' ? 'Vòng Knockout' : `Bảng ${match.group || 'A'}`)}
            </span>
            <span className={`fixture-status-pill ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="fixture-time-venue">
            {(match.matchDate || match.matchTime) ? (
              <span className="fixture-time-item">
                🕒 {match.matchTime || ''}{match.matchTime && match.matchDate ? ' · ' : ''}{match.matchDate || ''}
              </span>
            ) : (
              <span className="fixture-time-item muted">🕒 Chưa xếp giờ</span>
            )}
            {match.venue && (
              <span className="fixture-venue-item">📍 {match.venue}</span>
            )}
          </div>
        </div>

        <div className="fixture-main-row">
          <div className="fixture-team home">
            <div className="fixture-team-name-wrap">
              {homeTeam?.color && (
                <span className="team-color-dot" style={{ background: homeTeam.color }} />
              )}
              <span className="fixture-team-name">
                {homeTeam?.name || match.homeLabel || 'Chưa xác định (TBD)'}
              </span>
            </div>
            {match.homeLabel && homeTeam && (
              <span className="fixture-team-seed-hint">{match.homeLabel}</span>
            )}
          </div>

          <div className={`fixture-score-box ${isFinished ? 'finished' : isLive ? 'live' : ''}`}>
            {isFinished || isLive ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : 'VS'}
            {match.homePenScore !== null && match.homePenScore !== undefined && match.awayPenScore !== null && match.awayPenScore !== undefined && (
              <div className="fixture-pen-score">
                Pen: {match.homePenScore} - {match.awayPenScore}
              </div>
            )}
          </div>

          <div className="fixture-team away">
            <div className="fixture-team-name-wrap away">
              <span className="fixture-team-name">
                {awayTeam?.name || match.awayLabel || 'Chưa xác định (TBD)'}
              </span>
              {awayTeam?.color && (
                <span className="team-color-dot" style={{ background: awayTeam.color }} />
              )}
            </div>
            {match.awayLabel && awayTeam && (
              <span className="fixture-team-seed-hint">{match.awayLabel}</span>
            )}
          </div>
        </div>

        {/* Hiển thị danh sách cầu thủ ghi bàn & kiến tạo của trận đấu */}
        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <div className="fixture-goals-summary">
            <div className="fixture-goals-col home">
              {homeGoals.map((g, idx) => (
                <div key={g.id || idx} className="fixture-goal-item">
                  <span>⚽ <strong>{g.scorerName}</strong>{g.minute ? ` (${g.minute}')` : ''}</span>
                  {g.assistName && (
                    <span className="fixture-assist-tag">👟 KT: {g.assistName}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="fixture-goals-divider" />
            <div className="fixture-goals-col away">
              {awayGoals.map((g, idx) => (
                <div key={g.id || idx} className="fixture-goal-item">
                  <span>⚽ <strong>{g.scorerName}</strong>{g.minute ? ` (${g.minute}')` : ''}</span>
                  {g.assistName && (
                    <span className="fixture-assist-tag">👟 KT: {g.assistName}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tournament.canManage && (
          <div className="fixture-card-actions">
            <Button
              className="btn btn-outline btn-sm"
              onClick={() => openEditMatchModal(match)}
            >
              ✏️ {isFinished ? 'Sửa trận đấu / Ghi bàn' : 'Sửa cặp đấu · Giờ · Nhập tỉ số'}
            </Button>
          </div>
        )}
      </Card>
    );
  };

  // Helper render khu vực Lịch thi đấu (cả Knockout & Vòng bảng)
  const renderFixturesSection = () => (
    <div className="tournament-section-block">
      <div className="section-header-bar">
        <div>
          <h3 className="section-main-title">📅 Lịch thi đấu & Kết quả ({fixtures.length} trận)</h3>
          <p className="section-sub-desc">
            Cập nhật trực tiếp tỉ số, thời gian thi đấu, cầu thủ ghi bàn (⚽) và kiến tạo (👟)
          </p>
        </div>

        {tournament.canManage && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(tournament.phase === 'GROUP_STAGE' || tournament.phase === 'KNOCKOUT') && (
              <Button
                className="btn btn-primary btn-sm"
                onClick={openKnockoutModal}
              >
                ⚡ {knockoutFixtures.length > 0 ? 'Xếp lại cặp Vòng Knockout' : 'Chuyển & Phân cặp Vòng Knockout'}
              </Button>
            )}
            {knockoutFixtures.length > 0 && (
              <Button
                className="btn btn-outline btn-sm"
                onClick={handleToggleBottomMatch}
              >
                {hasBottomMatch ? '➖ Ẩn trận 2 đội cuối bảng' : '➕ Thêm trận 2 đội cuối bảng'}
              </Button>
            )}
            <Button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setNewMatchForm({
                  stage: tournament.phase === 'KNOCKOUT' ? 'KNOCKOUT' : 'GROUP',
                  group: 'A',
                  knockoutRound: 'CUSTOM',
                  title: '',
                  homeTeamId: teams[0]?.id || '',
                  awayTeamId: teams[1]?.id || '',
                  matchDate: '',
                  matchTime: '',
                  venue: '',
                });
                setIsCreateMatchModalOpen(true);
              }}
            >
              + Thêm trận đấu
            </Button>
          </div>
        )}
      </div>

      {fixtures.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">⚽</div>
          <p className="empty-state-title">Chưa có lịch thi đấu</p>
          <p className="empty-state-desc">
            Lịch thi đấu sẽ tự động được tạo khi BTC bắt đầu giải đấu hoặc bấm thêm trận đấu.
          </p>
          {tournament.canManage && teams.some((t) => (t.players || []).length > 0) && (
            <div style={{ marginTop: '12px' }}>
              <Button className="btn btn-primary btn-sm" onClick={handleStartTournament}>
                ▶ Khởi tạo lịch thi đấu Vòng bảng ngay
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Nhánh đấu Vòng Knockout */}
          {knockoutFixtures.length > 0 && (
            <div className="fixtures-stage-group" style={{ marginBottom: '28px' }}>
              <div className="stage-banner knockout-banner">
                <span>🔥 VÒNG KNOCKOUT & CHUNG KẾT</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                  Nhất A vs Nhì B · Nhất B vs Nhì A → Tranh hạng 3 & Chung kết
                </span>
              </div>
              <div className="fixtures-list">
                {knockoutFixtures.map((match) => renderFixtureCard(match))}
              </div>
            </div>
          )}

          {/* Nếu đang ở phase KNOCKOUT nhưng chưa có trận Knockout nào (do lỗi cũ trước đó) */}
          {tournament.phase === 'KNOCKOUT' && knockoutFixtures.length === 0 && (
            <Card className="card knockout-empty-prompt">
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--primary-800)' }}>
                  ⚡ Chưa phân cặp thi đấu Vòng Knockout
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Hệ thống sẽ dựa trên Bảng xếp hạng vòng bảng (Điểm → Đối đầu → Hiệu số → Bàn thắng) để ghép cặp Nhất A gặp Nhì B, Nhất B gặp Nhì A, trận 2 đội cuối bảng (tùy chọn), Tranh hạng 3 và Chung kết.
                </p>
              </div>
              {tournament.canManage && (
                <Button className="btn btn-primary" onClick={openKnockoutModal}>
                  ⚡ Tự động phân chia cặp đấu Knockout
                </Button>
              )}
            </Card>
          )}

          {/* Các trận Vòng bảng */}
          {groupFixtures.length > 0 && (
            <div className="fixtures-stage-group">
              <div className="stage-banner group-banner">
                <span>⚽ LỊCH THI ĐẤU VÒNG BẢNG ({groupFixtures.length} trận)</span>
              </div>
              <div className="fixtures-list">
                {groupFixtures.map((match) => renderFixtureCard(match))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // Helper render Bảng xếp hạng các bảng + Khu vực Arena (Vua phá lưới, Vua kiến tạo, MVP)
  const renderStandingsAndArenaSection = () => {
    const totalMvpVotes = (mvpVoting?.votes || []).length;

    return (
      <div className="tournament-section-block">
        {/* Banner gợi ý Admin tạo Form bình chọn MVP ngay khi trận Chung kết kết thúc */}
        {tournament.canManage && isFinalFinished && !mvpVoting && (
          <div className="mvp-admin-alert-banner">
            <div>
              <strong>🏁 Trận Chung kết (trận cuối) đã kết thúc!</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem' }}>
                Hãy tạo Form bình chọn Cầu thủ xuất sắc nhất giải (MVP) để tất cả thành viên cùng bầu chọn.
              </p>
            </div>
            <Button className="btn btn-primary" onClick={openCreateMvpModal}>
              🌟 Tạo Form Bình Chọn MVP Giải Đấu
            </Button>
          </div>
        )}

        {/* 1. BẢNG XẾP HẠNG VÒNG BẢNG */}
        <div className="section-header-bar">
          <div>
            <h3 className="section-main-title">📊 Bảng xếp hạng Vòng bảng</h3>
            <p className="section-sub-desc">
              Quy tắc xét hạng: <strong>1. Điểm số</strong> → <strong>2. Thành tích đối đầu (H2H)</strong> → <strong>3. Hiệu số bàn thắng (HS)</strong> → <strong>4. Số bàn thắng (BT)</strong>
            </p>
          </div>
        </div>

        {standings.length === 0 ? (
          <div className="empty-state card" style={{ marginBottom: '24px' }}>
            <p className="empty-state-title">Chưa có dữ liệu bảng xếp hạng</p>
          </div>
        ) : (
          <div className="standings-groups-grid">
            {standings.map((groupStanding) => (
              <div key={groupStanding.group} className="standings-group-wrapper">
                <h4 className="standings-group-title">Bảng {groupStanding.group}</h4>
                <Card className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="standings-table">
                      <thead>
                        <tr>
                          <th style={{ width: '42px' }}>#</th>
                          <th style={{ textAlign: 'left' }}>Đội bóng</th>
                          <th title="Số trận đã đấu">Trận</th>
                          <th title="Thắng">T</th>
                          <th title="Hòa">H</th>
                          <th title="Bại">B</th>
                          <th title="Bàn thắng">BT</th>
                          <th title="Bàn thua">BB</th>
                          <th title="Hiệu số bàn thắng bại">HS</th>
                          <th title="Điểm đối đầu trong nhóm bằng điểm">ĐĐ</th>
                          <th title="Tổng điểm">Điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupStanding.rows.map((row, idx) => {
                          const isTopTwo = idx < 2;
                          return (
                            <tr key={row.teamId} className={isTopTwo ? 'qualify-row' : ''}>
                              <td>
                                <span className={`rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : ''}`}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="team-name-cell">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {row.color && (
                                    <span className="team-color-dot" style={{ background: row.color }} />
                                  )}
                                  <span>{row.name}</span>
                                </div>
                              </td>
                              <td>{row.played}</td>
                              <td>{row.won}</td>
                              <td>{row.drawn}</td>
                              <td>{row.lost}</td>
                              <td>{row.goalsFor}</td>
                              <td>{row.goalsAgainst}</td>
                              <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {row.h2hPoints > 0 ? `${row.h2hPoints}đ` : '-'}
                              </td>
                              <td className="points-cell">{row.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* 2. ARENA: BẢNG XẾP HẠNG VUA PHÁ LƯỚI, VUA KIẾN TẠO & CẦU THỦ MVP */}
        <div className="arena-section-wrapper">
          <div className="section-header-bar" style={{ marginTop: '12px' }}>
            <div>
              <h3 className="section-main-title">🏆 Arena · Bảng xếp hạng Cá nhân & Danh hiệu Giải đấu</h3>
              <p className="section-sub-desc">
                Vinh danh Vua phá lưới (Ghi bàn nhiều nhất), Vua kiến tạo (Kiến tạo nhiều nhất) và Cầu thủ MVP của giải
              </p>
            </div>
            {tournament.canManage && (
              <Button className="btn btn-primary btn-sm" onClick={openCreateMvpModal}>
                🌟 {mvpVoting ? 'Cấu hình Form Bình Chọn MVP' : 'Tạo Form Bình Chọn MVP'}
              </Button>
            )}
          </div>

          <div className="arena-leaderboards-grid">
            {/* BXH Cầu thủ ghi bàn nhiều nhất */}
            <Card className="card arena-card">
              <div className="arena-card-header scorer-header">
                <span>⚽ Vua Phá Lưới (Top Ghi Bàn)</span>
                <Badge className="badge badge-confirmed">{topScorers.length} cầu thủ</Badge>
              </div>
              <div className="arena-card-body">
                {topScorers.length === 0 ? (
                  <div className="arena-empty">
                    Chưa có bàn thắng nào được ghi nhận. Admin có thể gán cầu thủ ghi bàn trong từng trận đấu.
                  </div>
                ) : (
                  <div className="arena-player-list">
                    {topScorers.slice(0, 10).map((p, idx) => (
                      <div key={p.userId} className={`arena-player-row ${idx === 0 ? 'top-1' : ''}`}>
                        <div className="arena-player-left">
                          <span className={`arena-rank ${idx < 3 ? `medal-${idx + 1}` : ''}`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </span>
                          <div>
                            <div className="arena-player-name">
                              {p.displayName}
                              {p.tier && <span className="arena-tier-pill">{p.tier}</span>}
                            </div>
                            <div className="arena-player-team">
                              <span className="team-color-dot" style={{ background: p.teamColor }} />
                              {p.teamName}
                            </div>
                          </div>
                        </div>
                        <div className="arena-stat-badge goals">
                          <strong>{p.goals}</strong> <span>bàn</span>
                          {p.assists > 0 && <small>({p.assists} KT)</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* BXH Cầu thủ kiến tạo nhiều nhất */}
            <Card className="card arena-card">
              <div className="arena-card-header assist-header">
                <span>👟 Vua Kiến Tạo (Top Kiến Tạo)</span>
                <Badge className="badge badge-booked">{topAssists.length} cầu thủ</Badge>
              </div>
              <div className="arena-card-body">
                {topAssists.length === 0 ? (
                  <div className="arena-empty">
                    Chưa có kiến tạo nào được ghi nhận. Admin có thể gán người kiến tạo khi cập nhật bàn thắng trận đấu.
                  </div>
                ) : (
                  <div className="arena-player-list">
                    {topAssists.slice(0, 10).map((p, idx) => (
                      <div key={p.userId} className={`arena-player-row ${idx === 0 ? 'top-1' : ''}`}>
                        <div className="arena-player-left">
                          <span className={`arena-rank ${idx < 3 ? `medal-${idx + 1}` : ''}`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </span>
                          <div>
                            <div className="arena-player-name">
                              {p.displayName}
                              {p.tier && <span className="arena-tier-pill">{p.tier}</span>}
                            </div>
                            <div className="arena-player-team">
                              <span className="team-color-dot" style={{ background: p.teamColor }} />
                              {p.teamName}
                            </div>
                          </div>
                        </div>
                        <div className="arena-stat-badge assists">
                          <strong>{p.assists}</strong> <span>kiến tạo</span>
                          {p.goals > 0 && <small>({p.goals} bàn)</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* KHU VỰC CẦU THỦ MVP CỦA GIẢI & FORM BÌNH CHỌN */}
          <Card className="card mvp-arena-card">
            <div className="mvp-arena-header">
              <div>
                <span className="mvp-crown-tag">👑 MOST VALUABLE PLAYER</span>
                <h4 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', color: 'white' }}>
                  {mvpVoting?.title || `Cầu thủ Xuất sắc nhất giải (MVP) - ${tournament.title}`}
                </h4>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {mvpVoting && (
                  <Badge className={`badge ${mvpVoting.isOpen ? 'badge-confirmed' : 'badge-completed'}`}>
                    {mvpVoting.isOpen ? `Đang mở bình chọn (${totalMvpVotes} phiếu)` : `Đã chốt kết quả (${totalMvpVotes} phiếu)`}
                  </Badge>
                )}
                {tournament.canManage && mvpVoting && (
                  mvpVoting.isOpen ? (
                    <Button
                      className="btn btn-sm"
                      style={{ background: '#facc15', color: '#0f172a', fontWeight: 700 }}
                      onClick={handleCloseMvpPoll}
                    >
                      🏆 Chốt & Công bố MVP
                    </Button>
                  ) : (
                    <Button
                      className="btn btn-outline btn-sm"
                      style={{ background: 'white', color: '#0f172a' }}
                      onClick={handleReopenMvpPoll}
                    >
                      🔓 Mở lại bình chọn
                    </Button>
                  )
                )}
              </div>
            </div>

            <div className="mvp-arena-body">
              {/* Thẻ vinh danh MVP nếu đã có người dẫn đầu / chiến thắng */}
              {mvpWinner && (
                <div className="mvp-winner-spotlight">
                  <div className="mvp-winner-trophy">👑</div>
                  <div className="mvp-winner-info">
                    <span className="mvp-winner-label">
                      {mvpVoting?.isOpen ? 'ĐANG DẪN ĐẦU BÌNH CHỌN MVP' : 'CẦU THỦ XUẤT SẮC NHẤT GIẢI (MVP)'}
                    </span>
                    <h3 className="mvp-winner-name">{mvpWinner.displayName}</h3>
                    <div className="mvp-winner-meta">
                      <span>Đội: <strong>{mvpWinner.teamName}</strong></span>
                      <span>·</span>
                      <span>⚽ <strong>{mvpWinner.goals}</strong> bàn thắng</span>
                      <span>·</span>
                      <span>👟 <strong>{mvpWinner.assists}</strong> kiến tạo</span>
                      <span>·</span>
                      <span>🗳️ <strong>{mvpWinner.mvpVotes}</strong> phiếu bầu</span>
                    </div>
                  </div>
                </div>
              )}

              {!mvpVoting ? (
                <div className="mvp-no-poll-box">
                  <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)' }}>
                    {isFinalFinished
                      ? 'Trận Chung kết đã kết thúc! Admin có thể tạo Form bình chọn MVP ngay bây giờ.'
                      : 'Form bình chọn Cầu thủ MVP của giải sẽ được Admin mở ngay khi trận Chung kết kết thúc.'}
                  </p>
                  {tournament.canManage && (
                    <Button className="btn btn-primary" onClick={openCreateMvpModal}>
                      🌟 Tạo Form Bình Chọn MVP Ngay
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mvp-voting-layout">
                  {/* Cột trái: Form bình chọn cho thành viên */}
                  {mvpVoting.isOpen ? (
                    <form className="mvp-vote-form" onSubmit={handleCastMvpVote}>
                      <h5 style={{ margin: '0 0 6px 0', fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                        🗳️ Phiếu bình chọn MVP của bạn
                      </h5>
                      <p style={{ margin: '0 0 14px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {mvpVoting.description}
                      </p>

                      <div className="mvp-candidates-select-list">
                        {mvpCandidates.map((cand) => {
                          const isSelected = selectedMvpCandidateId === cand.userId;
                          return (
                            <label
                              key={cand.userId}
                              className={`mvp-candidate-option ${isSelected ? 'selected' : ''}`}
                            >
                              <input
                                type="radio"
                                name="mvpCandidate"
                                value={cand.userId}
                                checked={isSelected}
                                onChange={() => setSelectedMvpCandidateId(cand.userId)}
                              />
                              <div className="mvp-cand-main">
                                <span className="mvp-cand-name">{cand.displayName}</span>
                                <span className="mvp-cand-sub">
                                  {cand.teamName} · Tier {cand.tier}
                                </span>
                              </div>
                              <div className="mvp-cand-stats">
                                <span>⚽ {cand.goals}</span>
                                <span>👟 {cand.assists}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      <div className="form-group" style={{ marginTop: '12px', marginBottom: '12px' }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Lời nhắn / Lý do bình chọn (tùy chọn):
                        </label>
                        <Input
                          className="form-input"
                          value={mvpVoteComment}
                          onChange={(e) => setMvpVoteComment(e.target.value)}
                          placeholder="VD: Gánh team xuất sắc ở trận Bán kết và Chung kết!"
                        />
                      </div>

                      <Button
                        className="btn btn-primary"
                        type="submit"
                        disabled={submittingMvpVote || !selectedMvpCandidateId}
                        style={{ width: '100%' }}
                      >
                        {submittingMvpVote
                          ? 'Đang gửi phiếu bầu...'
                          : (tournament.myMvpVote ? '✓ Cập nhật phiếu bình chọn MVP' : '🗳️ Gửi bình chọn MVP')}
                      </Button>
                    </form>
                  ) : (
                    <div className="mvp-closed-notice">
                      <h5>🔒 Cổng bình chọn MVP đã khép lại</h5>
                      <p>Cảm ơn tất cả các thành viên đã tham gia bình chọn cho danh hiệu MVP của giải đấu!</p>
                    </div>
                  )}

                  {/* Cột phải: Bảng xếp hạng kết quả bình chọn MVP */}
                  <div className="mvp-results-panel">
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                      📊 Bảng xếp hạng Bình chọn MVP ({totalMvpVotes} phiếu)
                    </h5>
                    <div className="mvp-Tallies-list">
                      {mvpCandidates.slice(0, 8).map((cand, idx) => {
                        const pct = totalMvpVotes > 0 ? Math.round((cand.mvpVotes / totalMvpVotes) * 100) : 0;
                        return (
                          <div key={cand.userId} className="mvp-tally-item">
                            <div className="mvp-tally-top">
                              <span>
                                <strong>#{idx + 1} {cand.displayName}</strong>{' '}
                                <small style={{ color: 'var(--text-muted)' }}>({cand.teamName} · ⚽{cand.goals} 👟{cand.assists})</small>
                              </span>
                              <span className="mvp-tally-count">
                                <strong>{cand.mvpVotes}</strong> phiếu ({pct}%)
                              </span>
                            </div>
                            <div className="mvp-progress-track">
                              <div
                                className="mvp-progress-fill"
                                style={{ width: `${pct}%`, background: cand.teamColor || 'var(--primary-600)' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Danh sách nhận xét bình chọn gần nhất */}
                    {Array.isArray(mvpVoting.votes) && mvpVoting.votes.some((v) => v.comment) && (
                      <div className="mvp-recent-comments">
                        <h6>💬 Nhận xét từ thành viên:</h6>
                        {mvpVoting.votes
                          .filter((v) => v.comment)
                          .slice(-5)
                          .reverse()
                          .map((v, idx) => {
                            const cand = mvpCandidates.find((c) => c.userId === v.candidateId);
                            return (
                              <div key={idx} className="mvp-comment-chip">
                                <strong>{v.voterName}</strong> bầu cho <strong>{cand?.displayName || 'Cầu thủ'}</strong>: &ldquo;{v.comment}&rdquo;
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="tournament-detail-page animate-fade-in">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header đồng bộ với theme CSE HitDad */}
      <div className="dashboard-header tournament-detail-header">
        <div className="tournament-header-top">
          <Link to="/tournaments" className="back-link">
            ← Danh sách giải đấu
          </Link>

          <div className="stream-status-badge">
            <span className={`stream-dot ${streamStatus}`} />
            {streamStatus === 'live' && 'Realtime Live'}
            {streamStatus === 'connecting' && 'Đang kết nối...'}
            {streamStatus === 'offline' && 'Offline'}
          </div>
        </div>

        <h1 className="page-title" style={{ color: 'white', margin: '4px 0 10px 0' }}>
          {tournament.title}
        </h1>

        <div className="tournament-header-meta">
          <Badge className={`badge ${phaseInfo.badgeClass}`}>
            <span className="badge-dot" />
            {phaseInfo.label}
          </Badge>
          <span>Thể thức: <strong>Futsal 5v5 ({tournament.settings?.teamCount || 4} đội)</strong></span>
          <span>Đã đăng ký: <strong>{registrations.length} cầu thủ</strong></span>
          <span>Số trận: <strong>{fixtures.filter((f) => f.status === 'FINISHED').length}/{fixtures.length} hoàn tất</strong></span>
        </div>

        {/* Thao tác dành cho BTC */}
        {tournament.canManage && (
          <div className="tournament-organizer-actions">
            {tournament.phase === 'DRAFT' && (
              <Button
                className="btn btn-primary"
                onClick={handleLockRegistration}
              >
                🔒 Chốt danh sách đăng ký
              </Button>
            )}

            {tournament.phase === 'REGISTRATION_CLOSED' && (
              <>
                <Button
                  className="btn btn-primary"
                  onClick={handleStartTournament}
                >
                  ▶ Bắt đầu giải đấu (Khởi tranh)
                </Button>
                <Button
                  className="btn btn-outline"
                  style={{ background: 'white', color: 'var(--primary-900)' }}
                  onClick={handleReopenRegistration}
                >
                  🔓 Mở lại đăng ký
                </Button>
              </>
            )}

            {tournament.phase === 'GROUP_STAGE' && (
              <>
                <Button
                  className="btn btn-primary"
                  onClick={openKnockoutModal}
                >
                  ▶ Chuyển sang Vòng Knockout
                </Button>
                <Button
                  className="btn btn-outline"
                  style={{ background: 'white', color: 'var(--primary-900)' }}
                  onClick={handleReopenRegistration}
                >
                  🔓 Mở lại đăng ký
                </Button>
              </>
            )}

            {tournament.phase === 'KNOCKOUT' && (
              <>
                <Button
                  className="btn btn-primary"
                  onClick={openKnockoutModal}
                >
                  ⚡ Phân cặp lại Vòng Knockout
                </Button>
                <Button
                  className="btn btn-outline"
                  style={{ background: 'white', color: 'var(--primary-900)' }}
                  onClick={openCreateMvpModal}
                >
                  🌟 {mvpVoting ? 'Quản lý Form Bình Chọn MVP' : 'Tạo Form Bình Chọn MVP'}
                </Button>
                <Button
                  className="btn btn-outline"
                  style={{ background: 'white', color: 'var(--primary-900)' }}
                  onClick={handleCompleteTournament}
                >
                  ✓ Kết thúc giải đấu
                </Button>
              </>
            )}

            {tournament.phase === 'COMPLETED' && (
              <Button
                className="btn btn-primary"
                onClick={openCreateMvpModal}
              >
                🌟 {mvpVoting ? 'Quản lý Form Bình Chọn MVP' : 'Tạo Form Bình Chọn MVP'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs điều hướng: Khi giải đang diễn ra, tab đầu tiên hiển thị ngay Lịch thi đấu & Bảng xếp hạng (Arena) */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${currentTab === 'arena' ? 'active' : ''}`}
          onClick={() => setActiveTab('arena')}
        >
          🏟️ Lịch thi đấu & Bảng xếp hạng (Arena)
        </button>
        <button
          className={`filter-tab ${currentTab === 'fixtures' ? 'active' : ''}`}
          onClick={() => setActiveTab('fixtures')}
        >
          📅 Lịch & Tỉ số ({fixtures.length})
        </button>
        <button
          className={`filter-tab ${currentTab === 'standings' ? 'active' : ''}`}
          onClick={() => setActiveTab('standings')}
        >
          🏆 Bảng xếp hạng & MVP
        </button>
        <button
          className={`filter-tab ${currentTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          👕 Đội hình ({teams.length} đội)
        </button>
        <button
          className={`filter-tab ${currentTab === 'registration' ? 'active' : ''}`}
          onClick={() => setActiveTab('registration')}
        >
          📋 Sơ đồ & Đăng ký ({registrations.length})
        </button>
      </div>

      {/* TAB TỔNG QUAN ARENA: Hiển thị đồng thời Lịch thi đấu, Bảng xếp hạng, Top Ghi bàn/Kiến tạo & MVP */}
      {currentTab === 'arena' && (
        <div className="tournament-arena-dashboard">
          {renderFixturesSection()}
          {renderStandingsAndArenaSection()}
        </div>
      )}

      {/* TAB LỊCH THI ĐẤU & KẾT QUẢ */}
      {currentTab === 'fixtures' && renderFixturesSection()}

      {/* TAB BẢNG XẾP HẠNG & DANH HIỆU ARENA */}
      {currentTab === 'standings' && renderStandingsAndArenaSection()}

      {/* TAB ĐỘI HÌNH & CHUYỂN ĐỔI BẰNG TAY CHO ADMIN */}
      {currentTab === 'teams' && (
        <div>
          {tournament.phase === 'DRAFT' && (
            <div style={{ padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-lg)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#92400e', display: 'block', fontSize: '0.95rem' }}>
                  ⏳ Giải đấu đang trong giai đoạn mở đăng ký ({registrations.length} cầu thủ)
                </span>
                <span style={{ fontSize: '0.85rem', color: '#b45309' }}>
                  Cần chốt danh sách đăng ký trước khi tiến hành chia đội để đảm bảo không bị thay đổi nhân sự.
                </span>
              </div>
              {tournament.canManage && (
                <Button
                  className="btn btn-primary btn-sm"
                  onClick={handleLockRegistration}
                >
                  🔒 Chốt đăng ký để chia đội
                </Button>
              )}
            </div>
          )}

          <div className="teams-tab-header">
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                Đội hình thi đấu ({teams.length} đội)
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Thể thức {tournament.settings?.format || 'Futsal 5v5'}, mỗi đội {tournament.settings?.playersPerTeam || 7} cầu thủ. Đã đăng ký {registrations.length} cầu thủ.
              </p>
            </div>

            {tournament.canManage && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  className="btn btn-primary"
                  onClick={handleAutoBalance}
                  disabled={balancingTeams || savingTeams || registrations.length < (tournament.settings?.teamCount || 2)}
                >
                  {balancingTeams ? 'Đang chia đội...' : '⚡ Tự động cân bằng & chia đội'}
                </Button>
              </div>
            )}
          </div>

          {/* Thanh công cụ hướng dẫn & thao tác khi Admin đang chọn cầu thủ để hoán đổi / chuyển đội bằng tay */}
          {tournament.canManage && teams.some((t) => (t.players || []).length > 0) && (
            <div className={`manual-balance-toolbar ${selectedSwapPlayer ? 'is-selecting' : ''}`}>
              {!selectedSwapPlayer ? (
                <div className="manual-balance-hint">
                  <span>🖐️ <strong>Chỉnh sửa & Cân bằng đội bằng tay (Admin):</strong> Bấm trực tiếp vào bất kỳ cầu thủ nào bên dưới để <strong>hoán đổi vị trí (đổi chỗ)</strong> giữa các đội, <strong>chuyển sang đội khác</strong>, đổi vị trí thi đấu hoặc chọn Đội trưởng (⭐ C).</span>
                </div>
              ) : (
                <div className="manual-balance-active-bar">
                  <div className="manual-selected-info">
                    <span>Đang chọn: <strong>{selectedSwapPlayer.player.displayName}</strong> (Tier {selectedSwapPlayer.player.tier || 'C'})</span>
                    <span className="manual-selected-guide">
                      👉 Bấm vào cầu thủ khác để <strong>Hoán đổi chỗ</strong>, hoặc bấm nút <strong>&ldquo;+ Chuyển vào đội&rdquo;</strong> trên đội muốn chuyển đến.
                    </span>
                  </div>

                  <div className="manual-selected-actions">
                    {selectedSwapPlayer.teamId !== '__UNASSIGNED__' && (
                      <>
                        <Select
                          className="form-select"
                          style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }}
                          value={selectedSwapPlayer.player.position || 'FIXO'}
                          onChange={(e) => handleChangeSelectedPlayerPosition(e.target.value)}
                        >
                          {POSITIONS.map((pos) => (
                            <option key={pos.code} value={pos.code}>
                              Vị trí: {pos.display} ({pos.label})
                            </option>
                          ))}
                        </Select>

                        <Button
                          className="btn btn-outline btn-sm"
                          style={{ background: 'white' }}
                          onClick={handleSetSelectedPlayerCaptain}
                        >
                          ⭐ Đặt làm Đội trưởng
                        </Button>
                      </>
                    )}

                    <Button
                      className="btn btn-outline btn-sm"
                      style={{ background: 'white', color: 'var(--danger-600)' }}
                      onClick={() => setSelectedSwapPlayer(null)}
                    >
                      ✕ Bỏ chọn
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Danh sách cầu thủ đã đăng ký nhưng chưa được xếp vào đội nào */}
          {tournament.canManage && unassignedRegistrations.length > 0 && teams.some((t) => (t.players || []).length > 0) && (
            <Card className="card unassigned-players-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  ⚠️ Cầu thủ chưa được xếp vào đội ({unassignedRegistrations.length} người) — Bấm chọn rồi chuyển vào đội mong muốn:
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {unassignedRegistrations.map((reg) => {
                  const isSel = selectedSwapPlayer?.player?.userId === reg.userId;
                  return (
                    <button
                      key={reg.userId}
                      type="button"
                      className={`unassigned-player-chip ${isSel ? 'selected' : ''}`}
                      onClick={() =>
                        setSelectedSwapPlayer(
                          isSel ? null : { teamId: '__UNASSIGNED__', player: reg }
                        )
                      }
                    >
                      <span>{reg.displayName}</span>
                      <Badge className="badge badge-pending" style={{ fontSize: '0.68rem' }}>
                        {reg.tier || 'C'}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {teams.length === 0 ? (
            <div className="empty-state card">
              <p className="empty-state-title">Chưa có danh sách đội bóng</p>
              {tournament.canManage && (
                <div style={{ marginTop: '16px' }}>
                  <Button className="btn btn-primary" onClick={handleAutoBalance} disabled={balancingTeams}>
                    ⚡ Tự động chia đội
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="teams-grid">
              {teams.map((team) => {
                const canMoveHere = selectedSwapPlayer && selectedSwapPlayer.teamId !== team.id;

                return (
                  <Card key={team.id} className="team-card card card-hover">
                    <div
                      className="team-card-header"
                      style={{ background: team.color || 'var(--primary-600)' }}
                    >
                      {editingTeamId === team.id ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                          <input
                            type="text"
                            value={editingTeamName}
                            onChange={(e) => setEditingTeamName(e.target.value)}
                            style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', border: 'none', fontSize: '0.85rem' }}
                          />
                          <select
                            value={editingTeamGroup}
                            onChange={(e) => setEditingTeamGroup(e.target.value)}
                            style={{ padding: '4px 6px', borderRadius: '6px', border: 'none', fontSize: '0.8rem' }}
                          >
                            <option value="A">Bảng A</option>
                            <option value="B">Bảng B</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSaveTeamMeta(team.id)}
                            style={{ background: 'white', color: '#0f172a', border: 'none', borderRadius: '6px', padding: '4px 8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTeamId(null)}
                            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span>{team.name}</span>
                            {team.totalTierScore > 0 && (
                              <span className="team-tier-score" title="Tổng điểm trình độ Tier của đội">
                                {team.totalTierScore}đ · TB {team.averageTierScore}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '10px' }}>
                              Bảng {team.group || 'A'}
                            </span>
                            {tournament.canManage && (
                              <button
                                type="button"
                                title="Đổi tên đội hoặc bảng đấu"
                                onClick={() => {
                                  setEditingTeamId(team.id);
                                  setEditingTeamName(team.name);
                                  setEditingTeamGroup(team.group || 'A');
                                }}
                                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '6px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem' }}
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Nút chuyển trực tiếp cầu thủ đang chọn sang đội này */}
                    {canMoveHere && (
                      <div className="team-move-target-bar">
                        <button
                          type="button"
                          className="btn-move-to-team"
                          onClick={() => handleMoveSelectedPlayerToTeam(team.id)}
                          disabled={savingTeams}
                        >
                          📥 Chuyển &ldquo;{selectedSwapPlayer.player.displayName}&rdquo; sang {team.name}
                        </button>
                      </div>
                    )}

                    <div className="team-players-list">
                      {team.players && team.players.length > 0 ? (
                        team.players.map((p, idx) => {
                          const isSelected = selectedSwapPlayer?.player?.userId === p.userId;
                          const isSwapTarget = Boolean(selectedSwapPlayer && !isSelected);

                          return (
                            <div
                              key={p.userId || idx}
                              className={`team-player-row ${tournament.canManage ? 'is-interactive' : ''} ${isSelected ? 'selected-for-swap' : ''} ${isSwapTarget ? 'swap-target-candidate' : ''}`}
                              onClick={() => tournament.canManage && handlePlayerClickForSwap(team.id, p)}
                              title={
                                tournament.canManage
                                  ? (selectedSwapPlayer
                                      ? `Bấm để hoán đổi với ${selectedSwapPlayer.player.displayName}`
                                      : `Bấm để chọn ${p.displayName} (hoán đổi hoặc chuyển đội)`)
                                  : undefined
                              }
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span className="player-number">{idx + 1}.</span>
                                <span className="player-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {p.displayName}
                                </span>
                                {p.tier && (
                                  <Badge className="badge badge-pending" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                    {p.tier}
                                  </Badge>
                                )}
                                {p.isCaptain && (
                                  <span className="captain-star" title="Đội trưởng">
                                    ⭐ C
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isSelected && (
                                  <span className="swap-action-pill active">Đang chọn</span>
                                )}
                                {isSwapTarget && (
                                  <span className="swap-action-pill target">⇄ Đổi chỗ</span>
                                )}
                                <Badge
                                  className={`badge ${p.position === 'GK' ? 'badge-confirmed' : 'badge-completed'}`}
                                  style={{ fontSize: '0.72rem' }}
                                >
                                  {POSITIONS.find((x) => x.code === p.position)?.display || p.position}
                                </Badge>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0', textAlign: 'center' }}>
                          Chưa phân bổ cầu thủ
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB SƠ ĐỒ VỊ TRÍ & ĐĂNG KÝ */}
      {currentTab === 'registration' && (
        <div className="registration-container">
          <Card className="card futsal-pitch-wrapper">
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              Sơ đồ vị trí Futsal (Bấm trực tiếp để chọn)
            </h3>
            <div className="futsal-pitch">
              <div className="pitch-center-line" />
              <div className="pitch-center-circle" />
              <div className="pitch-penalty-top" />
              <div className="pitch-penalty-bottom" />

              {POSITIONS.map((pos) => {
                const isSelected = selectedPositions.includes(pos.code);
                return (
                  <button
                    key={pos.code}
                    type="button"
                    className={`pitch-position-btn ${pos.className} ${isSelected ? 'selected' : ''}`}
                    onClick={() => togglePosition(pos.code)}
                    disabled={tournament.phase !== 'DRAFT'}
                    title={pos.label}
                  >
                    <span className="pos-code">{pos.display || pos.code}</span>
                    <span className="pos-label">{pos.label}</span>
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
              {tournament.phase === 'DRAFT'
                ? 'Có thể chọn nhiều vị trí sở trường để BTC tiện sắp xếp đội hình.'
                : 'Giải đấu đã khóa danh sách đăng ký.'}
            </p>
          </Card>

          <Card className="card registration-form-card">
            {tournament.phase === 'DRAFT' ? (
              <form onSubmit={handleRegister}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                  {tournament.myRegistration ? 'Chỉnh sửa đăng ký của bạn' : 'Đăng ký tham gia giải'}
                </h3>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Vị trí thi đấu đã chọn:</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedPositions.length === 0 ? (
                      <span style={{ color: 'var(--danger-500)', fontSize: '0.875rem' }}>
                        Chưa chọn vị trí nào (bấm chọn trên sơ đồ sân bên trái)
                      </span>
                    ) : (
                      selectedPositions.map((p) => (
                        <Badge key={p} className="badge badge-booked">
                          {POSITIONS.find((x) => x.code === p)?.label || p}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" htmlFor="reg-note">
                    Ghi chú cho BTC (nguyện vọng đá chung, thời gian...)
                  </label>
                  <Input
                    id="reg-note"
                    className="form-input"
                    value={regNote}
                    onChange={(e) => setRegNote(e.target.value)}
                    placeholder="VD: Thuận chân trái, có kinh nghiệm bắt gôn..."
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Button
                    className="btn btn-primary"
                    type="submit"
                    disabled={submittingReg || selectedPositions.length === 0}
                  >
                    {submittingReg ? 'Đang lưu...' : (tournament.myRegistration ? 'Cập nhật đăng ký' : 'Xác nhận đăng ký')}
                  </Button>

                  {tournament.myRegistration && (
                    <Button
                      className="btn btn-outline"
                      type="button"
                      style={{ color: 'var(--danger-500)', borderColor: 'var(--danger-100)' }}
                      onClick={handleCancelRegistration}
                      disabled={submittingReg}
                    >
                      Hủy đăng ký
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              <div style={{ padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                    {tournament.phase === 'REGISTRATION_CLOSED'
                      ? `🔒 Giải đấu đã chốt đăng ký (${registrations.length} cầu thủ)`
                      : '🔒 Giải đấu đã chốt danh sách và đang thi đấu.'}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {tournament.phase === 'REGISTRATION_CLOSED'
                      ? 'Ban tổ chức đang tiến hành phân bổ đội hình thi đấu.'
                      : 'Các lượt trận đang diễn ra theo lịch thi đấu.'}
                  </span>
                </div>
                {tournament.canManage && (
                  <Button
                    className="btn btn-outline btn-sm"
                    onClick={handleReopenRegistration}
                  >
                    🔓 Mở lại đăng ký
                  </Button>
                )}
              </div>
            )}

            {/* Danh sách cầu thủ đã đăng ký */}
            <div style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  Cầu thủ đã đăng ký ({registrations.length})
                </h4>
                {tournament.canManage && tournament.phase === 'DRAFT' && (
                  <Button
                    className="btn btn-primary btn-sm"
                    onClick={openAddMemberModal}
                  >
                    + Thêm thành viên
                  </Button>
                )}
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {registrations.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Chưa có cầu thủ nào đăng ký.
                  </div>
                ) : (
                  registrations.map((r, i) => (
                    <div
                      key={r.userId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        gap: '8px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong>{i + 1}. {r.displayName}</strong>
                          {r.tier && (
                            <Badge className="badge badge-pending" style={{ fontSize: '0.72rem', padding: '1px 6px' }}>
                              Tier {r.tier}
                            </Badge>
                          )}
                        </div>
                        {r.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{r.note}</div>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {r.positions?.map((p) => {
                            const posObj = POSITIONS.find((x) => x.code === p);
                            return (
                              <Badge key={p} className="badge badge-completed" style={{ fontSize: '0.72rem' }}>
                                {posObj ? `${posObj.display} (${posObj.label})` : p}
                              </Badge>
                            );
                          })}
                        </div>

                        {tournament.canManage && tournament.phase === 'DRAFT' && (
                          <button
                            type="button"
                            className="btn-remove-player"
                            title={`Xóa ${r.displayName} khỏi giải`}
                            onClick={() => handleAdminRemoveMember(r)}
                            aria-label={`Xóa ${r.displayName}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================
          MODAL 1: CHỈNH SỬA TRẬN ĐẤU (CẶP ĐẤU, THỜI GIAN, TỈ SỐ, NGƯỜI GHI BÀN & KIẾN TẠO)
         ========================================================= */}
      <Modal
        isOpen={Boolean(editingMatch)}
        onClose={() => setEditingMatch(null)}
        ariaLabel="Chỉnh sửa trận đấu và kết quả"
      >
        {editingMatch && (
          <div className="confirm-dialog match-edit-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0 }}>Cập nhật Trận đấu & Người ghi bàn</h2>
              <Button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--danger-600)', borderColor: 'var(--danger-200)' }}
                onClick={() => handleDeleteMatch(editingMatch.id)}
              >
                🗑️ Xóa trận
              </Button>
            </div>

            <form onSubmit={handleSaveMatch}>
              {/* 1. Chỉnh sửa cặp đấu & tên trận đấu */}
              <div className="match-modal-section">
                <h4 className="match-modal-section-title">1. Cặp đấu & Trạng thái</h4>
                <div className="match-modal-grid-2" style={{ marginBottom: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Tên / Vòng đấu:</label>
                    <Input
                      className="form-input"
                      value={matchForm.title}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="VD: Bán kết 1, Chung kết..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Trạng thái trận đấu:</label>
                    <Select
                      className="form-select"
                      value={matchForm.status}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="SCHEDULED">🕒 Chưa đá / Đã lên lịch</option>
                      <option value="LIVE">🔴 Đang diễn ra (Live)</option>
                      <option value="FINISHED">✅ Đã kết thúc (Tính điểm & Xét vé)</option>
                    </Select>
                  </div>
                </div>

                <div className="match-modal-grid-2">
                  <div className="form-group">
                    <label className="form-label">Đội 1 (Đội nhà):</label>
                    <Select
                      className="form-select"
                      value={matchForm.homeTeamId}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, homeTeamId: e.target.value }))}
                    >
                      <option value="">-- Chưa xác định (TBD) --</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Bảng {t.group || 'A'})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Đội 2 (Đội khách):</label>
                    <Select
                      className="form-select"
                      value={matchForm.awayTeamId}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, awayTeamId: e.target.value }))}
                    >
                      <option value="">-- Chưa xác định (TBD) --</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Bảng {t.group || 'A'})
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* 2. Thông tin Thời gian & Sân thi đấu */}
              <div className="match-modal-section">
                <h4 className="match-modal-section-title">2. Thời gian & Địa điểm thi đấu</h4>
                <div className="match-modal-grid-3">
                  <div className="form-group">
                    <label className="form-label">Ngày thi đấu:</label>
                    <Input
                      className="form-input"
                      type="text"
                      value={matchForm.matchDate}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, matchDate: e.target.value }))}
                      placeholder="VD: 15/11/2026"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Khung giờ:</label>
                    <Input
                      className="form-input"
                      type="text"
                      value={matchForm.matchTime}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, matchTime: e.target.value }))}
                      placeholder="VD: 18:30 - 19:00"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sân thi đấu:</label>
                    <Input
                      className="form-input"
                      type="text"
                      value={matchForm.venue}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, venue: e.target.value }))}
                      placeholder="VD: Sân 1"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Gộp Tỷ số trận đấu & Cầu thủ Ghi bàn / Kiến tạo làm 1 */}
              {(() => {
                const homeTeamObj = teams.find((t) => t.id === matchForm.homeTeamId);
                const awayTeamObj = teams.find((t) => t.id === matchForm.awayTeamId);
                const homeTeamName = homeTeamObj?.name || 'Đội 1';
                const awayTeamName = awayTeamObj?.name || 'Đội 2';
                const homeColor = homeTeamObj?.color || 'var(--primary-600)';
                const awayColor = awayTeamObj?.color || '#2563eb';
                const showPenalty =
                  tournament.settings?.hasPenalty !== false &&
                  (editingMatch.stage === 'KNOCKOUT' ||
                    matchForm.homePenScore !== '' ||
                    matchForm.awayPenScore !== '');

                return (
                  <div className="match-modal-section">
                    <div className="merged-score-header">
                      <div>
                        <h4 className="match-modal-section-title" style={{ margin: 0 }}>
                          3. Tỷ số & Cầu thủ Ghi bàn (⚽) / Kiến tạo (👟)
                        </h4>
                        <span className="merged-score-subtitle">
                          Tăng tỷ số hoặc bấm &ldquo;+ Thêm bàn thắng&rdquo; sẽ tự động đồng bộ dòng nhập cầu thủ ghi bàn
                        </span>
                      </div>
                    </div>

                    {/* Bảng tỷ số trực quan 2 đội */}
                    <div className="merged-scoreboard-box">
                      {/* Cột Đội 1 */}
                      <div className="scoreboard-team-panel">
                        <div className="scoreboard-team-label">
                          <span className="team-color-dot" style={{ background: homeColor }} />
                          <strong>{homeTeamName}</strong>
                        </div>
                        <div className="scoreboard-stepper">
                          <button
                            type="button"
                            className="score-step-btn"
                            onClick={() => handleScoreInputChange('home', Math.max(0, (Number(matchForm.homeScore) || 0) - 1))}
                            aria-label={`Giảm bàn thắng ${homeTeamName}`}
                          >
                            −
                          </button>
                          <Input
                            id="home-score"
                            className="form-input score-number-input"
                            type="number"
                            min="0"
                            value={matchForm.homeScore}
                            onChange={(e) => handleScoreInputChange('home', e.target.value)}
                          />
                          <button
                            type="button"
                            className="score-step-btn"
                            onClick={() => handleScoreInputChange('home', (Number(matchForm.homeScore) || 0) + 1)}
                            aria-label={`Tăng bàn thắng ${homeTeamName}`}
                          >
                            +
                          </button>
                        </div>
                        {matchForm.homeTeamId && (
                          <button
                            type="button"
                            className="btn-quick-add-goal"
                            style={{ borderColor: homeColor, color: homeColor }}
                            onClick={() => handleAddGoalRow(matchForm.homeTeamId)}
                          >
                            + Ghi bàn {homeTeamName}
                          </button>
                        )}
                      </div>

                      <div className="scoreboard-vs-divider">VS</div>

                      {/* Cột Đội 2 */}
                      <div className="scoreboard-team-panel">
                        <div className="scoreboard-team-label">
                          <span className="team-color-dot" style={{ background: awayColor }} />
                          <strong>{awayTeamName}</strong>
                        </div>
                        <div className="scoreboard-stepper">
                          <button
                            type="button"
                            className="score-step-btn"
                            onClick={() => handleScoreInputChange('away', Math.max(0, (Number(matchForm.awayScore) || 0) - 1))}
                            aria-label={`Giảm bàn thắng ${awayTeamName}`}
                          >
                            −
                          </button>
                          <Input
                            id="away-score"
                            className="form-input score-number-input"
                            type="number"
                            min="0"
                            value={matchForm.awayScore}
                            onChange={(e) => handleScoreInputChange('away', e.target.value)}
                          />
                          <button
                            type="button"
                            className="score-step-btn"
                            onClick={() => handleScoreInputChange('away', (Number(matchForm.awayScore) || 0) + 1)}
                            aria-label={`Tăng bàn thắng ${awayTeamName}`}
                          >
                            +
                          </button>
                        </div>
                        {matchForm.awayTeamId && (
                          <button
                            type="button"
                            className="btn-quick-add-goal"
                            style={{ borderColor: awayColor, color: awayColor }}
                            onClick={() => handleAddGoalRow(matchForm.awayTeamId)}
                          >
                            + Ghi bàn {awayTeamName}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Luân lưu Penalty (chỉ hiển thị cho trận Knockout) */}
                    {showPenalty && (
                      <div className="penalty-inline-box">
                        <span className="penalty-inline-label">🎯 Luân lưu Penalty (nếu hòa):</span>
                        <div className="penalty-inline-inputs">
                          <Input
                            className="form-input"
                            type="number"
                            min="0"
                            placeholder={`Pen ${homeTeamName}`}
                            value={matchForm.homePenScore}
                            onChange={(e) => setMatchForm((prev) => ({ ...prev, homePenScore: e.target.value }))}
                          />
                          <span>-</span>
                          <Input
                            className="form-input"
                            type="number"
                            min="0"
                            placeholder={`Pen ${awayTeamName}`}
                            value={matchForm.awayPenScore}
                            onChange={(e) => setMatchForm((prev) => ({ ...prev, awayPenScore: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}

                    {/* Danh sách gán cầu thủ ghi bàn & kiến tạo */}
                    <div className="merged-goals-container">
                      {matchForm.goals.length === 0 ? (
                        <div className="goals-empty-hint">
                          Chưa có bàn thắng nào. Bấm dấu <strong>(+)</strong> trên bảng tỷ số hoặc <strong>&ldquo;+ Ghi bàn...&rdquo;</strong> để chọn cầu thủ ghi bàn & kiến tạo.
                        </div>
                      ) : (
                        <div className="match-goals-editor-list">
                          {matchForm.goals.map((g, idx) => {
                            const goalTeam = teams.find((t) => t.id === g.teamId);
                            const teamPlayers = goalTeam?.players?.length > 0
                              ? goalTeam.players
                              : teams.flatMap((t) => t.players || []);

                          return (
                            <div key={g.id || idx} className="goal-editor-row">
                              <div className="goal-row-header-mobile">
                                <span
                                  className="goal-team-tag"
                                  style={{ background: goalTeam?.color || 'var(--primary-600)' }}
                                >
                                  {goalTeam?.name || 'Đội'} #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  className="btn-remove-goal btn-remove-goal-mobile"
                                  onClick={() => handleRemoveGoalRow(g.id)}
                                  title="Xóa bàn thắng này"
                                  aria-label="Xóa bàn thắng"
                                >
                                  ✕
                                </button>
                              </div>

                              <div className="goal-field-col">
                                <Select
                                  className="form-select goal-select"
                                  value={g.scorerId}
                                  onChange={(e) => handleUpdateGoalRow(g.id, 'scorerId', e.target.value)}
                                >
                                  <option value="">⚽ Chọn người ghi bàn...</option>
                                  {teamPlayers.map((p) => (
                                    <option key={p.userId} value={p.userId}>
                                      ⚽ {p.displayName} ({p.tier || 'C'})
                                    </option>
                                  ))}
                                </Select>
                              </div>

                              <div className="goal-field-col">
                                <Select
                                  className="form-select goal-select"
                                  value={g.assistId || ''}
                                  onChange={(e) => handleUpdateGoalRow(g.id, 'assistId', e.target.value)}
                                >
                                  <option value="">👟 Không có kiến tạo</option>
                                  {teamPlayers
                                    .filter((p) => p.userId !== g.scorerId)
                                    .map((p) => (
                                      <option key={p.userId} value={p.userId}>
                                        👟 KT: {p.displayName}
                                      </option>
                                    ))}
                                </Select>
                              </div>

                              <div className="goal-minute-col">
                                <Input
                                  className="form-input goal-minute-input"
                                  type="text"
                                  placeholder="Phút (VD: 10')"
                                  title="Phút ghi bàn (VD: 12)"
                                  value={g.minute || ''}
                                  onChange={(e) => handleUpdateGoalRow(g.id, 'minute', e.target.value)}
                                />
                              </div>

                              <button
                                type="button"
                                className="btn-remove-goal btn-remove-goal-desktop"
                                onClick={() => handleRemoveGoalRow(g.id)}
                                title="Xóa bàn thắng này"
                                aria-label="Xóa bàn thắng"
                              >
                                ✕
                              </button>
                            </div>
                          );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="modal-form-actions">
                <Button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setEditingMatch(null)}
                >
                  Hủy
                </Button>
                <Button
                  className="btn btn-primary"
                  type="submit"
                  disabled={savingMatch}
                >
                  {savingMatch ? 'Đang lưu...' : 'Lưu thông tin trận đấu'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* =========================================================
          MODAL 2: CHUYỂN SANG VÒNG KNOCKOUT & TỰ ĐỘNG PHÂN CẶP
         ========================================================= */}
      <Modal
        isOpen={isKnockoutModalOpen}
        onClose={() => setIsKnockoutModalOpen(false)}
        ariaLabel="Phân cặp vòng Knockout"
      >
        <div className="confirm-dialog" style={{ maxWidth: '580px' }}>
          <h2>⚡ Phân chia cặp đấu Vòng Knockout</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '-6px', marginBottom: '16px' }}>
            Hệ thống tự động xếp hạng vòng bảng theo thứ tự ưu tiên: <strong>Điểm số → Thành tích đối đầu → Hiệu số bàn thắng → Số bàn thắng ghi được</strong> để phân nhánh Knockout:
          </p>

          {(() => {
            const groupA = standings.find((s) => s.group === 'A')?.rows || [];
            const groupB = standings.find((s) => s.group === 'B')?.rows || [];
            return (
              <div className="knockout-preview-box">
                {groupA.length >= 2 && groupB.length >= 2 ? (
                  <>
                    <div className="ko-preview-item">
                      <span className="ko-preview-stage">Bán kết 1</span>
                      <strong>{groupA[0]?.name || 'Nhất Bảng A'}</strong>
                      <span className="ko-vs">VS</span>
                      <strong>{groupB[1]?.name || 'Nhì Bảng B'}</strong>
                    </div>
                    <div className="ko-preview-item">
                      <span className="ko-preview-stage">Bán kết 2</span>
                      <strong>{groupB[0]?.name || 'Nhất Bảng B'}</strong>
                      <span className="ko-vs">VS</span>
                      <strong>{groupA[1]?.name || 'Nhì Bảng A'}</strong>
                    </div>
                    {groupA.length >= 3 && groupB.length >= 3 && (
                      <div className="ko-preview-item optional">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: '100%' }}>
                          <input
                            type="checkbox"
                            checked={includeBottomMatch}
                            onChange={(e) => setIncludeBottomMatch(e.target.checked)}
                          />
                          <span>
                            <strong>Trận 2 đội cuối bảng (Optional):</strong>{' '}
                            {groupA[groupA.length - 1]?.name || 'Cuối Bảng A'} vs {groupB[groupB.length - 1]?.name || 'Cuối Bảng B'}
                          </span>
                        </label>
                      </div>
                    )}
                    <div className="ko-preview-item">
                      <span className="ko-preview-stage">Tranh hạng 3</span>
                      <span>Đội thua Bán kết 1</span>
                      <span className="ko-vs">VS</span>
                      <span>Đội thua Bán kết 2</span>
                    </div>
                    <div className="ko-preview-item final">
                      <span className="ko-preview-stage">🏆 Chung kết</span>
                      <span>Đội thắng Bán kết 1</span>
                      <span className="ko-vs">VS</span>
                      <span>Đội thắng Bán kết 2</span>
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    Hệ thống sẽ tự động ghép cặp Bán kết, Tranh hạng 3 và Chung kết từ thứ hạng các đội hiện tại. Sau khi tạo xong, Admin có thể bấm vào từng trận để tự chỉnh sửa cặp đấu và thời gian.
                  </p>
                )}
              </div>
            );
          })()}

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
            💡 Lưu ý: Sau khi hệ thống tự xếp cặp xong, Admin vẫn có thể bấm vào bất kỳ trận đấu nào để tự đổi đội, thêm giờ thi đấu và người ghi bàn.
          </p>

          <div className="modal-form-actions">
            <Button
              className="btn btn-outline"
              type="button"
              onClick={() => setIsKnockoutModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              className="btn btn-primary"
              type="button"
              onClick={handleConfirmGenerateKnockout}
              disabled={generatingKnockout}
            >
              {generatingKnockout ? 'Đang xếp cặp...' : '⚡ Xác nhận & Tạo lịch Vòng Knockout'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* =========================================================
          MODAL 3: THÊM TRẬN ĐẤU MỚI THỦ CÔNG (ADMIN)
         ========================================================= */}
      <Modal
        isOpen={isCreateMatchModalOpen}
        onClose={() => setIsCreateMatchModalOpen(false)}
        ariaLabel="Thêm trận đấu mới"
      >
        <div className="confirm-dialog" style={{ maxWidth: '500px' }}>
          <h2>+ Thêm trận đấu mới</h2>
          <form onSubmit={handleCreateCustomMatch}>
            <div className="match-modal-grid-2" style={{ marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Vòng đấu:</label>
                <Select
                  className="form-select"
                  value={newMatchForm.stage}
                  onChange={(e) => setNewMatchForm((prev) => ({ ...prev, stage: e.target.value }))}
                >
                  <option value="GROUP">Vòng bảng</option>
                  <option value="KNOCKOUT">Vòng Knockout / Phân hạng</option>
                </Select>
              </div>
              {newMatchForm.stage === 'GROUP' ? (
                <div className="form-group">
                  <label className="form-label">Bảng đấu:</label>
                  <Select
                    className="form-select"
                    value={newMatchForm.group}
                    onChange={(e) => setNewMatchForm((prev) => ({ ...prev, group: e.target.value }))}
                  >
                    <option value="A">Bảng A</option>
                    <option value="B">Bảng B</option>
                  </Select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Tên trận đấu:</label>
                  <Input
                    className="form-input"
                    value={newMatchForm.title}
                    onChange={(e) => setNewMatchForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="VD: Tranh hạng 5-6, Giao hữu..."
                  />
                </div>
              )}
            </div>

            <div className="match-modal-grid-2" style={{ marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Đội 1:</label>
                <Select
                  className="form-select"
                  value={newMatchForm.homeTeamId}
                  onChange={(e) => setNewMatchForm((prev) => ({ ...prev, homeTeamId: e.target.value }))}
                >
                  <option value="">-- Chưa xác định --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </div>
              <div className="form-group">
                <label className="form-label">Đội 2:</label>
                <Select
                  className="form-select"
                  value={newMatchForm.awayTeamId}
                  onChange={(e) => setNewMatchForm((prev) => ({ ...prev, awayTeamId: e.target.value }))}
                >
                  <option value="">-- Chưa xác định --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="match-modal-grid-3" style={{ marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Ngày:</label>
                <Input
                  className="form-input"
                  value={newMatchForm.matchDate}
                  onChange={(e) => setNewMatchForm((prev) => ({ ...prev, matchDate: e.target.value }))}
                  placeholder="15/11/2026"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Giờ:</label>
                <Input
                  className="form-input"
                  value={newMatchForm.matchTime}
                  onChange={(e) => setNewMatchForm((prev) => ({ ...prev, matchTime: e.target.value }))}
                  placeholder="18:30"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sân:</label>
                <Input
                  className="form-input"
                  value={newMatchForm.venue}
                  onChange={(e) => setNewMatchForm((prev) => ({ ...prev, venue: e.target.value }))}
                  placeholder="Sân 1"
                />
              </div>
            </div>

            <div className="modal-form-actions">
              <Button className="btn btn-outline" type="button" onClick={() => setIsCreateMatchModalOpen(false)}>
                Hủy
              </Button>
              <Button className="btn btn-primary" type="submit" disabled={creatingMatch}>
                {creatingMatch ? 'Đang tạo...' : 'Thêm trận đấu'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* =========================================================
          MODAL 4: TẠO FORM BÌNH CHỌN CẦU THỦ MVP CỦA GIẢI (ADMIN)
         ========================================================= */}
      <Modal
        isOpen={isMvpModalOpen}
        onClose={() => setIsMvpModalOpen(false)}
        ariaLabel="Tạo Form bình chọn Cầu thủ MVP của giải"
      >
        <div className="confirm-dialog" style={{ maxWidth: '580px' }}>
          <h2>🌟 Tạo Form Bình Chọn Cầu Thủ MVP Giải Đấu</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-6px', marginBottom: '16px' }}>
            Tạo biểu mẫu để tất cả thành viên tham gia bình chọn Cầu thủ xuất sắc nhất (MVP) của giải đấu.
          </p>

          <form onSubmit={handleSaveMvpPoll}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Tiêu đề Form bình chọn *</label>
              <Input
                className="form-input"
                value={mvpForm.title}
                onChange={(e) => setMvpForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Mô tả / Lời kêu gọi bình chọn:</label>
              <Input
                className="form-input"
                value={mvpForm.description}
                onChange={(e) => setMvpForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Danh sách ứng viên đề cử:</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  className={`btn btn-sm ${mvpForm.mode === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMvpForm((prev) => ({ ...prev, mode: 'ALL' }))}
                >
                  Tất cả cầu thủ trong giải ({tournament.playerStats?.length || 0})
                </Button>
                <Button
                  type="button"
                  className={`btn btn-sm ${mvpForm.mode === 'SHORTLIST' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMvpForm((prev) => ({ ...prev, mode: 'SHORTLIST' }))}
                >
                  Chọn danh sách đề cử rút gọn ({mvpForm.candidateIds.length})
                </Button>
                <Button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAutoSelectTopCandidates}
                >
                  ⚡ Gợi ý Top Ghi bàn & Kiến tạo
                </Button>
              </div>

              {mvpForm.mode === 'SHORTLIST' && (
                <div className="mvp-shortlist-picker">
                  {(tournament.playerStats || []).map((p) => {
                    const checked = mvpForm.candidateIds.includes(p.userId);
                    return (
                      <label key={p.userId} className={`mvp-shortlist-item ${checked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleMvpCandidate(p.userId)}
                        />
                        <span>
                          <strong>{p.displayName}</strong> ({p.teamName}) · ⚽{p.goals} 👟{p.assists}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {mvpVoting && (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mvpForm.resetVotes}
                    onChange={(e) => setMvpForm((prev) => ({ ...prev, resetVotes: e.target.checked }))}
                  />
                  Làm mới (reset) lại số phiếu bầu từ đầu
                </label>
              </div>
            )}

            <div className="modal-form-actions">
              <Button className="btn btn-outline" type="button" onClick={() => setIsMvpModalOpen(false)}>
                Hủy
              </Button>
              <Button className="btn btn-primary" type="submit" disabled={savingMvpPoll}>
                {savingMvpPoll ? 'Đang mở form...' : '🌟 Mở Form Bình Chọn MVP'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* =========================================================
          MODAL 5: ADMIN THÊM THÀNH VIÊN VÀO GIẢI
         ========================================================= */}
      <Modal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        ariaLabel="Thêm thành viên vào giải đấu"
      >
        <div className="confirm-dialog" style={{ maxWidth: '480px' }}>
          <h2>Thêm thành viên vào giải đấu</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '16px' }}>
            Chọn thành viên CLB để đưa trực tiếp vào danh sách đăng ký thi đấu.
          </p>

          <form onSubmit={handleAdminAddMember}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="select-club-member">
                Chọn thành viên CLB:
              </label>
              {loadingMembers ? (
                <div style={{ padding: '8px', color: 'var(--text-muted)' }}>Đang tải danh sách thành viên...</div>
              ) : (
                <Select
                  id="select-club-member"
                  className="form-select"
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    const found = clubMembers.find((m) => m.id === e.target.value);
                    if (found?.isGoalkeeper) {
                      setAdminSelectedPositions(['GK']);
                    }
                  }}
                  required
                >
                  <option value="">-- Chọn thành viên --</option>
                  {clubMembers
                    .filter((m) => !registrations.some((r) => r.userId === m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName} (@{m.username}){m.tier ? ` - Tier ${m.tier}` : ''}{m.isGoalkeeper ? ' 🧤 (GK)' : ''}
                      </option>
                    ))}
                </Select>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">
                Vị trí thi đấu (bấm để chọn):
              </label>
              <div className="admin-position-select-grid">
                {POSITIONS.map((pos) => {
                  const isSelected = adminSelectedPositions.includes(pos.code);
                  return (
                    <button
                      key={pos.code}
                      type="button"
                      className={`admin-pos-toggle-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleAdminPosition(pos.code)}
                    >
                      {pos.display} ({pos.label})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="admin-note">
                Ghi chú thêm (tùy chọn):
              </label>
              <Input
                id="admin-note"
                className="form-input"
                placeholder="VD: Được Admin chỉ định tham gia..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>

            <div className="modal-form-actions">
              <Button
                className="btn btn-outline"
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
              >
                Hủy
              </Button>
              <Button
                className="btn btn-primary"
                type="submit"
                disabled={addingMember || !selectedUserId || adminSelectedPositions.length === 0}
              >
                {addingMember ? 'Đang thêm...' : 'Xác nhận thêm vào giải'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {confirmationDialog}
    </div>
  );
}
