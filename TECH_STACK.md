# Tech Stack Overview - Clips App (Gazetteer)

## 🏗️ Architecture

**Type:** Full-Stack Social Media Application  
**Pattern:** Hybrid Web/Mobile (React Native + Web)  
**Deployment:** Multi-platform (Web, iOS, Android)

---

## 🎨 Frontend Stack

### Core Framework
- **React 18.2.0** - UI library
- **TypeScript 5.0.2** - Type safety
- **Vite 7.3.1** - Build tool & dev server
- **React Router DOM 6.8.1** - Client-side routing

### UI & Styling
- **Tailwind CSS 3.3.0** - Utility-first CSS framework
- **Framer Motion 12.23.24** - Animation library
- **React Icons 4.12.0** - Icon library
- **NativeWind 4.2.1** - Tailwind for React Native

### State Management & Data
- **React Context API** - Global state (Auth, Theme)
- **IndexedDB (idb-keyval 6.2.1)** - Offline storage
- **Custom Hooks** - Reusable logic

### Media & Video Processing
- **FFmpeg.wasm (@ffmpeg/ffmpeg 0.12.15)** - Video processing in browser
- **@ffmpeg/core 0.12.10** - FFmpeg core library
- **@ffmpeg/util 0.12.2** - FFmpeg utilities
- **MediaPipe Face Mesh 0.4.1633559619** - Face detection/tracking
- **@mediapipe/camera_utils** - Camera utilities
- **@mediapipe/drawing_utils** - Drawing utilities

### Real-time & Communication
- **Socket.io Client 4.8.1** - WebSocket communication
- **WebRTC (react-native-webrtc 124.0.7)** - Peer-to-peer video/audio

### Mobile Support (React Native)
- **React Native 0.76.9** - Mobile framework
- **React Native Web 0.19.13** - Web compatibility
- **@react-navigation/native 7.1.19** - Navigation
- **@react-navigation/bottom-tabs 7.8.2** - Tab navigation
- **@react-navigation/native-stack 7.6.2** - Stack navigation
- **React Native Reanimated 4.1.3** - Animations
- **React Native Gesture Handler 2.29.1** - Gestures
- **React Native Safe Area Context 5.6.2** - Safe areas
- **React Native Screens 4.18.0** - Screen management
- **React Native Image Crop Picker 0.40.0** - Image selection
- **React Native Linear Gradient 2.8.3** - Gradients
- **React Native Vector Icons 10.3.0** - Icons

### Drag & Drop
- **@dnd-kit/core 6.3.1** - Drag and drop core
- **@dnd-kit/sortable 10.0.0** - Sortable lists
- **@dnd-kit/utilities 3.2.2** - Utilities

### Audio
- **Tone.js 15.1.22** - Web audio framework

### Utilities
- **QRCode 1.5.4** - QR code generation
- **SweetAlert2 11.26.3** - Beautiful alerts
- **Web Vitals 3.5.0** - Performance monitoring

### Error Tracking
- **Sentry React 7.100.0** - Error monitoring

---

## 🔧 Backend Stack

### Core Framework
- **Laravel 10.10** - PHP framework
- **PHP 8.1+** - Server language

### Authentication & Security
- **Laravel Sanctum 3.2** - API authentication
- **CSRF Protection** - Built-in Laravel
- **Encrypted Cookies** - Secure sessions

### Database & ORM
- **Doctrine DBAL 3.10** - Database abstraction
- **Laravel Eloquent ORM** - Built-in ORM
- **Database Migrations** - Schema management

### Caching & Sessions
- **Redis (Predis 2.0)** - Caching & sessions
- **Laravel Cache** - Cache abstraction

### HTTP Client
- **Guzzle HTTP 7.2** - HTTP requests

### Development Tools
- **Laravel Tinker 2.8** - REPL
- **Laravel Sail 1.18** - Docker environment
- **Laravel Pint 1.0** - Code formatting

### Testing
- **PHPUnit 10.1** - Unit testing
- **Mockery 1.4.4** - Mocking
- **Faker 1.9.1** - Test data generation

### Error Handling
- **Spatie Laravel Ignition 2.0** - Error pages
- **Nuno Maduro Collision 7.0** - Error handler

---

## 🛠️ Development Tools

### Build & Bundling
- **Vite 7.3.1** - Fast build tool
- **esbuild 0.27.2** - JavaScript bundler
- **PostCSS 8.4.24** - CSS processing
- **Autoprefixer 10.4.14** - CSS vendor prefixes

### Code Quality
- **ESLint 8.45.0** - JavaScript linting
- **TypeScript ESLint 6.0.0** - TypeScript linting
- **React Hooks ESLint Plugin** - Hooks linting
- **Size Limit 10.0.0** - Bundle size monitoring

### Testing
- **Vitest 0.34.0** - Unit testing (Vite-native)
- **Testing Library React 13.4.0** - React testing
- **Testing Library Jest DOM 5.16.5** - DOM matchers
- **Testing Library User Event 14.4.3** - User interaction testing
- **jsdom 22.1.0** - DOM environment

### SSL/HTTPS
- **@vitejs/plugin-basic-ssl 2.1.3** - HTTPS support (currently disabled)

---

## 📁 Project Structure

```
clips-app/
├── src/
│   ├── api/              # API client functions
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route/page components
│   ├── screens/          # React Native screens
│   ├── context/          # React Context providers
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── services/         # Service layer
│   ├── theme/            # Theme configuration
│   └── types.ts          # TypeScript definitions
├── laravel-backend/
│   ├── app/
│   │   ├── Http/Controllers/Api/  # API controllers
│   │   ├── Models/                # Eloquent models
│   │   ├── Jobs/                  # Background jobs
│   │   └── Middleware/            # Custom middleware
│   ├── database/          # Migrations, seeders
│   └── routes/           # API routes
└── public/               # Static assets
```

---

## 🔌 API Architecture

### Backend API (Laravel)
- **RESTful API** - REST endpoints
- **Laravel Sanctum** - Token-based auth
- **API Controllers:**
  - AuthController
  - PostController
  - UserController
  - MessageController
  - StoryController
  - CollectionController
  - MusicController
  - LocationController
  - SearchController
  - NotificationController
  - UploadController

### Frontend API Client
- **Custom API client** (`src/api/client.ts`)
- **Type-safe API functions** for each resource
- **Error handling** & retry logic

---

## 🎯 Key Features

### Media Processing
- Video editing & filters
- Image processing
- Audio mixing
- Face detection & tracking
- Real-time video effects

### Social Features
- Posts & Stories
- Comments & Reactions
- Direct Messaging
- User Profiles
- Collections
- Search & Discovery
- Notifications

### Real-time
- Live Streaming (WebRTC)
- Real-time messaging (Socket.io)
- Live notifications

### Offline Support
- IndexedDB caching
- Offline action queue
- Sync on reconnect

---

## 🌐 Deployment & Infrastructure

### Development
- **Local Development:** Vite dev server (port 5173)
- **Backend:** Laravel artisan serve (port 8000)
- **Network Access:** 0.0.0.0 binding for mobile testing

### Build
- **Production Build:** `npm run build` (Vite)
- **Bundle Optimization:** Code splitting, tree shaking
- **Size Limits:** Monitored with size-limit

### Platforms
- **Web:** React + Vite
- **iOS:** React Native
- **Android:** React Native

---

## 📊 Performance

### Optimization
- **Code Splitting** - Lazy-loaded routes
- **Memoization** - React.memo, useMemo
- **Bundle Size Monitoring** - Size-limit
- **Image Optimization** - Lazy loading, progressive
- **Cache Headers** - Custom cache control

### Monitoring
- **Web Vitals** - Performance metrics
- **Sentry** - Error tracking
- **Bundle Analysis** - Size monitoring

---

## 🔐 Security

### Frontend
- **HTTPS Support** (configurable)
- **CSRF Protection** (via Laravel)
- **Secure Cookies** (via backend)

### Backend
- **Laravel Sanctum** - API authentication
- **CSRF Protection** - Built-in middleware
- **SQL Injection Protection** - Eloquent ORM
- **XSS Protection** - Blade templating
- **Encrypted Sessions** - Secure storage

---

## 📦 Package Management

- **npm** - Frontend dependencies
- **Composer** - Backend dependencies
- **Node.js 24.9.0** - Runtime
- **PHP 8.1+** - Backend runtime

---

## 🚀 Scripts

### Frontend
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run clean:cache` - Clear Vite cache

### Backend
- `php artisan serve` - Start dev server
- `php artisan migrate` - Run migrations
- `php artisan tinker` - REPL console

---

## 🔄 Data Flow

1. **User Action** → React Component
2. **API Call** → Frontend API client (`src/api/`)
3. **HTTP Request** → Laravel Backend (port 8000)
4. **Controller** → Processes request
5. **Model** → Database interaction
6. **Response** → JSON API response
7. **State Update** → React Context/State
8. **UI Update** → Component re-render

---

## 📱 Mobile Support

### React Native Integration
- Shared codebase with web
- Platform-specific components
- Native navigation
- Native gestures & animations
- Native image picker
- WebRTC for video/audio

### Build Targets
- iOS (via Xcode)
- Android (via Gradle)

---

## 🎨 UI/UX Features

- Dark mode support
- Responsive design
- Mobile-first approach
- Smooth animations (Framer Motion)
- Drag & drop interfaces
- Progressive image loading
- Toast notifications
- Modal dialogs
- Bottom sheets

---

## 📝 Notes

- **Hybrid Architecture:** Supports both web and mobile from single codebase
- **Offline-First:** IndexedDB for offline functionality
- **Real-time:** Socket.io for live features
- **Media-Rich:** FFmpeg for video processing
- **Type-Safe:** Full TypeScript coverage
- **Modern Stack:** Latest versions of React, Laravel, Vite

---

*Last Updated: January 2026*
