@ECHO OFF
SETLOCAL
PUSHD "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1" %*
SET "EXIT_CODE=%ERRORLEVEL%"
IF NOT "%EXIT_CODE%"=="0" (
  ECHO.
  ECHO Balloon Burst Gift failed to start. Error code: %EXIT_CODE%
)
ECHO.
ECHO Press any key to close this window.
PAUSE >NUL
POPD
EXIT /B %EXIT_CODE%
