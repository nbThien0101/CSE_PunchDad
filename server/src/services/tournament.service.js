const EventEmitter = require('events');
const { PrismaClient } = require('@prisma/client');
const { getTierScore } = require('./team-balancer.service');

const prisma = new PrismaClient();

const tournamentEvents = new EventEmitter();
tournamentEvents.setMaxListeners(200);

const VALID_POSITIONS = new Set(['GK', 'FIXO', 'ALA_LEFT', 'ALA_RIGHT', 'PIVOT']);

/**
 * Tính bảng xếp hạng vòng bảng với thứ tự ưu tiên:
 * 1. Điểm số (points)
 * 2. Thành tích đối đầu giữa các đội bằng điểm (h2hPoints -> h2hGD -> h2hGF -> đối đầu trực tiếp 2 đội)
 * 3. Hiệu số bàn thắng toàn bảng (goalDifference)
 * 4. Tổng số bàn thắng toàn bảng (goalsFor)
 */
function calculateStandings(teams = [], fixtures = []) {
  const groups = Array.from(new Set(teams.map((t) => t.group || 'A'))).sort();

  return groups.map((group) => {
    const groupTeams = teams.filter((t) => (t.group || 'A') === group);
    const table = {};

    for (const t of groupTeams) {
      table[t.id] = {
        teamId: t.id,
        name: t.name,
        color: t.color || null,
        group,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        h2hPoints: 0,
        h2hGD: 0,
        h2hGF: 0,
      };
    }

    const groupFixtures = fixtures.filter(
      (f) => f.stage === 'GROUP' && (f.group || 'A') === group && f.status === 'FINISHED'
    );

    for (const match of groupFixtures) {
      const home = table[match.homeTeamId];
      const away = table[match.awayTeamId];
      if (!home || !away) continue;

      const hScore = Number(match.homeScore) || 0;
      const aScore = Number(match.awayScore) || 0;

      home.played += 1;
      away.played += 1;
      home.goalsFor += hScore;
      home.goalsAgainst += aScore;
      away.goalsFor += aScore;
      away.goalsAgainst += hScore;

      if (hScore > aScore) {
        home.won += 1;
        home.points += 3;
        away.lost += 1;
      } else if (hScore < aScore) {
        away.won += 1;
        away.points += 3;
        home.lost += 1;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    const rows = Object.values(table).map((r) => ({
      ...r,
      goalDifference: r.goalsFor - r.goalsAgainst,
    }));

    // Gom nhóm các đội có cùng điểm số để tính thành tích đối đầu (Head-to-Head)
    const pointsBuckets = {};
    for (const row of rows) {
      if (!pointsBuckets[row.points]) pointsBuckets[row.points] = [];
      pointsBuckets[row.points].push(row.teamId);
    }

    for (const pts of Object.keys(pointsBuckets)) {
      const tiedTeamIds = new Set(pointsBuckets[pts]);
      if (tiedTeamIds.size < 2) continue;

      for (const match of groupFixtures) {
        if (!tiedTeamIds.has(match.homeTeamId) || !tiedTeamIds.has(match.awayTeamId)) continue;
        const home = rows.find((r) => r.teamId === match.homeTeamId);
        const away = rows.find((r) => r.teamId === match.awayTeamId);
        if (!home || !away) continue;

        const hScore = Number(match.homeScore) || 0;
        const aScore = Number(match.awayScore) || 0;

        home.h2hGF += hScore;
        home.h2hGD += hScore - aScore;
        away.h2hGF += aScore;
        away.h2hGD += aScore - hScore;

        if (hScore > aScore) {
          home.h2hPoints += 3;
        } else if (hScore < aScore) {
          away.h2hPoints += 3;
        } else {
          home.h2hPoints += 1;
          away.h2hPoints += 1;
        }
      }
    }

    // Hàm kiểm tra đối đầu trực tiếp giữa 2 đội a và b
    const compareDirectH2H = (teamIdA, teamIdB) => {
      let ptsA = 0;
      let ptsB = 0;
      let gdA = 0;
      let gfA = 0;
      let gfB = 0;
      for (const match of groupFixtures) {
        const isAB = match.homeTeamId === teamIdA && match.awayTeamId === teamIdB;
        const isBA = match.homeTeamId === teamIdB && match.awayTeamId === teamIdA;
        if (!isAB && !isBA) continue;

        const hScore = Number(match.homeScore) || 0;
        const aScore = Number(match.awayScore) || 0;
        const scoreA = isAB ? hScore : aScore;
        const scoreB = isAB ? aScore : hScore;

        gfA += scoreA;
        gfB += scoreB;
        gdA += scoreA - scoreB;
        if (scoreA > scoreB) ptsA += 3;
        else if (scoreB > scoreA) ptsB += 3;
        else {
          ptsA += 1;
          ptsB += 1;
        }
      }
      if (ptsB !== ptsA) return ptsB - ptsA;
      if (gdA !== 0) return -gdA;
      if (gfB !== gfA) return gfB - gfA;
      return 0;
    };

    rows.sort((a, b) => {
      // 1. Điểm số
      if (b.points !== a.points) return b.points - a.points;

      // 2. Thành tích đối đầu (trong nhóm bằng điểm & trực tiếp giữa 2 đội)
      if (b.h2hPoints !== a.h2hPoints) return b.h2hPoints - a.h2hPoints;
      const direct = compareDirectH2H(a.teamId, b.teamId);
      if (direct !== 0) return direct;
      if (b.h2hGD !== a.h2hGD) return b.h2hGD - a.h2hGD;
      if (b.h2hGF !== a.h2hGF) return b.h2hGF - a.h2hGF;

      // 3. Hiệu số bàn thắng toàn bảng
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;

      // 4. Tổng số bàn thắng ghi được toàn bảng
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

      // 5. Số trận thắng
      if (b.won !== a.won) return b.won - a.won;

      return String(a.teamId).localeCompare(String(b.teamId));
    });

    return { group, rows };
  });
}

function generateGroupFixtures(teams = []) {
  const groups = Array.from(new Set(teams.map((t) => t.group || 'A'))).sort();
  const fixtures = [];
  let matchCount = 1;

  for (const group of groups) {
    const groupTeams = teams.filter((t) => (t.group || 'A') === group);
    let roundCounter = 1;
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        fixtures.push({
          id: `match-${matchCount++}`,
          stage: 'GROUP',
          group,
          round: roundCounter++,
          title: `Vòng bảng · Bảng ${group}`,
          homeTeamId: groupTeams[i].id,
          awayTeamId: groupTeams[j].id,
          homeScore: null,
          awayScore: null,
          homePenScore: null,
          awayPenScore: null,
          matchDate: '',
          matchTime: '',
          venue: '',
          goals: [],
          status: 'SCHEDULED',
        });
      }
    }
  }

  return fixtures;
}

/**
 * Xác định đội thắng và đội thua của một trận đấu (hỗ trợ cả luân lưu Pen)
 */
function getMatchWinnerAndLoser(match) {
  if (!match || match.status !== 'FINISHED') {
    return { winnerId: null, loserId: null };
  }
  if (!match.homeTeamId || !match.awayTeamId) {
    return { winnerId: null, loserId: null };
  }
  if (match.homeScore === null || match.homeScore === undefined || match.awayScore === null || match.awayScore === undefined) {
    return { winnerId: null, loserId: null };
  }

  const h = Number(match.homeScore);
  const a = Number(match.awayScore);

  if (h > a) {
    return { winnerId: match.homeTeamId, loserId: match.awayTeamId };
  }
  if (a > h) {
    return { winnerId: match.awayTeamId, loserId: match.homeTeamId };
  }

  // Hòa trong thời gian chính thức -> xét luân lưu Pen
  const hp = match.homePenScore !== null && match.homePenScore !== undefined && match.homePenScore !== ''
    ? Number(match.homePenScore)
    : null;
  const ap = match.awayPenScore !== null && match.awayPenScore !== undefined && match.awayPenScore !== ''
    ? Number(match.awayPenScore)
    : null;

  if (hp !== null && ap !== null && hp !== ap) {
    if (hp > ap) {
      return { winnerId: match.homeTeamId, loserId: match.awayTeamId };
    }
    return { winnerId: match.awayTeamId, loserId: match.homeTeamId };
  }

  return { winnerId: null, loserId: null };
}

/**
 * Tự động tạo các cặp đấu vòng Knockout từ kết quả vòng bảng:
 * - Bán kết 1: Nhất bảng A vs Nhì bảng B
 * - Bán kết 2: Nhất bảng B vs Nhì bảng A
 * - Phân hạng cuối bảng (optional): Cuối bảng A vs Cuối bảng B
 * - Tranh hạng 3: Thua Bán kết 1 vs Thua Bán kết 2
 * - Chung kết: Thắng Bán kết 1 vs Thắng Bán kết 2
 */
function generateKnockoutFixtures(teams = [], existingFixtures = [], options = {}) {
  const includeBottomMatch = Boolean(options.includeBottomMatch);
  const standings = calculateStandings(teams, existingFixtures);
  const groupFixtures = existingFixtures.filter((f) => f.stage === 'GROUP');

  const groupA = standings.find((s) => s.group === 'A')?.rows || [];
  const groupB = standings.find((s) => s.group === 'B')?.rows || [];

  const knockoutFixtures = [];

  if (groupA.length >= 2 && groupB.length >= 2) {
    const firstA = groupA[0]?.teamId || null;
    const secondA = groupA[1]?.teamId || null;
    const firstB = groupB[0]?.teamId || null;
    const secondB = groupB[1]?.teamId || null;

    knockoutFixtures.push({
      id: 'ko-sf-1',
      stage: 'KNOCKOUT',
      knockoutRound: 'SEMI_FINAL',
      matchCode: 'SF1',
      title: 'Bán kết 1 (Nhất bảng A vs Nhì bảng B)',
      homeLabel: 'Nhất bảng A',
      awayLabel: 'Nhì bảng B',
      homeTeamId: firstA,
      awayTeamId: secondB,
      homeScore: null,
      awayScore: null,
      homePenScore: null,
      awayPenScore: null,
      matchDate: '',
      matchTime: '',
      venue: '',
      goals: [],
      status: 'SCHEDULED',
    });

    knockoutFixtures.push({
      id: 'ko-sf-2',
      stage: 'KNOCKOUT',
      knockoutRound: 'SEMI_FINAL',
      matchCode: 'SF2',
      title: 'Bán kết 2 (Nhất bảng B vs Nhì bảng A)',
      homeLabel: 'Nhất bảng B',
      awayLabel: 'Nhì bảng A',
      homeTeamId: firstB,
      awayTeamId: secondA,
      homeScore: null,
      awayScore: null,
      homePenScore: null,
      awayPenScore: null,
      matchDate: '',
      matchTime: '',
      venue: '',
      goals: [],
      status: 'SCHEDULED',
    });

    if (includeBottomMatch && groupA.length >= 3 && groupB.length >= 3) {
      const lastA = groupA[groupA.length - 1]?.teamId || null;
      const lastB = groupB[groupB.length - 1]?.teamId || null;
      const rankStart = groupA.length + groupB.length - 1;
      const rankEnd = groupA.length + groupB.length;

      knockoutFixtures.push({
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
      });
    }

    knockoutFixtures.push({
      id: 'ko-3rd',
      stage: 'KNOCKOUT',
      knockoutRound: 'THIRD_PLACE',
      matchCode: 'THIRD_PLACE',
      title: 'Tranh hạng 3 (Thua Bán kết 1 vs Thua Bán kết 2)',
      homeLabel: 'Thua Bán kết 1',
      awayLabel: 'Thua Bán kết 2',
      homeTeamId: null,
      awayTeamId: null,
      homeScore: null,
      awayScore: null,
      homePenScore: null,
      awayPenScore: null,
      matchDate: '',
      matchTime: '',
      venue: '',
      goals: [],
      status: 'SCHEDULED',
    });

    knockoutFixtures.push({
      id: 'ko-final',
      stage: 'KNOCKOUT',
      knockoutRound: 'FINAL',
      matchCode: 'FINAL',
      title: 'Chung kết (Thắng Bán kết 1 vs Thắng Bán kết 2)',
      homeLabel: 'Thắng Bán kết 1',
      awayLabel: 'Thắng Bán kết 2',
      homeTeamId: null,
      awayTeamId: null,
      homeScore: null,
      awayScore: null,
      homePenScore: null,
      awayPenScore: null,
      matchDate: '',
      matchTime: '',
      venue: '',
      goals: [],
      status: 'SCHEDULED',
    });
  } else {
    // Trường hợp giải chỉ có 1 bảng (ví dụ 4 đội chung 1 bảng hoặc 2 đội)
    const allRows = standings.flatMap((s) => s.rows);
    if (allRows.length >= 4) {
      knockoutFixtures.push({
        id: 'ko-sf-1',
        stage: 'KNOCKOUT',
        knockoutRound: 'SEMI_FINAL',
        matchCode: 'SF1',
        title: 'Bán kết 1 (Hạng 1 vs Hạng 4)',
        homeLabel: 'Hạng 1 vòng bảng',
        awayLabel: 'Hạng 4 vòng bảng',
        homeTeamId: allRows[0]?.teamId || null,
        awayTeamId: allRows[3]?.teamId || null,
        homeScore: null,
        awayScore: null,
        homePenScore: null,
        awayPenScore: null,
        matchDate: '',
        matchTime: '',
        venue: '',
        goals: [],
        status: 'SCHEDULED',
      });
      knockoutFixtures.push({
        id: 'ko-sf-2',
        stage: 'KNOCKOUT',
        knockoutRound: 'SEMI_FINAL',
        matchCode: 'SF2',
        title: 'Bán kết 2 (Hạng 2 vs Hạng 3)',
        homeLabel: 'Hạng 2 vòng bảng',
        awayLabel: 'Hạng 3 vòng bảng',
        homeTeamId: allRows[1]?.teamId || null,
        awayTeamId: allRows[2]?.teamId || null,
        homeScore: null,
        awayScore: null,
        homePenScore: null,
        awayPenScore: null,
        matchDate: '',
        matchTime: '',
        venue: '',
        goals: [],
        status: 'SCHEDULED',
      });
      knockoutFixtures.push({
        id: 'ko-3rd',
        stage: 'KNOCKOUT',
        knockoutRound: 'THIRD_PLACE',
        matchCode: 'THIRD_PLACE',
        title: 'Tranh hạng 3 (Thua Bán kết 1 vs Thua Bán kết 2)',
        homeLabel: 'Thua Bán kết 1',
        awayLabel: 'Thua Bán kết 2',
        homeTeamId: null,
        awayTeamId: null,
        homeScore: null,
        awayScore: null,
        homePenScore: null,
        awayPenScore: null,
        matchDate: '',
        matchTime: '',
        venue: '',
        goals: [],
        status: 'SCHEDULED',
      });
      knockoutFixtures.push({
        id: 'ko-final',
        stage: 'KNOCKOUT',
        knockoutRound: 'FINAL',
        matchCode: 'FINAL',
        title: 'Chung kết (Thắng Bán kết 1 vs Thắng Bán kết 2)',
        homeLabel: 'Thắng Bán kết 1',
        awayLabel: 'Thắng Bán kết 2',
        homeTeamId: null,
        awayTeamId: null,
        homeScore: null,
        awayScore: null,
        homePenScore: null,
        awayPenScore: null,
        matchDate: '',
        matchTime: '',
        venue: '',
        goals: [],
        status: 'SCHEDULED',
      });
    } else if (allRows.length >= 2) {
      knockoutFixtures.push({
        id: 'ko-final',
        stage: 'KNOCKOUT',
        knockoutRound: 'FINAL',
        matchCode: 'FINAL',
        title: 'Chung kết',
        homeLabel: 'Hạng 1',
        awayLabel: 'Hạng 2',
        homeTeamId: allRows[0]?.teamId || null,
        awayTeamId: allRows[1]?.teamId || null,
        homeScore: null,
        awayScore: null,
        homePenScore: null,
        awayPenScore: null,
        matchDate: '',
        matchTime: '',
        venue: '',
        goals: [],
        status: 'SCHEDULED',
      });
    }
  }

  return [...groupFixtures, ...knockoutFixtures];
}

/**
 * Tự động cập nhật đội vào Chung kết (cặp thắng Bán kết) và Tranh hạng 3 (cặp thua Bán kết)
 */
function syncKnockoutProgression(fixtures = []) {
  const updated = fixtures.map((f) => ({ ...f }));
  const sf1 = updated.find((f) => f.matchCode === 'SF1');
  const sf2 = updated.find((f) => f.matchCode === 'SF2');
  const thirdPlace = updated.find((f) => f.matchCode === 'THIRD_PLACE');
  const finalMatch = updated.find((f) => f.matchCode === 'FINAL');

  if (sf1) {
    const { winnerId, loserId } = getMatchWinnerAndLoser(sf1);
    if (winnerId && finalMatch && finalMatch.status !== 'FINISHED') {
      finalMatch.homeTeamId = winnerId;
    }
    if (loserId && thirdPlace && thirdPlace.status !== 'FINISHED') {
      thirdPlace.homeTeamId = loserId;
    }
  }

  if (sf2) {
    const { winnerId, loserId } = getMatchWinnerAndLoser(sf2);
    if (winnerId && finalMatch && finalMatch.status !== 'FINISHED') {
      finalMatch.awayTeamId = winnerId;
    }
    if (loserId && thirdPlace && thirdPlace.status !== 'FINISHED') {
      thirdPlace.awayTeamId = loserId;
    }
  }

  return updated;
}

/**
 * Tính toán thống kê cá nhân: Ghi bàn, Kiến tạo, và Bình chọn MVP
 */
function calculatePlayerStats(teams = [], fixtures = [], registrations = [], mvpVoting = null) {
  const playerMap = new Map();

  // Khởi tạo từ danh sách đăng ký
  for (const reg of registrations) {
    if (!reg?.userId) continue;
    playerMap.set(reg.userId, {
      userId: reg.userId,
      displayName: reg.displayName || reg.username || 'Cầu thủ',
      username: reg.username || '',
      avatar: reg.avatar || null,
      tier: reg.tier || 'C',
      tierScore: getTierScore(reg.tier || 'C'),
      position: Array.isArray(reg.positions) ? reg.positions[0] : 'FIXO',
      teamId: null,
      teamName: 'Chưa xếp đội',
      teamColor: '#64748b',
      goals: 0,
      assists: 0,
      mvpVotes: 0,
    });
  }

  // Cập nhật thông tin đội bóng từ teams
  for (const team of teams) {
    for (const p of team.players || []) {
      if (!p?.userId) continue;
      const existing = playerMap.get(p.userId) || {};
      playerMap.set(p.userId, {
        userId: p.userId,
        displayName: p.displayName || existing.displayName || 'Cầu thủ',
        username: p.username || existing.username || '',
        avatar: p.avatar || existing.avatar || null,
        tier: p.tier || existing.tier || 'C',
        tierScore: p.tierScore || getTierScore(p.tier || existing.tier || 'C'),
        position: p.position || existing.position || 'FIXO',
        isCaptain: Boolean(p.isCaptain),
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color || '#2563eb',
        goals: existing.goals || 0,
        assists: existing.assists || 0,
        mvpVotes: existing.mvpVotes || 0,
      });
    }
  }

  // Cộng dồn bàn thắng và kiến tạo từ các trận đấu
  for (const match of fixtures) {
    const goalsList = Array.isArray(match.goals) ? match.goals : [];
    for (const g of goalsList) {
      const qty = Math.max(1, Number(g.count) || 1);
      if (g.scorerId) {
        if (!playerMap.has(g.scorerId)) {
          const teamObj = teams.find((t) => t.id === g.teamId);
          playerMap.set(g.scorerId, {
            userId: g.scorerId,
            displayName: g.scorerName || 'Cầu thủ',
            username: '',
            avatar: null,
            tier: 'C',
            tierScore: 2,
            position: 'PIVOT',
            teamId: g.teamId || null,
            teamName: teamObj?.name || 'Đội bóng',
            teamColor: teamObj?.color || '#2563eb',
            goals: 0,
            assists: 0,
            mvpVotes: 0,
          });
        }
        const scorer = playerMap.get(g.scorerId);
        scorer.goals += qty;
      }

      if (g.assistId) {
        if (!playerMap.has(g.assistId)) {
          const teamObj = teams.find((t) => t.id === g.teamId);
          playerMap.set(g.assistId, {
            userId: g.assistId,
            displayName: g.assistName || 'Cầu thủ',
            username: '',
            avatar: null,
            tier: 'C',
            tierScore: 2,
            position: 'ALA_LEFT',
            teamId: g.teamId || null,
            teamName: teamObj?.name || 'Đội bóng',
            teamColor: teamObj?.color || '#2563eb',
            goals: 0,
            assists: 0,
            mvpVotes: 0,
          });
        }
        const assister = playerMap.get(g.assistId);
        assister.assists += qty;
      }
    }
  }

  // Cộng dồn phiếu bầu MVP
  const votes = Array.isArray(mvpVoting?.votes) ? mvpVoting.votes : [];
  for (const v of votes) {
    if (v?.candidateId && playerMap.has(v.candidateId)) {
      playerMap.get(v.candidateId).mvpVotes += 1;
    }
  }

  const allStats = Array.from(playerMap.values());

  const topScorers = allStats
    .filter((p) => p.goals > 0)
    .sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return b.tierScore - a.tierScore;
    });

  const topAssists = allStats
    .filter((p) => p.assists > 0)
    .sort((a, b) => {
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return b.tierScore - a.tierScore;
    });

  const candidateIdSet = Array.isArray(mvpVoting?.candidateIds) && mvpVoting.candidateIds.length > 0
    ? new Set(mvpVoting.candidateIds)
    : null;

  const mvpCandidates = allStats
    .filter((p) => !candidateIdSet || candidateIdSet.has(p.userId))
    .sort((a, b) => {
      if (b.mvpVotes !== a.mvpVotes) return b.mvpVotes - a.mvpVotes;
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return b.tierScore - a.tierScore;
    });

  let mvpWinner = null;
  if (mvpVoting?.winnerId && playerMap.has(mvpVoting.winnerId)) {
    mvpWinner = playerMap.get(mvpVoting.winnerId);
  } else if (mvpCandidates.length > 0 && mvpCandidates[0].mvpVotes > 0) {
    mvpWinner = mvpCandidates[0];
  }

  return {
    allStats,
    topScorers,
    topAssists,
    mvpCandidates,
    mvpWinner,
  };
}

function recalculateTournamentTeams(teams = []) {
  return teams.map((team) => {
    const players = (team.players || []).map((p) => {
      const tierScore = getTierScore(p.tier || 'C');
      return {
        ...p,
        tierScore,
        isCaptain: Boolean(p.isCaptain),
      };
    });

    const totalTierScore = Number(
      players.reduce((sum, p) => sum + (Number(p.tierScore) || 0), 0).toFixed(1)
    );
    const averageTierScore = players.length > 0
      ? Number((totalTierScore / players.length).toFixed(1))
      : 0;

    let captain = players.find((p) => p.isCaptain);
    if (!captain && players.length > 0) {
      const sorted = [...players].sort((a, b) => b.tierScore - a.tierScore);
      captain = sorted[0];
      for (const p of players) {
        p.isCaptain = p.userId === captain.userId;
      }
    } else if (captain) {
      for (const p of players) {
        p.isCaptain = p.userId === captain.userId;
      }
    }

    return {
      ...team,
      captainId: captain ? captain.userId : null,
      captainName: captain ? captain.displayName : null,
      totalTierScore,
      averageTierScore,
      players,
    };
  });
}

function formatTournamentPayload(tournament, currentUserId = null, currentUserRole = null) {
  const rawState = tournament.state || {};
  const phase = rawState.phase || 'DRAFT';
  const settings = rawState.settings || {
    format: 'FUTSAL_5V5',
    teamCount: 4,
    playersPerTeam: 7,
    hasPenalty: true,
  };
  const registrations = rawState.registrations || [];
  const teams = rawState.teams || [];
  const fixtures = rawState.fixtures || [];
  const mvpVoting = rawState.mvpVoting || null;

  const organizerIds = Array.isArray(tournament.organizerIds)
    ? tournament.organizerIds
    : [];

  const isOrganizer = currentUserId && organizerIds.includes(currentUserId);
  const isAdmin = currentUserRole === 'ADMIN';
  const canManage = Boolean(isAdmin || isOrganizer);
  const canRegister = phase === 'DRAFT';

  const myRegistration = currentUserId
    ? registrations.find((r) => r.userId === currentUserId) || null
    : null;

  const standings = calculateStandings(teams, fixtures);
  const {
    allStats,
    topScorers,
    topAssists,
    mvpCandidates,
    mvpWinner,
  } = calculatePlayerStats(teams, fixtures, registrations, mvpVoting);

  const finalMatch = fixtures.find((f) => f.matchCode === 'FINAL' || f.knockoutRound === 'FINAL');
  const isFinalFinished = Boolean(
    (finalMatch && finalMatch.status === 'FINISHED') || phase === 'COMPLETED'
  );

  const myMvpVote = currentUserId && Array.isArray(mvpVoting?.votes)
    ? mvpVoting.votes.find((v) => v.voterId === currentUserId) || null
    : null;

  return {
    id: tournament.id,
    title: tournament.title,
    revision: tournament.revision,
    createdById: tournament.createdById,
    createdBy: tournament.createdBy,
    organizerIds,
    createdAt: tournament.createdAt,
    updatedAt: tournament.updatedAt,
    phase,
    settings,
    state: {
      phase,
      settings,
      registrations,
      teams,
      fixtures,
      mvpVoting,
    },
    standings,
    playerStats: allStats,
    leaderboards: {
      topScorers,
      topAssists,
      mvpCandidates,
      mvpWinner,
    },
    mvpVoting,
    myMvpVote,
    isFinalFinished,
    canManage,
    canRegister,
    myRegistration,
  };
}

function calculateScoreVariance(teams) {
  const scores = teams.map((t) => t.totalTierScore);
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  return scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length;
}

function calculateHypotheticalVariance(teams, idxA, newA, idxB, newB) {
  const scores = teams.map((t, idx) => (idx === idxA ? newA : idx === idxB ? newB : t.totalTierScore));
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  return scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length;
}

function balanceTournamentTeams(registrations = [], settings = {}) {
  const teamCount = Math.max(2, Math.min(16, Number(settings.teamCount) || 4));
  const playersPerTeam = Math.max(5, Math.min(15, Number(settings.playersPerTeam) || 7));

  if (!registrations || registrations.length < teamCount) {
    throw new Error(`Cần ít nhất ${teamCount} cầu thủ để chia đội`);
  }

  const teamColors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0d9488', '#0891b2', '#4f46e5'];
  const teams = [];
  for (let i = 1; i <= teamCount; i++) {
    const group = teamCount > 4 ? (i <= Math.ceil(teamCount / 2) ? 'A' : 'B') : (i % 2 === 1 ? 'A' : 'B');
    teams.push({
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

  const mappedPlayers = registrations.map((r) => {
    const positions = Array.isArray(r.positions) ? r.positions : ['FIXO'];
    const isGK = positions.includes('GK');
    const tierScore = getTierScore(r.tier);
    return {
      userId: r.userId,
      displayName: r.displayName,
      username: r.username,
      avatar: r.avatar || null,
      tier: r.tier || 'C',
      tierScore,
      positions,
      isGK,
    };
  });

  // 1. Phân bổ thủ môn
  const gks = mappedPlayers
    .filter((p) => p.isGK)
    .sort((a, b) => b.tierScore - a.tierScore);

  const assignedUserIds = new Set();

  for (let i = 0; i < Math.min(teamCount, gks.length); i++) {
    const gk = gks[i];
    teams[i].players.push({
      userId: gk.userId,
      displayName: gk.displayName,
      username: gk.username,
      avatar: gk.avatar,
      tier: gk.tier,
      tierScore: gk.tierScore,
      position: 'GK',
      isCaptain: false,
    });
    teams[i].totalTierScore += gk.tierScore;
    assignedUserIds.add(gk.userId);
  }

  // 2. Phân bổ cầu thủ ngoài sân
  const outfield = mappedPlayers
    .filter((p) => !assignedUserIds.has(p.userId))
    .sort((a, b) => b.tierScore - a.tierScore);

  for (const player of outfield) {
    const eligibleTeams = teams.filter((t) => t.players.length < playersPerTeam);
    const targetTeams = eligibleTeams.length > 0 ? eligibleTeams : teams;

    targetTeams.sort((a, b) => {
      if (a.players.length !== b.players.length) {
        return a.players.length - b.players.length;
      }
      return a.totalTierScore - b.totalTierScore;
    });

    const targetTeam = targetTeams[0];
    const preferredPos = player.positions.find((p) => p !== 'GK') || player.positions[0] || 'FIXO';

    targetTeam.players.push({
      userId: player.userId,
      displayName: player.displayName,
      username: player.username,
      avatar: player.avatar,
      tier: player.tier,
      tierScore: player.tierScore,
      position: preferredPos,
      isCaptain: false,
    });
    targetTeam.totalTierScore += player.tierScore;
    assignedUserIds.add(player.userId);
  }

  // 3. Tối ưu hoán đổi (swap optimization)
  for (let iter = 0; iter < 100; iter++) {
    let bestSwap = null;
    let minVariance = calculateScoreVariance(teams);

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const teamA = teams[i];
        const teamB = teams[j];

        for (let a = 0; a < teamA.players.length; a++) {
          if (teamA.players[a].position === 'GK') continue;
          for (let b = 0; b < teamB.players.length; b++) {
            if (teamB.players[b].position === 'GK') continue;

            const diff = teamB.players[b].tierScore - teamA.players[a].tierScore;
            if (diff === 0) continue;

            const newScoreA = teamA.totalTierScore + diff;
            const newScoreB = teamB.totalTierScore - diff;

            const testVariance = calculateHypotheticalVariance(teams, i, newScoreA, j, newScoreB);
            if (testVariance < minVariance - 1e-4) {
              minVariance = testVariance;
              bestSwap = { i, j, a, b, diff };
            }
          }
        }
      }
    }

    if (!bestSwap) break;

    const { i, j, a, b, diff } = bestSwap;
    const temp = teams[i].players[a];
    teams[i].players[a] = teams[j].players[b];
    teams[j].players[b] = temp;
    teams[i].totalTierScore += diff;
    teams[j].totalTierScore -= diff;
  }

  // 4. Bầu đội trưởng và làm tròn điểm số
  return recalculateTournamentTeams(teams);
}

module.exports = {
  VALID_POSITIONS,
  tournamentEvents,
  calculateStandings,
  generateGroupFixtures,
  generateKnockoutFixtures,
  syncKnockoutProgression,
  getMatchWinnerAndLoser,
  calculatePlayerStats,
  recalculateTournamentTeams,
  balanceTournamentTeams,
  formatTournamentPayload,
};
