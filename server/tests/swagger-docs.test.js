const { test } = require('node:test');
const assert = require('node:assert/strict');
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
