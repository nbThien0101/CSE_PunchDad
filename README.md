# CSE PunchDad · Sports Club Management Platform

![Version](https://img.shields.io/badge/version-v1.2.1-blue.svg?style=flat-square)
![Status](https://img.shields.io/badge/build-passing-brightgreen.svg?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)

> **Phiên bản hiện tại: `v1.2.1`** — Nền tảng quản lý câu lạc bộ thể thao toàn diện: Lịch thi đấu, bình chọn tham gia, thuật toán tự động chia đội hình theo Tier & Thủ môn, quản lý chi phí sân bóng và hàng rào bảo mật chống DoS/DDoS đa tầng.

---

## Tính năng Nổi bật

### 1. Quản lý Trận đấu (Session Management)
- **Thiết lập trận đấu linh hoạt**: Admin tạo trận đấu với đầy đủ thông tin: Ngày chơi, khung giờ thi đấu, địa điểm sân, số người tối thiểu/tối đa, tổng tiền sân dự kiến và hạn chót bình chọn.
- **Chỉnh sửa toàn diện (Admin Edit Modal)**: Cập nhật mọi thông số của trận đấu bất kỳ lúc nào qua modal giao diện SaaS chuẩn, bảo mật quyền quản trị viên.
- **Quản lý trạng thái tự động**: Các mốc trạng thái chuẩn xác: *Đang bình chọn* $\rightarrow$ *Đủ người chơi* $\rightarrow$ *Đã đặt sân* $\rightarrow$ *Đã hoàn thành* hoặc *Đã hủy trận*.

### 2. Xác thực Tài khoản & Hồ sơ Cá nhân
- **Bảo mật OTP qua Email**: Đăng ký tài khoản yêu cầu xác thực bằng mã OTP 6 chữ số gửi qua **Brevo Transactional Email API**, có cơ chế chống spam (cooldown 60 giây và giới hạn 5 lần gửi / 15 phút).
- **Cập nhật Ảnh đại diện (Avatar)**: Tải lên và xem trước ảnh đại diện cá nhân, lưu trữ đồng bộ trong cơ sở dữ liệu.
- **Mã VietQR thanh toán**: Tải lên hình ảnh mã QR ngân hàng cá nhân, hiển thị trực quan cho các thành viên khác quét chuyển khoản khi phân chia tiền sân.
- **Vai trò Thủ môn (`isGoalkeeper`)**: Thành viên tự đăng ký vị trí thủ môn trong trang Tài khoản hoặc do Admin chỉ định trực tiếp.

### 3. Thuật toán Tự động Chia & Cân bằng Đội hình (Team Balancer Engine)
- **Quy chuẩn mỗi đội 5 người**: Gồm **1 Thủ môn (GK)** và **4 Cầu thủ sân**.
- **Cơ chế phân bổ Thủ môn thông minh**:
  - *Số GK > Số đội*: Các thủ môn dư sẽ tự động được điều chuyển sang thi đấu như cầu thủ sân bình thường.
  - *Số GK < Số đội*: Các thủ môn sẵn có sẽ luân phiên bắt gôn cho các đội còn thiếu (gắn huy hiệu nổi bật `GK Luân phiên`).
- **Ưu tiên thời gian vote sớm nhất (`votedAt ASC`)**:
  - Người vote sớm nhất được ưu tiên vào danh sách đá chính.
  - Người vote vượt quá chỉ tiêu slot sẽ tự động vào danh sách **Dự bị (Reserves)**.
  - *Ví dụ 21 người vote*: Chia 4 đội (20 người đá chính, 1 người dự bị).
  - *Ví dụ 24 người vote*: Chia 5 đội (24 người thực tế, slot thứ 25 dùng thủ môn luân phiên).
- **Cân bằng sức mạnh theo Tier**:
  - Thang điểm: **Tier S (5đ)**, **Tier A (4đ)**, **Tier B (3đ)**, **Tier C (2đ)**, **Tier D (1đ)**, **Chưa xếp hạng (2đ)**.
  - Kết hợp giải thuật **Greedy Snake Draft** và thuật toán tối ưu cục bộ **2-Opt Local Search Swap** để san bằng tổng điểm và điểm trung bình giữa các đội (phương sai $\approx 0$).
- **Xáo trộn Ngẫu nhiên cùng Tier (Fisher-Yates Same-Tier Shuffle)**:
  - Các cầu thủ trong cùng một nhóm Tier được xáo trộn vị trí ngẫu nhiên mỗi lần chia đội, kết hợp giải thuật phá vỡ thế hòa điểm (Random Tie-Breaking).
  - Nút **"Xáo trộn & Chia lại"** cho phép tạo ra phương án đội hình hoàn toàn mới mẻ trên mỗi lần nhấp chuột mà vẫn đảm bảo tính công bằng và cân bằng sức mạnh tuyệt đối.
- **Modal React Portal Đỉnh cao**:
  - Gắn trực tiếp vào thẻ `<body>` qua `createPortal`, thoát khỏi mọi bẫy CSS transform.
  - Phủ kín 100% viewport (`100vw x 100vh`), làm mờ sâu toàn màn hình (`backdrop-filter: blur(12px)`) che phủ cả thanh điều hướng và lề trang.
  - Khóa cuộn trang nền (`body.modal-open { overflow: hidden }`), hỗ trợ phím `Escape` và hoán đổi vị trí cầu thủ thủ công trước khi lưu.

### 4. Quản lý Chi phí & Chia Tiền Sân
- Admin nhập tổng chi phí thực tế và chọn thành viên đại diện đứng ra thanh toán sân.
- Hệ thống tự động chia đều số tiền trên đầu người tham gia chính thức.
- Hiển thị thông tin chuyển khoản ngân hàng và mã VietQR của người thanh toán để thành viên quét mã nhanh chóng.
- Theo dõi trạng thái nộp tiền của từng thành viên (*Chờ thanh toán* / *Đã thanh toán*).

### 5. Hàng rào Bảo mật Chống DoS và DDoS Đa tầng
- **Tầng ứng dụng (Layer 7 App Defenses)**:
  - **`globalLimiter`**: Giới hạn 200 requests / 15 phút trên mỗi IP cho toàn bộ `/api/*`, trả về header chuẩn `RateLimit-*`.
  - **`speedLimiter` (Speed Bumps)**: Tự động làm chậm phản hồi thêm 300ms (tối đa 2s) khi client gửi trên 80 requests / 15 phút để làm nản lòng botnet và crawler.
  - **`otpLimiter`**: Giới hạn tối đa 5 lần gửi OTP / 15 phút trên mỗi IP, bảo vệ hạn ngạch Brevo API và chống spam email.
  - **`authLimiter`**: Giới hạn 15 lần thử đăng nhập/đăng ký / 15 phút trên mỗi IP, chống tấn công dò mật khẩu (brute-force).
  - **`computeLimiter`**: Giới hạn 20 lần chạy thuật toán chia đội / phút trên mỗi IP, bảo vệ tài nguyên CPU.
  - **`helmet` & `hpp`**: Thiết lập toàn diện các HTTP Security Headers chuẩn OWASP, chống MIME-sniffing, Clickjacking, XSS và HTTP Parameter Pollution. Ẩn hoàn toàn header `X-Powered-By`.
  - **Chống Slowloris DoS**: Cấu hình Node.js timeouts (`headersTimeout = 20s`, `requestTimeout = 30s`, `keepAliveTimeout = 5s`) tự động ngắt kết nối gửi dữ liệu nhỏ giọt.
  - **Giới hạn kích thước Body**: Giới hạn 3MB request payload, chống tràn bộ nhớ RAM server.
  - **`trust proxy`**: Tương thích hoàn hảo với Reverse Proxy và Cloudflare CDN để nhận diện chính xác IP thực của client.

---

## Tech Stack

| Thành phần | Công nghệ sử dụng |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, React Router 7, Vanilla CSS SaaS Design System |
| **Backend** | Node.js, Express 4, Prisma ORM 6 |
| **Cơ sở dữ liệu** | PostgreSQL (Neon Serverless PostgreSQL Database) |
| **Xác thực** | JWT (JSON Web Tokens), Bcrypt.js, Mã OTP Email 6 số |
| **Dịch vụ Email** | Brevo Transactional Email API (REST API / Nodemailer fallback) |
| **Bảo mật** | Helmet, HPP, Express-Rate-Limit, Express-Slow-Down |

---

## Cấu trúc Dự án

```
CSE_PunchDad/
├── client/                     # Frontend React (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/         # Header điều hướng, footer, avatar user
│   │   │   ├── Modal/          # Universal Modal Portal (Fullscreen blur & Scroll lock)
│   │   │   ├── SessionCard/    # Thẻ hiển thị trận đấu danh sách
│   │   │   ├── TeamGenerator/  # Modal phân chia, xáo trộn & cân bằng đội hình
│   │   │   └── VoteButton/     # Nút bình chọn tham gia
│   │   ├── pages/              # Dashboard, SessionDetail, CreateSession, Members, Profile, Login, Register
│   │   ├── context/            # AuthContext lưu trữ trạng thái người dùng
│   │   ├── services/           # Axios / Fetch API client
│   │   └── index.css           # Global SaaS Design System (typography, variables, animations)
│   └── package.json
│
├── server/                     # Backend Node.js (Express)
│   ├── prisma/
│   │   ├── schema.prisma       # Định nghĩa bảng User, Session, Vote, Payment, Team
│   │   ├── migrations/         # Lịch sử các migration database
│   │   └── seed.js             # Dữ liệu khởi tạo tài khoản ban đầu
│   ├── src/
│   │   ├── controllers/        # Điều khiển logic nghiệp vụ (Auth, Session, Vote, Payment, User, OTP)
│   │   ├── middleware/         # Auth, Validation, Error Handler, Security (Rate Limiters, Speed Bumps)
│   │   ├── routes/             # Định tuyến API
│   │   ├── services/           # Team Balancer Service (Snake Draft, 2-Opt, Shuffle) & Brevo Email Service
│   │   └── app.js              # Khởi chạy Express Server, bảo mật Helmet, HPP & Slowloris Timeout
│   └── package.json
│
├── package.json                # Quản lý script khởi chạy toàn bộ ứng dụng
└── README.md                   # Tài liệu hướng dẫn sử dụng và triển khai
```

---

## Hướng dẫn Khởi chạy (Getting Started)

### Yêu cầu Tiên quyết
- **Node.js**: >= 18.x
- **npm**: >= 9.x
- Cơ sở dữ liệu **PostgreSQL** (hoặc tài khoản Neon PostgreSQL)

### 1. Cài đặt Dependencies
Chạy lệnh sau tại thư mục gốc để cài đặt toàn bộ gói cho root, client và server:
```bash
npm run install:all
```

### 2. Cấu hình Môi trường Backend
Tạo file `server/.env` dựa theo mẫu `server/.env.example`:
```env
DATABASE_URL="postgresql://username:password@ep-super-bar...neon.tech/neondb?sslmode=require"
JWT_SECRET="punchdad_jwt_secret_key_super_safe"
JWT_EXPIRES_IN="7d"
PORT=5001
NODE_ENV=development
CLIENT_URL="http://localhost:5173"

# Dịch vụ Email Brevo (Gửi mã OTP)
BREVO_API_KEY="xkeysib-..."
SMTP_EMAIL="csepunchdad@gmail.com"
```

### 3. Cập nhật Cơ sở dữ liệu
```bash
# Chạy migration đồng bộ schema vào database
cd server && npx prisma migrate deploy

# Seed dữ liệu quản trị viên và thành viên mẫu
npx prisma db seed
```

### 4. Khởi chạy Ứng dụng
Tại thư mục gốc, chạy lệnh:
```bash
npm run dev
```
Hệ thống sẽ khởi chạy đồng thời:
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5001` (Health check: `http://localhost:5001/api/health`)

---

## Tài khoản Mặc định

| Tên đăng nhập | Mật khẩu | Họ và tên | Vai trò | Quyền hạn |
| :--- | :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | Admin CLB | **ADMIN** | Tạo trận, sửa/xóa trận, chia đội hình, quản lý thanh toán |
| **`member1`** | `member123` | Nguyen Van A | **MEMBER** | Bình chọn, cập nhật hồ sơ cá nhân, xem đội hình |
| **`member2`** | `member123` | Tran Van B | **MEMBER** | Bình chọn, cập nhật hồ sơ cá nhân, xem đội hình |
| **`member3`** | `member123` | Le Van C | **MEMBER** | Bình chọn, cập nhật hồ sơ cá nhân, xem đội hình |

---

## Danh sách API Endpoints Chính

### Xác thực & Tài khoản (`/api/auth`)
| Phương thức | Endpoint | Middleware | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/send-otp` | `otpLimiter (5/15m)` | Gửi mã OTP xác thực email qua Brevo API |
| `POST` | `/api/auth/verify-otp` | `authLimiter (15/15m)` | Kiểm tra tính hợp lệ của mã OTP |
| `POST` | `/api/auth/register` | `authLimiter`, Validate | Đăng ký tài khoản thành viên mới |
| `POST` | `/api/auth/login` | `authLimiter`, Validate | Đăng nhập hệ thống, cấp Access & Refresh Token |
| `GET` | `/api/auth/me` | `authenticate` | Lấy thông tin tài khoản đang đăng nhập |

### Trận đấu & Đội hình (`/api/sessions`)
| Phương thức | Endpoint | Middleware | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sessions` | `authenticate` | Lấy danh sách trận đấu (hỗ trợ bộ lọc tab) |
| `GET` | `/api/sessions/:id` | `authenticate` | Lấy thông tin chi tiết trận đấu, danh sách vote và đội hình |
| `POST` | `/api/sessions` | `requireAdmin`, Validate | Tạo mới trận đấu (Admin) |
| `PUT` | `/api/sessions/:id` | `requireAdmin` | Chỉnh sửa toàn diện thông tin trận đấu (Admin) |
| `DELETE` | `/api/sessions/:id` | `requireAdmin` | Hủy hoặc xóa trận đấu (Admin) |
| `GET` | `/api/sessions/:id/teams/suggestions` | `authenticate` | Gợi ý số đội phù hợp và danh sách vote sớm nhất |
| `POST` | `/api/sessions/:id/teams/generate` | `requireAdmin`, `computeLimiter` | Tự động cân bằng và xáo trộn đội hình ngẫu nhiên |
| `PUT` | `/api/sessions/:id/teams` | `requireAdmin` | Lưu danh sách đội hình chính thức vào database |
| `DELETE` | `/api/sessions/:id/teams` | `requireAdmin` | Hủy bảng chia đội hình của trận đấu |

### Bình chọn (`/api/votes`)
| Phương thức | Endpoint | Middleware | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/votes` | `authenticate` | Bình chọn trạng thái tham gia (`JOIN`, `MAYBE`, `LEAVE`) |

### Người dùng & Hồ sơ (`/api/users`)
| Phương thức | Endpoint | Middleware | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | `authenticate` | Lấy danh sách toàn bộ thành viên câu lạc bộ |
| `PUT` | `/api/users/profile` | `authenticate` | Cập nhật hồ sơ cá nhân (Avatar, mã VietQR, vai trò Thủ môn) |
| `PUT` | `/api/users/:userId/goalkeeper` | `requireAdmin` | Bật/tắt nhanh vai trò thủ môn cho thành viên |

---

## Kiến trúc Triển khai Production & Bảo vệ DDoS

Để đạt hiệu quả phòng vệ tối ưu trước các đợt tấn công từ chối dịch vụ quy mô lớn trên môi trường Production:
1. **Trỏ tên miền qua Cloudflare (Gói Miễn phí)**:
   - Kích hoạt biểu tượng Đám mây cam (**Proxied**) trên bản ghi DNS.
   - Bật **Bot Fight Mode** trong Cloudflare Security để tự động chặn các botnet quét lỗ hổng đã biết.
   - Đảm bảo `app.set('trust proxy', 1)` trong `server/src/app.js` để Express đọc đúng địa chỉ IP gốc của người dùng thông qua header `CF-Connecting-IP`.
2. **Kích hoạt Under Attack Mode khi bị tấn công**:
   - Khi có dấu hiệu bị flood lưu lượng lớn, bật chế độ "Under Attack" để Cloudflare tự động lọc traffic thông qua thử thách Turnstile không xâm phạm.

---

## Lịch sử Phiên bản (Changelog)

### `v1.2.1` (Phiên bản hiện tại)
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

Phát triển nội bộ cho **CSE PunchDad Sports Club** © 2026.

