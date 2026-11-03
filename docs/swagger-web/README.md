# Swagger docs — URL bài nộp cố định

URL cần giữ nguyên: **https://swaggerdocsmockhitdad.vercel.app/**.
Hai collections nghiệp vụ: User (15 operations chuẩn) và Payment (7 operations chuẩn). Auth/login là hỗ trợ lấy token; các operations cũ được giữ với `deprecated: true`.

## Nguồn đặc tả

Nguồn duy nhất là `server/src/docs/swagger.json`. Backend đọc trực tiếp file này qua `swaggerDoc.js`, phục vụ `/swagger.json` và Swagger UI `/api-docs`. Swagger UI tải JSON qua cấu hình `url`.

Từ thư mục `server/`:

```sh
npm run docs:sync
npm run docs:check
npm test
```

`docs:sync` đồng bộ JSON sang `docs/swagger-web/openapi.json`; commit cả hai file. Site tĩnh tải `./openapi.json`; `/swagger.json` trên Vercel là alias của cùng file. JSON mô tả API; Swagger UI là giao diện đọc JSON và cung cấp Try it out. Host JSON không tự triển khai backend.

## Thử API

1. Chọn server production trong Swagger.
2. Mở Auth → Login và dùng tài khoản test đã được duyệt. Tài khoản PENDING/REJECTED bị từ chối theo backend hiện hành.
3. Sao chép `accessToken`, nhấn Authorize, dán token thuần (không thêm chữ Bearer).
4. Thử GET danh sách thành viên và payment của một session test. Thao tác Admin cần tài khoản Admin.
5. Dùng dữ liệu test cho thao tác cập nhật/xóa/thanh toán; tài liệu không chứa tài khoản hoặc khóa bí mật.

## Cập nhật đúng site Vercel

Thư mục deploy: `docs/swagger-web/`. Đây là site **tĩnh**, không cần Express function, database, Prisma hoặc biến JWT trên Vercel. `vercel.json` đặt framework/build/install về null và outputDirectory là `.` để tránh nhận nhầm backend.

Liên kết với **project hiện đang sở hữu hostname đã nộp**, kiểm tra project/team/domain trước khi deploy. Không tạo project thay thế hoặc đổi hostname. Đăng nhập Vercel không tự chứng minh project nào sở hữu domain; kiểm tra bằng CLI/dashboard rồi mới redeploy production.

Deploy backend chuẩn hóa **trước** khi promote docs mới: Render phải phục vụ canonical routes và cho phép CORS origin `https://swaggerdocsmockhitdad.vercel.app`. Nếu backend vẫn là revision cũ, giữ production docs hiện tại cho đến khi backend sẵn sàng. Triển khai frontend app đồng thời với backend để dùng canonical URLs; alias cũ vẫn phục vụ các client đã phát hành.

Sau deploy xác nhận trên chính URL cố định:

- `/`: HTTP 200, Swagger UI hiển thị Auth/User/Payment.
- `/openapi.json` và `/swagger.json`: HTTP 200 và cùng đặc tả đã review.
- Login → Authorize → GET hoạt động trong trình duyệt, không lỗi CORS.
- Backend health vẫn HTTP 200; request không token vẫn 401, tài khoản thiếu quyền vẫn 403.

Nếu project đang trả `FUNCTION_INVOCATION_FAILED`, kiểm tra deployment logs và project root/framework/output; HTTP 500 tự nó chưa chứng minh nguyên nhân. Redeploy static docs đúng project là hướng cấu hình của repo này, không phải bằng chứng lỗi production đã được sửa.

Không cần đổi URL bài nộp hoặc đăng ký dịch vụ mới. Không đưa token Vercel/PayOS/JWT vào JSON, Git hoặc tài liệu.
