import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPost } from '../api/posts';
import { FiImage, FiMapPin, FiX, FiZap, FiLayers, FiSmile, FiEdit, FiLoader, FiHome, FiSliders, FiType, FiCircle, FiUser, FiMusic } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import type { Post, StickerOverlay, Sticker } from '../types';
import StickerPicker from '../components/StickerPicker';
import StickerOverlayComponent from '../components/StickerOverlay';
import TextStickerModal from '../components/TextStickerModal';
import UserTaggingModal from '../components/UserTaggingModal';
import MusicPicker from '../components/MusicPicker';
import type { MusicTrack } from '../api/music';
import { showToast } from '../utils/toast';

// Debounce hook for performance
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

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
        editedMedia?: any; // EditedMedia from video editor
        mediaItems?: Array<{ url: string; type: 'image' | 'video'; duration?: number }>; // Media items from video editor
        templateMediaItems?: Array<{ url: string; type: 'image' | 'video'; duration?: number }>; // Media items from template editor
        templateStickers?: StickerOverlay[]; // Stickers from template editor
        templateId?: string; // Template ID
        templateText?: string; // Text from template editor
        templateLocation?: string; // Location from template editor
        templateBannerText?: string; // Banner text from template editor
        templateTaggedUsers?: string[]; // Tagged users from template editor
        trimStart?: number; // Trim start time in seconds (from InstantCreatePage)
        trimEnd?: number; // Trim end time in seconds (from InstantCreatePage)
        videoDuration?: number; // Original video duration
        clips?: Array<{ // Multi-clip support
            id: string;
            url: string;
            duration: number;
            trimStart: number;
            trimEnd: number;
            speed: number;
            reverse: boolean;
        }>;
        transitions?: Array<{ // Transitions between clips
            type: 'none' | 'fade' | 'swipe' | 'zoom';
            duration: number;
        }>;
        voiceoverUrl?: string; // Voiceover audio URL
        greenScreenEnabled?: boolean; // Green screen enabled
        greenScreenBackgroundUrl?: string; // Background URL for green screen
        musicTrackId?: number; // Music track ID from library (from InstantCreatePage)
    } | null;
    const MAX_VIDEO_SECONDS = 90;
    const [text, setText] = useState(''); // Main text - used for text-only posts OR captions for image posts
    const [location, setLocation] = useState('');
    const [venue, setVenue] = useState('');
    const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [imageText, setImageText] = useState(''); // Text overlay for images
    const [bannerText, setBannerText] = useState(''); // News ticker banner text
    const [isUploading, setIsUploading] = useState(false);
    const [filteredFromFlow, setFilteredFromFlow] = useState(false);
    const [wantsToBoost, setWantsToBoost] = useState(false);
    const [createdPost, setCreatedPost] = useState<Post | null>(null);
    const [stickers, setStickers] = useState<StickerOverlay[]>([]);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showTextStickerModal, setShowTextStickerModal] = useState(false);
    const [selectedStickerOverlay, setSelectedStickerOverlay] = useState<string | null>(null);
    const [isProcessingMedia, setIsProcessingMedia] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showAdjustments, setShowAdjustments] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('none');
    const [filterBrightness, setFilterBrightness] = useState(1.0);
    const [filterContrast, setFilterContrast] = useState(1.0);
    const [filterSaturation, setFilterSaturation] = useState(1.0);
    const [filterHue, setFilterHue] = useState(0);
    const [showUserTagging, setShowUserTagging] = useState(false);
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const [showMusicPicker, setShowMusicPicker] = useState(false);
    const [selectedMusicTrack, setSelectedMusicTrack] = useState<MusicTrack | null>(null);
    const mediaContainerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const captionRef = useRef<HTMLTextAreaElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Debounce text inputs for better performance
    const debouncedText = useDebounce(text, 300);

    // Cleanup object URLs when component unmounts or media changes
    useEffect(() => {
        return () => {
            // Cleanup object URL if it's a blob URL to prevent memory leaks
            if (selectedMedia && selectedMedia.startsWith('blob:')) {
                URL.revokeObjectURL(selectedMedia);
            }
        };
    }, [selectedMedia]);

    // Force video to load in Edge when media changes
    useEffect(() => {
        if (mediaType === 'video' && videoRef.current && selectedMedia) {
            const video = videoRef.current;
            // Edge sometimes needs explicit load() call
            if (video.readyState === 0) {
                video.load();
            }
            // Also try to ensure video is visible
            video.style.display = 'block';
            video.style.visibility = 'visible';
            video.style.opacity = '1';
        }
    }, [selectedMedia, mediaType]);

    // Optimize container size calculation with useMemo
    useEffect(() => {
        if (mediaContainerRef.current && selectedMedia) {
            const updateSize = () => {
                const rect = mediaContainerRef.current?.getBoundingClientRect();
                if (rect) {
                    setContainerSize({ width: rect.width, height: rect.height });
                }
            };
            updateSize();
            const resizeObserver = new ResizeObserver(updateSize);
            resizeObserver.observe(mediaContainerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, [selectedMedia]);

    // Memoize CSS filter calculation
    const cssFilter = useMemo(() => {
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
    }, [locationState?.filterInfo]);

    // Fallback: if export failed earlier, re-export with Canvas 2D here
    const ensureFilteredVideoIfNeeded = useCallback(async (originalUrl: string): Promise<string> => {
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
            const filterStr = cssFilter;
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
    }, [cssFilter]);

    // Prefill from Instant Filters flow, Video Editor, or Template Editor
    useEffect(() => {
        (async () => {
            // Handle template media items from template editor
            if (locationState?.templateMediaItems && locationState.templateMediaItems.length > 0) {
                setIsProcessingMedia(true);
                try {
                    // Use the first media item for preview
                    const firstItem = locationState.templateMediaItems[0];
                    setSelectedMedia(firstItem.url);
                    setMediaType(firstItem.type);
                    setFilteredFromFlow(false);

                    // Set text and location if provided from template
                    if (locationState.templateText) {
                        setText(locationState.templateText);
                    }
                    if (locationState.templateLocation) {
                        setLocation(locationState.templateLocation);
                    }
                    const templateVenue = (locationState as { templateVenue?: string }).templateVenue;
                    if (templateVenue) setVenue(templateVenue);

                    // Set stickers if provided from template
                    if (locationState.templateStickers && locationState.templateStickers.length > 0) {
                        setStickers(locationState.templateStickers);
                    }

                    // Set taggedUsers if provided from template
                    if (locationState.templateTaggedUsers && locationState.templateTaggedUsers.length > 0) {
                        setTaggedUsers(locationState.templateTaggedUsers);
                    }

                    // Set bannerText if provided from template
                    if (locationState.templateBannerText) {
                        setBannerText(locationState.templateBannerText);
                    }

                    // Focus caption for quick posting
                    setTimeout(() => captionRef.current?.focus(), 0);
                } catch (error) {
                    console.error('Error processing template media:', error);
                    showToast('Failed to load template media. Please try again.');
                } finally {
                    setIsProcessingMedia(false);
                }
            }
            // Handle edited media from video editor
            else if (locationState?.editedMedia && locationState?.mediaItems && locationState.mediaItems.length > 0) {
                setIsProcessingMedia(true);
                try {
                    // Use the first media item from edited media
                    const firstItem = locationState.mediaItems[0];
                    setSelectedMedia(firstItem.url);
                    setMediaType(firstItem.type);
                    setFilteredFromFlow(false);
                    // Focus caption for quick posting
                    setTimeout(() => captionRef.current?.focus(), 0);
                } catch (error) {
                    console.error('Error processing edited media:', error);
                    showToast('Failed to load edited media. Please try again.');
                } finally {
                    setIsProcessingMedia(false);
                }
            }
            // Handle video from Instant Filters flow
            else if (locationState?.videoUrl) {
                setIsProcessingMedia(true);
                try {
                    let url = locationState.videoUrl;
                    // If export failed upstream, try to produce a filtered video here
                    url = await ensureFilteredVideoIfNeeded(url);
                    setSelectedMedia(url);
                    setMediaType('video');
                    setFilteredFromFlow(!!locationState.filtered || !!locationState.filterInfo);
                    // Focus caption for quick posting
                    setTimeout(() => captionRef.current?.focus(), 0);
                } catch (error) {
                    console.error('Error processing video:', error);
                    showToast('Failed to load video. Please try again.');
                } finally {
                    setIsProcessingMedia(false);
                }
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationState?.videoUrl, locationState?.editedMedia, locationState?.mediaItems]);

    // Helper function to transcode video for Edge compatibility
    const transcodeVideoForEdge = useCallback(async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const url = URL.createObjectURL(file);
            video.src = url;
            video.muted = true;
            video.playsInline = true;

            video.onloadedmetadata = async () => {
                try {
                    const width = video.videoWidth || 720;
                    const height = video.videoHeight || 1280;
                    const scale = Math.max(width, height) > 1080 ? 1080 / Math.max(width, height) : 1;
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(width * scale);
                    canvas.height = Math.round(height * scale);
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        URL.revokeObjectURL(url);
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    const stream = canvas.captureStream(30);
                    // Use H.264 for better Edge compatibility
                    let mimeType = 'video/webm;codecs=vp8';
                    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                        mimeType = 'video/webm;codecs=vp9';
                    }
                    const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
                    const chunks: BlobPart[] = [];
                    mr.ondataavailable = (e) => {
                        if (e.data && e.data.size > 0) chunks.push(e.data);
                    };
                    const done = new Promise<void>((resolve) => {
                        mr.onstop = () => resolve();
                    });

                    let lastTime = -1;
                    const draw = () => {
                        if (video.ended) {
                            if (mr.state !== 'inactive') mr.stop();
                            return;
                        }
                        if (video.currentTime !== lastTime) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            lastTime = video.currentTime;
                        }
                        requestAnimationFrame(draw);
                    };

                    video.currentTime = 0;
                    mr.start(100);
                    await video.play();
                    requestAnimationFrame(draw);

                    const duration = video.duration || 10;
                    const safety = setTimeout(() => {
                        if (mr.state === 'recording') mr.stop();
                    }, Math.min(30000, duration * 2000));

                    await done;
                    clearTimeout(safety);
                    URL.revokeObjectURL(url);

                    if (chunks.length === 0) {
                        reject(new Error('No video data recorded'));
                        return;
                    }

                    const blob = new Blob(chunks, { type: mimeType });
                    const transcodedUrl = URL.createObjectURL(blob);
                    resolve(transcodedUrl);
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };

            video.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load video'));
            };

            // Timeout after 5 seconds
            setTimeout(() => {
                if (video.readyState === 0) {
                    URL.revokeObjectURL(url);
                    reject(new Error('Video loading timeout'));
                }
            }, 5000);
        });
    }, []);

    const handleMediaSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validate file size (max 50MB)
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (file.size > maxSize) {
                showToast('File size too large. Please select a file under 50MB.');
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                return;
            }

            setIsProcessingMedia(true);

            // Determine if it's an image or video
            const isVideo = file.type.startsWith('video/');
            const isImage = file.type.startsWith('image/');

            // Use URL.createObjectURL for videos (better Edge support) and FileReader for images
            if (isVideo) {
                try {
                    // First, try direct blob URL
                    const url = URL.createObjectURL(file);

                    // Check if we're in Edge browser
                    const isEdge = /Edg/.test(navigator.userAgent);

                    // For Edge, check if video can actually render (not just load metadata)
                    if (isEdge) {
                        const testVideo = document.createElement('video');
                        testVideo.src = url;
                        testVideo.muted = true;
                        testVideo.playsInline = true;

                        const canRender = await new Promise<boolean>((resolve) => {
                            const timeout = setTimeout(() => {
                                testVideo.removeEventListener('loadeddata', onLoadedData);
                                testVideo.removeEventListener('error', onError);
                                URL.revokeObjectURL(url);
                                resolve(false);
                            }, 4000);

                            const onLoadedData = () => {
                                // Check if video actually has video dimensions (means it rendered)
                                const hasVideo = testVideo.videoWidth > 0 && testVideo.videoHeight > 0;
                                clearTimeout(timeout);
                                testVideo.removeEventListener('error', onError);
                                URL.revokeObjectURL(url);
                                resolve(hasVideo);
                            };

                            const onError = () => {
                                clearTimeout(timeout);
                                testVideo.removeEventListener('loadeddata', onLoadedData);
                                URL.revokeObjectURL(url);
                                resolve(false);
                            };

                            testVideo.addEventListener('loadeddata', onLoadedData);
                            testVideo.addEventListener('error', onError);
                        });

                        if (!canRender) {
                            // Edge can't render this video, transcode it
                            console.log('Edge cannot render video, transcoding for compatibility...');
                            showToast('Converting video for Edge compatibility...');
                            URL.revokeObjectURL(url);
                            const transcodedUrl = await transcodeVideoForEdge(file);
                            setSelectedMedia(transcodedUrl);
                            setMediaType('video');
                            setIsProcessingMedia(false);
                            showToast('Video converted successfully');
                            return;
                        }
                    }

                    // Edge can render it, or we're not in Edge - use it directly
                    setSelectedMedia(url);
                    setMediaType('video');
                    setIsProcessingMedia(false);
                } catch (error) {
                    console.error('Error processing video:', error);
                    showToast('Failed to process video. Please try a different format.');
                    setIsProcessingMedia(false);
                }
            } else if (isImage) {
                // Use FileReader for images
                const reader = new FileReader();
                reader.onload = (e) => {
                    setSelectedMedia(e.target?.result as string);
                    setMediaType('image');
                    setIsProcessingMedia(false);
                };
                reader.onerror = () => {
                    showToast('Failed to load file. Please try again.');
                    setIsProcessingMedia(false);
                };
                reader.readAsDataURL(file);
            } else {
                showToast('Unsupported file type. Please select an image or video.');
                setIsProcessingMedia(false);
            }
        }
    }, [transcodeVideoForEdge]);

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!text.trim() && !selectedMedia) {
            showToast('Please add text or media to your post.');
            return;
        }
        if (!user) {
            showToast('Please log in to create a post.');
            return;
        }

        setIsUploading(true);
        try {
            // Build editTimeline for hybrid editing pipeline (if we have trim data or video)
            let editTimeline: any = undefined;
            if (mediaType === 'video' && selectedMedia) {
                // Check if we have multiple clips
                const clips = locationState?.clips;
                
                if (clips && clips.length > 0) {
                    // Multi-clip timeline
                    const timelineClips = [];
                    let currentStartTime = 0;
                    let totalDuration = 0;
                    
                    for (const clip of clips) {
                        const clipDuration = Math.min((clip.trimEnd - clip.trimStart) / clip.speed, 90 - totalDuration);
                        if (clipDuration <= 0) break; // Stop if we've hit the 90s limit
                        
                        timelineClips.push({
                            id: clip.id,
                            mediaUrl: clip.url,
                            type: 'video',
                            startTime: currentStartTime,
                            duration: clipDuration,
                            trimStart: clip.trimStart,
                            trimEnd: clip.trimEnd,
                            speed: clip.speed,
                            reverse: clip.reverse,
                            originalDuration: clip.duration
                        });
                        
                        currentStartTime += clipDuration;
                        totalDuration += clipDuration;
                        
                        if (totalDuration >= 90) break; // Enforce 90s max
                    }
                    
                    // Include transitions from locationState
                    const transitions = locationState?.transitions || [];
                    
                    // Include stickers as overlays with timing
                    const overlays = (stickers || []).map(sticker => ({
                        id: sticker.id,
                        type: 'sticker' as const,
                        stickerId: sticker.stickerId,
                        sticker: sticker.sticker,
                        x: sticker.x,
                        y: sticker.y,
                        scale: sticker.scale,
                        rotation: sticker.rotation,
                        opacity: sticker.opacity,
                        startTime: sticker.startTime ?? 0, // Start time in seconds
                        endTime: sticker.endTime ?? totalDuration, // End time in seconds
                        // Text content if it's a text sticker
                        textContent: (sticker as any).textContent,
                        textColor: (sticker as any).textColor,
                        fontSize: (sticker as any).fontSize
                    }));

                    editTimeline = {
                        clips: timelineClips,
                        transitions: transitions.map((t, index) => ({
                            id: `transition-${index}`,
                            type: t.type,
                            duration: t.duration,
                            fromClipIndex: index,
                            toClipIndex: index + 1
                        })),
                        overlays: overlays,
                        totalDuration: totalDuration
                    };
                } else if (locationState?.trimStart !== undefined || locationState?.trimEnd !== undefined) {
                    // Single clip with trim
                    const trimStart = locationState?.trimStart ?? 0;
                    const trimEnd = locationState?.trimEnd ?? (locationState?.videoDuration ?? 0);
                    const originalDuration = locationState?.videoDuration ?? 0;
                    const clipDuration = Math.min(trimEnd - trimStart, 90); // Enforce 90s max
                    
                    // Get speed and reverse values from locationState
                    const speed = (locationState as { speed?: number })?.speed ?? 1.0;
                    const reverse = (locationState as { reverse?: boolean })?.reverse ?? false;
                    
                    // Include stickers as overlays with timing
                    const overlays = (stickers || []).map(sticker => ({
                        id: sticker.id,
                        type: 'sticker' as const,
                        stickerId: sticker.stickerId,
                        sticker: sticker.sticker,
                        x: sticker.x,
                        y: sticker.y,
                        scale: sticker.scale,
                        rotation: sticker.rotation,
                        opacity: sticker.opacity,
                        startTime: sticker.startTime ? sticker.startTime / 1000 : 0, // Convert ms to seconds
                        endTime: sticker.endTime ? sticker.endTime / 1000 : clipDuration, // Convert ms to seconds
                        // Text content if it's a text sticker
                        textContent: (sticker as any).textContent,
                        textColor: (sticker as any).textColor,
                        fontSize: (sticker as any).fontSize
                    }));

                    editTimeline = {
                        clips: [{
                            id: `clip-${Date.now()}`,
                            mediaUrl: selectedMedia,
                            type: 'video',
                            startTime: 0, // Position in timeline (always 0 for single clip)
                            duration: clipDuration,
                            trimStart: trimStart,
                            trimEnd: trimEnd,
                            speed: speed,
                            reverse: reverse,
                            originalDuration: originalDuration
                        }],
                        transitions: [],
                        overlays: overlays,
                        voiceoverUrl: locationState?.voiceoverUrl, // Voiceover audio
                        greenScreen: locationState?.greenScreenEnabled ? {
                            enabled: true,
                            backgroundUrl: locationState?.greenScreenBackgroundUrl
                        } : undefined,
                        totalDuration: clipDuration
                    };
                }
            }

            // For media with blob URLs, we need a persistent URL before sending to Laravel:
            // - Videos: upload the blob to the backend (/upload/single) and use the returned fileUrl.
            // - Images: convert blob URL to a data URL BEFORE calling createPost.
            let persistentMediaUrl = selectedMedia;
            const isVideo = mediaType === 'video' || !mediaType;
            if (selectedMedia) {
                // Case 1: blob: URL – upload to backend for videos
                if (selectedMedia.startsWith('blob:') && isVideo) {
                    console.log('📤 Attempting to upload video blob to backend...', selectedMedia.substring(0, 50));
                    try {
                        const response = await fetch(selectedMedia);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
                        }
                        const blob = await response.blob();
                        const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
                        const { uploadFile } = await import('../api/client');
                        const uploadResult = await uploadFile(file);
                        
                        if (uploadResult.success && uploadResult.fileUrl) {
                            persistentMediaUrl = uploadResult.fileUrl;
                            console.log('✅ Video uploaded to backend:', persistentMediaUrl);
                        } else {
                            throw new Error('Upload failed: ' + (uploadResult.error || 'Unknown error'));
                        }
                    } catch (error: any) {
                        const isConnectionError = 
                            error?.name === 'ConnectionRefused' ||
                            error?.message?.includes('CONNECTION_REFUSED') ||
                            error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('NetworkError') ||
                            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
                        
                        if (isConnectionError) {
                            console.log('⚠️ Backend not accessible, using blob URL (mock fallback will handle it)');
                            persistentMediaUrl = selectedMedia;
                        } else {
                            console.error('❌ Failed to upload video to backend:', error);
                            showToast('Failed to upload video. Please try again.');
                            setIsUploading(false);
                            return;
                        }
                    }
                }
                // Case 2: video URL still pointing at dev server (e.g. http://192.168.1.7:5173/...)
                else if (isVideo && selectedMedia.startsWith(window.location.origin)) {
                    console.log('📤 Uploading dev-server video URL to backend...', selectedMedia);
                    try {
                        const response = await fetch(selectedMedia);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch video from dev server: ${response.status} ${response.statusText}`);
                        }
                        const blob = await response.blob();
                        const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
                        const { uploadFile } = await import('../api/client');
                        const uploadResult = await uploadFile(file);
                        
                        if (uploadResult.success && uploadResult.fileUrl) {
                            persistentMediaUrl = uploadResult.fileUrl;
                            console.log('✅ Dev-server video uploaded to backend:', persistentMediaUrl);
                        } else {
                            throw new Error('Upload failed: ' + (uploadResult.error || 'Unknown error'));
                        }
                    } catch (error: any) {
                        console.error('❌ Failed to upload dev-server video URL to backend:', error);
                        showToast('Failed to upload video. Please try again.');
                        setIsUploading(false);
                        return;
                    }
                }
                // Case 3: image blob – convert to data URL
                else if (selectedMedia.startsWith('blob:') && !isVideo) {
                    console.log('Converting image blob URL to data URL before upload...');
                    try {
                        const response = await fetch(selectedMedia);
                        const blob = await response.blob();
                        const reader = new FileReader();
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        persistentMediaUrl = dataUrl;
                        console.log('✅ Converted image blob URL to data URL', {
                            originalSize: blob.size,
                            dataUrlSize: dataUrl.length,
                            isDataUrl: dataUrl.startsWith('data:')
                        });
                    } catch (error) {
                        console.error('❌ Failed to convert blob URL to data URL:', error);
                    }
                }
            }

            const newPost = await createPost(
                user.id,
                user.handle,
                text.trim(),
                location.trim(),
                persistentMediaUrl || undefined,
                mediaType || undefined,
                imageText.trim() || undefined,
                persistentMediaUrl ? text.trim() : undefined, // Use text as caption if media is selected
                user.local,
                user.regional,
                user.national,
                stickers.length > 0 ? stickers : undefined, // Pass stickers
                locationState?.templateId || undefined, // templateId
                locationState?.templateMediaItems || locationState?.mediaItems || undefined, // Pass mediaItems from template or video editor if available
                bannerText.trim() || undefined, // Pass banner text
                undefined, // textStyle
                taggedUsers.length > 0 ? taggedUsers : undefined, // taggedUsers
                undefined, // videoCaptionsEnabled
                undefined, // videoCaptionText
                undefined, // subtitlesEnabled
                undefined, // subtitleText
                editTimeline, // Pass editTimeline for hybrid pipeline
                locationState?.musicTrackId || selectedMusicTrack?.id, // Pass music track ID from locationState (InstantCreatePage) or selected track (CreatePage)
                venue.trim() || undefined // Venue for metadata carousel
            );

            // Dispatch event to refresh feed with render job info if available
            const renderJobId = (newPost as any).renderJobId || (newPost as any).render_job_id;
            
            // Get video URL from selectedMedia or from editTimeline clips
            let videoUrl = selectedMedia;
            if (!videoUrl && editTimeline?.clips && editTimeline.clips.length > 0) {
                videoUrl = editTimeline.clips[0].mediaUrl || editTimeline.clips[0].url;
            }
            
            console.log('=== POST CREATED EVENT DEBUG ===');
            console.log('renderJobId:', renderJobId);
            console.log('postId:', newPost.id);
            console.log('videoUrl:', videoUrl);
            console.log('selectedMedia:', selectedMedia);
            console.log('hasEditTimeline:', !!editTimeline);
            console.log('clipsCount:', editTimeline?.clips?.length || 0);
            console.log('newPost object:', newPost);
            
            if (renderJobId) {
                const eventDetail = {
                    postId: newPost.id,
                    renderJobId: renderJobId,
                    videoUrl: videoUrl || selectedMedia || '', // Use selectedMedia as fallback
                };
                
                console.log('Dispatching postCreated event with detail:', eventDetail);
                window.dispatchEvent(new CustomEvent('postCreated', {
                    detail: eventDetail
                }));
                console.log('✅ postCreated event dispatched successfully');
            } else {
                console.warn('❌ No renderJobId found, PiP will not show');
                console.warn('newPost keys:', Object.keys(newPost));
                console.warn('newPost renderJobId:', (newPost as any).renderJobId);
                console.warn('newPost render_job_id:', (newPost as any).render_job_id);
            }
            showToast('Post created successfully!');

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
                setVenue('');
                setSelectedMedia(null);
                setMediaType(null);
                setImageText('');
                setBannerText('');
                setStickers([]);
                setTaggedUsers([]);
                setSelectedMusicTrack(null);

                // Navigate back to feed
                navigate('/feed');
            }
        } catch (error: any) {
            console.error('Error creating post:', error);
            // Show more detailed error message
            const errorMessage = error?.message || error?.error || 'Failed to create post. Please try again.';
            console.error('Full error details:', {
                message: errorMessage,
                name: error?.name,
                stack: error?.stack,
                response: error?.response,
                status: error?.status
            });
            
            // If it's a connection error, the mock fallback should have worked
            // If we still get an error, something else went wrong in the mock fallback
            if (error?.name === 'ConnectionRefused' || error?.message?.includes('CONNECTION_REFUSED')) {
                // This shouldn't happen - mock fallback should handle connection errors
                console.error('❌ Mock fallback failed after connection error - this is unexpected');
                showToast('Backend not accessible. Please check your connection.');
            } else {
                showToast(errorMessage);
            }
        } finally {
            setIsUploading(false);
        }
    }, [text, selectedMedia, user, location, mediaType, imageText, stickers, bannerText, wantsToBoost, navigate]);

    const removeMedia = useCallback(() => {
        // Cleanup object URL if it's a blob URL
        if (selectedMedia && selectedMedia.startsWith('blob:')) {
            URL.revokeObjectURL(selectedMedia);
        }
        setSelectedMedia(null);
        setMediaType(null);
        setImageText('');
        setStickers([]);
        setSelectedStickerOverlay(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [selectedMedia]);

    const handleSelectSticker = useCallback((sticker: Sticker) => {
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
    }, []);

    const handleAddTextSticker = useCallback((text: string, fontSize: 'small' | 'medium' | 'large', color: string) => {
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
    }, []);

    const handleUpdateSticker = useCallback((overlayId: string, updated: StickerOverlay) => {
        setStickers(prev => prev.map(s => s.id === overlayId ? updated : s));
    }, []);

    const handleRemoveSticker = useCallback((overlayId: string) => {
        setStickers(prev => prev.filter(s => s.id !== overlayId));
        if (selectedStickerOverlay === overlayId) {
            setSelectedStickerOverlay(null);
        }
    }, [selectedStickerOverlay]);


    // Memoize computed values for performance
    const canSubmit = useMemo(() => {
        return (text.trim().length > 0 || selectedMedia !== null) && !isUploading && !isProcessingMedia;
    }, [text, selectedMedia, isUploading, isProcessingMedia]);

    // Build CSS filter string from current filter settings
    const currentFilterStyle = useMemo(() => {
        let filter = '';

        // Apply filter type
        if (activeFilter === 'bw') {
            filter = 'grayscale(1)';
        } else if (activeFilter === 'sepia') {
            filter = 'sepia(0.8)';
        } else if (activeFilter === 'vivid') {
            filter = `saturate(${1.6 * filterSaturation}) contrast(${1.1 * filterContrast})`;
        } else if (activeFilter === 'cool') {
            filter = `hue-rotate(200deg) saturate(${1.2 * filterSaturation})`;
        } else if (activeFilter === 'warm') {
            filter = `hue-rotate(-20deg) saturate(${1.1 * filterSaturation})`;
        }

        // Apply adjustments
        if (filterBrightness !== 1) filter += ` brightness(${filterBrightness})`;
        if (filterContrast !== 1) filter += ` contrast(${filterContrast})`;
        if (filterSaturation !== 1 && activeFilter !== 'vivid' && activeFilter !== 'cool' && activeFilter !== 'warm') {
            filter += ` saturate(${filterSaturation})`;
        }
        if (filterHue !== 0) filter += ` hue-rotate(${filterHue}deg)`;

        return filter ? { filter } : {};
    }, [activeFilter, filterBrightness, filterContrast, filterSaturation, filterHue]);

    const videoFilterStyle = useMemo(() => {
        if (!locationState?.filterInfo?.exportFailed) return currentFilterStyle;
        const filterInfo = locationState.filterInfo;
        if (!filterInfo) return currentFilterStyle;

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

        if (filterInfo.brightness !== 1) filter += ` brightness(${filterInfo.brightness})`;
        if (filterInfo.contrast !== 1) filter += ` contrast(${filterInfo.contrast})`;
        if (filterInfo.saturation !== 1) filter += ` saturate(${filterInfo.saturation})`;

        return filter ? { filter } : currentFilterStyle;
    }, [locationState?.filterInfo, currentFilterStyle]);

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-200">
            {/* Header - Enhanced with better animations */}
            <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="mx-auto max-w-md px-3 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/feed')}
                            className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200 active:scale-95"
                            aria-label="Go to Home Feed"
                            title="Home"
                        >
                            <FiHome className="w-5 h-5" />
                        </button>
                    </div>
                    <h1 className="font-semibold text-base text-gray-900 dark:text-gray-100">New Post</h1>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${canSubmit
                            ? 'bg-brand-500 text-white hover:bg-brand-600 active:scale-95 shadow-md hover:shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {isUploading ? (
                            <span className="flex items-center gap-2">
                                <FiLoader className="w-4 h-4 animate-spin" />
                                Posting...
                            </span>
                        ) : (
                            'Share'
                        )}
                    </button>
                </div>
            </div>

            {/* Content - Enhanced spacing and animations */}
            <div className="mx-auto max-w-md pb-24">
                {/* User Info - Enhanced with better styling */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                    <Avatar
                        src={user?.avatarUrl}
                        name={user?.name || 'User'}
                        size="sm"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                            {user?.name || 'User'}
                        </div>
                        {user?.handle && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                @{user.handle}
                            </div>
                        )}
                    </div>
                </div>

                {/* Text Input - Enhanced with better UX */}
                <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
                    <textarea
                        ref={captionRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={selectedMedia ? "Write a caption..." : "What's on your mind?"}
                        className="w-1/2 min-h-[60px] text-gray-900 dark:text-gray-100 bg-transparent border-none resize-none placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-[15px] leading-relaxed transition-all duration-200"
                        maxLength={500}
                        rows={2}
                    />
                    <div className="flex justify-end mt-2">
                        <span className={`text-xs transition-colors duration-200 ${text.length > 450
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-gray-400 dark:text-gray-500'
                            }`}>
                            {text.length}/500
                        </span>
                    </div>
                </div>

                {/* Media Upload Placeholder - Enhanced with better styling */}
                {!selectedMedia && !isProcessingMedia && (
                    <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in duration-300">
                        <div className="grid grid-cols-2 gap-3">
                            {/* Add Photo or Video */}
                            <button
                                type="button"
                                onClick={() => {
                                    // Programmatically trigger file input on mobile
                                    if (fileInputRef.current) {
                                        fileInputRef.current.click();
                                    }
                                }}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleMediaSelect}
                                    className="hidden"
                                />
                                <div className="p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 group-hover:from-brand-100 group-hover:to-brand-200 dark:group-hover:from-brand-900 dark:group-hover:to-brand-800 transition-all duration-200">
                                    <FiImage className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
                                </div>
                                <div className="text-center">
                                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Add Photo or Video</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tap to select</div>
                                </div>
                            </button>

                            {/* Templates Button */}
                            <button
                                onClick={() => navigate('/templates')}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500"
                                aria-label="Templates"
                            >
                                <div className="p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 group-hover:from-brand-100 group-hover:to-brand-200 dark:group-hover:from-brand-900 dark:group-hover:to-brand-800 transition-all duration-200">
                                    <FiLayers className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
                                </div>
                                <div className="text-center">
                                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Templates</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Use a template</div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}


                {/* Loading state for media processing */}
                {isProcessingMedia && (
                    <div className="px-4 py-8 flex flex-col items-center justify-center border-t border-gray-100 dark:border-gray-800">
                        <FiLoader className="w-8 h-8 text-brand-500 animate-spin mb-3" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">Processing media...</p>
                    </div>
                )}

                {/* Media Preview - Enhanced with better animations */}
                {selectedMedia && !isProcessingMedia && (
                    <div className="border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div
                            ref={mediaContainerRef}
                            className="relative bg-black overflow-hidden"
                            onClick={(e) => {
                                // Deselect sticker when clicking on media
                                if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).tagName === 'IMG') {
                                    setSelectedStickerOverlay(null);
                                }
                            }}
                        >
                            {filteredFromFlow && (
                                <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-600 text-white shadow-lg backdrop-blur-sm">
                                    Filtered
                                </span>
                            )}
                            {mediaType === 'image' ? (
                                <div className="relative w-full aspect-square overflow-hidden bg-black">
                                    <img
                                        src={selectedMedia}
                                        alt="Selected"
                                        className="w-full h-full object-contain transition-opacity duration-300"
                                        loading="eager"
                                        style={currentFilterStyle}
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
                                </div>
                            ) : mediaType === 'video' ? (
                                <div className="relative w-full aspect-square overflow-hidden bg-black" style={{ position: 'relative', minHeight: '400px' }}>
                                    <video
                                        ref={videoRef}
                                        src={selectedMedia}
                                        controls
                                        playsInline
                                        className="w-full h-full transition-opacity duration-300"
                                        preload="auto"
                                        onLoadedMetadata={(e) => {
                                            const duration = e.currentTarget.duration || 0;
                                            console.log('Video metadata loaded', {
                                                videoWidth: e.currentTarget.videoWidth,
                                                videoHeight: e.currentTarget.videoHeight,
                                                duration,
                                                readyState: e.currentTarget.readyState,
                                                clientWidth: e.currentTarget.clientWidth,
                                                clientHeight: e.currentTarget.clientHeight
                                            });
                                            if (duration > MAX_VIDEO_SECONDS) {
                                                showToast(`Videos must be ${MAX_VIDEO_SECONDS} seconds or less. Please trim your video before uploading.`);
                                                // Remove media that exceeds the limit
                                                removeMedia();
                                                return;
                                            }
                                            // Ensure video is visible in Edge - force reflow
                                            const video = e.currentTarget;
                                            video.style.display = 'block';
                                            video.style.visibility = 'visible';
                                            video.style.opacity = '1';
                                            // Force Edge to repaint
                                            void video.offsetHeight;
                                            video.style.transform = 'translateZ(0)';
                                        }}
                                        onLoadedData={(e) => {
                                            console.log('Video data loaded', e.currentTarget.readyState);
                                            const video = e.currentTarget;
                                            video.style.display = 'block';
                                            video.style.visibility = 'visible';
                                        }}
                                        onCanPlay={(e) => {
                                            console.log('Video can play', e.currentTarget.readyState);
                                            const video = e.currentTarget;
                                            video.style.display = 'block';
                                            video.style.visibility = 'visible';
                                        }}
                                        onError={(e) => {
                                            console.error('Video error:', e.currentTarget.error);
                                        }}
                                        onLoadStart={() => {
                                            console.log('Video load started');
                                        }}
                                        style={{
                                            ...(videoFilterStyle.filter ? videoFilterStyle : currentFilterStyle),
                                            objectFit: 'contain',
                                            width: '100%',
                                            height: '100%',
                                            minWidth: '100%',
                                            minHeight: '100%',
                                            display: 'block',
                                            visibility: 'visible',
                                            opacity: '1',
                                            backgroundColor: 'transparent',
                                            position: 'relative',
                                            zIndex: 1
                                        }}
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
                                </div>
                            ) : null}
                            <button
                                onClick={removeMedia}
                                className="absolute top-4 right-4 p-2.5 bg-black/70 backdrop-blur-md text-white rounded-full hover:bg-black/90 transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 z-10 border border-white/20"
                                aria-label="Remove media"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Image Text Overlay Input - Enhanced */}
                {selectedMedia && mediaType === 'image' && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                        <input
                            type="text"
                            value={imageText}
                            onChange={(e) => setImageText(e.target.value)}
                            placeholder="Add text to image..."
                            className="w-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 shadow-sm"
                            maxLength={100}
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Text overlay</span>
                            <span className={`text-xs transition-colors duration-200 ${imageText.length > 90
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-gray-400 dark:text-gray-500'
                                }`}>
                                {imageText.length}/100
                            </span>
                        </div>
                    </div>
                )}

                {/* Music Selection Display */}
                {selectedMusicTrack && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30">
                                    <FiMusic className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                        {selectedMusicTrack.title}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {selectedMusicTrack.artist || 'Unknown Artist'}
                                        {selectedMusicTrack.license_requires_attribution && (
                                            <span className="ml-2 text-gray-400">({selectedMusicTrack.license_type})</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedMusicTrack(null)}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <FiX className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Location Input - Enhanced */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                        <FiMapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Location
                        </label>
                    </div>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Add location"
                        className="w-full px-0 py-1.5 text-[15px] text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    />
                </div>

                {/* Venue Input - Shown in metadata carousel on feed */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                        <FiMapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Venue
                        </label>
                    </div>
                    <input
                        type="text"
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        placeholder="Add venue (e.g. café, stadium)"
                        className="w-full px-0 py-1.5 text-[15px] text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                    />
                </div>

                {/* Tag People - Enhanced */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={() => setShowUserTagging(true)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
                    >
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                            <FiUser className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                Tag People
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {taggedUsers.length > 0
                                    ? `${taggedUsers.length} ${taggedUsers.length === 1 ? 'person' : 'people'} tagged`
                                    : 'Tag someone in your post'
                                }
                            </div>
                        </div>
                        {taggedUsers.length > 0 && (
                            <div className="flex items-center gap-1">
                                {taggedUsers.slice(0, 2).map((handle) => (
                                    <div key={handle} className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-semibold">
                                        {handle.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                {taggedUsers.length > 2 && (
                                    <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs flex items-center justify-center font-semibold">
                                        +{taggedUsers.length - 2}
                                    </div>
                                )}
                            </div>
                        )}
                    </button>
                </div>

                {/* Boost Option - Enhanced */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200">
                        <input
                            type="checkbox"
                            checked={wantsToBoost}
                            onChange={(e) => setWantsToBoost(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 focus:ring-2 transition-all duration-200 cursor-pointer"
                        />
                        <div className="flex items-center gap-2.5 flex-1">
                            <div className={`p-2 rounded-lg transition-all duration-200 ${wantsToBoost
                                ? 'bg-brand-100 dark:bg-brand-900/30'
                                : 'bg-gray-100 dark:bg-gray-800'
                                }`}>
                                <FiZap className={`w-4 h-4 transition-colors duration-200 ${wantsToBoost
                                    ? 'text-brand-600 dark:text-brand-400'
                                    : 'text-gray-400 dark:text-gray-500'
                                    }`} />
                            </div>
                            <div>
                                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                    Boost this post
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Reach more people
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Starting at €4.99
                                </div>
                            </div>
                        </div>
                    </label>
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

            {/* User Tagging Modal */}
            <UserTaggingModal
                isOpen={showUserTagging}
                onClose={() => setShowUserTagging(false)}
                onSelectUser={(handle, _displayName) => {
                    if (!taggedUsers.includes(handle)) {
                        setTaggedUsers([...taggedUsers, handle]);
                    }
                }}
                taggedUsers={taggedUsers}
            />

            {/* Music Picker Modal */}
            <MusicPicker
                isOpen={showMusicPicker}
                onClose={() => setShowMusicPicker(false)}
                onSelectTrack={(track) => {
                    setSelectedMusicTrack(track);
                    if (track) {
                        showToast(`Selected: ${track.title} by ${track.artist || 'Unknown'}`);
                    }
                }}
                selectedTrackId={selectedMusicTrack?.id}
            />

            {/* Footer - Navigation Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 dark:bg-gray-950 border-t border-gray-800 dark:border-gray-700 shadow-lg">
                <div className="mx-auto max-w-md h-16 flex items-center justify-around px-4">
                    {/* Filters Button */}
                    <button
                        onClick={() => {
                            if (selectedMedia) {
                                setShowFilters(true);
                            } else {
                                showToast('Please select media first to apply filters');
                            }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-800 dark:bg-gray-800 text-white border border-gray-700 dark:border-gray-700 hover:bg-gray-700 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95 text-sm font-medium shadow-sm"
                        aria-label="Filters"
                    >
                        <FiSliders className="w-4 h-4" />
                        <span>Filters</span>
                    </button>

                    {/* Stickers Button */}
                    <button
                        onClick={() => {
                            if (selectedMedia) {
                                setShowStickerPicker(true);
                            } else {
                                showToast('Please select media first to add stickers');
                            }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-800 dark:bg-gray-800 text-white border border-gray-700 dark:border-gray-700 hover:bg-gray-700 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95 text-sm font-medium shadow-sm"
                        aria-label="Stickers"
                    >
                        <FiSmile className="w-4 h-4" />
                        <span>Stickers</span>
                    </button>


                    {/* Music Button */}
                    <button
                        onClick={() => {
                            if (selectedMedia && mediaType === 'video') {
                                setShowMusicPicker(true);
                            } else {
                                showToast('Please select a video first to add music');
                            }
                        }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border transition-all duration-200 active:scale-95 text-sm font-medium shadow-sm ${
                            selectedMusicTrack
                                ? 'bg-brand-500 border-brand-500 text-white hover:bg-brand-600'
                                : 'bg-gray-800 dark:bg-gray-800 text-white border-gray-700 dark:border-gray-700 hover:bg-gray-700 dark:hover:bg-gray-700'
                        }`}
                        aria-label="Add Music"
                    >
                        <FiMusic className="w-4 h-4" />
                        <span>Music</span>
                    </button>

                    {/* Create Text Only Post Button */}
                    <button
                        onClick={() => {
                            navigate('/create/text-only');
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-800 dark:bg-gray-800 text-white border border-gray-700 dark:border-gray-700 hover:bg-gray-700 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95 text-sm font-medium shadow-sm"
                        aria-label="Text Post"
                    >
                        <FiType className="w-4 h-4" />
                        <span>Text</span>
                    </button>
                </div>
            </div>

            {/* Filters Modal - Fixed Layout */}
            {showFilters && selectedMedia && (
                <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
                    {/* Header - Fixed at top */}
                    <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/30 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Filters</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowAdjustments(!showAdjustments)}
                                    className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                                    aria-label="Toggle Adjustments"
                                    title="Adjustments"
                                >
                                    <FiSliders className={`w-5 h-5 text-gray-400 transition-transform ${showAdjustments ? 'text-brand-400 rotate-90' : ''}`} />
                                </button>
                                <button
                                    onClick={() => setShowFilters(false)}
                                    className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                                    aria-label="Close"
                                >
                                    <FiX className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content - Full screen preview with bottom filter bar */}
                    <div className="flex-1 relative overflow-hidden min-h-0">
                        {/* Preview - Full screen background */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black">
                            <div className="relative w-full h-full max-w-full max-h-full">
                                {mediaType === 'image' ? (
                                    <img
                                        src={selectedMedia}
                                        alt="Filter preview"
                                        className="w-full h-full object-contain"
                                        style={currentFilterStyle}
                                    />
                                ) : (
                                    <video
                                        src={selectedMedia}
                                        className="w-full h-full"
                                        style={{
                                            ...currentFilterStyle,
                                            objectFit: 'contain',
                                            width: '100%',
                                            height: '100%',
                                            display: 'block'
                                        }}
                                        playsInline
                                        muted
                                        loop
                                        autoPlay
                                    />
                                )}
                            </div>
                        </div>

                        {/* Filter Icons Bar - Bottom overlay */}
                        <div className="absolute bottom-4 left-0 right-0 z-10 px-4">
                            <div className="p-2">
                                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                                    {[
                                        { id: 'none', name: 'None' },
                                        { id: 'bw', name: 'B&W' },
                                        { id: 'sepia', name: 'Sepia' },
                                        { id: 'vivid', name: 'Vivid' },
                                        { id: 'cool', name: 'Cool' },
                                        { id: 'warm', name: 'Warm' }
                                    ].map((filter) => (
                                        <button
                                            key={filter.id}
                                            onClick={() => setActiveFilter(filter.id)}
                                            className={`flex flex-col items-center justify-center gap-1 px-2 py-1.5 transition-all flex-shrink-0 ${activeFilter === filter.id
                                                ? 'scale-110'
                                                : ''
                                                }`}
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeFilter === filter.id
                                                ? 'bg-brand-500 border-2 border-white/50 shadow-lg'
                                                : 'bg-white/10 border border-white/20 hover:bg-white/20'
                                                }`}>
                                                {filter.id === 'none' && <FiCircle className="w-4 h-4 text-white" />}
                                                {filter.id === 'bw' && <div className="w-4 h-4 rounded-full bg-gradient-to-br from-white to-gray-400" />}
                                                {filter.id === 'sepia' && <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-200 to-amber-800" />}
                                                {filter.id === 'vivid' && <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-400 via-purple-500 to-blue-500" />}
                                                {filter.id === 'cool' && <div className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-300 to-blue-600" />}
                                                {filter.id === 'warm' && <div className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-300 to-red-500" />}
                                            </div>
                                            <span className="text-[10px] font-medium whitespace-nowrap text-white/80">{filter.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Adjustments Panel - Bottom overlay, toggled by icon */}
                        {showAdjustments && (
                            <div className="absolute bottom-20 left-0 right-0 z-10 px-4">
                                <div className="bg-black/70 backdrop-blur-lg rounded-2xl p-4 border border-white/20 max-h-[200px] overflow-y-auto">
                                    <div className="space-y-3">
                                        {/* Brightness */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs text-white font-medium">Brightness</label>
                                                <span className="text-xs text-white/80 bg-black/50 px-2 py-0.5 rounded">{Math.round(filterBrightness * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="1.5"
                                                step="0.01"
                                                value={filterBrightness}
                                                onChange={(e) => setFilterBrightness(parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                            />
                                        </div>

                                        {/* Contrast */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs text-white font-medium">Contrast</label>
                                                <span className="text-xs text-white/80 bg-black/50 px-2 py-0.5 rounded">{Math.round(filterContrast * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="1.5"
                                                step="0.01"
                                                value={filterContrast}
                                                onChange={(e) => setFilterContrast(parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                            />
                                        </div>

                                        {/* Saturation */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs text-white font-medium">Saturation</label>
                                                <span className="text-xs text-white/80 bg-black/50 px-2 py-0.5 rounded">{Math.round(filterSaturation * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="2"
                                                step="0.01"
                                                value={filterSaturation}
                                                onChange={(e) => setFilterSaturation(parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                            />
                                        </div>

                                        {/* Hue */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs text-white font-medium">Hue</label>
                                                <span className="text-xs text-white/80 bg-black/50 px-2 py-0.5 rounded">{Math.round(filterHue)}°</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="-180"
                                                max="180"
                                                step="1"
                                                value={filterHue}
                                                onChange={(e) => setFilterHue(parseInt(e.target.value))}
                                                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions - Fixed at bottom */}
                    <div className="flex-shrink-0 px-4 py-4 border-t border-white/10 bg-black/30 backdrop-blur-md flex gap-3">
                        <button
                            onClick={() => {
                                setActiveFilter('none');
                                setFilterBrightness(1.0);
                                setFilterContrast(1.0);
                                setFilterSaturation(1.0);
                                setFilterHue(0);
                            }}
                            className="flex-1 px-4 py-3 rounded-xl bg-white/10 font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/20"
                            style={{
                                backgroundImage: 'linear-gradient(90deg, #87ceeb, #ffb6c1, #87cefa, #c084fc, #34d399, #f59e0b, #ef4444, #dc2626, #fca5a5, #60a5fa, #fb7185, #87ceeb)',
                                backgroundSize: '200% 100%',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                                animation: 'shimmer 6s linear infinite'
                            }}
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => setShowFilters(false)}
                            className="flex-1 px-4 py-3 rounded-xl bg-brand-500/80 font-semibold hover:bg-brand-500 transition-colors backdrop-blur-sm border border-white/20"
                            style={{
                                backgroundImage: 'linear-gradient(90deg, #87ceeb, #ffb6c1, #87cefa, #c084fc, #34d399, #f59e0b, #ef4444, #dc2626, #fca5a5, #60a5fa, #fb7185, #87ceeb)',
                                backgroundSize: '200% 100%',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                                animation: 'shimmer 6s linear infinite'
                            }}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
