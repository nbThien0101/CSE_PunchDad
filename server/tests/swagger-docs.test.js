const { test } = require('node:test');
const assert = require('node:assert/strict');
const swaggerDoc = require('../src/docs/swaggerDoc');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Swagger supports login and documents canonical User/Payment operations', () => {
  const login = swaggerDoc.paths['/api/auth/login']?.post;
  assert.ok(login, 'Login must be available directly in Swagger');
  assert.deepEqual(login.security, [], 'Login is public');
  for (const [path, method] of [
    ['/api/users', 'get'], ['/api/users/me', 'patch'],
    ['/api/users/me/password', 'put'], ['/api/users/me/avatar', 'put'],
    ['/api/users/me/qr-code', 'delete'], ['/api/users/{userId}/tier', 'patch'],
    ['/api/users/{userId}/goalkeeper', 'patch'],
    ['/api/users/membership-requests/{userId}', 'patch'],
    ['/api/sessions/{sessionId}/payments', 'get'],
    ['/api/payments/{paymentId}/mark-paid', 'post'],
    ['/api/payments/{paymentId}/confirm', 'post'],
    ['/api/payments/{paymentId}/payos-link', 'post'],
    ['/api/payments/{paymentId}/payos-status', 'get'],
  ]) {
    assert.ok(swaggerDoc.paths[path]?.[method], `${method.toUpperCase()} ${path}`);
    assert.notEqual(swaggerDoc.paths[path][method].deprecated, true);
  }
});

test('Swagger Specification: validate OpenAPI 3.0.3 root properties', () => {
  assert.equal(swaggerDoc.openapi, '3.0.3');
  assert.equal(swaggerDoc.info.title, 'CSE HitDad - Football Club Management API');
  assert.ok(swaggerDoc.info.version, 'Version must be present');
  assert.ok(Array.isArray(swaggerDoc.servers), 'Servers must be an array');
  assert.ok(swaggerDoc.servers.length >= 2, 'Should include production and localhost servers');

  const tagNames = swaggerDoc.tags.map(t => t.name);
  assert.ok(tagNames.includes('User'), 'Tags must contain User collection');
  assert.ok(tagNames.includes('Payment'), 'Tags must contain Payment collection');
});

test('Swagger Collection: User endpoints are completely documented', () => {
  const userEndpoints = [
    { path: '/api/users/members', method: 'get' },
    { path: '/api/users/export-excel', method: 'get' },
    { path: '/api/users/membership-requests', method: 'get' },
    { path: '/api/users/membership-requests/count', method: 'get' },
    { path: '/api/users/membership-requests/{userId}', method: 'put' },
    { path: '/api/users/{userId}/tier', method: 'put' },
    { path: '/api/users/{userId}/goalkeeper', method: 'put' },
    { path: '/api/users/profile', method: 'put' },
    { path: '/api/users/change-password', method: 'put' },
    { path: '/api/users/avatar', method: 'put' },
    { path: '/api/users/avatar', method: 'delete' },
    { path: '/api/users/qr-code', method: 'put' },
    { path: '/api/users/qr-code', method: 'delete' },
    { path: '/api/users/{userId}/qr-code', method: 'get' },
    { path: '/api/users/{userId}', method: 'delete' },
  ];

  for (const { path, method } of userEndpoints) {
    const op = swaggerDoc.paths[path]?.[method];
    assert.ok(op, `Path ${method.toUpperCase()} ${path} must exist in Swagger spec`);
    assert.ok(op.tags.includes('User'), `Path ${path} must be tagged with 'User'`);
    assert.ok(op.summary, `Path ${path} must have summary`);
    assert.ok(op.responses, `Path ${path} must have responses`);
  }
});

test('Swagger Collection: Payment endpoints are completely documented', () => {
  const paymentEndpoints = [
    { path: '/api/payments/session/{sessionId}', method: 'get' },
    { path: '/api/payments/{paymentId}/mark-paid', method: 'put' },
    { path: '/api/payments/{paymentId}/confirm', method: 'put' },
    { path: '/api/payments/{paymentId}/payos-link', method: 'post' },
    { path: '/api/payments/{paymentId}/payos-status', method: 'get' },
    { path: '/api/payments/payos-confirm-webhook', method: 'post' },
    { path: '/api/payments/payos-webhook', method: 'post' },
  ];

  for (const { path, method } of paymentEndpoints) {
    const op = swaggerDoc.paths[path]?.[method];
    assert.ok(op, `Path ${method.toUpperCase()} ${path} must exist in Swagger spec`);
    assert.ok(op.tags.includes('Payment'), `Path ${path} must be tagged with 'Payment'`);
    assert.ok(op.summary, `Path ${path} must have summary`);
    assert.ok(op.responses, `Path ${path} must have responses`);
  }
});

test('Swagger Components: Schemas and SecuritySchemes are valid', () => {
  const { schemas, securitySchemes } = swaggerDoc.components;

  assert.ok(securitySchemes?.BearerAuth, 'BearerAuth security scheme must be configured');
  assert.equal(securitySchemes.BearerAuth.type, 'http');
  assert.equal(securitySchemes.BearerAuth.scheme, 'bearer');

  const requiredSchemas = [
    'ErrorResponse',
    'UserMember',
    'MembershipRequest',
    'ReviewMembershipBody',
    'UpdateTierBody',
    'UpdateGoalkeeperBody',
    'UpdateProfileBody',
    'ChangePasswordBody',
    'UploadAvatarBody',
    'UploadQRCodeBody',
    'PaymentItem',
    'PayOSLinkResponse',
    'PayOSWebhookBody',
  ];

  for (const schemaName of requiredSchemas) {
    assert.ok(schemas[schemaName], `Schema ${schemaName} must be defined in components`);
  }
});

test('published JSON matches the backend and has valid local references/path parameters', () => {
  const staticPath = path.resolve(__dirname, '../../docs/swagger-web/openapi.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(staticPath, 'utf8')), swaggerDoc);
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref?.startsWith('#/')) {
      const target = value.$ref.slice(2).split('/').reduce((obj, key) => obj?.[key], swaggerDoc);
      assert.ok(target, `Unresolved reference: ${value.$ref}`);
    }
    Object.values(value).forEach(walk);
  }
  walk(swaggerDoc);
  const templates = new Set();
  for (const [route, item] of Object.entries(swaggerDoc.paths)) {
    const normalized = route.replace(/\{[^}]+\}/g, '{}');
    assert.ok(!templates.has(normalized), `Duplicate template: ${route}`);
    templates.add(normalized);
    for (const op of Object.values(item)) {
      if (!op.responses) continue;
      for (const match of route.matchAll(/\{([^}]+)\}/g)) {
        assert.ok(op.parameters?.some(p => p.in === 'path' && p.name === match[1] && p.required), `${route} parameter ${match[1]}`);
      }
    }
  }
  assert.deepEqual(swaggerDoc.paths['/api/payments/payos-webhook'].post.security, []);
  const routes = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/api-endpoints.json'), 'utf8'));
  const template = route => route.replace(/:[A-Za-z]+/g, '{}').replace(/\{[^}]+\}/g, '{}');
  for (const [route, item] of Object.entries(swaggerDoc.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!op.responses) continue;
      assert.ok(routes.some(r =>
        (r.method.toLowerCase() === method && template(r.old) === template(route)) ||
        (r.canonicalMethod.toLowerCase() === method && template(r.canonical) === template(route))
      ), `Documented operation has no route: ${method} ${route}`);
    }
  }
});

test('static Swagger UI loads JSON and Vercel configuration is static', () => {
  const dir = path.resolve(__dirname, '../../docs/swagger-web');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  let config;
  const bundle = value => { config = value; };
  bundle.presets = { apis: {} };
  bundle.plugins = { DownloadUrl: {} };
  const context = { window: {}, SwaggerUIBundle: bundle, SwaggerUIStandalonePreset: {} };
  vm.runInNewContext(script, context);
  context.window.onload();
  assert.equal(config.url, './openapi.json');
  const vercel = JSON.parse(fs.readFileSync(path.join(dir, 'vercel.json'), 'utf8'));
  assert.equal(vercel.framework, null);
  assert.equal(vercel.outputDirectory, '.');
  assert.ok(vercel.rewrites.some(r => r.source === '/swagger.json' && r.destination === '/openapi.json'));
});
