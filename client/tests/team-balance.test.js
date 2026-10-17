import assert from 'node:assert/strict';
import { test } from 'node:test';
import { swapFieldPlayers } from '../src/utils/teamBalance.js';

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

test('invalid or same-team swaps leave the roster intact', () => {
  const data = roster();
  for (const [first, second] of [
    [{ teamId: 'a', userId: 'p1' }, { teamId: 'a', userId: 'p1' }],
    [{ teamId: 'a', userId: 'gk' }, { teamId: 'b', userId: 'p2' }],
    [{ teamId: 'missing', userId: 'p1' }, { teamId: 'b', userId: 'p2' }],
  ]) assert.equal(swapFieldPlayers(data, first, second), data);
  assert.equal(swapFieldPlayers(null, null, null), null);
});
