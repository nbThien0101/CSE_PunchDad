import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankTimeSlots, getSlotRegistrations } from '../src/utils/timeSlots.js';

test('defaults to the most registered slot, with earlier time breaking ties', () => {
  const slots = [
    { id: 'a', startTime: '17:00', endTime: '19:00', votes: [{}] },
    { id: 'b', startTime: '20:00', endTime: '22:00', votes: [{}, {}] },
    { id: 'c', startTime: '19:00', endTime: '21:00', _count: { votes: 2 } },
  ];
  assert.deepEqual(rankTimeSlots(slots).map(slot => slot.id), ['c', 'b', 'a']);
  assert.equal(slots[0].id, 'a');
  assert.deepEqual(rankTimeSlots([]), []);
});

test('a member voting for multiple slots appears once in each selected list', () => {
  const votes = [
    { id: 'both', status: 'JOIN', timeSlotVotes: [{ timeSlotId: 'a' }, { timeSlotId: 'b' }] },
    { id: 'only-a', status: 'JOIN', timeSlotVotes: [{ timeSlotId: 'a' }] },
    { id: 'absent', status: 'DECLINE', timeSlotVotes: [{ timeSlotId: 'a' }] },
    { id: 'legacy', status: 'JOIN', timeSlotVotes: [] },
  ];
  assert.deepEqual(getSlotRegistrations(votes, 'a').map(v => v.id), ['both', 'only-a']);
  assert.deepEqual(getSlotRegistrations(votes, 'b').map(v => v.id), ['both']);
  assert.deepEqual(getSlotRegistrations(votes, 'unassigned').map(v => v.id), ['legacy']);
  assert.deepEqual(getSlotRegistrations(votes, 'empty'), []);
});
