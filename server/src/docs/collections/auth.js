/**
 * Auth Collection: Đăng ký, đăng nhập, refresh token, OTP email và quên mật khẩu
 */
const {
  bearer, ref, jsonBody, jsonResponse, errorResponse, messageSchema, commonAuthErrors,
} = require('./helpers');

const validationErrorResponse = jsonResponse('Dữ liệu đầu vào không hợp lệ', {
  oneOf: [ref('ErrorResponse'), ref('ValidationErrorResponse')],
});

const retryAfterResponse = jsonResponse('Gửi OTP quá nhanh, cần đợi trước khi gửi lại', {
  type: 'object',
  properties: {
    error: { type: 'string', example: 'Vui lòng đợi 42 giây trước khi gửi lại' },
    retryAfter: { type: 'integer', example: 42 },
  },
});

module.exports = {
  tag: {
    name: 'Auth',
    description: 'Xác thực người dùng: đăng ký (qua OTP email), đăng nhập, refresh token, quên mật khẩu',
  },
  schemas: {
    ValidationErrorResponse: {
      type: 'object',
      properties: {
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'field' },
              msg: { type: 'string', example: 'Username must be 3-30 characters' },
              path: { type: 'string', example: 'username' },
              location: { type: 'string', example: 'body' },
            },
          },
        },
      },
    },
    MembershipErrorResponse: {
      type: 'object',
      properties: {
        code: { type: 'string', enum: ['MEMBERSHIP_PENDING', 'MEMBERSHIP_REJECTED'], example: 'MEMBERSHIP_PENDING' },
        error: { type: 'string', example: 'Tài khoản đang chờ admin duyệt. Bạn chỉ có thể vào CLB sau khi được chấp thuận.' },
      },
    },
    AuthUser: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        username: { type: 'string', example: 'nguyenvanan' },
        email: { type: 'string', format: 'email', nullable: true, example: 'an.nguyen@example.com' },
        displayName: { type: 'string', example: 'Nguyễn Văn An' },
        phone: { type: 'string', nullable: true, example: '0901234567' },
        bankInfo: { type: 'string', nullable: true, example: 'MBBank - 0987654321 - NGUYEN VAN AN' },
        role: { type: 'string', enum: ['ADMIN', 'MEMBER'], example: 'MEMBER' },
        membershipStatus: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'], example: 'APPROVED' },
        tier: { type: 'string', nullable: true, example: 'B' },
        isGoalkeeper: { type: 'boolean', example: false },
        avatar: { type: 'string', nullable: true },
      },
    },
    AuthTokens: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      },
    },
    RegisterBody: {
      type: 'object',
      required: ['username', 'password', 'displayName', 'email', 'verificationToken'],
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 30, example: 'nguyenvanan', description: 'Chỉ gồm chữ và số (3-30 ký tự)' },
        password: { type: 'string', format: 'password', minLength: 6, example: 'Secret@123' },
        displayName: { type: 'string', minLength: 2, maxLength: 50, example: 'Nguyễn Văn An' },
        email: { type: 'string', format: 'email', example: 'an.nguyen@example.com' },
        phone: { type: 'string', example: '0901234567', description: 'Tuỳ chọn - số điện thoại Việt Nam' },
        verificationToken: { type: 'string', example: 'a3f1...e9', description: 'Token nhận được từ `POST /api/auth/verify-otp`' },
      },
    },
    LoginBody: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', example: 'nguyenvanan', description: 'Tên đăng nhập hoặc email' },
        password: { type: 'string', format: 'password', example: 'Secret@123' },
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng ký tài khoản mới',
        description: 'Yêu cầu `verificationToken` hợp lệ có được sau bước xác thực OTP email. Tài khoản tạo ra ở trạng thái `PENDING` và cần ADMIN duyệt trước khi đăng nhập.',
        requestBody: jsonBody(ref('RegisterBody')),
        responses: {
          201: jsonResponse('Đăng ký thành công, chờ admin duyệt', messageSchema(
            'Đăng ký thành công. Yêu cầu tham gia CLB đã được gửi đến admin và đang chờ duyệt.',
            { user: ref('AuthUser') },
          )),
          400: validationErrorResponse,
          409: errorResponse('Username / email đã tồn tại'),
          429: errorResponse('Vượt quá giới hạn request xác thực'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập',
        description: 'Đăng nhập bằng username hoặc email. Trả về thông tin user kèm cặp access/refresh token.',
        requestBody: jsonBody(ref('LoginBody')),
        responses: {
          200: jsonResponse('Đăng nhập thành công', {
            allOf: [
              messageSchema('Login successful', { user: ref('AuthUser') }),
              ref('AuthTokens'),
            ],
          }),
          400: validationErrorResponse,
          401: errorResponse('Sai tên đăng nhập / email hoặc mật khẩu'),
          403: jsonResponse('Tài khoản đang chờ duyệt hoặc đã bị từ chối', ref('MembershipErrorResponse')),
          429: errorResponse('Vượt quá giới hạn request xác thực'),
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Làm mới access token',
        requestBody: jsonBody({
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } },
        }),
        responses: {
          200: jsonResponse('Cặp token mới', ref('AuthTokens')),
          400: errorResponse('Thiếu refresh token'),
          401: errorResponse('Refresh token không hợp lệ hoặc phiên đăng nhập đã bị thu hồi'),
          403: jsonResponse('Tài khoản đang chờ duyệt hoặc đã bị từ chối', ref('MembershipErrorResponse')),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Lấy thông tin người dùng hiện tại',
        security: bearer,
        responses: {
          200: jsonResponse('Thông tin user đang đăng nhập', {
            type: 'object',
            properties: { user: ref('AuthUser') },
          }),
          ...commonAuthErrors,
        },
      },
    },
    '/api/auth/send-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Gửi mã OTP xác thực email đăng ký',
        description: 'Kiểm tra trùng username/email/số điện thoại rồi gửi mã OTP 6 số (hiệu lực 5 phút) đến email. Mỗi email chỉ được gửi lại sau 60 giây.',
        requestBody: jsonBody({
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', example: 'an.nguyen@example.com' },
            phone: { type: 'string', example: '0901234567' },
            username: { type: 'string', example: 'nguyenvanan' },
          },
        }),
        responses: {
          200: jsonResponse('Đã gửi OTP', messageSchema('Mã OTP đã được gửi đến email của bạn', {
            email: { type: 'string', format: 'email' },
          })),
          400: errorResponse('Email / số điện thoại không hợp lệ'),
          409: errorResponse('Username hoặc email đã được sử dụng'),
          429: retryAfterResponse,
          500: errorResponse('Lỗi gửi email OTP'),
        },
      },
    },
    '/api/auth/verify-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Xác thực mã OTP đăng ký',
        description: 'Đổi mã OTP lấy `verificationToken` dùng cho `POST /api/auth/register`.',
        requestBody: jsonBody({
          type: 'object',
          required: ['email', 'otp'],
          properties: {
            email: { type: 'string', format: 'email', example: 'an.nguyen@example.com' },
            otp: { type: 'string', example: '123456' },
          },
        }),
        responses: {
          200: jsonResponse('Xác thực thành công', messageSchema('Xác thực OTP thành công', {
            verificationToken: { type: 'string' },
            email: { type: 'string', format: 'email' },
          })),
          400: errorResponse('Mã OTP không hợp lệ hoặc đã hết hạn'),
        },
      },
    },
    '/api/auth/forgot-password/send-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Gửi OTP khôi phục mật khẩu',
        requestBody: jsonBody({
          type: 'object',
          required: ['emailOrUsername'],
          properties: { emailOrUsername: { type: 'string', example: 'nguyenvanan' } },
        }),
        responses: {
          200: jsonResponse('Đã gửi OTP khôi phục', messageSchema('Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn', {
            email: { type: 'string', format: 'email' },
            maskedEmail: { type: 'string', example: 'a***n@example.com' },
          })),
          400: errorResponse('Thiếu email hoặc tên đăng nhập'),
          404: errorResponse('Không tìm thấy tài khoản'),
          429: retryAfterResponse,
          500: errorResponse('Lỗi gửi email OTP'),
        },
      },
    },
    '/api/auth/forgot-password/verify-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Xác thực OTP khôi phục mật khẩu',
        description: 'Đổi mã OTP lấy `resetToken` dùng cho bước đặt mật khẩu mới.',
        requestBody: jsonBody({
          type: 'object',
          required: ['email', 'otp'],
          properties: {
            email: { type: 'string', format: 'email', example: 'an.nguyen@example.com' },
            otp: { type: 'string', example: '123456' },
          },
        }),
        responses: {
          200: jsonResponse('Xác thực thành công', messageSchema('Xác thực OTP thành công', {
            resetToken: { type: 'string', description: 'Chuỗi hex 64 ký tự' },
            email: { type: 'string', format: 'email' },
          })),
          400: errorResponse('Mã OTP không hợp lệ hoặc đã hết hạn'),
        },
      },
    },
    '/api/auth/forgot-password/reset': {
      post: {
        tags: ['Auth'],
        summary: 'Đặt lại mật khẩu mới',
        description: 'Đặt mật khẩu mới bằng `resetToken`. Toàn bộ phiên đăng nhập cũ sẽ bị thu hồi.',
        requestBody: jsonBody({
          type: 'object',
          required: ['email', 'resetToken', 'newPassword'],
          properties: {
            email: { type: 'string', format: 'email', example: 'an.nguyen@example.com' },
            resetToken: { type: 'string', pattern: '^[a-f0-9]{64}$' },
            newPassword: { type: 'string', format: 'password', minLength: 6, example: 'NewSecret@456' },
          },
        }),
        responses: {
          200: jsonResponse('Đặt lại mật khẩu thành công', messageSchema('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ.')),
          400: errorResponse('Thiếu thông tin / token hết hạn / mật khẩu quá ngắn'),
          404: errorResponse('Không tìm thấy người dùng'),
        },
      },
    },
  },
};
