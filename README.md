![HitDad project banner](assets/hitdad-banner-16x9.png)

# CSE HitDad · Sports Club Management Platform

![Version](https://img.shields.io/badge/version-v1.2.4-blue.svg?style=flat-square)

**Phiên bản hiện tại: `v1.2.4` — 17/10/2026.** Ứng dụng quản lý câu lạc bộ thể thao: lên lịch, bình chọn khung giờ, điểm danh, chia đội, chia tiền sân và quản lý thành viên.

Bản 1.2.4 tích hợp giao diện gluestack UI mới, luồng admin duyệt thành viên, cải tiến chia đội và bản vá JWT/OTP của **CSE HitDad**. Khi nâng cấp, các phiên đăng nhập cũ và các bước xác thực OTP đang dở sẽ hết hiệu lực. Xem [hướng dẫn phát hành và nâng cấp 1.2.4](docs/releases/v1.2.4.md).

## Tính năng hiện tại

| Nhóm | Chức năng |
| --- | --- |
| Trận đấu | Admin tạo/sửa trận, địa điểm, link Google Maps, giới hạn người chơi và hạn bình chọn; hủy trận kèm lý do tối đa 500 ký tự. |
| Khung giờ | Một trận có tối đa 20 lựa chọn. Thành viên chọn nhiều giờ phù hợp và có thể đề xuất thêm giờ khi bình chọn còn mở. Thêm giờ không tự tạo lượt tham gia. |
| Bình chọn | Thành viên chọn `JOIN` hoặc `DECLINE`; admin có thể điều chỉnh/xóa vote. `JOIN` bị chặn khi còn khoản tiền sân chưa được xác nhận ở trận trước; vẫn cho phép báo vắng. |
| Thành viên | Tài khoản mới chờ admin duyệt trước khi truy cập CLB. Admin xem email và xử lý yêu cầu; thành viên thường không thấy email đăng ký của người khác. Hồ sơ hỗ trợ avatar, điện thoại, ngân hàng và QR. Số trận chỉ tính lượt đã điểm danh trong trận hoàn tất. |
| Điểm danh | Khóa bình chọn, điểm danh riêng lẻ/hàng loạt, quản lý khách mời, trạng thái thi đấu và thanh toán của khách. |
| Đội hình | Chia đội theo tier, ưu tiên lượt vote sớm, thủ môn và dự bị; xáo trộn và chỉnh phương án trước khi lưu. |
| Thanh toán | Chia chi phí, đánh dấu đã chuyển tiền, người trả sân/admin xác nhận; tạo link VietQR PayOS và nhận webhook có kiểm tra chữ ký. |
| Phản hồi | Thành viên gửi lỗi/đề xuất/đánh giá; admin lọc phản hồi, cập nhật trạng thái và ghi chú xử lý. |

Trạng thái trận: `VOTING` → `CONFIRMED` → `BOOKED` → `COMPLETED`, hoặc `CANCELLED`. Khi đặt sân, admin chốt một khung giờ; danh sách khung giờ không được thay đổi sau khi trận đã `BOOKED` hoặc `COMPLETED`.

Trạng thái khoản thanh toán: `PENDING` → `PAID` → `CONFIRMED`. Thành viên tự đánh dấu đã chuyển tiền tạo trạng thái `PAID`; payer/admin xác nhận hoặc PayOS báo thanh toán thành công sẽ chuyển sang `CONFIRMED`.

## Xác thực và bảo mật trong 1.2.4

- Access token mặc định **15 phút**, refresh token mặc định **30 ngày**; chỉ chấp nhận chữ ký HS256 và đúng loại token.
- `JWT_SECRET` và `JWT_REFRESH_SECRET` phải là hai khóa ngẫu nhiên độc lập, mỗi khóa ít nhất 32 ký tự. Server từ chối khởi động nếu thiếu khóa, dùng khóa mẫu, khóa quá ngắn hoặc hai khóa trùng nhau.
- Token có `userId`, `authVersion` và `tokenType`. Backend đối chiếu phiên bản xác thực với DB cho mỗi lần xác thực/refresh; token cũ không có claim mới bị từ chối.
- Đổi hoặc reset mật khẩu tăng `User.authVersion`, vô hiệu hóa mọi access/refresh token trước đó. Đổi mật khẩu trong trang hồ sơ cũng đăng xuất phiên hiện tại.
- Đăng ký và khôi phục mật khẩu dùng OTP dạng **chuỗi sáu chữ số**, hiệu lực **5 phút**. Mỗi mã được thử tối đa **5 lần**, tính trong DB; mã mới nhất được dùng cho đúng mục đích và đúng email.
- OTP hợp lệ cấp `verificationToken` để đăng ký hoặc `resetToken` để khôi phục; proof có hiệu lực **10 phút**, dùng một lần. Transaction và cập nhật có điều kiện ngăn hai request dùng đồng thời cùng một mã/proof.
- Tài khoản mới có trạng thái `PENDING`, không được cấp token khi đăng ký. Chỉ tài khoản `APPROVED` được đăng nhập, refresh và truy cập API; admin xử lý yêu cầu thành `APPROVED` hoặc `REJECTED`.
- API cập nhật hồ sơ dùng danh tính từ JWT đã xác thực; route quản trị kiểm tra vai trò trong DB.
- Script tạo tài khoản demo bị chặn khi `NODE_ENV=production`. Tài khoản demo đã tồn tại không tự được đổi mật khẩu.

Client hiện lưu token trong `localStorage`; thao tác đăng xuất xóa token trên trình duyệt. Cơ chế thu hồi mọi phiên phía server được thực hiện khi đổi/reset mật khẩu hoặc khi thay khóa ký, không phải một endpoint đăng xuất riêng.

Các giới hạn hiện có:

| Phạm vi | Giới hạn |
| --- | --- |
| API chung | 200 request / 15 phút / IP, ngoại trừ health check |
| Gửi OTP | 5 request / 15 phút / IP; thêm thời gian chờ gửi lại 60 giây theo email |
| Đăng nhập, đăng ký, xác thực OTP, reset, refresh | Dùng chung `authLimiter`: 15 request / 15 phút / IP |
| Chia đội | 20 request / phút / IP |
| Thử một mã OTP | Tối đa 5 lần cho mã đó, lưu trong DB |

Backend còn dùng Helmet, HPP, làm chậm request sau 80 lượt/15 phút, giới hạn JSON 3 MB và các timeout HTTP. `trust proxy` hiện đặt bằng `1`; khi thay hạ tầng proxy cần kiểm tra cách xác định IP thực. Những cơ chế ở tầng ứng dụng không thay thế việc bảo vệ lưu lượng tại hạ tầng.

## Công nghệ và cấu trúc

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, gluestack UI Core v3, React Aria, React Native Web và CSS |
| Backend | Node.js, Express 4, Prisma 6 |
| Dữ liệu | PostgreSQL; cấu hình triển khai có thể dùng Neon |
| Xác thực | JWT, bcryptjs, OTP email |
| Email | Brevo HTTP API; Nodemailer/SMTP khi không cấu hình Brevo |
| Thanh toán | PayOS SDK, VietQR, webhook |
| Kiểm thử bảo mật | Node.js test runner, Prisma và PostgreSQL riêng cho integration test |

```text
CSE_PunchDad/
├── client/
│   ├── src/components/       # Layout, Modal, Vote, Attendance, Payment, Feedback...
│   ├── src/pages/            # Đăng nhập, trận đấu, thành viên, hồ sơ, quản trị phản hồi
│   ├── src/context/          # AuthContext
│   ├── src/services/api.js   # Fetch API, access token và refresh
│   └── vercel.json           # Rewrite cho SPA
├── server/
│   ├── prisma/               # Schema, migrations, seed demo
│   ├── src/controllers/
│   ├── src/middleware/       # Xác thực, phân quyền, validation và rate limit
│   ├── src/routes/
│   ├── src/services/         # Token, email, PayOS, chia đội
│   ├── src/app.js
│   └── tests/auth-security.test.js
├── docs/releases/v1.2.4.md   # Thay đổi, migration và triển khai bản 1.2.4
├── docs/security-audit-2026-10-17.md
├── render.yaml              # Backend Render
└── package.json             # Script chạy toàn bộ dự án
```

Giao diện dùng theme navy/vàng, điều hướng dưới màn hình mobile, modal hỗ trợ bàn phím và tải trang theo nhu cầu. Xem [tài liệu tích hợp UI](client/UI.md); `client/.npmrc` giữ cấu hình cài dependency cho các adapter web.

## Chạy trên máy

### 1. Chuẩn bị

Dùng **Node.js 22.12 trở lên**, npm và PostgreSQL. Đây là yêu cầu phù hợp với Vite 8/plugin React đang cài; hướng dẫn Node 18 của bản cũ không còn phù hợp. Môi trường kiểm thử bản vá dùng Node 24 và PostgreSQL 18.3.

Từ thư mục gốc:

```bash
npm run install:all
cp server/.env.example server/.env
```

### 2. Cấu hình backend

Chỉnh `server/.env`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/cse_punchdad?schema=public"
JWT_SECRET=""
JWT_REFRESH_SECRET=""
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"
PORT=5001
NODE_ENV=development
CLIENT_URL="http://localhost:5173"

BREVO_API_KEY=""
SMTP_EMAIL=""
SMTP_PASSWORD=""

PAYOS_CLIENT_ID=""
PAYOS_API_KEY=""
PAYOS_CHECKSUM_KEY=""
```

Sinh hai khóa JWT bằng cách chạy lệnh sau **hai lần**, rồi điền mỗi kết quả vào một biến khác nhau:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Để gửi OTP, cấu hình Brevo cùng email người gửi; nếu không dùng Brevo thì cấu hình SMTP email/app password. Để tạo link hoặc xác minh webhook PayOS, điền đủ ba biến PayOS. Không đưa file `.env`, khóa ký, mật khẩu hoặc token thật lên Git hay nhóm chat.

`CLIENT_URL` có thể chứa nhiều origin, phân cách bằng dấu phẩy. Cấu hình local của Vite proxy `/api` tới `http://localhost:5001`, nên không cần URL API riêng cho cách chạy mặc định.

### 3. Generate Prisma Client và chạy migration

```bash
cd server
npx prisma generate
npx prisma migrate deploy
cd ..
```

Nếu cần dữ liệu demo, chỉ chạy trên DB local/thử nghiệm:

```bash
npm run db:seed
```

Seed tạo tài khoản `admin` và `member1`–`member3` với mật khẩu demo trong `server/prisma/seed.js`. Không dùng các tài khoản này làm tài khoản production. Cả seed chính và script tạo 24 cầu thủ đều từ chối chạy khi `NODE_ENV=production`.

### 4. Chạy ứng dụng

```bash
npm run dev
```

- Frontend: `http://localhost:5173`.
- Backend: `http://localhost:5001`.
- Health check: `GET http://localhost:5001/api/health`.

Địa điểm sân hỗ trợ link Google Maps HTTPS, gồm link rút gọn. Nếu không có link, giao diện tìm bản đồ theo tên địa điểm.

## Nâng cấp và triển khai 1.2.4

**Cần triển khai cùng mã nguồn, migration và cấu hình JWT mới.** Việc sửa file tại local chưa cập nhật web đang chạy. Xem [quy trình đầy đủ](docs/releases/v1.2.4.md#quy-trình-nâng-cấp-production).

Migration mới `20261017090000_harden_auth_sessions`:

| Thay đổi | Ảnh hưởng |
| --- | --- |
| Thêm `users.auth_version`, số nguyên, mặc định `0` | Dùng để thu hồi phiên đăng nhập khi mật khẩu thay đổi |
| Thêm `otp_verifications.attempts`, số nguyên, mặc định `0` | Đếm số lần thử cho từng OTP |
| Đặt `used = true` cho mọi OTP/proof còn chưa dùng | Người đang đăng ký/reset phải yêu cầu mã mới |
| Yêu cầu claim JWT mới trong mã ứng dụng | Mọi phiên cấp trước bản vá phải đăng nhập lại |

Migration `20261013090000_add_membership_approval` thêm trạng thái duyệt: user đã tồn tại được giữ `APPROVED`, còn tài khoản tạo mới mặc định `PENDING`.

Prisma sẽ áp dụng tất cả migration chưa chạy; nếu DB chưa có bảng phản hồi, migration `20261001160000_add_feedback` cũng được áp dụng. Migration bảo mật không xóa user, trận đấu, vote hay payment và không tự đổi mật khẩu người dùng.

Backend Render được cấu hình trong `render.yaml`:

```text
Root directory: server
Build command: npm install && npx prisma generate
Start command: npx prisma migrate deploy && node src/app.js
```

Với service đã tồn tại, phải kiểm tra/thay trực tiếp `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN=15m` và `NODE_ENV=production` trên Render. `generateValue: true` trong Blueprint không có nghĩa là khóa đang dùng sẽ được tự thay mới.

Frontend Vercel dùng thư mục `client`, build `npm run build`, output `dist`. Đặt `VITE_API_URL=https://<ten-api>.onrender.com/api`, rồi build/deploy lại; biến Vite được đọc lúc build. `CLIENT_URL` trên backend phải chứa origin frontend tương ứng. Rewrite SPA có sẵn trong `client/vercel.json`.

Sau triển khai, kiểm tra `/api/health`, đăng nhập mới, yêu cầu OTP, đổi/reset mật khẩu và việc phiên cũ nhận `401`. Nếu đang xử lý sự cố chiếm tài khoản, giữ API tạm ngưng trong lúc chuẩn bị, đối chiếu log và rà soát dữ liệu bị sửa trước khi mở lại.

## Kiểm thử

Từ thư mục gốc:

```bash
npm --prefix server test
npm --prefix client run build
```

`npm test` của backend chạy kiểm tra JWT, chia đội, email/số trận thành viên và duyệt thành viên; nhóm cần PostgreSQL sẽ **skip** nếu không có `AUTH_SECURITY_TEST_DATABASE_URL`. Muốn chạy đủ nhóm integration, chuẩn bị DB riêng tên `cse_punchdad_auth_security` trên localhost, áp dụng migration vào DB đó và chạy theo [hướng dẫn kiểm thử](docs/releases/v1.2.4.md#kiểm-thử-bản-phát-hành). Không dùng DB production cho bộ kiểm thử này.

Kết quả kiểm chứng bản vá ngày 17/10/2026: **54 test backend đạt** khi chạy với PostgreSQL tạm; **8 test frontend đạt**, migration áp dụng thành công và frontend build thành công. Đây là bằng chứng local, không xác nhận bản vá đã được deploy hay nguyên nhân chính xác của sự cố trên production.

## API hiện tại

Base path: `/api`. Route cần đăng nhập nhận `Authorization: Bearer <accessToken>`. Trong bảng dưới, **Admin** bao gồm xác thực JWT và kiểm tra quyền `ADMIN`. Mọi route `/api` chịu giới hạn chung, ngoại trừ health check; các route auth còn áp dụng limiter riêng.

### Xác thực

| Phương thức | Endpoint | Quyền / giới hạn | Chức năng |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Kiểm tra tiến trình API |
| POST | `/api/auth/send-otp` | Public, OTP limiter | Gửi OTP đăng ký |
| POST | `/api/auth/verify-otp` | Public, auth limiter | Nhận `verificationToken` sau khi xác minh OTP |
| POST | `/api/auth/register` | Public, auth limiter, validation | Tạo yêu cầu `PENDING` từ proof đăng ký; không cấp JWT |
| POST | `/api/auth/login` | Public, auth limiter, validation | Đăng nhập bằng username hoặc email và mật khẩu |
| POST | `/api/auth/refresh` | Refresh token, auth limiter | Cấp cặp token mới nếu user/phiên còn hợp lệ |
| POST | `/api/auth/forgot-password/send-otp` | Public, OTP limiter | Tìm tài khoản và gửi OTP khôi phục |
| POST | `/api/auth/forgot-password/verify-otp` | Public, auth limiter | Nhận `resetToken` sau khi xác minh OTP |
| POST | `/api/auth/forgot-password/reset` | Public, auth limiter | Đặt mật khẩu mới bằng email và reset proof |
| GET | `/api/auth/me` | Đăng nhập | Danh tính từ token đã xác thực |

Payload xác minh OTP dùng chuỗi, ví dụ `{ "email": "member@example.com", "otp": "123456" }`. Reset dùng `{ "email": "member@example.com", "resetToken": "<proof>", "newPassword": "<mat-khau-moi>" }`. Không gửi `authVersion` từ client để tự cấp quyền; backend lấy giá trị từ DB.

### Trận đấu, đội hình và điểm danh

| Phương thức | Endpoint | Quyền | Chức năng |
| --- | --- | --- | --- |
| GET | `/api/sessions` | Đăng nhập | Danh sách trận, lọc theo `status` |
| GET | `/api/sessions/:id` | Đăng nhập | Chi tiết trận, vote, khung giờ, nợ tiền sân |
| POST | `/api/sessions` | Admin | Tạo trận |
| POST | `/api/sessions/:id/time-slots` | Đăng nhập | Thêm giờ khi bình chọn còn mở |
| PUT | `/api/sessions/:id` | Admin | Sửa trận, chốt giờ, ghi chú hủy |
| DELETE | `/api/sessions/:id` | Admin | Hủy mềm; body có `cancellationNote` |
| DELETE | `/api/sessions/:id/force` | Admin | Xóa vĩnh viễn trận và dữ liệu liên quan |
| GET | `/api/sessions/:id/teams/suggestions` | Đăng nhập | Gợi ý số đội |
| POST | `/api/sessions/:id/teams/generate` | Admin, compute limiter | Cân bằng/xáo trộn đội |
| PUT / DELETE | `/api/sessions/:id/teams` | Admin | Lưu/xóa đội hình |
| GET | `/api/sessions/:id/attendance` | Đăng nhập | Xem bảng điểm danh |
| POST | `/api/sessions/:id/lock-vote` | Admin | Bật/tắt khóa bình chọn |
| POST | `/api/sessions/:id/attendance` | Admin | Điểm danh một người |
| POST | `/api/sessions/:id/attendance/bulk` | Admin | Điểm danh hàng loạt |
| POST | `/api/sessions/:id/guests` | Admin | Thêm khách mời |
| PUT / DELETE | `/api/sessions/:id/guests/:guestId` | Admin | Sửa/xóa khách mời |
| POST | `/api/sessions/:id/recalculate-payments` | Admin | Tính lại khoản tiền sân |

### Bình chọn

| Phương thức | Endpoint | Quyền | Chức năng |
| --- | --- | --- | --- |
| POST | `/api/votes` | Đăng nhập | Vote `JOIN`/`DECLINE`; tham gia nhận thêm `timeSlotIds` |
| PUT | `/api/votes/:id` | Chủ vote | Cập nhật trạng thái và giờ đã chọn |
| GET | `/api/votes/session/:sessionId` | Đăng nhập | Danh sách vote của trận |
| POST | `/api/votes/admin/adjust` | Admin | Điều chỉnh hoặc xóa vote |

Ví dụ tham gia: `{ "sessionId": "<id>", "status": "JOIN", "timeSlotIds": ["<slot-id>"] }`. Backend kiểm tra slot thuộc đúng trận và các khoản nợ trước đó.

### Thanh toán

| Phương thức | Endpoint | Quyền | Chức năng |
| --- | --- | --- | --- |
| GET | `/api/payments/session/:sessionId` | Đăng nhập | Khoản phải nộp và tổng hợp của trận |
| PUT | `/api/payments/:id/mark-paid` | Chủ khoản thanh toán | Đánh dấu đã chuyển tiền (`PAID`) |
| PUT | `/api/payments/:id/confirm` | Payer hoặc Admin | Xác nhận đã nhận tiền (`CONFIRMED`) |
| POST | `/api/payments/:id/payos-link` | Chủ khoản thanh toán hoặc Admin | Tạo/lấy link VietQR PayOS |
| GET | `/api/payments/:id/payos-status` | Đăng nhập | Kiểm tra trạng thái PayOS |
| POST | `/api/payments/payos-webhook` | Chữ ký PayOS | Nhận webhook, xác nhận thanh toán thành công |

### Hồ sơ và phản hồi

| Phương thức | Endpoint | Quyền | Chức năng |
| --- | --- | --- | --- |
| GET | `/api/users/members` | Đăng nhập | Thành viên đã duyệt; chỉ admin nhận thêm email |
| GET | `/api/users/membership-requests` | Admin | Danh sách yêu cầu chờ duyệt |
| GET | `/api/users/membership-requests/count` | Admin | Số yêu cầu chờ duyệt |
| PUT | `/api/users/membership-requests/:userId` | Admin | Duyệt/từ chối với `decision=APPROVED/REJECTED` |
| PUT | `/api/users/profile` | Đăng nhập, chính mình | Tên hiển thị, điện thoại, ngân hàng, vị trí thủ môn |
| PUT | `/api/users/change-password` | Đăng nhập, mật khẩu hiện tại | Đổi mật khẩu và thu hồi mọi phiên cũ |
| PUT / DELETE | `/api/users/avatar` | Đăng nhập, chính mình | Tải/xóa ảnh đại diện |
| PUT / DELETE | `/api/users/qr-code` | Đăng nhập, chính mình | Tải/xóa ảnh QR |
| GET | `/api/users/:id/qr-code` | Đăng nhập | Xem QR của thành viên |
| PUT | `/api/users/:userId/tier` | Admin | Cập nhật tier |
| PUT | `/api/users/:userId/goalkeeper` | Admin | Cập nhật vị trí thủ môn |
| DELETE | `/api/users/:userId` | Admin | Xóa thành viên theo các ràng buộc nghiệp vụ |
| POST | `/api/feedback` | Đăng nhập | Gửi phản hồi |
| GET | `/api/feedback` | Admin | Danh sách và thống kê phản hồi |
| PUT | `/api/feedback/:id` | Admin | Cập nhật trạng thái/ghi chú phản hồi |

Ảnh avatar/QR nhận data URL PNG, JPEG hoặc WebP, tối đa 2 MB dữ liệu ảnh. Phản hồi nhận `category` là `BUG`, `FEATURE`, `UX`, `OTHER`; `message` dài 10–2.000 ký tự; `rating` tùy chọn từ 1–5. Trạng thái xử lý là `NEW`, `REVIEWING`, `RESOLVED`.

## Dữ liệu cần biết

| Model / trường | Vai trò |
| --- | --- |
| `User.membershipStatus` | `PENDING`, `APPROVED`, `REJECTED`; chỉ trạng thái đã duyệt có quyền truy cập CLB |
| `User.membershipReviewedAt` / `membershipReviewedBy` | Thời điểm và ID admin xử lý yêu cầu |
| `User.authVersion` | Phiên bản xác thực; không trả ra trong hồ sơ công khai |
| `OtpVerification.attempts` | Số lần thử của challenge; mặc định `0` |
| `OtpVerification.otp` | Mã/proof được phân loại nội bộ theo mục đích, không phải dữ liệu công khai |
| `Session.googleMapsUrl` | Link Google Maps HTTPS tùy chọn |
| `Session.cancellationNote` | Lý do hủy, tối đa 500 ký tự |
| `Session.selectedTimeSlotId` | Khung giờ được chốt |
| `SessionTimeSlot` | Khung giờ; duy nhất theo session và cặp giờ bắt đầu/kết thúc |
| `TimeSlotVote` | Lựa chọn giờ của vote; duy nhất theo vote và slot |
| `Feedback` | Phản hồi của user, loại, đánh giá, trạng thái và ghi chú quản trị |

Enum `MAYBE` vẫn tồn tại để tương thích dữ liệu cũ; giao diện thành viên dùng `JOIN`/`DECLINE`. Xóa hoặc đổi vote sang báo vắng sẽ xóa lựa chọn giờ tương ứng. Dữ liệu trận cũ được migration khung giờ tạo lựa chọn mặc định từ giờ bắt đầu/kết thúc đã có.

## Lịch sử phiên bản

### `v1.2.4` — 17/10/2026 (phiên bản hiện tại)

- Siết cấu hình và xác thực JWT; phân biệt access/refresh, mặc định access token 15 phút.
- Thêm `authVersion`, kiểm tra user/phiên khi refresh; thu hồi mọi phiên sau đổi/reset mật khẩu.
- Sửa OTP nhận sai kiểu; giới hạn năm lần thử theo challenge; ngăn dùng lại mã/proof qua request đồng thời.
- Thêm migration bảo mật, vô hiệu hóa OTP/proof trước bản vá và yêu cầu đăng nhập lại.
- Chặn seed demo trên production; bổ sung bộ kiểm thử bảo mật với PostgreSQL riêng.
- Tích hợp nhánh `optimizeSplitTeamAlgorithm`: gluestack UI, React Aria, giao diện responsive, duyệt thành viên và cải tiến thuật toán chia đội.
- Admin xem email; số trận thành viên dựa vào điểm danh ở trận hoàn tất; giữ đúng vòng đời trận khi xác nhận thanh toán.
- Cập nhật logo, favicon, banner và tên hiển thị CSE HitDad; footer hiển thị `v1.2.4`.
- Viết lại hướng dẫn cấu hình/nâng cấp, đồng bộ API với route thật, bổ sung tài liệu phản hồi và triển khai.
- Đồng bộ version tại root, client, server và các lockfile. Chi tiết: [release notes 1.2.4](docs/releases/v1.2.4.md).

### `v1.2.3`
- **Bình chọn Nhiều Khung giờ**:
  - Admin tạo, chỉnh sửa tối đa 20 phương án thời gian cho một trận đấu.
  - Thành viên chọn một hoặc nhiều khung giờ có thể tham gia; giao diện thống kê và đánh dấu phương án phổ biến nhất.
  - Admin chốt khung giờ khi đặt sân; backend tự chọn phương án nhiều vote nhất nếu không chỉ định.
  - Bổ sung hai model `SessionTimeSlot`, `TimeSlotVote` cùng migration chuyển đổi an toàn dữ liệu trận cũ.
- **Admin Điều chỉnh Bình chọn**:
  - Bổ sung modal tìm thành viên, xem trạng thái hiện tại và chuyển sang Tham gia, Báo vắng hoặc xóa lượt vote.
  - Đồng bộ quân số, lịch sử báo vắng và trạng thái đủ người sau mỗi thao tác.
- **Ghi chú Hủy Trận đấu**:
  - Yêu cầu Admin nhập lý do khi hủy trận và lưu ghi chú vào cơ sở dữ liệu.
  - Hiển thị lý do hủy trên danh sách trận đấu và trang chi tiết cho tất cả thành viên.
  - Cho phép Admin cập nhật ghi chú sau khi hủy và tự động xóa ghi chú khi khôi phục trạng thái trận.
- **Phát hành & Tương thích**:
  - Đồng bộ version `1.2.3` tại root, frontend, backend, lockfile, Footer và tài liệu.
  - Các cột mới đều nullable hoặc có bước backfill; Render tự generate Prisma Client và chạy migration khi deploy.

### `v1.2.2`
- **Tích hợp Google Maps cho Địa điểm Sân**:
  - Thêm trường `googleMapsUrl` tùy chọn khi tạo và chỉnh sửa trận đấu.
  - Nhúng bản đồ trực tiếp trên trang chi tiết trận đấu và bổ sung nút mở vị trí trong Google Maps.
  - Hỗ trợ link chia sẻ ngắn, link chứa tọa độ và cơ chế dự phòng tìm kiếm bằng tên địa điểm.
  - Thêm migration `google_maps_url` cho bảng `sessions` mà không ảnh hưởng dữ liệu trận đấu hiện có.
- **Khôi phục Mật khẩu Bảo mật qua OTP Email (Forgot Password Flow)**:
  - Cho phép người dùng tìm lại tài khoản qua Email hoặc Tên đăng nhập (Username).
  - Gửi mã OTP xác thực 6 chữ số (thời hạn 5 phút) qua Brevo API / Gmail fallback với template HTML phong cách câu lạc bộ chuyên nghiệp.
  - Tự động che mờ địa chỉ email hiển thị (vd: `ng***@gmail.com`) nhằm bảo vệ quyền riêng tư người dùng.
  - Cấp token đặt lại mật khẩu một lần (`resetToken`, hiệu lực 10 phút), kiểm tra độ dài và tính khớp của mật khẩu mới.
  - Xây dựng giao diện `ForgotPassword.jsx` với tiến trình 3 bước trực quan, tích hợp bộ đếm ngược 60 giây và chống spam.
- **Admin Quản lý & Chỉ định Vai trò Thủ môn (Goalkeeper Management)**:
  - Admin có toàn quyền gán hoặc hủy vai trò Thủ môn (`isGoalkeeper`) của bất kỳ thành viên nào trực tiếp trên trang Thành viên (`/members`) và modal Điểm danh trận đấu (`AttendanceDashboardModal`).
  - Hiển thị huy hiệu nhận diện `🧤 Thủ môn` nổi bật trên thẻ thành viên.
  - Bổ sung bộ lọc thành viên theo vai trò (*Tất cả*, *Thủ môn*, *Cầu thủ*) cùng thống kê trực quan số lượng thủ môn hiện có của CLB.
- **Quy trình Bình chọn Tinh gọn & Chặn Vote Khi Chưa Thanh Toán**:
  - Loại bỏ trạng thái lấp lửng `MAYBE` khỏi luồng và giao diện bình chọn thông thường; giữ enum tương thích cho dữ liệu/API cũ.
  - Giữ lại 2 quyết định dứt khoát: **Tham gia** (`JOIN`) hoặc **Báo vắng** (`DECLINE`).
  - **Cơ chế Chặn Bình chọn khi Nợ Tiền Sân (Debt-Gated Voting)**: Tự động phát hiện các khoản nợ tiền sân chưa xác nhận (`status !== 'CONFIRMED'`) từ các trận trước. Chặn quyền bình chọn Tham gia (`JOIN`) và báo lỗi chi tiết số tiền nợ/trận nợ; đồng thời vẫn bảo lưu quyền Báo vắng (`DECLINE`) để nắm bắt quân số.
  - Hiển thị Banner cảnh báo nổi bật kèm nút `💳 Xem & Thanh toán ngay ↗` chuyển hướng nhanh đến giao diện quét mã VietQR PayOS để thanh toán gạch nợ tức thì.
  - Đồng bộ chuẩn xác số lượng người tham gia thực tế hiển thị trên tiêu đề và chi tiết trận đấu.
- **Tích hợp Cổng Thanh toán Thông minh PayOS**:
  - Tích hợp PayOS SDK tạo mã VietQR thanh toán động cho từng thành viên và từng trận đấu với số tiền chính xác.
  - Xử lý Webhook PayOS tự động xác thực tính toàn vẹn giao dịch qua `checksum key`, tự động gạch nợ và chuyển trạng thái sang `Đã thanh toán` (`PAID`) theo thời gian thực.
- **Khắc phục Lỗi Chuẩn hóa Email (Gmail Dot Bug)**:
  - Loại bỏ bộ lọc `normalizeEmail()` tự ý xóa dấu chấm (`.`) trong địa chỉ Gmail từ `express-validator`, đảm bảo địa chỉ email người dùng được giữ nguyên vẹn khi đăng ký và gửi mã OTP.
- **Cập nhật Giao diện & Trải nghiệm Người dùng**:
  - Nâng cấp hiển thị phiên bản `v1.2.2` đồng bộ tại Footer hệ thống và toàn bộ cấu hình dự án.

### `v1.2.1`
- **Hàng rào Bảo vệ Chống DoS / DDoS**:
  - Tích hợp `express-rate-limit` đa cấp: Global API limiter (200 reqs/15m), OTP limiter (5 reqs/15m), Auth limiter (15 reqs/15m), Compute limiter (20 reqs/1m).
  - Tích hợp `express-slow-down` (Speed Bumps) làm chậm request sau 80 hits/15m.
  - Tích hợp `helmet` (bảo vệ HTTP security headers chuẩn OWASP, ẩn `X-Powered-By`) và `hpp` (chống HTTP Parameter Pollution).
  - Chống tấn công Slowloris qua Node.js timeouts (`headersTimeout = 20s`, `requestTimeout = 30s`, `keepAliveTimeout = 5s`).
  - Cấu hình `trust proxy` hỗ trợ chạy sau Cloudflare CDN / Reverse Proxy.
- **Thuật toán Chia Đội hình Ngẫu nhiên hóa (Randomized Team Balancer)**:
  - Bổ sung xáo trộn ngẫu nhiên các cầu thủ có cùng Tier (Fisher-Yates same-tier shuffle) kết hợp Random Tie-Breaking.
  - Mỗi lần bấm "Xáo trộn & Chia lại" luôn tạo ra đội hình ngẫu nhiên mới mẻ mà vẫn bảo toàn điểm số cân bằng giữa các đội.
- **Universal Modal Portal**:
  - Kiến trúc `createPortal(..., document.body)` làm mờ sâu toàn màn hình 100vw x 100vh (`backdrop-filter: blur(12px)`), che phủ toàn bộ header/navbar và khóa cuộn trang nền.

### `v1.2.0`
- Triển khai tính năng tự động chia đội hình trước mỗi trận đấu (5 người/đội).
- Hỗ trợ vai trò Thủ môn (`isGoalkeeper`), cơ chế luân phiên bắt gôn khi thiếu GK, ưu tiên người vote sớm nhất và danh sách Dự bị (Reserves).
- Thuật toán Greedy Snake Draft + 2-Opt Local Search Swap cân bằng điểm số theo Tier (S, A, B, C, D).

### `v1.1.0`
- Nâng cấp giao diện UI phong cách SaaS chuyên nghiệp, loại bỏ toàn bộ emoji dư thừa, chuyển sang stroke vector icon (SVG).
- Modal chỉnh sửa thông tin trận đấu dành riêng cho Admin.
- Tích hợp ảnh đại diện cá nhân (Avatar) và ảnh mã VietQR thanh toán.
- Xác thực đăng ký tài khoản bằng mã OTP gửi qua Brevo Email API.

### `v1.0.0`
- Khởi tạo hệ thống cốt lõi CSE PunchDad: Đăng nhập/Đăng ký JWT, quản lý trận đấu, bình chọn tham gia và chia tiền sân.

---

## Giấy phép

Phát triển nội bộ cho **CSE HitDad Sports Club** © 2026.
