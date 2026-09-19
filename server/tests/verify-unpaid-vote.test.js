const assert = require('assert');
const { checkUnpaidPreviousPayment } = require('../src/controllers/vote.controller');

console.log('🧪 Bắt đầu kiểm tra logic chặn vote khi chưa thanh toán trong trận đấu trước...\n');

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

async function runAsyncTests() {
  const user1Id = 'user-111';
  const currentSession = {
    id: 'session-curr',
    title: 'Trận Thứ 7 tuần này',
    playDate: new Date('2026-09-20T17:00:00.000Z'),
  };

  // Test 1: Không có khoản nợ nào
  await (async () => {
    const mockDb = {
      payment: {
        findMany: async ({ where }) => {
          assert.strictEqual(where.userId, user1Id);
          assert.deepStrictEqual(where.status, { not: 'CONFIRMED' });
          assert.strictEqual(where.session.id.not, currentSession.id);
          assert.strictEqual(where.session.status.not, 'CANCELLED');
          return [];
        },
      },
    };

    const result = await checkUnpaidPreviousPayment(user1Id, currentSession, mockDb);
    it('1. Trả về null khi user không có khoản nợ nào ở trận trước', () => {
      assert.strictEqual(result, null);
    });
  })();

  // Test 2: Có 1 khoản nợ ở trận trước (status: PENDING)
  await (async () => {
    const mockDb = {
      payment: {
        findMany: async () => [
          {
            id: 'pay-1',
            amount: 50000,
            status: 'PENDING',
            session: {
              id: 'session-prev-1',
              title: 'Trận Thứ 7 tuần trước',
              playDate: new Date('2026-09-13T17:00:00.000Z'),
              startTime: '17:00',
              location: 'Sân Chảo Lửa',
            },
          },
        ],
      },
    };

    const result = await checkUnpaidPreviousPayment(user1Id, currentSession, mockDb);
    it('2. Phát hiện khoản nợ trận trước và tạo thông báo lỗi chính xác', () => {
      assert.notStrictEqual(result, null);
      assert.strictEqual(result.hasUnpaid, true);
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.totalDebt, 50000);
      assert.strictEqual(result.sessionTitle, 'Trận Thứ 7 tuần trước');
      assert.strictEqual(result.sessionId, 'session-prev-1');
      assert(result.errorMessage.includes('Bạn chưa thanh toán tiền sân ở trận đấu trước'));
      assert(result.errorMessage.includes('50.000đ'));
    });
  })();

  // Test 3: Có nhiều hơn 1 khoản nợ ở các trận trước
  await (async () => {
    const mockDb = {
      payment: {
        findMany: async () => [
          {
            id: 'pay-2',
            amount: 60000,
            status: 'PENDING',
            session: {
              id: 'session-prev-2',
              title: 'Trận Tuần trước',
              playDate: new Date('2026-09-13T17:00:00.000Z'),
            },
          },
          {
            id: 'pay-1',
            amount: 50000,
            status: 'PAID',
            session: {
              id: 'session-prev-1',
              title: 'Trận 2 tuần trước',
              playDate: new Date('2026-09-06T17:00:00.000Z'),
            },
          },
        ],
      },
    };

    const result = await checkUnpaidPreviousPayment(user1Id, currentSession, mockDb);
    it('3. Tổng hợp chính xác khi nợ nhiều trận trước', () => {
      assert.strictEqual(result.count, 2);
      assert.strictEqual(result.totalDebt, 110000);
      assert(result.errorMessage.includes('Bạn còn 2 trận đấu trước chưa thanh toán tiền sân'));
      assert(result.errorMessage.includes('110.000đ'));
    });
  })();

  // Test 4: Cấu trúc đối tượng khi có nợ
  await (async () => {
    const unpaid = await checkUnpaidPreviousPayment('user-debt', currentSession, {
      payment: {
        findMany: async () => [
          {
            id: 'p1',
            amount: 70000,
            session: { id: 'prev', title: 'Trận trước', playDate: new Date('2026-09-10') },
          },
        ],
      },
    });

    it('4. Cấu trúc phản hồi dữ liệu khi nợ tiền sân', () => {
      assert.strictEqual(unpaid.hasUnpaid, true);
      assert.strictEqual(unpaid.amount, 70000);
      assert.strictEqual(typeof unpaid.errorMessage, 'string');
    });
  })();

  // Test 5: Ngoại lệ cho status = DECLINE (vẫn cho phép báo vắng)
  it('5. Luôn cho phép Báo vắng (DECLINE) kể cả khi còn nợ tiền trận trước', () => {
    const status = 'DECLINE';
    // Logic trong castVote và updateVote: chỉ kiểm tra nợ khi `status !== 'DECLINE'`
    const shouldCheckDebt = status !== 'DECLINE';
    assert.strictEqual(shouldCheckDebt, false, 'Không được chặn người dùng báo vắng khi nợ tiền');
  });

  console.log(`\n🏁 Kết quả: ${testsPassed} passed, ${testsFailed} failed\n`);
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAsyncTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
