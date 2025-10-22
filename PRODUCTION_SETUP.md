# Gazetteer Social Media App - Production Setup Guide

## 🚀 Complete Backend + Frontend Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## 📊 Database Setup

1. **Install PostgreSQL**
   ```bash
   # Windows (using Chocolatey)
   choco install postgresql
   
   # macOS (using Homebrew)
   brew install postgresql
   
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   ```

2. **Create Database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE gazetteer;
   CREATE USER gazetteer_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE gazetteer TO gazetteer_user;
   \q
   ```

3. **Run Database Schema**
   ```bash
   # From project root
   psql -U gazetteer_user -d gazetteer -f database_schema.sql
   ```

## 🔧 Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp env.example .env
   # Edit .env with your database credentials
   ```

3. **Start Backend Server**
   ```bash
   npm run dev
   # Server runs on http://localhost:3000
   ```

## 🎨 Frontend Setup

1. **Install Dependencies**
   ```bash
   # From project root
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp env.example .env
   # Edit .env with API URL
   ```

3. **Start Frontend**
   ```bash
   npm run dev
   # App runs on http://localhost:5173
   ```

## 🔄 Migration from Mock to Real API

### Option 1: Gradual Migration (Recommended)
1. Keep existing mock API as fallback
2. Add environment variable to switch between mock and real API
3. Test with real database
4. Remove mock API when ready

### Option 2: Complete Switch
1. Replace all imports in components
2. Update API calls to use new client
3. Test thoroughly

## 📱 Production Deployment

### Backend (Vercel/Railway/Heroku)
```bash
# Build backend
cd backend
npm run build

# Deploy to your platform
# Update CORS_ORIGIN in environment variables
```

### Frontend (Vercel/Netlify)
```bash
# Build frontend
npm run build

# Deploy to your platform
# Update VITE_API_URL to production backend URL
```

### Database (Supabase/Neon/Railway)
1. Create PostgreSQL database
2. Run schema migration
3. Update DATABASE_URL in backend environment

## 🔐 Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@host:port/db
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
JWT_SECRET=your_super_secret_key
UPLOAD_DIR=uploads
```

### Frontend (.env)
```
VITE_API_URL=https://your-backend-domain.com/api
VITE_APP_NAME=Gazetteer
```

## 🧪 Testing

1. **Test Database Connection**
   ```bash
   cd backend
   npm run db:migrate
   ```

2. **Test API Endpoints**
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Register user
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"test","email":"test@example.com","password":"password123","displayName":"Test User","handle":"testuser"}'
   ```

3. **Test Frontend**
   - Open http://localhost:5173
   - Register new account
   - Create posts, comments, replies
   - Test all features

## 🚨 Troubleshooting

### Database Issues
- Check PostgreSQL is running
- Verify connection string
- Check user permissions

### API Issues
- Check CORS settings
- Verify JWT secret
- Check file upload permissions

### Frontend Issues
- Check API URL configuration
- Verify environment variables
- Check browser console for errors

## 📈 Performance Optimization

1. **Database Indexes** - Already included in schema
2. **API Rate Limiting** - Configured in backend
3. **File Upload Limits** - Set in environment
4. **Caching** - Implement Redis for production
5. **CDN** - Use CloudFront/CloudFlare for static assets

## 🔒 Security Checklist

- [ ] Strong JWT secret
- [ ] HTTPS in production
- [ ] Rate limiting enabled
- [ ] File upload validation
- [ ] SQL injection protection (parameterized queries)
- [ ] CORS properly configured
- [ ] Environment variables secured

## 📊 Monitoring

1. **Backend Logs** - Monitor server logs
2. **Database Performance** - Monitor query performance
3. **Error Tracking** - Integrate Sentry
4. **Analytics** - Add Google Analytics

Your app is now production-ready! 🎉
