# ⚽ CSE PunchDad

> Sports Club Voting & Payment Management System

Website quản lý câu lạc bộ thể thao (~30 thành viên). Hỗ trợ vote tham gia, quản lý đặt sân, và phân chia thanh toán tiền sân đá bóng.

## Tech Stack

- **Frontend**: React (Vite)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (access + refresh token)

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

### 1. Clone & Install

```bash
git clone <repo-url>
cd CSE_PunchDad
npm run install:all
```

### 2. Setup Database

```bash
# Copy env file và cập nhật DATABASE_URL
cp server/.env.example server/.env

# Chạy migration
npm run db:migrate

# Seed data mẫu
npm run db:seed
```

### 3. Run Development

```bash
# Chạy cả client + server cùng lúc
npm run dev

# Hoặc chạy riêng
npm run dev:client   # http://localhost:5173
npm run dev:server   # http://localhost:5000
```

### 4. Prisma Studio (xem database)

```bash
npm run db:studio    # http://localhost:5555
```

## Default Accounts

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | ADMIN |
| member1 | member123 | MEMBER |
| member2 | member123 | MEMBER |
| member3 | member123 | MEMBER |

## Project Structure

```
CSE_PunchDad/
├── client/          # React Frontend (Vite)
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-level pages
│       ├── context/       # Auth context
│       ├── services/      # API calls
│       └── hooks/         # Custom hooks
│
├── server/          # Node.js Backend (Express)
│   ├── prisma/      # Schema + migrations + seed
│   └── src/
│       ├── controllers/   # Request handlers
│       ├── middleware/     # Auth, validation, error
│       ├── routes/        # API routes
│       └── services/      # Business logic
│
└── package.json     # Root workspace scripts
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/sessions` | Danh sách sessions |
| POST | `/api/sessions` | Tạo session (Admin) |
| POST | `/api/votes` | Vote tham gia |
| GET | `/api/payments/session/:id` | Xem thanh toán |

## License

MIT
