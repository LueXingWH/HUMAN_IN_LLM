@echo off
rem skip if already running
tasklist /FI "IMAGENAME eq chatapi.exe" 2>NUL | find /I "chatapi.exe" >NUL
if %errorlevel%==0 (
    echo [ChatAPI] already running, skip.
    exit /b 0
)
cd /d "%~dp0backend"
if not exist "%~dp0.tools\tmp" mkdir "%~dp0.tools\tmp"
set "TMP=%~dp0.tools\tmp"
set "TEMP=%~dp0.tools\tmp"
set "TMPDIR=%~dp0.tools\tmp"
"..\build\chatapi.exe"
