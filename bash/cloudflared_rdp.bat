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

:: Check if cloudflared.exe exists in PATH
where cloudflared.exe >nul 2>nul

:: Check the result of the where command
if %errorlevel% == 0 (
    :: If found, run the command
    echo cloudflared.exe found, running command...
    :: On Windows, port 3389 may already be consumed locally. Changed it to port 3390
    cloudflared.exe access rdp --hostname [your_hostname] --url rdp://localhost:3390
) else (
    :: If not found, show a message box
    echo cloudflared.exe not found
    msg * "cloudflared.exe not found on this system."
)
