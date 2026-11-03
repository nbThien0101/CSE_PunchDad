const assert = require('node:assert/strict');
const { test } = require('node:test');
const { addTimeSlot } = require('../src/controllers/session.controller');

const baseSession = {
  id: 'session-1', status: 'VOTING', isVoteLocked: false,
  startTime: '17:00', endTime: '19:00',
  timeSlots: [{ id: 'slot-1', startTime: '17:00', endTime: '19:00' }],
};

async function invoke(session = baseSession, body = { startTime: '19:00', endTime: '21:00' }, transactionError) {
  const created = [];
  const registrations = [];
  const tx = {
    session: { findUnique: async () => session },
    sessionTimeSlot: { create: async ({ data }) => {
      const slot = { id: `new-${created.length}`, ...data };
      created.push(slot);
      return slot;
    } },
    vote: { findMany: async () => [{ id: 'old-vote' }] },
    timeSlotVote: { createMany: async ({ data }) => registrations.push(...data) },
  };
  const db = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    if (transactionError) throw transactionError;
    return fn(tx);
  } };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await addTimeSlot({ params: { id: 'session-1' }, user: { id: 'member', role: 'MEMBER' }, body }, res, error => { throw error; }, db);
  return { res, created, registrations };
}

test('member adds a slot without overwriting existing slots or registrations', async () => {
  const { res, created, registrations } = await invoke();
  assert.equal(res.code, 201);
  assert.equal(created.length, 1);
  assert.equal(created[0].sessionId, 'session-1');
  assert.equal(created[0].startTime, '19:00');
  assert.deepEqual(registrations, []);
});

test('rejects malformed, reversed, equal, and duplicate times', async () => {
  for (const body of [
    { startTime: '25:00', endTime: '26:00' },
    { startTime: '21:00', endTime: '19:00' },
    { startTime: '19:00', endTime: '19:00' },
    { startTime: '17:00', endTime: '19:00' },
  ]) {
    const { res, created } = await invoke(baseSession, body);
    assert.ok([400, 409].includes(res.code));
    assert.equal(created.length, 0);
  }
});

test('rejects closed, locked, expired, and missing sessions', async () => {
  for (const session of [
    { ...baseSession, status: 'BOOKED' },
    { ...baseSession, status: 'COMPLETED' },
    { ...baseSession, status: 'CANCELLED' },
    { ...baseSession, isVoteLocked: true },
    { ...baseSession, voteDeadline: new Date(0) },
    null,
  ]) {
    const { res, created } = await invoke(session);
    assert.ok([400, 404].includes(res.code));
    assert.equal(created.length, 0);
  }
});

test('enforces the 20-slot limit', async () => {
  const { res, created } = await invoke({ ...baseSession, timeSlots: Array.from({ length: 20 }, (_, i) => ({ startTime: `${String(i).padStart(2, '0')}:00`, endTime: `${String(i).padStart(2, '0')}:30` })) });
  assert.equal(res.code, 400);
  assert.equal(created.length, 0);
});

test('legacy registrations remain assigned to the original time', async () => {
  const { res, created, registrations } = await invoke({ ...baseSession, timeSlots: [] });
  assert.equal(res.code, 201);
  assert.equal(created.length, 2);
  assert.equal(created[0].startTime, '17:00');
  assert.deepEqual(registrations, [{ voteId: 'old-vote', timeSlotId: created[0].id }]);
});

test('handles simultaneous duplicate additions and transaction conflicts', async () => {
  for (const code of ['P2002', 'P2034']) {
    const { res } = await invoke(baseSession, undefined, { code });
    assert.equal(res.code, 409);
  }
});
