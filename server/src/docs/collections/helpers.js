/**
 * Các helper dùng chung để khai báo OpenAPI ngắn gọn cho các collection.
 */

const bearer = [{ BearerAuth: [] }];

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const jsonBody = (schema, required = true) => ({
  required,
  content: { 'application/json': { schema } },
});

const jsonResponse = (description, schema) => ({
  description,
  content: { 'application/json': { schema } },
});

const errorResponse = (description) => jsonResponse(description, ref('ErrorResponse'));

const pathParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
});

const messageSchema = (example, extraProps = {}) => ({
  type: 'object',
  properties: {
    message: { type: 'string', example },
    ...extraProps,
  },
});

const commonAuthErrors = {
  401: errorResponse('Chưa xác thực hoặc access token không hợp lệ'),
};

const commonAdminErrors = {
  ...commonAuthErrors,
  403: errorResponse('Chỉ ADMIN mới có quyền thực hiện thao tác này'),
};

module.exports = {
  bearer,
  ref,
  jsonBody,
  jsonResponse,
  errorResponse,
  pathParam,
  messageSchema,
  commonAuthErrors,
  commonAdminErrors,
};
