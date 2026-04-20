/**
 * Gallery upload preview: media in a flex-grown region, caption/tools in a bottom panel
 * (same column, no overlap). Filters | Stickers | Save to drafts | Post.
 */
import React, { useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiFilter, FiSmile, FiBookmark, FiSend, FiArrowLeft, FiUser, FiLayers, FiPlus, FiX, FiType, FiVolume2, FiVolumeX } from 'react-icons/fi';
import { MdOutlineShareLocation } from 'react-icons/md';
import { createPost } from '../api/posts';
import { saveDraft } from '../api/drafts';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { showToast } from '../utils/toast';
import type { StickerOverlay, Sticker } from '../types';
import StickerOverlayComponent from '../components/StickerOverlay';
import UserTaggingModal from '../components/UserTaggingModal';
import { getStickers, STICKER_CATEGORIES } from '../api/stickers';
import { getGalleryPreviewMedia, clearGalleryPreviewMedia } from '../utils/galleryPreviewCache';
import { showUploadOverlay } from '../utils/uploadOverlay';

const FILTER_NAMES = ['None', 'B&W', 'Sepia', 'Vivid', 'Cool', 'Vignette', 'Beauty'];
const CAROUSEL_MAX = 10;

/** Same gold + silver palette as `Avatar` story ring. */
const PROFILE_STORY_RING_GRADIENT = 'linear-gradient(135deg, #f6e27a 0%, #d4af37 22%, #f4f4f4 44%, #bfc5cc 66%, #ffe8a3 82%, #d4af37 100%)';

type CarouselItem = { id: string; url: string; type: 'image' | 'video'; duration: number };

/** Read module cache once per mount so the first paint already has blob URLs (effect-only hydration stayed black until a later interaction). */
function readModuleCacheSeed(): { items: CarouselItem[]; revokeUrls: string[] } | null {
    const cached = getGalleryPreviewMedia();
    if (!cached?.length) return null;
    const revokeUrls: string[] = [];
    const t = Date.now();
    const items: CarouselItem[] = cached.map((item, index) => {
        const url = URL.createObjectURL(item.blob);
        revokeUrls.push(url);
        return {
            id: `cache-${t}-${index}`,
            url,
            type: item.mediaType,
            duration: item.videoDuration || (item.mediaType === 'image' ? 3 : 0),
        };
    });
    return { items, revokeUrls };
}

function getFilterStyle(filterName: string, brightness: number, contrast: number, saturation: number, hue: number): React.CSSProperties {
    let baseFilter = '';
    let hasVignette = false;
    switch (filterName) {
        case 'None': baseFilter = ''; break;
        case 'Beauty': baseFilter = 'brightness(1.1) contrast(0.95) saturate(1.2)'; break;
        case 'B&W': baseFilter = 'grayscale(100%)'; break;
        case 'Sepia': baseFilter = 'sepia(100%)'; break;
        case 'Vivid': baseFilter = 'brightness(1.1) contrast(1.2) saturate(1.5)'; break;
        case 'Cool': baseFilter = 'brightness(1.05) contrast(1.1) saturate(0.8) hue-rotate(10deg)'; break;
        case 'Vignette': baseFilter = 'brightness(0.9) contrast(1.1)'; hasVignette = true; break;
        default: baseFilter = '';
    }
    const hueRotate = hue !== 0 ? `hue-rotate(${hue * 180}deg)` : '';
    const adj = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})${hueRotate ? ` ${hueRotate}` : ''}`;
    const result: React.CSSProperties = {};
    if (baseFilter && (brightness !== 1 || contrast !== 1 || saturation !== 1 || hue !== 0)) result.filter = `${baseFilter} ${adj}`;
    else if (baseFilter) result.filter = baseFilter;
    else if (brightness !== 1 || contrast !== 1 || saturation !== 1 || hue !== 0) result.filter = adj;
    if (hasVignette) result.boxShadow = 'inset 0 0 200px rgba(0, 0, 0, 0.5)';
    return result;
}

export default function GalleryPreviewPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const state = (location.state as {
        mediaUrl?: string;
        mediaType?: 'image' | 'video';
        videoDuration?: number;
        fromDraft?: boolean;
        draftMediaUrl?: string;
        draftMediaType?: 'image' | 'video';
        draftCaption?: string;
        draftLocation?: string;
        draftVenue?: string;
        draftLandmark?: string;
        draftVideoDuration?: number;
        draftId?: string;
        draftMediaItems?: Array<{ url: string; type: 'image' | 'video'; duration?: number }>;
        /** Set when uploading from Create → Shorts / TikTok / Reels picker */
        socialUploadTarget?: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
    } | null) || {};

    const socialUploadTarget = state.socialUploadTarget;

    const isFromDraft = !!(state.fromDraft && state.draftMediaUrl);
    const moduleSeed = useMemo(() => readModuleCacheSeed(), []);
    const blobUrlsToRevokeRef = useRef<string[]>(moduleSeed?.revokeUrls ?? []);

    const [resolvedMediaUrl, setResolvedMediaUrl] = useState(() => {
        if (isFromDraft) return state.draftMediaUrl!;
        if (state.mediaUrl) return state.mediaUrl;
        return moduleSeed?.items[0]?.url ?? '';
    });
    const [resolvedMediaType, setResolvedMediaType] = useState<'image' | 'video'>(() => {
        if (isFromDraft) return state.draftMediaType ?? 'image';
        if (moduleSeed?.items[0]) return moduleSeed.items[0].type;
        return state.mediaType ?? 'video';
    });
    const [resolvedVideoDuration, setResolvedVideoDuration] = useState(() => {
        if (isFromDraft) return state.draftVideoDuration ?? state.videoDuration ?? 0;
        if (moduleSeed?.items[0]) return moduleSeed.items[0].duration;
        return state.videoDuration ?? 0;
    });
    const [hasCheckedCache, setHasCheckedCache] = useState(false);

    useLayoutEffect(() => {
        setHasCheckedCache(true);
        return () => {
            blobUrlsToRevokeRef.current.forEach((url) => URL.revokeObjectURL(url));
            blobUrlsToRevokeRef.current = [];
        };
    }, []);

    useLayoutEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const prevHtml = html.style.overflow;
        const prevBody = body.style.overflow;
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        return () => {
            html.style.overflow = prevHtml;
            body.style.overflow = prevBody;
        };
    }, []);

    const [carouselItems, setCarouselItems] = useState<CarouselItem[]>(() => moduleSeed?.items ?? []);
    const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
    const carouselInitializedRef = useRef(false);

    useEffect(() => {
        if (carouselInitializedRef.current) return;

        // From draft with full carousel
        if (isFromDraft && state.draftMediaItems && state.draftMediaItems.length > 0) {
            carouselInitializedRef.current = true;
            setCarouselItems(
                state.draftMediaItems.map((item, index) => ({
                    id: `draft-item-${index}`,
                    url: item.url,
                    type: item.type,
                    duration: item.duration ?? (item.type === 'image' ? 3 : resolvedVideoDuration || 0),
                }))
            );
            return;
        }

        // Fallback: single media
        if (!resolvedMediaUrl) return;
        if (carouselItems.length > 0) {
            carouselInitializedRef.current = true;
            return;
        }
        carouselInitializedRef.current = true;
        setCarouselItems([{
            id: `item-${Date.now()}`,
            url: resolvedMediaUrl,
            type: resolvedMediaType,
            duration: resolvedVideoDuration || 0,
        }]);
    }, [isFromDraft, state.draftMediaItems, resolvedMediaUrl, resolvedMediaType, resolvedVideoDuration, carouselItems.length]);

    const currentItem = carouselItems[currentCarouselIndex];
    const mediaUrl = currentItem?.url ?? resolvedMediaUrl;
    const mediaType = currentItem?.type ?? resolvedMediaType;
    const videoDuration = currentItem?.duration ?? resolvedVideoDuration;

    const [cardTab, setCardTab] = useState<'caption' | 'filters' | 'stickers' | 'location' | 'carousel'>('caption');
    const [caption, setCaption] = useState(isFromDraft ? (state.draftCaption ?? '') : '');
    const [storyLocation, setStoryLocation] = useState(isFromDraft ? (state.draftLocation ?? '') : '');
    const [venue, setVenue] = useState(isFromDraft ? (state.draftVenue ?? '') : '');
    const [landmark, setLandmark] = useState(isFromDraft ? (state.draftLandmark ?? '') : '');
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const [showTagUserModal, setShowTagUserModal] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('None');
    const [brightness, setBrightness] = useState(1.0);
    const [contrast, setContrast] = useState(1.0);
    const [saturation, setSaturation] = useState(1.0);
    const [hue, setHue] = useState(0);
    const [stickers, setStickers] = useState<StickerOverlay[]>([]);
    const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
    const [stickerCategory, setStickerCategory] = useState('Emoji');
    const [stickerList, setStickerList] = useState<Sticker[]>([]);
    const [stickersLoading, setStickersLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [cardBodyExpanded, setCardBodyExpanded] = useState(false);
    /** Pixel offset from viewport bottom so media sits above the bottom sheet (sheet is z-stacked on top). */
    const [previewBottomInset, setPreviewBottomInset] = useState(148);
    const bottomSheetRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const videoRef = useRef<HTMLVideoElement>(null);
    const carouselInputRef = useRef<HTMLInputElement>(null);
    const [videoFrameDataUrl, setVideoFrameDataUrl] = useState<string | null>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const dragStartYRef = useRef<number>(0);
    const dragTriggeredRef = useRef<boolean>(false);
    const dragThreshold = 24;
    const [isMuted, setIsMuted] = useState(true);
    const pickerRailRef = useRef<HTMLDivElement>(null);
    const pickerRafRef = useRef<number | null>(null);
    const [isPickerDragging, setIsPickerDragging] = useState(false);
    const [centeredPickerTab, setCenteredPickerTab] = useState<'caption' | 'filters' | 'location' | 'carousel'>('caption');
    const [pulsingPickerTab, setPulsingPickerTab] = useState<'caption' | 'filters' | 'location' | 'carousel' | null>(null);
    const pulseTimerRef = useRef<number | null>(null);
    const prevCenteredPickerRef = useRef<'caption' | 'filters' | 'location' | 'carousel' | null>(null);

    const pickerTabs = useMemo(() => ([
        { id: 'caption' as const, title: 'Caption', icon: FiType },
        { id: 'location' as const, title: 'Location, venue, tag user', icon: MdOutlineShareLocation },
        { id: 'carousel' as const, title: 'Add photos/videos (carousel, max 10)', icon: FiLayers },
        { id: 'filters' as const, title: 'Filters', icon: FiFilter },
    ]), []);

    const updateCenteredPickerTab = useCallback(() => {
        const rail = pickerRailRef.current;
        if (!rail) return;
        const railRect = rail.getBoundingClientRect();
        const centerX = railRect.left + (railRect.width / 2);

        let closestId: 'caption' | 'filters' | 'location' | 'carousel' | null = null;
        let closestDist = Number.POSITIVE_INFINITY;
        const nodes = rail.querySelectorAll<HTMLButtonElement>('[data-picker-tab]');
        nodes.forEach((node) => {
            const id = node.dataset.pickerTab as 'caption' | 'filters' | 'location' | 'carousel' | undefined;
            if (!id) return;
            const rect = node.getBoundingClientRect();
            const itemCenter = rect.left + (rect.width / 2);
            const dist = Math.abs(itemCenter - centerX);
            if (dist < closestDist) {
                closestDist = dist;
                closestId = id;
            }
        });

        if (closestId) {
            setCenteredPickerTab(closestId);
            setCardTab(closestId);
        }
    }, []);

    const centerPickerTab = useCallback((tabId: 'caption' | 'filters' | 'location' | 'carousel', smooth = true) => {
        const rail = pickerRailRef.current;
        if (!rail) return;
        const target = rail.querySelector<HTMLButtonElement>(`[data-picker-tab="${tabId}"]`);
        if (!target) return;
        const desiredLeft = target.offsetLeft - (rail.clientWidth / 2) + (target.clientWidth / 2);
        rail.scrollTo({ left: Math.max(0, desiredLeft), behavior: smooth ? 'smooth' : 'auto' });
    }, []);

    useEffect(() => {
        if (mediaType !== 'video' || !mediaUrl) {
            setVideoFrameDataUrl(null);
            return;
        }
        const el = videoRef.current;
        if (!el) return;
        const capture = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = el.videoWidth || 160;
                canvas.height = el.videoHeight || 160;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
                    setVideoFrameDataUrl(canvas.toDataURL('image/jpeg', 0.85));
                }
            } catch (_) {}
        };
        if (el.readyState >= 2) capture();
        else el.addEventListener('loadeddata', capture, { once: true });
        return () => el.removeEventListener('loadeddata', capture);
    }, [mediaType, mediaUrl]);

    useEffect(() => {
        if (hasCheckedCache && !mediaUrl) {
            clearGalleryPreviewMedia();
            navigate('/create/instant', { replace: true });
        }
    }, [hasCheckedCache, mediaUrl, navigate]);

    useEffect(() => {
        if (containerRef.current) {
            const update = () => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) setContainerSize({ width: rect.width, height: rect.height });
            };
            update();
            const ro = new ResizeObserver(update);
            ro.observe(containerRef.current);
            return () => ro.disconnect();
        }
    }, [mediaUrl, cardBodyExpanded]);

    // Keep muted state in sync with video element
    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        el.muted = isMuted;
    }, [isMuted, mediaUrl, mediaType]);

    // On mobile, video often won't autoplay until we call play() (e.g. after loadedmetadata)
    useEffect(() => {
        if (mediaType !== 'video' || !mediaUrl) return;
        const el = videoRef.current;
        if (!el) return;
        const play = () => {
            el.play().catch(() => {});
        };
        el.addEventListener('loadeddata', play);
        if (el.readyState >= 2) play();
        return () => el.removeEventListener('loadeddata', play);
    }, [mediaType, mediaUrl]);

    useEffect(() => {
        const id = window.setTimeout(() => {
            centerPickerTab(cardTab as 'caption' | 'filters' | 'location' | 'carousel', false);
            updateCenteredPickerTab();
        }, 0);
        return () => window.clearTimeout(id);
    }, [centerPickerTab, updateCenteredPickerTab]);

    useEffect(() => {
        const rail = pickerRailRef.current;
        if (!rail) return;
        const onScroll = () => {
            if (pickerRafRef.current != null) cancelAnimationFrame(pickerRafRef.current);
            pickerRafRef.current = requestAnimationFrame(updateCenteredPickerTab);
        };
        rail.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            rail.removeEventListener('scroll', onScroll);
            if (pickerRafRef.current != null) cancelAnimationFrame(pickerRafRef.current);
        };
    }, [updateCenteredPickerTab]);

    // Small "haptic-like" visual pulse when the centered picker item changes.
    useEffect(() => {
        if (!centeredPickerTab) return;
        if (prevCenteredPickerRef.current === null) {
            prevCenteredPickerRef.current = centeredPickerTab;
            return;
        }
        if (prevCenteredPickerRef.current !== centeredPickerTab) {
            setPulsingPickerTab(centeredPickerTab);
            if (pulseTimerRef.current != null) window.clearTimeout(pulseTimerRef.current);
            pulseTimerRef.current = window.setTimeout(() => {
                setPulsingPickerTab(null);
            }, 220);
        }
        prevCenteredPickerRef.current = centeredPickerTab;
    }, [centeredPickerTab]);

    useEffect(() => {
        return () => {
            if (pulseTimerRef.current != null) window.clearTimeout(pulseTimerRef.current);
        };
    }, []);

    const filterStyle = useMemo(
        () => getFilterStyle(selectedFilter, brightness, contrast, saturation, hue),
        [selectedFilter, brightness, contrast, saturation, hue]
    );

    useEffect(() => {
        if (cardTab !== 'stickers') return;
        setStickersLoading(true);
        getStickers(stickerCategory).then(setStickerList).catch(console.error).finally(() => setStickersLoading(false));
    }, [cardTab, stickerCategory]);

    const handleSelectSticker = useCallback((sticker: Sticker) => {
        const newOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random()}`,
            stickerId: sticker.id,
            sticker,
            x: 50,
            y: 50,
            scale: 1,
            rotation: 0,
            opacity: 1,
        };
        setStickers((prev) => [...prev, newOverlay]);
        setSelectedStickerId(newOverlay.id);
    }, []);

    const handleUpdateSticker = useCallback((overlayId: string, updated: StickerOverlay) => {
        setStickers((prev) => prev.map((s) => (s.id === overlayId ? updated : s)));
    }, []);

    const handleRemoveSticker = useCallback((overlayId: string) => {
        setStickers((prev) => prev.filter((s) => s.id !== overlayId));
        if (selectedStickerId === overlayId) setSelectedStickerId(null);
    }, [selectedStickerId]);

    const addCarouselItems = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;
        const processFile = (file: File): Promise<CarouselItem | null> => {
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return Promise.resolve(null);
            const url = URL.createObjectURL(file);
            const type = file.type.startsWith('image/') ? 'image' as const : 'video' as const;
            if (type === 'image') {
                return Promise.resolve({ id: `item-${Date.now()}-${Math.random()}`, url, type, duration: 3 });
            }
            return new Promise((resolve) => {
                const v = document.createElement('video');
                v.src = url;
                v.preload = 'metadata';
                const onLoaded = () => {
                    const dur = v.duration && isFinite(v.duration) ? v.duration : 5;
                    resolve({ id: `item-${Date.now()}-${Math.random()}`, url, type: 'video', duration: dur });
                };
                v.onloadedmetadata = onLoaded;
                v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
                setTimeout(() => { if (!v.duration) onLoaded(); }, 3000);
            });
        };
        (async () => {
            const toAdd: CarouselItem[] = [];
            for (const file of Array.from(files)) {
                if (carouselItems.length + toAdd.length >= CAROUSEL_MAX) break;
                const item = await processFile(file);
                if (item) toAdd.push(item);
            }
            if (toAdd.length > 0) {
                setCarouselItems((prev) => [...prev, ...toAdd].slice(0, CAROUSEL_MAX));
            }
        })();
    }, [carouselItems.length]);

    const removeCarouselItem = useCallback((id: string) => {
        setCarouselItems((prev) => {
            const item = prev.find((i) => i.id === id);
            if (item?.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
            const next = prev.filter((i) => i.id !== id);
            if (next.length === 0) return prev;
            setCurrentCarouselIndex((i) => Math.min(i, next.length - 1));
            return next;
        });
    }, []);

    const handleSaveToDrafts = useCallback(async () => {
        const effectiveUrl = mediaUrl || (carouselItems.length > 0 ? carouselItems[0]?.url : null);
        if (!effectiveUrl) {
            showToast('No media to save.');
            return;
        }
        if (isSavingDraft) return;

        setIsSavingDraft(true);
        showToast('Saving draft...');

        try {
            const baseItems: CarouselItem[] =
                carouselItems.length > 0
                    ? carouselItems
                    : [{
                        id: 'draft-item-0',
                        url: effectiveUrl,
                        type: mediaType,
                        duration: videoDuration || 0,
                    }];

            const toPersistentUrl = async (url: string): Promise<string | null> => {
                if (!url || (!url.startsWith('blob:') && (url.startsWith('data:') || url.startsWith('http')))) {
                    return url || null;
                }
                if (!url.startsWith('blob:')) return url;
                try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    return await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch {
                    return null;
                }
            };

            const results = await Promise.all(
                baseItems.map(async (item) => {
                    const url = await toPersistentUrl(item.url);
                    return url ? { url, type: item.type as 'image' | 'video', duration: item.duration } : null;
                })
            );

            const persistentItems = results.filter((r): r is { url: string; type: 'image' | 'video'; duration: number } => r !== null);

            if (persistentItems.length === 0) {
                showToast('Could not save media. Try again.');
                Swal.fire(bottomSheet({
                    title: 'Could Not Save',
                    message: 'Media could not be prepared for the draft. Try again.',
                    icon: 'alert',
                    confirmButtonText: 'OK',
                }));
                return;
            }

            const first = persistentItems[0];
            await saveDraft({
                videoUrl: first.url,
                videoDuration: first.duration || 0,
                location: storyLocation.trim() || undefined,
                caption: caption.trim() || undefined,
                venue: venue.trim() || undefined,
                landmark: landmark.trim() || undefined,
                mediaType: first.type,
                mediaItems: persistentItems,
            });

            /* Defer so the “saving” state has painted and Swal reliably shows above the card */
            await new Promise<void>((r) => setTimeout(r, 50));
            await Swal.fire(bottomSheet({
                title: 'Saved to Drafts!',
                message: 'You can find it in your profile. Tap a draft to continue and post.',
                icon: 'success',
                confirmButtonText: 'Done',
            }));
            clearGalleryPreviewMedia();
            navigate('/feed');
        } catch (e) {
            console.error(e);
            showToast('Failed to save draft. Please try again.');
            Swal.fire(bottomSheet({
                title: 'Failed to Save',
                message: 'Could not save draft. Please try again.',
                icon: 'alert',
            }));
        } finally {
            setIsSavingDraft(false);
        }
    }, [mediaUrl, carouselItems, videoDuration, storyLocation, caption, venue, landmark, mediaType, navigate]);

    const handlePost = useCallback(async () => {
        if (!user) {
            showToast('Please log in to post.');
            return;
        }
        const useBackend = import.meta.env.VITE_USE_LARAVEL_API !== 'false' && import.meta.env.VITE_DEV_MODE !== 'true';
        if (mediaType === 'video' && !useBackend) {
            await Swal.fire(bottomSheet({
                title: 'Cannot post video in mock mode',
                message: 'To post videos from your gallery, the Gazetteer backend needs to be running. In mock mode you can post photos and text, but videos will not upload.',
                icon: 'alert',
                confirmButtonText: 'OK',
            }));
            return;
        }
        const thumbForOverlay = mediaType === 'image'
            ? (mediaUrl || (carouselItems[0]?.url ?? ''))
            : (videoFrameDataUrl || mediaUrl || (carouselItems[0]?.url ?? ''));
        const overlay = thumbForOverlay
            ? showUploadOverlay({ thumbUrl: thumbForOverlay, initialMessage: 'Posting to Gazetteer…' })
            : null;
        // Immediately return user to main feed while upload runs in background
        navigate('/feed');
        setIsUploading(true);
        try {
            let persistentMediaUrl = mediaUrl;
            const isVideo = mediaType === 'video';
            if (mediaUrl.startsWith('blob:')) {
                if (isVideo) {
                    // When not using Laravel API or in dev mode, skip upload and keep blob URL so mock post works without backend.
                    const useBackend = import.meta.env.VITE_USE_LARAVEL_API !== 'false' && import.meta.env.VITE_DEV_MODE !== 'true';
                    if (useBackend) {
                        try {
                            const res = await fetch(mediaUrl);
                            if (!res.ok) throw new Error('Failed to fetch video');
                            const blob = await res.blob();
                            const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
                            const { uploadFile } = await import('../api/client');
                            const up = await uploadFile(file);
                            if (up.success && up.fileUrl) {
                                persistentMediaUrl = up.fileUrl;
                            } else {
                                throw new Error(up.error || 'Upload failed');
                            }
                        } catch (uploadError: any) {
                            const msg = uploadError?.message || '';
                            const isConnectionError =
                                msg.includes('CONNECTION_REFUSED') ||
                                msg.includes('Failed to fetch') ||
                                msg.includes('Network error');
                            if (isConnectionError) {
                                console.warn('Video upload failed (backend offline); using blob URL.', uploadError);
                            } else {
                                throw uploadError;
                            }
                        }
                    }
                    // else: persistentMediaUrl stays as blob URL for mock
                } else {
                    const res = await fetch(mediaUrl);
                    const blob = await res.blob();
                    persistentMediaUrl = await new Promise<string>((resolve, reject) => {
                        const r = new FileReader();
                        r.onloadend = () => resolve(r.result as string);
                        r.onerror = reject;
                        r.readAsDataURL(blob);
                    });
                }
            }
            await createPost(
                user.id,
                user.handle,
                caption.trim() || '',
                storyLocation.trim() || '',
                persistentMediaUrl,
                mediaType,
                undefined, // imageText
                caption.trim() || undefined,
                user.local,
                user.regional,
                user.national,
                stickers.length > 0 ? stickers : undefined,
                undefined, // templateId
                undefined, // mediaItems
                undefined, // bannerText
                undefined, // textStyle
                taggedUsers.length > 0 ? taggedUsers : undefined,
                undefined, // videoCaptionsEnabled
                undefined, // videoCaptionText
                undefined, // subtitlesEnabled
                undefined, // subtitleText
                undefined, // editTimeline
                undefined, // reserved optional slot
                venue.trim() || undefined,
                landmark.trim() || undefined,
                socialUploadTarget
            );
            clearGalleryPreviewMedia();
            showToast('Post created successfully!');
            window.dispatchEvent(new CustomEvent('postCreated'));
            if (overlay) {
                overlay.success('Your post is now live on the feed.');
            }
        } catch (err: any) {
            console.error(err);
            showToast(err?.message || 'Failed to create post. Please try again.');
            if (overlay) {
                overlay.error('Could not post. Please try again.');
            }
        } finally {
            setIsUploading(false);
        }
    }, [user, mediaUrl, mediaType, carouselItems, stickers, storyLocation, venue, landmark, taggedUsers, navigate, videoFrameDataUrl, socialUploadTarget]);

    const content = (
        <div
            className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] w-full min-h-0 flex-col overflow-hidden bg-black"
        >
            <div
                className="pointer-events-none absolute left-0 top-0 z-0 h-[20vh] w-[20vw] min-h-[120px] min-w-[120px] max-h-[320px] max-w-[320px]"
                style={{ background: PROFILE_STORY_RING_GRADIENT, opacity: 0.38, maskImage: 'radial-gradient(ellipse 90% 90% at 0% 0%, black 38%, transparent 72%)', WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 0% 0%, black 38%, transparent 72%)' }}
                aria-hidden
            />
            <div
                className="pointer-events-none absolute bottom-0 right-0 z-0 h-[20vh] w-[20vw] min-h-[120px] min-w-[120px] max-h-[320px] max-w-[320px]"
                style={{ background: PROFILE_STORY_RING_GRADIENT, opacity: 0.38, maskImage: 'radial-gradient(ellipse 90% 90% at 100% 100%, black 38%, transparent 72%)', WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 100% 100%, black 38%, transparent 72%)' }}
                aria-hidden
            />
            {/* Same pattern as Instant Create: flex column inside route (no portal). Preview must keep min-height or mobile collapses it to black until scroll. */}
            <div className="relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            <div
                className={`relative w-full min-w-0 overflow-hidden bg-black ${
                    cardBodyExpanded
                        ? 'h-[45dvh] max-h-[45dvh] shrink-0'
                        : 'min-h-[52vh] flex-1'
                }`}
            >
            <section
                aria-label="Preview"
                className="absolute inset-0 min-h-0 bg-black"
            >
                <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
                    <button
                        onClick={() => {
                            clearGalleryPreviewMedia();
                            navigate('/create/instant');
                        }}
                        className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70"
                        aria-label="Back"
                    >
                        <FiArrowLeft className="w-6 h-6" />
                    </button>
                    {carouselItems.length > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentCarouselIndex((i) => Math.max(0, i - 1))}
                                disabled={currentCarouselIndex === 0}
                                className="p-2 rounded-full bg-black/50 text-white disabled:opacity-40"
                                aria-label="Previous"
                            >
                                <FiArrowLeft className="w-4 h-4 rotate-180" />
                            </button>
                            <span className="text-white text-sm font-medium min-w-[3ch]">{currentCarouselIndex + 1} / {carouselItems.length}</span>
                            <button
                                type="button"
                                onClick={() => setCurrentCarouselIndex((i) => Math.min(carouselItems.length - 1, i + 1))}
                                disabled={currentCarouselIndex === carouselItems.length - 1}
                                className="p-2 rounded-full bg-black/50 text-white disabled:opacity-40"
                                aria-label="Next"
                            >
                                <FiArrowLeft className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {mediaType === 'video' && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const next = !isMuted;
                                setIsMuted(next);
                                if (videoRef.current) videoRef.current.muted = next;
                            }}
                            className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70"
                            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <FiVolumeX className="w-5 h-5" /> : <FiVolume2 className="w-5 h-5" />}
                        </button>
                    )}
                    {/* Post button with white border */}
                    <div className="rounded-full p-[1.5px] bg-white">
                        <button
                            onClick={handlePost}
                            disabled={isUploading}
                            className="p-2.5 rounded-full bg-black text-white disabled:opacity-50 transition-colors shadow-lg flex-shrink-0 hover:bg-black"
                            title="Post to newsfeed"
                            aria-label="Post to newsfeed"
                        >
                            <FiSend className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                {socialUploadTarget && (
                    <div className="absolute top-[4.25rem] left-0 right-0 z-10 px-4 flex justify-center pointer-events-none">
                        <p className="text-center text-[11px] leading-snug text-white/90 bg-black/55 backdrop-blur-md rounded-full px-3 py-2 max-w-sm border border-white/15 shadow-lg">
                            {socialUploadTarget === 'youtube_shorts' && (
                                <>
                                    You&rsquo;re uploading to Gazetteer &mdash; <strong className="font-semibold text-white">location</strong> is what surfaces your post to people nearby.
                                    When you&rsquo;re ready, share this clip to <strong className="font-semibold text-white">YouTube Shorts</strong> from your device the same way.
                                </>
                            )}
                            {socialUploadTarget === 'tiktok' && (
                                <>
                                    You&rsquo;re uploading to Gazetteer &mdash; <strong className="font-semibold text-white">location</strong> is what surfaces your post to people nearby.
                                    When you&rsquo;re ready, share this clip to <strong className="font-semibold text-white">TikTok</strong> from your device the same way.
                                </>
                            )}
                            {socialUploadTarget === 'instagram_reels' && (
                                <>
                                    You&rsquo;re uploading to Gazetteer &mdash; <strong className="font-semibold text-white">location</strong> is what surfaces your post to people nearby.
                                    When you&rsquo;re ready, share this clip to <strong className="font-semibold text-white">Instagram</strong> from your device the same way.
                                </>
                            )}
                        </p>
                    </div>
                )}
                <div
                    ref={containerRef}
                    className="absolute inset-0 flex min-h-0 items-center justify-center bg-black overflow-hidden"
                    onClick={(e) => {
                        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).tagName === 'IMG')
                            setSelectedStickerId(null);
                    }}
                >
                    {mediaType === 'video'
                        ? (mediaUrl && mediaUrl.trim()) ? (
                            <video
                                ref={videoRef}
                                src={mediaUrl}
                                playsInline
                                loop
                                autoPlay
                                preload="auto"
                                muted={isMuted}
                                className="absolute inset-0 w-full h-full object-contain"
                                style={filterStyle}
                            />
                        ) : null
                        : (mediaUrl && mediaUrl.trim()) ? (
                            <img
                                src={mediaUrl}
                                alt="Preview"
                                className="absolute inset-0 w-full h-full object-contain"
                                style={filterStyle}
                            />
                        ) : null
                    }
                    {stickers.map((overlay) => (
                        <StickerOverlayComponent
                            key={overlay.id}
                            overlay={overlay}
                            onUpdate={(u) => handleUpdateSticker(overlay.id, u)}
                            onRemove={() => handleRemoveSticker(overlay.id)}
                            isSelected={selectedStickerId === overlay.id}
                            onSelect={() => setSelectedStickerId(overlay.id)}
                            containerWidth={containerSize.width || 400}
                            containerHeight={containerSize.height || 400}
                        />
                    ))}
                </div>
            </section>
            </div>

            <div
                className={`flex flex-col rounded-t-[24px] bg-black ${
                    cardBodyExpanded
                        ? 'min-h-0 flex-1 overflow-y-auto'
                        : 'max-h-[min(48vh,28rem)] shrink-0 overflow-x-hidden overflow-y-auto'
                }`}
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom, 0)',
                    borderWidth: '1.5px 0 0 0',
                    borderStyle: 'solid',
                    borderColor: 'rgba(255,255,255,0.65)',
                }}
            >
                <div className="relative">
                    {/* Light scrim inside sheet only (avoid overlapping media above; preview is a flex sibling, not under the sheet). */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/45 to-transparent rounded-t-[24px]"
                    />
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setCardBodyExpanded((e) => !e)}
                        onPointerDown={(e) => {
                            dragStartYRef.current = e.clientY ?? (e as React.PointerEvent & { touches?: { clientY: number }[] }).touches?.[0]?.clientY ?? 0;
                            dragTriggeredRef.current = false;
                        }}
                        onPointerMove={(e) => {
                            if (dragTriggeredRef.current) return;
                            const clientY = e.clientY ?? (e as React.PointerEvent & { touches?: { clientY: number }[] }).touches?.[0]?.clientY;
                            if (clientY == null || dragStartYRef.current == null) return;
                            const dy = clientY - dragStartYRef.current;
                            if (Math.abs(dy) < dragThreshold) return;
                            dragTriggeredRef.current = true;
                            if (dy > 0) {
                                setCardBodyExpanded(false);
                            } else {
                                setCardBodyExpanded(true);
                            }
                        }}
                        onPointerUp={() => { dragStartYRef.current = 0; dragTriggeredRef.current = false; }}
                        onPointerLeave={() => { dragStartYRef.current = 0; dragTriggeredRef.current = false; }}
                        onPointerCancel={() => { dragStartYRef.current = 0; dragTriggeredRef.current = false; }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCardBodyExpanded((e) => !e); } }}
                        className="relative z-10 w-full pt-2 pb-2 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing active:bg-white/5 transition-colors select-none"
                        style={{ touchAction: 'none' }}
                        aria-label={cardBodyExpanded ? 'Drag down to collapse or tap to toggle' : 'Tap to expand'}
                    >
                        <div className="w-16 h-1.5 bg-white/50 rounded-full pointer-events-none" />
                        <span className="text-[10px] text-white/60 pointer-events-none">{cardBodyExpanded ? 'Drag down to collapse' : 'Tap to expand'}</span>
                    </div>
                    {/* Card header: centered snap picker + Save. Drag selects, tap centered item opens content. */}
                    <div className="relative z-10 flex items-center gap-2 px-3 pb-2 mt-3 border-b border-white/10 bg-black/25 backdrop-blur-[1px]">
                    <div
                        ref={pickerRailRef}
                        className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1"
                        style={{ scrollSnapType: 'x mandatory' }}
                        onPointerDown={() => setIsPickerDragging(true)}
                        onPointerUp={() => window.setTimeout(() => setIsPickerDragging(false), 80)}
                        onPointerCancel={() => setIsPickerDragging(false)}
                        onPointerLeave={() => setIsPickerDragging(false)}
                    >
                        <div className="shrink-0 w-[38%]" aria-hidden />
                        {pickerTabs.map((tab) => {
                            const Icon = tab.icon as React.ComponentType<{ className?: string }>;
                            const isCentered = centeredPickerTab === tab.id;
                            const isPulsing = pulsingPickerTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    data-picker-tab={tab.id}
                                    onClick={() => {
                                        if (isPickerDragging) return;
                                        if (!isCentered) {
                                            centerPickerTab(tab.id, true);
                                            return;
                                        }
                                        setCardTab(tab.id);
                                        setCardBodyExpanded(true);
                                    }}
                                    title={tab.title}
                                    aria-label={tab.title}
                                    className="relative shrink-0 w-[62px] h-[62px] flex items-center justify-center transition-transform duration-200"
                                    style={{
                                        scrollSnapAlign: 'center',
                                        transform: `scale(${isCentered ? (isPulsing ? 1.15 : 1.10) : 0.86})`,
                                        opacity: isCentered ? 1 : 0.62,
                                    }}
                                >
                                    <div
                                        className={`p-[2px] rounded-full transition-shadow duration-200 ${isCentered ? (isPulsing ? 'shadow-[0_0_30px_rgba(255,255,255,0.35)]' : 'shadow-[0_0_24px_rgba(255,255,255,0.22)]') : ''}`}
                                        style={{ background: isCentered ? '#ffffff' : 'rgba(255,255,255,0.78)' }}
                                    >
                                        <div className={`${isCentered ? 'w-11 h-11' : 'w-10 h-10'} rounded-full bg-black flex items-center justify-center transition-all duration-200`}>
                                            <Icon className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                    {tab.id === 'carousel' && carouselItems.length > 1 && (
                                        <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-white/90 text-black text-[10px] font-bold flex items-center justify-center">
                                            {carouselItems.length}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                        <div className="shrink-0 w-[38%]" aria-hidden />
                    </div>
                    <button
                        onClick={handleSaveToDrafts}
                        disabled={!(mediaUrl || (carouselItems.length > 0 && carouselItems[0]?.url)) || isSavingDraft}
                        className={`flex-shrink-0 p-2.5 rounded-xl ml-auto transition-colors ${
                            isSavingDraft
                                ? 'bg-white text-black'
                                : (mediaUrl || (carouselItems.length > 0 && carouselItems[0]?.url))
                                    ? 'text-white hover:bg-white/10'
                                    : 'text-white/40 cursor-not-allowed'
                        }`}
                        title={isSavingDraft ? 'Saving to drafts…' : 'Save to drafts'}
                        aria-label="Save to drafts"
                    >
                        <FiBookmark className="w-5 h-5" />
                    </button>
                </div>
                </div>
                {/* Card body - collapses so header icons stay reachable */}
                <div
                    className="min-h-0 overflow-hidden transition-[max-height] duration-300 ease-out overflow-y-auto px-4 py-4"
                    style={{ maxHeight: cardBodyExpanded ? '40vh' : 0 }}
                >
                    {cardTab === 'caption' && (
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-white/70">
                                Caption
                            </label>
                            {/* Rounded gradient border ring (inner background solid dark) */}
                            <div
                                className="rounded-2xl p-[1.5px]"
                                style={{ background: 'linear-gradient(135deg,#404040,#d4d4d4)' }}
                            >
                                <div className="rounded-[1rem] bg-[#020617]">
                                    <textarea
                                        value={caption}
                                        onChange={(e) => setCaption(e.target.value)}
                                        placeholder="Write a caption..."
                                        rows={3}
                                        maxLength={500}
                                        className="w-full rounded-[1rem] bg-transparent border-none px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-0 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <span className="text-[11px] text-white/40">
                                    {caption.length}/500
                                </span>
                            </div>
                        </div>
                    )}
                    {cardTab === 'filters' && (
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[35vh]">
                            {FILTER_NAMES.map((f) => {
                                const isSelected = selectedFilter === f;
                                const thumbFilterStyle = getFilterStyle(f, brightness, contrast, saturation, hue);
                                return (
                                    <button
                                        key={f}
                                        onClick={() => setSelectedFilter(f)}
                                        className={`flex flex-row items-center gap-3 w-full p-2 rounded-xl focus:outline-none text-left ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black bg-white/10' : 'hover:bg-white/5'}`}
                                        aria-label={`Filter: ${f}`}
                                    >
                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 bg-gray-800 flex-shrink-0 flex items-center justify-center">
                                            {(mediaType === 'image' && mediaUrl) || (mediaType === 'video' && videoFrameDataUrl) ? (
                                                <img
                                                    src={mediaType === 'image' ? mediaUrl : videoFrameDataUrl!}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    style={thumbFilterStyle}
                                                />
                                            ) : (
                                                <div
                                                    className="w-full h-full bg-gradient-to-br from-gray-500 to-gray-700"
                                                    style={thumbFilterStyle}
                                                />
                                            )}
                                        </div>
                                        <span className="text-sm font-medium text-white">{f}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {cardTab === 'stickers' && (
                        <>
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-2">
                                {STICKER_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setStickerCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                                            stickerCategory === cat ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            {stickersLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-6 gap-2">
                                    {stickerList.map((sticker) => (
                                        <button
                                            key={sticker.id}
                                            onClick={() => handleSelectSticker(sticker)}
                                            className="aspect-square rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-2xl"
                                        >
                                            {sticker.emoji ? (
                                                <span>{sticker.emoji}</span>
                                            ) : sticker.url ? (
                                                <img src={sticker.url} alt={sticker.name} className="w-full h-full object-contain rounded-xl" />
                                            ) : (
                                                <span className="text-gray-500 text-xs">{sticker.name}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {cardTab === 'location' && (
                        <div className="space-y-3">
                            {/* Story location with rounded gradient ring (inner background solid dark) */}
                            <div
                                className="rounded-2xl p-[1.5px]"
                                style={{ background: 'linear-gradient(135deg,#3b82f6,#a855f7)' }}
                            >
                                <div className="rounded-[1rem] bg-[#020617] overflow-hidden">
                                    <label className="block px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Story location</label>
                                    <input
                                        type="text"
                                        value={storyLocation}
                                        onChange={(e) => setStoryLocation(e.target.value)}
                                        placeholder="Add story location"
                                        className="w-full px-4 pb-3 bg-transparent text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Venue with rounded gradient ring */}
                            <div
                                className="rounded-2xl p-[1.5px]"
                                style={{ background: 'linear-gradient(135deg,#404040,#d4d4d4)' }}
                            >
                                <div className="rounded-[1rem] bg-[#020617] overflow-hidden">
                                    <label className="block px-4 py-3 text-xs font-medium text-white/70 uppercase tracking-wide">Venue</label>
                                    <input
                                        type="text"
                                        value={venue}
                                        onChange={(e) => setVenue(e.target.value)}
                                        placeholder="Add venue"
                                        className="w-full px-4 pb-3 bg-transparent text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Landmark */}
                            <div
                                className="rounded-2xl p-[1.5px]"
                                style={{ background: 'linear-gradient(135deg,#525252,#a3a3a3)' }}
                            >
                                <div className="rounded-[1rem] bg-[#020617] overflow-hidden">
                                    <label className="block px-4 py-3 text-xs font-medium text-white/70 uppercase tracking-wide">Landmark</label>
                                    <input
                                        type="text"
                                        value={landmark}
                                        onChange={(e) => setLandmark(e.target.value)}
                                        placeholder="Add landmark (optional)"
                                        className="w-full px-4 pb-3 bg-transparent text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Tag user with rounded gradient ring */}
                            <div
                                className="rounded-2xl p-[1.5px]"
                                style={{ background: 'linear-gradient(135deg,#3b82f6,#a855f7)' }}
                            >
                                <div className="rounded-[1rem] bg-[#020617] overflow-hidden">
                                    <label className="block px-4 py-3 text-xs font-medium text-white/70 uppercase tracking-wide">Tag user</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowTagUserModal(true)}
                                        className="w-full px-4 pb-3 flex items-center gap-2 text-left text-sm text-white/90 hover:text-white focus:outline-none"
                                    >
                                        <div
                                            className="p-[1px] rounded-full flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg,#737373,#e5e5e5)' }}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
                                                <FiUser className="w-3.5 h-3.5 text-white" />
                                            </div>
                                        </div>
                                        <span className={taggedUsers.length > 0 ? 'text-white' : 'text-white/50'}>
                                            {taggedUsers.length > 0 ? taggedUsers.map((h) => `@${h}`).join(', ') : 'Tag user'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {cardTab === 'carousel' && (
                        <div className="space-y-3">
                            <input
                                ref={carouselInputRef}
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    addCarouselItems(e.target.files);
                                    e.target.value = '';
                                }}
                            />
                            <p className="text-xs text-white/60">
                                Add up to {CAROUSEL_MAX} images or videos for a carousel post. Hold and drag a thumbnail to reorder.
                            </p>
                            <button
                                type="button"
                                onClick={() => carouselInputRef.current?.click()}
                                disabled={carouselItems.length >= CAROUSEL_MAX}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-medium text-sm"
                            >
                                <FiPlus className="w-5 h-5" />
                                Add photos or videos ({carouselItems.length}/{CAROUSEL_MAX})
                            </button>
                            <div className="flex flex-wrap gap-2">
                                {carouselItems.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={() => setDraggingIndex(idx)}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            if (draggingIndex === null || draggingIndex === idx) return;
                                            setCarouselItems((prev) => {
                                                const updated = [...prev];
                                                const [moved] = updated.splice(draggingIndex, 1);
                                                updated.splice(idx, 0, moved);
                                                return updated;
                                            });
                                            setDraggingIndex(idx);
                                        }}
                                        onDragEnd={() => setDraggingIndex(null)}
                                        className="relative w-14 h-14 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 border-2 border-transparent cursor-move"
                                        style={currentCarouselIndex === idx ? { borderColor: 'white' } : undefined}
                                    >
                                        {item.type === 'video' ? (
                                            item.url ? <video src={item.url} className="w-full h-full object-cover" muted playsInline /> : <div className="w-full h-full bg-white/10" />
                                        ) : (
                                            item.url ? <img src={item.url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/10" />
                                        )}
                                        <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-white text-center py-0.5">{idx + 1}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeCarouselItem(item.id)}
                                            disabled={carouselItems.length <= 1}
                                            className="absolute top-0 right-0 p-1 rounded-full bg-red-600/90 text-white hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none"
                                            aria-label="Remove"
                                        >
                                            <FiX className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </div>
            <UserTaggingModal
                isOpen={showTagUserModal}
                onClose={() => setShowTagUserModal(false)}
                onSelectUser={(handle) => setTaggedUsers((prev) => (prev.includes(handle) ? prev : [...prev, handle]))}
                taggedUsers={taggedUsers}
            />
        </div>
    );

    return content;
}
