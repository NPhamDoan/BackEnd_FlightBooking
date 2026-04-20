@echo off
cd /d "%~dp0.."
echo Stopping Supabase local...
call npx supabase stop
echo Done.
pause
