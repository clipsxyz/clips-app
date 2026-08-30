import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StyleSheet,
    AppState,
} from 'react-native';
import type { VideoRef } from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Stories24MapPinIcon from './Stories24MapPinIcon.native';
import FeedPlusIcon from './FeedPlusIcon.native';
import StorySafeVideo from './stories/StorySafeVideo.native';
import type { Stories24RailItem, Stories24RailReturnPayload } from '../utils/stories24Rail';
import {
    STORIES24_ADD_YOURS_HANDLE,
    getStories24RailHandles,
    isStories24AddYoursHandle,
    pickFirstStories24RailStory,
} from '../utils/stories24Rail';
import { getFeedScrollBusy, subscribeFeedScrollBusy } from '../utils/feedScrollBusyNative';
import { storyVideoSource } from '../utils/storyMediaNative';

const CARD_W = 140;
const CARD_H = 220;
const CARD_RADIUS = 12;
const CARD_GAP = 10;
const PREVIEW_POSTER_FALLBACK = '#121212';

function stillUri(uri?: string | null): string | undefined {
    if (!uri || uri.startsWith('#')) return undefined;
    return uri;
}

export type Stories24FeedShelfHandle = {
    openFirstStory: () => boolean;
};

type Props = {
    items: Stories24RailItem[];
    onOpenStory: (item: Stories24RailItem, railHandles: string[]) => void;
    onAddYours: () => void;
    collapsePayload?: Stories24RailReturnPayload | null;
    onCollapseHandled?: () => void;
};

function StoryPreviewVideo({
    uri,
    posterUri,
    paused,
}: {
    uri: string;
    posterUri?: string;
    paused: boolean;
}) {
    const videoRef = useRef<VideoRef>(null);
    const [feedScrolling, setFeedScrolling] = useState(getFeedScrollBusy());
    useEffect(() => subscribeFeedScrollBusy(setFeedScrolling), []);
    const effectivelyPaused = paused || feedScrolling;
    const source = storyVideoSource(uri) || { uri };
    const posterSource = stillUri(posterUri) ? { uri: stillUri(posterUri)! } : undefined;

    // TextureView steals touches — preview must stay non-interactive.
    if (effectivelyPaused && posterSource) {
        return (
            <Image
                source={posterSource}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                pointerEvents="none"
            />
        );
    }

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <StorySafeVideo
                videoRef={videoRef}
                source={source}
                posterSource={posterSource}
                style={StyleSheet.absoluteFill}
                muted
                repeat
                paused={effectivelyPaused}
                onProgress={({ currentTime }) => {
                    if (currentTime > 3) {
                        videoRef.current?.seek(0);
                    }
                }}
            />
        </View>
    );
}

function ShelfCard({
    item,
    onPress,
    playPreviewVideo,
    previewVideosPaused,
}: {
    item: Stories24RailItem;
    onPress: () => void;
    playPreviewVideo: boolean;
    previewVideosPaused: boolean;
}) {
    const isAddYours = isStories24AddYoursHandle(item.handle);
    const poster = stillUri(item.thumb);

    if (isAddYours) {
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={onPress}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Add yours to Stories 24"
            >
                <View style={styles.addYoursFill}>
                    <View style={styles.addYoursIcon}>
                        <FeedPlusIcon size={22} color="#111827" strokeWidth={2.25} />
                    </View>
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.85)']}
                        style={styles.gradient}
                    />
                    <Text style={styles.headline} numberOfLines={3}>
                        Add yours
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View collapsable={false}>
            <TouchableOpacity
                style={styles.card}
                onPress={onPress}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={item.title || 'Stories 24'}
            >
                {item.previewVideoUrl ? (
                    <StoryPreviewVideo
                        uri={item.previewVideoUrl}
                        posterUri={poster}
                        paused={previewVideosPaused || !playPreviewVideo}
                    />
                ) : poster ? (
                    <Image
                        source={{ uri: poster }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        pointerEvents="none"
                    />
                ) : (
                    <View
                        pointerEvents="none"
                        style={[StyleSheet.absoluteFill, { backgroundColor: PREVIEW_POSTER_FALLBACK }]}
                    />
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.gradient} />
                <Text style={styles.headline} numberOfLines={3}>
                    {item.title}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const Stories24FeedShelf = forwardRef<Stories24FeedShelfHandle, Props>(function Stories24FeedShelf(
    { items, onOpenStory, onAddYours, collapsePayload, onCollapseHandled },
    ref,
) {
    const railHandles = useMemo(() => getStories24RailHandles(items), [items]);
    const [railScrolling, setRailScrolling] = useState(false);
    const [appActive, setAppActive] = useState(AppState.currentState === 'active');

    useEffect(() => {
        const sub = AppState.addEventListener('change', (next) => {
            setAppActive(next === 'active');
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (!collapsePayload) return;
        onCollapseHandled?.();
    }, [collapsePayload, onCollapseHandled]);

    const firstStoryPreviewHandle = useMemo(
        () => items.find((i) => !isStories24AddYoursHandle(i.handle))?.handle ?? null,
        [items],
    );

    const previewsPaused = railScrolling || !appActive;

    const openFirstStory = useCallback(() => {
        const first = pickFirstStories24RailStory(items);
        if (!first || isStories24AddYoursHandle(first.handle)) return false;
        onOpenStory(first, railHandles);
        return true;
    }, [items, onOpenStory, railHandles]);

    useImperativeHandle(ref, () => ({ openFirstStory }), [openFirstStory]);

    if (items.length === 0) return null;

    return (
        <View style={styles.wrap} collapsable={false}>
            <View style={styles.headerRow}>
                <View style={styles.titleRow}>
                    <Stories24MapPinIcon size={16} />
                    <Text style={styles.sectionTitle}>Stories 24</Text>
                </View>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                onScrollBeginDrag={() => setRailScrolling(true)}
                onScrollEndDrag={() => setRailScrolling(false)}
                onMomentumScrollEnd={() => setRailScrolling(false)}
            >
                {items.map((item) => (
                    <ShelfCard
                        key={
                            item.handle === STORIES24_ADD_YOURS_HANDLE
                                ? 'add-yours'
                                : item.handle
                        }
                        item={item}
                        playPreviewVideo={
                            !!item.previewVideoUrl && item.handle === firstStoryPreviewHandle
                        }
                        previewVideosPaused={previewsPaused}
                        onPress={() => {
                            if (item.handle === STORIES24_ADD_YOURS_HANDLE) {
                                onAddYours();
                                return;
                            }
                            onOpenStory(item, railHandles);
                        }}
                    />
                ))}
            </ScrollView>
        </View>
    );
});

export default Stories24FeedShelf;

const styles = StyleSheet.create({
    wrap: {
        paddingTop: 4,
        paddingBottom: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginBottom: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 6,
    },
    listContent: {
        paddingLeft: 12,
        paddingRight: 2,
        paddingBottom: 4,
    },
    card: {
        width: CARD_W,
        height: CARD_H,
        borderRadius: CARD_RADIUS,
        marginRight: CARD_GAP,
        overflow: 'hidden',
        backgroundColor: PREVIEW_POSTER_FALLBACK,
    },
    addYoursFill: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addYoursIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: CARD_H / 2,
    },
    headline: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 8,
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
});
