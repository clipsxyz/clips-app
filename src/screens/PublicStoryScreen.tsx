import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { fetchPublicStory } from '../api/stories';
import type { Story } from '../types';
import StoryViewerMedia from '../components/stories/StoryViewerMedia.native';
import { resetRootToScreen } from '../navigation/rootNavigationRef';
import { ox } from '../constants/nativeOpticalScale';

export default function PublicStoryScreen({ navigation, route }: any) {
    const handle: string = String(route?.params?.handle || route?.params?.user || '').trim();
    const storyId: string = String(route?.params?.storyId || route?.params?.story || '').trim();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const [story, setStory] = useState<Story | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!handle || !storyId) {
            setError('Missing share link.');
            setStory(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await fetchPublicStory(handle, storyId);
            if (!result) {
                setError('This story is unavailable.');
                setStory(null);
            } else {
                setStory(result);
            }
        } catch {
            setError('Could not load this story. Check your connection and try again.');
            setStory(null);
        } finally {
            setLoading(false);
        }
    }, [handle, storyId]);

    useEffect(() => {
        void load();
    }, [load]);

    const leave = () => {
        if (user) {
            if (navigation.canGoBack()) navigation.goBack();
            else resetRootToScreen('MainTabs');
            return;
        }
        resetRootToScreen('Landing');
    };

    const goAuth = (mode: 'signup' | 'login') => {
        navigation.navigate('Login', { mode });
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Loading story…</Text>
            </View>
        );
    }

    if (error || !story) {
        return (
            <View style={styles.centered}>
                <Icon name="alert-circle-outline" size={ox(40)} color="#F87171" />
                <Text style={styles.errorTitle}>Story not available</Text>
                <Text style={styles.errorBody}>{error || 'This shared story could not be loaded.'}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={leave}>
                    <Text style={styles.primaryBtnText}>{user ? 'Close' : 'Go to landing'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => void load()}>
                    <Text style={styles.secondaryBtnText}>Try again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <StoryViewerMedia story={story} isMuted={false} paused={false} />
            <View style={[styles.header, { paddingTop: insets.top + ox(8) }]}>
                <TouchableOpacity onPress={leave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="close" size={ox(28)} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={leave} style={styles.handleWrap}>
                    <Text style={styles.handle} numberOfLines={1}>
                        {story.userHandle}
                    </Text>
                </TouchableOpacity>
                <View style={{ width: ox(28) }} />
            </View>

            <View style={[styles.cta, { paddingBottom: insets.bottom + ox(16) }]}>
                {user ? (
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => resetRootToScreen('MainTabs')}
                    >
                        <Text style={styles.primaryBtnText}>Open Gazetteer</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <Text style={styles.ctaBody}>
                            Create an account to keep exploring, reply, and follow.
                        </Text>
                        <View style={styles.ctaRow}>
                            <TouchableOpacity style={styles.primaryBtn} onPress={() => goAuth('signup')}>
                                <Text style={styles.primaryBtnText}>Sign up</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => goAuth('login')}>
                                <Text style={styles.secondaryBtnText}>Log in</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
    },
    centered: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(24),
        gap: ox(12),
    },
    loadingText: {
        color: '#9CA3AF',
        fontSize: ox(14),
        marginTop: ox(8),
    },
    errorTitle: {
        color: '#FFFFFF',
        fontSize: ox(18),
        fontWeight: '700',
        textAlign: 'center',
    },
    errorBody: {
        color: '#9CA3AF',
        fontSize: ox(14),
        textAlign: 'center',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(16),
        zIndex: 2,
    },
    handleWrap: {
        flex: 1,
        marginHorizontal: ox(12),
    },
    handle: {
        color: '#FFFFFF',
        fontSize: ox(15),
        fontWeight: '700',
        textAlign: 'center',
    },
    cta: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: ox(16),
        gap: ox(10),
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    ctaBody: {
        color: '#E5E7EB',
        fontSize: ox(13),
        textAlign: 'center',
    },
    ctaRow: {
        flexDirection: 'row',
        gap: ox(10),
    },
    primaryBtn: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: ox(12),
        alignItems: 'center',
    },
    primaryBtnText: {
        color: '#000000',
        fontSize: ox(14),
        fontWeight: '700',
    },
    secondaryBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        borderRadius: 12,
        paddingVertical: ox(12),
        alignItems: 'center',
    },
    secondaryBtnText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
});
