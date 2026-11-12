/**
 * Vote Collection: Bình chọn tham gia trận đấu
 */
const {
  bearer, ref, jsonBody, jsonResponse, errorResponse, pathParam, commonAuthErrors, commonAdminErrors,
} = require('./helpers');

const voteResultSchema = {
  type: 'object',
  properties: {
    message: { type: 'string', example: 'Đã ghi nhận bình chọn của bạn' },
    vote: ref('VoteItem'),
    sessionConfirmed: { type: 'boolean', example: false, description: 'true nếu lượt vote này giúp trận đấu đủ số người tối thiểu và chuyển sang CONFIRMED' },
    joinCount: { type: 'integer', example: 11 },
    absenceLog: { allOf: [ref('AbsenceLog')], nullable: true },
  },
};

module.exports = {
  tag: {
    name: 'Vote',
    description: 'Bình chọn tham gia / báo vắng trận đấu và chọn khung giờ thi đấu',
  },
  schemas: {
    VoteItem: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['JOIN', 'DECLINE', 'MAYBE'], example: 'JOIN' },
        votedAt: { type: 'string', format: 'date-time' },
        isCheckedIn: { type: 'boolean', example: false },
        checkedInAt: { type: 'string', format: 'date-time', nullable: true },
        checkInNote: { type: 'string', nullable: true },
        sessionId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        user: ref('UserSummary'),
        timeSlotVotes: {
          type: 'array',
          items: { type: 'object', properties: { timeSlotId: { type: 'string', format: 'uuid' } } },
        },
      },
    },
    AbsenceLog: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        sessionId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        reason: { type: 'string', nullable: true, example: 'Bận việc gia đình' },
        reportedAt: { type: 'string', format: 'date-time' },
        isLate: { type: 'boolean', example: false, description: 'Báo vắng sát giờ (dưới 2 tiếng hoặc sau khi chốt danh sách)' },
        minutesBeforeMatch: { type: 'integer', nullable: true, example: 300 },
      },
    },
    CastVoteBody: {
      type: 'object',
      required: ['sessionId', 'status'],
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['JOIN', 'DECLINE'], example: 'JOIN' },
        reason: { type: 'string', example: 'Bận đi công tác', description: 'Lý do báo vắng (khi status = DECLINE)' },
        timeSlotIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Danh sách khung giờ muốn tham gia (bắt buộc ít nhất 1 khi trận có nhiều khung giờ và status = JOIN)',
        },
      },
    },
    UpdateVoteBody: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['JOIN', 'DECLINE'], example: 'DECLINE' },
        reason: { type: 'string', example: 'Đau chân' },
        timeSlotIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      },
    },
    AdminAdjustVoteBody: {
      type: 'object',
      required: ['sessionId', 'userId', 'status'],
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        status: {
          type: 'string',
          enum: ['JOIN', 'DECLINE', 'MAYBE', 'NONE'],
          example: 'JOIN',
          description: '`NONE` để xoá lượt bình chọn của thành viên',
        },
        reason: { type: 'string' },
        timeSlotIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      },
    },
  },
  paths: {
    '/api/votes': {
      post: {
        tags: ['Vote'],
        summary: 'Bình chọn tham gia / báo vắng trận đấu',
        description: 'Tạo hoặc cập nhật lượt vote của chính mình. Bị chặn nếu trận đã khoá bình chọn, quá hạn, hoặc user còn nợ tiền sân trận trước. Khi đủ `minPlayers` người JOIN, trận chuyển sang `CONFIRMED`.',
        security: bearer,
        requestBody: jsonBody(ref('CastVoteBody')),
        responses: {
          200: jsonResponse('Đã ghi nhận bình chọn', voteResultSchema),
          400: errorResponse('Dữ liệu không hợp lệ / bình chọn đã đóng / còn nợ tiền sân'),
          ...commonAuthErrors,
          404: errorResponse('Session không tồn tại'),
        },
      },
    },
    '/api/votes/admin/adjust': {
      post: {
        tags: ['Vote'],
        summary: 'Admin điều chỉnh bình chọn của thành viên',
        description: 'ADMIN đặt trạng thái JOIN / DECLINE / MAYBE hoặc xoá (NONE) lượt bình chọn của bất kỳ thành viên nào trong trận (không áp dụng cho trận đã huỷ).',
        security: bearer,
        requestBody: jsonBody(ref('AdminAdjustVoteBody')),
        responses: {
          200: jsonResponse('Đã điều chỉnh bình chọn', {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Đã chuyển trạng thái của Nguyễn Văn An sang Tham gia' },
              vote: { allOf: [ref('VoteItem')], nullable: true },
              deleted: { type: 'boolean', description: 'Chỉ có khi status = NONE' },
              sessionConfirmed: { type: 'boolean' },
              joinCount: { type: 'integer', example: 12 },
              absenceLog: { allOf: [ref('AbsenceLog')], nullable: true },
            },
          }),
          400: errorResponse('Dữ liệu không hợp lệ hoặc trận đã huỷ'),
          ...commonAdminErrors,
          404: errorResponse('Không tìm thấy trận đấu hoặc người dùng'),
        },
      },
    },
    '/api/votes/{id}': {
      put: {
        tags: ['Vote'],
        summary: 'Cập nhật lượt bình chọn của mình',
        security: bearer,
        parameters: [pathParam('id', 'Vote ID (UUID)')],
        requestBody: jsonBody(ref('UpdateVoteBody')),
        responses: {
          200: jsonResponse('Đã cập nhật bình chọn', {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Đã ghi nhận báo vắng.' },
              vote: ref('VoteItem'),
              absenceLog: { allOf: [ref('AbsenceLog')], nullable: true },
            },
          }),
          400: errorResponse('Dữ liệu không hợp lệ / bình chọn đã đóng'),
          ...commonAuthErrors,
          403: errorResponse('Chỉ được cập nhật vote của chính mình'),
          404: errorResponse('Vote không tồn tại'),
        },
      },
    },
    '/api/votes/session/{sessionId}': {
      get: {
        tags: ['Vote'],
        summary: 'Danh sách bình chọn của một trận đấu',
        security: bearer,
        parameters: [pathParam('sessionId', 'Session ID (UUID)')],
        responses: {
          200: jsonResponse('Danh sách vote và thống kê', {
            type: 'object',
            properties: {
              votes: { type: 'array', items: ref('VoteItem') },
              summary: {
                type: 'object',
                properties: {
                  join: { type: 'integer', example: 12 },
                  decline: { type: 'integer', example: 3 },
                  maybe: { type: 'integer', example: 1 },
                  total: { type: 'integer', example: 16 },
                },
              },
            },
          }),
          ...commonAuthErrors,
        },
      },
    },
  },
};
