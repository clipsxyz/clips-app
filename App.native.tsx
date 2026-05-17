/**
 * Clips App - React Native
 * Social media app with live streaming
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/Auth';
import Icon from 'react-native-vector-icons/Ionicons';
import { getUnreadTotal } from './src/api/messages';
import { navigateMainTab } from './src/navigation/mainTabs';

// Import screens
import FeedScreen from './src/screens/FeedScreen';
import BoostScreen from './src/screens/BoostScreen';
import SearchScreen from './src/screens/SearchScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ProfileCoverScreen from './src/screens/ProfileCoverScreen';
import LiveStreamScreen from './src/screens/LiveStreamScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import LoginScreen from './src/screens/LoginScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import StoriesScreen from './src/screens/StoriesScreen';
import ViewProfileScreen from './src/screens/ViewProfileScreen';
import CreateScreen from './src/screens/CreateScreen';
import InstantCreateScreen from './src/screens/InstantCreateScreen';
import GalleryPreviewScreen from './src/screens/GalleryPreviewScreen';
import InstantFiltersScreen from './src/screens/InstantFiltersScreen';
import TextOnlyCreateScreen from './src/screens/TextOnlyCreateScreen';
import TextOnlyPostDetailsScreen from './src/screens/TextOnlyPostDetailsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import InboxScreen from './src/screens/InboxScreen';
import CollectionFeedScreen from './src/screens/CollectionFeedScreen';
import ContentPreferencesScreen from './src/screens/ContentPreferencesScreen';
import VideoPlaybackSettingsScreen from './src/screens/VideoPlaybackSettingsScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import PaymentSuccessScreen from './src/screens/PaymentSuccessScreen';
import SplashScreen from './src/screens/SplashScreen';
import LandingScreen from './src/screens/LandingScreen';
import TermsScreen from './src/screens/TermsScreen';
import PublicPostScreen from './src/screens/PublicPostScreen';
import ClipScreen from './src/screens/ClipScreen';
import { initializeNotifications, teardownNotifications } from './src/services/notifications';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const TAB_BAR_STYLE = {
  backgroundColor: 'rgba(11, 7, 17, 0.94)',
  borderTopColor: 'rgba(255, 255, 255, 0.1)',
  borderTopWidth: 1,
} as const;

function MainTabs() {
  const { user } = useAuth();
  const [inboxUnread, setInboxUnread] = useState(0);

  useEffect(() => {
    if (!user?.handle) {
      setInboxUnread(0);
      return;
    }
    let mounted = true;
    const refresh = async () => {
      try {
        const total = await getUnreadTotal(user.handle);
        if (mounted) setInboxUnread(total);
      } catch {
        // ignore polling errors
      }
    };
    void refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user?.handle]);

  const inboxBadge =
    inboxUnread > 0 ? (inboxUnread > 99 ? '99+' : inboxUnread) : undefined;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Discover') {
            iconName = focused ? 'compass' : 'compass-outline';
          } else if (route.name === 'Create') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Inbox') {
            iconName = focused ? 'chatbox-ellipses' : 'chatbox-ellipses-outline';
          } else {
            iconName = 'ellipse-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#f472b6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: TAB_BAR_STYLE,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={FeedScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: 'Discover' }} />
      <Tab.Screen name="Create" component={InstantCreateScreen} options={{ title: 'Create' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: 'Inbox',
          tabBarBadge: inboxBadge,
          tabBarBadgeStyle: { backgroundColor: '#EF4444', fontSize: 10 },
        }}
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

    navigateMainTab(nav, 'Inbox', { initialTab: 'notifications' });
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
              contentStyle: { backgroundColor: '#0b0711' },
            }}
          >
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="ProfileCover" component={ProfileCoverScreen} />
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
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} />
          <Stack.Screen
            name="Stories"
            component={StoriesScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="ViewProfile" component={ViewProfileScreen} />
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
            name="InstantFilters"
            component={InstantFiltersScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="TextOnlyCreate"
            component={TextOnlyCreateScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="TextOnlyPostDetails"
            component={TextOnlyPostDetailsScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="CollectionFeed" component={CollectionFeedScreen} />
          <Stack.Screen
            name="ContentPreferences"
            component={ContentPreferencesScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="VideoPlaybackSettings"
            component={VideoPlaybackSettingsScreen}
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
          <Stack.Screen name="Clip" component={ClipScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AuthProvider>
  );
}

export default App;
