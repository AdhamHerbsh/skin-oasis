@echo off
cd /d D:\erp

:: أمر فتح المتصفح مع الانتظار لعدة ثوانٍ لضمان استجابة السيرفر
start "" "http://localhost:3000"
timeout /t 3 /nobreak >nul

:: أمر تشغيل المشروع
npm run dev