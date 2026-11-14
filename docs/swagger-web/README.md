# 📖 Hướng Dẫn Triển Khai (Deploy) Web Swagger Docs - CSE HitDad

Tài liệu này hướng dẫn chi tiết các phương án triển khai web Swagger Documentation cho toàn bộ hệ thống API **CSE HitDad** (đồng bộ từ `server/src/docs/swagger.json`), bao gồm các collection trọng tâm: **User**, **Payment**, **Notification (Push Android APK & iOS PWA)** cùng **Auth**, **Session**, **Vote**, **Team**, **Attendance**, **Feedback** và **System**.

Thư mục này (`docs/swagger-web/`) chứa toàn bộ mã nguồn web tĩnh của trang tài liệu API độc lập, bao gồm cả giao diện **Swagger UI** (`index.html`) và **Redoc** (`redoc.html`). Chạy `cd server && npm run swagger:sync` bất cứ khi nào cập nhật API docs để đồng bộ cả `server/src/docs/swagger.json` và `docs/swagger-web/openapi.json`.

---

## 🌟 Tổng Quan Các API Collections Trọng Tâm & Đồng Bộ

1. **User Collection (15 Endpoints)**
   - `GET /api/users/members`: Lấy danh sách thành viên chính thức của CLB (ẩn/hiện email theo role).
   - `GET /api/users/export-excel`: Xuất toàn bộ danh sách thành viên và đơn chờ duyệt ra file Excel (.xlsx).
   - `GET /api/users/membership-requests`: Danh sách các đơn đăng ký gia nhập CLB đang chờ duyệt.
   - `GET /api/users/membership-requests/count`: Đếm số lượng đơn đang chờ duyệt (hiển thị badge thông báo).
   - `PUT /api/users/membership-requests/{userId}`: Duyệt (`APPROVED`) hoặc từ chối (`REJECTED`) đơn gia nhập.
   - `PUT /api/users/{userId}/tier`: Cập nhật phân hạng trình độ chuyên môn (A/B/C/D...) phục vụ chia đội.
   - `PUT /api/users/{userId}/goalkeeper`: Cập nhật vai trò thủ môn (Goalkeeper).
   - `PUT /api/users/profile`: Người dùng tự cập nhật thông tin cá nhân (tên hiển thị, SĐT, STK ngân hàng).
   - `PUT /api/users/change-password`: Đổi mật khẩu tài khoản (tự động thu hồi token cũ).
   - `PUT /api/users/avatar`: Tải lên ảnh đại diện Base64 (PNG, JPEG, WebP, tối đa 2MB).
   - `DELETE /api/users/avatar`: Xóa ảnh đại diện cá nhân.
   - `PUT /api/users/qr-code`: Tải lên mã VietQR ngân hàng cá nhân Base64 (tối đa 2MB).
   - `GET /api/users/{id}/qr-code`: Lấy mã VietQR ngân hàng của một thành viên theo ID.
   - `DELETE /api/users/qr-code`: Xóa mã VietQR cá nhân.
   - `DELETE /api/users/{userId}`: Ban Cán Sự xóa thành viên khỏi CLB cùng toàn bộ lịch sử vote/payment.

2. **Payment Collection (7 Endpoints)**
   - `GET /api/payments/session/{sessionId}`: Lấy danh sách đóng tiền sân của buổi đấu, thông tin thủ quỹ (payer) và bảng tổng kết. Tự động đối soát realtime với PayOS.
   - `PUT /api/payments/{id}/mark-paid`: Thành viên tự đánh dấu bản thân đã chuyển tiền mặt / thủ công (`PAID`).
   - `PUT /api/payments/{id}/confirm`: Thủ quỹ hoặc Admin xác nhận đã nhận tiền (`CONFIRMED`). Tự động hoàn tất session nếu đủ tiền.
   - `POST /api/payments/{id}/payos-link`: Khởi tạo link thanh toán PayOS và sinh mã VietQR động tự động điền tiền và nội dung.
   - `GET /api/payments/{id}/payos-status`: Polling kiểm tra trạng thái thanh toán từ cổng PayOS theo thời gian thực.
   - `POST /api/payments/payos-confirm-webhook`: Admin đăng ký và xác thực Webhook URL với máy chủ PayOS.
   - `POST /api/payments/payos-webhook`: Webhook công khai (Public) nhận thông báo thanh toán thành công từ PayOS bằng Checksum HMAC-SHA256.

3. **Notification Collection (Push Android APK / iOS PWA & Inbox - 12 Operations)**
   - `GET /api/notifications/config`: Public endpoint trả về `vapidPublicKey` và trạng thái hỗ trợ của `WEB_PUSH`, `FCM`, `EXPO`.
   - `GET /api/notifications/subscriptions`: Liệt kê các thiết bị đang đăng ký nhận push của tài khoản hiện tại.
   - `POST /api/notifications/subscriptions`: Đăng ký hoặc làm mới thiết bị (`WEB_PUSH` cho iOS PWA Add to Home Screen, `FCM` / `EXPO` cho Android APK).
   - `DELETE /api/notifications/subscriptions`: Hủy đăng ký thiết bị theo `subscriptionId`, `endpoint` hoặc `token` (khi đăng xuất).
   - `DELETE /api/notifications/subscriptions/{id}`: Xóa một đăng ký thiết bị theo ID.
   - `POST /api/notifications/test`: Gửi push thử nghiệm tới các thiết bị của chính mình và trả báo cáo gửi (`summary`, `results`).
   - `POST /api/notifications/send`: Admin gửi thông báo tùy chỉnh / nhắc đóng tiền (`ALL`, `USERS`, `SESSION_JOINED`, `SESSION_UNPAID`).
   - `GET /api/notifications`: Lấy danh sách thông báo in-app có phân trang (`?page=1&limit=20&unreadOnly=true`).
   - `GET /api/notifications/unread-count`: Đếm số thông báo chưa đọc.
   - `PUT /api/notifications/read-all`: Đánh dấu tất cả thông báo là đã đọc.
   - `PUT /api/notifications/{id}/read`: Đánh dấu một thông báo là đã đọc.
   - `DELETE /api/notifications/{id}`: Xóa một thông báo của mình.

4. **Các Collection Khác Đã Đồng Bộ**: **System**, **Auth**, **Session**, **Vote**, **Team**, **Attendance**, **Feedback** (giúp bạn test trực tiếp `POST /api/auth/login` ngay trên Swagger UI để lấy `accessToken`).

---

## 🚀 Các Phương Án Triển Khai (Deploy)

---

### Phương Án 1: Triển Khai Trực Tiếp Cùng Backend Express (Khuyên Dùng Nhất)

Backend Express của dự án đã được tích hợp sẵn `swagger-ui-express` và endpoint `/swagger.json`.

#### Chạy tại môi trường Local:
```bash
cd server
npm start # hoặc npm run dev
```
Truy cập ngay trên trình duyệt:
- **Giao diện tương tác Swagger UI**: [http://localhost:5001/api-docs](http://localhost:5001/api-docs)
- **File đặc tả OpenAPI JSON**: [http://localhost:5001/swagger.json](http://localhost:5001/swagger.json)

#### Triển khai lên Render Cloud:
Khi backend được deploy lên Render theo file `render.yaml` đã có trong dự án:
- Swagger Docs sẽ tự động chạy tại:
  `https://cse-punchdad-api.onrender.com/api-docs`
- File JSON:
  `https://cse-punchdad-api.onrender.com/swagger.json`

> **Lợi ích**: Không cần tạo thêm service mới, không tốn thêm tài nguyên, code backend thay đổi đến đâu docs cập nhật đến đó.

---

### Phương Án 2: Triển Khai Web Tĩnh Riêng Biệt Lên Vercel (Miễn Phí, Tốc Độ Siêu Nhanh)

Ưu điểm của phương án này là website tài liệu hoạt động 24/7 độc lập trên CDN toàn cầu của Vercel, không bị trễ do server Render "ngủ đông" (cold start).

#### Cách 1: Deploy bằng Vercel CLI (1 dòng lệnh)
```bash
# Cài đặt hoặc chạy trực tiếp Vercel CLI
npx vercel docs/swagger-web --prod
```
Làm theo hướng dẫn trên terminal (đăng nhập tài khoản Vercel), bạn sẽ nhận được một domain miễn phí dạng `https://cse-hitdad-api-docs.vercel.app`.

#### Cách 2: Deploy từ Vercel Dashboard
1. Truy cập [https://vercel.com/dashboard](https://vercel.com/dashboard) và nhấn **Add New...** -> **Project**.
2. Chọn kho lưu trữ Git của bạn.
3. Trong phần **Root Directory**, nhấn **Edit** và chọn thư mục: `docs/swagger-web`.
4. Nhấn **Deploy**.

---

### Phương Án 3: Triển Khai Lên Netlify (Kéo Thả 5 Giây)

#### Cách 1: Netlify Drop (Không cần cài đặt, không cần dòng lệnh)
1. Đăng nhập [https://app.netlify.com/drop](https://app.netlify.com/drop).
2. Kéo thả toàn bộ thư mục `docs/swagger-web` vào khung kéo thả của Netlify.
3. Trong vòng 5 giây, Netlify sẽ cấp ngay một tên miền dạng `https://random-name.netlify.app`.
4. Bạn có thể vào **Site settings** -> **Change site name** để đổi tên thành `https://cse-hitdad-docs.netlify.app`.

#### Cách 2: Netlify CLI
```bash
npx netlify deploy --dir=docs/swagger-web --prod
```

---

### Phương Án 4: Triển Khai Lên GitHub Pages

Nếu kho lưu trữ của bạn nằm trên GitHub:
1. Vào **Settings** của repository trên GitHub.
2. Mục **Pages** (ở menu bên trái):
   - **Source**: Chọn `Deploy from a branch`.
   - **Branch**: Chọn `main` (hoặc `master`), thư mục chọn `/docs`.
3. Nhấn **Save**.
4. Truy cập tài liệu tại:
   `https://<username>.github.io/<repo-name>/swagger-web/`

---

### Phương Án 5: Import Vào Postman Hoặc SwaggerHub

Nếu đội ngũ phát triển muốn dùng Postman để test API:
1. Mở ứng dụng **Postman**.
2. Nhấn nút **Import** ở góc trên bên trái.
3. Chọn file `server/src/docs/swagger.json` (hoặc `docs/swagger-web/openapi.json`), hoặc dán URL `https://cse-punchdad-api.onrender.com/swagger.json`.
4. Postman sẽ tự động sinh toàn bộ Collection với đầy đủ mô tả, Request Body mẫu và Header Authentication `Bearer <token>`.

---

## 🛠 Cách Test API Trên Giao Diện Swagger UI

1. Đăng nhập hệ thống qua API `/api/auth/login` để lấy `accessToken`.
2. Trên giao diện Swagger UI, nhấn nút **Authorize** màu xanh lá (có biểu tượng ổ khóa) ở góc phải.
3. Nhập token vào ô:
   ```text
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Nhấn **Authorize** -> **Close**.
5. Bây giờ bạn có thể mở bất kỳ endpoint nào (ví dụ `GET /api/users/members`, `POST /api/payments/{id}/payos-link`, hoặc `POST /api/notifications/test`), nhấn **Try it out** và **Execute** để gửi request và xem response trực tiếp.

> **Lưu ý CORS nếu test API Production từ Vercel/Netlify riêng**: Nếu trang `docs/swagger-web` chạy ở domain riêng (ví dụ `https://cse-hitdad-api-docs.vercel.app`) và bạn bấm **Try it out** gọi sang Render Production (`https://cse-punchdad-api.onrender.com`), hãy thêm domain trang Swagger đó vào `CLIENT_URL` hoặc `MOBILE_CLIENT_URL` trên Render (hoặc test trực tiếp trên `/api-docs` của server Render).

