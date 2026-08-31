/**
 * Clips App - React Native
 * Social media app with live streaming
 */

import React, { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StatusBar, StyleSheet, Text, useColorScheme, View, DeviceEventEmitter } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { rootNavigationRef as navigationRef } from './src/navigation/rootNavigationRef';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/Auth';
import { getUnreadTotal } from './src/api/messages';
import { getUnreadNotificationCount } from './src/api/notifications';
import {
  HomeTabStack,
  BoostTabStack,
  SearchTabStack,
  InboxTabStack,
} from './src/navigation/mainTabStacks.native';
import MainTabBar from './src/components/MainTabBar.native';

// Import screens
import BoostScreen from './src/screens/BoostScreen';
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
import StoryLinkCreateScreen from './src/screens/StoryLinkCreateScreen';
import TextOnlyPostDetailsScreen from './src/screens/TextOnlyPostDetailsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
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
import Story24ComposerScreen from './src/screens/Story24ComposerScreen';
import ScenesScreen from './src/screens/ScenesScreen';
import { initializeNotifications, teardownNotifications } from './src/services/notifications';
import { hydrateAuthTokenFromStorage } from './src/utils/authTokenBridge';
import { schedulePushNotificationNavigation } from './src/utils/pushNotificationNavigationNative';
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

const TAB_BAR_STYLE = {
  backgroundColor: '#030712',
  borderTopColor: 'rgba(255, 255, 255, 0.1)',
  borderTopWidth: 1,
} as const;

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
    const handle = user.handle;
    const refresh = async () => {
      try {
        const [notificationUnread, messageUnread] = await Promise.all([
          getUnreadNotificationCount(handle).catch(() => 0),
          getUnreadTotal(handle).catch(() => 0),
        ]);
        if (mounted) setInboxBadgeCount(Math.max(0, notificationUnread + messageUnread));
      } catch {
        if (mounted) setInboxBadgeCount(0);
      }
    };
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 8000);

    const onInboxUnread = (payload?: { handle?: string; unread?: number }) => {
      if (payload?.handle && payload.handle !== handle) return;
      // Prefer live message unread when provided; still refresh notifications.
      void refresh();
    };
    const onNotificationsChanged = (payload?: { handle?: string }) => {
      if (payload?.handle && payload.handle !== handle) return;
      void refresh();
    };

    const subs = [
      DeviceEventEmitter.addListener('inboxUnreadChanged', onInboxUnread),
      DeviceEventEmitter.addListener('notificationsUpdated', onNotificationsChanged),
      DeviceEventEmitter.addListener('notificationCreated', onNotificationsChanged),
      DeviceEventEmitter.addListener('conversationUpdated', () => {
        void refresh();
      }),
    ];
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      subs.forEach((s) => s.remove());
      appStateSub.remove();
    };
  }, [user?.handle]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        sceneStyle: { backgroundColor: GAZETTEER_ABYSS },
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
      <Tab.Screen name="Home" component={HomeTabStack} options={{ title: 'Home' }} />
      <Tab.Screen
        name="Boost"
        component={BoostTabStack}
        options={{ title: 'Boost', lazy: false }}
      />
      <Tab.Screen
        name="Create"
        component={CreateTabPlaceholder}
        options={{ title: 'Create' }}
      />
      <Tab.Screen name="Search" component={SearchTabStack} options={{ title: 'Search' }} />
      <Tab.Screen
        name="Inbox"
        component={InboxTabStack}
        options={{ title: 'Inbox', lazy: false }}
      />
    </Tab.Navigator>
  );
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const handleNotificationPress = React.useCallback((data: Record<string, any>) => {
    schedulePushNotificationNavigation(() => navigationRef, data || {});
  }, []);

  React.useEffect(() => {
    void hydrateAuthTokenFromStorage();
  }, []);

  React.useEffect(() => {
    initializeNotifications({ onNotificationPress: handleNotificationPress })
      .then(() =>
        import('./src/services/notifications').then((mod) => {
          const register =
            'registerFcmTokenForCurrentUser' in mod
              ? (mod as { registerFcmTokenForCurrentUser?: () => Promise<string | null> })
                  .registerFcmTokenForCurrentUser
              : undefined;
          return register?.();
        }),
      )
      .catch((error) => {
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
            initialRouteName="Splash"
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: GAZETTEER_ABYSS },
            }}
          >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Discover" component={DiscoverScreen} />
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
            options={({ route }) => ({
              presentation: 'fullScreenModal',
              // Story viewer owns horizontal swipe — don't let the stack steal it.
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
              // From Stories 24 rail: no native transition — card morph hands off to fullscreen.
              animation: (route.params as { fromStories24Rail?: boolean } | undefined)
                ?.fromStories24Rail
                ? 'none'
                : 'default',
            })}
          />
          <Stack.Screen
            name="Scenes"
            component={ScenesScreen as React.ComponentType}
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade_from_bottom',
              animationDuration: 200,
              contentStyle: { backgroundColor: '#000000' },
            }}
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
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="StoryLinkCreate"
            component={StoryLinkCreateScreen}
            options={{ presentation: 'fullScreenModal' }}
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
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Terms" component={TermsScreen} />
          <Stack.Screen name="PublicPost" component={PublicPostScreen} />
          <Stack.Screen
            name="Clip"
            component={ClipScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="Story24Composer"
            component={Story24ComposerScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
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
  createTabPlaceholder: {
    flex: 1,
    backgroundColor: GAZETTEER_ABYSS,
  },
});

export default App;
