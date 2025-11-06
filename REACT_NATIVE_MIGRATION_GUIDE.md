# React Native Migration Guide

## Overview

This guide outlines the migration from React (web-only) to React Native with React Native Web, enabling a single codebase for iOS, Android, and Web platforms.

## Current Status

✅ **Completed:**
- React Native and React Native Web installed
- React Navigation installed
- NativeWind (Tailwind for React Native) configured
- Platform-specific entry points created
- Configuration files updated (Babel, Tailwind, TypeScript)

⏳ **In Progress:**
- Component migration from HTML to React Native
- React Router → React Navigation migration
- Web-specific APIs → React Native APIs

## Architecture

### Entry Points

- **Web:** `src/main.tsx` (Vite)
- **iOS/Android:** `index.js` (Metro bundler)
- **Main App:** `App.tsx` (shared across platforms)

### Key Dependencies

- `react-native` - Core React Native
- `react-native-web` - Web compatibility layer
- `@react-navigation/native` - Navigation
- `nativewind` - Tailwind CSS for React Native
- `react-native-screens` - Native screen management
- `react-native-safe-area-context` - Safe area handling

## Migration Patterns

### 1. HTML Elements → React Native Components

| HTML Element | React Native Component | Notes |
|-------------|------------------------|-------|
| `<div>` | `<View>` | Container component |
| `<button>` | `<TouchableOpacity>` or `<Pressable>` | Interactive buttons |
| `<p>`, `<span>`, `<h1>` | `<Text>` | All text content |
| `<img>` | `<Image>` | Images |
| `<input>` | `<TextInput>` | Text inputs |
| `<video>` | `<Video>` (from `react-native-video`) | Video playback |
| `<a>` | `<TouchableOpacity>` + Navigation | Links |

### 2. Styling Changes

**Before (Tailwind CSS):**
```tsx
<div className="flex items-center justify-center p-4 bg-white">
  <button className="px-4 py-2 bg-blue-500 text-white rounded">
    Click me
  </button>
</div>
```

**After (NativeWind - same syntax works!):**
```tsx
import { View, Text, TouchableOpacity } from 'react-native';

<View className="flex items-center justify-center p-4 bg-white">
  <TouchableOpacity className="px-4 py-2 bg-blue-500 rounded">
    <Text className="text-white">Click me</Text>
  </TouchableOpacity>
</View>
```

**Key Differences:**
- Text must be wrapped in `<Text>` component
- Buttons need `<Text>` inside for labels
- Some CSS properties may need adjustments

### 3. Navigation Migration

**Before (React Router):**
```tsx
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

<BrowserRouter>
  <Routes>
    <Route path="/feed" element={<FeedPage />} />
    <Route path="/profile" element={<ProfilePage />} />
  </Routes>
</BrowserRouter>

// Navigation
const navigate = useNavigate();
navigate('/feed');
```

**After (React Navigation):**
```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

const Stack = createNativeStackNavigator();

<NavigationContainer>
  <Stack.Navigator>
    <Stack.Screen name="Feed" component={FeedPage} />
    <Stack.Screen name="Profile" component={ProfilePage} />
  </Stack.Navigator>
</NavigationContainer>

// Navigation
const navigation = useNavigation();
navigation.navigate('Feed');
```

### 4. Event Handlers

**Before:**
```tsx
<button onClick={handleClick}>Click</button>
<div onTouchEnd={handleTouch}>Touch</div>
```

**After:**
```tsx
<TouchableOpacity onPress={handleClick}>
  <Text>Click</Text>
</TouchableOpacity>
<TouchableOpacity onPress={handleTouch}>
  <Text>Touch</Text>
</TouchableOpacity>
```

**Note:** React Native uses `onPress` for both click and touch events.

### 5. Platform-Specific Code

```tsx
import { Platform } from 'react-native';

// Platform detection
if (Platform.OS === 'web') {
  // Web-specific code
} else if (Platform.OS === 'ios') {
  // iOS-specific code
} else if (Platform.OS === 'android') {
  // Android-specific code
}

// Platform-specific styles
const styles = {
  container: {
    ...Platform.select({
      ios: { paddingTop: 20 },
      android: { paddingTop: 10 },
      web: { paddingTop: 0 },
    }),
  },
};
```

### 6. Images

**Before:**
```tsx
<img src={imageUrl} alt="Description" />
```

**After:**
```tsx
import { Image } from 'react-native';

<Image 
  source={{ uri: imageUrl }} 
  style={{ width: 100, height: 100 }}
  resizeMode="cover"
/>
```

### 7. Forms and Inputs

**Before:**
```tsx
<input 
  type="text" 
  value={value} 
  onChange={(e) => setValue(e.target.value)} 
/>
```

**After:**
```tsx
import { TextInput } from 'react-native';

<TextInput
  value={value}
  onChangeText={setValue}
  style={{ borderWidth: 1, padding: 10 }}
/>
```

## Step-by-Step Migration Plan

### Phase 1: Core App Structure ✅ (In Progress)

1. ✅ Install React Native dependencies
2. ✅ Set up NativeWind
3. ✅ Create platform entry points
4. ⏳ Convert `App.tsx` to React Native
5. ⏳ Set up React Navigation structure

### Phase 2: Navigation & Routing

1. Replace React Router with React Navigation
2. Convert route definitions
3. Update navigation calls throughout app
4. Test navigation on all platforms

### Phase 3: Core Components

1. Convert `Root.tsx` → Navigation container
2. Convert `BottomNav` → Tab navigator
3. Convert `TopBar` → Header component
4. Convert `Avatar` component
5. Convert `CreateModal` component

### Phase 4: Pages

Convert each page component:

1. **FeedPage** (`src/pages/FeedPage.tsx` or `src/App.tsx`)
   - Replace HTML elements
   - Update event handlers
   - Test video/image rendering

2. **ProfilePage**
   - Convert layout
   - Update navigation

3. **SearchPage**
   - Convert search input
   - Update results display

4. **CreatePage**
   - Convert form elements
   - Update file uploads

5. **MessagesPage**
   - Convert chat interface
   - Update message list

6. **StoriesPage**
   - Convert story viewer
   - Update navigation

7. **DiscoverPage**
   - Convert layout
   - Update animations

8. **LoginPage**
   - Convert form
   - Update authentication flow

### Phase 5: Components

Convert all components in `src/components/`:

1. `CommentsModal.tsx`
2. `ScenesModal.tsx`
3. `ShareModal.tsx`
4. `LiveStreamInterface.tsx` (may need platform-specific handling)
5. `Flag.tsx`
6. `SimpleApp.tsx`

### Phase 6: Utilities & Hooks

1. Update API client for React Native fetch
2. Convert hooks if needed
3. Update storage utilities
4. Test platform-specific features

### Phase 7: Testing & Platform-Specific Fixes

1. Test on web
2. Test on iOS simulator
3. Test on Android emulator
4. Fix platform-specific issues
5. Optimize performance

## Common Issues & Solutions

### Issue 1: Text Not Rendering

**Problem:** Text doesn't appear
**Solution:** All text must be wrapped in `<Text>` component

```tsx
// ❌ Wrong
<View>Hello</View>

// ✅ Correct
<View>
  <Text>Hello</Text>
</View>
```

### Issue 2: Buttons Not Working

**Problem:** Button clicks not registering
**Solution:** Use `TouchableOpacity` or `Pressable` with `onPress`

```tsx
// ❌ Wrong
<button onClick={handleClick}>Click</button>

// ✅ Correct
<TouchableOpacity onPress={handleClick}>
  <Text>Click</Text>
</TouchableOpacity>
```

### Issue 3: Styling Not Applied

**Problem:** Tailwind classes not working
**Solution:** Ensure NativeWind is configured and `global.css` is imported

### Issue 4: Navigation Not Working

**Problem:** Navigation calls fail
**Solution:** Ensure NavigationContainer wraps app and navigation is properly typed

### Issue 5: Images Not Loading

**Problem:** Images don't display
**Solution:** Use `Image` component with `source` prop

```tsx
// ❌ Wrong
<img src={url} />

// ✅ Correct
<Image source={{ uri: url }} style={{ width: 100, height: 100 }} />
```

## Platform-Specific Considerations

### Web

- Use `react-native-web` for compatibility
- Some web-specific features may need conditional rendering
- Test in browsers (Chrome, Firefox, Safari)

### iOS

- Test on iOS simulator
- Handle safe areas
- Test on different iOS versions
- Handle iOS-specific permissions

### Android

- Test on Android emulator
- Handle Android back button
- Test on different Android versions
- Handle Android-specific permissions

## Testing Strategy

1. **Unit Tests:** Test individual components
2. **Integration Tests:** Test navigation flows
3. **Platform Tests:** Test on each platform
4. **E2E Tests:** Test complete user flows

## Dependencies to Install

Some components may need additional dependencies:

```bash
# Video playback
npm install react-native-video --legacy-peer-deps

# Icons (if not using react-icons)
npm install react-native-vector-icons --legacy-peer-deps

# Image picker
npm install react-native-image-picker --legacy-peer-deps

# Camera
npm install react-native-camera --legacy-peer-deps

# File system
npm install react-native-fs --legacy-peer-deps

# Async storage
npm install @react-native-async-storage/async-storage --legacy-peer-deps
```

## Next Steps

1. Start with `App.tsx` - convert to React Native structure
2. Set up React Navigation
3. Convert one page at a time
4. Test after each conversion
5. Fix platform-specific issues as they arise

## Resources

- [React Native Docs](https://reactnative.dev/)
- [React Native Web Docs](https://necolas.github.io/react-native-web/)
- [React Navigation Docs](https://reactnavigation.org/)
- [NativeWind Docs](https://www.nativewind.dev/)

## Notes

- NativeWind allows using Tailwind classes directly (same syntax!)
- Most styling will work the same way
- Main changes are HTML → React Native components
- Navigation is the biggest change
- Test frequently on all platforms

