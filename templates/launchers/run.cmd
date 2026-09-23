@echo off
setlocal
cd /d "%~dp0..\.."
call npx {{PRODUCT_NAME}} run {{AUTOMATION_NAME}} %*
echo.
pause
