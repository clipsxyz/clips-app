/**
 * Clips App - React Native
 * Social media app with live streaming
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

// Import screens
import FeedScreen from './src/screens/FeedScreen';
import BoostScreen from './src/screens/BoostScreen';
import ClipScreen from './src/screens/ClipScreen';
import SearchScreen from './src/screens/SearchScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LiveStreamScreen from './src/screens/LiveStreamScreen';

const Tab = createBottomTabNavigator();

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
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
            headerStyle: {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
            },
            headerTintColor: isDarkMode ? '#FFFFFF' : '#000000',
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
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;