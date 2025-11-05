import React from 'react';
import { useAuth } from '../context/Auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPost } from '../api/posts';
import { FiCamera, FiImage, FiMapPin, FiX } from 'react-icons/fi';
import Avatar from '../components/Avatar';

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
    const [isUploading, setIsUploading] = React.useState(false);
    const [filteredFromFlow, setFilteredFromFlow] = React.useState(false);
    const captionRef = React.useRef<HTMLTextAreaElement | null>(null);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

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

            await createPost(
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
                user.national
            );

            // Reset form
            setText('');
            setLocation('');
            setSelectedMedia(null);
            setMediaType(null);
            setImageText('');

            // Navigate back to feed
            navigate('/feed');

            // Dispatch event to refresh feed
            console.log('Post created successfully, dispatching postCreated event');
            console.log('Event target:', window);
            window.dispatchEvent(new CustomEvent('postCreated'));
            console.log('postCreated event dispatched');
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
    };


    return (
        <div className="min-h-screen bg-white dark:bg-gray-950">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
                <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
                    <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">Create Post</h1>
                    <button
                        onClick={handleSubmit}
                        disabled={(!text.trim() && !selectedMedia) || isUploading}
                        className="px-4 py-1 bg-brand-500 text-white rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-600 transition-colors"
                    >
                        {isUploading ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-md px-4 py-6">
                {/* User Info */}
                <div className="flex items-center gap-3 mb-6">
                    <Avatar
                        src={user?.avatarUrl}
                        name={user?.name || 'User'}
                        size="md"
                    />
                    <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                            {user?.name || 'User'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user?.handle || 'user@location'}
                        </div>
                    </div>
                </div>

                {/* Text Input */}
                <div className="mb-6">
                    <div className={`rounded-xl border-2 border-dashed p-4 ${selectedMedia
                        ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}>
                        <textarea
                            ref={captionRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={selectedMedia ? "Write a caption for your post..." : "Tap to type"}
                            className="w-full h-32 p-4 text-gray-900 dark:text-gray-100 bg-transparent border-none resize-none placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
                            maxLength={500}
                        />
                        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                            <span>{selectedMedia ? "📝 Caption" : "💬 Post without images! Try it"}</span>
                            <span>{text.length}/500</span>
                        </div>
                    </div>
                </div>

                {/* Media Upload Placeholder - Only show when no media is selected */}
                {!selectedMedia && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <FiImage className="w-4 h-4 text-gray-500" />
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Add Photo or Video
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <label className="flex-1 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleMediaSelect}
                                    className="hidden"
                                />
                                <div className="text-center">
                                    <FiCamera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        Tap to add photo or video
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        Images & short videos
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                {/* Media Preview */}
                {selectedMedia && (
                    <div className="relative mb-6">
                        {filteredFromFlow && (
                            <span className="absolute top-2 left-2 z-10 px-2 py-1 rounded-full text-[11px] font-semibold bg-purple-600 text-white shadow">Filtered</span>
                        )}
                        {mediaType === 'image' ? (
                            <div className="relative">
                                <img
                                    src={selectedMedia}
                                    alt="Selected"
                                    className="w-full h-64 object-cover rounded-2xl"
                                />
                                {/* Text Overlay Preview */}
                                {imageText && (
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <div className="bg-black/70 text-white px-3 py-2 rounded-lg text-sm font-medium backdrop-blur-sm">
                                            {imageText}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : mediaType === 'video' ? (
                            <video
                                ref={videoRef}
                                src={selectedMedia}
                                controls
                                className="w-full h-64 object-cover rounded-2xl"
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
                        ) : null}
                        <button
                            onClick={removeMedia}
                            className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                        >
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Image Text Overlay Input */}
                {selectedMedia && mediaType === 'image' && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <FiCamera className="w-4 h-4 text-gray-500" />
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Add Text to Image
                            </label>
                        </div>
                        <input
                            type="text"
                            value={imageText}
                            onChange={(e) => setImageText(e.target.value)}
                            placeholder=""
                            className="w-full p-3 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            maxLength={100}
                        />
                        <div className="text-right text-xs text-gray-400 mt-1">
                            {imageText.length}/100
                        </div>
                    </div>
                )}


                {/* Location Input */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <FiMapPin className="w-4 h-4 text-gray-500" />
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Story Location
                        </label>
                    </div>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Where did this happen?"
                        className="w-full p-3 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
                    />
                </div>


                {/* Tips */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Tips for great posts:
                    </h3>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Share what's happening in your local area</li>
                        <li>• Add a clear photo or short video to tell your story</li>
                        <li>• Include the specific location</li>
                        <li>• Keep it authentic and engaging</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
