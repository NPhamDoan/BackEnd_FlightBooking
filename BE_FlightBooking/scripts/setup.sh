#!/bin/bash
# ==============================================
# Flight Booking Backend - Setup Script
# ==============================================

set -e

echo "=========================================="
echo "  Flight Booking Backend - Setup"
echo "=========================================="
echo ""

# 1. Kiểm tra Node.js
if ! command -v node &> /dev/null; then
  echo "[ERROR] Node.js chưa được cài đặt. Vui lòng cài Node.js >= 18."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "[OK] Node.js $NODE_VERSION"

# 2. Cài đặt dependencies
echo ""
echo "[1/4] Cài đặt dependencies..."
npm install

# 3. Tạo file .env nếu chưa có
echo ""
echo "[2/4] Kiểm tra file .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  # Tạo JWT_SECRET ngẫu nhiên
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/your_jwt_secret_key_here/$JWT_SECRET/" .env
  else
    sed -i "s/your_jwt_secret_key_here/$JWT_SECRET/" .env
  fi
  echo "[OK] Đã tạo file .env với JWT_SECRET ngẫu nhiên"
else
  echo "[OK] File .env đã tồn tại, bỏ qua"
fi

# 4. Tạo thư mục data
echo ""
echo "[3/4] Tạo thư mục data..."
mkdir -p data
echo "[OK] Thư mục data sẵn sàng"

# 5. Seed dữ liệu mẫu
echo ""
echo "[4/4] Seed dữ liệu mẫu..."
npx ts-node src/seeds/seed.ts

echo ""
echo "=========================================="
echo "  Setup hoàn tất!"
echo "=========================================="
echo ""
echo "Chạy server:"
echo "  npm run dev        (development)"
echo "  npm run build && npm start  (production)"
echo ""
echo "Chạy test:"
echo "  npm test"
echo ""
echo "Tài khoản mẫu:"
echo "  Admin:    admin@flightbooking.local / Admin@123"
echo "  Customer: nguyenvana@example.local / Customer@123"
echo ""
