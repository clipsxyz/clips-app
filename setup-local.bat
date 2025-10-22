@echo off
REM Gazetteer Local Development Setup Script for Windows

echo 🚀 Setting up Gazetteer for local development with real database...

REM Check if PostgreSQL is installed
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL is not installed. Please install PostgreSQL first:
    echo    Windows: choco install postgresql
    echo    Or download from: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Create database if it doesn't exist
echo 📊 Setting up database...
psql -U postgres -c "CREATE DATABASE gazetteer;" 2>nul || echo Database already exists
psql -U postgres -c "CREATE USER gazetteer_user WITH PASSWORD 'gazetteer123';" 2>nul || echo User already exists
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE gazetteer TO gazetteer_user;" 2>nul || echo Privileges already granted

REM Run database schema
echo 📋 Running database schema...
psql -U gazetteer_user -d gazetteer -f database_schema.sql

if %errorlevel% neq 0 (
    echo ❌ Failed to apply database schema
    pause
    exit /b 1
)

echo ✅ Database schema applied successfully

REM Setup backend
echo 🔧 Setting up backend...
cd backend

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating backend .env file...
    (
        echo DATABASE_URL=postgresql://gazetteer_user:gazetteer123@localhost:5432/gazetteer
        echo PORT=3000
        echo NODE_ENV=development
        echo CORS_ORIGIN=http://localhost:5173
        echo JWT_SECRET=your_super_secret_jwt_key_for_development_only
        echo JWT_EXPIRES_IN=7d
        echo UPLOAD_DIR=uploads
        echo MAX_FILE_SIZE=10485760
        echo ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,video/mp4,video/webm
        echo RATE_LIMIT_WINDOW_MS=900000
        echo RATE_LIMIT_MAX_REQUESTS=100
    ) > .env
    echo ✅ Backend .env created
) else (
    echo ✅ Backend .env already exists
)

REM Install backend dependencies
echo 📦 Installing backend dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)

echo ✅ Backend dependencies installed

cd ..

REM Setup frontend
echo 🎨 Setting up frontend...

REM Create frontend .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating frontend .env file...
    (
        echo VITE_API_URL=http://localhost:3000/api
        echo VITE_APP_NAME=Gazetteer
        echo VITE_APP_VERSION=1.0.0
        echo VITE_ENABLE_OFFLINE=true
        echo VITE_ENABLE_PWA=true
        echo VITE_DEV_MODE=true
    ) > .env
    echo ✅ Frontend .env created
) else (
    echo ✅ Frontend .env already exists
)

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)

echo ✅ Frontend dependencies installed

echo.
echo 🎉 Setup complete! Your app is ready to run with a real database.
echo.
echo To start the application:
echo 1. Start backend: cd backend ^&^& npm run dev
echo 2. Start frontend: npm run dev
echo.
echo The app will be available at:
echo   Frontend: http://localhost:5173
echo   Backend API: http://localhost:3000
echo.
echo Database credentials:
echo   Database: gazetteer
echo   User: gazetteer_user
echo   Password: gazetteer123
echo.
echo Happy coding! 🚀
pause
