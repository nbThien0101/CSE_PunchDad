# Hướng Dẫn Tích Hợp & Kiểm Thử Push Notification (Android APK + iOS PWA)

Tài liệu này mô tả hệ thống API Push Notification trên backend `CSE_PunchDad` (`server/`) để dùng chung cho repo Mobile App:
- **Android (file APK cài đặt trực tiếp)**: dùng **FCM** (`FIREBASE_SERVICE_ACCOUNT_JSON`) hoặc **Expo Push** (`ExponentPushToken[...]`).
- **iOS (PWA "Add to Home Screen")**: dùng **Web Push chuẩn W3C + VAPID** (`web-push`).

---

## 1. Cấu Hình Biến Môi Trường (Backend `server/.env` & Render)

### 1.1. Cho iOS PWA (`WEB_PUSH`)
Chạy lệnh tạo cặp khóa VAPID:

```bash
cd server
npm run vapid:generate
```

Dán 2 giá trị vừa tạo vào `server/.env` (hoặc mục Environment trên Render):

```env
VAPID_PUBLIC_KEY="<khóa public vừa tạo>"
VAPID_PRIVATE_KEY="<khóa private vừa tạo>"
VAPID_SUBJECT="mailto:csepunchdad@gmail.com"
```

> **Lưu ý quan trọng cho iOS (Apple Push)**: `VAPID_SUBJECT` **bắt buộc** bắt đầu bằng `mailto:` hoặc `https://`, nếu không Apple (`https://web.push.apple.com`) sẽ từ chối request.

### 1.2. Cho Android APK (`FCM` hoặc `EXPO`)
- **Nếu Android APK dùng Firebase Cloud Messaging (React Native Firebase / Flutter / Capacitor / Expo `getDevicePushTokenAsync`)**:
  1. Vào Firebase Console → Project Settings → Service Accounts → **Generate new private key** (tải file JSON).
  2. Dán toàn bộ nội dung file JSON (hoặc chuỗi base64 của file JSON) vào biến `FIREBASE_SERVICE_ACCOUNT_JSON`.
  *(Hoặc dùng 3 biến rời: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.)*
- **Nếu Android APK dùng Expo Push (`getExpoPushTokenAsync`)**:
  Backend đã hỗ trợ sẵn kênh `EXPO` qua `https://exp.host/--/api/v2/push/send` (chỉ cần thêm `EXPO_ACCESS_TOKEN` nếu bật Enhanced Push Security trên Expo).

### 1.3. CORS cho iOS PWA ở repo khác
Nếu PWA iOS được deploy ở domain riêng (ví dụ `https://hitdad-mobile.vercel.app`), thêm domain đó vào `MOBILE_CLIENT_URL` hoặc nối sau `CLIENT_URL` bằng dấu phẩy:

```env
MOBILE_CLIENT_URL="https://hitdad-mobile.vercel.app"
```

### 1.4. Chạy Migration Database
Khi triển khai hoặc chạy local lần đầu với PostgreSQL đang bật:

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

---

## 2. Danh Sách API Endpoints (`/api/notifications`)

Tất cả endpoint (trừ `GET /api/notifications/config`) yêu cầu header `Authorization: Bearer <accessToken>` của tài khoản đã được duyệt (`APPROVED`). Xem chi tiết schema tại `/api-docs` (Swagger UI).

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications/config` | Public | Lấy `vapidPublicKey` và trạng thái bật của `WEB_PUSH`, `FCM`, `EXPO` |
| `GET` | `/api/notifications/subscriptions` | Auth | Liệt kê các thiết bị đang đăng ký push của user hiện tại |
| `POST` | `/api/notifications/subscriptions` | Auth | Đăng ký / làm mới thiết bị nhận push |
| `DELETE` | `/api/notifications/subscriptions` | Auth | Hủy đăng ký theo `endpoint`, `token` hoặc `subscriptionId` (gọi khi logout) |
| `DELETE` | `/api/notifications/subscriptions/:id` | Auth | Xóa một thiết bị đăng ký theo ID |
| `POST` | `/api/notifications/test` | Auth | Gửi push thử nghiệm tới các thiết bị của chính mình và trả báo cáo chi tiết |
| `POST` | `/api/notifications/send` | Admin | Gửi thông báo tùy chỉnh (`ALL`, `USERS`, `SESSION_JOINED`, `SESSION_UNPAID`) |
| `GET` | `/api/notifications` | Auth | Lấy hộp thư thông báo in-app (`?page=1&limit=20&unreadOnly=true`) |
| `GET` | `/api/notifications/unread-count` | Auth | Đếm số thông báo chưa đọc |
| `PUT` | `/api/notifications/read-all` | Auth | Đánh dấu tất cả thông báo là đã đọc |
| `PUT` | `/api/notifications/:id/read` | Auth | Đánh dấu một thông báo là đã đọc |
| `DELETE` | `/api/notifications/:id` | Auth | Xóa một thông báo của mình |

### Các sự kiện hệ thống tự động bắn Push & lưu Inbox:
- Tạo trận đấu mới (`POST /api/sessions`) → thông báo tất cả thành viên đã duyệt.
- Trận đấu đủ `minPlayers` chuyển sang `CONFIRMED` (`POST /api/votes`, `POST /api/votes/admin/adjust`).
- Admin chốt sân `BOOKED` kèm chia tiền (`PUT /api/sessions/:id`) → thông báo kèm số tiền sân dự kiến.
- Admin tính lại tiền sân sau điểm danh (`POST /api/sessions/:id/recalculate-payments`).
- Admin hủy trận (`PUT /api/sessions/:id`, `DELETE /api/sessions/:id`).
- Lưu đội hình chia đội (`PUT /api/sessions/:id/teams`).
- Chốt / mở lại bình chọn (`POST /api/sessions/:id/lock-vote`).
- Thành viên báo đã chuyển tiền (`PUT /api/payments/:id/mark-paid`) → báo cho Payer.
- Thanh toán được xác nhận thủ công hoặc qua PayOS (`PUT /api/payments/:id/confirm`, Webhook/Polling PayOS) → báo cho thành viên.
- Có đơn đăng ký gia nhập CLB mới (`POST /api/auth/register`) → báo cho Admin.

---

## 3. Tích Hợp Phía Repo Mobile App

### 3.1. iOS PWA (Safari → Share → Add to Home Screen)
Điều kiện bắt buộc trên iOS 16.4+:
1. Website PWA phải chạy **HTTPS** và có file `manifest.json` với `"display": "standalone"`, `icons` (192x192 & 512x512).
2. Người dùng phải bấm **Chia sẻ (Share) → Thêm vào Màn hình chính (Add to Home Screen)** và **mở app từ icon ngoài Màn hình chính** (mở trong tab Safari thường sẽ không có `Notification` / `PushManager`).
3. Việc xin quyền `Notification.requestPermission()` phải gắn vào **hành động bấm nút** của người dùng (ví dụ nút "Bật thông báo").

Code mẫu đăng ký phía iOS PWA:

```js
// 1. Đăng ký Service Worker (public/sw.js)
const reg = await navigator.serviceWorker.register('/sw.js');

// 2. Xin quyền khi user bấm nút
const permission = await Notification.requestPermission();
if (permission !== 'granted') throw new Error('Người dùng từ chối thông báo');

// 3. Lấy VAPID public key từ backend
const cfg = await fetch(`${API_URL}/api/notifications/config`).then(r => r.json());
if (!cfg.webPushEnabled || !cfg.vapidPublicKey) throw new Error('Server chưa cấu hình VAPID');

// Helper chuyển Base64URL sang Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// 4. Subscribe với Apple Push / Browser Push Service
const subscription = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey),
});

// 5. Gửi lên backend CSE_PunchDad
await fetch(`${API_URL}/api/notifications/subscriptions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    channel: 'WEB_PUSH',
    platform: 'IOS_PWA',
    deviceName: navigator.platform || 'iPhone PWA',
    subscription: subscription.toJSON(),
  }),
});
```

Code mẫu `sw.js` trong repo Mobile PWA:

```js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'CSE HitDad', {
      body: data.body || '',
      icon: '/logo-192.png',
      badge: '/badge-72.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(targetUrl));
});
```

### 3.2. Android APK (`FCM` hoặc `EXPO`)
Sau khi login thành công, lấy token từ thiết bị và gửi về backend:

```js
// Ví dụ FCM token hoặc ExponentPushToken[...]
await fetch(`${API_URL}/api/notifications/subscriptions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    // channel tự nhận diện ('EXPO' nếu ExponentPushToken[...], ngược lại 'FCM')
    platform: 'ANDROID_APK',
    deviceName: 'Android Device',
    token: devicePushToken,
  }),
});
```

Khi user đăng xuất trên app:

```js
await fetch(`${API_URL}/api/notifications/subscriptions`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ token: devicePushToken }), // hoặc { endpoint } đối với PWA
});
```

---

## 4. Hướng Dẫn Test API Hoạt Động

### Bước 1: Kiểm tra server & cấu hình Push
```bash
curl http://localhost:5001/api/notifications/config
```
Kỳ vọng HTTP `200` trả về `webPushEnabled`, `vapidPublicKey`, `fcmEnabled`, `expoEnabled`.

### Bước 2: Đăng nhập lấy `TOKEN`
```bash
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<mat_khau>"}' | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.accessToken);")
```

### Bước 3: Đăng ký thử subscription & gọi `/api/notifications/test`
- **Test lưu DB & cơ chế kiểm tra** (ví dụ giả lập đăng ký Expo/FCM/WebPush):
```bash
curl -X POST http://localhost:5001/api/notifications/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "channel": "WEB_PUSH",
    "platform": "IOS_PWA",
    "deviceName": "iPhone Test",
    "subscription": {
      "endpoint": "https://web.push.apple.com/test-demo-endpoint",
      "keys": {
        "p256dh": "BK_HYU6aHDsRCGpbhREzIIrYNchnvvfo0EHUa0WtY1tkJZeKpJawVKULk76ZSbz2G9Sudg3_y7cIsXqvo7iZgcQ",
        "auth": "3G4tVWgTxzrrHdkFzgqhdA"
      }
    }
  }'
```

- **Gọi API test push**:
```bash
curl -X POST http://localhost:5001/api/notifications/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Push","body":"Kiểm tra thông báo từ backend"}'
```

  - Khi dùng **endpoint giả** ở trên (`/test-demo-endpoint`), backend vẫn lưu thông báo vào DB (`notificationId`) và mã hóa payload gửi thử qua Apple Push; Apple sẽ từ chối endpoint giả nên response trả về `summary.attempted: 1`, `summary.failed: 1` (kèm chi tiết lỗi trong `results`) và tự vô hiệu hóa subscription giả nếu gặp HTTP `404`/`410`. Điều này xác nhận luồng lưu DB + mã hóa VAPID hoạt động.
  - Khi dùng **token/subscription thật** từ thiết bị (Bước 4), response sẽ trả về `summary.sent >= 1`.
  - Bạn cũng có thể test trực quan toàn bộ 12 endpoint ngay trên Swagger UI tại `http://localhost:5001/api-docs` (mục **Notifications**).

- **Kiểm tra hộp thư thông báo đã lưu**:
```bash
curl http://localhost:5001/api/notifications \
  -H "Authorization: Bearer $TOKEN"
```

### Bước 4: Test nhận thông báo thật trên thiết bị thật
1. **iPhone (iOS 16.4+)**: Mở web PWA trên Safari (HTTPS, ví dụ Render/Vercel/ngrok), bấm **Share → Add to Home Screen**, mở app từ icon Home Screen, đăng nhập, bấm nút đăng ký thông báo (gửi `pushManager.subscribe()` lên `POST /api/notifications/subscriptions`), rồi gọi `POST /api/notifications/test` (hoặc tạo trận mới) → thông báo sẽ hiện lên màn hình khóa / Notification Center của iPhone!
2. **Android APK**: Cài APK trên máy thật (có Google Play Services), đăng nhập để app gửi FCM/Expo token lên `POST /api/notifications/subscriptions`, rồi gọi `POST /api/notifications/test` → kiểm tra `summary.sent >= 1` và thông báo bật lên trên thanh trạng thái Android!
