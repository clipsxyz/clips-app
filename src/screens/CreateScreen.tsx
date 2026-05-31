import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    LayoutChangeEvent,
    Pressable,
    Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import ImageCropPicker from 'react-native-image-crop-picker';
import Video, { type VideoRef } from 'react-native-video';
import VideoCoverControls from '../components/VideoCoverControls.native';
import { useAuth } from '../context/Auth';
import { createPost } from '../api/posts';
import { publishMediaStory24 } from '../utils/publishStoryNative';
import { prepareMediaForPostNative } from '../utils/prepareMediaForPostNative';
import { saveDraft } from '../api/drafts';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel, glassSurface } from '../theme/gazetteerAmbientNative';
import StickerPickerNative from '../components/StickerPicker.native';
import StickerOverlayNative from '../components/StickerOverlay.native';
import TextStickerModalNative from '../components/TextStickerModal.native';
import type { Sticker, StickerOverlay } from '../types';
import { clampStickerY } from '../utils/stickerLayoutNative';
import { hapticLight, hapticSuccess } from '../utils/hapticsNative';
import {
    buildFilterInfo,
    getFilterOverlayStyle,
    INSTANT_FILTER_NAMES,
    isFiltered,
    type InstantFilterInfo,
    type InstantFilterName,
} from '../utils/instantFiltersNative';
import { captureFilteredPreviewFromRef } from '../utils/captureFilteredPreviewNative';
import { addPendingFeedUpload } from '../utils/pendingFeedUploadNative';
import { startBackgroundFeedUpload } from '../utils/runBackgroundFeedUploadNative';
import { showUploadOverlayNative } from '../utils/uploadOverlayNative';
import type { LocalCarouselItem } from '../utils/prepareCarouselMediaForPostNative';

export default function CreateScreen({ navigation, route }: any) {
    const { user } = useAuth();
    const isAddYoursFlow = !!route.params?.addYours;
    const isStory24Flow = !!route.params?.story24;
    const passedMedia = route.params?.videoUrl || route.params?.mediaUrl;
    const passedMediaType: 'image' | 'video' | null = route.params?.videoUrl
        ? 'video'
        : route.params?.mediaUrl
            ? (route.params?.mediaType === 'video' ? 'video' : 'image')
            : null;

    const normalizeMediaUri = (uri?: string | null): string | null => {
        if (!uri) return null;
        const trimmed = uri.trim();
        if (!trimmed) return null;
        if (
            trimmed.startsWith('file://') ||
            trimmed.startsWith('content://') ||
            trimmed.startsWith('ph://') ||
            trimmed.startsWith('http://') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('data:')
        ) {
            return trimmed;
        }
        return `file://${trimmed}`;
    };
    
    const [selectedMedia, setSelectedMedia] = useState<string | null>(normalizeMediaUri(passedMedia));
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(passedMediaType);
    const [carouselItems, setCarouselItems] = useState<LocalCarouselItem[]>([]);
    const [carouselActiveIndex, setCarouselActiveIndex] = useState(0);
    const isCarousel = carouselItems.length > 1;
    const previewUri = isCarousel
        ? carouselItems[carouselActiveIndex]?.uri ?? selectedMedia
        : selectedMedia;
    const previewType: 'image' | 'video' | null = isCarousel
        ? carouselItems[carouselActiveIndex]?.type ?? mediaType
        : mediaType;
    const activeCarouselSlide = isCarousel ? carouselItems[carouselActiveIndex] : undefined;
    const [text, setText] = useState(route.params?.draftCaption || route.params?.draftTextBody || '');
    const [location, setLocation] = useState(route.params?.draftLocation || '');
    const [venue, setVenue] = useState(route.params?.draftVenue || '');
    const [landmark, setLandmark] = useState(route.params?.draftLandmark || '');
    const [taggedUsersInput, setTaggedUsersInput] = useState(
        Array.isArray(route.params?.draftTaggedUsers) ? route.params.draftTaggedUsers.join(', ') : ''
    );
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [videoCoverTime, setVideoCoverTime] = useState<number>(Number(route.params?.videoCoverTime || 0));
    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const [videoDurationSec, setVideoDurationSec] = useState<number>(Math.max(1, Number(route.params?.videoDuration || 0) || 15));
    const [storyAudience, setStoryAudience] = useState<'public' | 'close_friends' | 'only_me'>('public');
    const storyTextPresets = React.useMemo(
        () => [
            { id: 'none', label: 'Default', bg: '#1F2937' },
            { id: 'midnight', label: 'Midnight', bg: '#111827' },
            { id: 'violet', label: 'Violet', bg: '#312E81' },
            { id: 'sunset', label: 'Sunset', bg: '#7C2D12' },
        ],
        []
    );
    const [storyTextPresetId, setStoryTextPresetId] = useState<string>('none');
    const activeStoryPreset = storyTextPresets.find((preset) => preset.id === storyTextPresetId) || storyTextPresets[0];
    const filterInfo = route.params?.filterInfo as InstantFilterInfo | undefined;
    const draftFilterBaked = !!route.params?.draftFilterBaked;
    const draftFilterActive = route.params?.draftFilterActive as InstantFilterName | undefined;
    const [imageFilterName, setImageFilterName] = useState<InstantFilterName>(() => {
        if (draftFilterBaked) return 'None';
        if (draftFilterActive && draftFilterActive !== 'None') return draftFilterActive;
        return (filterInfo?.active as InstantFilterName) || 'None';
    });
    const [stickers, setStickers] = useState<StickerOverlay[]>(
        Array.isArray(route.params?.draftStickers) ? route.params.draftStickers : [],
    );
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showTextStickerModal, setShowTextStickerModal] = useState(false);
    const [selectedStickerOverlay, setSelectedStickerOverlay] = useState<string | null>(null);
    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
    const videoRef = useRef<VideoRef>(null);
    const previewCaptureRef = useRef<View>(null);

    useEffect(() => {
        if (filterInfo?.active) {
            setImageFilterName(filterInfo.active as InstantFilterName);
        }
    }, [filterInfo?.active]);

    const activeFilterName = (
        mediaType === 'video' ? filterInfo?.active || 'None' : imageFilterName
    ) as InstantFilterName;
    const filterOverlayStyle = useMemo(
        () => getFilterOverlayStyle(activeFilterName),
        [activeFilterName],
    );
    const hasAppliedFilter =
        mediaType === 'video'
            ? isFiltered(filterInfo) || !!route.params?.filtered
            : imageFilterName !== 'None';
    const taggedUsers = useMemo(
        () =>
            taggedUsersInput
                .split(',')
                .map((v) => v.trim().replace(/^@+/, ''))
                .filter((v, idx, arr) => v.length > 0 && arr.indexOf(v) === idx),
        [taggedUsersInput],
    );

    const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setPreviewSize({ width, height });
        }
    }, []);

    const handleSelectSticker = useCallback((sticker: Sticker) => {
        const newOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random()}`,
            stickerId: sticker.id,
            sticker,
            x: 50,
            y: clampStickerY(50),
            scale: 1,
            rotation: 0,
            opacity: 1,
        };
        setStickers((prev) => [...prev, newOverlay]);
        setSelectedStickerOverlay(newOverlay.id);
    }, []);

    const handleAddTextSticker = useCallback((textValue: string, fontSize: 'small' | 'medium' | 'large', color: string) => {
        const textSticker: Sticker = {
            id: `text-sticker-${Date.now()}`,
            name: textValue,
            category: 'Text',
        };
        const newOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random()}`,
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
        setStickers((prev) => [...prev, newOverlay]);
        setSelectedStickerOverlay(newOverlay.id);
    }, []);

    const handleUpdateSticker = useCallback((id: string, updated: StickerOverlay) => {
        setStickers((prev) => prev.map((s) => (s.id === id ? updated : s)));
    }, []);

    const handleRemoveSticker = useCallback((id: string) => {
        setStickers((prev) => prev.filter((s) => s.id !== id));
        setSelectedStickerOverlay((current) => (current === id ? null : current));
    }, []);

    const openStickerPicker = useCallback(() => {
        if (!selectedMedia) {
            Alert.alert('Media required', 'Add a photo or video before adding stickers.');
            return;
        }
        setShowStickerPicker(true);
    }, [selectedMedia]);

    const openFilters = useCallback(() => {
        if (!selectedMedia) {
            Alert.alert('Media required', 'Add a photo or video before choosing a filter.');
            return;
        }
        if (mediaType === 'video') {
            navigation.navigate('InstantFilters', {
                videoUrl: selectedMedia,
                mediaUrl: selectedMedia,
                videoDuration: videoDurationSec,
                videoCoverTime,
                story24: isStory24Flow || undefined,
                returnToComposer: true,
            });
        }
    }, [isStory24Flow, mediaType, navigation, selectedMedia, videoCoverTime, videoDurationSec]);

    useEffect(() => {
        if (!isAddYoursFlow) return;
        setText((prev) => (prev && prev.trim().length > 0 ? prev : 'Add Yours: '));
    }, [isAddYoursFlow]);

    useEffect(() => {
        const initial = route.params?.carouselItems as LocalCarouselItem[] | undefined;
        if (!Array.isArray(initial) || initial.length < 2) return;
        setCarouselItems(initial);
        setCarouselActiveIndex(0);
        setSelectedMedia(initial[0]?.uri ?? null);
        setMediaType(initial[0]?.type ?? null);
        if (typeof route.params?.draftCaption === 'string' && route.params.draftCaption.trim()) {
            setText(route.params.draftCaption);
        }
    }, [route.params?.carouselItems, route.params?.draftCaption]);

    const applySingleMedia = useCallback((uri: string | null, type: 'image' | 'video') => {
        setCarouselItems([]);
        setCarouselActiveIndex(0);
        setSelectedMedia(normalizeMediaUri(uri));
        setMediaType(type);
    }, []);

    const assetIsVideo = (asset: { type?: string; uri?: string }) =>
        Boolean(
            asset.type?.startsWith('video') ||
                asset.uri?.toLowerCase().endsWith('.mp4') ||
                asset.uri?.toLowerCase().endsWith('.mov'),
        );

    const applyCarouselFromAssets = useCallback(
        (assets: Array<{ uri?: string; type?: string; duration?: number }>) => {
            const items: LocalCarouselItem[] = [];
            for (const a of assets) {
                if (items.length >= 10) break;
                const uri = normalizeMediaUri(a.uri || null);
                if (!uri) continue;
                const isVideo = assetIsVideo(a);
                const rawDuration = Number(a.duration || 0);
                const durationSec =
                    isVideo && Number.isFinite(rawDuration) && rawDuration > 0
                        ? Math.max(0.1, Math.floor(rawDuration * 10) / 10)
                        : undefined;
                const slide: LocalCarouselItem = {
                    uri,
                    type: isVideo ? 'video' : 'image',
                };
                if (isVideo) {
                    slide.videoCoverTime = 0;
                    if (durationSec != null) slide.durationSec = durationSec;
                }
                items.push(slide);
            }
            if (items.length < 2) {
                if (items.length === 1) {
                    applySingleMedia(items[0].uri, items[0].type);
                }
                return;
            }
            setCarouselItems(items);
            setCarouselActiveIndex(0);
            setSelectedMedia(items[0].uri);
            setMediaType(items[0].type);
            setVideoCoverTime(0);
        },
        [applySingleMedia],
    );

    const removeCarouselItem = useCallback((index: number) => {
        setCarouselItems((prev) => {
            const next = prev.filter((_, i) => i !== index);
            setCarouselActiveIndex((active) => {
                if (next.length <= 1) return 0;
                if (active > index) return active - 1;
                if (active >= next.length) return Math.max(0, next.length - 1);
                return active;
            });
            if (next.length === 0) {
                setSelectedMedia(null);
                setMediaType(null);
            } else if (next.length === 1) {
                setSelectedMedia(next[0].uri);
                setMediaType(next[0].type);
                return [];
            }
            setSelectedMedia(next[0].uri);
            setMediaType(next[0].type);
            return next;
        });
    }, []);

    const previewCoverTime =
        isCarousel && activeCarouselSlide?.type === 'video'
            ? activeCarouselSlide.videoCoverTime ?? 0
            : videoCoverTime;
    const previewDurationSec =
        isCarousel && activeCarouselSlide?.type === 'video'
            ? activeCarouselSlide.durationSec ?? videoDurationSec
            : videoDurationSec;

    const setPreviewCoverTime = useCallback(
        (timeSec: number) => {
            if (isCarousel) {
                setCarouselItems((prev) =>
                    prev.map((item, i) =>
                        i === carouselActiveIndex && item.type === 'video'
                            ? { ...item, videoCoverTime: timeSec }
                            : item,
                    ),
                );
                return;
            }
            setVideoCoverTime(timeSec);
        },
        [carouselActiveIndex, isCarousel],
    );

    const updatePreviewVideoDuration = useCallback(
        (duration: number) => {
            const rounded = Math.max(0.1, Math.floor(duration * 10) / 10);
            if (isCarousel) {
                setCarouselItems((prev) =>
                    prev.map((item, i) => {
                        if (i !== carouselActiveIndex || item.type !== 'video') return item;
                        const cover = Math.min(Math.max(0, item.videoCoverTime ?? 0), rounded);
                        return { ...item, durationSec: rounded, videoCoverTime: cover };
                    }),
                );
                return;
            }
            setVideoDurationSec(rounded);
            setVideoCoverTime((prev) => Math.min(Math.max(0, prev), rounded));
        },
        [carouselActiveIndex, isCarousel],
    );

    useEffect(() => {
        if (previewType !== 'video' || !previewUri) return;
        videoRef.current?.seek(Math.max(0, previewCoverTime));
    }, [previewCoverTime, previewType, previewUri, carouselActiveIndex]);

    const pickCarouselMedia = useCallback(() => {
        ImagePicker.launchImageLibrary(
            { mediaType: 'mixed', selectionLimit: 10, quality: 0.9, videoQuality: 'high' },
            (response) => {
                if (response.didCancel) return;
                if (response.errorCode) {
                    Alert.alert(
                        'Media error',
                        response.errorMessage || 'Could not open your photo library.',
                    );
                    return;
                }
                const assets = response.assets || [];
                if (assets.length < 2) {
                    Alert.alert('Carousel', 'Select at least 2 photos or videos for a carousel post.');
                    return;
                }
                applyCarouselFromAssets(assets);
            },
        );
    }, [applyCarouselFromAssets]);

    const handleSelectMedia = () => {
        const pickPhotoWithFallback = async () => {
            try {
                const image = await ImageCropPicker.openPicker({
                    mediaType: 'photo',
                    cropping: true,
                    width: 1080,
                    height: 1350,
                    cropperToolbarTitle: 'Adjust photo',
                    cropperChooseText: 'Use Photo',
                    cropperCancelText: 'Cancel',
                    compressImageQuality: 0.9,
                });
                applySingleMedia(normalizeMediaUri(image.path || null), 'image');
            } catch (err: any) {
                if (err?.code === 'E_PICKER_CANCELLED') return;
                console.error('Photo picker error (cropper), falling back:', err);
                ImagePicker.launchImageLibrary(
                    { mediaType: 'photo', selectionLimit: 1, quality: 0.9 },
                    (response) => {
                        if (response.didCancel) return;
                        if (response.errorCode) {
                            Alert.alert('Photo error', response.errorMessage || 'Could not open your photo library.');
                            return;
                        }
                        const asset = response.assets?.[0];
                        if (!asset?.uri) {
                            Alert.alert('Photo error', 'No photo was selected.');
                            return;
                        }
                        applySingleMedia(normalizeMediaUri(asset.uri), 'image');
                    },
                );
            }
        };

        const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' }> = [
            {
                text: 'Photo',
                onPress: () => {
                    void pickPhotoWithFallback();
                },
            },
            {
                text: 'Video',
                onPress: () => {
                    ImagePicker.launchImageLibrary(
                        {
                            mediaType: 'video',
                            quality: 0.8,
                        },
                        (response) => {
                            if (response.didCancel) return;
                            if (response.errorCode) {
                                Alert.alert('Video error', response.errorMessage || 'Could not open your video library.');
                                return;
                            }
                            const asset = response.assets?.[0];
                            if (!asset?.uri) {
                                Alert.alert('Video error', 'No video was selected.');
                                return;
                            }
                            applySingleMedia(normalizeMediaUri(asset.uri), 'video');
                        },
                    );
                },
            },
        ];
        if (!isStory24Flow) {
            buttons.splice(2, 0, {
                text: 'Carousel (2–10 photos & videos)',
                onPress: pickCarouselMedia,
            });
        }
        buttons.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert('Choose media type', 'How would you like to add media?', buttons);
    };

    const handleTakePhoto = async () => {
        try {
            const image = await ImageCropPicker.openCamera({
                mediaType: 'photo',
                cropping: true,
                width: 1080,
                height: 1350,
                cropperToolbarTitle: 'Adjust photo',
                cropperChooseText: 'Use Photo',
                cropperCancelText: 'Cancel',
                compressImageQuality: 0.9,
            });
            applySingleMedia(normalizeMediaUri(image.path || null), 'image');
        } catch (err: any) {
            if (err?.code !== 'E_PICKER_CANCELLED') {
                console.error('Camera picker error:', err);
            }
        }
    };

    const captureVideoPoster = useCallback(async (): Promise<string> => {
        if (previewType === 'video') {
            videoRef.current?.seek(Math.max(0, previewCoverTime));
            setIsVideoPaused(true);
            await new Promise((resolve) => setTimeout(resolve, 400));
        }
        return captureFilteredPreviewFromRef(previewCaptureRef);
    }, [previewCoverTime, previewType]);

    const prepareComposerMedia = useCallback(async () => {
        if (!selectedMedia || !mediaType) {
            return {
                mediaUrl: undefined as string | undefined,
                mediaType: undefined as 'image' | 'video' | undefined,
                videoPosterUrl: undefined as string | undefined,
                filterExportFailed: false,
                videoCompressFailed: false,
            };
        }
        const filterForExport = hasAppliedFilter ? buildFilterInfo(activeFilterName) : null;
        try {
            return await prepareMediaForPostNative({
                mediaUrl: selectedMedia,
                mediaType,
                filterInfo: filterForExport,
                captureVideoPoster:
                    mediaType === 'video' || (filterForExport && mediaType === 'image')
                        ? captureVideoPoster
                        : undefined,
                videoCoverTime,
            });
        } catch (err) {
            console.warn('prepareComposerMedia failed, using local media', err);
            return {
                mediaUrl: selectedMedia,
                mediaType,
                videoPosterUrl: undefined,
                filterExportFailed: true,
                videoCompressFailed: true,
            };
        }
    }, [
        activeFilterName,
        captureVideoPoster,
        hasAppliedFilter,
        mediaType,
        selectedMedia,
        videoCoverTime,
    ]);

    const handlePost = async () => {
        if (!selectedMedia && !text.trim()) {
            Alert.alert('Error', 'Please add media or text to your post');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'Please log in to post');
            return;
        }

        if (isUploading) return;

        const filterForExport = hasAppliedFilter ? buildFilterInfo(activeFilterName) : null;
        const captionText = text.trim();
        const locationLabel = location.trim() || user.regional || 'Unknown';

        if (!isStory24Flow) {
            setIsUploading(true);
            const tempId = `pending-${Date.now()}`;
            const localThumbUri = selectedMedia || null;
            addPendingFeedUpload({
                tempId,
                userId: user.id,
                userHandle: user.handle,
                text: captionText,
                location: locationLabel,
                localMediaUri: selectedMedia,
                localThumbUri,
                localMediaItems: isCarousel ? carouselItems : undefined,
                mediaType,
                videoCoverTime,
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
                thumbUri: localThumbUri ?? undefined,
                thumbType: mediaType === 'video' ? 'video' : 'image',
            });
            hapticLight();
            navigation.navigate('Home', { forceRefreshAt: Date.now() });
            setIsUploading(false);
            startBackgroundFeedUpload(tempId);
            return;
        }

        setIsUploading(true);
        try {
            const preparedMedia = await prepareComposerMedia();

            if (preparedMedia.filterExportFailed && filterForExport) {
                console.warn(
                    'Filter bake partially failed; uploaded media may differ slightly from preview.',
                );
            }
            if (preparedMedia.videoCompressFailed && mediaType === 'video') {
                console.warn(
                    'Video compression failed; original file was uploaded and may be larger than expected.',
                );
            }

            if (!preparedMedia.mediaUrl || !preparedMedia.mediaType) {
                throw new Error('Media is required for Story 24.');
            }
            await publishMediaStory24({
                userId: user.id,
                userHandle: user.handle,
                mediaUrl: preparedMedia.mediaUrl,
                mediaType: preparedMedia.mediaType,
                caption: captionText,
                location: locationLabel,
                venue: venue.trim() || undefined,
                stickers: stickers.length > 0 ? stickers : undefined,
                taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
                audience: storyAudience,
            });
            hapticSuccess();
            const storyAudienceLabel =
                storyAudience === 'close_friends' ? 'Close Friends' : storyAudience === 'only_me' ? 'Only Me' : 'Public';
            Alert.alert(
                'Success',
                `Story 24 published (${storyAudienceLabel}).`,
                [
                    {
                        text: 'OK',
                        onPress: () =>
                            navigation.navigate('Stories', {
                                forceRefreshAt: Date.now(),
                            }),
                    },
                ],
            );
        } catch (error: any) {
            console.error('Error creating post:', error);
            Alert.alert('Error', error?.message || 'Failed to create post');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!selectedMedia && !text.trim()) {
            Alert.alert('Nothing to save', 'Add media or text before saving a draft.');
            return;
        }
        if (isSavingDraft) return;
        setIsSavingDraft(true);
        try {
            let mediaUrl = selectedMedia || '';
            let savedMediaType = mediaType || undefined;
            let videoPosterUrl: string | undefined;
            let filterBaked = false;
            let filterActiveToStore: InstantFilterName | undefined;

            if (selectedMedia && mediaType) {
                const filterForExport = hasAppliedFilter ? buildFilterInfo(activeFilterName) : null;
                const prepared = await prepareComposerMedia();
                if (prepared.mediaUrl) {
                    mediaUrl = prepared.mediaUrl;
                }
                savedMediaType = prepared.mediaType || mediaType;
                videoPosterUrl = prepared.videoPosterUrl;
                filterBaked = Boolean(filterForExport && !prepared.filterExportFailed);
                if (!filterBaked && hasAppliedFilter && activeFilterName !== 'None') {
                    filterActiveToStore = activeFilterName;
                }
            }

            await saveDraft({
                videoUrl: mediaUrl,
                videoDuration: savedMediaType === 'video' ? videoDurationSec : 0,
                caption: text.trim() || undefined,
                textBody: text.trim() || undefined,
                location: location.trim() || undefined,
                venue: venue.trim() || undefined,
                landmark: landmark.trim() || undefined,
                taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
                mediaType: savedMediaType,
                videoPosterUrl,
                videoCoverTime: savedMediaType === 'video' ? videoCoverTime : undefined,
                filterActive: filterActiveToStore,
                filterBaked,
                stickers: stickers.length > 0 ? stickers : undefined,
            });
            hapticLight();
            Alert.alert('Saved', 'Draft saved to your profile drafts.');
        } catch (err: any) {
            Alert.alert('Draft failed', err?.message || 'Could not save draft.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    return (
        <GazetteerScreenShell edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isStory24Flow ? 'Create Story 24' : 'Create Post'}</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleSaveDraft} disabled={isSavingDraft || isUploading} style={styles.draftButton}>
                        {isSavingDraft ? (
                            <ActivityIndicator size="small" color="#9CA3AF" />
                        ) : (
                            <Text style={styles.draftButtonText}>Draft</Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handlePost}
                        disabled={isUploading}
                        style={styles.postButton}
                    >
                        {isUploading ? (
                            <ActivityIndicator size="small" color="#3B82F6" />
                        ) : (
                            <Text style={styles.postButtonText}>{isStory24Flow ? 'Share' : 'Post'}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => {
                    Keyboard.dismiss();
                    setSelectedStickerOverlay(null);
                }}
            >
                {isAddYoursFlow && (
                    <View style={styles.addYoursBanner}>
                        <Icon name="sparkles" size={16} color="#111827" />
                        <Text style={styles.addYoursBannerText}>Add Yours mode</Text>
                    </View>
                )}
                {isStory24Flow && (
                    <View style={styles.addYoursBanner}>
                        <Icon name="location" size={16} color="#111827" />
                        <Text style={styles.addYoursBannerText}>Stories 24 mode</Text>
                    </View>
                )}
                {isStory24Flow && (
                    <View style={styles.storyControlsCard}>
                        <Text style={styles.storyControlsTitle}>Story audience</Text>
                        <View style={styles.storyAudienceRow}>
                            {[
                                { key: 'public', label: 'Public' },
                                { key: 'close_friends', label: 'Close Friends' },
                                { key: 'only_me', label: 'Only Me' },
                            ].map((item) => {
                                const selected = storyAudience === item.key;
                                return (
                                    <TouchableOpacity
                                        key={item.key}
                                        onPress={() => setStoryAudience(item.key as 'public' | 'close_friends' | 'only_me')}
                                        style={[styles.storyAudienceChip, selected && styles.storyAudienceChipActive]}
                                    >
                                        <Text style={[styles.storyAudienceChipText, selected && styles.storyAudienceChipTextActive]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={styles.storyControlsTitle}>Text style</Text>
                        <View style={styles.storyAudienceRow}>
                            {storyTextPresets.map((preset) => {
                                const selected = storyTextPresetId === preset.id;
                                return (
                                    <TouchableOpacity
                                        key={preset.id}
                                        onPress={() => setStoryTextPresetId(preset.id)}
                                        style={[
                                            styles.storyStyleChip,
                                            { backgroundColor: preset.bg },
                                            selected && styles.storyStyleChipActive,
                                        ]}
                                    >
                                        <Text style={styles.storyStyleChipText}>{preset.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
                {/* Media Selection */}
                {!selectedMedia && (
                    <View style={styles.mediaSelection}>
                        <TouchableOpacity
                            onPress={handleSelectMedia}
                            style={styles.mediaButton}
                        >
                            <Icon name="images" size={32} color="#8B5CF6" />
                            <Text style={styles.mediaButtonText}>Choose from Library</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleTakePhoto}
                            style={styles.mediaButton}
                        >
                            <Icon name="camera" size={32} color="#8B5CF6" />
                            <Text style={styles.mediaButtonText}>Take Photo</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Media Preview */}
                {selectedMedia && (
                    <View style={styles.mediaPreview}>
                        {isCarousel ? (
                            <View style={styles.carouselBadge}>
                                <Icon name="images" size={12} color="#FBCFE8" />
                                <Text style={styles.carouselBadgeText}>
                                    {carouselItems.length} slides · swipe in feed
                                </Text>
                            </View>
                        ) : null}
                        {hasAppliedFilter && !isCarousel ? (
                            <View style={styles.filterBadge}>
                                <Icon name="color-filter" size={12} color="#FBCFE8" />
                                <Text style={styles.filterBadgeText}>{activeFilterName}</Text>
                            </View>
                        ) : null}
                        {hasAppliedFilter && isCarousel ? (
                            <View style={styles.filterBadge}>
                                <Icon name="color-filter" size={12} color="#FBCFE8" />
                                <Text style={styles.filterBadgeText}>Filter on cover photo</Text>
                            </View>
                        ) : null}
                        {isCarousel ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.carouselRail}
                                contentContainerStyle={styles.carouselRailContent}
                            >
                                {carouselItems.map((item, index) => {
                                    const isActive = index === carouselActiveIndex;
                                    return (
                                        <TouchableOpacity
                                            key={`${item.uri}-${index}`}
                                            activeOpacity={0.85}
                                            onPress={() => setCarouselActiveIndex(index)}
                                            style={[
                                                styles.carouselThumbWrap,
                                                isActive && styles.carouselThumbWrapActive,
                                            ]}
                                        >
                                            {item.type === 'video' ? (
                                                <View style={styles.carouselThumbVideo}>
                                                    <Icon name="videocam" size={22} color="#E5E7EB" />
                                                </View>
                                            ) : (
                                                <Image source={{ uri: item.uri }} style={styles.carouselThumb} />
                                            )}
                                            {item.type === 'video' ? (
                                                <View style={styles.carouselVidBadge}>
                                                    <Text style={styles.carouselVidBadgeText}>MP4</Text>
                                                </View>
                                            ) : null}
                                            {isActive && item.type === 'video' ? (
                                                <View style={styles.carouselCoverBadge}>
                                                    <Text style={styles.carouselCoverBadgeText}>Cover</Text>
                                                </View>
                                            ) : null}
                                            <TouchableOpacity
                                                style={styles.carouselThumbRemove}
                                                onPress={() => removeCarouselItem(index)}
                                                hitSlop={8}
                                            >
                                                <Icon name="close" size={14} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        ) : null}
                        <View style={styles.videoPreviewWrap} onLayout={handlePreviewLayout}>
                            <View ref={previewCaptureRef} style={styles.previewCaptureFrame} collapsable={false}>
                                {previewType === 'video' && previewUri ? (
                                    <Video
                                        key={isCarousel ? `carousel-${carouselActiveIndex}-${previewUri}` : previewUri}
                                        ref={videoRef}
                                        source={{ uri: previewUri }}
                                        style={styles.previewImage}
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
                                    <Image
                                        source={{ uri: previewUri }}
                                        style={styles.previewImage}
                                        resizeMode="contain"
                                    />
                                ) : null}
                                {filterOverlayStyle ? (
                                    <View pointerEvents="none" style={[styles.filterOverlay, filterOverlayStyle]} />
                                ) : null}
                            </View>
                            <Pressable
                                style={styles.stickerDeselectLayer}
                                onPress={() => setSelectedStickerOverlay(null)}
                            />
                            {previewSize.width > 0 &&
                                stickers.map((overlay) => (
                                    <StickerOverlayNative
                                        key={overlay.id}
                                        overlay={overlay}
                                        onUpdate={(updated) => handleUpdateSticker(overlay.id, updated)}
                                        onRemove={() => handleRemoveSticker(overlay.id)}
                                        isSelected={selectedStickerOverlay === overlay.id}
                                        onSelect={() => setSelectedStickerOverlay(overlay.id)}
                                        containerWidth={previewSize.width}
                                        containerHeight={previewSize.height}
                                    />
                                ))}
                            {previewType === 'video' ? (
                                <TouchableOpacity
                                    style={styles.videoPauseBtn}
                                    onPress={() => setIsVideoPaused((v) => !v)}
                                >
                                    <Icon name={isVideoPaused ? 'play' : 'pause'} size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedMedia(null);
                                setMediaType(null);
                                setStickers([]);
                                setSelectedStickerOverlay(null);
                                setImageFilterName('None');
                            }}
                            style={styles.removeMediaButton}
                        >
                            <Icon name="close-circle" size={32} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                )}
                {selectedMedia && (
                    <View style={styles.composerTools}>
                        {previewType === 'video' && !isCarousel ? (
                            <TouchableOpacity style={styles.composerToolBtn} onPress={openFilters}>
                                <Icon name="color-filter" size={18} color="#FBCFE8" />
                                <Text style={styles.composerToolText}>Filters</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.composerToolBtn} onPress={openStickerPicker}>
                            <Icon name="happy" size={18} color="#FBCFE8" />
                            <Text style={styles.composerToolText}>
                                Stickers{stickers.length > 0 ? ` (${stickers.length})` : ''}
                            </Text>
                        </TouchableOpacity>
                        {selectedStickerOverlay ? (
                            <TouchableOpacity
                                style={styles.composerToolBtn}
                                onPress={() => setSelectedStickerOverlay(null)}
                            >
                                <Icon name="checkmark-circle-outline" size={18} color="#FBCFE8" />
                                <Text style={styles.composerToolText}>Done</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}
                {selectedMedia && previewType === 'image' && !isCarousel && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.imageFilterRow}
                    >
                        {INSTANT_FILTER_NAMES.map((name) => {
                            const active = imageFilterName === name;
                            return (
                                <TouchableOpacity
                                    key={name}
                                    onPress={() => setImageFilterName(name)}
                                    style={[styles.imageFilterChip, active && styles.imageFilterChipActive]}
                                >
                                    <Text style={[styles.imageFilterChipText, active && styles.imageFilterChipTextActive]}>
                                        {name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
                {previewType === 'video' ? (
                    <View style={styles.videoCoverWrap}>
                        {isCarousel ? (
                            <Text style={styles.carouselCoverHint}>
                                Slide {carouselActiveIndex + 1} cover — tap another video to change
                            </Text>
                        ) : null}
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

                {/* Text Input */}
                <View style={styles.inputContainer}>
                    <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder="Write a caption..."
                        placeholderTextColor="#6B7280"
                        style={[styles.textInput, isStory24Flow && { backgroundColor: activeStoryPreset.bg }]}
                        multiline
                        numberOfLines={6}
                        maxLength={TEXT_POST_BODY_MAX_LENGTH}
                    />
                    <View style={styles.captionCounterRow}>
                        <Text
                            style={[
                                styles.captionCounterText,
                                text.length > TEXT_POST_BODY_MAX_LENGTH - 50
                                    ? (text.length >= TEXT_POST_BODY_MAX_LENGTH ? styles.captionCounterDanger : styles.captionCounterWarn)
                                    : null,
                            ]}
                        >
                            {text.length}/{TEXT_POST_BODY_MAX_LENGTH}
                        </Text>
                    </View>
                </View>

                {/* Location Input */}
                <View style={styles.inputContainer}>
                    <View style={styles.locationInputContainer}>
                        <Icon name="location" size={20} color="#8B5CF6" />
                        <TextInput
                            value={location}
                            onChangeText={setLocation}
                            placeholder="Add location"
                            placeholderTextColor="#6B7280"
                            style={styles.locationInput}
                        />
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <View style={styles.locationInputContainer}>
                        <Icon name="business" size={20} color="#8B5CF6" />
                        <TextInput
                            value={venue}
                            onChangeText={setVenue}
                            placeholder="Add venue"
                            placeholderTextColor="#6B7280"
                            style={styles.locationInput}
                        />
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <View style={styles.locationInputContainer}>
                        <Icon name="pin" size={20} color="#8B5CF6" />
                        <TextInput
                            value={landmark}
                            onChangeText={setLandmark}
                            placeholder="Add landmark"
                            placeholderTextColor="#6B7280"
                            style={styles.locationInput}
                        />
                    </View>
                </View>
                <View style={styles.inputContainer}>
                    <View style={styles.locationInputContainer}>
                        <Icon name="person-add" size={20} color="#8B5CF6" />
                        <TextInput
                            value={taggedUsersInput}
                            onChangeText={setTaggedUsersInput}
                            placeholder="Tag users (comma separated)"
                            placeholderTextColor="#6B7280"
                            style={styles.locationInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                    {taggedUsers.length > 0 && (
                        <Text style={styles.taggedUsersPreview}>
                            Tagged: {taggedUsers.map((u) => `@${u}`).join(', ')}
                        </Text>
                    )}
                </View>
            </ScrollView>

            <StickerPickerNative
                visible={showStickerPicker}
                onClose={() => setShowStickerPicker(false)}
                onSelectSticker={handleSelectSticker}
                onAddText={() => {
                    setShowStickerPicker(false);
                    setShowTextStickerModal(true);
                }}
            />
            <TextStickerModalNative
                visible={showTextStickerModal}
                onClose={() => setShowTextStickerModal(false)}
                onConfirm={handleAddTextSticker}
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        zIndex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    postButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    draftButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    draftButtonText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '700',
    },
    postButtonText: {
        color: '#3B82F6',
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
    contentContainer: {
        paddingBottom: 32,
    },
    addYoursBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        borderRadius: 999,
        backgroundColor: '#FBBF24',
        paddingHorizontal: 10,
        paddingVertical: 6,
        margin: 16,
        marginBottom: 8,
    },
    addYoursBannerText: {
        color: '#111827',
        fontSize: 12,
        fontWeight: '700',
    },
    mediaSelection: {
        padding: 16,
        gap: 16,
    },
    mediaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 20,
        borderRadius: 14,
        ...glassSurface,
    },
    mediaButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
    storyControlsCard: {
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
        borderRadius: 14,
        ...glassPanel,
        padding: 12,
        gap: 10,
    },
    storyControlsTitle: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '700',
    },
    storyAudienceRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    storyAudienceChip: {
        borderRadius: 999,
        ...glassSurface,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    storyAudienceChipActive: {
        borderColor: '#F8D26A',
        backgroundColor: '#3F2B07',
    },
    storyAudienceChipText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
    storyAudienceChipTextActive: {
        color: '#F8D26A',
    },
    storyStyleChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#4B5563',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    storyStyleChipActive: {
        borderColor: '#F8D26A',
    },
    storyStyleChipText: {
        color: '#F9FAFB',
        fontSize: 12,
        fontWeight: '600',
    },
    mediaPreview: {
        width: '100%',
        height: 400,
        backgroundColor: '#111827',
        position: 'relative',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    videoPreviewWrap: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        overflow: 'hidden',
        position: 'relative',
    },
    previewCaptureFrame: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        overflow: 'hidden',
        position: 'relative',
    },
    stickerDeselectLayer: {
        ...StyleSheet.absoluteFill,
        zIndex: 1,
    },
    filterOverlay: {
        ...StyleSheet.absoluteFill,
    },
    carouselBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        marginBottom: 8,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: 'rgba(59, 130, 246, 0.25)',
        borderWidth: 1,
        borderColor: 'rgba(147, 197, 253, 0.45)',
    },
    carouselBadgeText: {
        color: '#BFDBFE',
        fontSize: 11,
        fontWeight: '700',
    },
    carouselRail: {
        marginBottom: 10,
        maxHeight: 88,
    },
    carouselRailContent: {
        gap: 8,
        paddingRight: 8,
    },
    carouselThumbWrap: {
        width: 72,
        height: 72,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#111827',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    carouselThumbWrapActive: {
        borderColor: '#F472B6',
    },
    carouselCoverBadge: {
        position: 'absolute',
        right: 4,
        top: 4,
        backgroundColor: 'rgba(244,114,182,0.9)',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    carouselCoverBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '700',
    },
    carouselCoverHint: {
        color: '#9CA3AF',
        fontSize: 12,
        marginBottom: 8,
    },
    carouselThumb: {
        width: '100%',
        height: '100%',
    },
    carouselThumbVideo: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1F2937',
    },
    carouselVidBadge: {
        position: 'absolute',
        left: 4,
        bottom: 4,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    carouselVidBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '700',
    },
    carouselThumbRemove: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: 'rgba(217, 27, 92, 0.35)',
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.45)',
    },
    filterBadgeText: {
        color: '#FBCFE8',
        fontSize: 11,
        fontWeight: '700',
    },
    videoPauseBtn: {
        position: 'absolute',
        right: 14,
        top: 14,
        zIndex: 25,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    removeMediaButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 30,
    },
    composerTools: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 4,
    },
    composerToolBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 12,
        paddingVertical: 10,
        backgroundColor: 'rgba(244, 114, 182, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.28)',
    },
    composerToolText: {
        color: '#FBCFE8',
        fontSize: 14,
        fontWeight: '700',
    },
    imageFilterRow: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        gap: 8,
    },
    imageFilterChip: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    imageFilterChipActive: {
        backgroundColor: 'rgba(244, 114, 182, 0.25)',
        borderColor: 'rgba(244, 114, 182, 0.55)',
    },
    imageFilterChipText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
    imageFilterChipTextActive: {
        color: '#FBCFE8',
    },
    videoCoverWrap: {
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
    },
    inputContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    textInput: {
        ...glassSurface,
        borderRadius: 14,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    captionCounterRow: {
        marginTop: 8,
        alignItems: 'flex-end',
    },
    captionCounterText: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
    },
    captionCounterWarn: {
        color: '#FBBF24',
    },
    captionCounterDanger: {
        color: '#F87171',
    },
    locationInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...glassSurface,
        borderRadius: 14,
        padding: 16,
    },
    locationInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
    },
    taggedUsersPreview: {
        marginTop: 8,
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
    },
});












