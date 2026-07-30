import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    LayoutChangeEvent,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import Video, { type VideoRef } from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { saveDraft } from '../api/drafts.native';
import { getKnownUserHandles } from '../api/users';
import GalleryPreviewComposerPanel, {
    type GalleryPickerTab,
} from '../components/gallery/GalleryPreviewComposerPanel.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import StickerPickerNative from '../components/StickerPicker.native';
import StickerOverlayNative from '../components/StickerOverlay.native';
import TextStickerModalNative from '../components/TextStickerModal.native';
import UserTaggingModalNative from '../components/UserTaggingModal.native';
import type { Sticker, StickerOverlay } from '../types';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';
import {
    buildFilterInfo,
    getFilterOverlayStyle,
    type InstantFilterName,
} from '../utils/instantFiltersNative';
import { clampStickerY } from '../utils/stickerLayoutNative';
import { hapticLight } from '../utils/hapticsNative';
import { addPendingFeedUpload } from '../utils/pendingFeedUploadNative';
import { startBackgroundFeedUpload } from '../utils/runBackgroundFeedUploadNative';
import type { LocalCarouselItem } from '../utils/prepareCarouselMediaForPostNative';
import { showUploadOverlayNative } from '../utils/uploadOverlayNative';
import { ensureGalleryMediaPermission } from '../utils/galleryMediaPermissionsNative';
import { resetToHomeFeed } from '../utils/finishFeedPostNavigationNative';
import { ox } from '../constants/nativeOpticalScale';
import {
    failedToSaveSheet,
    nothingToSaveSheet,
    savedToDraftsSheet,
    type DraftSaveSheetState,
} from '../utils/draftSaveSheetNative';

const CAROUSEL_MAX = 10;

function assetIsVideo(asset: { type?: string; uri?: string }) {
    return Boolean(
        asset.type?.startsWith('video') ||
            asset.uri?.toLowerCase().endsWith('.mp4') ||
            asset.uri?.toLowerCase().endsWith('.mov'),
    );
}

function assetToCarouselItem(a: ImagePicker.Asset): LocalCarouselItem | null {
    if (!a.uri) return null;
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
    return slide;
}

function assetsToCarouselItems(assets: ImagePicker.Asset[], maxCount: number): LocalCarouselItem[] {
    const next: LocalCarouselItem[] = [];
    for (const a of assets) {
        if (next.length >= maxCount) break;
        const slide = assetToCarouselItem(a);
        if (slide) next.push(slide);
    }
    return next;
}

export default function GalleryPreviewScreen({ navigation, route }: any) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
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
    const [cardTab, setCardTab] = useState<GalleryPickerTab>('caption');
    const [caption, setCaption] = useState(passedCaption);
    const [location, setLocation] = useState('');
    const [venue, setVenue] = useState('');
    const [landmark, setLandmark] = useState('');
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const [showTagUserModal, setShowTagUserModal] = useState(false);
    const [imageFilterName, setImageFilterName] = useState<InstantFilterName>('None');
    const [stickers, setStickers] = useState<StickerOverlay[]>([]);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showTextStickerModal, setShowTextStickerModal] = useState(false);
    const [selectedStickerOverlay, setSelectedStickerOverlay] = useState<string | null>(null);
    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
    const [isMuted, setIsMuted] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [draftAlert, setDraftAlert] = useState<DraftSaveSheetState | null>(null);
    const [cardBodyExpanded, setCardBodyExpanded] = useState(true);
    const videoRef = useRef<VideoRef>(null);
    const previewCaptureRef = useRef<View>(null);

    const isCarousel = carouselItems.length > 1;
    const activeSlide = carouselItems[carouselActiveIndex];
    const previewUri = activeSlide?.uri;
    const previewType = activeSlide?.type;
    const previewCoverTime =
        activeSlide?.type === 'video' ? activeSlide.videoCoverTime ?? 0 : 0;

    const filterOverlayStyle = useMemo(
        () => getFilterOverlayStyle(imageFilterName),
        [imageFilterName],
    );
    const hasAppliedFilter = imageFilterName !== 'None';
    const filterForExport = hasAppliedFilter ? buildFilterInfo(imageFilterName) : null;

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
        void (async () => {
            const allowed = await ensureGalleryMediaPermission();
            if (!allowed) return;
            const remaining = CAROUSEL_MAX - carouselItems.length;
            if (remaining <= 0) {
                Alert.alert('Carousel full', `You can add up to ${CAROUSEL_MAX} photos or videos.`);
                return;
            }
            ImagePicker.launchImageLibrary(
                {
                    mediaType: 'mixed',
                    selectionLimit: remaining > 1 ? remaining : 1,
                    quality: 0.9,
                    videoQuality: 'high',
                    includeExtra: true,
                },
                (response) => {
                    if (response.didCancel) return;
                    if (response.errorCode) {
                        Alert.alert('Media error', response.errorMessage || 'Could not open your gallery.');
                        return;
                    }
                    const assets = response.assets || [];
                    if (assets.length < 1) return;
                    const toAdd = assetsToCarouselItems(assets, remaining);
                    if (toAdd.length === 0) return;
                    setCarouselItems((prev) => {
                        const existingUris = new Set(prev.map((item) => item.uri));
                        const merged = [
                            ...prev,
                            ...toAdd.filter((item) => !existingUris.has(item.uri)),
                        ];
                        return merged.slice(0, CAROUSEL_MAX);
                    });
                    setCardTab('carousel');
                },
            );
        })();
    }, [carouselItems.length]);

    const applyAssets = useCallback((assets: ImagePicker.Asset[]) => {
        const next = assetsToCarouselItems(assets, CAROUSEL_MAX);
        if (next.length === 0) return false;
        setCarouselItems(next);
        setCarouselActiveIndex(0);
        if (next.length > 1) setCardTab('carousel');
        return true;
    }, []);

    useEffect(() => {
        if (!autoStart) return;
        if (initialItems.length > 0) return;
        if (carouselItems.length > 0) return;

        if (autoStart.source === 'library') {
            void (async () => {
                const allowed = await ensureGalleryMediaPermission();
                if (!allowed) {
                    navigation.goBack();
                    return;
                }
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
            })();
            return;
        }

        if (autoStart.source === 'camera') {
            void (async () => {
                const allowed = await ensureGalleryMediaPermission();
                if (!allowed) {
                    navigation.goBack();
                    return;
                }
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
            })();
        }
    }, [applyAssets, autoStart, carouselItems.length, initialItems.length, navigation]);

    const removeCarouselItem = useCallback((index: number) => {
        setCarouselItems((prev) => {
            const next = prev.filter((_, i) => i !== index);
            return next;
        });
        setCarouselActiveIndex((prev) => {
            if (index < prev) return prev - 1;
            if (index === prev) return Math.max(0, prev - 1);
            return prev;
        });
    }, []);

    const reorderCarouselItems = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        setCarouselItems((prev) => {
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
                return prev;
            }
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
        });
        setCarouselActiveIndex((prev) => {
            if (prev === fromIndex) return toIndex;
            if (fromIndex < prev && toIndex >= prev) return prev - 1;
            if (fromIndex > prev && toIndex <= prev) return prev + 1;
            return prev;
        });
    }, []);

    const handleSaveDraft = async () => {
        if (carouselItems.length === 0) {
            setDraftAlert(nothingToSaveSheet('Add media before saving a draft.'));
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
            await new Promise<void>((resolve) => setTimeout(resolve, 50));
            setDraftAlert(
                savedToDraftsSheet(() =>
                    resetToHomeFeed(navigation, { forceRefreshAt: Date.now() }),
                ),
            );
        } catch (err: any) {
            setDraftAlert(failedToSaveSheet(err?.message));
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handlePost = () => {
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
            const first = carouselItems[0];
            if (!first) return;
            navigation.replace('Story24Composer', {
                mediaUrl: first.uri,
                mediaType: first.type,
                videoCoverTime: first.type === 'video' ? first.videoCoverTime ?? 0 : 0,
                videoDurationSec: first.type === 'video' ? first.durationSec : undefined,
            });
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
            initialMessage: 'Posting to Gazetteer…',
            uploadingTitle: 'Posting…',
            successTitle: 'Posted!',
        });
        hapticLight();
        setIsUploading(false);
        resetToHomeFeed(navigation, { forceRefreshAt: Date.now() });
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

    return (
        <View style={styles.root}>
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
                                paused={false}
                                repeat
                                muted={isMuted}
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
                                <Icon name="images-outline" size={ox(36)} color="#9CA3AF" />
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

                <View style={[styles.overlayHeader, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity style={styles.overlayBtn} onPress={() => navigation.goBack()}>
                        <Icon name="arrow-back" size={ox(24)} color="#FFFFFF" />
                    </TouchableOpacity>

                    {isCarousel ? (
                        <View style={styles.carouselNav}>
                            <TouchableOpacity
                                style={styles.overlayBtn}
                                disabled={carouselActiveIndex === 0}
                                onPress={() => setCarouselActiveIndex((i) => Math.max(0, i - 1))}
                            >
                                <Icon
                                    name="chevron-back"
                                    size={ox(18)}
                                    color={carouselActiveIndex === 0 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                                />
                            </TouchableOpacity>
                            <Text style={styles.carouselCounter}>
                                {carouselActiveIndex + 1} / {carouselItems.length}
                            </Text>
                            <TouchableOpacity
                                style={styles.overlayBtn}
                                disabled={carouselActiveIndex >= carouselItems.length - 1}
                                onPress={() =>
                                    setCarouselActiveIndex((i) =>
                                        Math.min(carouselItems.length - 1, i + 1),
                                    )
                                }
                            >
                                <Icon
                                    name="chevron-forward"
                                    size={ox(18)}
                                    color={
                                        carouselActiveIndex >= carouselItems.length - 1
                                            ? 'rgba(255,255,255,0.35)'
                                            : '#FFFFFF'
                                    }
                                />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.headerSpacer} />
                    )}

                    <View style={styles.headerRight}>
                        {previewType === 'video' ? (
                            <TouchableOpacity
                                style={styles.overlayBtn}
                                onPress={() => setIsMuted((m) => !m)}
                            >
                                <Icon
                                    name={isMuted ? 'volume-mute' : 'volume-high'}
                                    size={ox(20)}
                                    color="#FFFFFF"
                                />
                            </TouchableOpacity>
                        ) : null}
                        <View style={styles.postRing}>
                            <TouchableOpacity
                                style={styles.postBtn}
                                onPress={() => void handlePost()}
                                disabled={isUploading || carouselItems.length === 0}
                            >
                                {isUploading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Icon name="send" size={ox(22)} color="#FFFFFF" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>

            <GalleryPreviewComposerPanel
                cardTab={cardTab}
                onCardTabChange={setCardTab}
                cardBodyExpanded={cardBodyExpanded}
                onToggleExpanded={() => setCardBodyExpanded((v) => !v)}
                caption={caption}
                onCaptionChange={onCaptionChange}
                mentionSuggestions={mentionSuggestions}
                onInsertMention={insertMention}
                location={location}
                venue={venue}
                landmark={landmark}
                onLocationChange={setLocation}
                onVenueChange={setVenue}
                onLandmarkChange={setLandmark}
                taggedUsers={taggedUsers}
                onOpenTagModal={() => setShowTagUserModal(true)}
                imageFilterName={imageFilterName}
                onFilterChange={setImageFilterName}
                previewUri={previewUri}
                previewType={previewType}
                carouselItems={carouselItems}
                carouselActiveIndex={carouselActiveIndex}
                onCarouselIndexChange={setCarouselActiveIndex}
                onAddCarousel={addCarouselFromPicker}
                onRemoveCarouselItem={removeCarouselItem}
                onReorderCarouselItems={reorderCarouselItems}
                isSavingDraft={isSavingDraft}
                onSaveDraft={() => void handleSaveDraft()}
                onOpenStickerPicker={() => setShowStickerPicker(true)}
                onOpenTextSticker={() => setShowTextStickerModal(true)}
                canSave={carouselItems.length > 0}
            />

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
            <UserTaggingModalNative
                visible={showTagUserModal}
                onClose={() => setShowTagUserModal(false)}
                taggedUsers={taggedUsers}
                onSelectUser={(handle) => {
                    const normalized = handle.replace(/^@+/, '').trim();
                    if (!normalized) return;
                    setTaggedUsers((prev) =>
                        prev.includes(normalized) ? prev : [...prev, normalized],
                    );
                    setShowTagUserModal(false);
                }}
            />
            <GazetteerAlertSheet
                visible={draftAlert != null}
                title={draftAlert?.title ?? ''}
                message={draftAlert?.message}
                icon={draftAlert?.icon ?? 'alert'}
                confirmButtonText={draftAlert?.confirmButtonText ?? 'OK'}
                onConfirm={() => {
                    const action = draftAlert?.onConfirm;
                    setDraftAlert(null);
                    action?.();
                }}
                onDismiss={() => setDraftAlert(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
    },
    previewSection: {
        flex: 1,
        minHeight: 0,
        position: 'relative',
    },
    previewWrap: {
        flex: 1,
        backgroundColor: '#000000',
        overflow: 'hidden',
    },
    previewCapture: {
        flex: 1,
        minHeight: ox(180),
    },
    previewMedia: {
        width: '100%',
        height: '100%',
    },
    filterOverlay: {
        ...StyleSheet.absoluteFill,
    },
    stickerDeselect: {
        ...StyleSheet.absoluteFill,
    },
    emptyPick: {
        flex: 1,
        minHeight: ox(180),
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(8),
    },
    emptyPickText: {
        color: '#9CA3AF',
        fontSize: ox(14),
    },
    overlayHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(16),
        paddingBottom: ox(8),
        zIndex: 10,
    },
    overlayBtn: {
        padding: ox(8),
        borderRadius: ox(999),
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    carouselNav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
    },
    carouselCounter: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
        minWidth: ox(48),
        textAlign: 'center',
    },
    headerSpacer: {
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
    },
    postRing: {
        borderRadius: ox(999),
        padding: ox(1.5),
        backgroundColor: '#FFFFFF',
    },
    postBtn: {
        padding: ox(10),
        borderRadius: ox(999),
        backgroundColor: '#000000',
    },
});
