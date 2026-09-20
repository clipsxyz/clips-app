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
    TouchableOpacity,
    Image,
    StyleSheet,
    AppState,
    Dimensions,
    Platform,
} from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    interpolateColor,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    type SharedValue,
} from 'react-native-reanimated';
import type { VideoRef } from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Stories24MapPinIcon from './Stories24MapPinIcon.native';
import FeedPlusIcon from './FeedPlusIcon.native';
import StorySafeVideo from './stories/StorySafeVideo.native';
import Avatar from './Avatar';
import type { Stories24RailItem, Stories24RailReturnPayload } from '../utils/stories24Rail';
import {
    asStories24StillUri,
    STORIES24_ADD_YOURS_HANDLE,
    getStories24RailHandles,
    isStories24AddYoursHandle,
    pickFirstStories24RailStory,
    stories24DisplayName,
} from '../utils/stories24Rail';
import { getAvatarForHandle, resolveAvatarImageUri } from '../api/users';
import { isVideoUrl, storyVideoSource } from '../utils/storyMediaNative';

/** 9:16 story thumbnail. */
const CARD_W = 126;
const CARD_H = Math.round((CARD_W * 16) / 9);
const CARD_RADIUS = 18;
/** Visible numeral to the left of the poster (~70–80% of the glyph). */
const RANK_PEEK = 78;
const ITEM_GAP = 6;
const SLOT_W = RANK_PEEK + CARD_W;
const ITEM_STRIDE = SLOT_W + ITEM_GAP;
const RAIL_PAD_LEFT = 14;
const RAIL_PAD_RIGHT = 16;
const RANK_FONT = 176;
const RANK_FONT_WIDE = 132;
const RANK_TEAL = '#33B0A6';
const RANK_WHITE = '#FFFFFF';
const PREVIEW_POSTER_FALLBACK = '#121212';
const FOCAL_SCALE = 1;
const IDLE_SCALE = 0.92;

function visibleCardRange(scrollX: number, viewportW: number, count: number): { start: number; end: number } {
    if (count <= 0) return { start: 0, end: -1 };
    const width = viewportW > 1 ? viewportW : Dimensions.get('window').width;
    const peek = SLOT_W;
    const viewLeft = scrollX - peek;
    const viewRight = scrollX + width + peek;
    let start = 0;
    let end = count - 1;
    for (let i = 0; i < count; i++) {
        const x = RAIL_PAD_LEFT + i * ITEM_STRIDE;
        if (x + SLOT_W >= viewLeft) {
            start = i;
            break;
        }
    }
    for (let i = count - 1; i >= 0; i--) {
        const x = RAIL_PAD_LEFT + i * ITEM_STRIDE;
        if (x <= viewRight) {
            end = i;
            break;
        }
    }
    return { start, end };
}

function stillUri(uri?: string | null): string | undefined {
    const resolved = asStories24StillUri(uri);
    if (!resolved || resolved.startsWith('#') || isVideoUrl(resolved)) return undefined;
    return resolved;
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
/** ColorOS TextureView ignores clip — a rail player paints into the post below (top-left). */
const ANDROID_FEED_RAIL_POSTERS_ONLY = Platform.OS === 'android';

function StoryPreviewPoster({
    posterUri,
    onError,
}: {
    posterUri?: string;
    onError?: () => void;
}) {
    const posterSource = stillUri(posterUri) ? { uri: stillUri(posterUri)! } : undefined;
    if (posterSource) {
        return (
            <Image
                source={posterSource}
                style={styles.previewFrame}
                resizeMode="cover"
                pointerEvents="none"
                onError={onError}
            />
        );
    }
    return <View style={[styles.previewFrame, { backgroundColor: PREVIEW_POSTER_FALLBACK }]} />;
}

function StoryTextPreview({ item }: { item: Stories24RailItem }) {
    const colors =
        item.previewGradient && item.previewGradient.length >= 2
            ? item.previewGradient
            : ['#1e3a8a', '#2563eb', '#172554'];
    const color = item.previewTextColor || '#FFFFFF';
    const body = (item.title || '').trim();
    return (
        <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.previewFrame, styles.textPreviewCanvas]}
            pointerEvents="none"
        >
            {body ? (
                <Text style={[styles.textPreviewBody, { color }]} numberOfLines={8}>
                    {body}
                </Text>
            ) : null}
        </LinearGradient>
    );
}

function StoryCardFill({
    item,
    poster,
    playPreviewVideo,
    previewVideosPaused,
}: {
    item: Stories24RailItem;
    poster?: string;
    playPreviewVideo: boolean;
    previewVideosPaused: boolean;
}) {
    const [stillFailed, setStillFailed] = useState(false);
    useEffect(() => {
        setStillFailed(false);
    }, [poster]);

    if (poster && !stillFailed) {
        return (
            <Image
                source={{ uri: poster }}
                style={styles.previewFrame}
                resizeMode="cover"
                pointerEvents="none"
                onError={() => setStillFailed(true)}
            />
        );
    }
    if (playPreviewVideo && item.previewVideoUrl) {
        return (
            <StoryPreviewVideo
                uri={item.previewVideoUrl}
                posterUri={undefined}
                paused={previewVideosPaused}
            />
        );
    }
    if (item.previewGradient?.length || item.title) {
        return <StoryTextPreview item={item} />;
    }
    return (
        <View
            pointerEvents="none"
            style={[styles.previewFrame, { backgroundColor: PREVIEW_POSTER_FALLBACK }]}
        />
    );
}

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
    const still = stillUri(posterUri);
    if (still) {
        return <StoryPreviewPoster posterUri={still} />;
    }
    const source = storyVideoSource(uri) || { uri };

    return (
        <View style={styles.previewVideoHost} pointerEvents="none" collapsable={false}>
            <View style={styles.previewVideoClip} pointerEvents="none" collapsable={false}>
                <StorySafeVideo
                    videoRef={videoRef}
                    source={source}
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

function RankedShelfCard({
    item,
    index,
    scrollX,
    onPress,
    playPreviewVideo,
    previewVideosPaused,
}: {
    item: Stories24RailItem;
    index: number;
    scrollX: SharedValue<number>;
    onPress: () => void;
    playPreviewVideo: boolean;
    previewVideosPaused: boolean;
}) {
    const isAddYours = isStories24AddYoursHandle(item.handle);
    const poster = stillUri(item.thumb);
    const rankLabel = String(index + 1);
    const allowScale = !(Platform.OS === 'android' && playPreviewVideo && !poster);

    const cardAnimStyle = useAnimatedStyle(() => {
        if (!allowScale) return { transform: [{ scale: 1 }] };
        const offset = index * ITEM_STRIDE;
        const scale = interpolate(
            scrollX.value,
            [offset - ITEM_STRIDE, offset, offset + ITEM_STRIDE],
            [IDLE_SCALE, FOCAL_SCALE, IDLE_SCALE],
            Extrapolation.CLAMP,
        );
        return { transform: [{ scale }] };
    });

    const rankAnimStyle = useAnimatedStyle(() => {
        const offset = index * ITEM_STRIDE;
        const dist = Math.abs(scrollX.value - offset);
        const t = interpolate(dist, [0, ITEM_STRIDE * 0.55], [1, 0], Extrapolation.CLAMP);
        return {
            color: interpolateColor(t, [0, 1], [RANK_WHITE, RANK_TEAL]),
        };
    });

    return (
        <View style={styles.itemSlot} collapsable={false}>
            <Animated.Text
                style={[
                    styles.rankNumber,
                    rankLabel.length > 1 && styles.rankNumberWide,
                    rankAnimStyle,
                ]}
                pointerEvents="none"
            >
                {rankLabel}
            </Animated.Text>
            <Animated.View
                style={[
                    styles.cardLift,
                    playPreviewVideo && !poster && styles.cardLiftVideoSafe,
                    cardAnimStyle,
                ]}
                collapsable={false}
            >
                {isAddYours ? (
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
                ) : (
                    <View
                        style={[
                            styles.card,
                            playPreviewVideo && !poster && styles.cardVideoSafe,
                        ]}
                        collapsable={false}
                    >
                        <TouchableOpacity
                            style={styles.cardPress}
                            onPress={onPress}
                            activeOpacity={0.9}
                            accessibilityRole="button"
                            accessibilityLabel={stories24DisplayName(item.handle, item.displayName)}
                        >
                            <StoryCardFill
                                item={item}
                                poster={poster}
                                playPreviewVideo={playPreviewVideo}
                                previewVideosPaused={previewVideosPaused}
                            />
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.85)']}
                                style={styles.gradient}
                            />
                            <CardIdentity item={item} />
                        </TouchableOpacity>
                    </View>
                )}
            </Animated.View>
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
    const scrollX = useSharedValue(0);
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
        (nextX: number, viewportW = railWidth) => {
            scrollXRef.current = nextX;
            const next = visibleCardRange(nextX, viewportW, items.length);
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

    const setRailScrollingTrue = useCallback(() => setRailScrolling(true), []);
    const setRailScrollingFalse = useCallback(() => setRailScrolling(false), []);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (e) => {
            scrollX.value = e.contentOffset.x;
            runOnJS(updateVisibleRange)(e.contentOffset.x);
        },
        onBeginDrag: () => {
            runOnJS(setRailScrollingTrue)();
        },
        onEndDrag: (e) => {
            runOnJS(setRailScrollingFalse)();
            runOnJS(updateVisibleRange)(e.contentOffset.x);
        },
        onMomentumEnd: (e) => {
            runOnJS(setRailScrollingFalse)();
            runOnJS(updateVisibleRange)(e.contentOffset.x);
        },
    });

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
        if (ANDROID_FEED_RAIL_POSTERS_ONLY || visibleVideoIndexes.length <= 1) return;
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

    const onPressItem = useCallback(
        (item: Stories24RailItem) => {
            if (item.handle === STORIES24_ADD_YOURS_HANDLE) {
                onAddYours();
                return;
            }
            onOpenStory(item, railHandles);
        },
        [onAddYours, onOpenStory, railHandles],
    );

    const keyExtractor = useCallback((item: Stories24RailItem) => {
        return item.handle === STORIES24_ADD_YOURS_HANDLE ? 'add-yours' : item.handle;
    }, []);

    const renderItem = useCallback(
        ({ item, index }: { item: Stories24RailItem; index: number }) => (
            <RankedShelfCard
                item={item}
                index={index}
                scrollX={scrollX}
                playPreviewVideo={
                    !!item.previewVideoUrl &&
                    !stillUri(item.thumb) &&
                    index >= visibleRange.start &&
                    index <= visibleRange.end
                }
                previewVideosPaused={previewsPaused}
                onPress={() => onPressItem(item)}
            />
        ),
        [onPressItem, previewsPaused, scrollX, visibleRange.end, visibleRange.start],
    );

    const getItemLayout = useCallback(
        (_: ArrayLike<Stories24RailItem> | null | undefined, index: number) => ({
            length: ITEM_STRIDE,
            offset: ITEM_STRIDE * index,
            index,
        }),
        [],
    );

    if (items.length === 0) return null;

    return (
        <View style={styles.wrap} collapsable={false}>
            <View style={styles.headerRow}>
                <View style={styles.titleRow}>
                    <Stories24MapPinIcon size={16} />
                    <Text style={styles.sectionTitle}>Stories 24</Text>
                </View>
            </View>
            <Animated.FlatList
                data={items}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                extraData={`${activePreviewIndex}-${previewsPaused}-${visibleRange.start}-${visibleRange.end}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                style={styles.rail}
                contentContainerStyle={styles.listContent}
                scrollEventThrottle={16}
                onScroll={onScroll}
                onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 1 && Math.abs(w - railWidth) > 1) setRailWidth(w);
                }}
                snapToInterval={ITEM_STRIDE}
                snapToAlignment="start"
                disableIntervalMomentum
                decelerationRate="fast"
                getItemLayout={getItemLayout}
                initialNumToRender={6}
                maxToRenderPerBatch={4}
                windowSize={5}
                removeClippedSubviews={false}
            />
        </View>
    );
});

export default Stories24FeedShelf;

const styles = StyleSheet.create({
    wrap: {
        paddingTop: 4,
        paddingBottom: 8,
        overflow: 'visible',
        backgroundColor: '#151D28',
        position: 'relative',
        zIndex: 8,
    },
    rail: {
        overflow: 'visible',
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
        paddingRight: RAIL_PAD_RIGHT,
        paddingBottom: 6,
        alignItems: 'flex-end',
    },
    itemSlot: {
        width: ITEM_STRIDE,
        height: CARD_H,
        position: 'relative',
        overflow: 'visible',
        justifyContent: 'flex-end',
    },
    rankNumber: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        zIndex: 1,
        elevation: 0,
        fontSize: RANK_FONT,
        fontWeight: '900',
        fontFamily: Platform.OS === 'android' ? 'sans-serif-black' : 'System',
        color: RANK_WHITE,
        letterSpacing: -10,
        lineHeight: RANK_FONT,
        includeFontPadding: false,
        textAlignVertical: 'bottom',
    },
    rankNumberWide: {
        fontSize: RANK_FONT_WIDE,
        letterSpacing: -6,
        lineHeight: RANK_FONT_WIDE,
        left: 0,
        bottom: 0,
    },
    cardLift: {
        position: 'absolute',
        left: RANK_PEEK,
        top: 0,
        width: CARD_W,
        height: CARD_H,
        zIndex: 2,
        elevation: 5,
    },
    cardLiftVideoSafe: {
        elevation: 0,
    },
    card: {
        width: CARD_W,
        height: CARD_H,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        backgroundColor: PREVIEW_POSTER_FALLBACK,
        position: 'relative',
        zIndex: 2,
        elevation: 5,
    },
    cardVideoSafe: {
        backgroundColor: 'transparent',
        elevation: 0,
    },
    cardPress: {
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
        borderRadius: CARD_RADIUS,
        position: 'relative',
        zIndex: 2,
    },
    previewFrame: {
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
        backgroundColor: PREVIEW_POSTER_FALLBACK,
        position: 'relative',
    },
    previewVideoHost: {
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        position: 'relative',
    },
    textPreviewCanvas: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingTop: 14,
        paddingBottom: 42,
    },
    textPreviewBody: {
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 16,
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
        zIndex: 2,
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
        zIndex: 3,
    },
    identity: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3,
        elevation: 3,
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
