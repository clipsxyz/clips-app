import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { type VideoRef } from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { hapticLight } from '../utils/hapticsNative';
import StickerOverlayNative from '../components/StickerOverlay.native';
import StoryModalShell from '../components/StoryModalShell.native';
import TaggedUserOverlayNative, {
    type TaggedUserOverlayItem,
} from '../components/TaggedUserOverlay.native';
import TextStickerModalNative from '../components/TextStickerModal.native';
import UserTaggingModalNative from '../components/UserTaggingModal.native';
import type { StickerOverlay } from '../types';
import {
    STORY_STICKER_SAFE_ZONE_BOTTOM,
    STORY_STICKER_SAFE_ZONE_TOP,
} from '../utils/stickerLayoutNative';
import { publishMediaStory24 } from '../utils/publishStoryNative';
import { prepareMediaForPostNative } from '../utils/prepareMediaForPostNative';
import { showUploadOverlayNative } from '../utils/uploadOverlayNative';
import { ox } from '../constants/nativeOpticalScale';

type StoryAudience = 'public' | 'close_friends' | 'only_me';
type RailAction = 'text' | 'location' | 'link' | 'tag' | 'audience';

const RAIL_ACTIONS: RailAction[] = ['text', 'location', 'link', 'tag', 'audience'];
const RAIL_SLOT = 72;

function normalizeStoryLinkUrl(rawUrl: string): string | null {
    const cleaned = rawUrl.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (!cleaned) return null;
    const match = cleaned.match(
        /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i,
    );
    const candidate = (match?.[1] || cleaned)
        .trim()
        .replace(/^[('"[\s]+/, '')
        .replace(/[)'"\],.;!?]+$/, '');
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    try {
        const parsed = new URL(encodeURI(withProtocol));
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function audienceLabel(audience: StoryAudience): string {
    if (audience === 'close_friends') return 'Followers';
    if (audience === 'only_me') return 'Only me';
    return 'Public';
}

function audienceHintColor(audience: StoryAudience): string {
    if (audience === 'close_friends') return '#a7f3d0';
    if (audience === 'only_me') return '#e2e8f0';
    return '#bae6fd';
}

function audienceRingColors(audience: StoryAudience, centered: boolean): string {
    if (audience === 'close_friends') return centered ? '#34d399' : 'rgba(52,211,153,0.78)';
    if (audience === 'only_me') return centered ? '#cbd5e1' : 'rgba(203,213,225,0.78)';
    return centered ? '#7dd3fc' : 'rgba(125,211,252,0.78)';
}

function audienceInnerBg(audience: StoryAudience): string {
    if (audience === 'close_friends') return 'rgba(5,46,22,0.9)';
    if (audience === 'only_me') return 'rgba(30,41,59,0.9)';
    return 'rgba(8,47,73,0.9)';
}

function RailIcon({
    action,
    centered,
    audience,
}: {
    action: RailAction;
    centered: boolean;
    audience: StoryAudience;
}) {
    const size = centered ? 20 : 18;
    if (action === 'text') {
        return <Text style={[styles.railTypeIcon, centered && styles.railTypeIconCentered]}>T</Text>;
    }
    if (action === 'location') return <Icon name="location-outline" size={size} color="#FFFFFF" />;
    if (action === 'link') return <Icon name="link-outline" size={size} color="#FFFFFF" />;
    if (action === 'tag') return <Icon name="person-outline" size={size} color="#FFFFFF" />;
    return <Icon name="people-outline" size={size} color="#FFFFFF" />;
}

export default function Story24ComposerScreen({ navigation, route }: any) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const railPadWidth = screenWidth * 0.4;

    const mediaUrl = String(route.params?.mediaUrl || '');
    const mediaType: 'image' | 'video' =
        route.params?.mediaType === 'video' ? 'video' : 'image';
    const videoCoverTime = Number(route.params?.videoCoverTime || 0);

    const [textStickers, setTextStickers] = useState<StickerOverlay[]>([]);
    const [locationStickers, setLocationStickers] = useState<StickerOverlay[]>([]);
    const [linkStickers, setLinkStickers] = useState<StickerOverlay[]>([]);
    const [taggedUsers, setTaggedUsers] = useState<TaggedUserOverlayItem[]>([]);
    const [storyAudience, setStoryAudience] = useState<StoryAudience>('public');
    const [centeredRail, setCenteredRail] = useState<RailAction>('link');
    const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
    const [selectedTaggedUserId, setSelectedTaggedUserId] = useState<string | null>(null);
    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
    const [isPosting, setIsPosting] = useState(false);

    const [showTextModal, setShowTextModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [locationDraft, setLocationDraft] = useState('');
    const [linkUrlDraft, setLinkUrlDraft] = useState('');
    const [linkNameDraft, setLinkNameDraft] = useState('');

    const railRef = useRef<ScrollView | null>(null);
    const videoRef = useRef<VideoRef>(null);

    const allOverlays = useMemo(
        () => [...textStickers, ...locationStickers, ...linkStickers],
        [textStickers, locationStickers, linkStickers],
    );

    const centerRailAction = useCallback(
        (action: RailAction, animated = true) => {
            const index = RAIL_ACTIONS.indexOf(action);
            if (index < 0) return;
            const scrollX = railPadWidth + index * RAIL_SLOT - screenWidth / 2 + RAIL_SLOT / 2;
            railRef.current?.scrollTo({ x: Math.max(0, scrollX), animated });
        },
        [railPadWidth, screenWidth],
    );

    const updateCenteredRailFromScroll = useCallback(
        (scrollX: number) => {
            const centerX = scrollX + screenWidth / 2;
            let closest: RailAction = 'link';
            let minDist = Number.POSITIVE_INFINITY;
            RAIL_ACTIONS.forEach((action, index) => {
                const itemCenter = railPadWidth + index * RAIL_SLOT + RAIL_SLOT / 2;
                const dist = Math.abs(itemCenter - centerX);
                if (dist < minDist) {
                    minDist = dist;
                    closest = action;
                }
            });
            setCenteredRail(closest);
        },
        [railPadWidth, screenWidth],
    );

    useEffect(() => {
        if (!mediaUrl) {
            navigation.replace('Clip');
        }
    }, [mediaUrl, navigation]);

    useEffect(() => {
        const timer = setTimeout(() => centerRailAction('link', false), 60);
        return () => clearTimeout(timer);
    }, [centerRailAction]);

    const onPreviewLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setPreviewSize({ width, height });
    };

    const onRailScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        updateCenteredRailFromScroll(e.nativeEvent.contentOffset.x);
    };

    const handleRailPress = (action: RailAction) => {
        if (action === 'audience') {
            setStoryAudience((prev) =>
                prev === 'public' ? 'close_friends' : prev === 'close_friends' ? 'only_me' : 'public',
            );
            setCenteredRail('audience');
            centerRailAction('audience');
            return;
        }
        if (centeredRail !== action) {
            setCenteredRail(action);
            centerRailAction(action);
            return;
        }
        if (action === 'text') setShowTextModal(true);
        if (action === 'location') setShowLocationModal(true);
        if (action === 'link') setShowLinkModal(true);
        if (action === 'tag') setShowTagModal(true);
    };

    const addTextSticker = (text: string, fontSize: 'small' | 'medium' | 'large', color: string) => {
        const id = `text-${Date.now()}`;
        const sticker: StickerOverlay = {
            id,
            stickerId: id,
            sticker: { id, name: text, category: 'Text', isTrending: false },
            x: 50,
            y: 50,
            scale: fontSize === 'small' ? 0.8 : fontSize === 'large' ? 1.4 : 1,
            rotation: 0,
            opacity: 1,
            textContent: text,
            textColor: color,
            fontSize,
        };
        setTextStickers((prev) => [...prev, sticker]);
        setSelectedOverlayId(id);
        setSelectedTaggedUserId(null);
    };

    const addLocationSticker = () => {
        const label = locationDraft.trim();
        if (!label) {
            Alert.alert('Add location', 'Enter a location for your story.');
            return;
        }
        const id = `location-${Date.now()}`;
        const sticker: StickerOverlay = {
            id,
            stickerId: id,
            sticker: { id, name: label, category: 'Location', isTrending: false },
            x: 50,
            y: 50,
            scale: 0.9,
            rotation: 0,
            opacity: 1,
            textContent: label,
            textColor: '#FFFFFF',
            fontSize: 'small',
        };
        setLocationStickers((prev) => [...prev, sticker]);
        setSelectedOverlayId(id);
        setSelectedTaggedUserId(null);
        setLocationDraft('');
        setShowLocationModal(false);
    };

    const addLinkSticker = () => {
        const formatted = normalizeStoryLinkUrl(linkUrlDraft);
        if (!formatted) {
            Alert.alert('Invalid link', 'Enter a valid website URL.');
            return;
        }
        const label = linkNameDraft.trim() || formatted;
        const id = `link-${Date.now()}`;
        const sticker: StickerOverlay = {
            id,
            stickerId: id,
            sticker: { id, name: label, category: 'Link', isTrending: false },
            x: 50,
            y: 40,
            scale: 1,
            rotation: 0,
            opacity: 1,
            textContent: label,
            textColor: '#FFFFFF',
            fontSize: 'medium',
        };
        setLinkStickers((prev) => [...prev, sticker]);
        setSelectedOverlayId(id);
        setSelectedTaggedUserId(null);
        setLinkUrlDraft('');
        setLinkNameDraft('');
        setShowLinkModal(false);
    };

    const addTaggedUser = (handle: string) => {
        const normalized = handle.replace(/^@+/, '').trim();
        if (!normalized || taggedUsers.some((tu) => tu.handle === normalized)) return;
        const id = `tagged-${Date.now()}`;
        const item: TaggedUserOverlayItem = { id, handle: normalized, x: 50, y: 50 };
        setTaggedUsers((prev) => [...prev, item]);
        setSelectedTaggedUserId(id);
        setSelectedOverlayId(null);
    };

    const handleClose = () => {
        navigation.goBack();
    };

    const handlePost = () => {
        if (!user || !mediaUrl || isPosting) return;

        const jobId = `story-${Date.now()}`;
        const overlay = showUploadOverlayNative({
            jobId,
            thumbUri: mediaUrl,
            thumbType: mediaType === 'video' ? 'video' : 'image',
            initialMessage: 'Posting your story…',
            uploadingTitle: 'Posting story…',
            successTitle: 'Story live!',
        });

        const handles = taggedUsers.map((tu) => tu.handle);
        const stickerSnapshot = [...allOverlays];
        const taggedSnapshot = taggedUsers.map((tu) => ({ ...tu }));
        const audienceSnapshot = storyAudience;

        setIsPosting(true);
        hapticLight();

        navigation.reset({
            index: 0,
            routes: [
                {
                    name: 'MainTabs',
                    params: { screen: 'Home', params: { forceRefreshAt: Date.now() } },
                },
            ],
        });
        setIsPosting(false);

        void (async () => {
            try {
                let remoteUrl = mediaUrl;
                let remoteType = mediaType;

                if (isLaravelApiEnabled()) {
                    const prepared = await prepareMediaForPostNative({
                        mediaUrl,
                        mediaType,
                        videoCoverTime,
                    });
                    remoteUrl = prepared.mediaUrl || mediaUrl;
                    remoteType = prepared.mediaType || mediaType;
                }

                await publishMediaStory24({
                    userId: user.id,
                    userHandle: user.handle,
                    mediaUrl: remoteUrl,
                    mediaType: remoteType,
                    stickers: stickerSnapshot.length > 0 ? stickerSnapshot : undefined,
                    taggedUsers: handles.length > 0 ? handles : undefined,
                    taggedUsersPositions:
                        taggedSnapshot.length > 0
                            ? taggedSnapshot.map((tu) => ({ handle: tu.handle, x: tu.x, y: tu.y }))
                            : undefined,
                    audience: audienceSnapshot,
                });
                overlay.success('Your story is now live.');
            } catch (err: any) {
                overlay.error(err?.message || 'Story upload failed. Please try again.');
            }
        })();
    };

    const railItems: Array<{
        id: RailAction;
        label: string;
        count?: number;
    }> = [
        { id: 'text', label: 'Text', count: textStickers.length },
        { id: 'location', label: 'Location', count: locationStickers.length },
        { id: 'link', label: 'Link', count: linkStickers.length },
        { id: 'tag', label: 'Tag', count: taggedUsers.length },
        { id: 'audience', label: audienceLabel(storyAudience) },
    ];

    if (!mediaUrl) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color="#FFFFFF" />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.stage} onLayout={onPreviewLayout}>
                {mediaType === 'image' ? (
                    <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
                ) : (
                    <Video
                        ref={videoRef}
                        source={{ uri: mediaUrl }}
                        style={styles.media}
                        resizeMode="cover"
                        repeat
                        muted
                        paused={false}
                    />
                )}

                <Pressable
                    style={styles.deselectLayer}
                    onPress={() => {
                        setSelectedOverlayId(null);
                        setSelectedTaggedUserId(null);
                    }}
                />

                {previewSize.width > 0 &&
                    allOverlays.map((overlay) => (
                        <StickerOverlayNative
                            key={overlay.id}
                            overlay={overlay}
                            containerWidth={previewSize.width}
                            containerHeight={previewSize.height}
                            safeZoneTop={STORY_STICKER_SAFE_ZONE_TOP}
                            safeZoneBottom={STORY_STICKER_SAFE_ZONE_BOTTOM}
                            isSelected={selectedOverlayId === overlay.id}
                            onSelect={() => {
                                setSelectedOverlayId(overlay.id);
                                setSelectedTaggedUserId(null);
                            }}
                            onUpdate={(updated) => {
                                const updateList = (list: StickerOverlay[]) =>
                                    list.map((o) => (o.id === updated.id ? updated : o));
                                if (textStickers.some((o) => o.id === updated.id)) {
                                    setTextStickers(updateList);
                                } else if (locationStickers.some((o) => o.id === updated.id)) {
                                    setLocationStickers(updateList);
                                } else {
                                    setLinkStickers(updateList);
                                }
                            }}
                            onRemove={() => {
                                setTextStickers((prev) => prev.filter((o) => o.id !== overlay.id));
                                setLocationStickers((prev) => prev.filter((o) => o.id !== overlay.id));
                                setLinkStickers((prev) => prev.filter((o) => o.id !== overlay.id));
                                if (selectedOverlayId === overlay.id) setSelectedOverlayId(null);
                            }}
                        />
                    ))}

                {previewSize.width > 0 &&
                    taggedUsers.map((taggedUser) => (
                        <TaggedUserOverlayNative
                            key={taggedUser.id}
                            taggedUser={taggedUser}
                            containerWidth={previewSize.width}
                            containerHeight={previewSize.height}
                            safeZoneTop={STORY_STICKER_SAFE_ZONE_TOP}
                            safeZoneBottom={STORY_STICKER_SAFE_ZONE_BOTTOM}
                            isSelected={selectedTaggedUserId === taggedUser.id}
                            onSelect={() => {
                                setSelectedTaggedUserId(taggedUser.id);
                                setSelectedOverlayId(null);
                            }}
                            onUpdate={(updated) => {
                                setTaggedUsers((prev) =>
                                    prev.map((tu) => (tu.id === updated.id ? updated : tu)),
                                );
                            }}
                            onRemove={() => {
                                setTaggedUsers((prev) => prev.filter((tu) => tu.id !== taggedUser.id));
                                if (selectedTaggedUserId === taggedUser.id) setSelectedTaggedUserId(null);
                            }}
                        />
                    ))}

                <View style={[styles.headerOverlay, { paddingTop: Math.max(insets.top, 8) }]}>
                    <TouchableOpacity onPress={handleClose} style={styles.headerBtn} hitSlop={8}>
                        <Icon name="close" size={ox(24)} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Your Story</Text>
                    <TouchableOpacity
                        style={[styles.postBtn, isPosting && styles.postBtnDisabled]}
                        onPress={() => void handlePost()}
                        disabled={isPosting}
                    >
                        {isPosting ? (
                            <ActivityIndicator size="small" color="#000000" />
                        ) : (
                            <Text style={styles.postBtnText}>Post</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View
                    style={[styles.footerOverlay, { paddingBottom: Math.max(insets.bottom, 12) }]}
                    pointerEvents="box-none"
                >
                    <Text style={[styles.audienceHint, { color: audienceHintColor(storyAudience) }]}>
                        Audience: {audienceLabel(storyAudience)}
                    </Text>
                    <ScrollView
                        ref={railRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        decelerationRate="fast"
                        snapToInterval={RAIL_SLOT}
                        snapToAlignment="center"
                        onScroll={onRailScroll}
                        scrollEventThrottle={16}
                        contentContainerStyle={styles.railContent}
                    >
                        <View style={{ width: railPadWidth }} />
                        {railItems.map((item) => {
                            const centered = centeredRail === item.id;
                            const isAudience = item.id === 'audience';
                            const innerSize = centered ? 44 : 40;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.railSlot, { opacity: centered ? 1 : 0.62 }]}
                                    onPress={() => handleRailPress(item.id)}
                                    activeOpacity={0.85}
                                >
                                    <View style={{ transform: [{ scale: centered ? 1.1 : 0.86 }] }}>
                                        <View
                                            style={[
                                                styles.railRing,
                                                centered && styles.railRingCentered,
                                                {
                                                    backgroundColor: isAudience
                                                        ? audienceRingColors(storyAudience, centered)
                                                        : centered
                                                          ? '#FFFFFF'
                                                          : 'rgba(255,255,255,0.8)',
                                                },
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.railInner,
                                                    {
                                                        width: innerSize,
                                                        height: innerSize,
                                                        borderRadius: innerSize / 2,
                                                    },
                                                    isAudience && {
                                                        backgroundColor: audienceInnerBg(storyAudience),
                                                    },
                                                ]}
                                            >
                                                <RailIcon
                                                    action={item.id}
                                                    centered={centered}
                                                    audience={storyAudience}
                                                />
                                                {!!item.count && !isAudience ? (
                                                    <View style={styles.countBadge}>
                                                        <Text style={styles.countBadgeText}>
                                                            {item.count}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                        <Text
                                            style={[styles.railLabel, centered && styles.railLabelActive]}
                                        >
                                            {item.label}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        <View style={{ width: railPadWidth }} />
                    </ScrollView>
                </View>
            </View>

            <TextStickerModalNative
                visible={showTextModal}
                onClose={() => setShowTextModal(false)}
                onConfirm={addTextSticker}
                variant="story"
            />

            <StoryModalShell
                visible={showLocationModal}
                onRequestClose={() => setShowLocationModal(false)}
            >
                <View style={modalStyles.header}>
                    <View style={modalStyles.headerLeft}>
                        <Icon name="location-outline" size={ox(22)} color="#FFFFFF" />
                        <Text style={modalStyles.title}>Add Location</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowLocationModal(false)} hitSlop={8}>
                        <Icon name="close" size={ox(20)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
                <Text style={modalStyles.label}>Location</Text>
                <TextInput
                    value={locationDraft}
                    onChangeText={setLocationDraft}
                    placeholder="e.g., Dublin, Ireland"
                    placeholderTextColor="#6B7280"
                    style={modalStyles.input}
                    maxLength={50}
                    autoCorrect={false}
                />
                <View style={modalStyles.actions}>
                    <TouchableOpacity
                        style={modalStyles.cancelBtn}
                        onPress={() => setShowLocationModal(false)}
                    >
                        <Text style={modalStyles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={modalStyles.confirmBtn} onPress={addLocationSticker}>
                        <Text style={modalStyles.confirmBtnText}>Add Location</Text>
                    </TouchableOpacity>
                </View>
            </StoryModalShell>

            <StoryModalShell visible={showLinkModal} onRequestClose={() => setShowLinkModal(false)}>
                <View style={modalStyles.header}>
                    <View style={modalStyles.headerLeft}>
                        <Icon name="link-outline" size={ox(22)} color="#FFFFFF" />
                        <Text style={modalStyles.title}>Add Link</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowLinkModal(false)} hitSlop={8}>
                        <Icon name="close" size={ox(20)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
                <Text style={modalStyles.label}>Link Name / Description</Text>
                <TextInput
                    value={linkNameDraft}
                    onChangeText={setLinkNameDraft}
                    placeholder="e.g., Check out my website"
                    placeholderTextColor="#6B7280"
                    style={modalStyles.input}
                    maxLength={50}
                />
                <Text style={modalStyles.label}>URL</Text>
                <TextInput
                    value={linkUrlDraft}
                    onChangeText={setLinkUrlDraft}
                    placeholder="https://example.com"
                    placeholderTextColor="#6B7280"
                    style={modalStyles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <View style={modalStyles.actions}>
                    <TouchableOpacity
                        style={modalStyles.cancelBtn}
                        onPress={() => setShowLinkModal(false)}
                    >
                        <Text style={modalStyles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={modalStyles.confirmBtn} onPress={addLinkSticker}>
                        <Text style={modalStyles.confirmBtnText}>Add Link</Text>
                    </TouchableOpacity>
                </View>
            </StoryModalShell>

            <UserTaggingModalNative
                visible={showTagModal}
                onClose={() => setShowTagModal(false)}
                onSelectUser={addTaggedUser}
                taggedUsers={taggedUsers.map((tu) => tu.handle)}
            />
        </View>
    );
}

const modalStyles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ox(16),
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: ox(8) },
    title: { color: '#FFFFFF', fontSize: ox(20), fontWeight: '700' },
    label: { color: '#D1D5DB', fontSize: ox(14), fontWeight: '500', marginBottom: ox(8) },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: ox(12),
        paddingHorizontal: ox(14),
        paddingVertical: ox(12),
        color: '#FFFFFF',
        fontSize: ox(15),
        backgroundColor: '#000000',
        marginBottom: ox(14),
    },
    actions: { flexDirection: 'row', gap: ox(12), marginTop: ox(4) },
    cancelBtn: {
        flex: 1,
        paddingVertical: ox(14),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
    },
    cancelBtnText: { color: '#FFFFFF', fontSize: ox(15), fontWeight: '600' },
    confirmBtn: {
        flex: 1,
        paddingVertical: ox(14),
        borderRadius: ox(12),
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    confirmBtnText: { color: '#000000', fontSize: ox(15), fontWeight: '600' },
});

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000' },
    loading: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
    stage: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
    deselectLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    media: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(12),
        paddingBottom: ox(10),
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    headerBtn: { padding: ox(8), width: ox(40) },
    headerTitle: { color: '#FFFFFF', fontSize: ox(16), fontWeight: '600' },
    postBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: ox(16),
        paddingVertical: ox(8),
        borderRadius: ox(999),
        minWidth: ox(72),
        alignItems: 'center',
    },
    postBtnDisabled: { opacity: 0.5 },
    postBtnText: { color: '#000000', fontSize: ox(14), fontWeight: '700' },
    footerOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    audienceHint: { textAlign: 'center', fontSize: ox(11), paddingTop: ox(8), paddingBottom: ox(4) },
    railContent: { alignItems: 'center', paddingTop: ox(8), paddingBottom: ox(12) },
    railSlot: { width: RAIL_SLOT, height: ox(76), alignItems: 'center', justifyContent: 'center' },
    railRing: { padding: ox(2), borderRadius: ox(999) },
    railRingCentered: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.24,
        shadowRadius: 12,
        elevation: 8,
    },
    railInner: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    railTypeIcon: { color: '#FFFFFF', fontSize: ox(18), fontWeight: '700' },
    railTypeIconCentered: { fontSize: ox(20) },
    countBadge: {
        position: 'absolute',
        top: -4,
        right: -6,
        minWidth: ox(18),
        height: ox(18),
        borderRadius: ox(9),
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: ox(4),
    },
    countBadgeText: { color: '#000000', fontSize: ox(10), fontWeight: '700' },
    railLabel: { marginTop: ox(4), color: '#FFFFFF', fontSize: ox(10), opacity: 0.75, textAlign: 'center' },
    railLabelActive: { opacity: 0.95, fontWeight: '600' },
});
