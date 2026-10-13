const assert = require('node:assert/strict');
const { test } = require('node:test');
const { balanceTeams, getSuggestedTeamCounts, getTierScore } = require('../src/services/team-balancer.service');

{
function voters(count, goalkeepers = 0) {
  return Array.from({ length: count }, (_, i) => ({ status: 'JOIN',
    votedAt: new Date(2026, 0, 1, 0, i).toISOString(),
    user: { id: `user-${i}`, displayName: `Player ${i}`, tier: ['S', 'A', 'B', 'C', 'D'][i % 5], isGoalkeeper: i < goalkeepers },
  }));
}

function checkRoster(result, source) {
  const active = result.teams.flatMap(team => [
    ...(team.goalkeeper.isShared ? [] : [team.goalkeeper.userId]),
    ...team.players.map(player => player.userId),
  ]);
  const reserves = result.reserves.map(player => player.userId);
  assert.equal(new Set(active).size, active.length);
  assert.equal(new Set([...active, ...reserves]).size, source.length);
  assert.deepEqual([...active, ...reserves].sort(), source.map(v => v.user.id).sort());
  assert.equal(result.activePlayersCount, active.length);
  assert.equal(result.reservesCount, reserves.length);
  assert.deepEqual(reserves, source.filter(v => !active.includes(v.user.id)).map(v => v.user.id));
  for (const team of result.teams) {
    assert.ok(team.players.length <= 4);
    assert.equal(team.missingPlayersCount, 4 - team.players.length);
    const score = getTierScore(team.goalkeeper.tier) + team.players.reduce((sum, p) => sum + getTierScore(p.tier), 0);
    assert.equal(team.totalTierScore, score);
    assert.equal(team.averageTierScore, Number((score / (1 + team.players.length)).toFixed(1)));
  }
  const scores = result.teams.map(team => team.totalTierScore);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  assert.equal(result.variance, Number((scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length).toFixed(2)));
}

test('all roster sizes and goalkeeper counts preserve participants and five-a-side capacity', () => {
  for (let count = 4; count <= 36; count++) {
    for (const gks of new Set([0, 1, 2, Math.min(count, 6), count])) {
      const source = voters(count, gks);
      for (const teamCount of getSuggestedTeamCounts(count).available) {
        checkRoster(balanceTeams(source, { teamCount }), source);
      }
    }
  }
});

test('earliest votes have priority, declined votes are excluded, and input stays intact', () => {
  const source = voters(12);
  const input = [...source].reverse();
  input.push({ status: 'DECLINE', user: { id: 'declined' } });
  const original = structuredClone(input);
  const result = balanceTeams(input, { teamCount: 2 });
  assert.deepEqual(result.reserves.map(p => p.userId), ['user-10', 'user-11']);
  assert.deepEqual(input, original);
  checkRoster(result, source);
});

test('supports rotating and shared goalkeepers and per-request overrides', () => {
  const source = voters(10);
  const rotating = balanceTeams(source, { teamCount: 2 });
  assert.ok(rotating.teams.every(team => team.goalkeeper.isRotating));
  const shared = balanceTeams(source, { teamCount: 2, goalkeeperOverrides: { 'user-0': true } });
  assert.equal(shared.teams.filter(team => team.goalkeeper.isShared).length, 1);
  assert.equal(shared.reservesCount, 1);
  checkRoster(shared, source);
  assert.ok(source.every(vote => !vote.user.isGoalkeeper));
});

test('equal-tier full teams have zero variance', () => {
  const source = voters(15, 3);
  source.forEach(vote => { vote.user.tier = 'B'; });
  const result = balanceTeams(source, { teamCount: 3 });
  assert.equal(result.variance, 0);
  checkRoster(result, source);
});

test('rejects insufficient, duplicate and malformed rosters and invalid options with HTTP 400', () => {
  for (const run of [
    () => balanceTeams(null), () => balanceTeams(voters(3)),
    () => balanceTeams([...voters(4), voters(1)[0]]),
    () => balanceTeams([{ status: 'JOIN', user: {} }, ...voters(4)]),
    ...[1, 7, 2.5, '2'].map(teamCount => () => balanceTeams(voters(10), { teamCount })),
    () => balanceTeams(voters(10), { goalkeeperOverrides: { 'user-0': 'yes' } }),
    () => balanceTeams(voters(10), { goalkeeperOverrides: [] }),
  ]) assert.throws(run, error => error.statusCode === 400);
});
}

{
function votes(n, gks = 0) {
  return Array.from({ length: n }, (_, i) => ({
    status: 'JOIN', votedAt: new Date(i * 1000).toISOString(),
    user: { id: `p${i}`, displayName: `Player ${i}`, tier: ['S', 'A', 'B', 'C', 'D'][i % 5],
      isGoalkeeper: i < gks },
  }));
}

function verifyRoster(input, result) {
  const active = [];
  const realGKIds = new Set(result.teams.filter(t => !t.goalkeeper.isShared).map(t => t.goalkeeper.userId));
  for (const team of result.teams) {
    assert.ok(team.goalkeeper.userId);
    assert.ok(team.players.length <= 4);
    assert.equal(team.missingPlayersCount, 4 - team.players.length);
    if (!team.goalkeeper.isShared) active.push(team.goalkeeper.userId);
    else {
      assert.ok(realGKIds.has(team.goalkeeper.userId));
      assert.equal(result.teams.find(t => t.name === team.goalkeeper.sharedFrom).goalkeeper.userId,
        team.goalkeeper.userId);
    }
    active.push(...team.players.map(p => p.userId));
    const score = getTierScore(team.goalkeeper.tier) + team.players.reduce((sum, p) => sum + getTierScore(p.tier), 0);
    assert.equal(team.totalTierScore, score);
    assert.equal(team.averageTierScore, Number((score / (team.players.length + 1)).toFixed(1)));
  }
  assert.equal(new Set(active).size, active.length, 'only shared GKs may occur in multiple teams');
  assert.equal(result.activePlayersCount, active.length);
  assert.equal(result.reservesCount, result.reserves.length);
  assert.deepEqual([...active, ...result.reserves.map(p => p.userId)].sort(),
    input.filter(v => v.status === 'JOIN').map(v => v.user.id).sort(), 'every participant appears exactly once');
  const counts = result.teams.map(t => t.players.length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  const mean = result.teams.reduce((sum, t) => sum + t.totalTierScore, 0) / result.teamCount;
  assert.equal(result.variance, Number((result.teams.reduce((sum, t) => sum + (t.totalTierScore - mean) ** 2, 0)
    / result.teamCount).toFixed(2)));
}

test('regressions: no GK and shared GK never lose participants', () => {
  for (const [n, gks, count, active, reserves] of [
    [10, 0, 2, 10, 0], [10, 1, 2, 9, 1], [24, 1, 5, 21, 3],
    [24, 3, 5, 23, 1], [24, 4, 5, 24, 0], [4, 0, 2, 4, 0], [30, 10, 6, 30, 0],
  ]) {
    const input = votes(n, gks);
    const result = balanceTeams(input, { teamCount: count });
    verifyRoster(input, result);
    assert.equal(result.activePlayersCount, active);
    assert.equal(result.reservesCount, reserves);
    if (!gks) assert.ok(result.teams.every(t => t.goalkeeper.isRotating && !t.goalkeeper.isPlaceholder));
  }
});

test('all supported team counts preserve rosters over varying numbers of GKs', () => {
  for (let n = 4; n <= 40; n++) {
    for (const count of getSuggestedTeamCounts(n).available) {
      for (const gks of new Set([0, 1, count - 1, count, Math.min(n, count + 2)])) {
        const input = votes(n, gks);
        verifyRoster(input, balanceTeams(input, { teamCount: count }));
      }
    }
  }
});

test('vote priority, JOIN filter, overrides and immutable input', () => {
  const input = votes(12, 2);
  input.push({ status: 'DECLINE', user: { id: 'absent' } });
  input.reverse();
  const before = JSON.stringify(input);
  const result = balanceTeams(input, { teamCount: 2, goalkeeperOverrides: { p0: false, p1: false } });
  assert.deepEqual(result.reserves.map(p => p.userId), ['p10', 'p11']);
  assert.ok(result.teams.every(t => t.goalkeeper.isRotating));
  assert.equal(JSON.stringify(input), before);
  const shared = balanceTeams(votes(12, 1), { teamCount: 2 });
  assert.deepEqual(shared.reserves.map(p => p.userId), ['p9', 'p10', 'p11']);
});

test('invalid counts and malformed participants return client errors', () => {
  for (const teamCount of [null, 0, 1, 2.5, '2', -1, NaN, Infinity, 7, 10000]) {
    assert.throws(() => balanceTeams(votes(10, 2), { teamCount }), { statusCode: 400 });
  }
  assert.throws(() => balanceTeams(votes(3)), { statusCode: 400 });
  const duplicate = votes(10);
  duplicate[1].user.id = duplicate[0].user.id;
  assert.throws(() => balanceTeams(duplicate), { statusCode: 400 });
  assert.throws(() => balanceTeams(votes(10), { goalkeeperOverrides: { p0: 'false' } }), { statusCode: 400 });
});

test('suggestions always have one shape and include the recommendation', () => {
  for (let n = 0; n <= 100; n++) {
    const result = getSuggestedTeamCounts(n);
    assert.ok(result.available.includes(result.recommended));
    assert.ok(result.available.every(k => k >= 2 && k <= 6));
  }
});

test('balanced feasible rosters reach the integer variance lower bound', () => {
  for (let repeat = 0; repeat < 20; repeat++) {
    const input = votes(20, 4).map(v => ({ ...v, user: { ...v.user, tier: 'C' } }));
    const result = balanceTeams(input, { teamCount: 4 });
    assert.equal(result.variance, 0);
    verifyRoster(input, result);
  }
});

test('two full teams match exhaustive partitioning on mixed-tier fixtures', () => {
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let trial = 0; trial < 40; trial++) {
    const input = votes(10, 2);
    for (const v of input) v.user.tier = ['S', 'A', 'B', 'C', 'D'][Math.floor(random() * 5)];
    const weights = input.map(v => getTierScore(v.user.tier));
    const total = weights.reduce((sum, score) => sum + score, 0);
    let optimum = Infinity;
    // Enumerate all 70 ways to assign four of the eight field players to the first GK.
    for (let mask = 0; mask < 256; mask++) {
      if (mask.toString(2).replace(/0/g, '').length !== 4) continue;
      let scoreA = weights[0];
      for (let i = 0; i < 8; i++) if (mask & (1 << i)) scoreA += weights[i + 2];
      const diff = 2 * scoreA - total;
      optimum = Math.min(optimum, diff * diff / 4);
    }
    const result = balanceTeams(input, { teamCount: 2 });
    assert.equal(result.variance, optimum);
    verifyRoster(input, result);
  }
});

test('late GK and interleaved roles preserve all players and reserve vote order', () => {
  const input = votes(24);
  for (const i of [5, 12, 23]) input[i].user.isGoalkeeper = true;
  input[22].user.tier = null;
  input[21].user.tier = ' b ';
  const result = balanceTeams(input, { teamCount: 5 });
  verifyRoster(input, result);
  assert.deepEqual(result.reserves.map(p => p.userId), ['p22']);
});
}
