const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadController(file, db, extraSource = '') {
  const context = {
    module: { exports: {} },
    require(name) {
      if (name === '@prisma/client') return { PrismaClient: function () { return db; } };
      if (name === 'bcryptjs' || name === '../services/payos.service') return {};
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers', file), 'utf8') + extraSource, context);
  return context.module.exports;
}

for (const role of ['ADMIN', 'MEMBER']) {
  test(`member match count uses actual attendance in completed sessions (${role})`, async () => {
    const votes = [];
    for (const sessionStatus of ['VOTING', 'CONFIRMED', 'BOOKED', 'COMPLETED', 'CANCELLED']) {
      for (const status of ['JOIN', 'MAYBE', 'DECLINE']) {
        for (const isCheckedIn of [false, true]) {
          votes.push({ status, isCheckedIn, session: { status: sessionStatus } });
        }
      }
    }
    function matches(record, where) {
      return Object.entries(where).every(([key, value]) =>
        value && typeof value === 'object' ? matches(record[key], value) : record[key] === value
      );
    }
    const controller = loadController('user.controller.js', {
      user: {
        async findMany({ select }) {
          const counted = votes.filter(vote => matches(vote, select._count.select.votes.where));
          assert.equal(counted.length, 1);
          assert.equal(counted[0].status, 'JOIN');
          assert.equal(counted[0].isCheckedIn, true);
          assert.equal(counted[0].session.status, 'COMPLETED');
          return [
            { id: 'attended', _count: { votes: counted.length } },
            { id: 'new-member', _count: { votes: 0 } },
          ];
        },
      },
    });
    let response;
    await controller.getAllMembers(
      { user: { role } },
      { json(data) { response = data; } },
      error => { throw error; }
    );
    assert.equal(response.members[0]._count.votes, 1);
    assert.equal(response.members[1]._count.votes, 0);
  });
}

test('cancelling a completed match or removing attendance removes its count on the next read', async () => {
  const vote = { status: 'JOIN', isCheckedIn: true, session: { status: 'COMPLETED' } };
  const controller = loadController('user.controller.js', {
    user: {
      async findMany({ select }) {
        const where = select._count.select.votes.where;
        const counted = vote.status === where.status && vote.isCheckedIn === where.isCheckedIn
          && vote.session.status === where.session.status;
        return [{ id: 'member', _count: { votes: Number(counted) } }];
      },
    },
  });
  async function readCount() {
    let response;
    await controller.getAllMembers({ user: { role: 'MEMBER' } }, { json(data) { response = data; } }, error => { throw error; });
    return response.members[0]._count.votes;
  }
  assert.equal(await readCount(), 1);
  vote.session.status = 'CANCELLED';
  assert.equal(await readCount(), 0);
  vote.session.status = 'COMPLETED';
  vote.isCheckedIn = false;
  assert.equal(await readCount(), 0);
});

for (const status of ['VOTING', 'CONFIRMED', 'BOOKED', 'COMPLETED', 'CANCELLED']) {
  test(`payment completion preserves session lifecycle (${status})`, async () => {
    const session = { id: 'match', status };
    const controller = loadController('payment.controller.js', {
      payment: { async count() { return 0; } },
      session: {
        async updateMany({ where, data }) {
          const eligible = session.id === where.id && session.status === where.status;
          if (eligible) session.status = data.status;
          return { count: Number(eligible) };
        },
      },
    }, '\nmodule.exports.checkAndCompleteSession = checkAndCompleteSession;');
    assert.equal(await controller.checkAndCompleteSession('match'), status === 'BOOKED');
    assert.equal(session.status, status === 'BOOKED' ? 'COMPLETED' : status);
  });
}

test('outstanding payments keep a booked match from completing', async () => {
  const controller = loadController('payment.controller.js', {
    payment: { async count() { return 1; } },
    session: { async updateMany() { assert.fail('Session must not complete with outstanding payments'); } },
  }, '\nmodule.exports.checkAndCompleteSession = checkAndCompleteSession;');
  assert.equal(await controller.checkAndCompleteSession('match'), false);
});
