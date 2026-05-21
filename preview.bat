@echo off
:: Credit Card Value Tracker — Local Preview
:: Starts a local HTTP server so the app loads correctly (file:// blocks JS imports).
:: Run this from the creditcardroi folder, or double-click it.

set PORT=8787

echo Starting local preview at http://localhost:%PORT%/app-pro.html
echo Press Ctrl+C to stop.
echo.

:: Open browser after 1 second delay
start "" /b cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:%PORT%/app-pro.html"

:: Start server (blocks until Ctrl+C)
python -m http.server %PORT%
