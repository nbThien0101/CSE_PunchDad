const assert = require('node:assert/strict');
const { test } = require('node:test');
const { syncSessionTimeSlots, updateSession } = require('../src/controllers/session.controller');

test('syncSessionTimeSlots: modifies existing single slot in-place preserving its id and votes', async () => {
  const existingSlots = [
    { id: 'slot-1', sessionId: 'session-1', startTime: '16:00', endTime: '17:00' },
  ];

  const updated = [];
  const created = [];
  const deleted = [];

  const tx = {
    sessionTimeSlot: {
      findMany: async () => existingSlots,
      update: async ({ where, data }) => {
        updated.push({ where, data });
        return { ...where, ...data };
      },
      deleteMany: async ({ where }) => {
        deleted.push(where);
      },
      createMany: async ({ data }) => {
        created.push(...data);
      },
    },
  };

  // 1. Thử nghiệm khi có id (từ client mới)
  await syncSessionTimeSlots(tx, 'session-1', [{ id: 'slot-1', startTime: '18:00', endTime: '19:00' }]);

  assert.equal(deleted.length, 0, 'Không được xóa slot cũ khi chỉ đổi giờ');
  assert.equal(created.length, 0, 'Không được tạo slot mới khi chỉ đổi giờ');
  assert.equal(updated.length, 1, 'Phải cập nhật slot hiện tại');
  assert.equal(updated[0].where.id, 'slot-1', 'ID slot phải được giữ nguyên');
  assert.equal(updated[0].data.startTime, '18:00');
  assert.equal(updated[0].data.endTime, '19:00');
});

test('syncSessionTimeSlots: modifies existing slot in-place even when client does not send id', async () => {
  const existingSlots = [
    { id: 'slot-legacy', sessionId: 'session-1', startTime: '16:00', endTime: '17:00' },
  ];

  const updated = [];
  const created = [];
  const deleted = [];

  const tx = {
    sessionTimeSlot: {
      findMany: async () => existingSlots,
      update: async ({ where, data }) => {
        updated.push({ where, data });
        return { ...where, ...data };
      },
      deleteMany: async ({ where }) => {
        deleted.push(where);
      },
      createMany: async ({ data }) => {
        created.push(...data);
      },
    },
  };

  // 2. Thử nghiệm khi client không gửi kèm id (1-to-1 match)
  await syncSessionTimeSlots(tx, 'session-1', [{ startTime: '18:00', endTime: '19:00' }]);

  assert.equal(deleted.length, 0, 'Không được xóa slot cũ');
  assert.equal(created.length, 0, 'Không được tạo slot mới');
  assert.equal(updated.length, 1, 'Phải cập nhật slot hiện tại');
  assert.equal(updated[0].where.id, 'slot-legacy', 'ID slot cũ phải được kế thừa để bảo toàn vote');
  assert.equal(updated[0].data.startTime, '18:00');
  assert.equal(updated[0].data.endTime, '19:00');
});

test('syncSessionTimeSlots: preserves untouched slots and only creates new or deletes removed', async () => {
  const existingSlots = [
    { id: 'slot-A', sessionId: 'session-1', startTime: '16:00', endTime: '17:00' },
    { id: 'slot-B', sessionId: 'session-1', startTime: '17:00', endTime: '18:00' },
  ];

  const updated = [];
  const created = [];
  const deleted = [];

  const tx = {
    sessionTimeSlot: {
      findMany: async () => existingSlots,
      update: async ({ where, data }) => {
        updated.push({ where, data });
        return { ...where, ...data };
      },
      deleteMany: async ({ where }) => {
        deleted.push(where);
      },
      createMany: async ({ data }) => {
        created.push(...data);
      },
    },
  };

  // Giữ slot-A đổi giờ thành 15:30-16:30, xóa slot-B, thêm slot mới 19:00-20:00
  await syncSessionTimeSlots(tx, 'session-1', [
    { id: 'slot-A', startTime: '15:30', endTime: '16:30' },
    { startTime: '19:00', endTime: '20:00' },
  ]);

  assert.equal(updated.length, 1, 'Chỉ cập nhật slot-A');
  assert.equal(updated[0].where.id, 'slot-A');
  assert.equal(deleted.length, 1, 'Chỉ xóa slot-B không còn tồn tại');
  assert.deepEqual(deleted[0], { id: { in: ['slot-B'] } });
  assert.equal(created.length, 1, 'Tạo mới slot 19:00-20:00');
  assert.equal(created[0].startTime, '19:00');
});

test('updateSession controller: updates session time slots preserving existing slot IDs and votes', async () => {
  const existingSession = {
    id: 'session-test',
    status: 'VOTING',
    cancellationNote: null,
    selectedTimeSlotId: null,
  };
  const existingSlots = [
    { id: 'slot-original', startTime: '16:00', endTime: '17:00' },
  ];

  let transactionRan = false;
  const mockTx = {
    sessionTimeSlot: {
      findMany: async () => existingSlots,
      update: async ({ where, data }) => ({ ...where, ...data }),
      deleteMany: async () => {},
      createMany: async () => {},
    },
    session: {
      update: async ({ data }) => {
        return {
          id: 'session-test',
          ...data,
          timeSlots: [
            { id: 'slot-original', startTime: '18:00', endTime: '19:00', _count: { votes: 12 } },
          ],
        };
      },
    },
  };

  const mockDb = {
    session: {
      findUnique: async () => existingSession,
    },
    sessionTimeSlot: {
      findMany: async () => existingSlots,
    },
    $transaction: async (fn) => {
      transactionRan = true;
      return fn(mockTx);
    },
  };

  const req = {
    params: { id: 'session-test' },
    body: {
      timeSlots: [{ id: 'slot-original', startTime: '18:00', endTime: '19:00' }],
    },
  };

  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
  };

  await updateSession(req, res, (err) => { throw err; }, mockDb);

  assert.ok(transactionRan, 'Transaction must execute');
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.session.timeSlots[0].id, 'slot-original', 'Slot ID must be preserved');
  assert.equal(res.data.session.timeSlots[0].startTime, '18:00');
  assert.equal(res.data.session.timeSlots[0]._count.votes, 12, 'Existing votes count must remain');
});
