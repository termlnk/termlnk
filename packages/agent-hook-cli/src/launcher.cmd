@echo off
REM Termlnk agent hook launcher (auto-installed; do not edit manually).
REM Forwards hook invocations to the bundled Node helper.

setlocal

set "HELPER=%~dp0hook-helper.js"
if not exist "%HELPER%" (
  echo {}
  exit /b 0
)

set "NODE_BIN=%TERMLNK_HOOK_NODE%"
if "%NODE_BIN%"=="" set "NODE_BIN=node"

"%NODE_BIN%" "%HELPER%" %*
exit /b %errorlevel%
