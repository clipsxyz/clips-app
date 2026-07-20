import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GAZETTEER_ABYSS } from '../theme/gazetteerAmbientNative';
import FeedScreen from '../screens/FeedScreen';
import BoostScreen from '../screens/BoostScreen';
import SearchScreen from '../screens/SearchScreen';
import InboxScreen from '../screens/InboxScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

const stackScreenOptions = {
    headerShown: false,
    contentStyle: { backgroundColor: GAZETTEER_ABYSS },
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
                <View style={styles.feedErrorRoot}>
                    <Text style={styles.feedErrorTitle}>Home feed failed</Text>
                    <Pressable onPress={this.retry} style={styles.feedErrorRetry}>
                        <Text style={styles.feedErrorRetryText}>Reload feed</Text>
                    </Pressable>
                    <ScrollView>
                        <Text style={styles.feedErrorMessage}>{this.state.error.message}</Text>
                    </ScrollView>
                </View>
            );
        }
        return (
            <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>
        );
    }
}

function HomeFeedScreen(props: React.ComponentProps<typeof FeedScreen>) {
    return (
        <View style={styles.homeTabRoot}>
            <FeedHomeErrorBoundary>
                <FeedScreen {...props} />
            </FeedHomeErrorBoundary>
        </View>
    );
}

function createMainTabStack(
    initialRouteName: string,
    InitialComponent: React.ComponentType<any>,
) {
    return function MainTabStack() {
        return (
            <Stack.Navigator screenOptions={stackScreenOptions}>
                <Stack.Screen name={initialRouteName} component={InitialComponent} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
            </Stack.Navigator>
        );
    };
}

export const HomeTabStack = createMainTabStack('Feed', HomeFeedScreen);
export const BoostTabStack = createMainTabStack('BoostMain', BoostScreen);
export const SearchTabStack = createMainTabStack('SearchMain', SearchScreen);
export const InboxTabStack = createMainTabStack('InboxMain', InboxScreen);

const styles = StyleSheet.create({
    homeTabRoot: {
        flex: 1,
        backgroundColor: '#030712',
        overflow: 'hidden',
    },
    feedErrorRoot: {
        flex: 1,
        backgroundColor: '#0b0711',
        padding: 20,
        paddingTop: 48,
    },
    feedErrorTitle: {
        color: '#f87171',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    feedErrorRetry: {
        alignSelf: 'flex-start',
        backgroundColor: '#7c3aed',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 16,
    },
    feedErrorRetryText: {
        color: '#fff',
        fontWeight: '700',
    },
    feedErrorMessage: {
        color: '#e5e7eb',
        fontSize: 13,
    },
});
