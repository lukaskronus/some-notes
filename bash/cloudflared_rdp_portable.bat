@echo off

:: Check if the script is running with administrator privileges
openfiles >nul 2>nul
if %errorlevel% neq 0 (
    echo This script requires administrator privileges.
    echo Attempting to restart with administrator privileges...
    :: Relaunch the batch file with elevated privileges
    powershell -Command "Start-Process cmd -ArgumentList '/c %~s0' -Verb runAs"
    exit /b
)

setlocal
:: Get the directory of the current batch script
set "script_dir=%~dp0"

:: Check if cloudflared.exe exists in the script's directory
if exist "%script_dir%cloudflared-windows-amd64.exe" (
    :: Run cloudflared.exe access command
    "%script_dir%cloudflared-windows-amd64.exe" access rdp --hostname [your_hostname] --url rdp://localhost:3390
) else (
    :: Show error message box if cloudflared.exe is not found
    msg * "cloudflared.exe not found on."
)

endlocal
