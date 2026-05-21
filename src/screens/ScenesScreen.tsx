import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    Dimensions,
    Pressable,
    StatusBar,
    Image,
    type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import type { Post } from '../types';
import { postHasVideoMedia } from '../utils/postMedia';
import {
    getGlobalVideoMutedNative,
    setGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';

type RouteParams = {
    initialPostId: string;
    posts: Post[];
};

function getVideoUrl(post: Post): string {
    const fromItems = post.mediaItems?.find(
        (item) => item.type === 'video' || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(item.url || ''),
    );
    return fromItems?.url || post.mediaUrl || '';
}

export default function ScenesScreen({ route, navigation }: any) {
    const { initialPostId, posts: routePosts } = route.params;
    const insets = useSafeAreaInsets();
    const windowHeight = Dimensions.get('window').height;
    const posts = useMemo(() => routePosts.filter(postHasVideoMedia), [routePosts]);
    const initialIndex = Math.max(
        0,
        posts.findIndex((p) => p.id === initialPostId),
    );
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [muted, setMuted] = useState(true);
    const listRef = useRef<FlatList<Post>>(null);

    React.useEffect(() => {
        let mounted = true;
        void getGlobalVideoMutedNative().then((m) => {
            if (mounted) setMuted(m);
        });
        return subscribeGlobalVideoMuted((m) => setMuted(m));
    }, []);

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            const first = viewableItems.find((v) => v.isViewable && v.index != null);
            if (first?.index != null) setActiveIndex(first.index);
        },
    ).current;

    const toggleMute = useCallback(() => {
        setMuted((prev) => {
            const next = !prev;
            void setGlobalVideoMutedNative(next);
            return next;
        });
    }, []);

    const renderItem = useCallback(
        ({ item, index }: { item: Post; index: number }) => {
            const url = getVideoUrl(item);
            const isActive = index === activeIndex;
            const poster = item.videoPosterUrl;

            return (
                <View style={[styles.page, { height: windowHeight }]}>
                    {isActive && url ? (
                        <Video
                            source={{ uri: url }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                            repeat
                            paused={false}
                            muted={muted}
                            poster={poster}
                            posterResizeMode="cover"
                            playInBackground={false}
                            playWhenInactive={false}
                            ignoreSilentSwitch="ignore"
                        />
                    ) : poster || url ? (
                        <Image
                            source={{ uri: poster || url }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.fallback} />
                    )}
                </View>
            );
        },
        [activeIndex, muted, windowHeight],
    );

    if (!posts.length) {
        return (
            <View style={styles.root}>
                <Pressable
                    style={[styles.closeBtn, { top: insets.top + 8 }]}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="close" size={28} color="#FFFFFF" />
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" />
            <FlatList
                ref={listRef}
                data={posts}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={windowHeight}
                snapToAlignment="start"
                disableIntervalMomentum
                initialScrollIndex={initialIndex > 0 ? initialIndex : undefined}
                getItemLayout={(_, index) => ({
                    length: windowHeight,
                    offset: windowHeight * index,
                    index,
                })}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
            />
            <Pressable
                style={[styles.closeBtn, { top: insets.top + 8 }]}
                onPress={() => navigation.goBack()}
                accessibilityLabel="Close Scenes"
            >
                <Icon name="close" size={28} color="#FFFFFF" />
            </Pressable>
            <Pressable style={[styles.muteBtn, { bottom: insets.bottom + 16 }]} onPress={toggleMute}>
                <Icon name={muted ? 'volume-mute' : 'volume-high'} size={22} color="#FFFFFF" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
    },
    page: {
        width: '100%',
        backgroundColor: '#000000',
    },
    fallback: {
        flex: 1,
        backgroundColor: '#111827',
    },
    closeBtn: {
        position: 'absolute',
        right: 14,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 20,
    },
    muteBtn: {
        position: 'absolute',
        right: 14,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 20,
    },
});
