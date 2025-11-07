# React Native Migration Checklist

## Setup ✅

- [x] Install React Native
- [x] Install React Native Web
- [x] Install React Navigation
- [x] Install NativeWind
- [x] Configure Babel
- [x] Configure Tailwind
- [x] Configure TypeScript
- [x] Create platform entry points
- [x] Update package.json scripts

## Core App Structure

- [ ] Convert `App.tsx` to React Native
- [ ] Set up React Navigation container
- [ ] Create navigation structure
- [ ] Test app loads on web
- [ ] Test app loads on iOS
- [ ] Test app loads on Android

## Navigation

- [ ] Replace React Router with React Navigation
- [ ] Convert route definitions
- [ ] Update all `navigate()` calls
- [ ] Update all `useNavigate()` hooks
- [ ] Update all `Link` components
- [ ] Test navigation flows

## Components to Convert

### Core Components
- [ ] `Root.tsx` → Navigation container
- [ ] `BottomNav` → Tab navigator
- [ ] `TopBar` → Header component
- [ ] `Avatar.tsx`
- [ ] `CreateModal.tsx`
- [ ] `CommentsModal.tsx`
- [ ] `ScenesModal.tsx`
- [ ] `ShareModal.tsx`
- [ ] `LiveStreamInterface.tsx`
- [ ] `Flag.tsx`
- [ ] `SimpleApp.tsx`

### Pages
- [ ] `FeedPage` (in `App.tsx`)
- [ ] `ProfilePage.tsx`
- [ ] `SearchPage.tsx`
- [ ] `CreatePage.tsx`
- [ ] `MessagesPage.tsx`
- [ ] `InboxPage.tsx`
- [ ] `StoriesPage.tsx`
- [ ] `DiscoverPage.tsx`
- [ ] `LoginPage.tsx`
- [ ] `SplashPage.tsx`
- [ ] `ClipPage.tsx`
- [ ] `ViewProfilePage.tsx`
- [ ] `InstantCreatePage.tsx`
- [ ] `InstantFiltersPage.tsx`

## HTML → React Native Conversions

### Elements
- [ ] All `<div>` → `<View>`
- [ ] All `<button>` → `<TouchableOpacity>` or `<Pressable>`
- [ ] All `<p>`, `<span>`, `<h1>` → `<Text>`
- [ ] All `<img>` → `<Image>`
- [ ] All `<input>` → `<TextInput>`
- [ ] All `<video>` → `<Video>` component
- [ ] All `<a>` → Navigation + `<TouchableOpacity>`

### Events
- [ ] All `onClick` → `onPress`
- [ ] All `onTouchEnd` → `onPress`
- [ ] All `onChange` → `onChangeText` (for inputs)
- [ ] All `onSubmit` → `onSubmitEditing`

### Styling
- [ ] Verify NativeWind classes work
- [ ] Fix any incompatible CSS properties
- [ ] Test dark mode
- [ ] Test responsive layouts

## API & Data

- [ ] Update API client for React Native fetch
- [ ] Test API calls on all platforms
- [ ] Update storage utilities
- [ ] Test offline functionality

## Platform-Specific

### Web
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Fix web-specific issues

### iOS
- [ ] Test on iOS simulator
- [ ] Handle safe areas
- [ ] Test permissions
- [ ] Fix iOS-specific issues

### Android
- [ ] Test on Android emulator
- [ ] Handle back button
- [ ] Test permissions
- [ ] Fix Android-specific issues

## Features to Test

- [ ] Authentication flow
- [ ] Feed scrolling
- [ ] Post creation
- [ ] Image/video upload
- [ ] Comments
- [ ] Messages
- [ ] Stories
- [ ] Search
- [ ] Profile viewing
- [ ] Navigation between screens

## Dependencies to Install

- [ ] `react-native-video` (for video playback)
- [ ] `react-native-image-picker` (for image selection)
- [ ] `@react-native-async-storage/async-storage` (for storage)
- [ ] `react-native-vector-icons` (if needed for icons)
- [ ] Any other platform-specific dependencies

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing on web
- [ ] Manual testing on iOS
- [ ] Manual testing on Android

## Documentation

- [ ] Update README
- [ ] Document platform-specific setup
- [ ] Document build process
- [ ] Document deployment

## Performance

- [ ] Optimize bundle size
- [ ] Optimize images
- [ ] Optimize navigation
- [ ] Test performance on all platforms

## Final Checklist

- [ ] App works on web
- [ ] App works on iOS
- [ ] App works on Android
- [ ] All features functional
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Ready for production


