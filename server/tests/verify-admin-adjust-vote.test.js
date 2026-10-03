const assert = require('assert');
const { adminAdjustVote } = require('../src/controllers/vote.controller');

console.log('🧪 Bắt đầu kiểm tra chức năng Admin điều chỉnh trạng thái vote của user...\n');

let testsPassed = 0;
let testsFailed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
    testsFailed++;
  }
}

const mockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return res;
};

async function runTests() {
  const sampleSession = {
    id: 'session-123',
    title: 'Giao lưu FC PunchDad',
    playDate: new Date('2026-09-30T17:00:00.000Z'),
    startTime: '17:00',
    minPlayers: 6,
    status: 'VOTING',
    isVoteLocked: true, // Thử nghiệm khóa vote
    voteDeadline: new Date('2026-09-20T17:00:00.000Z'), // Đã qua hạn
  };

  const sampleUser = {
    id: 'user-456',
    displayName: 'Nguyễn Văn Test',
    avatar: null,
  };

  // 1. Kiểm tra validation khi thiếu thông tin bắt buộc
  await (async () => {
    const req = { body: { sessionId: 'session-123', userId: '' } };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, {});
    it('1. Trả về 400 nếu thiếu sessionId, userId hoặc status', () => {
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.data.error, 'sessionId, userId và status là bắt buộc');
    });
  })();

  // 2. Kiểm tra validation status không hợp lệ
  await (async () => {
    const req = { body: { sessionId: 'session-123', userId: 'user-456', status: 'INVALID_STATUS' } };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, {});
    it('2. Trả về 400 nếu status không nằm trong danh sách hỗ trợ', () => {
      assert.strictEqual(res.statusCode, 400);
      assert.ok(res.data.error.includes('Status không hợp lệ'));
    });
  })();

  // 3. Kiểm tra session không tồn tại
  await (async () => {
    const mockDb = {
      session: { findUnique: async () => null },
    };
    const req = { body: { sessionId: 'not-exist', userId: 'user-456', status: 'JOIN' } };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, mockDb);
    it('3. Trả về 404 nếu session không tồn tại', () => {
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.data.error, 'Không tìm thấy trận đấu');
    });
  })();

  // 4. Kiểm tra session đã CANCELLED
  await (async () => {
    const mockDb = {
      session: { findUnique: async () => ({ ...sampleSession, status: 'CANCELLED' }) },
    };
    const req = { body: { sessionId: 'session-123', userId: 'user-456', status: 'JOIN' } };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, mockDb);
    it('4. Trả về 400 nếu trận đấu đã bị hủy (CANCELLED)', () => {
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.data.error, 'Không thể điều chỉnh bình chọn cho trận đấu đã hủy');
    });
  })();

  // 5. Kiểm tra user không tồn tại
  await (async () => {
    const mockDb = {
      session: { findUnique: async () => sampleSession },
      user: { findUnique: async () => null },
    };
    const req = { body: { sessionId: 'session-123', userId: 'user-not-found', status: 'JOIN' } };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, mockDb);
    it('5. Trả về 404 nếu target user không tồn tại', () => {
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.data.error, 'Không tìm thấy người dùng');
    });
  })();

  // 6. Admin chỉnh sang JOIN thành công, bypass isVoteLocked và deadline, tự chuyển CONFIRMED khi đủ người
  await (async () => {
    let sessionUpdatedStatus = null;
    const mockDb = {
      session: {
        findUnique: async () => sampleSession,
        update: async ({ data }) => {
          sessionUpdatedStatus = data.status;
          return { ...sampleSession, status: data.status };
        },
      },
      user: { findUnique: async () => sampleUser },
      vote: {
        findUnique: async () => null, // chưa vote
        upsert: async ({ create }) => ({
          id: 'vote-new',
          sessionId: create.sessionId,
          userId: create.userId,
          status: create.status,
          user: sampleUser,
        }),
        count: async () => 6, // Đạt minPlayers = 6
      },
    };

    const req = { body: { sessionId: 'session-123', userId: 'user-456', status: 'JOIN' } };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, mockDb);

    it('6. Admin chỉnh sang JOIN thành công kể cả khi isVoteLocked=true và deadline đã qua; tự động xác nhận trận đấu khi đủ minPlayers', () => {
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.vote.status, 'JOIN');
      assert.strictEqual(res.data.sessionConfirmed, true);
      assert.strictEqual(sessionUpdatedStatus, 'CONFIRMED');
      assert.ok(res.data.message.includes('Nguyễn Văn Test'));
    });
  })();

  // 7. Admin chỉnh sang DECLINE, reset isCheckedIn và tạo absenceLog
  await (async () => {
    let createdAbsenceLog = null;
    let updatedVoteData = null;

    const mockDb = {
      session: { findUnique: async () => sampleSession },
      user: { findUnique: async () => sampleUser },
      absenceLog: {
        create: async ({ data }) => {
          createdAbsenceLog = data;
          return { id: 'absence-1', ...data };
        },
      },
      vote: {
        findUnique: async () => ({
          id: 'vote-old',
          sessionId: 'session-123',
          userId: 'user-456',
          status: 'JOIN',
          isCheckedIn: true,
        }),
        upsert: async ({ update }) => {
          updatedVoteData = update;
          return {
            id: 'vote-old',
            sessionId: 'session-123',
            userId: 'user-456',
            status: update.status,
            isCheckedIn: update.isCheckedIn,
            user: sampleUser,
          };
        },
        count: async () => 5,
      },
    };

    const req = {
      body: {
        sessionId: 'session-123',
        userId: 'user-456',
        status: 'DECLINE',
        reason: 'Bận việc gia đình đột xuất',
      },
    };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, mockDb);

    it('7. Admin chỉnh sang DECLINE: reset isCheckedIn=false và tạo bản ghi absenceLog', () => {
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.vote.status, 'DECLINE');
      assert.strictEqual(updatedVoteData.isCheckedIn, false);
      assert.strictEqual(updatedVoteData.checkedInAt, null);
      assert.ok(createdAbsenceLog);
      assert.strictEqual(createdAbsenceLog.reason, 'Bận việc gia đình đột xuất');
    });
  })();

  // 8. Admin xóa bình chọn (NONE hoặc DELETE)
  await (async () => {
    let deletedVoteId = null;

    const mockDb = {
      session: { findUnique: async () => sampleSession },
      user: { findUnique: async () => sampleUser },
      vote: {
        findUnique: async () => ({
          id: 'vote-to-delete',
          sessionId: 'session-123',
          userId: 'user-456',
          status: 'JOIN',
        }),
        delete: async ({ where }) => {
          deletedVoteId = where.id;
          return { id: where.id };
        },
        count: async () => 5,
      },
    };

    const req = { body: { sessionId: 'session-123', userId: 'user-456', status: 'NONE' } };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, mockDb);

    it('8. Admin hủy bình chọn (status: NONE): xóa vote thành công', () => {
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.vote, null);
      assert.strictEqual(res.data.deleted, true);
      assert.strictEqual(deletedVoteId, 'vote-to-delete');
    });
  })();

  // 9. Admin chọn khung giờ thay cho user quên vote
  await (async () => {
    const selectedSlots = ['slot-1', 'slot-2'];
    let deletedForVoteId = null;
    let createdTimeSlotVotes = [];
    const sessionWithTimeSlots = {
      ...sampleSession,
      timeSlots: [{ id: 'slot-1' }, { id: 'slot-2' }, { id: 'slot-3' }],
    };
    const mockDb = {
      session: { findUnique: async () => sessionWithTimeSlots },
      user: { findUnique: async () => sampleUser },
      vote: {
        findUnique: async () => ({
          id: 'vote-existing',
          sessionId: 'session-123',
          userId: 'user-456',
          status: 'JOIN',
        }),
        upsert: async () => ({
          id: 'vote-existing',
          sessionId: 'session-123',
          userId: 'user-456',
          status: 'JOIN',
          user: sampleUser,
        }),
        count: async () => 5,
      },
      timeSlotVote: {
        deleteMany: async ({ where }) => {
          deletedForVoteId = where.voteId;
        },
        createMany: async ({ data }) => {
          createdTimeSlotVotes = data;
        },
      },
    };

    const req = {
      body: {
        sessionId: 'session-123',
        userId: 'user-456',
        status: 'JOIN',
        timeSlotIds: selectedSlots,
      },
    };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, mockDb);

    it('9. Admin có thể cập nhật nhiều khung giờ cho user đang tham gia', () => {
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(deletedForVoteId, 'vote-existing');
      assert.deepStrictEqual(createdTimeSlotVotes, [
        { voteId: 'vote-existing', timeSlotId: 'slot-1' },
        { voteId: 'vote-existing', timeSlotId: 'slot-2' },
      ]);
      assert.deepStrictEqual(res.data.vote.timeSlotVotes, [
        { timeSlotId: 'slot-1' },
        { timeSlotId: 'slot-2' },
      ]);
    });
  })();

  // 10. Không cho phép admin gửi khung giờ không thuộc session
  await (async () => {
    const mockDb = {
      session: {
        findUnique: async () => ({
          ...sampleSession,
          timeSlots: [{ id: 'slot-1' }, { id: 'slot-2' }],
        }),
      },
    };
    const req = {
      body: {
        sessionId: 'session-123',
        userId: 'user-456',
        status: 'JOIN',
        timeSlotIds: ['slot-other-session'],
      },
    };
    const res = mockRes();
    await adminAdjustVote(req, res, () => {}, mockDb);

    it('10. Trả về 400 khi khung giờ không hợp lệ', () => {
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.data.error, 'Vui lòng chọn ít nhất một khung giờ hợp lệ');
    });
  })();

  console.log(`\n🏁 Kết quả: ${testsPassed} passed, ${testsFailed} failed\n`);
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
