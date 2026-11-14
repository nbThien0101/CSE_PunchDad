const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const swaggerDoc = require('../src/docs/swaggerDoc');

test('Swagger Specification: validate OpenAPI 3.0.3 root properties', () => {
  assert.equal(swaggerDoc.openapi, '3.0.3');
  assert.equal(swaggerDoc.info.title, 'CSE HitDad - Football Club Management API');
  assert.ok(swaggerDoc.info.version, 'Version must be present');
  assert.ok(Array.isArray(swaggerDoc.servers), 'Servers must be an array');
  assert.ok(swaggerDoc.servers.length >= 2, 'Should include production and localhost servers');

  const tagNames = swaggerDoc.tags.map(t => t.name);
  assert.ok(tagNames.includes('User'), 'Tags must contain User collection');
  assert.ok(tagNames.includes('Payment'), 'Tags must contain Payment collection');
  assert.ok(tagNames.includes('Notification'), 'Tags must contain Notification collection');
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
    { path: '/api/users/{id}/qr-code', method: 'get' },
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
    { path: '/api/payments/{id}/mark-paid', method: 'put' },
    { path: '/api/payments/{id}/confirm', method: 'put' },
    { path: '/api/payments/{id}/payos-link', method: 'post' },
    { path: '/api/payments/{id}/payos-status', method: 'get' },
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

test('Swagger Coverage: every Express route is documented and every $ref resolves', () => {
  const mounts = {
    '/api/auth': require('../src/routes/auth.routes'),
    '/api/sessions': require('../src/routes/session.routes'),
    '/api/votes': require('../src/routes/vote.routes'),
    '/api/payments': require('../src/routes/payment.routes'),
    '/api/users': require('../src/routes/user.routes'),
    '/api/feedback': require('../src/routes/feedback.routes'),
    '/api/notifications': require('../src/routes/notification.routes'),
  };
  // Các route khai báo trực tiếp trong app.js
  const routes = [
    ['get', '/api/health'],
    ['post', '/payos-webhook'],
    ['post', '/api/payos-webhook'],
  ];
  for (const [prefix, router] of Object.entries(mounts)) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const openApiPath = (prefix + layer.route.path).replace(/\/$/, '').replace(/:(\w+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) routes.push([method, openApiPath]);
    }
  }

  const tagNames = new Set(swaggerDoc.tags.map(t => t.name));
  for (const [method, path] of routes) {
    const op = swaggerDoc.paths[path]?.[method];
    assert.ok(op, `Route ${method.toUpperCase()} ${path} must be documented in Swagger`);
    assert.ok(op.summary, `Route ${method.toUpperCase()} ${path} must have summary`);
    assert.ok(op.tags.every(tag => tagNames.has(tag)), `Route ${path} uses an undeclared tag`);
  }

  const refs = new Set(JSON.stringify(swaggerDoc).match(/#\/components\/schemas\/\w+/g) || []);
  for (const ref of refs) {
    assert.ok(swaggerDoc.components.schemas[ref.split('/').pop()], `Broken $ref ${ref}`);
  }
});

test('Swagger Collection: Notification endpoints and schemas are completely documented', () => {
  const notificationEndpoints = [
    { path: '/api/notifications/config', method: 'get' },
    { path: '/api/notifications/subscriptions', method: 'get' },
    { path: '/api/notifications/subscriptions', method: 'post' },
    { path: '/api/notifications/subscriptions', method: 'delete' },
    { path: '/api/notifications/subscriptions/{id}', method: 'delete' },
    { path: '/api/notifications/test', method: 'post' },
    { path: '/api/notifications/send', method: 'post' },
    { path: '/api/notifications', method: 'get' },
    { path: '/api/notifications/unread-count', method: 'get' },
    { path: '/api/notifications/read-all', method: 'put' },
    { path: '/api/notifications/{id}/read', method: 'put' },
    { path: '/api/notifications/{id}', method: 'delete' },
  ];

  for (const { path: routePath, method } of notificationEndpoints) {
    const op = swaggerDoc.paths[routePath]?.[method];
    assert.ok(op, `Path ${method.toUpperCase()} ${routePath} must exist in Swagger spec`);
    assert.ok(op.tags.includes('Notification'), `Path ${routePath} must be tagged with 'Notification'`);
    assert.ok(op.summary, `Path ${routePath} must have summary`);
    assert.ok(op.responses, `Path ${routePath} must have responses`);
  }

  const notificationSchemas = [
    'PushConfigResponse',
    'PushSubscriptionSummary',
    'RegisterPushSubscriptionBody',
    'UnregisterPushSubscriptionBody',
    'NotificationItem',
    'TestPushBody',
    'SendAdminNotificationBody',
  ];
  for (const schemaName of notificationSchemas) {
    assert.ok(swaggerDoc.components.schemas[schemaName], `Schema ${schemaName} must exist`);
  }
});

test('Swagger Sync: server swagger.json and docs/swagger-web/openapi.json match swaggerDoc', () => {
  const normalizedDoc = JSON.parse(JSON.stringify(swaggerDoc));
  const serverJsonPath = path.join(__dirname, '../src/docs/swagger.json');
  const webOpenApiPath = path.join(__dirname, '../../docs/swagger-web/openapi.json');

  const serverSpec = JSON.parse(fs.readFileSync(serverJsonPath, 'utf8'));
  const webSpec = JSON.parse(fs.readFileSync(webOpenApiPath, 'utf8'));

  assert.deepEqual(serverSpec, normalizedDoc, 'server/src/docs/swagger.json must match swaggerDoc');
  assert.deepEqual(webSpec, normalizedDoc, 'docs/swagger-web/openapi.json must match swaggerDoc');
});
