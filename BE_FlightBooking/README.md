# Flight Booking Backend API

Backend API cho hệ thống đặt vé máy bay, xây dựng bằng Express + TypeScript + SQLite.

## Yêu cầu

- Node.js >= 18
- npm >= 9

## Cài đặt nhanh

### Linux / macOS / Git Bash (Windows)

```bash
bash scripts/setup.sh
```

### Windows (CMD)

```cmd
scripts\setup.bat
```

### Cài đặt thủ công

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file .env từ template
cp .env.example .env
# Sau đó sửa JWT_SECRET trong file .env thành một chuỗi bí mật

# 3. Seed dữ liệu mẫu (tự tạo DB + tables + data)
npm run seed
```

## Chạy dự án

```bash
# Development (auto-reload)
npm run dev

# Production
npm run build
npm start
```

Server chạy tại: `http://localhost:4000`

## API Endpoints

| Method | Endpoint          | Mô tả              | Auth |
|--------|-------------------|---------------------|------|
| GET    | /api/health       | Health check        | Không |
| POST   | /api/auth/register| Đăng ký tài khoản  | Không |
| POST   | /api/auth/login   | Đăng nhập           | Không |

## Chạy test

```bash
npm test
```

## Cấu trúc thư mục

```
src/
├── Auth/              # Module xác thực (controller, routes, validator)
├── config/            # Cấu hình database
├── migrations/        # Migration tạo bảng
├── seeds/             # Seed dữ liệu mẫu
├── shared/
│   ├── middlewares/    # Auth, authorize, error handler
│   ├── types/         # TypeScript types
│   └── utils/         # AppError, helpers
├── app.ts             # Express app setup
└── server.ts          # Entry point
```

## Biến môi trường

| Biến          | Mô tả                        | Mặc định                    |
|---------------|-------------------------------|------------------------------|
| DB_PATH       | Đường dẫn file SQLite         | ./data/flight_booking.db     |
| JWT_SECRET    | Secret key cho JWT            | (bắt buộc phải đặt)         |
| PORT          | Port chạy server              | 4000                         |
| CORS_ORIGIN   | Domain frontend được phép     | http://localhost:3000        |

## Tài khoản mẫu (sau khi seed)

| Role     | Email                          | Mật khẩu     |
|----------|--------------------------------|---------------|
| Admin    | admin@flightbooking.local      | Admin@123     |
| Customer | nguyenvana@example.local       | Customer@123  |
