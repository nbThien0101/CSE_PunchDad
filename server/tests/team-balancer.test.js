const assert = require('node:assert/strict');
const { test } = require('node:test');
const { balanceTeams, getTierScore, getSuggestedTeamCounts } = require('../src/services/team-balancer.service');

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
