/**
 * Gallery upload preview: top = media preview, bottom = Swal-style pull-up card
 * with Filters | Stickers | Save to drafts | Post. No music, no trim/edits.
 */
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiFilter, FiSmile, FiMapPin, FiBookmark, FiSend, FiArrowLeft, FiUser, FiLayers, FiPlus, FiX } from 'react-icons/fi';
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

const FILTER_NAMES = ['None', 'B&W', 'Sepia', 'Vivid', 'Cool', 'Vignette', 'Beauty'];
const CAROUSEL_MAX = 10;

type CarouselItem = { id: string; url: string; type: 'image' | 'video'; duration: number };

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
    } | null) || {};

    const [resolvedMediaUrl, setResolvedMediaUrl] = useState(state.mediaUrl ?? '');
    const [resolvedMediaType, setResolvedMediaType] = useState<'image' | 'video'>(state.mediaType ?? 'video');
    const [resolvedVideoDuration, setResolvedVideoDuration] = useState(state.videoDuration ?? 0);
    const [hasCheckedCache, setHasCheckedCache] = useState(false);
    const blobUrlToRevokeRef = useRef<string | null>(null);

    useEffect(() => {
        const cached = getGalleryPreviewMedia();
        if (cached) {
            const url = URL.createObjectURL(cached.blob);
            blobUrlToRevokeRef.current = url;
            setResolvedMediaUrl(url);
            setResolvedMediaType(cached.mediaType);
            setResolvedVideoDuration(cached.videoDuration);
            clearGalleryPreviewMedia();
        }
        setHasCheckedCache(true);
        return () => {
            if (blobUrlToRevokeRef.current) {
                URL.revokeObjectURL(blobUrlToRevokeRef.current);
                blobUrlToRevokeRef.current = null;
            }
            clearGalleryPreviewMedia();
        };
    }, []);

    const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
    const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
    const carouselInitializedRef = useRef(false);

    useEffect(() => {
        if (carouselInitializedRef.current || !resolvedMediaUrl) return;
        carouselInitializedRef.current = true;
        setCarouselItems([{
            id: `item-${Date.now()}`,
            url: resolvedMediaUrl,
            type: resolvedMediaType,
            duration: resolvedVideoDuration || 0,
        }]);
    }, [resolvedMediaUrl, resolvedMediaType, resolvedVideoDuration]);

    const currentItem = carouselItems[currentCarouselIndex];
    const mediaUrl = currentItem?.url ?? resolvedMediaUrl;
    const mediaType = currentItem?.type ?? resolvedMediaType;
    const videoDuration = currentItem?.duration ?? resolvedVideoDuration;

    const [cardTab, setCardTab] = useState<'filters' | 'stickers' | 'location' | 'carousel'>('filters');
    const [storyLocation, setStoryLocation] = useState('');
    const [venue, setVenue] = useState('');
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
    const [cardBodyExpanded, setCardBodyExpanded] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const videoRef = useRef<HTMLVideoElement>(null);
    const carouselInputRef = useRef<HTMLInputElement>(null);
    const [videoFrameDataUrl, setVideoFrameDataUrl] = useState<string | null>(null);
    const dragStartYRef = useRef<number>(0);
    const dragTriggeredRef = useRef<boolean>(false);
    const dragThreshold = 24;

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
    }, [mediaUrl]);

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
        if (!mediaUrl) return;
        try {
            await saveDraft({
                videoUrl: mediaUrl,
                videoDuration: videoDuration || 0,
                location: storyLocation.trim() || undefined,
            });
            await Swal.fire(bottomSheet({
                title: 'Saved to Drafts!',
                message: 'You can find it in your profile page.',
                icon: 'success',
                confirmButtonText: 'Done',
            }));
            navigate('/feed');
        } catch (e) {
            console.error(e);
            Swal.fire(bottomSheet({
                title: 'Failed to Save',
                message: 'Could not save draft. Please try again.',
                icon: 'alert',
            }));
        }
    }, [mediaUrl, videoDuration, storyLocation, navigate]);

    const handlePost = useCallback(async () => {
        if (!user) {
            showToast('Please log in to post.');
            return;
        }
        setIsUploading(true);
        try {
            let persistentMediaUrl = mediaUrl;
            const isVideo = mediaType === 'video';
            if (mediaUrl.startsWith('blob:')) {
                if (isVideo) {
                    const res = await fetch(mediaUrl);
                    if (!res.ok) throw new Error('Failed to fetch video');
                    const blob = await res.blob();
                    const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
                    const { uploadFile } = await import('../api/client');
                    const up = await uploadFile(file);
                    if (up.success && up.fileUrl) persistentMediaUrl = up.fileUrl;
                    else throw new Error(up.error || 'Upload failed');
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
                '',
                storyLocation.trim() || '',
                persistentMediaUrl,
                mediaType,
                undefined,
                undefined,
                user.local,
                user.regional,
                user.national,
                stickers.length > 0 ? stickers : undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                taggedUsers.length > 0 ? taggedUsers : undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                venue.trim() || undefined
            );
            showToast('Post created successfully!');
            navigate('/feed');
        } catch (err: any) {
            console.error(err);
            showToast(err?.message || 'Failed to create post. Please try again.');
        } finally {
            setIsUploading(false);
        }
    }, [user, mediaUrl, mediaType, carouselItems, stickers, storyLocation, venue, taggedUsers, navigate]);

    if (hasCheckedCache && !mediaUrl) return null;

    const content = (
        <div
            className="fixed inset-0 bg-black w-full"
            style={{
                zIndex: 99999,
                width: '100vw',
                left: 0,
                right: 0,
                minHeight: '100dvh',
            }}
        >
            {/* Full-screen preview - fills viewport */}
            <section
                aria-label="Preview"
                className="absolute inset-0 bg-black"
            >
                <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/create/instant')}
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
                    <button
                        onClick={handlePost}
                        disabled={isUploading}
                        className="p-2.5 bg-white text-gray-900 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors shadow-lg flex-shrink-0"
                        title="Post to newsfeed"
                        aria-label="Post to newsfeed"
                    >
                        <FiSend className="w-6 h-6" />
                    </button>
                </div>
                <div
                    ref={containerRef}
                    className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden"
                    onClick={(e) => {
                        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).tagName === 'IMG')
                            setSelectedStickerId(null);
                    }}
                >
                    {mediaType === 'video' ? (
                        <video
                            ref={videoRef}
                            src={mediaUrl}
                            playsInline
                            muted
                            loop
                            autoPlay
                            preload="auto"
                            className="absolute inset-0 w-full h-full object-contain"
                            style={filterStyle}
                        />
                    ) : (
                        <img
                            src={mediaUrl}
                            alt="Preview"
                            className="absolute inset-0 w-full h-full object-contain"
                            style={filterStyle}
                        />
                    )}
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

            {/* Card overlay - black card, white icons */}
            <div
                className="absolute bottom-0 left-0 right-0 z-20 flex flex-col max-h-[85dvh] rounded-t-[24px] overflow-hidden overflow-y-auto bg-black"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
            >
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
                    className="w-full pt-2 pb-3 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing active:bg-white/5 transition-colors select-none"
                    style={{ touchAction: 'none' }}
                    aria-label={cardBodyExpanded ? 'Drag down to collapse or tap to toggle' : 'Tap to expand'}
                >
                    <div className="w-16 h-1.5 bg-white/50 rounded-full pointer-events-none" />
                    <span className="text-[10px] text-white/60 pointer-events-none">{cardBodyExpanded ? 'Drag down to collapse' : 'Tap to expand'}</span>
                </div>
                {/* Card header: Carousel, Location, Filters, Stickers, then Save far right - all white icons */}
                <div className="flex items-center gap-2 px-4 pb-2 border-b border-white/10 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setCardTab('carousel')}
                        title="Add photos/videos (carousel, max 10)"
                        aria-label="Carousel"
                        className={`flex-shrink-0 flex items-center justify-center p-2.5 rounded-xl transition-colors relative text-white ${
                            cardTab === 'carousel' ? 'bg-white/20 ring-2 ring-white/50' : 'hover:bg-white/10'
                        }`}
                    >
                        <FiLayers className="w-5 h-5" />
                        {carouselItems.length > 1 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 rounded-full bg-white/90 text-black text-[10px] font-bold flex items-center justify-center">
                                {carouselItems.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setCardTab('location')}
                        title="Location, venue, tag user"
                        aria-label="Location"
                        className={`flex-shrink-0 flex items-center justify-center p-2.5 rounded-xl transition-colors text-white ${
                            cardTab === 'location' ? 'bg-white/20 ring-2 ring-white/50' : 'hover:bg-white/10'
                        }`}
                    >
                        <FiMapPin className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setCardTab('filters')}
                        title="Filters"
                        aria-label="Filters"
                        className={`flex-shrink-0 flex items-center justify-center p-2.5 rounded-xl transition-colors text-white ${
                            cardTab === 'filters' ? 'bg-white/20 ring-2 ring-white/50' : 'hover:bg-white/10'
                        }`}
                    >
                        <FiFilter className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setCardTab('stickers')}
                        title="Stickers"
                        aria-label="Stickers"
                        className={`flex-shrink-0 flex items-center justify-center p-2.5 rounded-xl transition-colors text-white ${
                            cardTab === 'stickers' ? 'bg-white/20 ring-2 ring-white/50' : 'hover:bg-white/10'
                        }`}
                    >
                        <FiSmile className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleSaveToDrafts}
                        className="flex-shrink-0 p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors ml-auto"
                        title="Save to drafts"
                        aria-label="Save to drafts"
                    >
                        <FiBookmark className="w-5 h-5" />
                    </button>
                </div>
                {/* Card body - collapses so header icons stay reachable */}
                <div
                    className="overflow-hidden transition-[max-height] duration-300 ease-out overflow-y-auto px-4 py-4"
                    style={{ maxHeight: cardBodyExpanded ? '40vh' : 0 }}
                >
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
                            <div className="rounded-xl bg-gray-800/80 border border-gray-700/50 overflow-hidden">
                                <label className="block px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Story location</label>
                                <input
                                    type="text"
                                    value={storyLocation}
                                    onChange={(e) => setStoryLocation(e.target.value)}
                                    placeholder="Add story location"
                                    className="w-full px-4 pb-3 bg-transparent text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                                />
                            </div>
                            <div className="rounded-xl bg-white/10 border border-white/20 overflow-hidden">
                                <label className="block px-4 py-3 text-xs font-medium text-white/70 uppercase tracking-wide">Venue</label>
                                <input
                                    type="text"
                                    value={venue}
                                    onChange={(e) => setVenue(e.target.value)}
                                    placeholder="Add venue"
                                    className="w-full px-4 pb-3 bg-transparent text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                                />
                            </div>
                            <div className="rounded-xl bg-white/10 border border-white/20 overflow-hidden">
                                <label className="block px-4 py-3 text-xs font-medium text-white/70 uppercase tracking-wide">Tag user</label>
                                <button
                                    type="button"
                                    onClick={() => setShowTagUserModal(true)}
                                    className="w-full px-4 pb-3 flex items-center gap-2 text-left text-sm text-white/90 hover:text-white focus:outline-none"
                                >
                                    <FiUser className="w-4 h-4 text-white/60 flex-shrink-0" />
                                    <span className={taggedUsers.length > 0 ? 'text-white' : 'text-white/50'}>
                                        {taggedUsers.length > 0 ? taggedUsers.map((h) => `@${h}`).join(', ') : 'Tag user'}
                                    </span>
                                </button>
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
                            <p className="text-xs text-white/60">Add up to {CAROUSEL_MAX} images or videos for a carousel post.</p>
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
                                        className="relative w-14 h-14 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 border-2 border-transparent"
                                        style={currentCarouselIndex === idx ? { borderColor: 'white' } : undefined}
                                    >
                                        {item.type === 'video' ? (
                                            <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                                        ) : (
                                            <img src={item.url} alt="" className="w-full h-full object-cover" />
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
            <UserTaggingModal
                isOpen={showTagUserModal}
                onClose={() => setShowTagUserModal(false)}
                onSelectUser={(handle) => setTaggedUsers((prev) => (prev.includes(handle) ? prev : [...prev, handle]))}
                taggedUsers={taggedUsers}
            />
        </div>
    );

    return createPortal(content, document.body);
}
