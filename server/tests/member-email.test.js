const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/controllers/user.controller.js'), 'utf8');

for (const role of ['ADMIN', 'MEMBER']) {
  test(`member list ${role === 'ADMIN' ? 'includes' : 'omits'} registration emails for ${role}`, async () => {
    const records = [
      { id: 'registered', displayName: 'Registered member', email: 'member@example.com' },
      { id: 'legacy', displayName: 'Legacy member', email: null },
    ];
    const db = {
      user: {
        async findMany({ select }) {
          return records.map(record => Object.fromEntries(
            Object.entries(record).filter(([key]) => select[key] === true)
          ));
        },
      },
    };
    const context = {
      module: { exports: {} },
      require(name) {
        if (name === '@prisma/client') return { PrismaClient: function () { return db; } };
        if (name === 'bcryptjs') return {};
        throw new Error(`Unexpected module: ${name}`);
      },
    };
    vm.runInNewContext(source, context);
    let payload;
    await context.module.exports.getAllMembers(
      { user: { role } },
      { json(data) { payload = data; } },
      error => { throw error; }
    );
    assert.equal(payload.members.length, 2);
    if (role === 'ADMIN') {
      assert.equal(payload.members[0].email, 'member@example.com');
      assert.equal(payload.members[1].email, null);
    } else {
      for (const member of payload.members) assert.equal(Object.hasOwn(member, 'email'), false);
    }
  });
}
