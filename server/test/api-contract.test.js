const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..', '..');
const secret = 'local-contract-test-secret';
const token = userId => jwt.sign({ userId }, secret);
const users = {
  owner: { id: 'owner', role: 'MEMBER', displayName: 'Owner' },
  other: { id: 'other', role: 'MEMBER', displayName: 'Other' },
  payer: { id: 'payer', role: 'MEMBER', displayName: 'Payer' },
  admin: { id: 'admin', role: 'ADMIN', displayName: 'Admin' },
};

// Load production modules in isolation with only infrastructure boundaries stubbed.
// No database, email or payment-provider client is created.
function fixture({ stubControllers = false } = {}) {
  const calls = [];
  const payment = { id: 'payment-1', userId: 'owner', sessionId: 'session-1', status: 'PENDING', amount: 100, session: { payerId: 'payer' } };
  const db = {
    user: { findUnique: async ({ where }) => users[where.id] || null },
    session: {
      findUnique: async ({ where }) => where.id === 'session-1' ? { id: where.id, status: 'VOTING', totalCost: 100, isVoteLocked: false } : null,
      update: async args => { calls.push(['session.update', args]); return { id: args.where.id, ...args.data }; },
      delete: async args => { calls.push(['session.delete', args]); return { id: args.where.id }; },
    },
    vote: {
      findUnique: async ({ where }) => where.id === 'vote-1' ? { id: where.id, userId: 'owner', session: { id: 'session-1', status: 'VOTING', timeSlots: [] } } : null,
      findMany: async args => { calls.push(['vote.findMany', args]); return []; },
      update: async args => { calls.push(['vote.update', args]); return { id: args.where.id, ...args.data }; },
    },
    payment: {
      findUnique: async ({ where }) => where.id === payment.id ? { ...payment } : null,
      findFirst: async args => { calls.push(['payment.findFirst', args]); return null; },
      findMany: async args => { calls.push(['payment.findMany', args]); return []; },
      update: async args => { calls.push(['payment.update', args]); return { ...payment, ...args.data }; },
      count: async () => 0,
    },
    guestPlayer: {
      findUnique: async ({ where }) => where.id === 'guest-1' ? { id: where.id, sessionId: 'session-1' } : null,
      update: async args => { calls.push(['guest.update', args]); return { id: args.where.id, ...args.data }; },
    },
    timeSlotVote: { deleteMany: async () => {}, createMany: async () => {} },
  };
  db.$transaction = async fn => fn(db);
  const payos = {
    verifyWebhookData: async body => { calls.push(['verifyWebhookData', body]); if (body.signature !== 'test-valid') throw new Error('Invalid test signature'); return body.data; },
  };
  const cache = new Map();
  let server;
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const nativeRequire = createRequire(filename);
    const isolatedRequire = name => {
      if (name === '@prisma/client') return { PrismaClient: function () { return db; } };
      if (name.endsWith('/services/payos.service')) return payos;
      if (name.endsWith('/services/email.service')) return { sendOTPEmail: async () => {} };
      if (stubControllers && name.includes('/controllers/')) {
        return new Proxy({}, { get: (_, handler) => (req, res) => res.json({ handler, params: req.params, body: req.body }) });
      }
      if (name === 'express' && filename.endsWith(`${path.sep}app.js`)) {
        return Object.assign(() => {
          const app = express();
          const listen = app.listen.bind(app);
          app.listen = (_, callback) => { server = listen(0, '127.0.0.1', callback); return server; };
          return app;
        }, express);
      }
      if (name.startsWith('.')) return load(nativeRequire.resolve(name));
      return nativeRequire(name);
    };
    const source = fs.readFileSync(filename, 'utf8');
    const run = vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      process: { env: { JWT_SECRET: secret, NODE_ENV: 'production' } },
      console: { log() {}, warn() {}, error() {} }, Buffer, URL, Date, BigInt, setTimeout, clearTimeout,
    }, { filename });
    run(isolatedRequire, module, module.exports);
    return module.exports;
  }
  load(path.join(root, 'server/src/app.js'));
  return {
    calls, db, payment,
    async request(method, url, body, user = 'admin') {
      if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${token(user)}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      return { status: response.status, data, headers: response.headers };
    },
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }),
  };
}

test('every documented canonical operation reaches its intended handler and path parameters', async t => {
  const f = fixture({ stubControllers: true });
  t.after(f.close);
  const audit = fs.readFileSync(path.join(root, 'docs/api-audit.md'), 'utf8');
  const rows = audit.split('\n').filter(line => /^\| (GET|POST|PUT|PATCH|DELETE) \| \/api/.test(line));
  assert.equal(rows.length, 49);
  const handlerByOld = [
    'health', 'register', 'login', 'refresh', 'getMe', 'sendOTP', 'verifyOTP', 'forgotPasswordSendOTP', 'forgotPasswordVerifyOTP', 'resetPassword',
    'getAllMembers', 'updateUserTier', 'updateUserGoalkeeper', 'updateProfile', 'changePassword', 'uploadAvatar', 'deleteAvatar', 'uploadQRCode', 'getQRCode', 'deleteQRCode', 'deleteMember',
    'getSessions', 'getSession', 'createSession', 'updateSession', 'deleteSession', 'adminDeleteSession', 'getTeamSuggestions', 'generateTeams', 'saveTeams', 'deleteTeams',
    'getAttendanceDashboard', 'toggleLockVote', 'updateAttendance', 'bulkAttendance', 'addGuest', 'updateGuest', 'deleteGuest', 'recalculatePayments',
    'castVote', 'adminAdjustVote', 'updateVote', 'getSessionVotes', 'getSessionPayments', 'markAsPaid', 'confirmPayment', 'createPayOSLink', 'checkPayOSStatus', 'handlePayOSWebhook',
  ];
  for (const [index, row] of rows.entries()) {
    const cells = row.split('|').map(cell => cell.trim());
    const [method, url] = cells[6].split(' ');
    const params = {};
    const actualUrl = url.replace('/api', '').replace(/:([a-zA-Z]+Id)/g, (_, param) => { params[param] = `${param}-test`; return params[param]; });
    const result = await f.request(method, actualUrl, method === 'GET' ? undefined : {});
    assert.equal(result.status, 200, `${method} ${url}`);
    assert.equal(result.headers.get('X-API-Deprecated'), null, `${method} ${url} is canonical`);
    if (index === 0) assert.equal(result.data.status, 'ok');
    else {
      assert.equal(result.data.handler, handlerByOld[index], `${method} ${url}`);
      assert.deepEqual(result.data.params, params, `${method} ${url} parameters`);
    }
    if (cells[7] === 'CHANGE') {
      const oldMethod = cells[1];
      const oldUrl = cells[2].replace('/api', '').replace(/:id\b/g, ':legacyId').replace(/:([a-zA-Z]+Id)/g, (_, param) => params[param] || Object.values(params)[0] || `${param}-test`);
      const legacy = await f.request(oldMethod, oldUrl, oldMethod === 'GET' ? undefined : {});
      assert.equal(legacy.status, result.status, `${oldMethod} ${oldUrl}`);
      assert.deepEqual(legacy.data, result.data, `legacy ${oldMethod} ${oldUrl}`);
      assert.equal(legacy.headers.get('X-API-Deprecated'), 'true');
      assert.ok(legacy.headers.get('Link').includes(`/api${actualUrl}`));
    }
  }
});

test('JWT and Admin requirements survive canonical and legacy route migration', async t => {
  const f = fixture({ stubControllers: true });
  t.after(f.close);
  for (const [method, url] of [
    ['GET', '/users'], ['PATCH', '/users/me'], ['GET', '/sessions/session-1/votes'], ['GET', '/sessions/session-1/payments'],
    ['POST', '/payments/payment-1/confirm'], ['PUT', '/payments/payment-1/confirm'],
  ]) assert.equal((await f.request(method, url, method === 'GET' ? undefined : {}, null)).status, 401);
  for (const [method, url] of [
    ['PATCH', '/users/other/tier'], ['PUT', '/users/other/tier'], ['PATCH', '/users/other/goalkeeper'],
    ['PATCH', '/sessions/session-1'], ['PUT', '/sessions/session-1'], ['POST', '/sessions/session-1/cancel'],
    ['DELETE', '/sessions/session-1'], ['DELETE', '/sessions/session-1/force'], ['POST', '/sessions/session-1/teams/generate'],
    ['PUT', '/sessions/session-1/teams'], ['DELETE', '/sessions/session-1/teams'], ['POST', '/sessions/session-1/lock-vote'],
    ['POST', '/sessions/session-1/attendance'], ['PATCH', '/sessions/session-1/attendance'], ['POST', '/sessions/session-1/attendance/bulk'],
    ['POST', '/sessions/session-1/guests'], ['PATCH', '/sessions/session-1/guests/guest-1'], ['PUT', '/sessions/session-1/guests/guest-1'],
    ['DELETE', '/sessions/session-1/guests/guest-1'], ['POST', '/sessions/session-1/recalculate-payments'],
    ['POST', '/votes/admin/adjust'], ['DELETE', '/users/other'], ['POST', '/sessions'],
  ]) assert.equal((await f.request(method, url, {}, 'other')).status, 403, `${method} ${url}`);
  for (const url of ['/sessions/session-1/attendance', '/sessions/session-1/teams/suggestions', '/sessions/session-1/votes', '/sessions/session-1/payments']) {
    assert.equal((await f.request('GET', url, undefined, 'other')).status, 200, `existing member read ${url}`);
  }
  assert.equal((await f.request('GET', '/users', undefined, 'deleted-account')).status, 401);
});

test('real payment controllers retain owner/payer rules, IDs and completion behavior', async t => {
  const f = fixture();
  t.after(f.close);
  for (const method of ['POST', 'PUT']) {
    assert.equal((await f.request(method, '/payments/payment-1/mark-paid', {}, 'other')).status, 403);
    assert.equal((await f.request(method, '/payments/payment-1/mark-paid', {}, 'admin')).status, 403);
    assert.equal((await f.request(method, '/payments/payment-1/mark-paid', {}, 'owner')).data.payment.status, 'PAID');
    assert.equal((await f.request(method, '/payments/payment-1/confirm', {}, 'owner')).status, 403);
    for (const user of ['payer', 'admin']) {
      const result = await f.request(method, '/payments/payment-1/confirm', {}, user);
      assert.equal(result.status, 200);
      assert.equal(result.data.payment.status, 'CONFIRMED');
      assert.equal(result.data.sessionCompleted, true);
    }
  }
  assert.equal((await f.request('POST', '/payments/missing/confirm', {}, 'admin')).status, 404);
  assert.equal((await f.request('POST', '/payments/payment-1/payos-link', {}, 'other')).status, 403);
  const poll = await f.request('GET', '/payments/payment-1/payos-status', undefined, 'other');
  assert.equal(poll.status, 200, 'existing poll access stays unchanged');
  assert.equal(poll.data.payment.id, 'payment-1');
  assert.ok(f.calls.some(([name, args]) => name === 'session.update' && args.data.status === 'COMPLETED'));
  assert.ok(f.calls.filter(([name]) => name === 'payment.update').every(([, args]) => args.where.id === 'payment-1'));
});

test('real controllers receive normalized session/vote/guest/QR parameters', async t => {
  const f = fixture();
  t.after(f.close);
  const patch = await f.request('PATCH', '/sessions/session-1', { title: 'Changed' });
  assert.equal(patch.status, 200);
  assert.equal(patch.data.session.id, 'session-1');
  const votes = await f.request('GET', '/sessions/session-1/votes');
  assert.equal(votes.status, 200);
  assert.ok(f.calls.some(([name, args]) => name === 'vote.findMany' && args.where.sessionId === 'session-1'));
  const payments = await f.request('GET', '/sessions/session-1/payments');
  assert.equal(payments.status, 200);
  assert.equal(payments.data.session.id, 'session-1');
  const vote = await f.request('PATCH', '/votes/vote-1', { status: 'JOIN' }, 'owner');
  assert.equal(vote.status, 200);
  assert.equal(vote.data.vote.id, 'vote-1');
  assert.equal((await f.request('PATCH', '/votes/vote-1', { status: 'JOIN' }, 'other')).status, 403);
  const guest = await f.request('PATCH', '/sessions/session-1/guests/guest-1', { isPaid: true });
  assert.equal(guest.status, 200);
  assert.equal(guest.data.guest.id, 'guest-1');
  assert.equal((await f.request('PATCH', '/sessions/other-session/guests/guest-1', {})).status, 404);
  const qr = await f.request('GET', '/users/owner/qr-code');
  assert.equal(qr.status, 200);
  assert.equal(qr.data.userId, 'owner');
  for (const [method, url] of [['POST', '/sessions/session-1/cancel'], ['DELETE', '/sessions/session-1']]) {
    const cancel = await f.request(method, url, { cancellationNote: 'Rain' });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.data.session.status, 'CANCELLED');
    assert.equal(cancel.data.session.cancellationNote, 'Rain');
  }
  assert.equal(f.calls.filter(([name]) => name === 'session.delete').length, 0, 'cancellation never hard-deletes');
  assert.equal((await f.request('DELETE', '/sessions/session-1/force')).status, 200);
  assert.equal(f.calls.filter(([name]) => name === 'session.delete').length, 1, 'only explicit force path deletes');
});

test('public webhook verifies signature before any payment lookup or write', async t => {
  const f = fixture();
  t.after(f.close);
  const invalid = await f.request('POST', '/payments/payos-webhook', { signature: 'invalid' }, null);
  assert.equal(invalid.status, 400);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], 'verifyWebhookData');
  const valid = await f.request('POST', '/payments/payos-webhook', { signature: 'test-valid', data: { orderCode: 123, amount: 100, code: '00' } }, null);
  assert.equal(valid.status, 200);
  assert.equal(valid.data.success, true);
  assert.equal(f.calls[1][0], 'verifyWebhookData');
  assert.equal(f.calls[2][0], 'payment.findFirst');
  assert.equal(f.calls.filter(([name]) => name === 'payment.update').length, 0);
  f.db.payment.findFirst = async () => f.payment;
  const settled = await f.request('POST', '/payments/payos-webhook', { signature: 'test-valid', data: { orderCode: 123, amount: 100, code: '00' } }, null);
  assert.equal(settled.status, 200);
  assert.equal(settled.data.success, true);
  const writes = f.calls.filter(([name]) => name === 'payment.update');
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1].data.status, 'CONFIRMED');
  assert.equal(writes[0][1].where.id, 'payment-1');
});

test('auth, OTP and compute throttling remain on their original operations', async t => {
  const f = fixture({ stubControllers: true });
  t.after(f.close);
  for (let i = 0; i < 5; i++) assert.equal((await f.request('POST', '/auth/send-otp', {})).status, 200);
  assert.equal((await f.request('POST', '/auth/forgot-password/send-otp', {})).status, 429);
  for (let i = 0; i < 15; i++) assert.equal((await f.request('POST', '/auth/login', {})).status, 200);
  assert.equal((await f.request('POST', '/auth/verify-otp', {})).status, 429);
  for (let i = 0; i < 20; i++) assert.equal((await f.request('POST', '/sessions/session-1/teams/generate', {})).status, 200);
  assert.equal((await f.request('POST', '/sessions/session-1/teams/generate', {})).status, 429);
});

test('changed client wrappers use canonical methods, paths and existing bodies', async () => {
  const source = fs.readFileSync(path.join(root, 'client/src/services/api.js'), 'utf8');
  const requests = [];
  const code = source.replace('import.meta.env.VITE_API_URL', 'undefined').replace(/export const /g, 'const ');
  const api = vm.runInNewContext(`${code}\n({authAPI,sessionsAPI,votesAPI,paymentsAPI,attendanceAPI,usersAPI})`, {
    localStorage: { getItem: () => null },
    fetch: async (url, options = {}) => { requests.push({ url, method: options.method || 'GET', body: options.body }); return { status: 200, json: async () => ({}) }; },
  });
  const checks = [
    [api.usersAPI.getMembers, [], 'GET', '/users'],
    [api.usersAPI.updateProfile, [{ displayName: 'Owner' }], 'PATCH', '/users/me'],
    [api.usersAPI.updateTier, ['u', 'A'], 'PATCH', '/users/u/tier'],
    [api.usersAPI.updateGoalkeeper, ['u', true], 'PATCH', '/users/u/goalkeeper'],
    [api.usersAPI.changePassword, [{ currentPassword: 'old', newPassword: 'newpass' }], 'PUT', '/users/me/password'],
    [api.usersAPI.uploadAvatar, ['image'], 'PUT', '/users/me/avatar'],
    [api.usersAPI.deleteAvatar, [], 'DELETE', '/users/me/avatar'],
    [api.usersAPI.uploadQRCode, ['image'], 'PUT', '/users/me/qr-code'],
    [api.usersAPI.deleteQRCode, [], 'DELETE', '/users/me/qr-code'],
    [api.sessionsAPI.update, ['s', { title: 'New' }], 'PATCH', '/sessions/s'],
    [api.sessionsAPI.delete, ['s', 'Rain'], 'POST', '/sessions/s/cancel'],
    [api.sessionsAPI.forceDelete, ['s'], 'DELETE', '/sessions/s/force'],
    [api.sessionsAPI.saveTeams, ['s', []], 'PUT', '/sessions/s/teams'],
    [api.votesAPI.update, ['v', { status: 'JOIN' }], 'PATCH', '/votes/v'],
    [api.votesAPI.getBySession, ['s'], 'GET', '/sessions/s/votes'],
    [api.paymentsAPI.getBySession, ['s'], 'GET', '/sessions/s/payments'],
    [api.paymentsAPI.markAsPaid, ['p'], 'POST', '/payments/p/mark-paid'],
    [api.paymentsAPI.confirm, ['p'], 'POST', '/payments/p/confirm'],
    [api.attendanceAPI.bulkCheckIn, ['s', true], 'PATCH', '/sessions/s/attendance'],
    [api.attendanceAPI.updateGuest, ['s', 'g', { isPaid: true }], 'PATCH', '/sessions/s/guests/g'],
  ];
  for (const [fn, args, method, url] of checks) {
    await fn(...args);
    const actual = requests.at(-1);
    assert.equal(actual.url, `/api${url}`);
    assert.equal(actual.method, method, url);
  }
  assert.equal(JSON.parse(requests[10].body).cancellationNote, 'Rain');
  assert.equal(JSON.parse(requests[18].body).isCheckedIn, true);
  assert.equal(JSON.parse(requests[19].body).isPaid, true);
});
