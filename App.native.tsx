/**
 * Clips App - React Native
 * Social media app with live streaming
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/Auth';
import Icon from 'react-native-vector-icons/Ionicons';

// Import screens
import FeedScreen from './src/screens/FeedScreen';
import BoostScreen from './src/screens/BoostScreen';
import SearchScreen from './src/screens/SearchScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LiveStreamScreen from './src/screens/LiveStreamScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import LoginScreen from './src/screens/LoginScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import StoriesScreen from './src/screens/StoriesScreen';
import ViewProfileScreen from './src/screens/ViewProfileScreen';
import CreateScreen from './src/screens/CreateScreen';
import InstantCreateScreen from './src/screens/InstantCreateScreen';
import GalleryPreviewScreen from './src/screens/GalleryPreviewScreen';
import TextOnlyCreateScreen from './src/screens/TextOnlyCreateScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import InboxScreen from './src/screens/InboxScreen';
import CollectionFeedScreen from './src/screens/CollectionFeedScreen';
import ContentPreferencesScreen from './src/screens/ContentPreferencesScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import PaymentSuccessScreen from './src/screens/PaymentSuccessScreen';
import SplashScreen from './src/screens/SplashScreen';
import LandingScreen from './src/screens/LandingScreen';
import TermsScreen from './src/screens/TermsScreen';
import PublicPostScreen from './src/screens/PublicPostScreen';
import ReplyQuestionScreen from './src/screens/ReplyQuestionScreen';
import ClipScreen from './src/screens/ClipScreen';
import { initializeNotifications, teardownNotifications } from './src/services/notifications';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

function MainTabs() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Create') {
            iconName = focused ? 'camera' : 'camera-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Passport') {
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
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Create"
        component={InstantCreateScreen}
        options={{ title: 'Create' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Tab.Screen
        name="Passport"
        component={ProfileScreen}
        options={{ title: 'Passport' }}
      />
    </Tab.Navigator>
  );
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const handleNotificationPress = React.useCallback((data: Record<string, any>) => {
    if (!navigationRef.isReady()) return;
    const nav = navigationRef as any;
    const chatGroupId = data.chatGroupId || data.chat_group_id || data.groupId || data.group_id;
    const fromHandle = data.fromHandle || data.from_handle || data.senderHandle || data.sender_handle;
    const storyId = data.storyId || data.story_id;
    const postId = data.postId || data.post_id;

    if (chatGroupId) {
      nav.navigate('Messages', { chatGroupId, kind: 'group' });
      return;
    }

    if (fromHandle && storyId) {
      nav.navigate('Stories', { openUserHandle: fromHandle, openStoryId: storyId });
      return;
    }

    if (fromHandle) {
      nav.navigate('Messages', { handle: fromHandle });
      return;
    }

    if (postId) {
      nav.navigate('PostDetail', { postId });
      return;
    }

    nav.navigate('Inbox', { initialTab: 'notifications' });
  }, []);

  React.useEffect(() => {
    initializeNotifications({ onNotificationPress: handleNotificationPress }).catch((error) => {
      console.warn('Native notification initialization failed:', error);
    });
    return () => teardownNotifications();
  }, [handleNotificationPress]);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#030712' },
            }}
          >
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen 
            name="Discover" 
            component={DiscoverScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen 
            name="Boost" 
            component={BoostScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen 
            name="Live" 
            component={LiveStreamScreen}
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
            name="CreateComposer" 
            component={CreateScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="InstantCreate"
            component={InstantCreateScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="GalleryPreview"
            component={GalleryPreviewScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="TextOnlyCreate"
            component={TextOnlyCreateScreen}
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
          <Stack.Screen 
            name="CollectionFeed" 
            component={CollectionFeedScreen}
          />
          <Stack.Screen
            name="ContentPreferences"
            component={ContentPreferencesScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="PaymentSuccess"
            component={PaymentSuccessScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Terms" component={TermsScreen} />
          <Stack.Screen name="PublicPost" component={PublicPostScreen} />
          <Stack.Screen name="ReplyQuestion" component={ReplyQuestionScreen} />
          <Stack.Screen name="Clip" component={ClipScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AuthProvider>
  );
}

export default App;