@echo off
echo Starting the Finance Planner server...

REM Navigate to the project directory
cd /d "C:\Users\BUDDHILASIRI\finance-planner"

REM Start the Node.js server
start cmd /k "node app.js"

REM Wait a few seconds to let the server start
timeout /t 5 /nobreak >nul

REM Open the front-end in the default browser
start http://localhost:4000

exit
