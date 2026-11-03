const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  VALID_POSITIONS,
  tournamentEvents,
  calculateStandings,
  generateGroupFixtures,
  generateKnockoutFixtures,
  syncKnockoutProgression,
  recalculateTournamentTeams,
  balanceTournamentTeams,
  formatTournamentPayload,
} = require('../services/tournament.service');

const getTournaments = async (req, res, next) => {
  try {
    const rawTournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, displayName: true, username: true },
        },
      },
    });

    const tournaments = rawTournaments.map((t) =>
      formatTournamentPayload(t, req.user?.id, req.user?.role)
    );

    res.json({ tournaments });
  } catch (error) {
    next(error);
  }
};

const getTournamentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawTournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, displayName: true, username: true },
        },
      },
    });

    if (!rawTournament) {
      return res.status(404).json({ error: 'Không tìm thấy giải đấu' });
    }

    const tournament = formatTournamentPayload(
      rawTournament,
      req.user?.id,
      req.user?.role
    );

    res.json({ tournament });
  } catch (error) {
    next(error);
  }
};

const createTournament = async (req, res, next) => {
  try {
    const { title, settings } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ error: 'Tên giải đấu phải có ít nhất 3 ký tự' });
    }

    const teamCount = Math.max(2, Math.min(16, Number(settings?.teamCount) || 4));
    const playersPerTeam = Math.max(5, Math.min(15, Number(settings?.playersPerTeam) || 7));
    const hasPenalty = settings?.hasPenalty !== false;

    const initialSettings = {
      format: 'FUTSAL_5V5',
      teamCount,
      playersPerTeam,
      hasPenalty,
    };

    // Tạo sẵn danh sách đội mẫu
    const initialTeams = [];
    const teamColors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0d9488', '#0891b2', '#4f46e5'];
    for (let i = 1; i <= teamCount; i++) {
      const group = teamCount > 4 ? (i <= Math.ceil(teamCount / 2) ? 'A' : 'B') : (i % 2 === 1 ? 'A' : 'B');
      initialTeams.push({
        id: `team-${i}`,
        name: `Đội ${String.fromCharCode(64 + i)}`,
        color: teamColors[(i - 1) % teamColors.length],
        group,
        captainId: null,
        captainName: null,
        totalTierScore: 0,
        averageTierScore: 0,
        players: [],
      });
    }

    const initialState = {
      phase: 'DRAFT',
      settings: initialSettings,
      registrations: [],
      teams: initialTeams,
      fixtures: [],
      mvpVoting: null,
    };

    const tournament = await prisma.tournament.create({
      data: {
        title: title.trim(),
        createdById: req.user.id,
        organizerIds: [req.user.id],
        state: initialState,
        revision: 0,
      },
      include: {
        createdBy: {
          select: { id: true, displayName: true, username: true },
        },
      },
    });

    const payload = formatTournamentPayload(tournament, req.user.id, req.user.role);
    res.status(201).json({ tournament: payload });
  } catch (error) {
    next(error);
  }
};

const executeCommand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { revision, action, payload = {} } = req.body;

    const existing = await prisma.tournament.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, displayName: true, username: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy giải đấu' });
    }

    if (typeof revision === 'number' && existing.revision !== revision) {
      return res.status(409).json({
        error: 'Dữ liệu giải đấu đã được cập nhật bởi thao tác khác. Vui lòng tải lại.',
        tournament: formatTournamentPayload(existing, req.user.id, req.user.role),
      });
    }

    const state = existing.state || {};
    const organizerIds = Array.isArray(existing.organizerIds) ? existing.organizerIds : [];
    const isOrganizer = req.user.role === 'ADMIN' || organizerIds.includes(req.user.id);

    let updatedState = { ...state };

    switch (action) {
      case 'REGISTER': {
        if (state.phase !== 'DRAFT') {
          return res.status(400).json({ error: 'Giải đấu đã đóng đăng ký' });
        }

        const positions = Array.isArray(payload.positions) ? payload.positions : [];
        const validPositions = positions.filter((p) => VALID_POSITIONS.has(p));
        if (validPositions.length === 0) {
          return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 vị trí thi đấu' });
        }

        const registrations = [...(state.registrations || [])];
        const index = registrations.findIndex((r) => r.userId === req.user.id);
        const registrationRecord = {
          userId: req.user.id,
          displayName: req.user.displayName,
          username: req.user.username,
          avatar: req.user.avatar || null,
          tier: req.user.tier || 'C',
          positions: validPositions,
          note: String(payload.note || '').trim().slice(0, 300),
          registeredAt: new Date().toISOString(),
        };

        if (index >= 0) {
          registrations[index] = { ...registrations[index], ...registrationRecord };
        } else {
          registrations.push(registrationRecord);
        }

        updatedState.registrations = registrations;
        break;
      }

      case 'CANCEL_REGISTRATION': {
        if (state.phase !== 'DRAFT') {
          return res.status(400).json({ error: 'Không thể hủy khi giải đấu đã bắt đầu' });
        }

        updatedState.registrations = (state.registrations || []).filter(
          (r) => r.userId !== req.user.id
        );
        break;
      }

      case 'ADMIN_ADD_REGISTRATION': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền thêm thành viên vào giải' });
        }
        if (state.phase !== 'DRAFT') {
          return res.status(400).json({ error: 'Chỉ có thể thêm thành viên trong giai đoạn đăng ký (DRAFT)' });
        }

        const { userId, positions = ['FIXO'], note = '' } = payload;
        if (!userId) {
          return res.status(400).json({ error: 'Vui lòng chọn thành viên cần thêm' });
        }

        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!targetUser) {
          return res.status(404).json({ error: 'Không tìm thấy thông tin thành viên' });
        }

        const validPositions = (Array.isArray(positions) ? positions : [positions])
          .filter((p) => VALID_POSITIONS.has(p));
        const finalPositions = validPositions.length > 0 ? validPositions : ['FIXO'];

        const registrations = [...(state.registrations || [])];
        const index = registrations.findIndex((r) => r.userId === targetUser.id);
        const record = {
          userId: targetUser.id,
          displayName: targetUser.displayName,
          username: targetUser.username,
          avatar: targetUser.avatar || null,
          tier: targetUser.tier || 'C',
          positions: finalPositions,
          note: String(note || '').trim().slice(0, 300),
          registeredAt: new Date().toISOString(),
        };

        if (index >= 0) {
          registrations[index] = { ...registrations[index], ...record };
        } else {
          registrations.push(record);
        }

        updatedState.registrations = registrations;
        break;
      }

      case 'ADMIN_REMOVE_REGISTRATION': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền xóa thành viên khỏi giải' });
        }
        if (state.phase !== 'DRAFT') {
          return res.status(400).json({ error: 'Chỉ có thể xóa thành viên trong giai đoạn đăng ký (DRAFT)' });
        }

        const { userId } = payload;
        if (!userId) {
          return res.status(400).json({ error: 'Thiếu ID thành viên' });
        }

        updatedState.registrations = (state.registrations || []).filter(
          (r) => r.userId !== userId
        );
        break;
      }

      case 'LOCK_REGISTRATION': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền chốt danh sách đăng ký' });
        }
        if (state.phase !== 'DRAFT') {
          return res.status(400).json({ error: 'Giải đấu không ở giai đoạn mở đăng ký' });
        }

        const currentRegistrations = state.registrations || [];
        const minRequired = state.settings?.teamCount || 4;
        if (currentRegistrations.length < minRequired) {
          return res.status(400).json({
            error: `Cần ít nhất ${minRequired} cầu thủ để chốt danh sách đăng ký`,
          });
        }

        updatedState.phase = 'REGISTRATION_CLOSED';
        break;
      }

      case 'REOPEN_REGISTRATION': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền mở lại đăng ký' });
        }
        if (state.phase === 'DRAFT') {
          return res.status(400).json({ error: 'Giải đấu hiện đang ở trạng thái mở đăng ký' });
        }
        if (state.phase === 'COMPLETED') {
          return res.status(400).json({ error: 'Không thể mở lại đăng ký cho giải đấu đã hoàn tất' });
        }

        const hasPlayedMatch = (state.fixtures || []).some(
          (f) => f.status === 'FINISHED' || (f.homeScore !== null && f.homeScore !== undefined)
        );
        if (hasPlayedMatch) {
          return res.status(400).json({
            error: 'Giải đấu đã có trận đấu diễn ra, không thể mở lại đăng ký',
          });
        }

        updatedState.phase = 'DRAFT';
        break;
      }

      case 'AUTO_BALANCE_TEAMS': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền tự động chia đội' });
        }
        if (state.phase !== 'REGISTRATION_CLOSED') {
          return res.status(400).json({
            error: 'Vui lòng chốt danh sách đăng ký trước khi tiến hành chia đội',
          });
        }

        const currentRegistrations = state.registrations || [];
        const currentSettings = state.settings || {};
        const teamCount = Number(payload.teamCount) || currentSettings.teamCount || 4;
        const playersPerTeam = Number(payload.playersPerTeam) || currentSettings.playersPerTeam || 7;

        try {
          const balancedTeams = balanceTournamentTeams(currentRegistrations, {
            teamCount,
            playersPerTeam,
          });
          updatedState.teams = balancedTeams;
        } catch (err) {
          return res.status(400).json({ error: err.message || 'Không thể tự động chia đội' });
        }
        break;
      }

      case 'SET_TEAMS': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền xếp đội' });
        }
        if (!Array.isArray(payload.teams)) {
          return res.status(400).json({ error: 'Danh sách đội không hợp lệ' });
        }

        updatedState.teams = recalculateTournamentTeams(payload.teams);
        break;
      }

      case 'START_TOURNAMENT': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền bắt đầu giải đấu' });
        }
        if (state.phase !== 'REGISTRATION_CLOSED' && state.phase !== 'DRAFT') {
          return res.status(400).json({ error: 'Giải đấu đã bắt đầu hoặc đã hoàn tất' });
        }

        const teams = state.teams || [];
        const hasAssignedPlayers = teams.some((t) => t.players && t.players.length > 0);
        if (!hasAssignedPlayers) {
          return res.status(400).json({
            error: 'Vui lòng hoàn tất việc chia đội trước khi chính thức bắt đầu giải đấu',
          });
        }

        updatedState.phase = 'GROUP_STAGE';
        // Tự động sinh lịch thi đấu nếu chưa có
        if (!updatedState.fixtures || updatedState.fixtures.length === 0) {
          updatedState.fixtures = generateGroupFixtures(updatedState.teams || []);
        }
        break;
      }

      case 'REGENERATE_GROUP_FIXTURES': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC mới có quyền tạo lại lịch vòng bảng' });
        }
        updatedState.fixtures = generateGroupFixtures(updatedState.teams || []);
        break;
      }

      case 'UPDATE_MATCH': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC mới có quyền cập nhật trận đấu' });
        }

        const {
          fixtureId,
          homeTeamId,
          awayTeamId,
          title,
          matchDate,
          matchTime,
          venue,
          homeScore,
          awayScore,
          homePenScore,
          awayPenScore,
          goals,
          status,
        } = payload;

        const fixtures = [...(state.fixtures || [])];
        const matchIndex = fixtures.findIndex((f) => f.id === fixtureId);

        if (matchIndex === -1) {
          return res.status(404).json({ error: 'Không tìm thấy trận đấu này' });
        }

        const currentMatch = fixtures[matchIndex];
        const nextHomeTeamId = homeTeamId !== undefined ? (homeTeamId || null) : currentMatch.homeTeamId;
        const nextAwayTeamId = awayTeamId !== undefined ? (awayTeamId || null) : currentMatch.awayTeamId;

        if (nextHomeTeamId && nextAwayTeamId && nextHomeTeamId === nextAwayTeamId) {
          return res.status(400).json({ error: 'Đội nhà và đội khách không được trùng nhau' });
        }

        const sanitizedGoals = Array.isArray(goals)
          ? goals
              .filter((g) => g && (g.scorerId || g.scorerName))
              .map((g, idx) => ({
                id: g.id || `goal-${Date.now()}-${idx}`,
                teamId: g.teamId || null,
                scorerId: g.scorerId || null,
                scorerName: String(g.scorerName || '').trim(),
                assistId: g.assistId || null,
                assistName: g.assistName ? String(g.assistName).trim() : null,
                minute: g.minute !== undefined && g.minute !== null ? String(g.minute).trim().slice(0, 15) : '',
                count: Math.max(1, Number(g.count) || 1),
              }))
          : (currentMatch.goals || []);

        const nextStatus = status || currentMatch.status || 'SCHEDULED';
        const nextHomeScore = nextStatus === 'SCHEDULED' && (homeScore === '' || homeScore === null || homeScore === undefined)
          ? null
          : (homeScore !== undefined && homeScore !== '' && homeScore !== null ? Number(homeScore) : currentMatch.homeScore);
        const nextAwayScore = nextStatus === 'SCHEDULED' && (awayScore === '' || awayScore === null || awayScore === undefined)
          ? null
          : (awayScore !== undefined && awayScore !== '' && awayScore !== null ? Number(awayScore) : currentMatch.awayScore);

        fixtures[matchIndex] = {
          ...currentMatch,
          homeTeamId: nextHomeTeamId,
          awayTeamId: nextAwayTeamId,
          title: title !== undefined ? String(title).trim() : currentMatch.title,
          matchDate: matchDate !== undefined ? String(matchDate).trim() : (currentMatch.matchDate || ''),
          matchTime: matchTime !== undefined ? String(matchTime).trim() : (currentMatch.matchTime || ''),
          venue: venue !== undefined ? String(venue).trim() : (currentMatch.venue || ''),
          homeScore: nextHomeScore,
          awayScore: nextAwayScore,
          homePenScore: homePenScore !== undefined && homePenScore !== '' && homePenScore !== null ? Number(homePenScore) : null,
          awayPenScore: awayPenScore !== undefined && awayPenScore !== '' && awayPenScore !== null ? Number(awayPenScore) : null,
          goals: sanitizedGoals,
          status: nextStatus,
        };

        // Tự động đẩy đội thắng/thua ở Bán kết vào Chung kết / Tranh hạng 3
        updatedState.fixtures = syncKnockoutProgression(fixtures);
        break;
      }

      case 'CREATE_MATCH': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC mới có quyền thêm trận đấu' });
        }

        const {
          stage = 'GROUP',
          group = 'A',
          knockoutRound = null,
          matchCode = null,
          title = '',
          homeTeamId = null,
          awayTeamId = null,
          matchDate = '',
          matchTime = '',
          venue = '',
        } = payload;

        if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
          return res.status(400).json({ error: 'Đội nhà và đội khách không được trùng nhau' });
        }

        const fixtures = [...(state.fixtures || [])];
        const newFixture = {
          id: `match-custom-${Date.now()}`,
          stage,
          group: stage === 'GROUP' ? group : undefined,
          knockoutRound: stage === 'KNOCKOUT' ? (knockoutRound || 'CUSTOM') : undefined,
          matchCode: matchCode || undefined,
          title: String(title || (stage === 'KNOCKOUT' ? 'Trận đấu Vòng Knockout' : `Vòng bảng · Bảng ${group}`)).trim(),
          homeTeamId: homeTeamId || null,
          awayTeamId: awayTeamId || null,
          homeScore: null,
          awayScore: null,
          homePenScore: null,
          awayPenScore: null,
          matchDate: String(matchDate || '').trim(),
          matchTime: String(matchTime || '').trim(),
          venue: String(venue || '').trim(),
          goals: [],
          status: 'SCHEDULED',
        };

        fixtures.push(newFixture);
        updatedState.fixtures = fixtures;
        break;
      }

      case 'DELETE_MATCH': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC mới có quyền xóa trận đấu' });
        }

        const { fixtureId } = payload;
        updatedState.fixtures = (state.fixtures || []).filter((f) => f.id !== fixtureId);
        break;
      }

      case 'GENERATE_KNOCKOUT': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC mới có quyền phân cặp vòng Knockout' });
        }

        const includeBottomMatch = Boolean(payload.includeBottomMatch);
        updatedState.phase = 'KNOCKOUT';
        updatedState.settings = {
          ...(updatedState.settings || {}),
          includeBottomMatch,
        };
        updatedState.fixtures = generateKnockoutFixtures(
          updatedState.teams || [],
          updatedState.fixtures || [],
          { includeBottomMatch }
        );
        break;
      }

      case 'TOGGLE_BOTTOM_MATCH': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC mới có quyền bật/tắt trận đấu 2 đội cuối bảng' });
        }

        const fixtures = [...(state.fixtures || [])];
        const existingBottom = fixtures.find((f) => f.matchCode === 'PL_BOTTOM');

        if (existingBottom) {
          updatedState.fixtures = fixtures.filter((f) => f.matchCode !== 'PL_BOTTOM');
          updatedState.settings = {
            ...(updatedState.settings || {}),
            includeBottomMatch: false,
          };
        } else {
          const standings = calculateStandings(state.teams || [], fixtures);
          const groupA = standings.find((s) => s.group === 'A')?.rows || [];
          const groupB = standings.find((s) => s.group === 'B')?.rows || [];
          const lastA = groupA[groupA.length - 1]?.teamId || null;
          const lastB = groupB[groupB.length - 1]?.teamId || null;
          const rankStart = Math.max(3, groupA.length + groupB.length - 1);
          const rankEnd = Math.max(4, groupA.length + groupB.length);

          const bottomMatch = {
            id: 'ko-bottom',
            stage: 'KNOCKOUT',
            knockoutRound: 'PLACEMENT',
            matchCode: 'PL_BOTTOM',
            title: `Tranh hạng ${rankStart}-${rankEnd} (Cuối bảng A vs Cuối bảng B)`,
            homeLabel: 'Cuối bảng A',
            awayLabel: 'Cuối bảng B',
            homeTeamId: lastA,
            awayTeamId: lastB,
            homeScore: null,
            awayScore: null,
            homePenScore: null,
            awayPenScore: null,
            matchDate: '',
            matchTime: '',
            venue: '',
            goals: [],
            status: 'SCHEDULED',
          };

          // Chèn trước trận Tranh hạng 3 hoặc Chung kết
          const thirdIdx = fixtures.findIndex((f) => f.matchCode === 'THIRD_PLACE' || f.matchCode === 'FINAL');
          if (thirdIdx >= 0) {
            fixtures.splice(thirdIdx, 0, bottomMatch);
          } else {
            fixtures.push(bottomMatch);
          }
          updatedState.fixtures = fixtures;
          updatedState.settings = {
            ...(updatedState.settings || {}),
            includeBottomMatch: true,
          };
        }
        break;
      }

      case 'ADVANCE_PHASE': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC mới có quyền chuyển giai đoạn' });
        }

        const nextPhase = payload.phase;
        if (!['DRAFT', 'REGISTRATION_CLOSED', 'GROUP_STAGE', 'KNOCKOUT', 'COMPLETED'].includes(nextPhase)) {
          return res.status(400).json({ error: 'Giai đoạn giải đấu không hợp lệ' });
        }

        updatedState.phase = nextPhase;

        if (nextPhase === 'KNOCKOUT') {
          const hasKnockoutMatches = (updatedState.fixtures || []).some((f) => f.stage === 'KNOCKOUT');
          const includeBottomMatch = payload.includeBottomMatch !== undefined
            ? Boolean(payload.includeBottomMatch)
            : Boolean(updatedState.settings?.includeBottomMatch);

          updatedState.settings = {
            ...(updatedState.settings || {}),
            includeBottomMatch,
          };

          if (!hasKnockoutMatches || payload.regenerateKnockout) {
            updatedState.fixtures = generateKnockoutFixtures(
              updatedState.teams || [],
              updatedState.fixtures || [],
              { includeBottomMatch }
            );
          } else {
            updatedState.fixtures = syncKnockoutProgression(updatedState.fixtures || []);
          }
        }
        break;
      }

      case 'CREATE_MVP_POLL': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền tạo form bình chọn MVP' });
        }

        const existingPoll = state.mvpVoting || null;
        const candidateIds = Array.isArray(payload.candidateIds) && payload.candidateIds.length > 0
          ? payload.candidateIds
          : null;

        updatedState.mvpVoting = {
          isOpen: true,
          title: String(payload.title || `Bình chọn Cầu thủ xuất sắc nhất (MVP) - ${existing.title}`).trim(),
          description: String(
            payload.description || 'Hãy bình chọn cho cầu thủ có màn trình diễn xuất sắc và ấn tượng nhất giải đấu!'
          ).trim(),
          deadline: payload.deadline || null,
          candidateIds,
          votes: payload.resetVotes ? [] : (existingPoll?.votes || []),
          winnerId: null,
          createdAt: existingPoll?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        break;
      }

      case 'VOTE_MVP': {
        const poll = state.mvpVoting;
        if (!poll || !poll.isOpen) {
          return res.status(400).json({ error: 'Form bình chọn MVP hiện chưa mở hoặc đã kết thúc' });
        }

        if (poll.deadline && new Date() > new Date(poll.deadline)) {
          return res.status(400).json({ error: 'Đã hết thời gian bình chọn MVP của giải đấu' });
        }

        const { candidateId, comment = '' } = payload;
        if (!candidateId) {
          return res.status(400).json({ error: 'Vui lòng chọn cầu thủ để bình chọn MVP' });
        }

        if (Array.isArray(poll.candidateIds) && poll.candidateIds.length > 0 && !poll.candidateIds.includes(candidateId)) {
          return res.status(400).json({ error: 'Cầu thủ này không nằm trong danh sách đề cử MVP' });
        }

        const votes = [...(poll.votes || [])];
        const voteIdx = votes.findIndex((v) => v.voterId === req.user.id);
        const voteRecord = {
          voterId: req.user.id,
          voterName: req.user.displayName,
          voterAvatar: req.user.avatar || null,
          candidateId,
          comment: String(comment || '').trim().slice(0, 200),
          votedAt: new Date().toISOString(),
        };

        if (voteIdx >= 0) {
          votes[voteIdx] = voteRecord;
        } else {
          votes.push(voteRecord);
        }

        updatedState.mvpVoting = {
          ...poll,
          votes,
        };
        break;
      }

      case 'CLOSE_MVP_POLL': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền đóng bình chọn MVP' });
        }
        const poll = state.mvpVoting;
        if (!poll) {
          return res.status(400).json({ error: 'Chưa có form bình chọn MVP nào được tạo' });
        }

        updatedState.mvpVoting = {
          ...poll,
          isOpen: false,
          winnerId: payload.winnerId || poll.winnerId || null,
          closedAt: new Date().toISOString(),
        };
        break;
      }

      case 'REOPEN_MVP_POLL': {
        if (!isOrganizer) {
          return res.status(403).json({ error: 'Chỉ BTC hoặc Admin mới có quyền mở lại bình chọn MVP' });
        }
        const poll = state.mvpVoting;
        if (!poll) {
          return res.status(400).json({ error: 'Chưa có form bình chọn MVP nào được tạo' });
        }

        updatedState.mvpVoting = {
          ...poll,
          isOpen: true,
          closedAt: null,
        };
        break;
      }

      default:
        return res.status(400).json({ error: `Hành động ${action} không được hỗ trợ` });
    }

    const updated = await prisma.tournament.update({
      where: { id },
      data: {
        state: updatedState,
        revision: { increment: 1 },
      },
      include: {
        createdBy: { select: { id: true, displayName: true, username: true } },
      },
    });

    const payloadResponse = formatTournamentPayload(updated, req.user.id, req.user.role);

    // Phát sự kiện SSE để toàn bộ client đang theo dõi cập nhật tức thì
    tournamentEvents.emit(`tournament:${id}`, payloadResponse);

    res.json({ tournament: payloadResponse });
  } catch (error) {
    next(error);
  }
};

const streamTournament = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rawTournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, displayName: true, username: true } },
      },
    });

    if (!rawTournament) {
      return res.status(404).json({ error: 'Không tìm thấy giải đấu' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const initialPayload = formatTournamentPayload(rawTournament, req.user?.id, req.user?.role);
    res.write(`data: ${JSON.stringify({ tournament: initialPayload })}\n\n`);

    const onUpdate = (tournamentPayload) => {
      res.write(`data: ${JSON.stringify({ tournament: tournamentPayload })}\n\n`);
    };

    const eventName = `tournament:${id}`;
    tournamentEvents.on(eventName, onUpdate);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      tournamentEvents.off(eventName, onUpdate);
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTournaments,
  getTournamentById,
  createTournament,
  executeCommand,
  streamTournament,
};
