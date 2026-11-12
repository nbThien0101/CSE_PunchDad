/**
 * Feedback Collection: Góp ý / báo lỗi từ thành viên
 */
const {
  bearer, ref, jsonBody, jsonResponse, errorResponse, pathParam, commonAuthErrors, commonAdminErrors,
} = require('./helpers');

const CATEGORIES = ['BUG', 'FEATURE', 'UX', 'OTHER'];
const STATUSES = ['NEW', 'REVIEWING', 'RESOLVED'];

module.exports = {
  tag: {
    name: 'Feedback',
    description: 'Thành viên gửi góp ý / báo lỗi, ADMIN xem và xử lý phản hồi',
  },
  schemas: {
    FeedbackItem: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        category: { type: 'string', enum: CATEGORIES, example: 'BUG' },
        rating: { type: 'integer', minimum: 1, maximum: 5, nullable: true, example: 4 },
        message: { type: 'string', example: 'Nút bình chọn không phản hồi trên Safari iOS' },
        pagePath: { type: 'string', nullable: true, example: '/sessions/abc' },
        status: { type: 'string', enum: STATUSES, example: 'NEW' },
        adminNote: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        userId: { type: 'string', format: 'uuid' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            displayName: { type: 'string', example: 'Nguyễn Văn An' },
            username: { type: 'string', example: 'nguyenvanan' },
            avatar: { type: 'string', nullable: true },
          },
        },
      },
    },
    CreateFeedbackBody: {
      type: 'object',
      required: ['message'],
      properties: {
        category: { type: 'string', enum: CATEGORIES, default: 'OTHER' },
        message: { type: 'string', minLength: 10, maxLength: 2000, example: 'Nút bình chọn không phản hồi trên Safari iOS' },
        rating: { type: 'integer', minimum: 1, maximum: 5, nullable: true, example: 4 },
        pagePath: { type: 'string', maxLength: 300, example: '/sessions/abc' },
      },
    },
    UpdateFeedbackBody: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: STATUSES, example: 'RESOLVED' },
        adminNote: { type: 'string', maxLength: 2000, example: 'Đã fix ở bản 1.2.5' },
      },
    },
  },
  paths: {
    '/api/feedback': {
      post: {
        tags: ['Feedback'],
        summary: 'Gửi phản hồi / góp ý',
        security: bearer,
        requestBody: jsonBody(ref('CreateFeedbackBody')),
        responses: {
          201: jsonResponse('Đã gửi phản hồi', {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Cảm ơn bạn! Phản hồi đã được gửi đến đội ngũ phát triển.' },
              feedback: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  status: { type: 'string', example: 'NEW' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          }),
          400: errorResponse('Loại phản hồi / nội dung / mức đánh giá không hợp lệ'),
          ...commonAuthErrors,
        },
      },
      get: {
        tags: ['Feedback'],
        summary: 'Danh sách phản hồi (Admin)',
        security: bearer,
        parameters: [
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: STATUSES } },
          { name: 'category', in: 'query', required: false, schema: { type: 'string', enum: CATEGORIES } },
        ],
        responses: {
          200: jsonResponse('Danh sách phản hồi và thống kê theo trạng thái', {
            type: 'object',
            properties: {
              feedbacks: { type: 'array', items: ref('FeedbackItem') },
              stats: {
                type: 'object',
                properties: {
                  total: { type: 'integer', example: 20 },
                  NEW: { type: 'integer', example: 5 },
                  REVIEWING: { type: 'integer', example: 3 },
                  RESOLVED: { type: 'integer', example: 12 },
                },
              },
            },
          }),
          ...commonAdminErrors,
        },
      },
    },
    '/api/feedback/{id}': {
      put: {
        tags: ['Feedback'],
        summary: 'Cập nhật trạng thái phản hồi (Admin)',
        security: bearer,
        parameters: [pathParam('id', 'Feedback ID (UUID)')],
        requestBody: jsonBody(ref('UpdateFeedbackBody')),
        responses: {
          200: jsonResponse('Đã cập nhật phản hồi', {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Đã cập nhật phản hồi' },
              feedback: ref('FeedbackItem'),
            },
          }),
          400: errorResponse('Trạng thái không hợp lệ hoặc ghi chú quá dài'),
          ...commonAdminErrors,
          404: errorResponse('Không tìm thấy phản hồi'),
        },
      },
    },
  },
};
