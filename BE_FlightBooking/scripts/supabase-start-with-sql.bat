@echo off
cd /d "%~dp0.."
echo Starting Supabase local...
call npx supabase start --exclude edge-runtime,logflare,vector
if errorlevel 1 (
    echo ERROR: supabase start failed. Is Docker Desktop running?
    pause
    exit /b 1
)

echo.
echo Running SQL migrations...
cmd /c "docker exec -i supabase_db_BE_FlightBooking psql -U postgres -d postgres < src\migrations\supabase_schema.sql"
cmd /c "docker exec -i supabase_db_BE_FlightBooking psql -U postgres -d postgres < src\migrations\supabase_rpc_transactions.sql"
cmd /c "docker exec -i supabase_db_BE_FlightBooking psql -U postgres -d postgres < src\migrations\supabase_rpc_reports.sql"

echo Reloading API schema cache...
docker restart supabase_rest_BE_FlightBooking >nul 2>&1
timeout /t 3 /nobreak >nul

echo.
echo Supabase Studio: http://127.0.0.1:54323
echo API URL: http://127.0.0.1:54321
echo.
echo To seed data: npm run seed
pause
