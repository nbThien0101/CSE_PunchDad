/**
 * Session Collection: Quản lý trận đấu, khung giờ, chia đội, điểm danh và khách mời
 */
const {
  bearer, ref, jsonBody, jsonResponse, errorResponse, pathParam, messageSchema,
  commonAuthErrors, commonAdminErrors,
} = require('./helpers');

const TIME_PATTERN = '^([01]\\d|2[0-3]):([0-5]\\d)$';
const SESSION_STATUSES = ['VOTING', 'CONFIRMED', 'BOOKED', 'COMPLETED', 'CANCELLED'];
const sessionIdParam = pathParam('id', 'Session ID (UUID)');
const guestIdParam = pathParam('guestId', 'Guest ID (UUID)');
const notFound = errorResponse('Không tìm thấy trận đấu');

const sessionMessageResponse = (description, example) => jsonResponse(
  description,
  messageSchema(example, { session: ref('SessionDetail') }),
);

module.exports = {
  tags: [
    { name: 'Session', description: 'Quản lý trận đấu (buổi đá bóng) và khung giờ bình chọn' },
    { name: 'Team', description: 'Gợi ý số đội, chia đội cân bằng theo tier và lưu đội hình' },
    { name: 'Attendance', description: 'Matchday dashboard: chốt bình chọn, điểm danh, khách mời và tính lại tiền sân' },
  ],
  schemas: {
    UserSummary: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        displayName: { type: 'string', example: 'Nguyễn Văn An' },
        avatar: { type: 'string', nullable: true },
      },
    },
    TimeSlot: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        sessionId: { type: 'string', format: 'uuid' },
        startTime: { type: 'string', pattern: TIME_PATTERN, example: '18:00' },
        endTime: { type: 'string', pattern: TIME_PATTERN, example: '19:30' },
        createdAt: { type: 'string', format: 'date-time' },
        _count: {
          type: 'object',
          properties: { votes: { type: 'integer', example: 8, description: 'Số lượt JOIN chọn khung giờ này' } },
        },
      },
    },
    TimeSlotInput: {
      type: 'object',
      required: ['startTime', 'endTime'],
      properties: {
        startTime: { type: 'string', pattern: TIME_PATTERN, example: '18:00' },
        endTime: { type: 'string', pattern: TIME_PATTERN, example: '19:30' },
      },
    },
    SessionDetail: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string', example: 'Đá bóng tối thứ 5' },
        playDate: { type: 'string', format: 'date-time', example: '2026-11-20T00:00:00.000Z' },
        startTime: { type: 'string', example: '18:00' },
        endTime: { type: 'string', example: '19:30' },
        location: { type: 'string', example: 'Sân bóng Chảo Lửa' },
        googleMapsUrl: { type: 'string', nullable: true, example: 'https://maps.app.goo.gl/abc' },
        minPlayers: { type: 'integer', example: 10 },
        maxPlayers: { type: 'integer', example: 20 },
        totalCost: { type: 'number', nullable: true, example: 600000 },
        splitCount: { type: 'integer', nullable: true, example: 12 },
        status: { type: 'string', enum: SESSION_STATUSES, example: 'VOTING' },
        cancellationNote: { type: 'string', nullable: true },
        teams: { type: 'object', nullable: true, description: 'Đội hình đã lưu (JSON tự do)' },
        voteDeadline: { type: 'string', format: 'date-time', nullable: true },
        isVoteLocked: { type: 'boolean', example: false },
        voteLockedAt: { type: 'string', format: 'date-time', nullable: true },
        selectedTimeSlotId: { type: 'string', format: 'uuid', nullable: true },
        createdById: { type: 'string', format: 'uuid' },
        payerId: { type: 'string', format: 'uuid', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        createdBy: ref('UserSummary'),
        payer: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            displayName: { type: 'string' },
            bankInfo: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            avatar: { type: 'string', nullable: true },
          },
        },
        votes: { type: 'array', items: ref('VoteItem') },
        timeSlots: { type: 'array', items: ref('TimeSlot') },
        _count: {
          type: 'object',
          properties: { votes: { type: 'integer', example: 12, description: 'Số lượt JOIN' } },
        },
      },
    },
    CreateSessionBody: {
      type: 'object',
      required: ['title', 'playDate', 'startTime', 'endTime', 'location', 'minPlayers', 'maxPlayers'],
      properties: {
        title: { type: 'string', minLength: 3, maxLength: 100, example: 'Đá bóng tối thứ 5' },
        playDate: { type: 'string', format: 'date', example: '2026-11-20' },
        startTime: { type: 'string', pattern: TIME_PATTERN, example: '18:00' },
        endTime: { type: 'string', pattern: TIME_PATTERN, example: '19:30' },
        timeSlots: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: ref('TimeSlotInput'),
          description: 'Danh sách khung giờ cho thành viên bình chọn (mặc định dùng startTime/endTime)',
        },
        location: { type: 'string', example: 'Sân bóng Chảo Lửa' },
        googleMapsUrl: { type: 'string', format: 'uri', example: 'https://maps.app.goo.gl/abc', description: 'Link Google Maps (https)' },
        minPlayers: { type: 'integer', minimum: 2, maximum: 30, example: 10 },
        maxPlayers: { type: 'integer', minimum: 2, maximum: 30, example: 20 },
        voteDeadline: { type: 'string', format: 'date-time', example: '2026-11-20T08:00:00.000Z' },
      },
    },
    UpdateSessionBody: {
      type: 'object',
      description: 'Chỉ gửi các field cần cập nhật',
      properties: {
        title: { type: 'string' },
        playDate: { type: 'string', format: 'date' },
        startTime: { type: 'string', pattern: TIME_PATTERN },
        endTime: { type: 'string', pattern: TIME_PATTERN },
        location: { type: 'string' },
        googleMapsUrl: { type: 'string', format: 'uri', nullable: true },
        minPlayers: { type: 'integer' },
        maxPlayers: { type: 'integer' },
        totalCost: { type: 'number', nullable: true, example: 600000 },
        splitCount: { type: 'integer', nullable: true },
        payerId: { type: 'string', format: 'uuid', nullable: true },
        status: { type: 'string', enum: SESSION_STATUSES },
        voteDeadline: { type: 'string', format: 'date-time', nullable: true },
        cancellationNote: { type: 'string', maxLength: 500, nullable: true, description: 'Bắt buộc khi status = CANCELLED' },
        timeSlots: { type: 'array', items: ref('TimeSlotInput'), description: 'Không thể thay đổi sau khi trận đã BOOKED/COMPLETED' },
        selectedTimeSlotId: { type: 'string', format: 'uuid', description: 'Khung giờ được chốt (mặc định chọn khung có nhiều vote nhất)' },
      },
    },
    TeamPlayer: {
      type: 'object',
      properties: {
        userId: { type: 'string', format: 'uuid' },
        displayName: { type: 'string', example: 'Nguyễn Văn An' },
        avatar: { type: 'string', nullable: true },
        tier: { type: 'string', nullable: true, example: 'B' },
        tierScore: { type: 'number', example: 3 },
        isGoalkeeper: { type: 'boolean', example: false },
        votedAt: { type: 'string', format: 'date-time' },
        voteOrder: { type: 'integer', example: 1 },
      },
    },
    TeamBalanceResult: {
      type: 'object',
      properties: {
        generatedAt: { type: 'string', format: 'date-time' },
        teamCount: { type: 'integer', example: 2 },
        totalVoters: { type: 'integer', example: 12 },
        activePlayersCount: { type: 'integer', example: 10 },
        reservesCount: { type: 'integer', example: 2 },
        teams: { type: 'array', items: { type: 'object', description: 'Thông tin đội gồm danh sách cầu thủ và tổng điểm' } },
        reserves: { type: 'array', items: ref('TeamPlayer') },
        variance: { type: 'number', example: 0.25, description: 'Độ lệch điểm giữa các đội (càng nhỏ càng cân bằng)' },
      },
    },
    GuestPlayer: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        sessionId: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Anh Tuấn' },
        phone: { type: 'string', nullable: true },
        tier: { type: 'string', nullable: true, example: 'C' },
        isGoalkeeper: { type: 'boolean', example: false },
        status: { type: 'string', enum: ['RESERVE', 'PLAYING'], example: 'RESERVE' },
        isCheckedIn: { type: 'boolean', example: false },
        checkedInAt: { type: 'string', format: 'date-time', nullable: true },
        note: { type: 'string', nullable: true },
        isPaid: { type: 'boolean', example: false },
        addedAt: { type: 'string', format: 'date-time' },
      },
    },
    GuestBody: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Anh Tuấn', description: 'Bắt buộc khi thêm mới' },
        phone: { type: 'string', example: '0909123456' },
        tier: { type: 'string', example: 'C' },
        isGoalkeeper: { type: 'boolean', example: false },
        status: { type: 'string', enum: ['RESERVE', 'PLAYING'], example: 'RESERVE' },
        isCheckedIn: { type: 'boolean', example: false },
        note: { type: 'string' },
        isPaid: { type: 'boolean', description: 'Chỉ áp dụng khi cập nhật khách mời' },
      },
    },
  },
  paths: {
    '/api/sessions': {
      get: {
        tags: ['Session'],
        summary: 'Danh sách trận đấu',
        security: bearer,
        parameters: [
          { name: 'status', in: 'query', required: false, description: 'Lọc theo trạng thái', schema: { type: 'string', enum: SESSION_STATUSES } },
        ],
        responses: {
          200: jsonResponse('Danh sách trận đấu (mới nhất trước)', {
            type: 'object',
            properties: { sessions: { type: 'array', items: ref('SessionDetail') } },
          }),
          ...commonAuthErrors,
        },
      },
      post: {
        tags: ['Session'],
        summary: 'Tạo trận đấu mới (Admin)',
        security: bearer,
        requestBody: jsonBody(ref('CreateSessionBody')),
        responses: {
          201: sessionMessageResponse('Đã tạo trận đấu', 'Session created'),
          400: errorResponse('Dữ liệu không hợp lệ'),
          ...commonAdminErrors,
        },
      },
    },
    '/api/sessions/{id}': {
      get: {
        tags: ['Session'],
        summary: 'Chi tiết trận đấu',
        description: 'Trả về chi tiết trận kèm `unpaidPreviousPayment` nếu user hiện tại còn nợ tiền sân trận trước.',
        security: bearer,
        parameters: [sessionIdParam],
        responses: {
          200: jsonResponse('Chi tiết trận đấu', {
            type: 'object',
            properties: {
              session: {
                allOf: [
                  ref('SessionDetail'),
                  {
                    type: 'object',
                    properties: {
                      unpaidPreviousPayment: { type: 'object', nullable: true, description: 'Khoản tiền sân trận trước chưa thanh toán' },
                    },
                  },
                ],
              },
            },
          }),
          ...commonAuthErrors,
          404: notFound,
        },
      },
      put: {
        tags: ['Session'],
        summary: 'Cập nhật trận đấu (Admin)',
        description: 'Cập nhật thông tin, trạng thái, người ứng tiền, tổng chi phí, khung giờ... Khi chuyển sang `BOOKED` kèm `totalCost`, hệ thống chốt khung giờ và tạo các khoản thanh toán cho người tham gia.',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody(ref('UpdateSessionBody')),
        responses: {
          200: sessionMessageResponse('Đã cập nhật trận đấu', 'Session updated'),
          400: errorResponse('Dữ liệu không hợp lệ'),
          ...commonAdminErrors,
          404: notFound,
        },
      },
      delete: {
        tags: ['Session'],
        summary: 'Huỷ trận đấu (Admin)',
        description: 'Chuyển trạng thái trận sang `CANCELLED` kèm lý do huỷ (soft delete).',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['cancellationNote'],
          properties: { cancellationNote: { type: 'string', maxLength: 500, example: 'Trời mưa lớn, sân ngập' } },
        }),
        responses: {
          200: sessionMessageResponse('Đã huỷ trận đấu', 'Session cancelled'),
          400: errorResponse('Thiếu lý do huỷ hoặc lý do quá dài'),
          ...commonAdminErrors,
          404: notFound,
        },
      },
    },
    '/api/sessions/{id}/force': {
      delete: {
        tags: ['Session'],
        summary: 'Xoá vĩnh viễn trận đấu (Admin)',
        description: 'Xoá hẳn trận đấu cùng toàn bộ dữ liệu liên quan (vote, thanh toán, khách mời...). Không thể hoàn tác.',
        security: bearer,
        parameters: [sessionIdParam],
        responses: {
          200: jsonResponse('Đã xoá vĩnh viễn', messageSchema('Session permanently deleted')),
          ...commonAdminErrors,
          404: notFound,
        },
      },
    },
    '/api/sessions/{id}/time-slots': {
      post: {
        tags: ['Session'],
        summary: 'Đề xuất thêm khung giờ',
        description: 'Thành viên đề xuất thêm khung giờ khi trận còn đang mở bình chọn (VOTING/CONFIRMED, chưa khoá, chưa quá hạn). Tối đa 20 khung giờ.',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody(ref('TimeSlotInput')),
        responses: {
          201: jsonResponse('Đã thêm khung giờ', messageSchema(
            'Đã thêm khung giờ. Chọn giờ và bấm Tham gia để đăng ký.',
            { timeSlot: ref('TimeSlot') },
          )),
          400: errorResponse('Khung giờ không hợp lệ / bình chọn đã đóng / vượt quá 20 khung giờ'),
          ...commonAuthErrors,
          404: notFound,
          409: errorResponse('Khung giờ đã tồn tại hoặc danh sách vừa thay đổi'),
        },
      },
    },
    '/api/sessions/{id}/teams/suggestions': {
      get: {
        tags: ['Team'],
        summary: 'Gợi ý số đội có thể chia',
        security: bearer,
        parameters: [
          sessionIdParam,
          { name: 'useAttendedOnly', in: 'query', required: false, description: 'Chỉ tính người đã điểm danh có mặt', schema: { type: 'boolean' } },
        ],
        responses: {
          200: jsonResponse('Gợi ý số đội', {
            type: 'object',
            properties: {
              totalJoin: { type: 'integer', example: 14, description: 'Tổng người chơi (thành viên + khách)' },
              memberCount: { type: 'integer', example: 12 },
              guestCount: { type: 'integer', example: 2 },
              suggestions: {
                type: 'object',
                properties: {
                  recommended: { type: 'integer', example: 2 },
                  available: { type: 'array', items: { type: 'integer' }, example: [2, 3] },
                },
              },
            },
          }),
          ...commonAuthErrors,
        },
      },
    },
    '/api/sessions/{id}/teams/generate': {
      post: {
        tags: ['Team'],
        summary: 'Chia đội tự động cân bằng theo tier (Admin)',
        description: 'Cần ít nhất 4 người. Endpoint bị giới hạn tần suất (compute limiter).',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            teamCount: { type: 'integer', example: 2, description: 'Mặc định dùng số đội được gợi ý' },
            goalkeeperOverrides: {
              type: 'object',
              additionalProperties: { type: 'boolean' },
              example: { 'c3b5d2e1-4567-4890-abcd-123456789abc': true },
              description: 'Map userId -> có phải thủ môn hay không',
            },
            useAttendedOnly: { type: 'boolean', example: false },
          },
        }, false),
        responses: {
          200: jsonResponse('Kết quả chia đội', {
            type: 'object',
            properties: { result: ref('TeamBalanceResult') },
          }),
          400: errorResponse('Không đủ người hoặc số đội / cấu hình thủ môn không hợp lệ'),
          ...commonAdminErrors,
          404: notFound,
          429: errorResponse('Vượt quá giới hạn tần suất chia đội'),
        },
      },
    },
    '/api/sessions/{id}/teams': {
      put: {
        tags: ['Team'],
        summary: 'Lưu đội hình chính thức (Admin)',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['teams'],
          properties: { teams: { type: 'object', description: 'Đội hình (thường là `result` trả về từ endpoint generate)' } },
        }),
        responses: {
          200: sessionMessageResponse('Đã lưu đội hình', 'Lưu danh sách đội thành công'),
          ...commonAdminErrors,
          404: notFound,
        },
      },
      delete: {
        tags: ['Team'],
        summary: 'Huỷ đội hình đã chia (Admin)',
        security: bearer,
        parameters: [sessionIdParam],
        responses: {
          200: sessionMessageResponse('Đã huỷ đội hình', 'Đã hủy danh sách đội'),
          ...commonAdminErrors,
          404: notFound,
        },
      },
    },
    '/api/sessions/{id}/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'Matchday dashboard điểm danh',
        description: 'Danh sách người JOIN/MAYBE/DECLINE, khách mời, nhật ký báo vắng, cảnh báo báo vắng sát giờ / không có mặt và thống kê tổng hợp.',
        security: bearer,
        parameters: [sessionIdParam],
        responses: {
          200: jsonResponse('Dữ liệu dashboard', {
            type: 'object',
            properties: {
              session: ref('SessionDetail'),
              joined: { type: 'array', items: ref('VoteItem') },
              maybe: { type: 'array', items: ref('VoteItem') },
              declined: { type: 'array', items: ref('VoteItem') },
              guests: { type: 'array', items: ref('GuestPlayer') },
              absenceLogs: { type: 'array', items: ref('AbsenceLog') },
              warnings: {
                type: 'object',
                properties: {
                  lateCancellations: { type: 'array', items: { type: 'object' } },
                  noShows: { type: 'array', items: { type: 'object' } },
                },
              },
              summary: {
                type: 'object',
                properties: {
                  totalVoters: { type: 'integer' },
                  joinedCount: { type: 'integer' },
                  maybeCount: { type: 'integer' },
                  declinedCount: { type: 'integer' },
                  attendedMembersCount: { type: 'integer' },
                  unattendedMembersCount: { type: 'integer' },
                  attendedGuestsCount: { type: 'integer' },
                  totalGuestsCount: { type: 'integer' },
                  reserveGuestsCount: { type: 'integer' },
                  playingGuestsCount: { type: 'integer' },
                  totalAttendedOnPitch: { type: 'integer' },
                  lateCancellationsCount: { type: 'integer' },
                  noShowsCount: { type: 'integer' },
                  totalWarningsCount: { type: 'integer' },
                  isMatchStarted: { type: 'boolean' },
                  isVoteLocked: { type: 'boolean' },
                  voteLockedAt: { type: 'string', format: 'date-time', nullable: true },
                  matchStartTime: { type: 'string', format: 'date-time' },
                  minutesToMatch: { type: 'integer' },
                },
              },
            },
          }),
          ...commonAuthErrors,
          404: notFound,
        },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Điểm danh một thành viên (Admin)',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            isCheckedIn: { type: 'boolean', example: true },
            checkInNote: { type: 'string', example: 'Đến muộn 10 phút' },
          },
        }),
        responses: {
          200: jsonResponse('Đã cập nhật điểm danh', messageSchema('Đã điểm danh có mặt', { vote: ref('VoteItem') })),
          400: errorResponse('Thiếu userId'),
          ...commonAdminErrors,
        },
      },
    },
    '/api/sessions/{id}/attendance/bulk': {
      post: {
        tags: ['Attendance'],
        summary: 'Điểm danh / huỷ điểm danh toàn bộ người JOIN (Admin)',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody({
          type: 'object',
          properties: { isCheckedIn: { type: 'boolean', example: true } },
        }),
        responses: {
          200: jsonResponse('Đã cập nhật hàng loạt', messageSchema('Đã điểm danh toàn bộ (12 người)', {
            count: { type: 'integer', example: 12 },
          })),
          ...commonAdminErrors,
        },
      },
    },
    '/api/sessions/{id}/lock-vote': {
      post: {
        tags: ['Attendance'],
        summary: 'Chốt / mở lại bình chọn (Admin)',
        description: 'Nếu không truyền `isLocked`, hệ thống sẽ đảo trạng thái khoá hiện tại.',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody({
          type: 'object',
          properties: { isLocked: { type: 'boolean', example: true } },
        }, false),
        responses: {
          200: jsonResponse('Đã cập nhật trạng thái khoá', messageSchema('Đã chốt danh sách bình chọn!', {
            isVoteLocked: { type: 'boolean', example: true },
            voteLockedAt: { type: 'string', format: 'date-time', nullable: true },
            session: ref('SessionDetail'),
          })),
          ...commonAdminErrors,
          404: notFound,
        },
      },
    },
    '/api/sessions/{id}/guests': {
      post: {
        tags: ['Attendance'],
        summary: 'Thêm khách mời (Admin)',
        security: bearer,
        parameters: [sessionIdParam],
        requestBody: jsonBody({ allOf: [ref('GuestBody'), { type: 'object', required: ['name'] }] }),
        responses: {
          201: jsonResponse('Đã thêm khách mời', messageSchema('Đã thêm khách mời vào danh sách dự bị', { guest: ref('GuestPlayer') })),
          400: errorResponse('Tên khách mời không được để trống'),
          ...commonAdminErrors,
          404: notFound,
        },
      },
    },
    '/api/sessions/{id}/guests/{guestId}': {
      put: {
        tags: ['Attendance'],
        summary: 'Cập nhật khách mời (Admin)',
        description: 'Đổi trạng thái dự bị / đá chính, điểm danh, đánh dấu đã trả tiền hoặc sửa thông tin.',
        security: bearer,
        parameters: [sessionIdParam, guestIdParam],
        requestBody: jsonBody(ref('GuestBody')),
        responses: {
          200: jsonResponse('Đã cập nhật khách mời', messageSchema('Cập nhật khách mời thành công', { guest: ref('GuestPlayer') })),
          ...commonAdminErrors,
          404: errorResponse('Không tìm thấy khách mời'),
        },
      },
      delete: {
        tags: ['Attendance'],
        summary: 'Xoá khách mời (Admin)',
        security: bearer,
        parameters: [sessionIdParam, guestIdParam],
        responses: {
          200: jsonResponse('Đã xoá khách mời', messageSchema('Đã xóa khách mời khỏi trận đấu')),
          ...commonAdminErrors,
          404: errorResponse('Không tìm thấy khách mời'),
        },
      },
    },
    '/api/sessions/{id}/recalculate-payments': {
      post: {
        tags: ['Attendance'],
        summary: 'Tính lại tiền sân theo số người có mặt (Admin)',
        description: 'Chia `totalCost` cho tổng số thành viên + khách đã điểm danh, cập nhật lại các khoản thanh toán.',
        security: bearer,
        parameters: [sessionIdParam],
        responses: {
          200: jsonResponse('Đã tính lại tiền sân', messageSchema('Đã tính lại tiền sân: 50.000đ/người (12 người có mặt: 10 thành viên + 2 khách)', {
            amountPerPerson: { type: 'number', example: 50000 },
            totalAttendees: { type: 'integer', example: 12 },
            attendedMembersCount: { type: 'integer', example: 10 },
            attendedGuestsCount: { type: 'integer', example: 2 },
            payments: { type: 'array', items: ref('PaymentItem') },
          })),
          400: errorResponse('Trận chưa có tổng chi phí hoặc chưa có ai điểm danh'),
          ...commonAdminErrors,
          404: notFound,
        },
      },
    },
  },
};
