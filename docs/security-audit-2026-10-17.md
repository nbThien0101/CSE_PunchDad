# Kiểm tra sự cố truy cập tài khoản — bản vá 1.2.4 — 17/10/2026

Người dùng báo cáo có người thấy tài khoản khác trên giao diện và sửa được thông tin, sau đó cung cấp ảnh console có request cập nhật hồ sơ. Chưa có log server, bằng chứng nguồn gốc token hoặc cấu hình Render để xác định chính xác cách người đó thực hiện. Kiểm tra này chỉ đọc mã nguồn và kiểm thử bằng tài khoản giả, không dùng token trong ảnh để truy cập hoặc sửa tài khoản thật.

## Phát hiện

| Mức độ | Phát hiện và bằng chứng | Giới hạn kết luận |
| --- | --- | --- |
| Nghiêm trọng nếu production dùng khóa mẫu | Cấu hình local dùng khóa JWT mẫu/yếu. Tài liệu cũ hướng dẫn khóa cố định; `.env.example` cũ chứa khóa mẫu. Mô phỏng middleware cũ xác nhận token giả ký bằng khóa mẫu được chấp nhận với ID nạn nhân. API thành viên cung cấp ID; quyền lấy từ DB nên cả tài khoản ADMIN có thể bị giả mạo nếu khóa bị biết. | Chưa kiểm tra giá trị đang cài trên Render; chưa chứng minh đây là nguyên nhân của ảnh chụp. Khóa ngẫu nhiên không bị bẻ chỉ bằng sửa ID trong JWT. |
| Cao | Đổi/reset mật khẩu không thu hồi JWT access hoặc refresh. Refresh cũ có thể xin token tiếp mà không kiểm tra trạng thái người dùng. | Cho phép duy trì truy cập sau khi có token; tự nó chưa giải thích cách lấy token đầu tiên. |
| Cao | Endpoint xác thực email đăng ký nhận `otp` từ JSON trực tiếp vào bộ lọc Prisma. Dữ liệu object thay cho chuỗi mã có thể khớp bản ghi còn hiệu lực và nhận proof xác thực mà không biết mã. | Bypass xác thực đăng ký; ràng buộc email unique vẫn ngăn đăng ký đè trực tiếp lên tài khoản tồn tại. Không đồng nhất lỗi này với chiếm tài khoản hiện hữu. |
| Trung bình | Giới hạn OTP trước đây chỉ theo IP; không giới hạn số lần đoán trên một challenge. Token reset và OTP được đọc/đánh dấu dùng ở các thao tác riêng, cho phép dùng đồng thời. | Chưa có bằng chứng khai thác thực tế. |
| Cao nếu đã seed lên production | Hai script demo tạo tài khoản với mật khẩu cố định; tài liệu công khai các tài khoản demo. | Chưa xác minh production có tài khoản demo hay có giữ mật khẩu mặc định. |

Các đường cập nhật hồ sơ, avatar, QR và mật khẩu hiện lấy ID từ `req.user`; cập nhật vote kiểm tra chủ sở hữu; các route quản trị user kiểm tra role từ DB. Chưa tìm thấy đường đổi ID trong body đơn thuần để sửa hồ sơ người khác. Việc xem được danh sách thành viên là chức năng riêng và không chứng minh có quyền đăng nhập.

## Bằng chứng bổ sung từ ảnh console

Ảnh được cung cấp sau báo cáo ban đầu cho thấy:

- Một phản hồi `401 Invalid token` ở phía trên; ảnh không đủ để xác định request gây ra phản hồi đó hoặc liên hệ chính xác với request thành công phía dưới.
- Một request `PUT /api/users/profile` dùng Bearer token được điền thủ công, cùng các trường hồ sơ và `role: "ADMIN"` trong body.
- Request phía dưới nhận `200`, thông báo cập nhật thành công, nhưng user trả về vẫn có `role: "MEMBER"`. Ảnh không chứng minh nâng quyền admin thành công.

Cả controller trước bản vá được kiểm tra và controller hiện tại chỉ nhận các trường hồ sơ cho phép; `role` không nằm trong dữ liệu update. ID cập nhật lấy từ `req.user.id`, được middleware tra từ `userId` trong token đã xác thực. Vì vậy, `200` chỉ cho thấy token được chấp nhận và hồ sơ gắn với token được cập nhật; chưa xác định người gửi có quyền sở hữu token đó hay không.

Cần đối chiếu ID tài khoản trong response với tài khoản mà người gửi được phép sử dụng. Nếu token thuộc chính người gửi, thao tác này có thể chỉ là cập nhật hồ sơ cá nhân, kể cả khi tên hiển thị giống người khác. Nếu token thuộc thành viên khác mà không được cho phép, cần xác minh cách token bị lấy hoặc giả mạo. Các khả năng này chưa được phân biệt chỉ từ ảnh.

Ảnh chứa Bearer token và thông tin liên hệ. Không chép token hoặc thông tin cá nhân vào tài liệu/repository, không dùng token thử trên production. Token đã lộ cần được thu hồi; việc triển khai cơ chế mới và thay khóa trên Render phải được xác nhận riêng, vì deployment frontend trên Vercel không xác nhận trạng thái backend.

## Bản sửa trong mã nguồn 1.2.4

- Chặn khóa JWT mẫu, khóa ngắn và hai khóa trùng nhau khi khởi động; chỉ chấp nhận HS256 và đúng loại access/refresh.
- Thêm `auth_version` vào user, ký vào token và đối chiếu DB khi xác thực/refresh. Token không có claim mới bị từ chối, nên phiên trước bản vá phải đăng nhập lại.
- Đổi/reset mật khẩu tăng `auth_version`; cả access và refresh cũ hết hiệu lực. Đổi mật khẩu trên giao diện đưa người dùng về trạng thái đăng xuất.
- OTP chỉ nhận chuỗi sáu chữ số; phân biệt mã đăng ký và khôi phục; dùng mã mới nhất; tối đa năm lần thử cho một challenge trong DB.
- Tiêu thụ OTP/proof và tạo tài khoản/reset mật khẩu trong transaction; cập nhật có điều kiện ngăn dùng cùng proof hai lần khi request chạy đồng thời.
- Migration vô hiệu hóa toàn bộ OTP/proof còn hiệu lực trước bản vá, vì proof cũ có thể được cấp qua endpoint lỗi.
- Chặn chạy hai script tạo tài khoản demo khi `NODE_ENV=production`. Việc này không thay mật khẩu tài khoản demo đã có.
- Mặc định access token 15 phút; cấu hình Render Blueprint và hướng dẫn local đồng bộ giá trị này. Một biến môi trường đang cài sẵn vẫn cần được kiểm tra trên dashboard.

## Kiểm thử

Tái hiện trước sửa bằng middleware/controller cũ với DB giả: chấp nhận token giả khi dùng khóa mẫu và chấp nhận object làm bộ lọc OTP.

Bộ kiểm thử hồi quy ở `server/tests/auth-security.test.js` chạy source controller/middleware thật với Prisma và PostgreSQL 18.3 tạm trên localhost. Email bị vô hiệu hóa. Các tình huống bao gồm chữ ký/ID bị sửa, token sai loại, đăng nhập hợp lệ, phân quyền hồ sơ, OTP sai kiểu, OTP khác mục đích/email, mã hết hạn, giới hạn đoán, hai request đồng thời, và thu hồi access/refresh sau đổi/reset mật khẩu. Không có kết nối tới database production.

Chạy kiểm thử JWT không cần DB bằng `cd server && npm test`. Nhóm PostgreSQL chỉ chạy khi đặt biến riêng `AUTH_SECURITY_TEST_DATABASE_URL`; bộ test từ chối host ngoài loopback và tên DB ngoài `cse_punchdad_auth_security`. Chuẩn bị DB test riêng, áp dụng migration bằng `DATABASE_URL` trỏ rõ vào DB test, rồi chạy:

```sh
AUTH_SECURITY_TEST_DATABASE_URL='postgresql://auth_test@127.0.0.1:55439/cse_punchdad_auth_security' npm test
```

## Xử lý production

1. Trong khi xác minh sự cố, tạm ngưng truy cập cả frontend và backend API. Chỉ tắt tự deploy vẫn để bản web hiện tại hoạt động; chỉ pause frontend vẫn để API public.
2. Trên Render, thay cả `JWT_SECRET` và `JWT_REFRESH_SECRET` bằng hai giá trị ngẫu nhiên độc lập. Không gửi khóa, token, OTP hoặc mật khẩu vào chat/nhóm. `generateValue: true` trong Blueprint không phải thao tác đổi các khóa đang tồn tại.
3. Triển khai bản vá kèm migration `20261017090000_harden_auth_sessions` và Prisma Client mới. Cấu hình start hiện tại của dự án chạy `prisma migrate deploy`. Tất cả người dùng phải đăng nhập lại; các luồng OTP đang dở phải yêu cầu mã mới.
4. Rà soát tài khoản admin/demo và yêu cầu tài khoản bị ảnh hưởng đặt lại mật khẩu sau bản vá; xác minh thông tin hồ sơ, QR và dữ liệu đã bị sửa. Không xóa dữ liệu để xử lý sự cố.
5. Đối chiếu thời điểm ảnh chụp với log Render, endpoint được gọi và ID tài khoản do chủ hệ thống cung cấp. Giữ log làm bằng chứng; thiếu log thì không thể kết luận lịch sử xâm nhập hoặc số tài khoản bị ảnh hưởng.

Lần kiểm tra này không thay khóa hoặc dữ liệu production và không xác nhận bản vá đã được deploy. File `.env` local còn dùng khóa mẫu phải được cập nhật trước khi chạy server đã vá. Kiểm thử local không chứng minh production đã an toàn. Quy trình triển khai bản mã nguồn 1.2.4 nằm tại [release notes](releases/v1.2.4.md).
