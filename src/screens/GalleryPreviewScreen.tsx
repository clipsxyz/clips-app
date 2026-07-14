import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    LayoutChangeEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import Video, { type VideoRef } from 'react-native-video';
import { useAuth } from '../context/Auth';
import { saveDraft } from '../api/drafts';
import { getKnownUserHandles } from '../api/users';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField.native';
import StickerPickerNative from '../components/StickerPicker.native';
import StickerOverlayNative from '../components/StickerOverlay.native';
import TextStickerModalNative from '../components/TextStickerModal.native';
import VideoCoverControls from '../components/VideoCoverControls.native';
import type { Sticker, StickerOverlay } from '../types';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';
import { glassPanel, glassSurface, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import {
    buildFilterInfo,
    getFilterOverlayStyle,
    INSTANT_FILTER_NAMES,
    type InstantFilterName,
} from '../utils/instantFiltersNative';
import { clampStickerY } from '../utils/stickerLayoutNative';
import { hapticLight } from '../utils/hapticsNative';
import { addPendingFeedUpload } from '../utils/pendingFeedUploadNative';
import { startBackgroundFeedUpload } from '../utils/runBackgroundFeedUploadNative';
import type { LocalCarouselItem } from '../utils/prepareCarouselMediaForPostNative';
import { showUploadOverlayNative } from '../utils/uploadOverlayNative';

const CAROUSEL_MAX = 10;
type ComposerTab = 'caption' | 'filters' | 'stickers' | 'location' | 'carousel';

function assetIsVideo(asset: { type?: string; uri?: string }) {
    return Boolean(
        asset.type?.startsWith('video') ||
            asset.uri?.toLowerCase().endsWith('.mp4') ||
            asset.uri?.toLowerCase().endsWith('.mov'),
    );
}

export default function GalleryPreviewScreen({ navigation, route }: any) {
    const { user } = useAuth();
    const story24 = !!route.params?.story24;
    const passedCaption = route.params?.draftCaption || '';
    const autoStart = route.params?.autoStart as
        | undefined
        | {
              source: 'library' | 'camera';
              kind: 'single' | 'carousel';
              mediaType?: 'photo' | 'video' | 'mixed';
          };

    const initialItems: LocalCarouselItem[] = useMemo(() => {
        const fromRoute = route.params?.carouselItems;
        if (Array.isArray(fromRoute) && fromRoute.length > 0) {
            return fromRoute.slice(0, CAROUSEL_MAX);
        }
        const mediaUrl = route.params?.mediaUrl;
        if (!mediaUrl) return [];
        const mediaType: 'image' | 'video' =
            route.params?.mediaType === 'video' ? 'video' : 'image';
        return [
            {
                uri: mediaUrl,
                type: mediaType,
                videoCoverTime: mediaType === 'video' ? Number(route.params?.videoCoverTime || 0) : undefined,
                durationSec:
                    mediaType === 'video'
                        ? Math.max(0.1, Number(route.params?.videoDuration || 15))
                        : undefined,
            },
        ];
    }, [route.params]);

    const [carouselItems, setCarouselItems] = useState<LocalCarouselItem[]>(initialItems);
    const [carouselActiveIndex, setCarouselActiveIndex] = useState(0);
    const [cardTab, setCardTab] = useState<ComposerTab>('caption');
    const [caption, setCaption] = useState(passedCaption);
    const [location, setLocation] = useState('');
    const [venue, setVenue] = useState('');
    const [landmark, setLandmark] = useState('');
    const [taggedUsersInput, setTaggedUsersInput] = useState('');
    const [imageFilterName, setImageFilterName] = useState<InstantFilterName>('None');
    const [stickers, setStickers] = useState<StickerOverlay[]>([]);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showTextStickerModal, setShowTextStickerModal] = useState(false);
    const [selectedStickerOverlay, setSelectedStickerOverlay] = useState<string | null>(null);
    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [toolsExpanded, setToolsExpanded] = useState(true);
    const videoRef = useRef<VideoRef>(null);
    const previewCaptureRef = useRef<View>(null);

    const isCarousel = carouselItems.length > 1;
    const activeSlide = carouselItems[carouselActiveIndex];
    const previewUri = activeSlide?.uri;
    const previewType = activeSlide?.type;
    const previewCoverTime =
        activeSlide?.type === 'video' ? activeSlide.videoCoverTime ?? 0 : 0;
    const previewDurationSec =
        activeSlide?.type === 'video' ? activeSlide.durationSec ?? 15 : 15;

    const filterOverlayStyle = useMemo(
        () => getFilterOverlayStyle(imageFilterName),
        [imageFilterName],
    );
    const hasAppliedFilter = imageFilterName !== 'None';
    const filterForExport = hasAppliedFilter ? buildFilterInfo(imageFilterName) : null;

    const taggedUsers = useMemo(
        () =>
            taggedUsersInput
                .split(',')
                .map((v) => v.trim().replace(/^@+/, ''))
                .filter((v, idx, arr) => v.length > 0 && arr.indexOf(v) === idx),
        [taggedUsersInput],
    );

    const mentionHandles = useMemo(() => getKnownUserHandles(), []);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const mentionSuggestions = useMemo(() => {
        if (!mentionQuery) return [];
        const q = mentionQuery.toLowerCase();
        return mentionHandles
            .filter((h) => h.toLowerCase().includes(q))
            .slice(0, 6);
    }, [mentionHandles, mentionQuery]);

    useEffect(() => {
        if (previewType !== 'video' || !previewUri) return;
        videoRef.current?.seek(Math.max(0, previewCoverTime));
    }, [previewCoverTime, previewType, previewUri, carouselActiveIndex]);

    const setPreviewCoverTime = useCallback(
        (timeSec: number) => {
            setCarouselItems((prev) =>
                prev.map((item, i) =>
                    i === carouselActiveIndex && item.type === 'video'
                        ? { ...item, videoCoverTime: timeSec }
                        : item,
                ),
            );
        },
        [carouselActiveIndex],
    );

    const updatePreviewVideoDuration = useCallback(
        (duration: number) => {
            const rounded = Math.max(0.1, Math.floor(duration * 10) / 10);
            setCarouselItems((prev) =>
                prev.map((item, i) => {
                    if (i !== carouselActiveIndex || item.type !== 'video') return item;
                    const cover = Math.min(Math.max(0, item.videoCoverTime ?? 0), rounded);
                    return { ...item, durationSec: rounded, videoCoverTime: cover };
                }),
            );
        },
        [carouselActiveIndex],
    );

    const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setPreviewSize({ width, height });
    }, []);

    const addCarouselFromPicker = useCallback(() => {
        ImagePicker.launchImageLibrary(
            { mediaType: 'mixed', selectionLimit: CAROUSEL_MAX, quality: 0.9, videoQuality: 'high' },
            (response) => {
                if (response.didCancel) return;
                const assets = response.assets || [];
                if (assets.length < 1) return;
                const next: LocalCarouselItem[] = [];
                for (const a of assets) {
                    if (next.length >= CAROUSEL_MAX) break;
                    if (!a.uri) continue;
                    const isVideo = assetIsVideo(a);
                    const slide: LocalCarouselItem = {
                        uri: a.uri,
                        type: isVideo ? 'video' : 'image',
                    };
                    if (isVideo) {
                        slide.videoCoverTime = 0;
                        const d = Number(a.duration || 0);
                        if (Number.isFinite(d) && d > 0) {
                            slide.durationSec = Math.max(0.1, Math.floor(d * 10) / 10);
                        }
                    }
                    next.push(slide);
                }
                if (next.length === 0) return;
                setCarouselItems(next);
                setCarouselActiveIndex(0);
                if (next.length > 1) setCardTab('carousel');
            },
        );
    }, []);

    const applyAssets = useCallback((assets: ImagePicker.Asset[]) => {
        const next: LocalCarouselItem[] = [];
        for (const a of assets) {
            if (next.length >= CAROUSEL_MAX) break;
            if (!a.uri) continue;
            const isVideo = assetIsVideo(a);
            const slide: LocalCarouselItem = {
                uri: a.uri,
                type: isVideo ? 'video' : 'image',
            };
            if (isVideo) {
                slide.videoCoverTime = 0;
                const d = Number(a.duration || 0);
                if (Number.isFinite(d) && d > 0) {
                    slide.durationSec = Math.max(0.1, Math.floor(d * 10) / 10);
                }
            }
            next.push(slide);
        }
        if (next.length === 0) return false;
        setCarouselItems(next);
        setCarouselActiveIndex(0);
        if (next.length > 1) setCardTab('carousel');
        return true;
    }, []);

    useEffect(() => {
        // When opened from CreateComposer with no media, auto-start pickers to match web flow:
        // choose media → preview/tools → (optional) open full studio composer.
        if (!autoStart) return;
        if (initialItems.length > 0) return;
        if (carouselItems.length > 0) return;

        if (autoStart.source === 'library') {
            ImagePicker.launchImageLibrary(
                {
                    mediaType: autoStart.mediaType ?? 'mixed',
                    selectionLimit: autoStart.kind === 'carousel' ? CAROUSEL_MAX : 1,
                    quality: 0.9,
                    videoQuality: 'high',
                },
                (response) => {
                    if (response.didCancel) {
                        navigation.goBack();
                        return;
                    }
                    if (response.errorCode) {
                        Alert.alert('Media error', response.errorMessage || 'Could not open your library.');
                        navigation.goBack();
                        return;
                    }
                    const ok = applyAssets(response.assets || []);
                    if (!ok) navigation.goBack();
                },
            );
            return;
        }

        if (autoStart.source === 'camera') {
            const mediaType = autoStart.mediaType === 'video' ? 'video' : 'photo';
            ImagePicker.launchCamera(
                { mediaType, quality: mediaType === 'video' ? 0.8 : 0.9, videoQuality: 'high' },
                (response) => {
                    if (response.didCancel) {
                        navigation.goBack();
                        return;
                    }
                    if (response.errorCode) {
                        Alert.alert('Camera error', response.errorMessage || 'Could not open camera.');
                        navigation.goBack();
                        return;
                    }
                    const ok = applyAssets(response.assets || []);
                    if (!ok) navigation.goBack();
                },
            );
        }
    }, [applyAssets, autoStart, carouselItems.length, initialItems.length, navigation]);

    const openStudioComposer = () => {
        if (carouselItems.length === 0) return;
        if (carouselItems.length === 1) {
            const only = carouselItems[0];
            if (only.type === 'video') {
                navigation.navigate('InstantFilters', {
                    videoUrl: only.uri,
                    mediaUrl: only.uri,
                    mediaType: 'video',
                    videoDuration: only.durationSec ?? 15,
                    videoCoverTime: only.videoCoverTime ?? 0,
                    draftCaption: caption,
                    draftLocation: location,
                    draftVenue: venue,
                    draftLandmark: landmark,
                    draftTaggedUsers: taggedUsers,
                    draftStickers: stickers,
                    story24,
                });
                return;
            }
            navigation.navigate('CreateComposer', {
                mediaUrl: only.uri,
                mediaType: only.type,
                draftCaption: caption,
                draftLocation: location,
                draftVenue: venue,
                draftLandmark: landmark,
                draftTaggedUsers: taggedUsers,
                draftStickers: stickers,
                story24,
            });
            return;
        }
        navigation.navigate('CreateComposer', {
            carouselItems,
            draftCaption: caption,
            draftLocation: location,
            draftVenue: venue,
            draftLandmark: landmark,
            draftTaggedUsers: taggedUsers,
            draftStickers: stickers,
            story24,
        });
    };

    const handleSaveDraft = async () => {
        if (carouselItems.length === 0) {
            Alert.alert('Nothing to save', 'Add media before saving a draft.');
            return;
        }
        if (isSavingDraft) return;
        setIsSavingDraft(true);
        try {
            const first = carouselItems[0];
            await saveDraft({
                videoUrl: first.uri,
                videoDuration: first.type === 'video' ? first.durationSec ?? 15 : 0,
                caption: caption.trim() || undefined,
                location: location.trim() || undefined,
                venue: venue.trim() || undefined,
                landmark: landmark.trim() || undefined,
                taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
                mediaType: first.type,
                videoCoverTime: first.type === 'video' ? first.videoCoverTime : undefined,
                filterActive: hasAppliedFilter ? imageFilterName : undefined,
                stickers: stickers.length > 0 ? stickers : undefined,
                mediaItems: carouselItems.map((item) => ({
                    url: item.uri,
                    type: item.type,
                    duration: item.durationSec,
                })),
            });
            hapticLight();
            Alert.alert('Saved', 'Draft saved. Open it from your profile drafts.');
            navigation.navigate('Home');
        } catch (err: any) {
            Alert.alert('Draft failed', err?.message || 'Could not save draft.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handlePost = async () => {
        if (!user) {
            Alert.alert('Sign in required', 'Please log in to post.');
            return;
        }
        if (carouselItems.length === 0) {
            Alert.alert('Add media', 'Choose at least one photo or video.');
            return;
        }
        if (isUploading) return;

        if (story24) {
            openStudioComposer();
            return;
        }

        const captionText = caption.trim();
        const locationLabel = location.trim() || user.regional || 'Unknown';

        const first = carouselItems[0];
        if (!first) return;

        setIsUploading(true);
        const tempId = `pending-${Date.now()}`;
        addPendingFeedUpload({
            tempId,
            userId: user.id,
            userHandle: user.handle,
            text: captionText,
            location: locationLabel,
            localMediaUri: first.uri,
            localThumbUri: first.uri,
            localMediaItems: isCarousel ? carouselItems : undefined,
            mediaType: first.type,
            videoCoverTime:
                first.type === 'video'
                    ? first.videoCoverTime ?? 0
                    : carouselItems.find((i) => i.type === 'video')?.videoCoverTime ?? 0,
            filterForExport,
            userLocal: user.local,
            userRegional: user.regional,
            userNational: user.national,
            stickers: stickers.length > 0 ? stickers : undefined,
            taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
            venue: venue.trim() || undefined,
            landmark: landmark.trim() || undefined,
        });
        showUploadOverlayNative({
            jobId: tempId,
            thumbUri: first.uri,
            thumbType: first.type === 'video' ? 'video' : 'image',
        });
        hapticLight();
        navigation.navigate('Home', { forceRefreshAt: Date.now() });
        setIsUploading(false);
        startBackgroundFeedUpload(tempId);
    };

    const onCaptionChange = (text: string) => {
        setCaption(text.slice(0, TEXT_POST_BODY_MAX_LENGTH));
        const at = text.lastIndexOf('@');
        if (at >= 0) {
            const tail = text.slice(at + 1);
            if (!tail.includes(' ') && tail.length >= 1) {
                setMentionQuery(tail);
                return;
            }
        }
        setMentionQuery(null);
    };

    const insertMention = (handle: string) => {
        const at = caption.lastIndexOf('@');
        if (at < 0) return;
        const before = caption.slice(0, at);
        const next = `${before}${handle} `;
        setCaption(next.slice(0, TEXT_POST_BODY_MAX_LENGTH));
        setMentionQuery(null);
    };

    const tabs: Array<{ id: ComposerTab; label: string; icon: string }> = [
        { id: 'caption', label: 'Caption', icon: 'text' },
        { id: 'filters', label: 'Filters', icon: 'color-filter' },
        { id: 'stickers', label: 'Stickers', icon: 'happy' },
        { id: 'location', label: 'Place', icon: 'location' },
        ...(isCarousel ? [{ id: 'carousel' as const, label: 'Slides', icon: 'albums' }] : []),
    ];

    return (
        <GazetteerScreenShell edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.title}>Gallery</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleSaveDraft} disabled={isSavingDraft || carouselItems.length === 0}>
                        {isSavingDraft ? (
                            <ActivityIndicator size="small" color="#9CA3AF" />
                        ) : (
                            <Icon name="bookmark-outline" size={22} color="#E5E7EB" />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePost} disabled={isUploading || carouselItems.length === 0}>
                        {isUploading ? (
                            <ActivityIndicator size="small" color="#f472b6" />
                        ) : (
                            <Text style={styles.postText}>Post</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.previewSection}>
                <View style={styles.previewWrap} onLayout={handlePreviewLayout}>
                    <View ref={previewCaptureRef} style={styles.previewCapture} collapsable={false}>
                        {previewType === 'video' && previewUri ? (
                            <Video
                                key={`preview-${carouselActiveIndex}-${previewUri}`}
                                ref={videoRef}
                                source={{ uri: previewUri }}
                                style={styles.previewMedia}
                                resizeMode="contain"
                                paused={isVideoPaused}
                                repeat
                                controls
                                muted
                                onLoad={(event) => {
                                    const duration = Number(event?.duration || 0);
                                    if (!Number.isFinite(duration) || duration <= 0) return;
                                    updatePreviewVideoDuration(duration);
                                }}
                            />
                        ) : previewUri ? (
                            <Image source={{ uri: previewUri }} style={styles.previewMedia} resizeMode="contain" />
                        ) : (
                            <TouchableOpacity style={styles.emptyPick} onPress={addCarouselFromPicker}>
                                <Icon name="images-outline" size={36} color="#9CA3AF" />
                                <Text style={styles.emptyPickText}>Choose photos or videos</Text>
                            </TouchableOpacity>
                        )}
                        {filterOverlayStyle ? (
                            <View pointerEvents="none" style={[styles.filterOverlay, filterOverlayStyle]} />
                        ) : null}
                    </View>
                    <Pressable style={styles.stickerDeselect} onPress={() => setSelectedStickerOverlay(null)} />
                    {previewSize.width > 0 &&
                        stickers.map((overlay) => (
                            <StickerOverlayNative
                                key={overlay.id}
                                overlay={overlay}
                                onUpdate={(updated) =>
                                    setStickers((prev) =>
                                        prev.map((s) => (s.id === overlay.id ? updated : s)),
                                    )
                                }
                                onRemove={() =>
                                    setStickers((prev) => prev.filter((s) => s.id !== overlay.id))
                                }
                                isSelected={selectedStickerOverlay === overlay.id}
                                onSelect={() => setSelectedStickerOverlay(overlay.id)}
                                containerWidth={previewSize.width}
                                containerHeight={previewSize.height}
                            />
                        ))}
                </View>
                {previewType === 'video' ? (
                    <View style={styles.coverControlsWrap}>
                        <VideoCoverControls
                            durationSec={previewDurationSec}
                            coverTime={previewCoverTime}
                            onCoverTimeChange={setPreviewCoverTime}
                            onScrubPreview={(timeSec) => {
                                videoRef.current?.seek(Math.max(0, timeSec));
                                setIsVideoPaused(true);
                            }}
                        />
                    </View>
                ) : null}
            </View>

            <View style={styles.toolsPanel}>
                <TouchableOpacity
                    style={styles.toolsToggle}
                    onPress={() => setToolsExpanded((v) => !v)}
                >
                    <View style={styles.toolsGrabber} />
                    <Text style={styles.toolsToggleText}>
                        {toolsExpanded ? 'Tap to collapse' : 'Tap to expand'}
                    </Text>
                </TouchableOpacity>
                {toolsExpanded ? (
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
                            {tabs.map((tab) => (
                                <TouchableOpacity
                                    key={tab.id}
                                    onPress={() => setCardTab(tab.id)}
                                    style={[styles.tabChip, cardTab === tab.id && styles.tabChipActive]}
                                >
                                    <Icon
                                        name={tab.icon}
                                        size={14}
                                        color={cardTab === tab.id ? '#FBCFE8' : '#9CA3AF'}
                                    />
                                    <Text
                                        style={[
                                            styles.tabChipText,
                                            cardTab === tab.id && styles.tabChipTextActive,
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <ScrollView style={styles.tabBody} keyboardShouldPersistTaps="handled">
                            {cardTab === 'caption' && (
                                <View>
                                    <TextInput
                                        value={caption}
                                        onChangeText={onCaptionChange}
                                        placeholder="Write a caption..."
                                        placeholderTextColor="#6B7280"
                                        style={styles.captionInput}
                                        multiline
                                    />
                                    {mentionSuggestions.length > 0 ? (
                                        <View style={styles.mentionList}>
                                            {mentionSuggestions.map((h) => (
                                                <TouchableOpacity
                                                    key={h}
                                                    onPress={() => insertMention(h.startsWith('@') ? h : `@${h}`)}
                                                    style={styles.mentionRow}
                                                >
                                                    <Text style={styles.mentionText}>{h}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}
                                    <TextInput
                                        value={taggedUsersInput}
                                        onChangeText={setTaggedUsersInput}
                                        placeholder="Tag users (comma-separated handles)"
                                        placeholderTextColor="#6B7280"
                                        style={styles.tagInput}
                                    />
                                </View>
                            )}
                            {cardTab === 'filters' && previewUri ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {INSTANT_FILTER_NAMES.map((name) => (
                                        <TouchableOpacity
                                            key={name}
                                            onPress={() => setImageFilterName(name)}
                                            style={[
                                                styles.filterChip,
                                                imageFilterName === name && styles.filterChipActive,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.filterChipText,
                                                    imageFilterName === name && styles.filterChipTextActive,
                                                ]}
                                            >
                                                {name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            ) : null}
                            {cardTab === 'stickers' && (
                                <View style={styles.stickerActions}>
                                    <TouchableOpacity
                                        style={styles.toolActionBtn}
                                        onPress={() => setShowStickerPicker(true)}
                                    >
                                        <Icon name="happy-outline" size={18} color="#FBCFE8" />
                                        <Text style={styles.toolActionText}>Add sticker</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.toolActionBtn}
                                        onPress={() => setShowTextStickerModal(true)}
                                    >
                                        <Icon name="text" size={18} color="#FBCFE8" />
                                        <Text style={styles.toolActionText}>Add text</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {cardTab === 'location' && (
                                <View style={styles.locationFields}>
                                    <PlaceAutocompleteField
                                        value={location}
                                        onChange={setLocation}
                                        placeholder="City or neighborhood"
                                    />
                                    <PlaceAutocompleteField
                                        value={venue}
                                        onChange={setVenue}
                                        placeholder="Venue (optional)"
                                    />
                                    <PlaceAutocompleteField
                                        value={landmark}
                                        onChange={setLandmark}
                                        placeholder="Landmark (optional)"
                                    />
                                </View>
                            )}
                            {cardTab === 'carousel' && isCarousel && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.carouselRailContent}
                                >
                                    {carouselItems.map((item, index) => (
                                        <TouchableOpacity
                                            key={`${item.uri}-${index}`}
                                            onPress={() => setCarouselActiveIndex(index)}
                                            style={[
                                                styles.carouselThumbWrap,
                                                index === carouselActiveIndex &&
                                                    styles.carouselThumbWrapActive,
                                            ]}
                                        >
                                            {item.type === 'video' ? (
                                                <View style={styles.carouselThumbVideo}>
                                                    <Icon name="videocam" size={18} color="#E5E7EB" />
                                                </View>
                                            ) : (
                                                <Image source={{ uri: item.uri }} style={styles.carouselThumb} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                    {carouselItems.length < CAROUSEL_MAX ? (
                                        <TouchableOpacity
                                            style={styles.addSlideBtn}
                                            onPress={addCarouselFromPicker}
                                        >
                                            <Icon name="add" size={22} color="#FBCFE8" />
                                        </TouchableOpacity>
                                    ) : null}
                                </ScrollView>
                            )}
                        </ScrollView>
                        <TouchableOpacity style={styles.studioLink} onPress={openStudioComposer}>
                            <Icon name="color-wand-outline" size={16} color="#93C5FD" />
                            <Text style={styles.studioLinkText}>Open full studio composer</Text>
                        </TouchableOpacity>
                    </>
                ) : null}
            </View>

            <StickerPickerNative
                visible={showStickerPicker}
                onClose={() => setShowStickerPicker(false)}
                onSelectSticker={(sticker: Sticker) => {
                    const overlay: StickerOverlay = {
                        id: `sticker-${Date.now()}`,
                        stickerId: sticker.id,
                        sticker,
                        x: 50,
                        y: clampStickerY(50),
                        scale: 1,
                        rotation: 0,
                        opacity: 1,
                    };
                    setStickers((prev) => [...prev, overlay]);
                    setSelectedStickerOverlay(overlay.id);
                    setShowStickerPicker(false);
                }}
            />
            <TextStickerModalNative
                visible={showTextStickerModal}
                onClose={() => setShowTextStickerModal(false)}
                onConfirm={(textValue, fontSize, color) => {
                    const textSticker: Sticker = {
                        id: `text-${Date.now()}`,
                        name: textValue,
                        category: 'Text',
                    };
                    const overlay: StickerOverlay = {
                        id: `sticker-${Date.now()}`,
                        stickerId: textSticker.id,
                        sticker: textSticker,
                        x: 50,
                        y: clampStickerY(50),
                        scale: fontSize === 'small' ? 0.8 : fontSize === 'large' ? 1.2 : 1,
                        rotation: 0,
                        opacity: 1,
                        textContent: textValue,
                        textColor: color,
                        fontSize,
                    };
                    setStickers((prev) => [...prev, overlay]);
                    setShowTextStickerModal(false);
                }}
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        ...gazetteerHeader,
    },
    title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 8 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    postText: { color: '#f472b6', fontSize: 15, fontWeight: '700' },
    previewSection: { flex: 1, minHeight: 200 },
    previewWrap: {
        flex: 1,
        marginHorizontal: 12,
        marginTop: 8,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    previewCapture: { flex: 1, minHeight: 220 },
    previewMedia: { width: '100%', height: '100%', minHeight: 220 },
    filterOverlay: { ...StyleSheet.absoluteFillObject },
    stickerDeselect: { ...StyleSheet.absoluteFillObject },
    coverControlsWrap: { paddingHorizontal: 16, paddingBottom: 8 },
    emptyPick: {
        flex: 1,
        minHeight: 220,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyPickText: { color: '#9CA3AF', fontSize: 14 },
    toolsPanel: {
        maxHeight: '42%',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        ...glassPanel,
        paddingBottom: 8,
    },
    toolsToggle: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
    },
    toolsToggleText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
    toolsGrabber: {
        width: 56,
        height: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
    tabRow: { maxHeight: 40, marginBottom: 8, paddingHorizontal: 12 },
    tabChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 999,
        ...glassSurface,
    },
    tabChipActive: {
        borderColor: 'rgba(244,114,182,0.55)',
        backgroundColor: 'rgba(244,114,182,0.15)',
    },
    tabChipText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
    tabChipTextActive: { color: '#FBCFE8' },
    tabBody: { maxHeight: 200, paddingHorizontal: 12 },
    tabHint: { color: '#9CA3AF', fontSize: 13, paddingVertical: 8 },
    captionInput: {
        minHeight: 72,
        borderRadius: 12,
        padding: 12,
        color: '#F9FAFB',
        backgroundColor: 'rgba(15,23,42,0.9)',
        textAlignVertical: 'top',
    },
    tagInput: {
        marginTop: 8,
        borderRadius: 12,
        padding: 12,
        color: '#F9FAFB',
        backgroundColor: 'rgba(15,23,42,0.9)',
    },
    mentionList: {
        marginTop: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(15,23,42,0.95)',
        overflow: 'hidden',
    },
    mentionRow: { paddingHorizontal: 12, paddingVertical: 10 },
    mentionText: { color: '#E5E7EB', fontSize: 14 },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        marginRight: 8,
        ...glassSurface,
    },
    filterChipActive: {
        backgroundColor: 'rgba(244,114,182,0.2)',
        borderColor: 'rgba(244,114,182,0.5)',
    },
    filterChipText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
    filterChipTextActive: { color: '#FBCFE8' },
    stickerActions: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
    toolActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        ...glassSurface,
    },
    toolActionText: { color: '#E5E7EB', fontSize: 13, fontWeight: '600' },
    locationFields: { gap: 10, paddingVertical: 4 },
    carouselRailContent: { gap: 8, paddingVertical: 8 },
    carouselThumbWrap: {
        width: 64,
        height: 64,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        backgroundColor: '#111827',
    },
    carouselThumbWrapActive: { borderColor: '#F472B6' },
    carouselThumb: { width: '100%', height: '100%' },
    carouselThumbVideo: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1F2937',
    },
    addSlideBtn: {
        width: 64,
        height: 64,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(244,114,182,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    studioLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
    },
    studioLinkText: { color: '#93C5FD', fontSize: 12, fontWeight: '600' },
});
