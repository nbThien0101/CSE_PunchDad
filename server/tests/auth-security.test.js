const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Never fall back to DATABASE_URL: this suite may only use an explicit local test DB.
const testDatabase = process.env.AUTH_SECURITY_TEST_DATABASE_URL;
const accessSecret = crypto.randomBytes(48).toString('hex');
const refreshSecret = crypto.randomBytes(48).toString('hex');
process.env.JWT_SECRET = accessSecret;
process.env.JWT_REFRESH_SECRET = refreshSecret;
const tokens = require('../src/services/token.service');

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(data) { this.data = data; return this; },
});
const invoke = async (handler, req) => {
  const res = response();
  await handler(req, res, error => { throw error; });
  return res;
};

// Execute the actual controller source with one shared real Prisma connection.
// Email delivery is disabled; test challenges are inserted into the isolated DB.
function loadWithDatabase(relativePath, db) {
  const filename = path.resolve(__dirname, relativePath);
  const ownRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, process, console, Buffer,
    require(name) {
      if (name === '@prisma/client') return { PrismaClient: function () { return db; } };
      if (name === '../services/email.service') return { sendOTPEmail: async () => {} };
      return ownRequire(name);
    },
  }, { filename });
  return module.exports;
}

test('JWT configuration rejects documented placeholders and shared keys', () => {
  try {
    for (const secret of ['', 'short', 'punchdad_jwt_secret_key_super_safe', 'your-super-secret-jwt-key-change-this']) {
      process.env.JWT_SECRET = secret;
      assert.throws(tokens.assertJwtConfiguration);
    }
    process.env.JWT_SECRET = refreshSecret;
    assert.throws(tokens.assertJwtConfiguration);
  } finally {
    process.env.JWT_SECRET = accessSecret;
  }
  assert.doesNotThrow(tokens.assertJwtConfiguration);
});

test('JWT validation rejects changed identity, foreign signature, legacy and wrong-purpose tokens', () => {
  const user = { id: 'fixture-user', authVersion: 0 };
  const pair = tokens.generateTokens(user);
  assert.equal(tokens.verifyToken(pair.accessToken, 'access').userId, user.id);
  const pieces = pair.accessToken.split('.');
  pieces[1] = Buffer.from(JSON.stringify({ ...jwt.decode(pair.accessToken), userId: 'other-user' })).toString('base64url');
  assert.throws(() => tokens.verifyToken(pieces.join('.'), 'access'));
  assert.throws(() => tokens.verifyToken(jwt.sign({ userId: user.id }, 'punchdad_jwt_secret_key_super_safe'), 'access'));
  assert.throws(() => tokens.verifyToken(jwt.sign({ userId: user.id }, accessSecret), 'access'));
  assert.throws(() => tokens.verifyToken(jwt.sign({ userId: user.id, authVersion: 0, tokenType: 'refresh' }, accessSecret), 'access'));
  assert.throws(() => tokens.verifyToken(pair.accessToken, 'refresh'));
  assert.throws(() => tokens.verifyToken(pair.refreshToken, 'access'));
});

test('auth security against isolated PostgreSQL', { skip: !testDatabase }, async (t) => {
  const url = new URL(testDatabase);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only loopback test DB is allowed');
  assert.equal(url.pathname, '/cse_punchdad_auth_security', 'Dedicated test DB name is required');
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: testDatabase } } });
  const auth = loadWithDatabase('../src/controllers/auth.controller.js', db);
  const otp = loadWithDatabase('../src/controllers/otp.controller.js', db);
  const users = loadWithDatabase('../src/controllers/user.controller.js', db);
  const middleware = loadWithDatabase('../src/middleware/auth.middleware.js', db);
  const suffix = crypto.randomBytes(6).toString('hex');
  const email = `victim-${suffix}@example.test`;
  const password = 'original-test-password';
  const victim = await db.user.create({ data: {
    username: `victim${suffix}`, email, displayName: 'Victim test', membershipStatus: 'APPROVED',
    passwordHash: await bcrypt.hash(password, 4),
  } });
  const other = await db.user.create({ data: {
    username: `other${suffix}`, email: `other-${suffix}@example.test`, displayName: 'Other test', membershipStatus: 'APPROVED',
    passwordHash: await bcrypt.hash('other-password', 4),
  } });
  const challenge = (value, overrides = {}) => db.otpVerification.create({ data: {
    email, otp: value, expiresAt: new Date(Date.now() + 300000), ...overrides,
  } });
  const authenticate = async (token) => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = response();
    let accepted = false;
    await middleware.authenticate(req, res, () => { accepted = true; });
    return { accepted, req, res };
  };
  const oldTokens = tokens.generateTokens(victim);
  try {
    await t.test('login and authentication return the right identity and no password hash', async () => {
      const result = await invoke(auth.login, { body: { username: victim.username, password } });
      assert.equal(result.data.user.id, victim.id);
      assert.equal(result.data.user.passwordHash, undefined);
      const checked = await authenticate(result.data.accessToken);
      assert.equal(checked.accepted, true);
      assert.equal(checked.req.user.id, victim.id);
      assert.equal(checked.req.user.authVersion, undefined);
      assert.equal(checked.req.user.passwordHash, undefined);
    });
    await t.test('valid user cannot get another identity by changing the token payload', async () => {
      const pair = tokens.generateTokens(other);
      const pieces = pair.accessToken.split('.');
      pieces[1] = Buffer.from(JSON.stringify({ ...jwt.decode(pair.accessToken), userId: victim.id })).toString('base64url');
      assert.equal((await authenticate(pieces.join('.'))).res.statusCode, 401);
    });
    await t.test('profile ignores another user ID and role supplied in the request body', async () => {
      await invoke(users.updateProfile, { user: { id: other.id }, body: {
        userId: victim.id, id: victim.id, role: 'ADMIN', displayName: 'Updated other',
      } });
      const currentVictim = await db.user.findUnique({ where: { id: victim.id } });
      const currentOther = await db.user.findUnique({ where: { id: other.id } });
      assert.equal(currentVictim.displayName, 'Victim test');
      assert.equal(currentOther.role, 'MEMBER');
      const denied = response();
      middleware.requireAdmin({ user: { id: other.id, role: currentOther.role } }, denied, () => assert.fail('Admin access allowed'));
      assert.equal(denied.statusCode, 403);
    });
    await t.test('OTP query-filter objects, arrays and nonnumeric strings are rejected', async () => {
      await challenge('register_123456');
      for (const value of [{ not: '' }, { startsWith: '' }, ['123456'], 123456, 'verified_bad', '12345']) {
        const result = await invoke(otp.verifyOTP, { body: { email, otp: value } });
        assert.equal(result.statusCode, 400);
        assert.equal(result.data.verificationToken, undefined);
      }
    });
    await t.test('registration code produces a proof once, including concurrent requests', async () => {
      const results = await Promise.all([1, 2].map(() => invoke(otp.verifyOTP, { body: { email, otp: '123456' } })));
      assert.equal(results.filter(result => result.data.verificationToken).length, 1);
      assert.equal(results.filter(result => result.statusCode === 400).length, 1);
    });
    await t.test('registration OTP cannot authorize a password reset', async () => {
      const result = await invoke(otp.forgotPasswordVerifyOTP, { body: { email, otp: '123456' } });
      assert.equal(result.statusCode, 400);
      assert.equal(result.data.resetToken, undefined);
    });
    await t.test('five wrong guesses lock a reset challenge even when the next code is correct', async () => {
      const record = await challenge('forgot_234567');
      for (let attempt = 0; attempt < 5; attempt++) {
        assert.equal((await invoke(otp.forgotPasswordVerifyOTP, { body: { email, otp: '000000' } })).statusCode, 400);
      }
      assert.equal((await db.otpVerification.findUnique({ where: { id: record.id } })).attempts, 5);
      assert.equal((await invoke(otp.forgotPasswordVerifyOTP, { body: { email, otp: '234567' } })).statusCode, 400);
    });
    await t.test('latest code is required and expired challenges cannot be exchanged', async () => {
      await challenge('forgot_345678', { createdAt: new Date(Date.now() - 20000) });
      await challenge('forgot_456789', { expiresAt: new Date(Date.now() - 1) });
      for (const code of ['345678', '456789']) {
        assert.equal((await invoke(otp.forgotPasswordVerifyOTP, { body: { email, otp: code } })).statusCode, 400);
      }
    });
    let resetToken;
    await t.test('correct reset OTP produces only one reset proof under concurrency', async () => {
      await challenge('forgot_567890');
      const results = await Promise.all([1, 2].map(() => invoke(otp.forgotPasswordVerifyOTP, { body: { email, otp: '567890' } })));
      const proofs = results.filter(result => result.data.resetToken);
      assert.equal(proofs.length, 1);
      resetToken = proofs[0].data.resetToken;
    });
    await t.test('reset proof is bound to its verified email', async () => {
      const result = await invoke(otp.resetPassword, { body: { email: other.email, resetToken, newPassword: 'new-test-password' } });
      assert.equal(result.statusCode, 400);
      assert.equal((await db.user.findUnique({ where: { id: other.id } })).authVersion, 0);
    });
    await t.test('concurrent reset uses a proof once and revokes old access AND refresh tokens', async () => {
      const results = await Promise.all([1, 2].map(() => invoke(otp.resetPassword, { body: {
        email, resetToken, newPassword: 'new-test-password',
      } })));
      assert.equal(results.filter(result => result.statusCode === 200).length, 1);
      assert.equal(results.filter(result => result.statusCode === 400).length, 1);
      assert.equal((await authenticate(oldTokens.accessToken)).res.statusCode, 401);
      assert.equal((await invoke(auth.refresh, { body: { refreshToken: oldTokens.refreshToken } })).statusCode, 401);
      const current = await db.user.findUnique({ where: { id: victim.id } });
      assert.equal(current.authVersion, 1);
      assert.ok(await bcrypt.compare('new-test-password', current.passwordHash));
      assert.equal((await authenticate(tokens.generateTokens(current).accessToken)).accepted, true);
    });
    await t.test('password change also revokes all existing sessions', async () => {
      const current = await db.user.findUnique({ where: { id: victim.id } });
      const pair = tokens.generateTokens(current);
      const result = await invoke(users.changePassword, { user: { id: victim.id }, body: {
        currentPassword: 'new-test-password', newPassword: 'changed-test-password',
      } });
      assert.equal(result.statusCode, 200);
      assert.equal((await authenticate(pair.accessToken)).res.statusCode, 401);
      assert.equal((await invoke(auth.refresh, { body: { refreshToken: pair.refreshToken } })).statusCode, 401);
    });
    await t.test('deleted user cannot refresh or authenticate', async () => {
      const pair = tokens.generateTokens(other);
      await db.user.delete({ where: { id: other.id } });
      assert.equal((await authenticate(pair.accessToken)).res.statusCode, 401);
      assert.equal((await invoke(auth.refresh, { body: { refreshToken: pair.refreshToken } })).statusCode, 401);
    });
    await t.test('registration requires an email-bound, single-use verification proof', async () => {
      const proof = crypto.randomBytes(32).toString('hex');
      const registrationEmail = `register-${suffix}@example.test`;
      await db.otpVerification.create({ data: {
        email: registrationEmail, otp: `verified_${proof}`, expiresAt: new Date(Date.now() + 300000),
      } });
      const body = { username: `register${suffix}`, email: registrationEmail, verificationToken: proof,
        password: 'register-password', displayName: 'Registered test' };
      assert.equal((await invoke(auth.register, { body: { ...body, email: `wrong-${suffix}@example.test` } })).statusCode, 400);
      const results = await Promise.all([1, 2].map(() => invoke(auth.register, { body })));
      assert.equal(results.filter(result => result.statusCode === 201).length, 1);
      assert.equal(results.filter(result => result.statusCode === 400).length, 1);
      const created = results.find(result => result.statusCode === 201);
      assert.equal(created.data.user.authVersion, undefined);
      assert.equal(created.data.user.membershipStatus, 'PENDING');
      assert.equal(created.data.accessToken, undefined);
      assert.equal(created.data.refreshToken, undefined);
      const pendingLogin = await invoke(auth.login, { body: { username: body.username, password: body.password } });
      assert.equal(pendingLogin.statusCode, 403);
      const approved = await db.user.update({ where: { email: registrationEmail }, data: { membershipStatus: 'APPROVED' } });
      const approvedLogin = await invoke(auth.login, { body: { username: body.username, password: body.password } });
      assert.equal(approvedLogin.statusCode, 200);
      assert.equal((await authenticate(approvedLogin.data.accessToken)).accepted, true);
      await db.user.update({ where: { id: approved.id }, data: { membershipStatus: 'REJECTED' } });
      assert.equal((await authenticate(approvedLogin.data.accessToken)).res.statusCode, 403);
      assert.equal((await invoke(auth.refresh, { body: { refreshToken: approvedLogin.data.refreshToken } })).statusCode, 403);
      await db.user.deleteMany({ where: { email: registrationEmail } });
      await db.otpVerification.deleteMany({ where: { email: registrationEmail } });
    });
  } finally {
    await db.otpVerification.deleteMany({ where: { email } });
    await db.user.deleteMany({ where: { id: { in: [victim.id, other.id] } } });
    await db.$disconnect();
  }
});
