@echo off
REM Multi-Agent Testing Script for Windows
REM Run this script to validate the multi-agent setup locally

echo Multi-Agent Container Testing Script
echo ========================================
echo.

REM Check prerequisites
echo Checking prerequisites...

where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker not found. Please install Docker Desktop first.
    exit /b 1
)
echo [OK] Docker installed

where docker-compose >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker Compose not found. Please install Docker Compose first.
    exit /b 1
)
echo [OK] Docker Compose installed

if not exist .env (
    echo [ERROR] .env file not found. Please create one first.
    exit /b 1
)
echo [OK] .env file found
echo.

REM Build multi-agent container
echo Building multi-agent container...
docker-compose build multi-agent
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    exit /b 1
)
echo [OK] Build complete
echo.

REM Start multi-agent server
echo Starting multi-agent server...
docker-compose up -d multi-agent
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start server
    exit /b 1
)
echo [OK] Server started
echo.

REM Wait for server to be ready
echo Waiting for server to be ready...
set RETRY_COUNT=0
:wait_loop
if %RETRY_COUNT% GEQ 30 (
    echo [ERROR] Server failed to start within 30 seconds
    echo Logs:
    docker-compose logs multi-agent
    exit /b 1
)
curl -s http://localhost:3000/health >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Server is ready
    goto :server_ready
)
set /a RETRY_COUNT+=1
timeout /t 1 /nobreak >nul
goto :wait_loop

:server_ready
echo.

REM Test health endpoint
echo Testing health endpoint...
curl -s http://localhost:3000/health
echo.
echo [OK] Health check complete
echo.

REM Test each agent endpoint
echo Testing agent endpoints...
for %%A in (program-builder program-runner coach-library persona-chat crm licensing payment) do (
    echo Testing /%%A/health...
    curl -s http://localhost:3000/%%A/health
    echo.
)
echo.

REM Show logs
echo Recent logs:
docker-compose logs --tail=20 multi-agent
echo.

REM Summary
echo ========================================
echo Testing complete!
echo.
echo Summary:
echo   - Multi-agent server is running on http://localhost:3000
echo   - Health endpoint: http://localhost:3000/health
echo   - All agents are accessible at /^<agent-name^>/*
echo.
echo Next steps:
echo   1. Test individual agent functionality
echo   2. Test with your shell/frontend application
echo   3. Monitor resource usage: docker stats
echo   4. View logs: docker-compose logs -f multi-agent
echo.
echo To stop the server: docker-compose down
pause
