@echo off
setlocal
cd /d "%~dp0"
title CSU Order System - Firebase Setup
echo ================================================
echo CSU Order System - Firebase backend deployment
echo Students do NOT need to sign in.
echo Only the admin username/password are stored as server secrets.
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Install Node.js 22 LTS first:
  echo https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js 22 LTS and restart this window.
  pause
  exit /b 1
)
where firebase >nul 2>nul
if errorlevel 1 (
  echo Installing Firebase CLI...
  call npm install -g firebase-tools
  if errorlevel 1 goto fail
)
echo.
echo [1/5] Sign in to Firebase in your browser.
call firebase login
if errorlevel 1 goto fail
echo.
echo [2/5] Select project csu-order-system-af6bb.
call firebase use csu-order-system-af6bb
if errorlevel 1 goto fail
echo.
echo [3/5] Install Cloud Function dependencies.
pushd functions
call npm install
if errorlevel 1 (popd & goto fail)
popd
echo.
echo [4/5] Enter administrator credentials into Firebase Secret Manager.
echo The following commands prompt you for values. Enter your existing admin username first, then its password.
echo Do NOT paste these credentials into GitHub or this chat.
call firebase functions:secrets:set ADMIN_USERNAME
if errorlevel 1 goto fail
call firebase functions:secrets:set ADMIN_PASSWORD
if errorlevel 1 goto fail
echo.
echo [5/5] Deploy Firebase Functions and security rules.
call firebase deploy --only functions,firestore:rules,storage
if errorlevel 1 goto fail
echo.
echo SUCCESS: Firebase deployment command finished.
echo If the output lists Function URLs, check adminLogin and publicBookingApi are deployed.
echo Then reopen https://hofong159.github.io/csu-arch-order-gpt/
pause
exit /b 0
:fail
echo.
echo [FAILED] Deployment did not complete. Keep this window open and send me the red error text (hide any secrets).
pause
exit /b 1
