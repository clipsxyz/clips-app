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
    Dimensions,
    type NativeSyntheticEvent,
    type NativeScrollEvent,
} from 'react-native';
import type { VideoRef } from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Stories24MapPinIcon from './Stories24MapPinIcon.native';
import FeedPlusIcon from './FeedPlusIcon.native';
import StorySafeVideo from './stories/StorySafeVideo.native';
import Avatar from './Avatar';
import type { Stories24RailItem, Stories24RailReturnPayload } from '../utils/stories24Rail';
import {
    STORIES24_ADD_YOURS_HANDLE,
    getStories24RailHandles,
    isStories24AddYoursHandle,
    pickFirstStories24RailStory,
    stories24DisplayName,
} from '../utils/stories24Rail';
import { getAvatarForHandle, resolveAvatarImageUri } from '../api/users';
import { storyVideoSource } from '../utils/storyMediaNative';

const CARD_W = 140;
const CARD_H = 220;
const CARD_RADIUS = 12;
const CARD_GAP = 10;
const CARD_STRIDE = CARD_W + CARD_GAP;
const RAIL_PAD_LEFT = 12;
const PREVIEW_POSTER_FALLBACK = '#121212';

function visibleCardRange(scrollX: number, viewportW: number, count: number): { start: number; end: number } {
    if (count <= 0) return { start: 0, end: -1 };
    const width = viewportW > 1 ? viewportW : Dimensions.get('window').width;
    const peek = CARD_W;
    const viewLeft = scrollX - peek;
    const viewRight = scrollX + width + peek;
    let start = 0;
    let end = count - 1;
    for (let i = 0; i < count; i++) {
        const x = RAIL_PAD_LEFT + i * CARD_STRIDE;
        if (x + CARD_W >= viewLeft) {
            start = i;
            break;
        }
    }
    for (let i = count - 1; i >= 0; i--) {
        const x = RAIL_PAD_LEFT + i * CARD_STRIDE;
        if (x <= viewRight) {
            end = i;
            break;
        }
    }
    return { start, end };
}

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

const PREVIEW_LOOP_SECONDS = 2;

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
    const source = storyVideoSource(uri) || { uri };
    const posterSource = stillUri(posterUri) ? { uri: stillUri(posterUri)! } : undefined;

    return (
        <View style={styles.previewFrame} pointerEvents="none" collapsable={false}>
            {posterSource ? (
                <Image
                    source={posterSource}
                    style={styles.previewFrame}
                    resizeMode="cover"
                    pointerEvents="none"
                />
            ) : (
                <View style={[styles.previewFrame, { backgroundColor: PREVIEW_POSTER_FALLBACK }]} />
            )}
            <View style={styles.previewVideoClip} pointerEvents="none" collapsable={false}>
                <StorySafeVideo
                    videoRef={videoRef}
                    source={source}
                    posterSource={posterSource}
                    boxWidth={CARD_W}
                    boxHeight={CARD_H}
                    muted
                    repeat
                    paused={paused}
                    playWhenInactive
                    resizeMode="cover"
                    progressUpdateInterval={200}
                    onProgress={({ currentTime }) => {
                        if (currentTime >= PREVIEW_LOOP_SECONDS) {
                            videoRef.current?.seek(0);
                        }
                    }}
                />
            </View>
        </View>
    );
}

function CardIdentity({ item }: { item: Stories24RailItem }) {
    const name = stories24DisplayName(item.handle, item.displayName);
    const avatarUrl =
        resolveAvatarImageUri(item.avatarUrl, item.handle) || getAvatarForHandle(item.handle);
    return (
        <View style={styles.identity} pointerEvents="none">
            <Avatar src={avatarUrl} name={name} handle={item.handle} size={22} hasStory />
            <Text style={styles.identityName} numberOfLines={1}>
                {name}
            </Text>
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
        <View style={styles.card} collapsable={false}>
            <TouchableOpacity
                style={styles.cardPress}
                onPress={onPress}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={stories24DisplayName(item.handle, item.displayName)}
            >
                {playPreviewVideo && item.previewVideoUrl ? (
                    <StoryPreviewVideo
                        uri={item.previewVideoUrl}
                        posterUri={poster}
                        paused={previewVideosPaused}
                    />
                ) : poster ? (
                    <Image
                        source={{ uri: poster }}
                        style={styles.previewFrame}
                        resizeMode="cover"
                        pointerEvents="none"
                    />
                ) : (
                    <View
                        pointerEvents="none"
                        style={[styles.previewFrame, { backgroundColor: PREVIEW_POSTER_FALLBACK }]}
                    />
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.gradient} />
                <CardIdentity item={item} />
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
    const [railWidth, setRailWidth] = useState(() => Dimensions.get('window').width);
    const scrollXRef = useRef(0);
    const visibleRangeRef = useRef(visibleCardRange(0, Dimensions.get('window').width, items.length));
    const [visibleRange, setVisibleRange] = useState(visibleRangeRef.current);

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

    const updateVisibleRange = useCallback(
        (scrollX: number, viewportW = railWidth) => {
            scrollXRef.current = scrollX;
            const next = visibleCardRange(scrollX, viewportW, items.length);
            const prev = visibleRangeRef.current;
            if (prev.start === next.start && prev.end === next.end) return;
            visibleRangeRef.current = next;
            setVisibleRange(next);
        },
        [items.length, railWidth],
    );

    useEffect(() => {
        updateVisibleRange(scrollXRef.current, railWidth);
    }, [items.length, railWidth, updateVisibleRange]);

    const onRailScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            updateVisibleRange(e.nativeEvent.contentOffset.x);
        },
        [updateVisibleRange],
    );

    const previewsPaused = railScrolling || !appActive;

    const visibleVideoIndexes = useMemo(() => {
        const next: number[] = [];
        items.forEach((item, index) => {
            if (!item.previewVideoUrl) return;
            if (isStories24AddYoursHandle(item.handle)) return;
            if (index < visibleRange.start || index > visibleRange.end) return;
            next.push(index);
        });
        return next;
    }, [items, visibleRange.end, visibleRange.start]);

    const visibleVideoKey = visibleVideoIndexes.join(',');
    const [previewTurn, setPreviewTurn] = useState(0);

    useEffect(() => {
        setPreviewTurn(0);
    }, [visibleVideoKey]);

    useEffect(() => {
        if (visibleVideoIndexes.length <= 1) return;
        const id = setInterval(() => {
            setPreviewTurn((n) => n + 1);
        }, PREVIEW_LOOP_SECONDS * 1000);
        return () => clearInterval(id);
    }, [visibleVideoIndexes.length, visibleVideoKey]);

    const activePreviewIndex =
        visibleVideoIndexes.length === 0
            ? -1
            : visibleVideoIndexes[previewTurn % visibleVideoIndexes.length];

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
                style={styles.rail}
                contentContainerStyle={styles.listContent}
                scrollEventThrottle={16}
                onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 1 && Math.abs(w - railWidth) > 1) setRailWidth(w);
                }}
                onScroll={onRailScroll}
                onScrollBeginDrag={() => setRailScrolling(true)}
                onScrollEndDrag={(e) => {
                    setRailScrolling(false);
                    updateVisibleRange(e.nativeEvent.contentOffset.x);
                }}
                onMomentumScrollEnd={(e) => {
                    setRailScrolling(false);
                    updateVisibleRange(e.nativeEvent.contentOffset.x);
                }}
            >
                {items.map((item, index) => (
                    <ShelfCard
                        key={
                            item.handle === STORIES24_ADD_YOURS_HANDLE
                                ? 'add-yours'
                                : item.handle
                        }
                        item={item}
                        playPreviewVideo={!!item.previewVideoUrl && index === activePreviewIndex}
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
        overflow: 'hidden',
        backgroundColor: '#030712',
        position: 'relative',
        zIndex: 8,
    },
    rail: {
        overflow: 'hidden',
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
        paddingLeft: RAIL_PAD_LEFT,
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
        position: 'relative',
        elevation: 0,
    },
    cardPress: {
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
        borderRadius: CARD_RADIUS,
        position: 'relative',
    },
    previewFrame: {
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
        backgroundColor: PREVIEW_POSTER_FALLBACK,
        position: 'relative',
    },
    previewVideoClip: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
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
    identity: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 8,
        paddingBottom: 8,
        paddingTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    identityName: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.85)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});
