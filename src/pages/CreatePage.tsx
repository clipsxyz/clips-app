import React from 'react';
import { useAuth } from '../context/Auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPost } from '../api/posts';
import { FiImage, FiMapPin, FiX, FiZap, FiLayers, FiSmile, FiEdit } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import type { Post, StickerOverlay, Sticker } from '../types';
import StickerPicker from '../components/StickerPicker';
import StickerOverlayComponent from '../components/StickerOverlay';
import TextStickerModal from '../components/TextStickerModal';

export default function CreatePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const locationState = useLocation().state as {
        videoUrl?: string;
        filtered?: boolean;
        filterInfo?: {
            active: string;
            brightness: number;
            contrast: number;
            saturation: number;
            hue: number;
            exportFailed: boolean;
        };
    } | null;
    const [text, setText] = React.useState(''); // Main text - used for text-only posts OR captions for image posts
    const [location, setLocation] = React.useState('');
    const [selectedMedia, setSelectedMedia] = React.useState<string | null>(null);
    const [mediaType, setMediaType] = React.useState<'image' | 'video' | null>(null);
    const [imageText, setImageText] = React.useState(''); // Text overlay for images
    const [bannerText, setBannerText] = React.useState(''); // News ticker banner text
    const [isUploading, setIsUploading] = React.useState(false);
    const [filteredFromFlow, setFilteredFromFlow] = React.useState(false);
    const [wantsToBoost, setWantsToBoost] = React.useState(false);
    const [createdPost, setCreatedPost] = React.useState<Post | null>(null);
    const [stickers, setStickers] = React.useState<StickerOverlay[]>([]);
    const [showStickerPicker, setShowStickerPicker] = React.useState(false);
    const [showTextStickerModal, setShowTextStickerModal] = React.useState(false);
    const [selectedStickerOverlay, setSelectedStickerOverlay] = React.useState<string | null>(null);
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
    const captionRef = React.useRef<HTMLTextAreaElement | null>(null);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

    React.useEffect(() => {
        if (mediaContainerRef.current && selectedMedia) {
            const updateSize = () => {
                const rect = mediaContainerRef.current?.getBoundingClientRect();
                if (rect) {
                    setContainerSize({ width: rect.width, height: rect.height });
                }
            };
            updateSize();
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }
    }, [selectedMedia]);

    // Helper to build CSS filter string from filterInfo
    function buildCssFilterFromFilterInfo() {
        const info = locationState?.filterInfo;
        if (!info) return '';
        const parts: string[] = [];
        if (info.active === 'bw') parts.push('grayscale(1)');
        else if (info.active === 'sepia') parts.push('sepia(0.8)');
        else if (info.active === 'vivid') parts.push(`saturate(${1.6 * (info.saturation || 1)}) contrast(${1.1 * (info.contrast || 1)})`);
        else if (info.active === 'cool') parts.push(`hue-rotate(200deg) saturate(${1.2 * (info.saturation || 1)})`);
        if (info.brightness && info.brightness !== 1) parts.push(`brightness(${info.brightness})`);
        if (info.contrast && info.contrast !== 1) parts.push(`contrast(${info.contrast})`);
        if (info.saturation && info.saturation !== 1) parts.push(`saturate(${info.saturation})`);
        if (info.hue && info.hue !== 0) parts.push(`hue-rotate(${info.hue * 360}deg)`);
        return parts.join(' ');
    }

    // Fallback: if export failed earlier, re-export with Canvas 2D here
    async function ensureFilteredVideoIfNeeded(originalUrl: string): Promise<string> {
        const info = locationState?.filterInfo;
        if (!info || !info.exportFailed) return originalUrl;
        try {
            const v = document.createElement('video');
            v.src = originalUrl;
            v.crossOrigin = 'anonymous';
            v.muted = true;
            v.playsInline = true;
            await new Promise<void>((resolve) => {
                if (v.readyState >= 1) return resolve();
                const on = () => { v.removeEventListener('loadedmetadata', on); resolve(); };
                v.addEventListener('loadedmetadata', on);
                setTimeout(() => { v.removeEventListener('loadedmetadata', on); resolve(); }, 1500);
            });
            const srcW = v.videoWidth || 720;
            const srcH = v.videoHeight || 1280;
            const longSide = Math.max(srcW, srcH);
            const scale = longSide > 720 ? 720 / longSide : 1;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(srcW * scale);
            canvas.height = Math.round(srcH * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return originalUrl;
            const filterStr = buildCssFilterFromFilterInfo();
            const stream = canvas.captureStream(24);
            let mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
            const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1200000 });
            const chunks: BlobPart[] = [];
            mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
            const done = new Promise<void>((resolve) => { mr.onstop = () => resolve(); });

            let last = -1;
            const draw = () => {
                if (v.ended) { if (mr.state !== 'inactive') mr.stop(); return; }
                if (v.currentTime !== last) {
                    ctx.filter = filterStr || 'none';
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    last = v.currentTime;
                }
                requestAnimationFrame(draw);
            };

            v.currentTime = 0;
            v.loop = false;
            mr.start(500);
            await v.play();
            requestAnimationFrame(draw);
            const safety = setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, 8000);
            await done;
            clearTimeout(safety);
            if (chunks.length === 0) return originalUrl;
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size < 1000) return originalUrl;
            return URL.createObjectURL(blob);
        } catch {
            return originalUrl;
        }
    }

    // Prefill from Instant Filters flow
    React.useEffect(() => {
        (async () => {
            if (locationState?.videoUrl) {
                let url = locationState.videoUrl;
                // If export failed upstream, try to produce a filtered video here
                url = await ensureFilteredVideoIfNeeded(url);
                setSelectedMedia(url);
                setMediaType('video');
                setFilteredFromFlow(!!locationState.filtered || !!locationState.filterInfo);
                // Focus caption for quick posting
                setTimeout(() => captionRef.current?.focus(), 0);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationState?.videoUrl]);

    // Debug: Log user data on component mount
    React.useEffect(() => {
        console.log('CreatePage mounted with user:', user);
    }, [user]);

    const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setSelectedMedia(e.target?.result as string);
                // Determine if it's an image or video
                if (file.type.startsWith('image/')) {
                    setMediaType('image');
                } else if (file.type.startsWith('video/')) {
                    setMediaType('video');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() && !selectedMedia) return;
        if (!user) return;

        setIsUploading(true);
        try {
            console.log('Creating post with user:', {
                id: user.id,
                handle: user.handle,
                regional: user.regional
            });

            console.log('Posting video:', {
                selectedMedia: selectedMedia ? selectedMedia.substring(0, 50) + '...' : null,
                mediaType,
                filteredFromFlow,
                isBlobUrl: selectedMedia?.startsWith('blob:'),
                isDataUrl: selectedMedia?.startsWith('data:')
            });

            const newPost = await createPost(
                user.id,
                user.handle,
                text.trim(),
                location.trim(),
                selectedMedia || undefined,
                mediaType || undefined,
                imageText.trim() || undefined,
                selectedMedia ? text.trim() : undefined, // Use text as caption if media is selected
                user.local,
                user.regional,
                user.national,
                stickers.length > 0 ? stickers : undefined, // Pass stickers
                undefined, // templateId
                undefined, // mediaItems
                bannerText.trim() || undefined // Pass banner text
            );

            // Dispatch event to refresh feed
            console.log('Post created successfully, dispatching postCreated event');
            window.dispatchEvent(new CustomEvent('postCreated'));

            // If user wants to boost, navigate to boost selection
            if (wantsToBoost) {
                setCreatedPost(newPost);
                // Navigate to boost page with the new post
                navigate('/boost', {
                    state: {
                        newPost: newPost,
                        showBoostModal: true
                    }
                });
            } else {
                // Reset form
                setText('');
                setLocation('');
                setSelectedMedia(null);
                setMediaType(null);
                setImageText('');

                // Navigate back to feed
                navigate('/feed');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const removeMedia = () => {
        setSelectedMedia(null);
        setMediaType(null);
        setImageText('');
        setStickers([]);
        setSelectedStickerOverlay(null);
    };

    function handleSelectSticker(sticker: Sticker) {
        const newOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random()}`,
            stickerId: sticker.id,
            sticker,
            x: 50,
            y: 50,
            scale: 1,
            rotation: 0,
            opacity: 1
        };

        setStickers(prev => [...prev, newOverlay]);
        setSelectedStickerOverlay(newOverlay.id);
    }

    function handleAddTextSticker(text: string, fontSize: 'small' | 'medium' | 'large', color: string) {
        const textSticker: Sticker = {
            id: `text-sticker-${Date.now()}`,
            name: text,
            category: 'Text',
            emoji: undefined,
            url: undefined,
            isTrending: false
        };

        const newOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random()}`,
            stickerId: textSticker.id,
            sticker: textSticker,
            x: 50,
            y: 50,
            scale: fontSize === 'small' ? 0.8 : fontSize === 'medium' ? 1 : 1.2,
            rotation: 0,
            opacity: 1
        };

        (newOverlay as any).textContent = text;
        (newOverlay as any).textColor = color;
        (newOverlay as any).fontSize = fontSize;

        setStickers(prev => [...prev, newOverlay]);
        setSelectedStickerOverlay(newOverlay.id);
    }

    function handleUpdateSticker(overlayId: string, updated: StickerOverlay) {
        setStickers(prev => prev.map(s => s.id === overlayId ? updated : s));
    }

    function handleRemoveSticker(overlayId: string) {
        setStickers(prev => prev.filter(s => s.id !== overlayId));
        if (selectedStickerOverlay === overlayId) {
            setSelectedStickerOverlay(null);
        }
    }


    return (
        <div className="min-h-screen bg-white dark:bg-gray-950">
            {/* Header - More compact like Instagram/TikTok */}
            <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
                <div className="mx-auto max-w-md px-3 h-12 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                    <h1 className="font-semibold text-base text-gray-900 dark:text-gray-100">New Post</h1>
                    <button
                        onClick={handleSubmit}
                        disabled={(!text.trim() && !selectedMedia) || isUploading}
                        className="px-3 py-1.5 text-brand-500 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
                    >
                        {isUploading ? 'Posting...' : 'Share'}
                    </button>
                </div>
            </div>

            {/* Content - More compact spacing */}
            <div className="mx-auto max-w-md">
                {/* User Info - Compact */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <Avatar
                        src={user?.avatarUrl}
                        name={user?.name || 'User'}
                        size="sm"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                            {user?.name || 'User'}
                        </div>
                    </div>
                </div>

                {/* Text Input - More compact, Instagram style */}
                <div className="px-4 py-3">
                    <textarea
                        ref={captionRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={selectedMedia ? "Write a caption..." : "What's on your mind?"}
                        className="w-full min-h-[100px] text-gray-900 dark:text-gray-100 bg-transparent border-none resize-none placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-[15px] leading-relaxed"
                        maxLength={500}
                    />
                    <div className="flex justify-end mt-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">{text.length}/500</span>
                    </div>
                </div>

                {/* Media Upload Placeholder - Only show when no media is selected */}
                {!selectedMedia && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                        <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                            <input
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleMediaSelect}
                                className="hidden"
                            />
                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                                <FiImage className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Add Photo or Video</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tap to select from your device</div>
                            </div>
                        </label>

                        {/* Use Template Button - More compact */}
                        <button
                            onClick={() => navigate('/templates')}
                            className="w-full mt-2 flex items-center gap-2.5 p-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all text-sm"
                        >
                            <FiLayers className="w-4 h-4" />
                            <span>Use Template</span>
                        </button>
                    </div>
                )}

                {/* Media Preview - More compact */}
                {selectedMedia && (
                    <div className="border-t border-gray-100 dark:border-gray-800">
                        {/* Edit Button - Compact, top right */}
                        <div className="px-4 py-2 flex justify-end">
                            <button
                                onClick={() => {
                                    navigate('/video-editor', {
                                        state: {
                                            mediaUrl: selectedMedia,
                                            mediaType: mediaType || undefined
                                        }
                                    });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                <FiEdit className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                        </div>
                        <div
                            ref={mediaContainerRef}
                            className="relative bg-black"
                            onClick={(e) => {
                                // Deselect sticker when clicking on media
                                if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).tagName === 'IMG') {
                                    setSelectedStickerOverlay(null);
                                }
                            }}
                        >
                            {filteredFromFlow && (
                                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-600 text-white">Filtered</span>
                            )}
                            {mediaType === 'image' ? (
                                <div className="relative w-full aspect-square overflow-hidden">
                                    <img
                                        src={selectedMedia}
                                        alt="Selected"
                                        className="w-full h-full object-contain"
                                    />
                                    {/* Sticker Overlays */}
                                    {stickers.map((overlay) => (
                                        <StickerOverlayComponent
                                            key={overlay.id}
                                            overlay={overlay}
                                            onUpdate={(updated) => handleUpdateSticker(overlay.id, updated)}
                                            onRemove={() => handleRemoveSticker(overlay.id)}
                                            isSelected={selectedStickerOverlay === overlay.id}
                                            onSelect={() => setSelectedStickerOverlay(overlay.id)}
                                            containerWidth={containerSize.width || 400}
                                            containerHeight={containerSize.height || 256}
                                        />
                                    ))}
                                    {/* Text Overlay Preview */}
                                    {imageText && (
                                        <div className="absolute bottom-4 left-4 right-4 z-10">
                                            <div className="bg-black/70 text-white px-3 py-2 rounded-lg text-sm font-medium backdrop-blur-sm">
                                                {imageText}
                                            </div>
                                        </div>
                                    )}
                                    {/* Sticker Button - More subtle */}
                                    <button
                                        onClick={() => setShowStickerPicker(true)}
                                        className="absolute bottom-3 right-3 p-2.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-gray-700 dark:text-gray-300 rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-lg z-10"
                                        title="Add Sticker"
                                    >
                                        <FiSmile className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : mediaType === 'video' ? (
                                <div className="relative w-full aspect-square overflow-hidden bg-black">
                                    <video
                                        ref={videoRef}
                                        src={selectedMedia}
                                        controls
                                        className="w-full h-full object-contain"
                                        preload="metadata"
                                        style={locationState?.filterInfo?.exportFailed ? (() => {
                                            const filterInfo = locationState.filterInfo;
                                            if (!filterInfo) return {};

                                            // Apply CSS filters as fallback when export failed
                                            let filter = '';
                                            if (filterInfo.active === 'bw') {
                                                filter = 'grayscale(1)';
                                            } else if (filterInfo.active === 'sepia') {
                                                filter = 'sepia(0.8)';
                                            } else if (filterInfo.active === 'vivid') {
                                                filter = `saturate(${1.6 * filterInfo.saturation}) contrast(${1.1 * filterInfo.contrast})`;
                                            } else if (filterInfo.active === 'cool') {
                                                filter = `hue-rotate(200deg) saturate(${1.2 * filterInfo.saturation})`;
                                            }

                                            // Apply adjustments
                                            if (filterInfo.brightness !== 1) {
                                                filter += ` brightness(${filterInfo.brightness})`;
                                            }
                                            if (filterInfo.contrast !== 1) {
                                                filter += ` contrast(${filterInfo.contrast})`;
                                            }
                                            if (filterInfo.saturation !== 1) {
                                                filter += ` saturate(${filterInfo.saturation})`;
                                            }

                                            return filter ? { filter } : {};
                                        })() : undefined}
                                    />
                                    {/* Sticker Overlays */}
                                    {stickers.map((overlay) => (
                                        <StickerOverlayComponent
                                            key={overlay.id}
                                            overlay={overlay}
                                            onUpdate={(updated) => handleUpdateSticker(overlay.id, updated)}
                                            onRemove={() => handleRemoveSticker(overlay.id)}
                                            isSelected={selectedStickerOverlay === overlay.id}
                                            onSelect={() => setSelectedStickerOverlay(overlay.id)}
                                            containerWidth={containerSize.width || 400}
                                            containerHeight={containerSize.height || 256}
                                        />
                                    ))}
                                    {/* Sticker Button - More subtle */}
                                    <button
                                        onClick={() => setShowStickerPicker(true)}
                                        className="absolute bottom-3 right-3 p-2.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-gray-700 dark:text-gray-300 rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-lg z-10"
                                        title="Add Sticker"
                                    >
                                        <FiSmile className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : null}
                            <button
                                onClick={removeMedia}
                                className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-black/80 transition-colors z-10"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Image Text Overlay Input - Compact */}
                {selectedMedia && mediaType === 'image' && (
                    <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
                        <input
                            type="text"
                            value={imageText}
                            onChange={(e) => setImageText(e.target.value)}
                            placeholder="Add text to image..."
                            className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-brand-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                            maxLength={100}
                        />
                        <div className="text-right text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {imageText.length}/100
                        </div>
                    </div>
                )}

                {/* Location Input - Compact */}
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-1.5">
                        <FiMapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Location
                        </label>
                    </div>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Add location"
                        className="w-full px-0 py-1 text-[15px] text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>

                {/* Boost Option - Compact */}
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={wantsToBoost}
                            onChange={(e) => setWantsToBoost(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 focus:ring-1"
                        />
                        <div className="flex items-center gap-2 flex-1">
                            <FiZap className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                            <div>
                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                    Boost this post
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Reach more people
                                </div>
                            </div>
                        </div>
                    </label>
                </div>

                {/* Add Banner Section */}
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
                            Add Banner
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Add a scrolling news ticker banner to your post
                        </p>
                        <input
                            type="text"
                            value={bannerText}
                            onChange={(e) => setBannerText(e.target.value)}
                            placeholder="Enter banner text (e.g., Breaking news headline...)"
                            maxLength={200}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {bannerText.length}/200 characters
                            </span>
                            {bannerText && (
                                <button
                                    type="button"
                                    onClick={() => setBannerText('')}
                                    className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticker Picker Modal - Outside content div */}
            {selectedMedia && (
                <div>
                    <StickerPicker
                        isOpen={showStickerPicker}
                        onClose={() => setShowStickerPicker(false)}
                        onSelectSticker={handleSelectSticker}
                        onAddText={() => setShowTextStickerModal(true)}
                    />
                    <TextStickerModal
                        isOpen={showTextStickerModal}
                        onClose={() => setShowTextStickerModal(false)}
                        onConfirm={(text, fontSize, color) => {
                            handleAddTextSticker(text, fontSize, color);
                            setShowTextStickerModal(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
