/**
 * Clips App - React Native
 * Social media app with live streaming
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

// Import screens
import FeedScreen from './src/screens/FeedScreen';
import BoostScreen from './src/screens/BoostScreen';
import ClipScreen from './src/screens/ClipScreen';
import SearchScreen from './src/screens/SearchScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LiveStreamScreen from './src/screens/LiveStreamScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import LoginScreen from './src/screens/LoginScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import StoriesScreen from './src/screens/StoriesScreen';
import ViewProfileScreen from './src/screens/ViewProfileScreen';
import CreateScreen from './src/screens/CreateScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import InboxScreen from './src/screens/InboxScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Boost') {
            iconName = focused ? 'flash' : 'flash-outline';
          } else if (route.name === 'Clip') {
            iconName = focused ? 'camera' : 'camera-outline';
          } else if (route.name === 'Live') {
            iconName = focused ? 'radio' : 'radio-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          borderTopColor: isDarkMode ? '#374151' : '#E5E7EB',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={FeedScreen}
        options={{ title: 'Clips' }}
      />
      <Tab.Screen
        name="Boost"
        component={BoostScreen}
        options={{ title: 'Boost' }}
      />
      <Tab.Screen
        name="Clip"
        component={ClipScreen}
        options={{ title: 'Clip+' }}
      />
      <Tab.Screen
        name="Live"
        component={LiveStreamScreen}
        options={{ title: 'Live' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#030712' },
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen 
            name="Discover" 
            component={DiscoverScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
          />
          <Stack.Screen 
            name="PostDetail" 
            component={PostDetailScreen}
          />
          <Stack.Screen 
            name="Stories" 
            component={StoriesScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen 
            name="ViewProfile" 
            component={ViewProfileScreen}
          />
          <Stack.Screen 
            name="Create" 
            component={CreateScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen 
            name="Messages" 
            component={MessagesScreen}
          />
          <Stack.Screen 
            name="Inbox" 
            component={InboxScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;