/**
 * Clips App - React Native
 * Social media app with live streaming
 */

import React, { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, DeviceEventEmitter } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { rootNavigationRef as navigationRef } from './src/navigation/rootNavigationRef';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableFreeze } from 'react-native-screens';
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
import ImageFullscreenScreen from './src/screens/ImageFullscreenScreen.native';
import { initializeNotifications, teardownNotifications } from './src/services/notifications';
import { hydrateAuthTokenFromStorage } from './src/utils/authTokenBridge';
import { schedulePushNotificationNavigation } from './src/utils/pushNotificationNavigationNative';
import UploadProgressToast from './src/components/UploadProgressToast.native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Freeze inactive screens so background tabs stop re-rendering on the JS thread.
// Without this, every context/poll update reconciled all mounted tab trees. Called once
// at module load, before the first navigator renders.
enableFreeze(true);

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

// MainTabBar is a floating glass bar; the navigator must not paint its own opaque
// panel or hairline underneath it, otherwise it clips the ambient tint again.
const TAB_BAR_STYLE = {
  backgroundColor: 'transparent',
  borderTopWidth: 0,
  borderTopColor: 'transparent',
  elevation: 0,
  shadowOpacity: 0,
  shadowColor: 'transparent',
  position: 'absolute' as const,
  left: 0,
  right: 0,
  bottom: 0,
};

/** Keep nav chrome transparent so FeedAmbientCanvas shows through frosted bars. */
const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    card: 'transparent',
    border: 'transparent',
  },
};

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
    let timer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;
    const handle = user.handle;
    const refresh = async () => {
      let failed: number;
      try {
        const results = await Promise.allSettled([
          getUnreadNotificationCount(handle),
          getUnreadTotal(handle),
        ]);
        failed = results.filter((r) => r.status === 'rejected').length;
        if (mounted) {
          const total = results.reduce<number>(
            (sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0),
            0,
          );
          setInboxBadgeCount(Math.max(0, total));
        }
      } catch {
        failed = 2;
        if (mounted) setInboxBadgeCount(0);
      }
      consecutiveFailures = failed === 0 ? 0 : consecutiveFailures + 1;
      if (mounted && consecutiveFailures === 1) {
        console.warn('[inbox] badge endpoint unreachable; backing off to 30s polls');
      }
      if (mounted) {
        timer = setTimeout(() => void refresh(), consecutiveFailures > 0 ? 30000 : 8000);
      }
    };
    void refresh();

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
      if (timer) clearTimeout(timer);
      subs.forEach((s) => s.remove());
      appStateSub.remove();
    };
  }, [user?.handle]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        sceneStyle: { backgroundColor: 'transparent' },
        lazy: true,
        freezeOnBlur: true,
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
        options={{ title: 'Boost' }}
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
        options={{ title: 'Inbox' }}
      />
    </Tab.Navigator>
  );
}

function App(): React.JSX.Element {
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
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <UploadProgressToast />
        <NavigationContainer ref={navigationRef} theme={NAV_THEME}>
          <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: GAZETTEER_ABYSS },
            }}
          >
          <Stack.Screen
            name="Splash"
            component={SplashScreen}
            options={{ contentStyle: { backgroundColor: '#000000' } }}
          />
          {/* Transparent so FeedAmbientCanvas can bleed under the frosted tab bar. */}
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ contentStyle: { backgroundColor: 'transparent' } }}
          />
          {/* Full-screen media viewer — real native route (was an RN <Modal>). */}
          <Stack.Screen
            name="ImageFullscreenModal"
            component={ImageFullscreenScreen}
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
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
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ contentStyle: { backgroundColor: '#000000' } }}
          />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} />
          <Stack.Screen
            name="Stories"
            component={StoriesScreen}
            options={({ route }) => ({
              presentation: 'fullScreenModal',
              contentStyle: { backgroundColor: '#000000' },
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
          <Stack.Screen
            name="Landing"
            component={LandingScreen}
            options={{ contentStyle: { backgroundColor: '#000000' } }}
          />
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
    // Match share-card Passport abyss / FeedAmbientCanvas.
    backgroundColor: '#000000',
  },
  createTabPlaceholder: {
    flex: 1,
    backgroundColor: GAZETTEER_ABYSS,
  },
});

export default App;
