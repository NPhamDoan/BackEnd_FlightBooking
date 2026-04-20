@echo off
REM ============================================================
REM Setup Supabase Local Development Environment
REM Yêu cầu: Docker Desktop đang chạy, npm đã cài
REM Dùng npx supabase (không cần cài global)
REM ============================================================

echo === Setup Supabase Local ===
echo.

REM Step 1: Check Docker
echo [1/7] Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker not found. Please install Docker Desktop first.
    exit /b 1
)
echo Docker OK.

REM Step 2: Install dependencies (including supabase CLI as local dep)
echo [2/6] Installing npm dependencies...
call npm install
call npm install --save-dev supabase
if errorlevel 1 (
    echo ERROR: npm install failed.
    exit /b 1
)

REM Step 3: Init Supabase (skip if already initialized)
echo [3/6] Initializing Supabase...
if not exist "supabase" (
    call npx supabase init
) else (
    echo Already initialized, skipping.
)

REM Step 4: Start Supabase local
echo [4/6] Starting Supabase local (Docker containers)...
echo First time will download ~2-3GB of Docker images. Please wait...
call npx supabase start --exclude edge-runtime,logflare,vector
if errorlevel 1 (
    echo ERROR: supabase start failed. Is Docker Desktop running?
    exit /b 1
)

REM Step 5: Run SQL migrations via psql in Docker
echo [5/6] Running SQL migrations...

echo Running schema...
cmd /c "docker exec -i supabase_db_BE_FlightBooking psql -U postgres -d postgres < src\migrations\supabase_schema.sql"
if errorlevel 1 (
    echo WARNING: Schema migration may have already been applied.
)

echo Running RPC transactions...
cmd /c "docker exec -i supabase_db_BE_FlightBooking psql -U postgres -d postgres < src\migrations\supabase_rpc_transactions.sql"
if errorlevel 1 (
    echo WARNING: RPC transactions may have already been applied.
)

echo Running RPC reports...
cmd /c "docker exec -i supabase_db_BE_FlightBooking psql -U postgres -d postgres < src\migrations\supabase_rpc_reports.sql"
if errorlevel 1 (
    echo WARNING: RPC reports may have already been applied.
)

REM Reload API schema cache after migrations
echo Reloading API schema cache...
docker restart supabase_rest_BE_FlightBooking >nul 2>&1
timeout /t 3 /nobreak >nul

REM Step 6: Create .env from local credentials
echo [6/6] Creating .env with local Supabase credentials...

REM Parse supabase status output
for /f "tokens=1,* delims==" %%a in ('npx supabase status -o env 2^>nul') do (
    if "%%a"=="API_URL" set "SUPA_URL=%%~b"
    if "%%a"=="PUBLISHABLE_KEY" set "SUPA_PUB=%%~b"
    if "%%a"=="SECRET_KEY" set "SUPA_SEC=%%~b"
)

(
echo # Supabase Configuration (Local)
echo SUPABASE_URL=%SUPA_URL%
echo SUPABASE_PUBLISHABLE_KEY=%SUPA_PUB%
echo SUPABASE_SECRET_KEY=%SUPA_SEC%
echo.
echo # Application Configuration
echo JWT_SECRET=local-dev-jwt-secret-key
echo PORT=4000
echo CORS_ORIGIN=http://localhost:3000
echo DEBUG=true
) > .env

echo .env created with local Supabase credentials.

REM Seed data
echo.
echo Running seed data...
call npm run seed
if errorlevel 1 (
    echo WARNING: Seed may have failed. Check output above.
)

echo.
echo === Setup Complete! ===
echo.
echo Supabase Studio: http://127.0.0.1:54323
echo API URL: %SUPA_URL%
echo.
echo Run the app: npm run dev
