@echo off
setlocal enabledelayedexpansion

:: =============================================================================
:: Pawn Shop CSV Sync Service - Complete Management Console
:: =============================================================================

:main_menu
cls
echo.
echo ========================================
echo   CSV Sync Service Management Console
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Display current Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%

:: Check service status
call :check_service_status

echo.
echo Select an option:
echo.
echo [1]  Install Dependencies and Setup
echo [2]  Start Service (Development Mode)
echo [3]  Install as Windows Service
echo [4]  Uninstall Windows Service
echo [5]  Reset Service State
echo [6]  Test CSV Processing
echo [7]  View Service Logs
echo [8]  Create/Edit .env Configuration
echo [9]  Validate Configuration
echo [A]  Open Web Dashboard
echo [B]  View Service Status
echo [C]  Monitor Live Logs
echo [D]  Configure Startup Settings
echo [0]  Exit
echo.

set /p choice="Enter your choice: "

if /i "%choice%"=="1" goto install_deps
if /i "%choice%"=="2" goto start_dev
if /i "%choice%"=="3" goto install_service
if /i "%choice%"=="4" goto uninstall_service
if /i "%choice%"=="5" goto reset_state
if /i "%choice%"=="6" goto test_csv
if /i "%choice%"=="7" goto view_logs
if /i "%choice%"=="8" goto create_env
if /i "%choice%"=="9" goto validate_config
if /i "%choice%"=="a" goto open_dashboard
if /i "%choice%"=="b" goto service_status
if /i "%choice%"=="c" goto monitor_logs
if /i "%choice%"=="d" goto startup_settings
if /i "%choice%"=="0" goto exit_script

echo Invalid choice. Please try again.
pause
goto main_menu

:: =============================================================================
:: Check Service Status
:: =============================================================================
:check_service_status
sc query "pawnshopcsvsync.exe" >nul 2>&1
if errorlevel 1 (
    set SERVICE_STATUS=Not Installed
) else (
    for /f "tokens=3" %%i in ('sc query "pawnshopcsvsync.exe" ^| find "STATE"') do set SERVICE_STATE=%%i
    if "!SERVICE_STATE!"=="RUNNING" (
        set SERVICE_STATUS=Running
    ) else (
        set SERVICE_STATUS=Installed but Stopped
    )
)
echo Service Status: %SERVICE_STATUS%
goto :eof

:: =============================================================================
:: Install Dependencies ^& Setup
:: =============================================================================
:install_deps
cls
echo.
echo [INFO] Installing NPM dependencies...
echo.

if not exist "package.json" (
    echo [ERROR] package.json not found. Are you in the correct directory?
    pause
    goto main_menu
)

npm install

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    goto main_menu
)

echo.
echo [SUCCESS] Dependencies installed successfully!
echo.

:: Check if .env exists
if not exist ".env" (
    echo [INFO] .env file not found. Creating template...
    call :create_env_template
    echo [WARNING] Please configure your .env file with Supabase credentials.
    echo.
    set /p edit_env="Would you like to edit the .env file now? (y/N): "
    if /i "!edit_env!"=="y" (
        notepad .env
    )
)

:: Create logs directory
if not exist "logs" (
    mkdir logs
    echo [INFO] Created logs directory
)

echo.
echo [SUCCESS] Setup completed successfully!
echo.
echo Next steps:
echo 1. Configure your .env file with Supabase credentials
echo 2. Run option [9] to validate your configuration
echo 3. Run option [2] to start in development mode or [3] to install as Windows service
echo.
pause
goto main_menu

:: =============================================================================
:: Start Development Mode
:: =============================================================================
:start_dev
cls
echo.
echo [INFO] Starting CSV Sync Service in development mode...
echo Press Ctrl+C to stop the service
echo.

if not exist ".env" (
    echo [ERROR] .env file not found. Please run option [8] to create and configure it.
    pause
    goto main_menu
)

echo Starting service...
node csv-sync-service.js

echo.
echo Service stopped.
pause
goto main_menu

:: =============================================================================
:: Install as Windows Service
:: =============================================================================
:install_service
cls
echo.
echo [INFO] Installing CSV Sync Service as Windows Service...
echo.

:: Check if running as administrator
net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] This operation requires administrator privileges.
    echo Please run this batch file as Administrator.
    pause
    goto main_menu
)

if not exist ".env" (
    echo [ERROR] .env file not found!
    echo.
    echo The service requires a .env configuration file to run.
    echo Please choose an option:
    echo.
    echo [1] Press any key to go to Configuration Menu (Option 8)
    echo [2] Manually copy .env.example to .env and edit it
    echo [3] Return to main menu
    echo.
    pause
    goto create_env
)

node install-service.js

if errorlevel 1 (
    echo [ERROR] Failed to install Windows service
    pause
    goto main_menu
)

echo.
echo [SUCCESS] Service installed successfully!
echo.
echo Service Details:
echo Service name: pawnshopcsvsync.exe
echo You can manage it through:
echo - Windows Services (services.msc)
echo - Command line: sc start "pawnshopcsvsync.exe"
echo - This management console (option [B])
echo.
pause
goto main_menu

:: =============================================================================
:: Uninstall Windows Service
:: =============================================================================
:uninstall_service
cls
echo.
echo [WARNING] Uninstalling CSV Sync Service from Windows Services...
echo.

:: Check if running as administrator
net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] This operation requires administrator privileges.
    echo Please run this batch file as Administrator.
    pause
    goto main_menu
)

set /p confirm="Are you sure you want to uninstall the service? (y/N): "
if /i not "%confirm%"=="y" (
    echo Operation cancelled.
    pause
    goto main_menu
)

sc stop "pawnshopcsvsync.exe" 2>nul
sc delete "pawnshopcsvsync.exe"

if errorlevel 1 (
    echo [WARNING] Service may not have been installed or already removed
) else (
    echo [SUCCESS] Service uninstalled successfully!
)

echo.
pause
goto main_menu

:: =============================================================================
:: Reset Service State
:: =============================================================================
:reset_state
cls
echo.
echo [WARNING] Reset Service State
echo.
echo This will clear all processed row tracking data.
echo The service will treat all existing CSV rows as new on next startup.
echo.
set /p confirm="Are you sure? (y/N): "

if /i not "%confirm%"=="y" (
    echo Operation cancelled.
    pause
    goto main_menu
)

if exist ".csv-sync-state.json" (
    del ".csv-sync-state.json"
    echo [SUCCESS] Service state reset successfully!
) else (
    echo [INFO] No state file found - service is already in fresh state
)

echo.
pause
goto main_menu

:: =============================================================================
:: Test CSV Processing
:: =============================================================================
:test_csv
cls
echo.
echo [INFO] Testing CSV processing...
echo.

if not exist "test-scanner-data.csv" (
    echo [ERROR] test-scanner-data.csv not found
    echo Please ensure the test file exists in the current directory
    pause
    goto main_menu
)

if not exist ".env" (
    echo [ERROR] .env file not found. Please configure your environment first.
    pause
    goto main_menu
)

echo Running test with sample data...
npm run test-csv

pause
goto main_menu

:: =============================================================================
:: View Service Logs
:: =============================================================================
:view_logs
cls
echo.
echo [INFO] Service Logs
echo.

if exist "logs\csv-sync.log" (
    echo Last 50 lines of the log file:
    echo ================================
    powershell -command "Get-Content 'logs\csv-sync.log' -Tail 50"
) else (
    echo [INFO] No log file found. Service may not have been started yet.
)

echo.
pause
goto main_menu

:: =============================================================================
:: Monitor Live Logs
:: =============================================================================
:monitor_logs
cls
echo.
echo [INFO] Live Log Monitor
echo Press Ctrl+C to stop monitoring...
echo.

if not exist "logs\csv-sync.log" (
    echo [INFO] No log file found. Waiting for logs...
)

powershell -command "Get-Content 'logs\csv-sync.log' -Wait -Tail 10"

pause
goto main_menu

:: =============================================================================
:: Create/Edit .env Configuration
:: =============================================================================
:create_env
cls
echo.
echo [INFO] Environment Configuration
echo.

if exist ".env" (
    echo .env file already exists.
    set /p edit_choice="Would you like to [E]dit existing or [R]ecreate from template? (E/R): "
    if /i "!edit_choice!"=="r" (
        del ".env"
        if exist ".env.example" (
            copy ".env.example" ".env" >nul
            echo [SUCCESS] .env created from .env.example template!
        ) else (
            call :create_env_template
            echo [SUCCESS] New .env template created!
        )
    )
    notepad .env
) else (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [SUCCESS] .env created from .env.example template!
    ) else (
        call :create_env_template
        echo [SUCCESS] .env template created!
    )
    notepad .env
)

echo.
echo [INFO] Please save and close the .env file when finished editing.
pause
goto main_menu

:create_env_template
echo # Environment Configuration> ".env"
echo # Copy from .env.example and fill in your actual values>> ".env"
echo.>> ".env"
echo # Supabase Configuration>> ".env"
echo SUPABASE_URL=your_supabase_project_url>> ".env"
echo SUPABASE_ANON_KEY=your_supabase_anon_key>> ".env"
echo SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key>> ".env"
echo.>> ".env"
echo # CSV File Configuration>> ".env"
echo CSV_FILE_PATH=C:\Users\Ved\Desktop\projects\chokidar\test-scanner-data.csv>> ".env"
echo CSV_POLLING_INTERVAL=1000>> ".env"
echo.>> ".env"
echo # Service Configuration>> ".env"
echo SERVICE_NAME=PawnShopCSVSync>> ".env"
echo SERVICE_DISPLAY_NAME=Pawn Shop CSV Sync Service>> ".env"
echo SERVICE_DESCRIPTION=Monitors CSV file from ID scanner and syncs customer data to Supabase>> ".env"
echo.>> ".env"
echo # Logging Configuration>> ".env"
echo LOG_LEVEL=info>> ".env"
echo LOG_FILE_PATH=C:\PawnShop\logs\csv-sync.log>> ".env"
echo.>> ".env"
echo # Processing Configuration>> ".env"
echo BATCH_SIZE=50>> ".env"
echo RETRY_ATTEMPTS=3>> ".env"
echo RETRY_DELAY=5000>> ".env"
echo.>> ".env"
echo # Customer Data Configuration>> ".env"
echo DEFAULT_COUNTRY=USA>> ".env"
echo REQUIRE_DRIVERS_LICENSE=false>> ".env"
goto :eof

:: =============================================================================
:: Validate Configuration
:: =============================================================================
:validate_config
cls
echo.
echo [INFO] Validating configuration...
echo.

if not exist ".env" (
    echo [ERROR] .env file not found
    echo Please run option [8] to create .env template
    pause
    goto main_menu
)

if not exist "package.json" (
    echo [ERROR] package.json not found
    echo Please ensure you're in the correct directory
    pause
    goto main_menu
)

if not exist "csv-sync-service.js" (
    echo [ERROR] csv-sync-service.js not found
    echo Please ensure all service files are present
    pause
    goto main_menu
)

echo Running validation...
npm run validate

pause
goto main_menu

:: =============================================================================
:: Open Web Dashboard
:: =============================================================================
:open_dashboard
cls
echo.
echo [INFO] Opening Web Dashboard
echo.

if exist "web-dashboard.html" (
    echo Opening dashboard in default browser...
    start web-dashboard.html
    echo.
    echo [SUCCESS] Dashboard opened!
    echo Make sure to configure the Supabase credentials in the HTML file.
) else (
    echo [ERROR] web-dashboard.html not found
    echo Please ensure the dashboard file exists
)

echo.
pause
goto main_menu

:: =============================================================================
:: Service Status Details
:: =============================================================================
:service_status
cls
echo.
echo [INFO] Detailed Service Status
echo.

sc query "pawnshopcsvsync.exe" 2>nul
if errorlevel 1 (
    echo [INFO] Service is not installed
) else (
    echo [INFO] Service is installed
    sc query "pawnshopcsvsync.exe"
)

echo.
echo File Status:
if exist ".csv-sync-state.json" (
    echo [SUCCESS] State file exists
    for %%i in (.csv-sync-state.json) do echo    Size: %%~zi bytes, Modified: %%~ti
) else (
    echo [INFO] No state file (fresh service)
)

if exist "logs\csv-sync.log" (
    echo [SUCCESS] Log file exists
    for %%i in (logs\csv-sync.log) do echo    Size: %%~zi bytes, Modified: %%~ti
) else (
    echo [INFO] No log file
)

echo.
pause
goto main_menu

:: =============================================================================
:: Configure Startup Settings
:: =============================================================================
:startup_settings
cls
echo.
echo [INFO] Service Startup Configuration
echo.

sc query "pawnshopcsvsync.exe" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Service is not installed
    echo Please install the service first using option [3]
    pause
    goto main_menu
)

echo Current service configuration:
echo ================================
sc qc "pawnshopcsvsync.exe"

echo.
echo Startup Type Options:
echo [1] Automatic - Start with Windows (Recommended)
echo [2] Automatic (Delayed) - Start after other services
echo [3] Manual - Start only when requested
echo [4] Disabled - Prevent service from starting
echo [0] Back to main menu
echo.

set /p startup_choice="Select startup type (0-4): "

if "%startup_choice%"=="1" goto set_automatic
if "%startup_choice%"=="2" goto set_delayed
if "%startup_choice%"=="3" goto set_manual
if "%startup_choice%"=="4" goto set_disabled
if "%startup_choice%"=="0" goto main_menu

echo Invalid choice.
pause
goto startup_settings

:set_automatic
echo.
echo [INFO] Setting service to start automatically with Windows...
sc config "pawnshopcsvsync.exe" start= auto
if errorlevel 1 (
    echo [ERROR] Failed to configure startup
) else (
    echo [SUCCESS] Service set to Automatic startup
    echo The service will start automatically when Windows boots
)
pause
goto startup_settings

:set_delayed
echo.
echo [INFO] Setting service to delayed automatic startup...
sc config "pawnshopcsvsync.exe" start= delayed-auto
if errorlevel 1 (
    echo [ERROR] Failed to configure startup
) else (
    echo [SUCCESS] Service set to Delayed Automatic startup
    echo The service will start after other services during boot
)
pause
goto startup_settings

:set_manual
echo.
echo [INFO] Setting service to manual startup...
sc config "pawnshopcsvsync.exe" start= demand
if errorlevel 1 (
    echo [ERROR] Failed to configure startup
) else (
    echo [SUCCESS] Service set to Manual startup
    echo The service will only start when manually requested
)
pause
goto startup_settings

:set_disabled
echo.
echo [WARNING] This will disable the service completely
set /p confirm="Are you sure? (y/N): "
if /i not "%confirm%"=="y" (
    echo Operation cancelled.
    pause
    goto startup_settings
)

sc config "pawnshopcsvsync.exe" start= disabled
if errorlevel 1 (
    echo [ERROR] Failed to configure startup
) else (
    echo [SUCCESS] Service disabled
    echo The service will not start automatically or manually
)
pause
goto startup_settings

:: =============================================================================
:: Exit Script
:: =============================================================================
:exit_script
cls
echo.
echo Thank you for using CSV Sync Service Management Console!
echo.
timeout /t 2 >nul
exit /b 0
