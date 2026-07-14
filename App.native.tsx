/**
 * Clips App - React Native
 * Social media app with live streaming
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/Auth';
import { getUnreadTotal } from './src/api/messages';
import { getUnreadNotificationCount } from './src/api/notifications';
import { navigateMainTab } from './src/navigation/mainTabs';
import MainTabBar from './src/components/MainTabBar.native';

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
import { GAZETTEER_ABYSS } from './src/theme/gazetteerAmbientNative';
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
import ClipPollScreen from './src/screens/ClipPollScreen';
import ScenesScreen from './src/screens/ScenesScreen';
import { initializeNotifications, teardownNotifications } from './src/services/notifications';
import { hydrateAuthTokenFromStorage } from './src/utils/authTokenBridge';
import UploadProgressToast from './src/components/UploadProgressToast.native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

type ErrorBoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('App render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0b0711', padding: 20, paddingTop: 48 }}>
          <Text style={{ color: '#f87171', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            App failed to load
          </Text>
          <ScrollView>
            <Text style={{ color: '#e5e7eb', fontSize: 13, fontFamily: 'monospace' }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
const navigationRef = createNavigationContainerRef();

const TAB_BAR_STYLE = {
  backgroundColor: '#030712',
  borderTopColor: 'rgba(255, 255, 255, 0.1)',
  borderTopWidth: 1,
} as const;

type FeedHomeBoundaryState = { error: Error | null; retryKey: number };

/** Catches Home feed crashes so the tab shows an error instead of a blank screen. */
class FeedHomeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  FeedHomeBoundaryState
> {
  state: FeedHomeBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<FeedHomeBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Home feed render error:', error);
  }

  private retry = () => {
    this.setState((prev) => ({ error: null, retryKey: prev.retryKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0b0711', padding: 20, paddingTop: 48 }}>
          <Text style={{ color: '#f87171', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Home feed failed
          </Text>
          <Pressable
            onPress={this.retry}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#7c3aed',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Reload feed</Text>
          </Pressable>
          <ScrollView>
            <Text style={{ color: '#e5e7eb', fontSize: 13 }}>{this.state.error.message}</Text>
          </ScrollView>
        </View>
      );
    }
    return (
      <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>
    );
  }
}

/** Home uses FeedScreen.tsx (same as web feed logic); wrapped for render-error visibility. */
function HomeTabScreen(props: React.ComponentProps<typeof FeedScreen>) {
  return (
    <View style={styles.homeTabRoot}>
      <FeedHomeErrorBoundary>
        <FeedScreen {...props} />
      </FeedHomeErrorBoundary>
    </View>
  );
}

function CreateTabPlaceholder() {
  return <View style={styles.createTabPlaceholder} />;
}

function MainTabs() {
  const { user } = useAuth();
  const [inboxBadgeCount, setInboxBadgeCount] = useState(0);

  useEffect(() => {
    if (!user?.handle) {
      setInboxBadgeCount(0);
      return;
    }
    let mounted = true;
    const refresh = async () => {
      try {
        const [notificationUnread, messageUnread] = await Promise.all([
          getUnreadNotificationCount(user.handle).catch(() => 0),
          getUnreadTotal(user.handle).catch(() => 0),
        ]);
        if (mounted) setInboxBadgeCount(Math.max(0, notificationUnread + messageUnread));
      } catch {
        if (mounted) setInboxBadgeCount(0);
      }
    };
    void refresh();
    const interval = setInterval(refresh, 12000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user?.handle]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        sceneContainerStyle: { backgroundColor: GAZETTEER_ABYSS },
        lazy: true,
      }}
      tabBar={(props) => (
        <MainTabBar
          {...props}
          inboxBadgeCount={inboxBadgeCount}
          onCreatePress={() => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('InstantCreate' as never);
            }
          }}
        />
      )}
    >
      <Tab.Screen name="Home" component={HomeTabScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Boost" component={BoostScreen} options={{ title: 'Boost' }} />
      <Tab.Screen
        name="Create"
        component={CreateTabPlaceholder}
        options={{ title: 'Create' }}
      />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ title: 'Inbox' }} />
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
    void hydrateAuthTokenFromStorage();
  }, []);

  React.useEffect(() => {
    initializeNotifications({ onNotificationPress: handleNotificationPress }).catch((error) => {
      console.warn('Native notification initialization failed:', error);
    });
    return () => teardownNotifications();
  }, [handleNotificationPress]);

  return (
    <AppErrorBoundary>
    <GestureHandlerRootView style={styles.appRoot}>
    <AuthProvider>
      <BottomSheetModalProvider>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <UploadProgressToast />
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: GAZETTEER_ABYSS },
            }}
          >
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Discover" component={DiscoverScreen} />
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
          <Stack.Screen
            name="Scenes"
            component={ScenesScreen as React.ComponentType}
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
            options={{ presentation: 'fullScreenModal' }}
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
          <Stack.Screen
            name="ClipPoll"
            component={ClipPollScreen}
            options={{ presentation: 'modal' }}
          />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
      </BottomSheetModalProvider>
    </AuthProvider>
    </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: '#030712',
  },
  homeTabRoot: {
    flex: 1,
    backgroundColor: '#030712',
    overflow: 'hidden',
  },
  createTabPlaceholder: {
    flex: 1,
    backgroundColor: GAZETTEER_ABYSS,
  },
});

export default App;
