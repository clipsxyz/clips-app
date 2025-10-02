# Newsfeed App

A React-based social media feed with offline capabilities, dark mode, and real-time interactions.

## Features

- 📱 **Mobile-first design** with responsive layout
- 🌙 **Dark mode** with system preference detection
- 🔄 **Offline support** with cached feeds and queued actions
- ⚡ **Real-time interactions** (like, bookmark, follow)
- 🎨 **Modern UI** with Tailwind CSS
- 🔐 **Mock authentication** with persistent sessions
- 📊 **Performance optimized** with lazy loading and memoization

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **IndexedDB** (via idb-keyval) for offline storage
- **React Icons** for UI icons

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run test:run` - Run tests once

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Route components
├── context/        # React context providers
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
├── api/            # Mock API functions
├── data/           # Static data files
└── types.ts        # TypeScript type definitions
```

## Features in Detail

### Offline Support
- Feed pages are cached in IndexedDB
- User actions (like, bookmark, follow) are queued when offline
- Actions automatically sync when connection is restored
- Offline indicator shows current connection status

### Dark Mode
- Toggle between light and dark themes
- Respects system preference on first visit
- Persistent across browser sessions

### Performance
- Lazy-loaded routes for code splitting
- Memoized components to prevent unnecessary re-renders
- Optimized images with lazy loading
- Bundle size monitoring with size-limit

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:run`
5. Submit a pull request

## License

MIT

