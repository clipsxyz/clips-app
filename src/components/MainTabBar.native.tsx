import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { FEED_UI } from '../constants/feedUiTokens';

type Props = BottomTabBarProps & {
  inboxBadgeCount: number;
  onCreatePress?: () => void;
};

function TabSquareIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={[styles.iconSquare, focused ? styles.iconSquareActive : styles.iconSquareInactive]}>
      <Icon name={name} size={FEED_UI.icon.tab} color={focused ? '#111827' : '#FFFFFF'} />
    </View>
  );
}

export default function MainTabBar({
  state,
  descriptors,
  navigation,
  inboxBadgeCount,
  onCreatePress,
}: Props) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;
  const [showContributeCue, setShowContributeCue] = React.useState(false);

  React.useEffect(() => {
    if (activeRouteName !== 'Home') {
      setShowContributeCue(false);
      return;
    }
    setShowContributeCue(false);
    const appears = setTimeout(() => setShowContributeCue(true), 550);
    const hides = setTimeout(() => setShowContributeCue(false), 4300);
    return () => {
      clearTimeout(appears);
      clearTimeout(hides);
    };
  }, [activeRouteName]);

  const showAddYours = showContributeCue && activeRouteName === 'Home';

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 18 : 8) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;

        let iconName = 'ellipse-outline';
        if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
        else if (route.name === 'Boost') iconName = focused ? 'flash' : 'flash-outline';
        else if (route.name === 'Create') iconName = focused ? 'add' : 'add-outline';
        else if (route.name === 'Search') iconName = focused ? 'search' : 'search-outline';
        else if (route.name === 'Inbox') iconName = focused ? 'chatbox-ellipses' : 'chatbox-ellipses-outline';

        const onPress = () => {
          if (route.name === 'Create') {
            navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            onCreatePress?.();
            return;
          }
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (event.defaultPrevented) return;

          // Home footer always returns to the user's national feed (web `goHomeFeed` /
          // `resetFeed`) — not the last Discover/Search location.
          if (route.name === 'Home') {
            navigation.navigate('Home', {
              screen: 'Feed',
              params: {
                resetHomeFeedAt: Date.now(),
              },
            });
            return;
          }

          if (!focused) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const showInboxBadge = route.name === 'Inbox' && inboxBadgeCount > 0;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.85}
          >
            <View style={styles.iconStack}>
              {showAddYours && route.name === 'Create' ? (
                <View style={styles.addYoursBubble} pointerEvents="none">
                  <LinearGradient
                    colors={['#f6e27a', '#d4af37', '#d8dde3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addYoursGradient}
                  >
                    <Icon name="location" size={12} color="#111827" />
                    <Text style={styles.addYoursText}>Add Yours</Text>
                  </LinearGradient>
                  <View style={styles.addYoursTail} />
                </View>
              ) : null}
              <TabSquareIcon name={iconName} focused={focused} />
              {showInboxBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{inboxBadgeCount > 9 ? '9+' : inboxBadgeCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 6,
    backgroundColor: '#030712',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'visible',
    zIndex: 20,
    elevation: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    overflow: 'visible',
  },
  iconStack: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: FEED_UI.icon.tabSquare,
    paddingTop: 4,
    paddingRight: 8,
    overflow: 'visible',
  },
  iconSquare: {
    width: FEED_UI.icon.tabSquare,
    height: FEED_UI.icon.tabSquare,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquareActive: {
    backgroundColor: '#F3F4F6',
  },
  iconSquareInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  label: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#030712',
    zIndex: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  addYoursBubble: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    zIndex: 20,
  },
  addYoursGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  addYoursText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  addYoursTail: {
    width: 8,
    height: 8,
    backgroundColor: '#d8dde3',
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
    borderRadius: 2,
  },
});
