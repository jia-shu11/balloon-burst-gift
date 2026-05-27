@ECHO OFF
SETLOCAL

SET "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
IF NOT EXIST "%NODE_EXE%" (
  SET "NODE_EXE=node"
)

SET "NPM_CLI_JS=%USERPROFILE%\.npm-local\bin\npm-cli.js"
IF NOT EXIST "%NPM_CLI_JS%" (
  SET "NPM_CLI_JS=%ProgramFiles%\nodejs\node_modules\npm\bin\npm-cli.js"
)

SET "PATH=%ProgramFiles%\nodejs;%PATH%"
"%NODE_EXE%" "%NPM_CLI_JS%" %*
