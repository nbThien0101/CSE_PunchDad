/** Balance five-a-side rosters, preserving vote priority and every participant. */
const TIER_WEIGHTS = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const MAX_TEAMS = 6;
const TEAM_COLORS = [
  ['#2563eb', '#eff6ff'], ['#ea580c', '#fff7ed'], ['#16a34a', '#f0fdf4'],
  ['#dc2626', '#fef2f2'], ['#9333ea', '#faf5ff'], ['#ca8a04', '#fefce8'],
];

function invalidInput(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function getTierScore(tier) {
  return TIER_WEIGHTS[String(tier || '').trim().toUpperCase()] || 2;
}

function getSuggestedTeamCounts(joinCount) {
  const max = Math.min(MAX_TEAMS, Math.max(2, Math.ceil(joinCount / 5)));
  const recommended = Math.max(2, Math.min(max,
    joinCount % 5 === 4 ? Math.ceil(joinCount / 5) : Math.floor(joinCount / 5)));
  return { recommended, available: Array.from({ length: max - 1 }, (_, i) => i + 2) };
}

function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function calculateTeamScore(team) {
  const gkScore = team.goalkeeper && !team.goalkeeper.isPlaceholder
    ? getTierScore(team.goalkeeper.tier) : 0;
  return gkScore + team.players.reduce((sum, p) => sum + getTierScore(p.tier), 0);
}

// Cached scores make evaluation of a pair swap O(1).
function optimizeSwaps(teams, scores) {
  for (let iteration = 0; iteration < 50; iteration++) {
    let best = null;
    let bestDelta = 0;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        for (let a = 0; a < teams[i].players.length; a++) {
          for (let b = 0; b < teams[j].players.length; b++) {
            const diff = teams[j].players[b].tierScore - teams[i].players[a].tierScore;
            const delta = 2 * diff * (scores[i] - scores[j] + diff);
            if (delta < bestDelta) {
              bestDelta = delta;
              best = { i, j, a, b, diff };
            }
          }
        }
      }
    }
    if (!best) break;
    const { i, j, a, b, diff } = best;
    [teams[i].players[a], teams[j].players[b]] = [teams[j].players[b], teams[i].players[a]];
    scores[i] += diff;
    scores[j] -= diff;
  }
}

function createDraft(players, teamCount) {
  const teams = Array.from({ length: teamCount }, (_, i) => ({
    id: `team-${i + 1}`, name: `Team ${i + 1}`,
    color: TEAM_COLORS[i][0], bg: TEAM_COLORS[i][1], goalkeeper: null, players: [],
  }));
  let goalkeepers = shuffleArray(players.filter(p => p.isGoalkeeper))
    .sort((a, b) => b.tierScore - a.tierScore).slice(0, teamCount);
  const rotating = goalkeepers.length === 0;
  // Without a registered GK, nominate real participants to rotate within their own teams.
  if (rotating) goalkeepers = shuffleArray(players).slice(0, teamCount);
  goalkeepers = shuffleArray(goalkeepers);
  const goalkeeperIds = new Set(goalkeepers.map(p => p.userId));
  for (let i = 0; i < teamCount; i++) {
    const source = i % goalkeepers.length;
    teams[i].goalkeeper = {
      ...goalkeepers[source], role: 'GK', isShared: i >= goalkeepers.length,
      ...(rotating ? { isRotating: true } : {}),
      ...(i >= goalkeepers.length ? { sharedFrom: teams[source].name } : {}),
    };
  }
  const fields = shuffleArray(players.filter(p => !goalkeeperIds.has(p.userId)))
    .sort((a, b) => b.tierScore - a.tierScore);
  // Fixed quotas keep partial teams within one outfield player of each other.
  const base = Math.floor(fields.length / teamCount);
  const extra = new Set(shuffleArray(teams.map((_, i) => i)).slice(0, fields.length % teamCount));
  const quotas = teams.map((_, i) => base + (extra.has(i) ? 1 : 0));
  const scores = teams.map(calculateTeamScore);
  for (const player of fields) {
    const eligible = shuffleArray(teams.map((_, i) => i))
      .filter(i => teams[i].players.length < quotas[i]);
    const target = eligible.reduce((best, i) => scores[i] < scores[best] ? i : best);
    teams[target].players.push({ ...player, role: 'FIELD',
      ...(player.isGoalkeeper ? { isGoalkeeperOriginal: true } : {}) });
    scores[target] += player.tierScore;
  }
  optimizeSwaps(teams, scores);
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return { teams, scores,
    objective: scores.reduce((acc, score) => acc + score * score, 0) - sum * sum / teamCount };
}

function balanceTeams(voters, options = {}) {
  if (!Array.isArray(voters)) throw invalidInput('Danh sách người tham gia không hợp lệ');
  const overrides = options.goalkeeperOverrides || {};
  if (typeof overrides !== 'object' || Array.isArray(overrides)
    || Object.values(overrides).some(value => typeof value !== 'boolean')) {
    throw invalidInput('Cấu hình thủ môn không hợp lệ');
  }
  const joinVotes = voters.filter(v => v.status === 'JOIN')
    .sort((a, b) => new Date(a.votedAt) - new Date(b.votedAt));
  const ids = new Set();
  const players = joinVotes.map((v, i) => {
    const user = v.user || {};
    if (!user.id || ids.has(user.id)) throw invalidInput('Danh sách có người thiếu ID hoặc bị trùng');
    ids.add(user.id);
    return {
      userId: user.id, displayName: user.displayName, avatar: user.avatar || null,
      tier: user.tier || null, tierScore: getTierScore(user.tier),
      isGoalkeeper: Object.hasOwn(overrides, user.id) ? overrides[user.id] : Boolean(user.isGoalkeeper),
      votedAt: v.votedAt, voteOrder: i + 1,
    };
  });
  if (players.length < 4) throw invalidInput('Cần ít nhất 4 người tham gia để chia đội');
  const suggestions = getSuggestedTeamCounts(players.length);
  const teamCount = options.teamCount === undefined ? suggestions.recommended : options.teamCount;
  if (!Number.isInteger(teamCount) || !suggestions.available.includes(teamCount)) {
    throw invalidInput(`Số đội phải là số nguyên từ 2 đến ${suggestions.available.at(-1)}`);
  }
  let selected = players.slice(0, teamCount * 5);
  const gkCount = Math.min(teamCount, selected.filter(p => p.isGoalkeeper).length);
  if (gkCount > 0 && gkCount < teamCount) {
    // Shared GKs fill slots but are only one distinct person. Keep excess fields as reserves.
    const gkIds = new Set(selected.filter(p => p.isGoalkeeper).map(p => p.userId));
    const fieldIds = new Set(selected.filter(p => !gkIds.has(p.userId))
      .slice(0, teamCount * 4).map(p => p.userId));
    selected = selected.filter(p => gkIds.has(p.userId) || fieldIds.has(p.userId));
  }
  // Bounded multi-start varies same-tier order, GK placement and partial-team quotas.
  // Compare variance: shared GK placement can change the total score between drafts.
  let best = null;
  for (let attempt = 0; attempt < 32; attempt++) {
    const draft = createDraft(selected, teamCount);
    if (!best || draft.objective < best.objective) best = draft;
    if (best.objective < 1e-9) break;
  }
  for (const team of best.teams) {
    team.totalTierScore = calculateTeamScore(team);
    team.averageTierScore = Number((team.totalTierScore / (1 + team.players.length)).toFixed(1));
    team.missingPlayersCount = 4 - team.players.length;
  }
  const selectedIds = new Set(selected.map(p => p.userId));
  const reserves = players.filter(p => !selectedIds.has(p.userId))
    .map((p, i) => ({ ...p, reserveOrder: i + 1 }));
  const mean = best.scores.reduce((sum, score) => sum + score, 0) / teamCount;
  return {
    generatedAt: new Date().toISOString(), teamCount, totalVoters: players.length,
    activePlayersCount: selected.length, reservesCount: reserves.length,
    teams: best.teams, reserves,
    variance: Number((best.scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / teamCount).toFixed(2)),
  };
}

module.exports = { getTierScore, getSuggestedTeamCounts, balanceTeams };
