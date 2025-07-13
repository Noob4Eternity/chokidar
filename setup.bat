@echo off
echo ========================================
echo    Pawn Shop CSV Sync Service Setup
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected: 
node --version

echo.
echo 📋 Setup Checklist:
echo.

REM Check if .env file exists
if exist ".env" (
    echo ✅ Environment file (.env) exists
) else (
    echo ❌ Environment file (.env) missing
    echo    Please copy .env.example to .env and configure your settings
    copy ".env.example" ".env" >nul 2>&1
    if exist ".env" (
        echo ✅ Created .env file from template
        echo    Please edit .env file with your Supabase credentials
    )
)

echo.
echo 🔍 Checking dependencies...
if exist "node_modules" (
    echo ✅ Dependencies installed
) else (
    echo 📦 Installing dependencies...
    npm install
    if %ERRORLEVEL% equ 0 (
        echo ✅ Dependencies installed successfully
    ) else (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo 🗄️  Database Setup:
echo    Make sure your Supabase project has a 'customers_testing' table
echo    with the required fields for customer data (see README.md)
echo    Get your project URL and service role key from Supabase dashboard
echo    Update the .env file with your credentials

echo.
echo 📁 CSV File Setup:
echo    The service will monitor the CSV file specified in CSV_FILE_PATH
echo    Default location: scanner_data.csv in this directory
echo    Make sure your ID scanner outputs to this location

echo.
echo 🧪 Testing:
echo    Run 'npm test' to test the service before installing
echo    Run 'npm run install-service' to install as Windows service

echo.
echo 📊 Web Dashboard:
echo    Edit web-dashboard.html and update the Supabase configuration
echo    Open the file in a web browser to view real-time customer data

echo.
echo 🎯 Next Steps:
echo    1. Configure .env file with your Supabase credentials
echo    2. Ensure your database has the 'customers_testing' table  
echo    3. Test the service: npm test
echo    4. Install as service: npm run install-service
echo    5. Open web-dashboard.html to view customer data

echo.
echo Setup complete! Check README.md for detailed instructions.
echo.
pause
