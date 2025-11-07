# Component Conversion Examples

This document provides concrete examples of converting components from React (web) to React Native.

## Example 1: Simple Button

### Before (React Web)
```tsx
function MyButton({ onClick, children }) {
  return (
    <button 
      onClick={onClick}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      {children}
    </button>
  );
}
```

### After (React Native)
```tsx
import { TouchableOpacity, Text } from 'react-native';

function MyButton({ onPress, children }) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      className="px-4 py-2 bg-blue-500 rounded active:bg-blue-600"
    >
      <Text className="text-white">{children}</Text>
    </TouchableOpacity>
  );
}
```

**Key Changes:**
- `<button>` → `<TouchableOpacity>`
- `onClick` → `onPress`
- Text must be wrapped in `<Text>`
- `hover:` → `active:` (for press states)

## Example 2: Card Component

### Before (React Web)
```tsx
function Card({ title, content, onPress }) {
  return (
    <div 
      className="p-4 bg-white rounded-lg shadow-md"
      onClick={onPress}
    >
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-gray-600">{content}</p>
    </div>
  );
}
```

### After (React Native)
```tsx
import { View, Text, TouchableOpacity } from 'react-native';

function Card({ title, content, onPress }) {
  return (
    <TouchableOpacity 
      className="p-4 bg-white rounded-lg shadow-md"
      onPress={onPress}
    >
      <Text className="text-xl font-bold mb-2">{title}</Text>
      <Text className="text-gray-600">{content}</Text>
    </TouchableOpacity>
  );
}
```

**Key Changes:**
- `<div>` → `<TouchableOpacity>` (if interactive) or `<View>` (if not)
- `<h2>`, `<p>` → `<Text>`
- `onClick` → `onPress`

## Example 3: Form Input

### Before (React Web)
```tsx
function MyInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-2 border border-gray-300 rounded"
    />
  );
}
```

### After (React Native)
```tsx
import { TextInput } from 'react-native';

function MyInput({ value, onChangeText, placeholder }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      className="w-full px-4 py-2 border border-gray-300 rounded"
    />
  );
}
```

**Key Changes:**
- `<input>` → `<TextInput>`
- `onChange` → `onChangeText` (receives string directly)
- No `type` prop needed

## Example 4: Image Display

### Before (React Web)
```tsx
function MyImage({ src, alt }) {
  return (
    <img 
      src={src} 
      alt={alt}
      className="w-full h-64 object-cover rounded"
    />
  );
}
```

### After (React Native)
```tsx
import { Image } from 'react-native';

function MyImage({ source, alt }) {
  return (
    <Image 
      source={{ uri: source }}
      className="w-full h-64 rounded"
      resizeMode="cover"
      accessibilityLabel={alt}
    />
  );
}
```

**Key Changes:**
- `<img>` → `<Image>`
- `src` → `source={{ uri: src }}`
- `alt` → `accessibilityLabel`
- `object-cover` → `resizeMode="cover"`

## Example 5: Navigation Link

### Before (React Router)
```tsx
import { Link, useNavigate } from 'react-router-dom';

function MyLink({ to, children }) {
  return <Link to={to}>{children}</Link>;
}

// Or programmatic navigation
function MyComponent() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/profile')}>Go to Profile</button>;
}
```

### After (React Navigation)
```tsx
import { TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

function MyLink({ to, children }) {
  const navigation = useNavigation();
  return (
    <TouchableOpacity onPress={() => navigation.navigate(to)}>
      <Text>{children}</Text>
    </TouchableOpacity>
  );
}

// Or programmatic navigation
function MyComponent() {
  const navigation = useNavigation();
  return (
    <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
      <Text>Go to Profile</Text>
    </TouchableOpacity>
  );
}
```

**Key Changes:**
- `<Link>` → `<TouchableOpacity>` + `navigation.navigate()`
- `useNavigate()` → `useNavigation()`
- Route paths → Screen names

## Example 6: Modal/Dialog

### Before (React Web)
```tsx
function MyModal({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

### After (React Native)
```tsx
import { Modal, View, Text, TouchableOpacity } from 'react-native';

function MyModal({ visible, onClose, children }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 items-center justify-center">
        <View className="bg-white rounded-lg p-6 max-w-md w-full">
          {children}
          <TouchableOpacity onPress={onClose}>
            <Text>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

**Key Changes:**
- Custom modal → `<Modal>` component
- `isOpen` → `visible`
- `fixed` positioning → Modal handles it
- Use `onRequestClose` for Android back button

## Example 7: List/Feed

### Before (React Web)
```tsx
function Feed({ items }) {
  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.id} className="p-4 bg-white rounded">
          <h3>{item.title}</h3>
          <p>{item.content}</p>
        </div>
      ))}
    </div>
  );
}
```

### After (React Native)
```tsx
import { View, Text, FlatList } from 'react-native';

function Feed({ items }) {
  const renderItem = ({ item }) => (
    <View className="p-4 bg-white rounded mb-4">
      <Text className="text-lg font-bold">{item.title}</Text>
      <Text>{item.content}</Text>
    </View>
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
    />
  );
}
```

**Key Changes:**
- Manual mapping → `<FlatList>` (better performance)
- `space-y-4` → `mb-4` on items or `contentContainerStyle`
- Use `keyExtractor` for keys

## Example 8: Conditional Rendering

### Before (React Web)
```tsx
function MyComponent({ isLoading, data }) {
  return (
    <div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div>{data}</div>
      )}
    </div>
  );
}
```

### After (React Native)
```tsx
import { View, Text, ActivityIndicator } from 'react-native';

function MyComponent({ isLoading, data }) {
  return (
    <View>
      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Text>{data}</Text>
      )}
    </View>
  );
}
```

**Key Changes:**
- Custom loading → `<ActivityIndicator>`
- Same conditional rendering pattern works

## Example 9: Scrollable Content

### Before (React Web)
```tsx
function ScrollableContent({ children }) {
  return (
    <div className="overflow-y-auto h-screen">
      {children}
    </div>
  );
}
```

### After (React Native)
```tsx
import { ScrollView } from 'react-native';

function ScrollableContent({ children }) {
  return (
    <ScrollView className="flex-1">
      {children}
    </ScrollView>
  );
}
```

**Key Changes:**
- `overflow-y-auto` → `<ScrollView>`
- `h-screen` → `flex-1` (in flex container)

## Example 10: Video Player

### Before (React Web)
```tsx
function VideoPlayer({ src }) {
  return (
    <video 
      src={src}
      controls
      className="w-full"
    />
  );
}
```

### After (React Native)
```tsx
import Video from 'react-native-video';

function VideoPlayer({ source }) {
  return (
    <Video
      source={{ uri: source }}
      controls
      className="w-full"
      resizeMode="contain"
    />
  );
}
```

**Key Changes:**
- `<video>` → `<Video>` from `react-native-video`
- `src` → `source={{ uri: src }}`
- Additional props like `resizeMode`

## Common Patterns

### Flexbox Layout
```tsx
// Same in both!
<View className="flex-row items-center justify-between">
  <Text>Left</Text>
  <Text>Right</Text>
</View>
```

### Spacing
```tsx
// Same in both!
<View className="p-4 m-2 gap-4">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</View>
```

### Colors
```tsx
// Same in both!
<View className="bg-blue-500 text-white">
  <Text className="text-white">White text</Text>
</View>
```

## Tips

1. **Always wrap text in `<Text>`** - React Native requires it
2. **Use `TouchableOpacity` for buttons** - Better UX than `Pressable`
3. **Use `FlatList` for long lists** - Better performance
4. **Test on all platforms** - Some features may differ
5. **Use platform-specific code when needed** - `Platform.OS` checks


