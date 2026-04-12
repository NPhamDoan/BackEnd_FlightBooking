@echo off
REM ==============================================
REM Flight Booking Backend - Setup Script (Windows)
REM ==============================================

echo ==========================================
echo   Flight Booking Backend - Setup
echo ==========================================
echo.

REM 1. Kiem tra Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js chua duoc cai dat. Vui long cai Node.js ^>= 18.
  exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION%

REM 2. Cai dat dependencies
echo.
echo [1/4] Cai dat dependencies...
call npm install

REM 3. Tao file .env neu chua co
echo.
echo [2/4] Kiem tra file .env...
if not exist .env (
  copy .env.example .env >nul
  for /f "tokens=*" %%j in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWT_SECRET=%%j
  node -e "const fs=require('fs');let c=fs.readFileSync('.env','utf8');c=c.replace('your_jwt_secret_key_here','%JWT_SECRET%');fs.writeFileSync('.env',c);"
  echo [OK] Da tao file .env voi JWT_SECRET ngau nhien
) else (
  echo [OK] File .env da ton tai, bo qua
)

REM 4. Tao thu muc data
echo.
echo [3/4] Tao thu muc data...
if not exist data mkdir data
echo [OK] Thu muc data san sang

REM 5. Seed du lieu mau
echo.
echo [4/4] Seed du lieu mau...
call npx ts-node src/seeds/seed.ts

echo.
echo ==========================================
echo   Setup hoan tat!
echo ==========================================
echo.
echo Chay server:
echo   npm run dev        (development)
echo   npm run build ^&^& npm start  (production)
echo.
echo Chay test:
echo   npm test
echo.
echo Tai khoan mau:
echo   Admin:    admin@flightbooking.local / Admin@123
echo   Customer: nguyenvana@example.local / Customer@123
echo.
