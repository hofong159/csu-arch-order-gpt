@echo off
setlocal
cd /d "%~dp0"
title CSU Order System - Firestore Rules Check
echo ================================================
echo CSU Order System - FREE PLAN - NO BILLING CHANGE
echo Your Firebase Console screenshot already shows the default Firestore database.
echo This script will NOT create a database or deploy anything.
echo It only checks whether this CLI login can see the database.
echo ================================================
echo.
where firebase >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Firebase CLI is not installed.
  echo Install it with: npm install -g firebase-tools
  goto keepopen
)
echo [1/2] Current CLI accounts:
call firebase login:list
echo.
echo [2/2] Read-only database list for csu-order-system-af6bb:
call firebase firestore:databases:list --project csu-order-system-af6bb
echo.
echo If the list shows (default), the CLI can see the existing database.
echo If it fails or does not show (default), the active CLI Google account may not have access to the database.
echo Do NOT run a database create command and do NOT upgrade billing.
echo.
echo Opening the Firestore Rules editor and the corrected rules source.
start "" "https://console.firebase.google.com/project/csu-order-system-af6bb/firestore/databases/-default-/rules"
start "" "https://raw.githubusercontent.com/hofong159/csu-arch-order-gpt/main/firestore.rules"
echo In the Rules editor, replace all current rules with the code from the raw source page, then Publish.
echo This direct Console method does not require Firebase CLI deployment.
echo ================================================
:keepopen
echo.
echo The console remains open. Type EXIT to close.
cmd /k
