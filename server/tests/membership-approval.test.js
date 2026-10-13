const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { membershipAccessError } = require('../src/utils/membership');

function load(file, db, overrides = {}) {
  const context = {
    module: { exports: {} }, process: { env: {} },
    require(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === '@prisma/client') return { PrismaClient: function () { return db; } };
      if (name === '../utils/membership') return { membershipAccessError };
      if (name === 'bcryptjs') return { hash: async () => 'hashed-password', compare: async () => true };
      if (name === 'express-validator') return { validationResult: () => ({ isEmpty: () => true }) };
      if (name === 'jsonwebtoken') return {
        verify: () => ({ userId: 'applicant' }),
        sign: () => 'signed-token',
      };
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  return context.module.exports;
}

async function invoke(handler, req) {
  const result = { status: 200, nextCalled: false };
  const res = {
    status(code) { result.status = code; return this; },
    json(payload) { result.payload = payload; return this; },
  };
  await handler(req, res, error => { if (error) result.error = error; else result.nextCalled = true; });
  return result;
}

test('registration creates a pending MEMBER without issuing JWTs, even with injected admin fields', async () => {
  let created;
  let consumed = false;
  const db = {
    otpVerification: {
      async findFirst() { return { id: 'verified-email' }; },
      async updateMany({ where }) {
        assert.equal(where.used, false);
        consumed = true;
        return { count: 1 };
      },
    },
    user: {
      async create({ data, select }) {
        created = data;
        return Object.fromEntries(Object.entries(data).filter(([key]) => select[key]));
      },
    },
    async $transaction(callback) { return callback(this); },
  };
  const controller = load('controllers/auth.controller.js', db, {
    jsonwebtoken: { sign() { assert.fail('Registration must not issue a token'); } },
  });
  const result = await invoke(controller.register, { body: {
    username: ' applicant ', displayName: ' New Applicant ', password: 'secret',
    email: ' Applicant@Example.com ', phone: '0901234567', verificationToken: 'verified',
    role: 'ADMIN', membershipStatus: 'APPROVED',
  } });
  assert.equal(result.status, 201);
  assert.equal(consumed, true);
  assert.equal(created.role, 'MEMBER');
  assert.equal(created.membershipStatus, 'PENDING');
  assert.equal(created.email, 'applicant@example.com');
  assert.equal(result.payload.user.membershipStatus, 'PENDING');
  for (const field of ['accessToken', 'refreshToken', 'passwordHash']) {
    assert.equal(Object.hasOwn(result.payload, field), false);
    assert.equal(Object.hasOwn(result.payload.user, field), false);
  }
});

test('reused verification token cannot create an account', async () => {
  const db = {
    otpVerification: {
      async findFirst() { return { id: 'token' }; },
      async updateMany() { return { count: 0 }; },
    },
    user: { async create() { assert.fail('Consumed token cannot register'); } },
    async $transaction(callback) { return callback(this); },
  };
  const result = await invoke(load('controllers/auth.controller.js', db).register, {
    body: { username: 'applicant', displayName: 'Applicant', password: 'secret', email: 'a@example.com', verificationToken: 'token' },
  });
  assert.equal(result.error.statusCode, 400);
});

for (const status of ['PENDING', 'REJECTED', 'APPROVED']) {
  test(`${status} membership is checked for login, refresh and authenticated API access`, async () => {
    const user = { id: 'applicant', passwordHash: 'hash', membershipStatus: status };
    const db = { user: { async findFirst() { return user; }, async findUnique() { return user; } } };
    const auth = load('controllers/auth.controller.js', db);
    const middleware = load('middleware/auth.middleware.js', db);
    const login = await invoke(auth.login, { body: { username: 'applicant', password: 'secret' } });
    const refresh = await invoke(auth.refresh, { body: { refreshToken: 'old-token' } });
    const access = await invoke(middleware.authenticate, { headers: { authorization: 'Bearer old-token' } });
    if (status === 'APPROVED') {
      assert.equal(login.status, 200);
      assert.ok(login.payload.accessToken);
      assert.ok(refresh.payload.accessToken);
      assert.equal(access.nextCalled, true);
    } else {
      for (const result of [login, refresh, access]) {
        assert.equal(result.status, 403);
        assert.equal(result.payload.code, `MEMBERSHIP_${status}`);
        assert.equal(result.payload.accessToken, undefined);
        assert.equal(result.nextCalled, false);
      }
    }
  });
}

test('wrong password does not reveal approval state or issue tokens', async () => {
  const controller = load('controllers/auth.controller.js', {
    user: { async findFirst() { return { membershipStatus: 'PENDING', passwordHash: 'hash' }; } },
  }, { bcryptjs: { compare: async () => false } });
  const result = await invoke(controller.login, { body: { username: 'applicant', password: 'wrong' } });
  assert.equal(result.status, 401);
  assert.equal(result.payload.code, undefined);
  assert.equal(result.payload.accessToken, undefined);
});

test('deleted users cannot refresh old tokens', async () => {
  const auth = load('controllers/auth.controller.js', { user: { async findUnique() { return null; } } });
  assert.equal((await invoke(auth.refresh, { body: { refreshToken: 'old-token' } })).status, 401);
});

test('only pending applicants are visible in the admin inbox; club roster excludes them', async () => {
  const records = [
    { id: 'pending', role: 'MEMBER', membershipStatus: 'PENDING', email: 'pending@example.com', phone: '0901234567', displayName: 'Applicant', username: 'pending', createdAt: new Date(), passwordHash: 'private' },
    { id: 'approved', role: 'MEMBER', membershipStatus: 'APPROVED' },
    { id: 'rejected', role: 'MEMBER', membershipStatus: 'REJECTED' },
  ];
  const matches = (record, where) => Object.entries(where).every(([key, value]) => record[key] === value);
  const controller = load('controllers/user.controller.js', {
    user: {
      async findMany({ where, select }) {
        return records.filter(record => matches(record, where)).map(record => Object.fromEntries(
          Object.entries(record).filter(([key]) => select[key])
        ));
      },
      async count({ where }) { return records.filter(record => matches(record, where)).length; },
    },
  });
  const inbox = await invoke(controller.getMembershipRequests, {});
  assert.equal(inbox.payload.requests.length, 1);
  assert.equal(inbox.payload.requests[0].email, 'pending@example.com');
  assert.equal(inbox.payload.requests[0].phone, '0901234567');
  assert.equal(inbox.payload.requests[0].passwordHash, undefined);
  assert.equal((await invoke(controller.getMembershipRequestCount, {})).payload.count, 1);
  const members = await invoke(controller.getAllMembers, { user: { role: 'MEMBER' } });
  assert.deepEqual(members.payload.members.map(user => user.id), ['approved']);
});

for (const decision of ['APPROVED', 'REJECTED']) {
  test(`admin ${decision} decision is atomic, audited and cannot be overwritten by a second review`, async () => {
    const applicant = { id: 'applicant', role: 'MEMBER', membershipStatus: 'PENDING' };
    const controller = load('controllers/user.controller.js', {
      user: {
        async updateMany({ where, data }) {
          if (!Object.entries(where).every(([key, value]) => applicant[key] === value)) return { count: 0 };
          Object.assign(applicant, data);
          return { count: 1 };
        },
      },
    });
    const req = { params: { userId: 'applicant' }, user: { id: 'admin' }, body: { decision } };
    assert.equal((await invoke(controller.reviewMembershipRequest, req)).status, 200);
    assert.equal(applicant.membershipStatus, decision);
    assert.equal(applicant.membershipReviewedBy, 'admin');
    assert.ok(applicant.membershipReviewedAt);
    req.body.decision = decision === 'APPROVED' ? 'REJECTED' : 'APPROVED';
    assert.equal((await invoke(controller.reviewMembershipRequest, req)).status, 409);
    assert.equal(applicant.membershipStatus, decision);
  });
}

test('invalid review decisions do not modify the applicant', async () => {
  const controller = load('controllers/user.controller.js', {
    user: { async updateMany() { assert.fail('Invalid review must not write'); } },
  });
  const result = await invoke(controller.reviewMembershipRequest, { body: { decision: 'ADMIN' } });
  assert.equal(result.status, 400);
});

test('all approval routes require authenticated admin access', async () => {
  const routes = [];
  let authentication;
  const middleware = load('middleware/auth.middleware.js', {});
  const controller = load('controllers/user.controller.js', {});
  load('routes/user.routes.js', {}, {
    express: { Router: () => ({
      use(handler) { authentication = handler; },
      get(route, ...handlers) { routes.push({ route, handlers }); },
      put(route, ...handlers) { routes.push({ route, handlers }); },
      delete() {},
    }) },
    '../controllers/user.controller': controller,
    '../middleware/auth.middleware': middleware,
  });
  assert.equal(authentication, middleware.authenticate);
  const approvals = routes.filter(route => route.route.startsWith('/membership-requests'));
  assert.equal(approvals.length, 3);
  for (const { handlers } of approvals) {
    assert.equal(handlers[0], middleware.requireAdmin);
    const member = await invoke(handlers[0], { user: { role: 'MEMBER' } });
    assert.equal(member.status, 403);
    assert.equal(member.nextCalled, false);
    assert.equal((await invoke(handlers[0], { user: { role: 'ADMIN' } })).nextCalled, true);
  }
});

test('migration approves existing members before setting the new-account default to pending', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261013090000_add_membership_approval/migration.sql'), 'utf8');
  assert.ok(sql.indexOf("NOT NULL DEFAULT 'APPROVED'") < sql.indexOf("SET DEFAULT 'PENDING'"));
  assert.ok(sql.includes("NOT NULL DEFAULT 'APPROVED'"));
  assert.ok(sql.includes("SET DEFAULT 'PENDING'"));
});
