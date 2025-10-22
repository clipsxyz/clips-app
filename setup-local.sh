#!/bin/bash

# Gazetteer Local Development Setup Script
echo "🚀 Setting up Gazetteer for local development with real database..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first:"
    echo "   Windows: choco install postgresql"
    echo "   macOS: brew install postgresql"
    echo "   Ubuntu: sudo apt install postgresql postgresql-contrib"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create database if it doesn't exist
echo "📊 Setting up database..."
psql -U postgres -c "CREATE DATABASE gazetteer;" 2>/dev/null || echo "Database already exists"
psql -U postgres -c "CREATE USER gazetteer_user WITH PASSWORD 'gazetteer123';" 2>/dev/null || echo "User already exists"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE gazetteer TO gazetteer_user;" 2>/dev/null || echo "Privileges already granted"

# Run database schema
echo "📋 Running database schema..."
psql -U gazetteer_user -d gazetteer -f database_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database schema applied successfully"
else
    echo "❌ Failed to apply database schema"
    exit 1
fi

# Setup backend
echo "🔧 Setting up backend..."
cd backend

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating backend .env file..."
    cat > .env << EOF
DATABASE_URL=postgresql://gazetteer_user:gazetteer123@localhost:5432/gazetteer
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your_super_secret_jwt_key_for_development_only
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,video/mp4,video/webm
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    echo "✅ Backend .env created"
else
    echo "✅ Backend .env already exists"
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

cd ..

# Setup frontend
echo "🎨 Setting up frontend..."

# Create frontend .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating frontend .env file..."
    cat > .env << EOF
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=Gazetteer
VITE_APP_VERSION=1.0.0
VITE_ENABLE_OFFLINE=true
VITE_ENABLE_PWA=true
VITE_DEV_MODE=true
EOF
    echo "✅ Frontend .env created"
else
    echo "✅ Frontend .env already exists"
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

echo ""
echo "🎉 Setup complete! Your app is ready to run with a real database."
echo ""
echo "To start the application:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Start frontend: npm run dev"
echo ""
echo "The app will be available at:"
echo "  Frontend: http://localhost:5173"
echo "  Backend API: http://localhost:3000"
echo ""
echo "Database credentials:"
echo "  Database: gazetteer"
echo "  User: gazetteer_user"
echo "  Password: gazetteer123"
echo ""
echo "Happy coding! 🚀"
