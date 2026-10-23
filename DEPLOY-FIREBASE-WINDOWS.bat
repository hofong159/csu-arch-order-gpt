@echo off
setlocal
cd /d "%~dp0"
title CSU Order System - Free Firebase Rules Setup
echo ================================================
echo CSU Order System - Spark plan, no billing required
echo Uses Firebase Authentication and Cloud Firestore only.
echo Students do NOT need an account.
echo No Cloud Functions, Secret Manager or Cloud Storage deployment.
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (echo [ERROR] Install Node.js first: https://nodejs.org/ & goto fail)
where npm >nul 2>nul
if errorlevel 1 (echo [ERROR] npm was not found. Reinstall Node.js & goto fail)
where firebase >nul 2>nul
if errorlevel 1 (
 echo Installing Firebase CLI...
 call npm install -g firebase-tools
 if errorlevel 1 goto fail
)
echo.
echo [1/3] Log in to Firebase (if already logged in, this will reuse your session).
call firebase login
if errorlevel 1 goto fail
echo.
echo [2/3] Select project csu-order-system-af6bb.
call firebase use csu-order-system-af6bb
if errorlevel 1 goto fail
echo.
echo [3/3] Deploy Firestore security rules only. This does NOT require Blaze billing.
echo IMPORTANT: If this reports it is creating Firestore database (default),
echo stop here and create the (default) Standard database in Firebase Console first.
echo Do not upgrade billing. See README.md for exact Console steps.
call firebase deploy --only firestore:rules
if errorlevel 1 goto fail
echo.
echo ================================================
echo SUCCESS: Firestore rules deployed.
echo Check Firebase Authentication > Sign-in method > Email/Password is enabled.
echo Initial admin email in this project: hofong159@gmail.com
echo Open the website and sign in using that email and its Firebase password.
echo ================================================
goto keepopen
:fail
echo.
echo [FAILED] Review the error above. No billing upgrade was attempted.
:keepopen
echo.
echo The console remains open. Type EXIT to close.
cmd /k
