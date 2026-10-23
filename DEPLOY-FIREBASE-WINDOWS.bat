@echo off
setlocal
cd /d "%~dp0"
title CSU Order System - Firebase Setup
echo ================================================
echo CSU Order System - Firebase backend deployment
echo Students do NOT need to sign in.
echo Admin credentials are stored as Firebase Secrets.
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Install Node.js 22 LTS first: https://nodejs.org/
  goto fail
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js 22 LTS and reopen this window.
  goto fail
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
echo At the prompts, enter the existing admin username, then password.
echo Do NOT paste credentials into GitHub or this chat.
call firebase functions:secrets:set ADMIN_USERNAME
if errorlevel 1 goto fail
call firebase functions:secrets:set ADMIN_PASSWORD
if errorlevel 1 goto fail
echo.
echo [5/5] Deploy Firebase Functions and security rules.
call firebase deploy --only functions,firestore:rules,storage
if errorlevel 1 goto fail
echo.
echo ================================================
echo DEPLOY COMMAND COMPLETED. Review messages above.
echo Look for URLs for adminLogin and publicBookingApi.
echo The command window will remain open for inspection.
echo ================================================
goto keepopen
:fail
echo.
echo [FAILED] A command returned an error. Read the messages above.
echo Please screenshot the error text, but hide passwords or secrets.
:keepopen
echo.
echo The console will remain open. Type EXIT when you want to close it.
cmd /k
