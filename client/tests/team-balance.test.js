import assert from 'node:assert/strict';
import { test } from 'node:test';
import { swapFieldPlayers, recalculateTeams } from '../src/utils/teamBalance.js';

{
const roster = () => ({ reserves: [{ userId: 'reserve' }], teams: [
  { id: 'a', goalkeeper: { userId: 'gk', tier: 'A' }, players: [{ userId: 'p1', tier: 'S' }] },
  { id: 'b', goalkeeper: { userId: 'gk', tier: 'A', isShared: true }, players: [{ userId: 'p2', tier: 'D' }] },
  { id: 'c', goalkeeper: { isPlaceholder: true }, players: [{ userId: 'p3', tier: null }] },
] });

test('swap preserves participants, shared goalkeepers and reserves without mutating the roster', () => {
  const data = roster();
  const original = structuredClone(data);
  const result = swapFieldPlayers(data, { teamId: 'a', userId: 'p1' }, { teamId: 'b', userId: 'p2' });
  assert.deepEqual(data, original);
  assert.equal(result.teams[0].players[0].userId, 'p2');
  assert.equal(result.teams[1].players[0].userId, 'p1');
  assert.equal(result.teams[0].goalkeeper, data.teams[0].goalkeeper);
  assert.equal(result.reserves, data.reserves);
  assert.deepEqual(result.teams.map(team => team.totalTierScore), [5, 9, 2]);
  assert.deepEqual(result.teams.map(team => team.averageTierScore), [2.5, 4.5, 2]);
  assert.equal(result.variance, 8.22);
});

test('invalid or identical-player swaps leave the roster intact', () => {
  const data = roster();
  for (const [first, second] of [
    [{ teamId: 'a', userId: 'p1' }, { teamId: 'a', userId: 'p1' }],
    [{ teamId: 'a', userId: 'gk' }, { teamId: 'b', userId: 'p2' }],
    [{ teamId: 'missing', userId: 'p1' }, { teamId: 'b', userId: 'p2' }],
  ]) assert.equal(swapFieldPlayers(data, first, second), data);
  assert.equal(swapFieldPlayers(null, null, null), null);
});
}

{
const player = (userId, tier) => ({ userId, tier });
const roster = () => ({ variance: 99, teams: [
  { id: 'a', goalkeeper: { isPlaceholder: true, tier: null }, players: [player('1', 'S'), player('2', 'D')] },
  { id: 'b', goalkeeper: player('gk', 'C'), players: [player('3', ' a '), player('4', null)] },
] });

test('same-team swap preserves both players without mutating the original roster', () => {
  const data = roster();
  const result = swapFieldPlayers(data, { teamId: 'a', userId: '1' }, { teamId: 'a', userId: '2' });
  assert.deepEqual(result.teams[0].players.map(p => p.userId), ['2', '1']);
  assert.deepEqual(data.teams[0].players.map(p => p.userId), ['1', '2']);
});

test('cross-team swap recomputes scores, averages and variance with no phantom GK', () => {
  const data = roster();
  const result = swapFieldPlayers(data, { teamId: 'a', userId: '1' }, { teamId: 'b', userId: '4' });
  assert.deepEqual(result.teams.map(t => t.players.map(p => p.userId)), [['4', '2'], ['3', '1']]);
  assert.deepEqual(result.teams.map(t => t.totalTierScore), [3, 11]);
  assert.deepEqual(result.teams.map(t => t.averageTierScore), [1.5, 3.7]);
  assert.equal(result.variance, 16);
  assert.equal(data.variance, 99);
});

test('legacy placeholder GK contributes neither points nor a member', () => {
  const result = recalculateTeams(roster());
  assert.equal(result.teams[0].totalTierScore, 6);
  assert.equal(result.teams[0].averageTierScore, 3);
  assert.equal(result.variance, 1);
});

test('same player or stale selection is a no-op', () => {
  const data = roster();
  assert.equal(swapFieldPlayers(data, { teamId: 'a', userId: '1' }, { teamId: 'a', userId: '1' }), data);
  assert.equal(swapFieldPlayers(data, { teamId: 'a', userId: 'missing' }, { teamId: 'b', userId: '3' }), data);
});
}
