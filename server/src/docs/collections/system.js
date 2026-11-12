/**
 * System Collection: Health check & PayOS webhook aliases (mount trực tiếp trong app.js)
 */
const { ref, jsonBody, jsonResponse, errorResponse } = require('./helpers');

const webhookOperation = (alias) => ({
  tags: ['System'],
  summary: `Webhook PayOS (alias ${alias})`,
  description: 'Alias của `POST /api/payments/payos-webhook`, hỗ trợ nhiều định dạng URL khi cấu hình trên PayOS Dashboard. Endpoint công khai, bảo mật bằng chữ ký checksum HMAC-SHA256.',
  requestBody: jsonBody(ref('PayOSWebhookBody')),
  responses: {
    200: jsonResponse('Webhook đã được ghi nhận và xử lý', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhook processed' },
      },
    }),
    400: errorResponse('Chữ ký webhook không hợp lệ'),
  },
});

module.exports = {
  tag: {
    name: 'System',
    description: 'Health check hệ thống và các alias Webhook PayOS',
  },
  schemas: {},
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Kiểm tra trạng thái hoạt động của server',
        description: 'Endpoint công khai dùng cho uptime monitor / Render health check.',
        responses: {
          200: jsonResponse('Server đang hoạt động', {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              timestamp: { type: 'string', format: 'date-time', example: '2026-11-12T13:00:00.000Z' },
            },
          }),
        },
      },
    },
    '/payos-webhook': { post: webhookOperation('/payos-webhook') },
    '/api/payos-webhook': { post: webhookOperation('/api/payos-webhook') },
  },
};
