@echo off
cd /d "%~dp0.."
echo Starting Supabase local...
call npx supabase start --exclude edge-runtime,logflare,vector

echo.
echo Supabase Studio: http://127.0.0.1:54323
echo API URL: http://127.0.0.1:54321
pause
