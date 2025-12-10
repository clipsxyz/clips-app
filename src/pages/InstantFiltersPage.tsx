import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiFilter, FiSliders, FiImage, FiDownload, FiArrowLeft, FiSend, FiChevronDown, FiX, FiChevronUp, FiUpload, FiMusic, FiLayers, FiZap, FiGrid, FiSave, FiTrash2, FiPlus, FiScissors, FiRotateCw, FiRepeat, FiVolume2, FiVideo, FiSmile, FiArrowRight, FiPlay, FiHeart, FiMenu } from 'react-icons/fi';
import StickerOverlayComponent from '../components/StickerOverlay';
import StickerPicker from '../components/StickerPicker';
import { getStickers } from '../api/stickers';
import type { StickerOverlay, Sticker } from '../types';
import { saveDraft } from '../api/drafts';
import Swal from 'sweetalert2';
import { getTemplates } from '../api/templates';
import type { VideoTemplate } from '../types';
import { createPost } from '../api/posts';
import { useAuth } from '../context/Auth';
// Dynamic import for FFmpeg to avoid build issues
// import { FFmpeg } from '@ffmpeg/ffmpeg';
// import { fetchFile } from '@ffmpeg/util';

type Clip = {
    id: string;
    url: string;
    duration: number;
    trimStart: number;
    trimEnd: number;
    speed: number;
    reverse: boolean;
    blob?: Blob; // Optional blob reference for upload
    mediaType?: 'image' | 'video'; // Media type
};

type Transition = {
    type: 'none' | 'fade' | 'crossfade' | 'slideleft' | 'slideright' | 'slideup' | 'slidedown' | 'wiperight' | 'wipeleft' | 'wipeup' | 'wipedown' | 'zoom' | 'zoomin' | 'zoomout' | 'spin' | 'fadewhite' | 'fadeblack';
    duration: number; // Duration in seconds (0.1 - 2.0)
    direction?: 'left' | 'right' | 'up' | 'down'; // For swipe, split, etc.
    intensity?: number; // 0-100, for effects like shake, glitch
};

type LocationState = {
    videoUrl?: string;
    videoDuration?: number;
    selectedFilter?: string;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hue?: number; // Hue adjustment for hybrid model
    trimStart?: number;
    trimEnd?: number;
    speed?: number;
    reverse?: boolean;
    clips?: Clip[]; // Multi-clip support
    transitions?: Transition[]; // Transitions between clips
    voiceoverUrl?: string; // Voiceover audio URL
    greenScreenEnabled?: boolean; // Green screen enabled
    greenScreenBackgroundUrl?: string; // Background URL for green screen
    mediaType?: 'image' | 'video'; // Media type to distinguish images from videos
    musicTrackId?: number; // Music track ID from library
};

type ShaderId = 'none' | 'bw' | 'sepia' | 'vivid' | 'cool' | 'vignette' | 'beauty';
const filters: { id: ShaderId; name: string }[] = [
    { id: 'none', name: 'None' },
    { id: 'beauty', name: 'Beauty' },
    { id: 'bw', name: 'B&W' },
    { id: 'sepia', name: 'Sepia' },
    { id: 'vivid', name: 'Vivid' },
    { id: 'cool', name: 'Cool' },
    { id: 'vignette', name: 'Vignette' },
];

type BuiltinLut = { id: string; name: string; url: string; size?: number; tiles?: number };
const builtinLuts: BuiltinLut[] = [
    { id: 'none', name: 'None', url: '' },
    { id: 'tealorange', name: 'Teal & Orange', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/teal_orange_16.png', size: 16, tiles: 4 },
    { id: 'film', name: 'Film Warm', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/film_warm_16.png', size: 16, tiles: 4 },
    { id: 'bleachbypass', name: 'Bleach Bypass', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/bleach_bypass_16.png', size: 16, tiles: 4 },
    { id: 'cinematic', name: 'Cinematic', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/cinematic_16.png', size: 16, tiles: 4 },
    { id: 'vintage', name: 'Vintage', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/vintage_16.png', size: 16, tiles: 4 },
    { id: 'dramatic', name: 'Dramatic', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/dramatic_16.png', size: 16, tiles: 4 },
    { id: 'cooltone', name: 'Cool Tone', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/cool_tone_16.png', size: 16, tiles: 4 },
    { id: 'warmtone', name: 'Warm Tone', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/warm_tone_16.png', size: 16, tiles: 4 },
];

// Transition Preview Functions (Canvas-based)
function drawSwipe(ctx: CanvasRenderingContext2D, imgA: HTMLImageElement | HTMLVideoElement, imgB: HTMLImageElement | HTMLVideoElement, progress: number) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgA, -progress * w, 0, w, h);
    ctx.drawImage(imgB, w - progress * w, 0, w, h);
}

function drawZoom(ctx: CanvasRenderingContext2D, imgA: HTMLImageElement | HTMLVideoElement, imgB: HTMLImageElement | HTMLVideoElement, progress: number) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const scaleA = 1 + progress * 1.2;
    const scaleB = 0.5 + progress * 0.5;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.scale(scaleA, scaleA);
    ctx.drawImage(imgA, -w/2, -h/2, w, h);
    ctx.restore();
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.scale(scaleB, scaleB);
    ctx.globalAlpha = progress;
    ctx.drawImage(imgB, -w/2, -h/2, w, h);
    ctx.restore();
    ctx.globalAlpha = 1.0;
}

function drawFade(ctx: CanvasRenderingContext2D, imgA: HTMLImageElement | HTMLVideoElement, imgB: HTMLImageElement | HTMLVideoElement, progress: number) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgA, 0, 0, w, h);
    ctx.globalAlpha = progress;
    ctx.drawImage(imgB, 0, 0, w, h);
    ctx.globalAlpha = 1.0;
}

// TikTok-Style ToolButton Component
function ToolButton({ icon, label, onClick, isActive = false, isEditsMenu = false }: { icon: React.ReactNode; label: string; onClick: () => void; isActive?: boolean; isEditsMenu?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center text-sm transition-all ${
                isActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
            }`}
        >
            <div className={`p-3 rounded-full transition-all relative ${
                isEditsMenu 
                    ? 'bg-transparent border-2 border-white animate-pulse-glow' 
                    : isActive 
                        ? 'bg-blue-600' 
                        : 'bg-gray-800 hover:bg-gray-700'
            } ${isEditsMenu && isActive ? 'animate-spin-slow' : ''}`}>
                {icon}
                {isEditsMenu && (
                    <>
                        <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping"></div>
                        <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-pulse"></div>
                    </>
                )}
            </div>
            <span className="mt-1 text-white">{label}</span>
        </button>
    );
}

export default function InstantFiltersPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { state } = useLocation();

    // Debug: Log the entire state
    React.useEffect(() => {
        console.log('🔍 InstantFiltersPage - Full location state:', state);
        console.log('🔍 InstantFiltersPage - State type:', typeof state);
        console.log('🔍 InstantFiltersPage - State keys:', state ? Object.keys(state) : 'null');
    }, [state]);

    const locationState = (state || {}) as LocationState;
    
    const {
        videoUrl,
        videoDuration = 0,
        selectedFilter: passedFilter,
        brightness: passedBrightness,
        contrast: passedContrast,
        saturation: passedSaturation,
        hue: passedHue,
        trimStart: passedTrimStart,
        trimEnd: passedTrimEnd,
        mediaType,
        clips: passedClips
    } = locationState;

    // Multi-clip state management
    const [clips, setClips] = React.useState<Clip[]>(passedClips || []);
    const multiClipInputRef = React.useRef<HTMLInputElement | null>(null);
    const [draggedClipId, setDraggedClipId] = React.useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    // Handler to move clip earlier in sequence (left/to the beginning)
    const handleMoveClipEarlier = (index: number) => {
        if (index === 0) return; // Already at the beginning
        const newClips = [...clips];
        [newClips[index - 1], newClips[index]] = [newClips[index], newClips[index - 1]];
        setClips(newClips);
        console.log('⬅️ Moved clip earlier from index', index, 'to', index - 1);
    };

    // Handler to move clip later in sequence (right/towards the end)
    const handleMoveClipLater = (index: number) => {
        if (index === clips.length - 1) return; // Already at the end
        const newClips = [...clips];
        [newClips[index], newClips[index + 1]] = [newClips[index + 1], newClips[index]];
        setClips(newClips);
        console.log('➡️ Moved clip later from index', index, 'to', index + 1);
    };

    // Handler to add more clips
    const handleAddClip = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                const clipMediaType = file.type.startsWith('image/') ? 'image' : 'video';

                let duration = 3; // Default for images
                if (file.type.startsWith('video/')) {
                    const tempVideo = document.createElement('video');
                    tempVideo.src = url;
                    tempVideo.preload = 'metadata';

                    await new Promise<void>((resolve) => {
                        tempVideo.onloadedmetadata = () => {
                            duration = tempVideo.duration && isFinite(tempVideo.duration) ? tempVideo.duration : 5;
                            resolve();
                        };
                        tempVideo.onerror = () => resolve();
                        setTimeout(() => resolve(), 3000); // Timeout fallback
                    });
                }

                const newClip: Clip = {
                    id: `clip-${Date.now()}-${Math.random()}`,
                    url: url,
                    duration: duration,
                    trimStart: 0,
                    trimEnd: duration,
                    speed: 1.0,
                    reverse: false,
                    blob: file,
                    mediaType: clipMediaType
                };

                setClips(prev => [...prev, newClip]);
            }
        }

        // Reset input
        if (multiClipInputRef.current) {
            multiClipInputRef.current.value = '';
        }
    };

    // Map filter name from InstantCreatePage to ShaderId
    const mapFilterToShaderId = (filterName: string): ShaderId => {
        switch (filterName) {
            case 'B&W': return 'bw';
            case 'Sepia': return 'sepia';
            case 'Vivid': return 'vivid';
            case 'Cool': return 'cool';
            case 'Vignette': return 'vignette';
            case 'Beauty': return 'beauty';
            default: return 'none';
        }
    };

    const [active, setActive] = React.useState<ShaderId>(passedFilter ? mapFilterToShaderId(passedFilter) : 'none');
    const [brightness, setBrightness] = React.useState(passedBrightness ?? 1.0);
    const [contrast, setContrast] = React.useState(passedContrast ?? 1.0);
    const [saturation, setSaturation] = React.useState(passedSaturation ?? 1.0);
    const [hue, setHue] = React.useState(passedHue ?? 0.0);
    const [vig, setVig] = React.useState(0.4);

    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const glRef = React.useRef<WebGLRenderingContext | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const categoryScrollRef = React.useRef<HTMLDivElement | null>(null);
    const transitionCanvasRef = React.useRef<HTMLCanvasElement | null>(null); // For transition preview
    const [exporting, setExporting] = React.useState(false);
    
    // Voice-over state
    const [voiceoverBlob, setVoiceoverBlob] = React.useState<Blob | null>(null);
    const [voiceoverUrl, setVoiceoverUrl] = React.useState<string | null>(null);
    const [isRecordingVoiceover, setIsRecordingVoiceover] = React.useState(false);
    const [voiceoverStartTime, setVoiceoverStartTime] = React.useState(0); // When to start voice-over in video
    const [voiceoverVolume, setVoiceoverVolume] = React.useState(1.2); // Voice-over volume (default 1.2 = 120%)
    const [keepOriginalAudio, setKeepOriginalAudio] = React.useState(true); // Mix with original audio
    const [noiseReduction, setNoiseReduction] = React.useState(false); // Enable noise reduction
    const [noiseReductionStrength, setNoiseReductionStrength] = React.useState(0.5); // Noise reduction strength (0-1)
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    
    // Stickers/Overlays state
    const [stickers, setStickers] = React.useState<Array<{
        id: string;
        stickerId: string;
        sticker: { id: string; name: string; url?: string; emoji?: string; category: string };
        x: number; // Position X (%)
        y: number; // Position Y (%)
        scale: number; // Scale factor
        rotation: number; // Rotation (degrees)
        opacity: number; // Opacity (0-1)
        startTime?: number; // Start time (seconds)
        endTime?: number; // End time (seconds)
    }>>(locationState?.stickers || []);
    const [selectedSticker, setSelectedSticker] = React.useState<string | null>(null);
    const [isStickerPickerOpen, setIsStickerPickerOpen] = React.useState(false);
    const videoContainerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
    const [timelineDragState, setTimelineDragState] = React.useState<{
        stickerId: string;
        type: 'drag' | 'resize-left' | 'resize-right';
        startX: number;
        startTime: number;
    } | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    
    // Update container size when video container is available
    React.useEffect(() => {
        const updateSize = () => {
            if (videoContainerRef.current) {
                setContainerSize({
                    width: videoContainerRef.current.offsetWidth,
                    height: videoContainerRef.current.offsetHeight
                });
            }
        };
        
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [videoContainerRef.current]);
    const voiceoverAudioRef = React.useRef<HTMLAudioElement | null>(null);
    const [trimming, setTrimming] = React.useState(false);
    const [postingFeed, setPostingFeed] = React.useState(false);
    const [postingClips, setPostingClips] = React.useState(false);
    const [exportUrl, setExportUrl] = React.useState<string | null>(null);
    
    // Timeline state for TikTok-style UI
    const [timelineCurrentTime, setTimelineCurrentTime] = React.useState(0);
    const [timelineDuration, setTimelineDuration] = React.useState(0);
    
    // Global mouse handlers for timeline dragging (must be after timelineDuration is defined)
    React.useEffect(() => {
        if (!timelineDragState) return;
        
        const duration = timelineDuration || videoDuration || 90;
        const pxPerSecond = 50; // pixels per second (zoom level)
        
        const handleMouseMove = (e: MouseEvent) => {
            const sticker = stickers.find(s => s.id === timelineDragState.stickerId);
            if (!sticker) return;
            
            const deltaX = e.clientX - timelineDragState.startX;
            const delta = deltaX / pxPerSecond;
            
            if (timelineDragState.type === 'drag') {
                const newStart = Math.max(0, timelineDragState.startTime + delta);
                const stickerDuration = (sticker.endTime || duration) - (sticker.startTime || 0);
                const newEnd = Math.min(duration, newStart + stickerDuration);
                if (newStart < newEnd && newEnd <= duration) {
                    setStickers(stickers.map(s => 
                        s.id === sticker.id 
                            ? { ...s, startTime: newStart, endTime: newEnd }
                            : s
                    ));
                }
            } else if (timelineDragState.type === 'resize-left') {
                const newStart = Math.max(0, Math.min(timelineDragState.startTime + delta, (sticker.endTime || duration) - 0.1));
                setStickers(stickers.map(s => 
                    s.id === sticker.id 
                        ? { ...s, startTime: newStart }
                        : s
                ));
            } else if (timelineDragState.type === 'resize-right') {
                const newEnd = Math.min(duration, Math.max(timelineDragState.startTime + delta, (sticker.startTime || 0) + 0.1));
                setStickers(stickers.map(s => 
                    s.id === sticker.id 
                        ? { ...s, endTime: newEnd }
                        : s
                ));
            }
        };
        
        const handleMouseUp = () => {
            setTimelineDragState(null);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [timelineDragState, stickers, timelineDuration, videoDuration]);

    // Trim state for single clip mode
    const [trimStart, setTrimStart] = React.useState(passedTrimStart ?? 0);
    const [trimEnd, setTrimEnd] = React.useState(passedTrimEnd ?? videoDuration);
    const [selectedClipForTrim, setSelectedClipForTrim] = React.useState<number | null>(null); // For multi-clip: which clip is being trimmed
    const [isDraggingTrimHandle, setIsDraggingTrimHandle] = React.useState<'start' | 'end' | null>(null);
    const trimTimelineRef = React.useRef<HTMLDivElement | null>(null);

    // Speed state for single clip mode (default 1.0 = normal speed)
    const [speed, setSpeed] = React.useState(1.0);
    const [selectedClipForSpeed, setSelectedClipForSpeed] = React.useState<number | null>(null); // For multi-clip: which clip is being speed-adjusted

    // Reverse state for single clip mode
    const [reverse, setReverse] = React.useState(false);
    const [selectedClipForReverse, setSelectedClipForReverse] = React.useState<number | null>(null); // For multi-clip: which clip is being reversed

    // Transitions state - stored per clip (transition between clip[i] and clip[i+1])
    const [transitions, setTransitions] = React.useState<Transition[]>([]);
    const [selectedTransitionIndex, setSelectedTransitionIndex] = React.useState<number | null>(null); // Which transition is being edited
    const transitionPreviewRef = React.useRef<{ videoA: HTMLVideoElement | null; videoB: HTMLVideoElement | null; animationId: number | null }>({
        videoA: null,
        videoB: null,
        animationId: null
    });

    // Music state
    const [selectedMusicUrl, setSelectedMusicUrl] = React.useState<string | null>(null);
    const [musicVolume, setMusicVolume] = React.useState(0.7); // 0-1 (0-100%)
    const [videoVolume, setVideoVolume] = React.useState(1.0); // 0-1 (0-100%) - Original video audio volume
    const [musicStartTime, setMusicStartTime] = React.useState(0); // When music starts (seconds)
    const [uploadedMusicFile, setUploadedMusicFile] = React.useState<File | null>(null);
    const musicAudioRef = React.useRef<HTMLAudioElement | null>(null);
    const musicUploadInputRef = React.useRef<HTMLInputElement | null>(null);

    // Library state
    const [libraryTracks, setLibraryTracks] = React.useState<any[]>([]);
    const [libraryLoading, setLibraryLoading] = React.useState(false);
    const [libraryFilters, setLibraryFilters] = React.useState({
        genre: '',
        mood: '',
        search: '',
    });
    const [musicTab, setMusicTab] = React.useState<'library' | 'ai'>('library');
    const [aiMusicGenerating, setAiMusicGenerating] = React.useState(false);
    const [aiMusicForm, setAiMusicForm] = React.useState({
        mood: 'happy' as 'happy' | 'energetic' | 'calm' | 'dramatic' | 'romantic' | 'upbeat',
        genre: 'pop' as 'pop' | 'rock' | 'electronic' | 'hip-hop' | 'jazz' | 'classical',
        duration: 30,
    });

    // Waveform visualization state
    const [waveHeights, setWaveHeights] = React.useState<number[]>(new Array(20).fill(5));
    const [bassLevel, setBassLevel] = React.useState(0);
    const [audioAnalyser, setAudioAnalyser] = React.useState<AnalyserNode | null>(null);
    const [audioContext, setAudioContext] = React.useState<AudioContext | null>(null);
    const [isMusicPlaying, setIsMusicPlaying] = React.useState(false);
    const waveformAnimationRef = React.useRef<number | null>(null);
    const [likedTracks, setLikedTracks] = React.useState<Set<number>>(new Set());
    const [lutAmount, setLutAmount] = React.useState(0);
    const lutImageRef = React.useRef<HTMLImageElement | null>(null);
    const lutTextureRef = React.useRef<WebGLTexture | null>(null);
    const [lutMeta, setLutMeta] = React.useState<{ size: number; tiles: number } | null>(null);
    const [selectedBuiltin, setSelectedBuiltin] = React.useState<BuiltinLut>(builtinLuts[0]);
    const [webglOk, setWebglOk] = React.useState(true);
    const [showAdjustments, setShowAdjustments] = React.useState(false);
    const [selectedTemplate, setSelectedTemplate] = React.useState<VideoTemplate | null>(null);
    const [templates, setTemplates] = React.useState<VideoTemplate[]>([]);

    // Category selection state
    const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

    // Define 12 categories
    const categories = [
        { id: 'music', name: 'Music', icon: FiMusic },
        { id: 'filters', name: 'Filters', icon: FiFilter },
        { id: 'adjustments', name: 'Adjust', icon: FiSliders },
        { id: 'lut', name: 'LUT', icon: FiImage },
        { id: 'trim', name: 'Trim', icon: FiScissors },
        { id: 'speed', name: 'Speed', icon: FiZap },
        { id: 'reverse', name: 'Reverse', icon: FiRepeat },
        { id: 'multi-clip', name: 'Multi-Clip', icon: FiLayers },
        { id: 'transitions', name: 'Transitions', icon: FiGrid },
        { id: 'overlays', name: 'Overlays', icon: FiSmile },
        { id: 'voiceover', name: 'Voiceover', icon: FiVolume2 },
        { id: 'green-screen', name: 'Green Screen', icon: FiVideo },
    ];

    // Check if the media is an image
    const isImage = React.useMemo(() => {
        if (mediaType === 'image') return true;
        if (mediaType === 'video') return false;
        // Fallback: check URL if mediaType not provided
        if (!videoUrl) return false;
        const lowerUrl = videoUrl.toLowerCase();
        return lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') ||
            lowerUrl.includes('.png') || lowerUrl.includes('.gif') ||
            lowerUrl.includes('.webp') || lowerUrl.includes('.bmp');
    }, [videoUrl, mediaType]);

    // Recreate blob URL if it's invalid and we have the blob in clips
    const [actualVideoUrl, setActualVideoUrl] = React.useState<string | undefined>(videoUrl);
    
    // Multi-clip preview state - track which clip is currently playing
    const [currentClipIndex, setCurrentClipIndex] = React.useState(0);
    const [isPlayingMultiClip, setIsPlayingMultiClip] = React.useState(false);

    // Sync trimEnd with videoDuration when it changes
    React.useEffect(() => {
        if (videoDuration > 0 && (trimEnd === 0 || trimEnd > videoDuration)) {
            setTrimEnd(videoDuration);
        }
    }, [videoDuration]);


    // Initialize speed and reverse from clips if available (for multi-clip mode)
    // Only initialize once on mount if clips are passed in
    const hasInitializedRef = React.useRef(false);
    React.useEffect(() => {
        if (!hasInitializedRef.current && clips && clips.length > 0) {
            if (clips[0]?.speed !== undefined) {
                setSpeed(clips[0].speed);
            }
            if (clips[0]?.reverse !== undefined) {
                setReverse(clips[0].reverse);
            }
            hasInitializedRef.current = true;
        }
    }, [clips]);

    // Apply playbackRate to video preview when speed changes (client-side preview only)
    // Note: Reverse cannot be previewed client-side (browsers don't support negative playbackRate)
    // Reverse will be applied on the server side using FFmpeg
    React.useEffect(() => {
        if (videoRef.current && !isImage) {
            // For multi-clip mode with selected clip, use that clip's speed
            // For multi-clip mode without selection, use first clip's speed
            // For single clip mode (no clips array), use the speed state
            let currentSpeed: number;
            
            if (clips && clips.length > 0) {
                let clip;
                if (selectedClipForSpeed !== null && clips[selectedClipForSpeed]) {
                    clip = clips[selectedClipForSpeed];
                } else {
                    clip = clips[0];
                }
                currentSpeed = clip?.speed || 1.0;
            } else {
                currentSpeed = speed;
            }
            
            // Apply speed (but not reverse - browsers don't support negative playbackRate)
            // Reverse will be applied on the server side
            videoRef.current.playbackRate = currentSpeed;
            
            console.log('✅ Video playbackRate set to:', currentSpeed, '(reverse will be applied on server)');
        }
    }, [speed, clips, selectedClipForSpeed, isImage]);

    // Multi-clip sequential playback preview
    React.useEffect(() => {
        if (!videoRef.current || isImage || clips.length <= 1) {
            // Single clip mode or image - use normal playback
            if (clips.length === 0 && actualVideoUrl) {
                setActualVideoUrl(actualVideoUrl);
            }
            return;
        }

        // Multi-clip mode - set up sequential playback
        const video = videoRef.current;
        const currentClip = clips[currentClipIndex];
        
        if (currentClip) {
            // Update video source to current clip
            const clipUrl = currentClip.url;
            if (video.src !== clipUrl) {
                video.src = clipUrl;
                video.load();
            }

            // Set playback rate for current clip
            video.playbackRate = currentClip.speed || 1.0;

            // Handle clip ending - play next clip
            const handleEnded = () => {
                if (currentClipIndex < clips.length - 1) {
                    // Move to next clip
                    setCurrentClipIndex(prev => prev + 1);
                    setIsPlayingMultiClip(true);
                } else {
                    // All clips played - loop back to first or stop
                    setCurrentClipIndex(0);
                    setIsPlayingMultiClip(false);
                }
            };

            // Handle clip start
            const handlePlay = () => {
                setIsPlayingMultiClip(true);
            };

            // Handle pause
            const handlePause = () => {
                setIsPlayingMultiClip(false);
            };

            video.addEventListener('ended', handleEnded);
            video.addEventListener('play', handlePlay);
            video.addEventListener('pause', handlePause);

            return () => {
                video.removeEventListener('ended', handleEnded);
                video.removeEventListener('play', handlePlay);
                video.removeEventListener('pause', handlePause);
            };
        }
    }, [clips, currentClipIndex, isImage, actualVideoUrl]);

    // Reset clip index when clips change
    React.useEffect(() => {
        if (clips.length > 0) {
            setCurrentClipIndex(0);
        }
    }, [clips.length]);

    // Sync music playback with video preview
    React.useEffect(() => {
        if (!selectedMusicUrl || !videoRef.current) return;
        
        // Validate URL - must be a valid http/https URL or data URL, not a broken blob
        if (!selectedMusicUrl.startsWith('http') && !selectedMusicUrl.startsWith('data:') && !selectedMusicUrl.startsWith('blob:')) {
            console.warn('Invalid music URL:', selectedMusicUrl);
            return;
        }

        // Create audio element if it doesn't exist
        if (!musicAudioRef.current) {
            try {
                // Test if URL is accessible before creating Audio element
                const testUrl = selectedMusicUrl;
                
                // Validate URL before creating Audio element
                if (!testUrl || (!testUrl.startsWith('http') && !testUrl.startsWith('blob:') && !testUrl.startsWith('data:'))) {
                    console.warn('Invalid music URL format:', testUrl);
                    return;
                }
                
                // Create Audio element without src first, then set src after adding error handler
                const audio = new Audio();
                audio.volume = musicVolume;
                audio.loop = true;
                
                // Handle errors loading the audio - don't clear selection, just log warning
                const errorHandler = (e: Event) => {
                    console.warn('Music preview audio failed to load (this is okay - music will still be added when posting)');
                    // Don't clear selectedMusicUrl - keep it so track ID is still stored for posting
                    // Just mark that preview isn't available
                    if (audio) {
                        // Keep the ref but mark it as failed
                        (audio as any).__previewFailed = true;
                    }
                };
                
                audio.addEventListener('error', errorHandler);
                
                // Set src after adding error handler
                audio.src = testUrl;
                musicAudioRef.current = audio;
                
                // Also handle successful load
                const loadHandler = () => {
                    console.log('Music preview audio loaded successfully');
                    if (musicAudioRef.current) {
                        (musicAudioRef.current as any).__previewFailed = false;
                    }
                };
                
                musicAudioRef.current.addEventListener('loadeddata', loadHandler);
                
                // Try to load the audio (this will trigger error if URL is invalid)
                // Note: load() doesn't always return a Promise, so we handle it safely
                try {
                    const loadResult = musicAudioRef.current.load();
                    if (loadResult && typeof loadResult.catch === 'function') {
                        loadResult.catch((err: any) => {
                            console.warn('Could not load music preview (this is okay - music will still be added when posting):', err);
                            if (musicAudioRef.current) {
                                (musicAudioRef.current as any).__previewFailed = true;
                            }
                        });
                    }
                } catch (loadError) {
                    console.warn('Could not load music preview (this is okay - music will still be added when posting):', loadError);
                    if (musicAudioRef.current) {
                        (musicAudioRef.current as any).__previewFailed = true;
                    }
                }
            } catch (error) {
                console.warn('Could not create music preview audio (this is okay - music will still be added when posting):', error);
                // Don't clear selectedMusicUrl - keep selection for posting
                return;
            }
        } else {
            // Update volume if it changed
            musicAudioRef.current.volume = musicVolume;
        }

        const video = videoRef.current;
        const audio = musicAudioRef.current;
        
        // Ensure video is not muted and volume is set
        if (video.muted) {
            video.muted = false;
        }
        if (video.volume !== videoVolume) {
            video.volume = videoVolume;
        }

        // Sync play/pause
        const handlePlay = () => {
            if (audio.paused && !(audio as any).__previewFailed) {
                audio.currentTime = video.currentTime + musicStartTime;
                audio.play().catch((err) => {
                    console.warn('Could not play music preview (this is okay - music will still be added when posting):', err);
                });
            }
        };

        const handlePause = () => {
            if (!audio.paused) {
                audio.pause();
            }
        };

        const handleTimeUpdate = () => {
            // Keep audio in sync with video
            if (!audio.paused && Math.abs(audio.currentTime - (video.currentTime + musicStartTime)) > 0.5) {
                audio.currentTime = video.currentTime + musicStartTime;
            }
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);

        // Auto-start if video is playing
        if (!video.paused && !(audio as any).__previewFailed) {
            audio.currentTime = video.currentTime + musicStartTime;
            audio.play().catch((err) => {
                console.warn('Could not auto-play music preview (this is okay - music will still be added when posting):', err);
            });
        }
        
        // Also try to play when video starts (in case it wasn't playing when effect ran)
        const handleCanPlay = () => {
            if (!video.paused && audio.paused && !(audio as any).__previewFailed) {
                audio.currentTime = video.currentTime + musicStartTime;
                audio.play().catch((err) => {
                    console.warn('Could not play music on video canPlay (this is okay - music will still be added when posting):', err);
                });
            }
        };
        
        video.addEventListener('canplay', handleCanPlay);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('canplay', handleCanPlay);
            if (audio) {
                audio.pause();
            }
        };
    }, [selectedMusicUrl, musicVolume, musicStartTime]);

    // Cleanup audio on unmount
    React.useEffect(() => {
        return () => {
            if (musicAudioRef.current) {
                musicAudioRef.current.pause();
                musicAudioRef.current = null;
            }
        };
    }, []);

    // Auto-load music library when music category is selected
    React.useEffect(() => {
        if (selectedCategory === 'music' && libraryTracks.length === 0 && !libraryLoading) {
            console.log('🎵 Music category selected, loading tracks...');
            setLibraryLoading(true);
            (async () => {
                try {
                    // Try API first
                    console.log('🎵 Attempting to load music from API...');
                    const { getMusicLibrary } = await import('../api/music');
                    const result = await getMusicLibrary({});
                    console.log('🎵 API response:', result);
                    if (result.success && result.data) {
                        const tracks = Array.isArray(result.data) ? result.data : [];
                        console.log(`✅ Loaded ${tracks.length} music tracks from API`);
                        if (tracks.length > 0) {
                            setLibraryTracks(tracks);
                        } else {
                            console.warn('⚠️ API returned empty array, trying JSON fallback...');
                            throw new Error('API returned empty array');
                        }
                    } else {
                        throw new Error('API returned no data');
                    }
                } catch (error: any) {
                    console.warn('⚠️ Failed to load from API, trying JSON fallback:', error);
                    // Check if it's a network error (backend not running)
                    const isNetworkError = error?.message?.includes('Failed to fetch') || 
                                         error?.message?.includes('NetworkError') ||
                                         error?.message?.includes('Cannot connect');
                    
                    if (isNetworkError) {
                        console.warn('⚠️ Backend server appears to be offline. To use music library:');
                        console.warn('   1. Navigate to laravel-backend directory');
                        console.warn('   2. Run: php artisan serve');
                        console.warn('   3. Refresh this page');
                    }
                    
                    // Fallback to JSON file
                    try {
                        console.log('🎵 Attempting to load from royaltyFreeMusic.json...');
                        const res = await fetch('/royaltyFreeMusic.json');
                        console.log('🎵 JSON fetch response:', res.status, res.ok);
                        if (res.ok) {
                            const data = await res.json();
                            console.log('🎵 JSON data received:', data);
                            if (Array.isArray(data) && data.length > 0) {
                                // Transform JSON data to match API format
                                const transformed = data.map((track: any) => ({
                                    id: track.id,
                                    title: track.title,
                                    artist: track.artist || 'Unknown Artist',
                                    genre: track.genre || 'ambient',
                                    mood: track.mood || 'calm',
                                    url: track.src || track.url,
                                    preview_url: track.src || track.url,
                                    cover: track.cover || track.image,
                                    license_type: track.license_type || 'CC0',
                                    license_requires_attribution: track.license_requires_attribution || false,
                                }));
                                console.log(`✅ Loaded ${transformed.length} tracks from JSON fallback`);
                                setLibraryTracks(transformed);
                            } else {
                                console.error('❌ JSON file is empty or invalid format');
                            }
                        } else {
                            console.error('❌ Failed to fetch JSON file:', res.status, res.statusText);
                            console.warn('💡 Tip: The royaltyFreeMusic.json file is not in the public folder');
                        }
                    } catch (jsonError) {
                        console.error('❌ Failed to load from JSON fallback:', jsonError);
                    }
                } finally {
                    setLibraryLoading(false);
                    console.log('🎵 Music loading completed');
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategory]); // Only depend on selectedCategory to avoid infinite loops

    // Transition Preview Animation
    React.useEffect(() => {
        const canvas = transitionCanvasRef.current;
        if (!canvas || !selectedCategory || selectedCategory !== 'transitions') {
            // Clear canvas if not in transitions category
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, canvas.width || 400, canvas.height || 225);
                }
            }
            return;
        }
        
        if (clips.length < 2 || transitions.length === 0 || transitions[0]?.type === 'none') {
            // Clear canvas if no transition
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width || 400, canvas.height || 225);
            }
            return;
        }

        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        } else {
            canvas.width = 400;
            canvas.height = 225; // 16:9 aspect ratio
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Check if clips are images or videos
        const clipAIsImage = clips[0]?.mediaType === 'image' || clips[0]?.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
        const clipBIsImage = clips[1]?.mediaType === 'image' || clips[1]?.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);

        // Create elements for first two clips (video or image)
        const mediaA = clipAIsImage ? document.createElement('img') : document.createElement('video');
        const mediaB = clipBIsImage ? document.createElement('img') : document.createElement('video');
        
        mediaA.src = clips[0]?.url || '';
        mediaB.src = clips[1]?.url || '';
        
        if (!clipAIsImage) {
            (mediaA as HTMLVideoElement).muted = true;
            (mediaA as HTMLVideoElement).playsInline = true;
            (mediaA as HTMLVideoElement).preload = 'metadata';
        }
        
        if (!clipBIsImage) {
            (mediaB as HTMLVideoElement).muted = true;
            (mediaB as HTMLVideoElement).playsInline = true;
            (mediaB as HTMLVideoElement).preload = 'metadata';
        }

        let progress = 0;
        let animationId: number | null = null;
        let framesLoaded = 0;

        const loadHandler = () => {
            framesLoaded++;
            if (framesLoaded === 2) {
                // Both media loaded
                if (clipAIsImage && clipBIsImage) {
                    // Both are images, start animation immediately
                    startAnimation();
                } else {
                    // At least one is video, seek to middle
                    if (!clipAIsImage && (mediaA as HTMLVideoElement).duration > 0) {
                        (mediaA as HTMLVideoElement).currentTime = Math.min((mediaA as HTMLVideoElement).duration * 0.5, (mediaA as HTMLVideoElement).duration - 0.1);
                    } else {
                        framesLoaded++; // Skip seek for image
                    }
                    if (!clipBIsImage && (mediaB as HTMLVideoElement).duration > 0) {
                        (mediaB as HTMLVideoElement).currentTime = Math.min((mediaB as HTMLVideoElement).duration * 0.5, (mediaB as HTMLVideoElement).duration - 0.1);
                    } else {
                        framesLoaded++; // Skip seek for image
                    }
                }
            }
        };

        const seekedHandler = () => {
            framesLoaded++;
            if (framesLoaded >= 4 || (clipAIsImage && clipBIsImage)) {
                startAnimation();
            }
        };

        const startAnimation = () => {
            const animate = () => {
                if (!ctx || !canvas) return;
                
                progress += 0.02; // Animate from 0 to 1
                if (progress > 1) progress = 0; // Loop
                
                const transitionType = transitions[0]?.type || 'fade';
                
                // Draw transition based on type
                if (transitionType === 'fade' || transitionType === 'crossfade' || transitionType === 'fadeblack' || transitionType === 'fadewhite') {
                    drawFade(ctx, mediaA, mediaB, progress);
                } else if (transitionType === 'zoom' || transitionType === 'zoomin' || transitionType === 'zoomout') {
                    drawZoom(ctx, mediaA, mediaB, progress);
                } else if (transitionType.includes('slide') || transitionType.includes('wipe')) {
                    drawSwipe(ctx, mediaA, mediaB, progress);
                } else {
                    // Default to fade
                    drawFade(ctx, mediaA, mediaB, progress);
                }
                
                animationId = requestAnimationFrame(animate);
            };
            animate();
        };

        mediaA.addEventListener('load', loadHandler);
        mediaB.addEventListener('load', loadHandler);
        if (!clipAIsImage) {
            (mediaA as HTMLVideoElement).addEventListener('loadeddata', loadHandler);
            (mediaA as HTMLVideoElement).addEventListener('seeked', seekedHandler);
            (mediaA as HTMLVideoElement).load();
        }
        if (!clipBIsImage) {
            (mediaB as HTMLVideoElement).addEventListener('loadeddata', loadHandler);
            (mediaB as HTMLVideoElement).addEventListener('seeked', seekedHandler);
            (mediaB as HTMLVideoElement).load();
        }
        
        // Store refs for cleanup
        transitionPreviewRef.current = { 
            videoA: clipAIsImage ? null : (mediaA as HTMLVideoElement), 
            videoB: clipBIsImage ? null : (mediaB as HTMLVideoElement), 
            animationId 
        };

        return () => {
            // Cleanup
            if (animationId !== null) {
                cancelAnimationFrame(animationId);
            }
            mediaA.removeEventListener('load', loadHandler);
            mediaB.removeEventListener('load', loadHandler);
            if (!clipAIsImage) {
                (mediaA as HTMLVideoElement).removeEventListener('loadeddata', loadHandler);
                (mediaA as HTMLVideoElement).removeEventListener('seeked', seekedHandler);
                (mediaA as HTMLVideoElement).src = '';
            }
            if (!clipBIsImage) {
                (mediaB as HTMLVideoElement).removeEventListener('loadeddata', loadHandler);
                (mediaB as HTMLVideoElement).removeEventListener('seeked', seekedHandler);
                (mediaB as HTMLVideoElement).src = '';
            }
            mediaA.src = '';
            mediaB.src = '';
            transitionPreviewRef.current = { videoA: null, videoB: null, animationId: null };
        };
    }, [clips, transitions, selectedCategory]);

    // Initialize AudioContext when music is selected
    React.useEffect(() => {
        if (selectedMusicUrl && !audioContext) {
            try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                setAudioContext(ctx);
            } catch (error) {
                console.warn('Web Audio API not supported:', error);
            }
        }
    }, [selectedMusicUrl, audioContext]);

    // Setup Web Audio API for waveform visualization
    React.useEffect(() => {
        if (musicAudioRef.current && selectedMusicUrl && audioContext && audioAnalyser && isMusicPlaying) {
            const bufferLength = audioAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const waveCount = 20;

            const tick = () => {
                if (!audioAnalyser || !musicAudioRef.current || musicAudioRef.current.paused) {
                    setIsMusicPlaying(false);
                    if (waveformAnimationRef.current) {
                        cancelAnimationFrame(waveformAnimationRef.current);
                        waveformAnimationRef.current = null;
                    }
                    return;
                }

                audioAnalyser.getByteFrequencyData(dataArray);

                // Update wave heights
                const step = Math.floor(bufferLength / waveCount);
                const newHeights: number[] = [];
                for (let i = 0; i < waveCount; i++) {
                    const idx = i * step;
                    let sum = 0;
                    for (let j = 0; j < step; j++) {
                        sum += dataArray[idx + j] || 0;
                    }
                    newHeights[i] = 4 + (sum / step / 255) * 40;
                }
                setWaveHeights(newHeights);

                // Calculate bass level with smoothing
                let bassSum = 0;
                const bassBins = Math.min(5, bufferLength);
                for (let b = 0; b < bassBins; b++) {
                    bassSum += dataArray[b];
                }
                const bassAvg = bassSum / (bassBins * 255);
                setBassLevel(prev => Math.min(1, prev * 0.8 + bassAvg * 0.2));

                waveformAnimationRef.current = requestAnimationFrame(tick);
            };

            tick();

            return () => {
                if (waveformAnimationRef.current) {
                    cancelAnimationFrame(waveformAnimationRef.current);
                    waveformAnimationRef.current = null;
                }
            };
        }
    }, [selectedMusicUrl, audioContext, audioAnalyser, isMusicPlaying]);

    // Handle trim handle dragging
    React.useEffect(() => {
        if (!isDraggingTrimHandle) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!trimTimelineRef.current) return;

            const rect = trimTimelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));

            if (selectedClipForTrim !== null && clips[selectedClipForTrim]) {
                // Multi-clip mode
                const clip = clips[selectedClipForTrim];
                const clipDuration = clip.duration;
                const newTime = percentage * clipDuration;

                if (isDraggingTrimHandle === 'start') {
                    const newStart = Math.max(0, Math.min(newTime, clip.trimEnd - 0.1));
                    setClips(prev => prev.map((c, i) =>
                        i === selectedClipForTrim
                            ? { ...c, trimStart: newStart }
                            : c
                    ));
                } else if (isDraggingTrimHandle === 'end') {
                    const newEnd = Math.max(clip.trimStart + 0.1, Math.min(newTime, clipDuration));
                    setClips(prev => prev.map((c, i) =>
                        i === selectedClipForTrim
                            ? { ...c, trimEnd: newEnd }
                            : c
                    ));
                }
            } else {
                // Single clip mode
                if (videoDuration === 0) return;
                const newTime = percentage * videoDuration;

                if (isDraggingTrimHandle === 'start') {
                    const newStart = Math.max(0, Math.min(newTime, trimEnd - 0.1));
                    setTrimStart(newStart);
                } else if (isDraggingTrimHandle === 'end') {
                    const newEnd = Math.max(trimStart + 0.1, Math.min(newTime, videoDuration));
                    setTrimEnd(newEnd);
                }
            }
        };

        const handleMouseUp = () => {
            setIsDraggingTrimHandle(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingTrimHandle, videoDuration, trimStart, trimEnd, selectedClipForTrim, clips]);

    React.useEffect(() => {
        // Log for debugging
        console.log('📹 InstantFiltersPage - State received:', {
            videoUrl: videoUrl?.substring(0, 50),
            videoDuration,
            mediaType,
            isImage,
            hasState: !!state,
            stateKeys: state ? Object.keys(state) : [],
            clips: state?.clips?.length || 0
        });

        if (!videoUrl) {
            console.warn('⚠️ No videoUrl found, redirecting to instant create page');
            navigate('/create/instant', { replace: true });
            return;
        }

        let newVideoUrl: string | undefined = videoUrl;
        let newClips: Clip[] = clips;

        // Always recreate blob URLs from stored blobs to ensure they're valid
        if (videoUrl && videoUrl.startsWith('blob:')) {
            const stateClips = (state as LocationState)?.clips;

            // If we have clips with blobs, recreate URLs immediately
            if (stateClips && stateClips.length > 0) {
                // Recreate main video URL from first clip's blob
                if (stateClips[0].blob) {
                    console.log('✅ Found blob in clips, recreating blob URL...');
                    newVideoUrl = URL.createObjectURL(stateClips[0].blob);
                    console.log('✅ Recreated blob URL:', newVideoUrl.substring(0, 50));
                } else {
                    // No blob stored, try to use provided URL but it might be invalid
                    console.warn('⚠️ No blob stored in first clip, blob URL may be invalid');
                }

                // Recreate blob URLs for all clips that have stored blobs
                newClips = stateClips.map((clip, idx) => {
                    if (clip.blob) {
                        // Always recreate blob URL from stored blob
                        const newUrl = URL.createObjectURL(clip.blob);
                        console.log(`✅ Recreated blob URL for clip ${idx + 1}:`, clip.id.substring(0, 10));
                        return { ...clip, url: newUrl };
                    } else if (clip.url.startsWith('blob:')) {
                        // Clip has blob URL but no stored blob - this will likely fail
                        console.warn(`⚠️ Clip ${idx + 1} has blob URL but no stored blob - may fail to load`);
                        return clip;
                    }
                    return clip;
                });
            } else {
                // No clips array, try to use provided URL (might be invalid)
                console.warn('⚠️ No clips array found, using provided blob URL (may be invalid)');
            }
        }

        // Update state
        if (newVideoUrl !== videoUrl) {
            setActualVideoUrl(newVideoUrl);
        }
        if (newClips !== clips && newClips.length > 0) {
            setClips(newClips);
        }

        // Cleanup function to revoke blob URLs when component unmounts or dependencies change
        return () => {
            // Revoke old video URL if it was a blob
            if (actualVideoUrl && actualVideoUrl.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(actualVideoUrl);
                } catch (e) {
                    // Ignore errors
                }
            }
            // Revoke all clip blob URLs
            clips.forEach(clip => {
                if (clip.url && clip.url.startsWith('blob:')) {
                    try {
                        URL.revokeObjectURL(clip.url);
                    } catch (e) {
                        // Ignore errors
                    }
                }
            });
        };
    }, [videoUrl, navigate, isImage, mediaType, videoDuration, state]);

    // Load templates on mount
    React.useEffect(() => {
        const loadTemplates = async () => {
            try {
                const fetchedTemplates = await getTemplates('Gazetteer');
                setTemplates(fetchedTemplates);
                // Default to first template (Gazetteer)
                if (fetchedTemplates.length > 0) {
                    setSelectedTemplate(fetchedTemplates[0]);
                }
            } catch (err) {
                console.error('Error loading templates:', err);
            }
        };
        loadTemplates();
    }, []);

    if (!actualVideoUrl) {
        console.error('❌ InstantFiltersPage - No videoUrl found!', {
            state,
            videoUrl,
            actualVideoUrl,
            location: window.location.href
        });
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">No video found. Redirecting...</p>
                    <p className="text-xs text-gray-400 mt-2">Check console for details</p>
                </div>
            </div>
        );
    }

    console.log('✅ InstantFiltersPage - Rendering preview with:', {
        videoUrl: actualVideoUrl.substring(0, 50),
        isImage,
        mediaType,
        hasVideoRef: !!videoRef.current
    });

    // Minimal WebGL setup with a few filters
    React.useEffect(() => {
        if (!actualVideoUrl) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) {
            // Wait a bit for refs to be ready
            const timer = setTimeout(() => {
                if (videoRef.current && canvasRef.current) {
                    // Retry initialization
                }
            }, 100);
            return () => clearTimeout(timer);
        }

        let gl: WebGLRenderingContext | null = null;
        try {
            gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        } catch (e) {
            console.error('WebGL context error:', e);
        }

        if (!gl) {
            // Fallback: keep native video visible if no WebGL
            setWebglOk(false);
            try { video.play().catch(() => { }); } catch { }
            return;
        } else {
            setWebglOk(true);
        }
        glRef.current = gl;

        try {
            // Vertex shader - flip Y coordinate to fix upside down video
            const vsrc = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_tex;
void main() {
  v_tex = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

            // Fragment shader base with adjustable uniforms
            const fsrc = `
precision mediump float;
uniform sampler2D u_tex;
uniform sampler2D u_lut;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_hue;
uniform int u_mode; // 0 none, 1 bw, 2 sepia, 3 vivid, 4 cool, 5 vignette, 6 beauty
uniform vec2 u_resolution; // For beauty filter sampling
uniform int u_hasLut;
uniform float u_lutSize;  // e.g., 16.0
uniform float u_lutTiles; // e.g., 4.0 when 16 levels and 4x4 tiles
uniform float u_lutAmount; // 0..1 blend
varying vec2 v_tex;

vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0., -1./3., 2./3., -1.);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.*d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1., 2./3., 1./3., 3.);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6. - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y);
}

void main(){
  vec4 tex = texture2D(u_tex, v_tex);
  vec3 col = tex.rgb;

  // hue/sat
  vec3 hsv = rgb2hsv(col);
  hsv.x = fract(hsv.x + u_hue); // hue rotate 0..1
  hsv.y *= u_saturation;
  col = hsv2rgb(hsv);

  // brightness/contrast
  col = (col - 0.5) * u_contrast + 0.5;
  col *= u_brightness;

  if (u_mode == 1) {
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    col = vec3(g);
  } else if (u_mode == 2) {
    col = vec3(
      dot(col, vec3(0.393, 0.769, 0.189)),
      dot(col, vec3(0.349, 0.686, 0.168)),
      dot(col, vec3(0.272, 0.534, 0.131))
    );
  } else if (u_mode == 3) {
    col = clamp(col * vec3(1.1, 1.05, 1.2), 0.0, 1.0);
  } else if (u_mode == 4) {
    // cool tone by shifting hue slightly already covered; add slight blue boost
    col = clamp(col + vec3(-0.03, -0.01, 0.06), 0.0, 1.0);
  } else if (u_mode == 5) {
    vec2 uv = v_tex - 0.5;
    float d = length(uv) * 1.2;
    float vignette = smoothstep(1.0, u_brightness + 0.2 + 0.6, d);
    col *= (1.0 - vignette);
  } else if (u_mode == 6) {
    // Beauty filter: skin smoothing using simple gaussian-like blur
    vec2 texelSize = 1.0 / u_resolution;
    vec3 beauty = vec3(0.0);
    float total = 0.0;
    // Simple 3x3 kernel for skin smoothing
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y)) * texelSize * 2.0;
        vec3 sample = texture2D(u_tex, v_tex + offset).rgb;
        // Weight by distance from center (gaussian-like)
        float weight = 1.0 / (1.0 + (abs(float(x)) + abs(float(y))) * 0.5);
        beauty += sample * weight;
        total += weight;
      }
    }
    beauty /= total;
    // Mix original with smoothed (70% smooth, 30% original for natural look)
    col = mix(col, beauty, 0.7);
    // Slight boost to skin tones (warm colors)
    col = mix(col, col * vec3(1.05, 1.02, 0.98), 0.3);
  }

  // 3D LUT sampling from tiled 2D texture (size x size tiles, each tile size x size)
  if (u_hasLut == 1 && u_lutAmount > 0.0) {
    float size = u_lutSize; // e.g., 16
    float tiles = u_lutTiles; // e.g., 4 when 16 levels
    // Clamp input color to [0,1]
    vec3 c = clamp(col, 0.0, 1.0);
    float blueIndex = c.b * (size - 1.0);
    float sliceX = mod(blueIndex, tiles);
    float sliceY = floor(blueIndex / tiles);
    // inner coords within tile (add half texel offset)
    vec2 tileScale = vec2(1.0 / (tiles * size));
    vec2 pix = c.rg * (size - 1.0) + 0.5;
    vec2 uv = (vec2(sliceX, sliceY) * size + pix) * tileScale;
    vec3 lutColor = texture2D(u_lut, uv).rgb;
    col = mix(col, lutColor, u_lutAmount);
  }

  gl_FragColor = vec4(col, tex.a);
}`;

            function compile(type: number, src: string): WebGLShader | null {
                const s = gl.createShader(type);
                if (!s) return null;
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                    const error = gl.getShaderInfoLog(s);
                    console.error('Shader compile error:', error);
                    gl.deleteShader(s);
                    return null;
                }
                return s;
            }
            const vs = compile(gl.VERTEX_SHADER, vsrc);
            const fs = compile(gl.FRAGMENT_SHADER, fsrc);
            if (!vs || !fs) {
                throw new Error('Failed to compile shaders');
            }
            const prog = gl.createProgram();
            if (!prog) {
                throw new Error('Failed to create program');
            }
            gl.attachShader(prog, vs);
            gl.attachShader(prog, fs);
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                const error = gl.getProgramInfoLog(prog);
                console.error('Program link error:', error);
                gl.deleteProgram(prog);
                throw new Error('Failed to link program');
            }
            gl.useProgram(prog);

            // Quad
            const posBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1, -1, 0, 0,
                1, -1, 1, 0,
                -1, 1, 0, 1,
                1, 1, 1, 1,
            ]), gl.STATIC_DRAW);
            const a_position = gl.getAttribLocation(prog, 'a_position');
            const a_texCoord = gl.getAttribLocation(prog, 'a_texCoord');
            gl.enableVertexAttribArray(a_position);
            gl.enableVertexAttribArray(a_texCoord);
            gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
            gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);

            // Texture from video
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            const u_brightness = gl.getUniformLocation(prog, 'u_brightness');
            const u_contrast = gl.getUniformLocation(prog, 'u_contrast');
            const u_saturation = gl.getUniformLocation(prog, 'u_saturation');
            const u_hue = gl.getUniformLocation(prog, 'u_hue');
            const u_mode = gl.getUniformLocation(prog, 'u_mode');
            const u_hasLut = gl.getUniformLocation(prog, 'u_hasLut');
            const u_lutSize = gl.getUniformLocation(prog, 'u_lutSize');
            const u_lutTiles = gl.getUniformLocation(prog, 'u_lutTiles');
            const u_lutAmount = gl.getUniformLocation(prog, 'u_lutAmount');
            const u_resolution = gl.getUniformLocation(prog, 'u_resolution');

            // Bind texture units
            gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_lut'), 1);

            function modeToInt(m: ShaderId): number {
                switch (m) {
                    case 'beauty': return 6;
                    case 'bw': return 1;
                    case 'sepia': return 2;
                    case 'vivid': return 3;
                    case 'cool': return 4;
                    case 'vignette': return 5;
                    default: return 0;
                }
            }

            const render = () => {
                // Get dimensions from parent container or use video dimensions
                const container = canvas.parentElement;
                let w = canvas.clientWidth;
                let h = canvas.clientHeight;

                // If client dimensions are 0, try to get from container or video
                if (w === 0 || h === 0) {
                    if (container) {
                        const rect = container.getBoundingClientRect();
                        w = rect.width || 400;
                        h = rect.height || 711;
                    } else if (video.videoWidth > 0 && video.videoHeight > 0) {
                        // Use video dimensions, maintaining aspect ratio
                        const aspect = video.videoWidth / video.videoHeight;
                        w = 400;
                        h = w / aspect;
                    } else {
                        // Fallback dimensions
                        w = 400;
                        h = 711;
                    }
                }

                if (w === 0 || h === 0) {
                    rafRef.current = requestAnimationFrame(render);
                    return;
                }
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                    gl.viewport(0, 0, w, h);
                }
                // Update texture from current video frame
                // Only update if video is ready and has valid dimensions
                if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
                    try {
                        gl.activeTexture(gl.TEXTURE0);
                        gl.bindTexture(gl.TEXTURE_2D, tex);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                    } catch (e) {
                        // Silently ignore texture errors - video might not be ready yet
                        console.warn('WebGL texture update error (will retry):', e);
                    }
                }
                // Ensure program is active
                gl.useProgram(prog);
                // Set all uniforms
                gl.uniform1f(u_brightness, brightness);
                gl.uniform1f(u_contrast, contrast);
                gl.uniform1f(u_saturation, saturation);
                gl.uniform1f(u_hue, hue);
                gl.uniform2f(u_resolution, w, h);
                const modeVal = modeToInt(active);
                gl.uniform1i(u_mode, modeVal);
                if (lutTextureRef.current && lutMeta) {
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D, lutTextureRef.current);
                    gl.uniform1i(u_hasLut, 1);
                    gl.uniform1f(u_lutSize, lutMeta.size);
                    gl.uniform1f(u_lutTiles, lutMeta.tiles);
                    gl.uniform1f(u_lutAmount, lutAmount);
                    gl.activeTexture(gl.TEXTURE0);
                } else {
                    gl.uniform1i(u_hasLut, 0);
                    gl.uniform1f(u_lutAmount, 0.0);
                }
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                rafRef.current = requestAnimationFrame(render);
            };

            // Start render loop immediately
            const startRender = () => {
                if (rafRef.current == null) {
                    video.play().catch(() => { });
                    render();
                }
            };

            video.onloadedmetadata = startRender;
            video.onplay = startRender;

            // Try to start rendering immediately if video is ready
            if (video.readyState >= 2) {
                startRender();
            } else {
                try { video.play().catch(() => { }); } catch { }
            }
        } catch (error) {
            console.error('WebGL initialization error:', error);
            setWebglOk(false);
            // Fallback to native video
            try {
                const video = videoRef.current;
                if (video) {
                    video.play().catch(() => { });
                }
            } catch { }
        }

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [active, brightness, contrast, saturation, hue, videoUrl, lutAmount, lutMeta]);


    async function onPickLut(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const gl = glRef.current;
            if (!gl) return;
            // Heuristic: assume square texture with tiles x tiles tiles, where tiles = sqrt(width / size)
            // We try common 16-level LUT: width == height and divisible by 16.
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            try { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); } catch { }
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            lutTextureRef.current = tex;
            // Determine size/tiles. Assume texture is (size*tiles) x (size*tiles), with tiles = sqrt(size)
            const w = img.width;
            // Try size candidates 16, 32
            let size = 16;
            if (w % 32 === 0) size = 32; // prefer higher
            const tiles = Math.sqrt(w / size);
            const valid = Number.isFinite(tiles) && Math.round(tiles) === tiles;
            setLutMeta(valid ? { size, tiles: tiles as number } : { size: 16, tiles: 4 });
            lutImageRef.current = img;
            URL.revokeObjectURL(url);
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
    }

    function loadBuiltinLut(item: BuiltinLut) {
        setSelectedBuiltin(item);
        if (!item.url) {
            lutTextureRef.current = null;
            setLutMeta(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const gl = glRef.current;
            if (!gl) return;
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            try { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); } catch { }
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            lutTextureRef.current = tex;
            if (item.size && item.tiles) {
                setLutMeta({ size: item.size, tiles: item.tiles });
            } else {
                const w = img.width;
                let size = 16;
                if (w % 32 === 0) size = 32;
                const tiles = Math.sqrt(w / size);
                const valid = Number.isFinite(tiles) && Math.round(tiles) === tiles;
                setLutMeta(valid ? { size, tiles: tiles as number } : { size: 16, tiles: 4 });
            }
        };
        img.onerror = () => {
            console.warn('Failed to load LUT:', item.url);
            // Clear LUT on error - continue without LUT
            lutTextureRef.current = null;
            setLutMeta(null);
            setLutAmount(0);
        };
        img.src = item.url;
    }

    async function handleExport(): Promise<string | null> {
        if (!canvasRef.current || !videoRef.current) return null;
        setExportUrl(null);
        setExporting(true);
        const canvas = canvasRef.current;
        const video = videoRef.current;

        try {
            // Ensure playback from start and disable looping during export
            video.currentTime = 0;
            const wasLooping = video.loop;
            video.loop = false; // Disable loop during export

            // Wait for video to be ready and render loop to have rendered at least one frame
            await new Promise(resolve => {
                if (video.readyState >= 2) {
                    resolve(null);
                } else {
                    video.onloadeddata = () => resolve(null);
                }
            });

            // Ensure video plays and progresses
            await video.play();

            // Wait for video to actually start playing
            await new Promise<void>((resolve) => {
                if (!video.paused && video.currentTime > 0) {
                    resolve();
                    return;
                }
                const checkPlaying = setInterval(() => {
                    if (!video.paused && video.currentTime > 0) {
                        clearInterval(checkPlaying);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkPlaying);
                    resolve(); // Continue anyway
                }, 1000);
            });

            // Ensure video is actually playing
            if (video.paused) {
                console.warn('Video failed to play, retrying...');
                await video.play().catch(err => {
                    console.error('Video play error:', err);
                    throw new Error('Video failed to play');
                });
            }

            console.log('Video is playing', { currentTime: video.currentTime, paused: video.paused, readyState: video.readyState });

            // Wait for video to be ready and WebGL render loop to have rendered frames
            // Check if render loop is running and video is ready
            let framesWaited = 0;
            const maxFrames = 30; // Wait up to 30 frames (~0.5 seconds at 60fps)
            await new Promise<void>((resolve) => {
                const checkReady = () => {
                    const gl = glRef.current;
                    const isRenderLoopRunning = rafRef.current !== null;
                    const isVideoReady = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
                    const isVideoPlaying = !video.paused && video.currentTime > 0;

                    if (isRenderLoopRunning && isVideoReady && isVideoPlaying) {
                        framesWaited++;
                        if (framesWaited >= 5) { // Wait for 5 frames to ensure stable rendering
                            console.log('WebGL render loop is running, video is ready, starting export');
                            resolve();
                            return;
                        }
                    }

                    if (framesWaited >= maxFrames) {
                        console.warn('Timeout waiting for WebGL to be ready, proceeding anyway');
                        resolve();
                        return;
                    }

                    requestAnimationFrame(checkReady);
                };
                // Start checking after a short delay
                setTimeout(() => checkReady(), 100);
            });

            // Double-check video is playing
            if (video.paused) {
                throw new Error('Video is not playing, cannot export');
            }

            console.log('Video is ready for export', {
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
            });

            // Temporarily disable LUT during export to prevent timeout issues
            const originalLutAmount = lutAmount;
            const originalLutMeta = lutMeta;
            if (lutAmount > 0 || lutMeta) {
                console.log('Temporarily disabling LUT during export to prevent timeout');
                // The LUT will be disabled by not passing it to the shader, but we need to ensure
                // the render loop doesn't try to use it. We'll rely on the shader's u_hasLut check.
            }

            // Get video duration for timeout
            const videoDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 60; // Fallback to 60 seconds if unknown
            // Timeout: video duration * 3 (to account for encoding overhead and processing), max 60 seconds
            const maxExportTime = Math.min(videoDuration * 3000, 60000);
            console.log('Export starting', { videoDuration, maxExportTime, hasLut: !!lutMeta, lutAmount });

            // Skip AR filters during export for now - they can cause timeout issues
            // Export just the WebGL canvas (which has color filters)
            // AR filters will be applied in real-time on the preview only
            console.log('Exporting WebGL canvas (color filters only, AR filters skipped during export)');

            // Simple approach: directly capture stream from WebGL canvas
            console.log('Exporting WebGL canvas directly');
            console.log('Canvas state before export:', {
                width: canvas.width,
                height: canvas.height,
                renderLoopActive: rafRef.current !== null,
                videoPlaying: !video.paused,
                videoCurrentTime: video.currentTime
            });

            // Ensure render loop is running
            if (rafRef.current === null) {
                console.warn('Render loop not running, attempting to start...');
                // Try to trigger render
                if (video.readyState >= 2) {
                    const render = () => {
                        const gl = glRef.current;
                        if (!gl || !videoRef.current || !canvasRef.current) return;
                        const video = videoRef.current;
                        const canvas = canvasRef.current;
                        // This will be handled by the existing render loop
                    };
                    // The render loop should start automatically
                }
            }

            const stream = canvas.captureStream(24); // lower FPS for faster encode
            console.log('Stream created:', {
                active: stream.active,
                id: stream.id,
                getTracks: stream.getVideoTracks().length
            });

            // Verify stream has tracks
            const tracks = stream.getVideoTracks();
            if (tracks.length === 0) {
                console.error('Stream has no video tracks!');
                throw new Error('Export stream has no video tracks');
            }
            console.log('Stream has', tracks.length, 'video track(s)');

            const chunks: BlobPart[] = [];

            // Try different codecs for better compatibility
            let mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=vp8';
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
            }

            const mr = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 1400000 // lower bitrate to speed up processing
            });

            let chunksReceived = 0;
            mr.ondataavailable = e => {
                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                    chunksReceived++;
                    console.log(`Chunk ${chunksReceived} received:`, e.data.size, 'bytes, total chunks:', chunks.length);
                }
            };

            const done = new Promise<void>((resolve) => {
                mr.onstop = () => {
                    console.log('MediaRecorder stopped, chunks:', chunks.length);
                    resolve();
                };
            });

            const timeoutId = setTimeout(() => {
                console.warn('Export timeout, stopping MediaRecorder');
                if (mr.state !== 'inactive') {
                    mr.stop();
                }
            }, maxExportTime);

            mr.start(1000); // Request data every second
            console.log('MediaRecorder started', {
                mimeType,
                state: mr.state,
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length,
                streamActive: stream.active
            });

            // Ensure video is playing
            if (video.paused) {
                console.log('Video was paused, resuming...');
                await video.play();
            }

            // Check if chunks are being received after a few seconds
            const chunkCheckTimeout = setTimeout(() => {
                if (chunksReceived === 0 && mr.state === 'recording') {
                    console.error('No chunks received after 3 seconds - export may be failing');
                    console.log('Video state:', {
                        paused: video.paused,
                        currentTime: video.currentTime,
                        readyState: video.readyState,
                        ended: video.ended
                    });
                    console.log('Canvas state:', {
                        width: canvas.width,
                        height: canvas.height,
                        renderLoop: rafRef.current !== null
                    });
                }
            }, 3000);

            // Wait for video to end
            const onEnded = () => {
                console.log('Video ended, stopping export');
                clearTimeout(timeoutId);
                clearTimeout(chunkCheckTimeout);
                if (mr.state !== 'inactive') {
                    mr.requestData();
                    mr.stop();
                }
            };
            video.addEventListener('ended', onEnded, { once: true });

            // Also check if video has reached end
            const checkVideoEnd = setInterval(() => {
                // Ensure video keeps playing
                if (video.paused && !video.ended) {
                    console.warn('Video paused during export, resuming...');
                    video.play().catch(err => console.error('Failed to resume video:', err));
                }

                if (video.ended || (video.currentTime >= videoDuration - 0.1 && videoDuration > 0)) {
                    clearInterval(checkVideoEnd);
                    clearTimeout(timeoutId);
                    clearTimeout(chunkCheckTimeout);
                    if (mr.state !== 'inactive') {
                        mr.requestData();
                        mr.stop();
                    }
                }
            }, 100);

            await done;
            clearTimeout(timeoutId);
            clearInterval(checkVideoEnd);

            console.log('Export finished', {
                chunks: chunks.length,
                totalSize: chunks.reduce((sum, chunk) => sum + (chunk instanceof Blob ? chunk.size : (chunk as any).length || 0), 0),
                videoDuration,
                videoEnded: video.ended
            });

            if (chunks.length === 0) {
                console.error('No chunks recorded');
                throw new Error('Export failed: No video data recorded');
            }

            const totalSize = chunks.reduce((sum, chunk) => sum + (chunk instanceof Blob ? chunk.size : (chunk as any).length || 0), 0);
            if (totalSize < 1000) { // Less than 1KB probably means no real data
                console.error('Export chunks too small:', totalSize);
                throw new Error('Export failed: Video data too small');
            }

            const blob = new Blob(chunks, { type: mimeType });

            // Verify blob is valid and has content
            if (blob.size < 1000) {
                console.error('Export blob too small:', blob.size);
                throw new Error('Export failed: Blob too small');
            }

            const url = URL.createObjectURL(blob);
            console.log('Export complete successfully', {
                blobSize: blob.size,
                url: url.substring(0, 50) + '...',
                chunks: chunks.length,
                mimeType
            });

            // Verify the blob URL works by creating a video element
            const testVideo = document.createElement('video');
            testVideo.src = url;
            testVideo.onerror = () => {
                console.error('Exported blob URL is invalid');
                URL.revokeObjectURL(url);
            };

            setExportUrl(url);
            return url;
        } catch (e) {
            console.error(e);
            return null;
        } finally {
            // Restore loop setting
            if (videoRef.current) {
                videoRef.current.loop = wasLooping;
            }
            setExporting(false);
        }
    }

    // Build a CSS filter string that approximates the selected adjustments
    function getCssFilterString(): string {
        const parts: string[] = [];
        // Base filters by selection
        if (active === 'bw') parts.push('grayscale(1)');
        else if (active === 'sepia') parts.push('sepia(0.8)');
        else if (active === 'vivid') parts.push('saturate(1.6) contrast(1.1)');
        else if (active === 'cool') parts.push('hue-rotate(200deg) saturate(1.2)');
        // Adjustments
        if (brightness !== 1) parts.push(`brightness(${brightness})`);
        if (contrast !== 1) parts.push(`contrast(${contrast})`);
        if (saturation !== 1) parts.push(`saturate(${saturation})`);
        if (hue !== 0) parts.push(`hue-rotate(${hue * 360}deg)`);
        return parts.join(' ');
    }

    // Fallback exporter using 2D canvas + CSS filters; robust across devices
    async function exportWithCanvas2D(): Promise<string | null> {
        try {
            const v = videoRef.current;
            if (!v) return null;
            // Ensure metadata
            await new Promise<void>((resolve) => {
                if (v.readyState >= 1) return resolve();
                const on = () => { v.removeEventListener('loadedmetadata', on); resolve(); };
                v.addEventListener('loadedmetadata', on);
                setTimeout(() => { v.removeEventListener('loadedmetadata', on); resolve(); }, 2000);
            });

            const canvas = document.createElement('canvas');
            // Downscale to a reasonable max dimension (longest side 720px) to speed up export
            const srcW = v.videoWidth || 720;
            const srcH = v.videoHeight || 1280;
            const longSide = Math.max(srcW, srcH);
            const scale = longSide > 720 ? 720 / longSide : 1;
            canvas.width = Math.round(srcW * scale);
            canvas.height = Math.round(srcH * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            const filterStr = getCssFilterString();

            const stream = canvas.captureStream(24); // 24fps for faster encode
            let mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
            const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1200000 });
            const chunks: BlobPart[] = [];
            mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
            const done = new Promise<void>((resolve) => { mr.onstop = () => resolve(); });

            // Draw loop
            let lastTime = -1;
            let stopRequested = false;
            const draw = () => {
                if (!ctx || !v) return;
                if (stopRequested) return;
                // Only draw when frame time increases to avoid duplicates
                if (v.currentTime !== lastTime) {
                    ctx.filter = filterStr || 'none';
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    lastTime = v.currentTime;
                }
                if (v.ended) {
                    stopRequested = true;
                    if (mr.state !== 'inactive') mr.stop();
                    return;
                }
                requestAnimationFrame(draw);
            };

            // Start
            v.currentTime = 0;
            v.loop = false;
            mr.start(500);
            await v.play();
            requestAnimationFrame(draw);

            // Safety timeout: at most duration * 2 or 20s
            const duration = (isFinite(v.duration) && v.duration > 0) ? v.duration : 10;
            const safety = setTimeout(() => {
                if (mr.state === 'recording') mr.stop();
            }, Math.min(20000, duration * 2000));

            await done;
            clearTimeout(safety);

            if (chunks.length === 0) return null;
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size < 1000) return null;
            const url = URL.createObjectURL(blob);
            setExportUrl(url);
            return url;
        } catch (err) {
            console.error('Canvas2D export failed:', err);
            return null;
        }
    }

    function hasFiltersApplied(): boolean {
        return active !== 'none' || brightness !== 1.0 || contrast !== 1.0 || saturation !== 1.0 || hue !== 0.0 || lutAmount > 0;
    }

    function finalVideoUrl(): string | null {
        return exportUrl || videoUrl || null;
    }

    async function handleSendToFeed() {
        if (postingFeed || postingClips) return;
        setPostingFeed(true);
        console.log('handleSendToFeed called', { videoUrl, exportUrl, hasFilters: hasFiltersApplied(), exporting, active, brightness, contrast, saturation });
        if (!videoUrl) {
            console.error('No videoUrl available');
            setExporting(false);
            setPostingFeed(false);
            return;
        }

        // If already exporting, don't start another export
        if (exporting) {
            console.log('Already exporting, waiting...');
            setPostingFeed(false);
            return;
        }

        let urlToUse = exportUrl;
        const hasFilters = hasFiltersApplied();

        // If filters are applied, prefer fast 2D export; fall back to WebGL only if needed
        if (hasFilters) {
            console.log('Filters applied, attempting fast 2D export first...', { active, brightness, contrast, saturation });
            try {
                // Wait for video metadata to be loaded before checking duration
                const video = videoRef.current;
                if (video && (video.readyState < 1 || !video.duration || !isFinite(video.duration))) {
                    console.log('Waiting for video metadata...');
                    await new Promise<void>((resolve) => {
                        if (video.readyState >= 1 && video.duration && isFinite(video.duration)) {
                            resolve();
                            return;
                        }
                        const onLoadedMetadata = () => {
                            video.removeEventListener('loadedmetadata', onLoadedMetadata);
                            resolve();
                        };
                        video.addEventListener('loadedmetadata', onLoadedMetadata);
                        // Timeout after 2 seconds
                        setTimeout(() => {
                            video.removeEventListener('loadedmetadata', onLoadedMetadata);
                            resolve();
                        }, 2000);
                    });
                }

                // Short timeout (prefer responsiveness): ~2x duration, capped 8s
                const videoDuration = video?.duration && isFinite(video.duration) ? video.duration : 5;
                const exportTimeout = Math.min(8000, Math.max(2000, videoDuration * 2000));

                console.log('Export timeout calculation', {
                    videoDuration,
                    calculatedTimeout: videoDuration * 4000,
                    finalTimeout: exportTimeout,
                    videoReadyState: video?.readyState,
                    isFinite: video?.duration ? isFinite(video.duration) : false
                });

                // Try 2D immediately, with short timeout safeguard
                const twoD = exportWithCanvas2D();
                const timeoutTwoD = new Promise<string | null>((resolve) => {
                    setTimeout(() => resolve(null), exportTimeout);
                });
                urlToUse = await Promise.race([twoD, timeoutTwoD]);
                if (!urlToUse) {
                    console.warn('2D export did not complete in time, trying WebGL export briefly...');
                    // Try WebGL export but with same short timeout
                    const webgl = handleExport();
                    const timeoutWebgl = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), exportTimeout));
                    urlToUse = await Promise.race([webgl, timeoutWebgl]);
                }
                console.log('Export result:', {
                    urlToUse: urlToUse ? 'success' : 'null',
                    blobSize: urlToUse ? 'exists' : 'none',
                    hasUrl: !!urlToUse
                });

                if (urlToUse) {
                    console.log('Export successful, using exported video URL');
                } else {
                    console.error('Both WebGL and 2D exports failed. Proceeding with original + filter info.');
                }
            } catch (error) {
                console.error('Export failed or timed out:', error);
                // Last-chance quick 2D fallback
                urlToUse = await exportWithCanvas2D();
            }
        } else {
            console.log('No filters applied, using original video');
        }

        // Use exported URL if available, otherwise use original
        let finalUrl = urlToUse || videoUrl;
        if (!finalUrl) {
            console.error('No final URL available');
            setExporting(false);
            alert('Error: No video URL available');
            return;
        }

        // Convert blob URL to data URL if it's a blob URL (for better compatibility with posting)
        if (urlToUse && urlToUse.startsWith('blob:')) {
            console.log('Converting blob URL to data URL...');
            try {
                const response = await fetch(urlToUse);
                const blob = await response.blob();
                const reader = new FileReader();
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                finalUrl = dataUrl;
                console.log('Converted blob URL to data URL', {
                    originalSize: blob.size,
                    dataUrlSize: dataUrl.length,
                    isDataUrl: dataUrl.startsWith('data:')
                });
            } catch (error) {
                console.error('Failed to convert blob URL to data URL:', error);
                // Continue with blob URL as fallback
            }
        }

        console.log('Navigating to /create', {
            finalUrl: finalUrl.substring(0, 50) + '...',
            filtered: hasFilters && urlToUse !== null,
            hasFilters,
            urlToUse: urlToUse ? 'exists' : 'null',
            videoUrl: videoUrl ? 'exists' : 'null',
            isBlobUrl: urlToUse?.startsWith('blob:'),
            isDataUrl: finalUrl.startsWith('data:'),
            filtersApplied: hasFilters ? { active, brightness, contrast, saturation } : null
        });

        // Reset exporting state
        setExporting(false);

        // Post directly from InstantFiltersPage (instant create flow is self-contained)
        // Use the same posting logic as handleUpload but for feed posting
        try {
            // Upload video to backend if needed (same logic as handleUpload)
            let finalVideoUrl = finalUrl;

            // If it's a blob or data URL, upload to backend first
            if (finalVideoUrl && (finalVideoUrl.startsWith('blob:') || finalVideoUrl.startsWith('data:'))) {
                const { uploadFile } = await import('../api/client');
                let blob: Blob;

                if (finalVideoUrl.startsWith('blob:')) {
                    const clip = locationState?.clips && locationState.clips.length > 0 ? locationState.clips[0] : null;
                    if (clip && (clip as any).blob) {
                        blob = (clip as any).blob;
                    } else {
                        const response = await fetch(finalVideoUrl);
                        if (!response.ok) throw new Error('Failed to fetch blob');
                        blob = await response.blob();
                    }
                } else {
                    const response = await fetch(finalVideoUrl);
                    blob = await response.blob();
                }

                const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type });
                const uploadResult = await uploadFile(file);

                if (uploadResult.success && uploadResult.fileUrl) {
                    finalVideoUrl = uploadResult.fileUrl;
                } else {
                    throw new Error('Upload failed');
                }
            }

            // Build editTimeline for hybrid pipeline
            const clips = locationState?.clips || [];
            let editTimeline: any = undefined;

            if (clips.length > 0) {
                // Multi-clip timeline
                const timelineClips = [];
                let currentStartTime = 0;
                let totalDuration = 0;

                // Map shader ID to filter name for backend
                const mapShaderIdToFilterName = (shaderId: string): string => {
                    switch (shaderId) {
                        case 'bw': return 'B&W';
                        case 'sepia': return 'Sepia';
                        case 'vivid': return 'Vivid';
                        case 'cool': return 'Cool';
                        case 'vignette': return 'Vignette';
                        case 'beauty': return 'Beauty';
                        default: return 'None';
                    }
                };
                const backendFilterName = hasFilters ? mapShaderIdToFilterName(active) : 'None';

                for (const clip of clips) {
                    const clipDuration = Math.min((clip.trimEnd - clip.trimStart) / clip.speed, 90 - totalDuration);
                    if (clipDuration <= 0) break;

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
                        originalDuration: clip.duration,
                        filters: hasFilters ? {
                            name: backendFilterName,
                            brightness: brightness,
                            contrast: contrast,
                            saturation: saturation,
                            hue: hue,
                            lut: lutAmount > 0 && selectedBuiltin.id !== 'none' ? {
                                name: selectedBuiltin.name,
                                url: selectedBuiltin.url,
                                amount: lutAmount,
                                size: lutMeta?.size,
                                tiles: lutMeta?.tiles
                            } : undefined
                        } : undefined
                    });

                    currentStartTime += clipDuration;
                    totalDuration += clipDuration;
                    if (totalDuration >= 90) break;
                }

                editTimeline = {
                    clips: timelineClips,
                    transitions: transitions.length > 0 ? transitions : (locationState?.transitions || []),
                    overlays: [],
                    voiceoverUrl: finalVoiceoverUrl || voiceoverUrl || locationState?.voiceoverUrl,
                    voiceoverVolume: voiceoverVolume,
                    voiceoverNoiseReduction: noiseReduction ? {
                        enabled: true,
                        strength: noiseReductionStrength
                    } : undefined,
                    musicUrl: selectedMusicUrl || undefined,
                    musicVolume: selectedMusicUrl ? musicVolume : undefined,
                    videoVolume: keepOriginalAudio ? videoVolume : 0, // Set to 0 if not keeping original audio
                    greenScreen: locationState?.greenScreenEnabled ? {
                        enabled: true,
                        backgroundUrl: locationState?.greenScreenBackgroundUrl
                    } : undefined,
                    totalDuration: totalDuration
                };
            } else if (passedTrimStart !== undefined || passedTrimEnd !== undefined || trimStart > 0 || trimEnd < videoDuration) {
                // Single clip with trim - use current trim values if available
                const currentTrimStart = trimStart > 0 ? trimStart : (passedTrimStart || 0);
                const currentTrimEnd = trimEnd < videoDuration ? trimEnd : (passedTrimEnd || videoDuration);
                const clipDuration = Math.min(currentTrimEnd - currentTrimStart, 90);

                const mapShaderIdToFilterName = (shaderId: string): string => {
                    switch (shaderId) {
                        case 'bw': return 'B&W';
                        case 'sepia': return 'Sepia';
                        case 'vivid': return 'Vivid';
                        case 'cool': return 'Cool';
                        case 'vignette': return 'Vignette';
                        case 'beauty': return 'Beauty';
                        default: return 'None';
                    }
                };
                const backendFilterName = hasFilters ? mapShaderIdToFilterName(active) : 'None';

                editTimeline = {
                    clips: [{
                        id: `clip-${Date.now()}`,
                        mediaUrl: finalVideoUrl,
                        type: 'video',
                        startTime: 0,
                        duration: clipDuration,
                        trimStart: currentTrimStart,
                        trimEnd: currentTrimEnd,
                        speed: speed, // Use current speed state (client-side preview)
                        reverse: reverse, // Use current reverse state (client-side preview)
                        originalDuration: videoDuration,
                        filters: hasFilters ? {
                            name: backendFilterName,
                            brightness: brightness,
                            contrast: contrast,
                            saturation: saturation,
                            hue: hue,
                            lut: lutAmount > 0 && selectedBuiltin.id !== 'none' ? {
                                name: selectedBuiltin.name,
                                url: selectedBuiltin.url,
                                amount: lutAmount,
                                size: lutMeta?.size,
                                tiles: lutMeta?.tiles
                            } : undefined
                        } : undefined
                    }],
                    transitions: transitions.length > 0 ? transitions : [],
                    overlays: [],
                    voiceoverUrl: voiceoverUrl || locationState?.voiceoverUrl,
                    musicUrl: selectedMusicUrl || undefined,
                    musicVolume: selectedMusicUrl ? musicVolume : undefined,
                    videoVolume: videoVolume,
                    greenScreen: locationState?.greenScreenEnabled ? {
                        enabled: true,
                        backgroundUrl: locationState?.greenScreenBackgroundUrl
                    } : undefined,
                    totalDuration: clipDuration
                };
            } else if (hasFilters) {
                // No trim data but filters are applied - still create editTimeline for backend processing
                const mapShaderIdToFilterName = (shaderId: string): string => {
                    switch (shaderId) {
                        case 'bw': return 'B&W';
                        case 'sepia': return 'Sepia';
                        case 'vivid': return 'Vivid';
                        case 'cool': return 'Cool';
                        case 'vignette': return 'Vignette';
                        case 'beauty': return 'Beauty';
                        default: return 'None';
                    }
                };
                const backendFilterName = mapShaderIdToFilterName(active);
                const clipDuration = videoDuration || 0;

                editTimeline = {
                    clips: [{
                        id: `clip-${Date.now()}`,
                        mediaUrl: finalVideoUrl,
                        type: 'video',
                        startTime: 0,
                        duration: clipDuration,
                        trimStart: 0,
                        trimEnd: clipDuration,
                        speed: speed, // Use current speed state (client-side preview)
                        reverse: reverse, // Use current reverse state (client-side preview)
                        originalDuration: clipDuration,
                        filters: {
                            name: backendFilterName,
                            brightness: brightness,
                            contrast: contrast,
                            saturation: saturation,
                            hue: hue,
                            lut: lutAmount > 0 && selectedBuiltin.id !== 'none' ? {
                                name: selectedBuiltin.name,
                                url: selectedBuiltin.url,
                                amount: lutAmount,
                                size: lutMeta?.size,
                                tiles: lutMeta?.tiles
                            } : undefined
                        }
                    }],
                    transitions: transitions.length > 0 ? transitions : [],
                    overlays: stickers.map(sticker => ({
                        id: sticker.id,
                        type: 'sticker' as const,
                        stickerId: sticker.stickerId,
                        sticker: sticker.sticker.url || sticker.sticker.emoji || sticker.sticker.name,
                        x: sticker.x,
                        y: sticker.y,
                        scale: sticker.scale,
                        rotation: sticker.rotation,
                        opacity: sticker.opacity,
                        startTime: sticker.startTime || 0,
                        endTime: sticker.endTime || (timelineDuration || videoDuration || 90),
                        textContent: sticker.sticker.category === 'Text' ? sticker.sticker.name : undefined,
                        textColor: '#FFFFFF',
                        fontSize: 'medium' as const
                    })),
                    voiceoverUrl: finalVoiceoverUrl || voiceoverUrl || locationState?.voiceoverUrl,
                    voiceoverVolume: voiceoverVolume,
                    voiceoverNoiseReduction: noiseReduction ? {
                        enabled: true,
                        strength: noiseReductionStrength
                    } : undefined,
                    musicUrl: selectedMusicUrl || undefined,
                    musicVolume: selectedMusicUrl ? musicVolume : undefined,
                    videoVolume: keepOriginalAudio ? videoVolume : 0, // Set to 0 if not keeping original audio
                    greenScreen: locationState?.greenScreenEnabled ? {
                        enabled: true,
                        backgroundUrl: locationState?.greenScreenBackgroundUrl
                    } : undefined,
                    totalDuration: clipDuration
                };
            }

            // Create post directly (instant create flow is self-contained)
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Get music track ID from window (set when track is selected from library)
            // Also check location state for musicTrackId (from InstantCreatePage)
            const musicTrackId = location.state?.musicTrackId || (window as any).selectedMusicTrackId || undefined;
            // Ensure it's a number if provided
            const finalMusicTrackId = musicTrackId ? (typeof musicTrackId === 'string' ? parseInt(musicTrackId, 10) : musicTrackId) : undefined;
            
            console.log('🎵 Posting with music track ID:', finalMusicTrackId, {
                fromLocationState: location.state?.musicTrackId,
                fromWindow: (window as any).selectedMusicTrackId,
                selectedMusicUrl: selectedMusicUrl
            });

            const newPost = await createPost(
                user.id,
                user.handle,
                '', // text
                '', // location
                finalVideoUrl, // mediaUrl
                'video', // mediaType
                undefined, // imageText
                undefined, // caption
                user.local,
                user.regional,
                user.national,
                undefined, // stickers
                undefined, // templateId
                undefined, // mediaItems
                undefined, // bannerText
                undefined, // textStyle
                undefined, // taggedUsers
                undefined, // videoCaptionsEnabled
                undefined, // videoCaptionText
                undefined, // subtitlesEnabled
                undefined, // subtitleText
                editTimeline, // Pass editTimeline for hybrid pipeline
                finalMusicTrackId // Pass music track ID (ensured to be a number)
            );

            // Navigate to feed after successful post
            navigate('/feed');
        } catch (error: any) {
            console.error('Error posting to feed:', error);
            const errorMessage = error?.response?.data?.message || error?.message || error?.errors || 'Please try again.';
            Swal.fire({
                title: 'Failed to Post',
                html: `
                    <p>${typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)}</p>
                    ${error?.response?.data?.errors ? `<p class="text-sm mt-2">${JSON.stringify(error.response.data.errors)}</p>` : ''}
                `,
                confirmButtonColor: '#0095f6',
                background: '#262626',
                color: '#ffffff',
                width: '500px'
            });
        } finally {
            setPostingFeed(false);
        }
    }

    async function trimVideoSegment(videoUrl: string, startTime: number, duration: number): Promise<string | null> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = videoUrl;
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.playsInline = true;

            video.onloadedmetadata = async () => {
                // Create canvas for trimming
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d')!;

                const chunks: BlobPart[] = [];
                const stream = canvas.captureStream(30);
                const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });

                mr.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                };

                const done = new Promise<void>((innerResolve) => {
                    mr.onstop = () => innerResolve();
                });

                mr.start();
                video.currentTime = startTime;

                await new Promise(resolve => {
                    video.onseeked = async () => {
                        await video.play();
                        resolve(null);
                    };
                });

                const endTime = Math.min(startTime + duration, video.duration);
                let lastFrameTime = video.currentTime;
                const drawLoop = () => {
                    const currentTime = video.currentTime;
                    if (currentTime >= endTime || video.ended) {
                        mr.stop();
                        return;
                    }
                    // Only draw if video has advanced (prevents duplicate frames)
                    if (currentTime > lastFrameTime) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        lastFrameTime = currentTime;
                    }
                    requestAnimationFrame(drawLoop);
                };
                drawLoop();

                await done;
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(URL.createObjectURL(blob));
            };

            video.onerror = () => resolve(null);
        });
    }

    async function splitVideoInto15SecondSegments(videoUrl: string): Promise<string[]> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = videoUrl;
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.playsInline = true;

            let settled = false;
            const settle = (segments: string[]) => { if (!settled) { settled = true; resolve(segments); } };
            const timeout = setTimeout(() => settle([videoUrl]), 6000);

            video.onloadedmetadata = async () => {
                const duration = video.duration;
                if (duration <= 15) {
                    // No splitting needed, return original
                    clearTimeout(timeout);
                    settle([videoUrl]);
                    return;
                }

                // Calculate number of 15-second segments
                const numSegments = Math.ceil(duration / 15);
                const segments: string[] = [];

                // Create each 15-second segment
                for (let i = 0; i < numSegments; i++) {
                    const startTime = i * 15;
                    const segment = await trimVideoSegment(videoUrl, startTime, 15);
                    if (segment) {
                        segments.push(segment);
                    }
                }

                clearTimeout(timeout);
                settle(segments);
            };

            video.onerror = () => { clearTimeout(timeout); settle([videoUrl]); }; // Fallback to original on error
        });
    }

    async function handleSaveToDrafts() {
        if (!videoUrl) return;

        try {
            const finalUrl = finalVideoUrl();
            if (!finalUrl) return;

            await saveDraft({
                videoUrl: finalUrl,
                videoDuration: videoDuration || 0,
            });

            // Show success feedback with SweetAlert
            await Swal.fire({
                title: 'Saved to Drafts!',
                html: `
                  <div style="text-align: center; padding: 20px 0;">
                    <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                      Your video has been saved. You can find it in your profile page.
                    </p>
                  </div>
                `,
                showConfirmButton: true,
                confirmButtonText: 'Done',
                confirmButtonColor: '#0095f6',
                background: '#262626',
                color: '#ffffff',
                customClass: {
                    popup: 'instagram-style-modal',
                    title: 'instagram-modal-title',
                    htmlContainer: 'instagram-modal-content',
                    confirmButton: 'instagram-confirm-btn',
                    actions: 'instagram-modal-actions'
                },
                buttonsStyling: true,
                timer: 3000,
                timerProgressBar: false
            });

            navigate('/feed');
        } catch (error) {
            console.error('Error saving draft:', error);
            Swal.fire({
                title: 'Failed to Save',
                html: `
                  <div style="text-align: center; padding: 20px 0;">
                    <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                      There was an error saving your draft. Please try again.
                    </p>
                  </div>
                `,
                showConfirmButton: true,
                confirmButtonText: 'OK',
                confirmButtonColor: '#0095f6',
                background: '#262626',
                color: '#ffffff',
                customClass: {
                    popup: 'instagram-style-modal',
                    title: 'instagram-modal-title',
                    htmlContainer: 'instagram-modal-content',
                    confirmButton: 'instagram-confirm-btn',
                    actions: 'instagram-modal-actions'
                },
                buttonsStyling: true
            });
        }
    }

    async function handleUpload() {
        if (!videoUrl || !user) return;

        // Upload voice-over to server if recorded (before creating editTimeline)
        let finalVoiceoverUrl = voiceoverUrl || locationState?.voiceoverUrl;
        if (voiceoverBlob && !finalVoiceoverUrl) {
            try {
                const { uploadFile } = await import('../api/client');
                const voiceoverFile = new File([voiceoverBlob], 'voiceover.webm', { type: 'audio/webm' });
                const uploadResult = await uploadFile(voiceoverFile);
                if (uploadResult.success && uploadResult.fileUrl) {
                    finalVoiceoverUrl = uploadResult.fileUrl;
                    console.log('✅ Voice-over uploaded to server:', finalVoiceoverUrl);
                }
            } catch (error) {
                console.error('Failed to upload voice-over:', error);
            }
        }

        // Show loading indicator immediately
        const loadingSwal = Swal.fire({
            title: 'Processing...',
            html: `
              <div style="text-align: center; padding: 20px 0;">
                <div class="spinner" style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #0095f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                  Applying filters and preparing your video...
                </p>
              </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            background: '#262626',
            color: '#ffffff',
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            let urlToUse = exportUrl;

            // If filters are applied, always export the video with filters (even if exportUrl exists)
            if (hasFiltersApplied()) {
                setExporting(true);
                const v = videoRef.current;
                if (!v) {
                    setExporting(false);
                    await Swal.close();
                    Swal.fire({
                        title: 'Error',
                        text: 'Video not ready for export.',
                        confirmButtonColor: '#0095f6',
                        background: '#262626',
                        color: '#ffffff'
                    });
                    return;
                }

                // Update loading message
                Swal.update({
                    html: `
                      <div style="text-align: center; padding: 20px 0;">
                        <div class="spinner" style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #0095f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                        <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                          Exporting video with filters...
                        </p>
                      </div>
                    `
                });

                // Ensure video is playing before export
                await v.play().catch(() => { });

                const duration = v.duration && isFinite(v.duration) ? v.duration : 5;
                const exportTimeout = Math.min(30000, Math.max(5000, duration * 5000));

                console.log('Exporting video with filters:', {
                    hasFilters: hasFiltersApplied(),
                    active,
                    brightness,
                    contrast,
                    saturation,
                    webglOk,
                    videoReady: v.readyState >= 2,
                    videoWidth: v.videoWidth,
                    videoHeight: v.videoHeight
                });

                // Always re-export when filters are applied (ignore existing exportUrl)
                urlToUse = null;

                // If WebGL is active, use WebGL export (better quality for filters)
                if (webglOk && canvasRef.current) {
                    console.log('Using WebGL export');
                    const webgl = handleExport();
                    const timeoutWebgl = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), exportTimeout));
                    urlToUse = await Promise.race([webgl, timeoutWebgl]);
                    console.log('WebGL export result:', urlToUse ? 'success' : 'failed');
                }

                // Fallback to 2D canvas if WebGL export failed or WebGL is not available
                if (!urlToUse) {
                    console.log('Using 2D canvas export');
                    const twoD = exportWithCanvas2D();
                    const timeoutTwoD = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), exportTimeout));
                    urlToUse = await Promise.race([twoD, timeoutTwoD]);
                    console.log('2D canvas export result:', urlToUse ? 'success' : 'failed');
                }

                setExporting(false);

                if (!urlToUse) {
                    console.error('Export failed completely, using original video (filters will NOT be applied)');
                    await Swal.close();
                    Swal.fire({
                        title: 'Export Failed',
                        text: 'Could not export video with filters. Uploading original video.',
                        confirmButtonColor: '#0095f6',
                        background: '#262626',
                        color: '#ffffff',
                        timer: 3000
                    });
                } else {
                    console.log('Export successful, using exported video with filters');
                }
            }

            // Use exported video if available, otherwise fall back to original
            let finalUrl = urlToUse || videoUrl;
            console.log('Final video URL for upload:', finalUrl === videoUrl ? 'original (no filters)' : 'exported (with filters)');

            // If URL is already a backend URL (http/https), use it directly
            if (finalUrl && (finalUrl.startsWith('http://') || finalUrl.startsWith('https://'))) {
                console.log('✅ Video already uploaded to backend, using URL:', finalUrl);
            }
            // If it's a blob URL, try to upload it to backend
            else if (finalUrl && finalUrl.startsWith('blob:')) {
                console.log('📤 Uploading blob URL video to backend...', finalUrl.substring(0, 50));
                try {
                    // Check if we have a blob reference from the clip (more reliable than fetching)
                    const clip = clips && clips.length > 0 ? clips[0] : null;
                    let blob: Blob;

                    if (clip && (clip as any).blob) {
                        // Use the blob reference directly (more reliable)
                        blob = (clip as any).blob;
                        console.log('✅ Using blob reference from clip, size:', blob.size);
                    } else {
                        // Fallback: try to fetch from blob URL
                        console.warn('⚠️ No blob reference found, trying to fetch from blob URL...');
                        const response = await fetch(finalUrl);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}. Blob URL may be revoked.`);
                        }
                        blob = await response.blob();
                        console.log('✅ Fetched blob from URL, size:', blob.size);
                    }

                    const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type });
                    const { uploadFile } = await import('../api/client');
                    const uploadResult = await uploadFile(file);

                    if (uploadResult.success && uploadResult.fileUrl) {
                        finalUrl = uploadResult.fileUrl;
                        console.log('✅ Video uploaded to backend:', finalUrl);
                    } else {
                        throw new Error('Upload failed - no fileUrl in response');
                    }
                } catch (error: any) {
                    console.error('❌ Failed to upload video to backend:', error);
                    await Swal.close();
                    
                    let errorMessage = error instanceof Error ? error.message : 'Please try again.';
                    let errorTitle = 'Upload Error';
                    
                    // Check for file size errors
                    if (errorMessage.includes('413') || errorMessage.includes('too large') || errorMessage.includes('Content Too Large')) {
                        errorTitle = 'File Too Large for Upload';
                        errorMessage = `The video file is too large to upload.\n\n✅ FFmpeg WILL compress the video during rendering (this happens automatically).\n\n❌ But we need to upload the raw video first, and PHP limits are too low:\n   • upload_max_filesize = 2M (needs 100M)\n   • post_max_size = 8M (needs 100M)\n\n🔧 To fix:\n1. Edit php.ini:\n   upload_max_filesize = 100M\n   post_max_size = 100M\n\n2. Restart: Stop (Ctrl+C) then run: php artisan serve\n\nAfter that, the upload will work and FFmpeg will compress it automatically.`;
                    }
                    
                    Swal.fire({
                        title: errorTitle,
                        html: `
                          <div style="text-align: center; padding: 20px 0;">
                            <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0; white-space: pre-line;">
                              ${errorMessage}
                            </p>
                          </div>
                        `,
                        confirmButtonColor: '#0095f6',
                        background: '#262626',
                        color: '#ffffff',
                        width: '500px'
                    });
                    return;
                }
            }
            // If it's a data URL, convert to blob and upload to backend
            else if (finalUrl && finalUrl.startsWith('data:')) {
                console.log('📤 Converting data URL to file and uploading to backend...', finalUrl.substring(0, 50));
                try {
                    // Convert data URL to blob
                    const response = await fetch(finalUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type });
                    const { uploadFile } = await import('../api/client');
                    const uploadResult = await uploadFile(file);

                    if (uploadResult.success && uploadResult.fileUrl) {
                        finalUrl = uploadResult.fileUrl;
                        console.log('✅ Video uploaded to backend:', finalUrl);
                    } else {
                        throw new Error('Upload failed - no fileUrl in response');
                    }
                } catch (error) {
                    console.error('❌ Failed to upload data URL video to backend:', error);
                    await Swal.close();
                    Swal.fire({
                        title: 'Upload Error',
                        html: `
                          <div style="text-align: center; padding: 20px 0;">
                            <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                              Failed to upload video.<br/>
                              Please try again.
                            </p>
                          </div>
                        `,
                        confirmButtonColor: '#0095f6',
                        background: '#262626',
                        color: '#ffffff'
                    });
                    return;
                }
            } else if (finalUrl) {
                console.log('✅ Video URL ready:', finalUrl.substring(0, 50));
            }

            // CRITICAL: Don't allow blob or data URLs to be uploaded - they need to be on backend
            if (finalUrl && (finalUrl.startsWith('blob:') || finalUrl.startsWith('data:'))) {
                console.error('❌ CRITICAL: Blob/Data URL still present after upload attempt!', finalUrl.substring(0, 50));
                Swal.fire({
                    title: 'Upload Error',
                    text: 'Video upload failed. The video file could not be uploaded to the server. Please try again.',
                    confirmButtonColor: '#0095f6',
                    background: '#262626',
                    color: '#ffffff'
                });
                return;
            }

            // For single clip mode (no clips array), use finalUrl
            // For multi-clip mode, we'll upload clips individually and build editTimeline
            if (clips.length === 0 && !finalUrl) {
                Swal.fire({
                    title: 'Error',
                    text: 'No video available to upload.',
                    confirmButtonColor: '#0095f6',
                    background: '#262626',
                    color: '#ffffff'
                });
                return;
            }

            // Update loading message for upload
            Swal.update({
                html: `
                  <div style="text-align: center; padding: 20px 0;">
                    <div class="spinner" style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #0095f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                      ${clips.length > 0 ? 'Preparing clips...' : 'Uploading to news feed...'}
                    </p>
                  </div>
                `
            });

            // Log the final URL before creating post
            console.log('📤 About to create post with URL:', {
                urlType: finalUrl.startsWith('blob:') ? 'blob' : finalUrl.startsWith('data:') ? 'data' : 'http',
                urlPreview: finalUrl.substring(0, 100),
                urlLength: finalUrl.length,
                isBlob: finalUrl.startsWith('blob:'),
                isData: finalUrl.startsWith('data:')
            });

            // Final safety check - refuse to create post with blob URL
            if (finalUrl.startsWith('blob:')) {
                console.error('❌ REFUSING to create post with blob URL - it will be revoked!');
                Swal.fire({
                    title: 'Upload Error',
                    text: 'Cannot upload video with temporary URL. Please try recording again.',
                    confirmButtonColor: '#0095f6',
                    background: '#262626',
                    color: '#ffffff'
                });
                return;
            }

            // Build editTimeline for multi-clip mode
            let editTimeline: any = undefined;
            
            if (clips.length > 0) {
                // Multi-clip timeline - upload each clip to server first, then stitch together
                const timelineClips = [];
                let currentStartTime = 0;
                let totalDuration = 0;

                // Map shader ID to filter name for backend
                const mapShaderIdToFilterName = (shaderId: string): string => {
                    switch (shaderId) {
                        case 'bw': return 'B&W';
                        case 'sepia': return 'Sepia';
                        case 'vivid': return 'Vivid';
                        case 'cool': return 'Cool';
                        case 'vignette': return 'Vignette';
                        case 'beauty': return 'Beauty';
                        default: return 'None';
                    }
                };
                const backendFilterName = hasFiltersApplied() ? mapShaderIdToFilterName(active) : 'None';

                // Upload voice-over to server if recorded
                let finalVoiceoverUrl = voiceoverUrl || locationState?.voiceoverUrl;
                if (voiceoverBlob && !finalVoiceoverUrl) {
                    try {
                        const { uploadFile: uploadVoiceover } = await import('../api/client');
                        const voiceoverFile = new File([voiceoverBlob], 'voiceover.webm', { type: 'audio/webm' });
                        const uploadResult = await uploadVoiceover(voiceoverFile);
                        if (uploadResult.success && uploadResult.fileUrl) {
                            finalVoiceoverUrl = uploadResult.fileUrl;
                            console.log('✅ Voice-over uploaded to server:', finalVoiceoverUrl);
                        }
                    } catch (error) {
                        console.error('Failed to upload voice-over:', error);
                    }
                }

                // Upload all clips to server first
                Swal.update({
                    html: `
                      <div style="text-align: center; padding: 20px 0;">
                        <div class="spinner" style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #0095f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                        <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                          Uploading ${clips.length} clip${clips.length > 1 ? 's' : ''} to server...
                        </p>
                      </div>
                    `
                });

                const { uploadFile } = await import('../api/client');
                const uploadedClips = [];

                for (let i = 0; i < clips.length; i++) {
                    const clip = clips[i];
                    let clipUrl = clip.url;

                    // If clip has a blob, upload it to server
                    if (clip.blob) {
                        try {
                            const file = new File([clip.blob], `clip-${i}-${Date.now()}.${clip.mediaType === 'image' ? 'jpg' : 'webm'}`, {
                                type: clip.mediaType === 'image' ? 'image/jpeg' : 'video/webm'
                            });
                            const uploadResult = await uploadFile(file);
                            if (uploadResult.success && uploadResult.fileUrl) {
                                clipUrl = uploadResult.fileUrl;
                                console.log(`✅ Uploaded clip ${i + 1}/${clips.length} to server:`, clipUrl.substring(0, 50));
                            } else {
                                throw new Error('Upload failed');
                            }
                        } catch (error) {
                            console.error(`❌ Failed to upload clip ${i + 1}:`, error);
                            Swal.fire({
                                title: 'Upload Error',
                                text: `Failed to upload clip ${i + 1}. Please try again.`,
                                confirmButtonColor: '#0095f6',
                                background: '#262626',
                                color: '#ffffff'
                            });
                            return;
                        }
                    } else if (clipUrl.startsWith('blob:') || clipUrl.startsWith('data:')) {
                        // Fetch blob from URL and upload
                        try {
                            const response = await fetch(clipUrl);
                            const blob = await response.blob();
                            const file = new File([blob], `clip-${i}-${Date.now()}.${clip.mediaType === 'image' ? 'jpg' : 'webm'}`, {
                                type: blob.type
                            });
                            const uploadResult = await uploadFile(file);
                            if (uploadResult.success && uploadResult.fileUrl) {
                                clipUrl = uploadResult.fileUrl;
                                console.log(`✅ Uploaded clip ${i + 1}/${clips.length} to server:`, clipUrl.substring(0, 50));
                            } else {
                                throw new Error('Upload failed');
                            }
                        } catch (error) {
                            console.error(`❌ Failed to upload clip ${i + 1}:`, error);
                            Swal.fire({
                                title: 'Upload Error',
                                text: `Failed to upload clip ${i + 1}. Please try again.`,
                                confirmButtonColor: '#0095f6',
                                background: '#262626',
                                color: '#ffffff'
                            });
                            return;
                        }
                    }

                    // If URL is already on server (http/https), use it directly
                    if (clipUrl.startsWith('http://') || clipUrl.startsWith('https://')) {
                        uploadedClips.push({
                            ...clip,
                            url: clipUrl
                        });
                    }
                }

                // Build timeline with uploaded clips
                for (const clip of uploadedClips) {
                    const clipDuration = Math.min((clip.trimEnd - clip.trimStart) / clip.speed, 90 - totalDuration);
                    if (clipDuration <= 0) break; // Stop if we've hit the 90s limit

                    timelineClips.push({
                        id: clip.id,
                        mediaUrl: clip.url, // Now a server URL that backend can access
                        type: clip.mediaType || 'video',
                        startTime: currentStartTime,
                        duration: clipDuration,
                        trimStart: clip.trimStart,
                        trimEnd: clip.trimEnd,
                        speed: clip.speed,
                        reverse: clip.reverse,
                        originalDuration: clip.duration,
                        filters: hasFiltersApplied() ? {
                            name: backendFilterName,
                            brightness: brightness,
                            contrast: contrast,
                            saturation: saturation,
                            hue: hue,
                            lut: lutAmount > 0 && selectedBuiltin.id !== 'none' ? {
                                name: selectedBuiltin.name,
                                url: selectedBuiltin.url,
                                amount: lutAmount,
                                size: lutMeta?.size,
                                tiles: lutMeta?.tiles
                            } : undefined
                        } : undefined
                    });

                    currentStartTime += clipDuration;
                    totalDuration += clipDuration;

                    if (totalDuration >= 90) break; // Enforce 90s max
                }

                editTimeline = {
                    clips: timelineClips,
                    transitions: transitions.length > 0 ? transitions : [],
                    overlays: [],
                    voiceoverUrl: finalVoiceoverUrl || state?.voiceoverUrl,
                    musicUrl: selectedMusicUrl || undefined,
                    musicVolume: selectedMusicUrl ? musicVolume : undefined,
                    videoVolume: keepOriginalAudio ? videoVolume : 0, // Set to 0 if not keeping original audio
                    greenScreen: state?.greenScreenEnabled ? {
                        enabled: true,
                        backgroundUrl: state?.greenScreenBackgroundUrl
                    } : undefined,
                    totalDuration: totalDuration
                };

                console.log('📋 Multi-clip editTimeline created:', {
                    clipCount: timelineClips.length,
                    totalDuration,
                    clips: timelineClips.map(c => ({
                        id: c.id.substring(0, 10),
                        mediaUrl: c.mediaUrl.substring(0, 50),
                        duration: c.duration,
                        speed: c.speed,
                        reverse: c.reverse
                    }))
                });
            }

            // Create post with video and template ID
            // Get music track ID from window (set when track is selected from library)
            // Also check location state for musicTrackId (from InstantCreatePage)
            const musicTrackId = state?.musicTrackId || (window as any).selectedMusicTrackId || undefined;
            // Ensure it's a number if provided
            const finalMusicTrackId = musicTrackId ? (typeof musicTrackId === 'string' ? parseInt(musicTrackId, 10) : musicTrackId) : undefined;
            
            const newPost = await createPost(
                user.id,
                user.handle,
                '', // text
                '', // location
                finalUrl, // imageUrl (video URL - now as data URL if converted)
                'video', // mediaType
                undefined, // imageText
                undefined, // caption
                user.local,
                user.regional,
                user.national,
                undefined, // stickers
                selectedTemplate?.id || undefined, // templateId
                undefined, // mediaItems
                undefined, // bannerText
                undefined, // textStyle
                undefined, // taggedUsers
                undefined, // videoCaptionsEnabled
                undefined, // videoCaptionText
                undefined, // subtitlesEnabled
                undefined, // subtitleText
                editTimeline, // Pass editTimeline for multi-clip stitching
                finalMusicTrackId // Pass music track ID (ensured to be a number)
            );

            // Verify the post was created with the correct URL
            console.log('📋 Post created, verifying URL:', {
                postId: newPost.id.substring(0, 30),
                mediaUrl: newPost.mediaUrl?.substring(0, 50) || 'undefined',
                mediaUrlType: newPost.mediaUrl?.startsWith('blob:') ? 'blob' : newPost.mediaUrl?.startsWith('data:') ? 'data' : 'http',
                mediaItems: newPost.mediaItems?.map(item => ({
                    type: item.type,
                    urlType: item.url?.startsWith('blob:') ? 'blob' : item.url?.startsWith('data:') ? 'data' : 'http',
                    urlPreview: item.url?.substring(0, 50)
                }))
            });

            // Extract renderJobId and videoUrl for PiP
            const renderJobId = (newPost as any).renderJobId || (newPost as any).render_job_id;
            const backendVideoUrl = newPost.finalVideoUrl || newPost.mediaUrl || finalUrl;

            console.log('📤 === POST CREATED EVENT DEBUG (InstantFiltersPage) ===');
            console.log('renderJobId:', renderJobId);
            console.log('postId:', newPost.id);
            console.log('backendVideoUrl:', backendVideoUrl?.substring(0, 50), 'type:', backendVideoUrl?.startsWith('blob:') ? 'blob' : backendVideoUrl?.startsWith('data:') ? 'data' : 'http');
            console.log('newPost object:', {
                id: newPost.id.substring(0, 30),
                mediaUrl: newPost.mediaUrl?.substring(0, 50),
                mediaType: newPost.mediaType,
                hasMediaItems: !!newPost.mediaItems
            });

            // Dispatch event to refresh feed and show PiP
            // Always dispatch the event, even if no renderJobId (for feed refresh)
            const eventDetail = renderJobId ? {
                postId: newPost.id,
                renderJobId: renderJobId,
                videoUrl: backendVideoUrl || '', // Use backend URL if available, otherwise fallback
            } : {
                postId: newPost.id,
            };

            console.log('📤 === DISPATCHING postCreated EVENT ===');
            console.log('Event detail:', eventDetail);
            console.log('Has renderJobId:', !!renderJobId);

            // Dispatch synchronously to ensure it's sent before navigation
            const event = new CustomEvent('postCreated', {
                detail: eventDetail,
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(event);

            console.log('✅ postCreated event dispatched successfully');
            console.log('Event defaultPrevented:', event.defaultPrevented);

            // Give the event time to be processed before navigation
            await new Promise(resolve => setTimeout(resolve, 200));

            // Close loading and show success message
            await Swal.close();
            await Swal.fire({
                title: 'Posted!',
                html: `
                  <div style="text-align: center; padding: 20px 0;">
                    <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                      Your video has been posted to the news feed.
                    </p>
                  </div>
                `,
                showConfirmButton: true,
                confirmButtonText: 'Done',
                confirmButtonColor: '#0095f6',
                background: '#262626',
                color: '#ffffff',
                customClass: {
                    popup: 'instagram-style-modal',
                    title: 'instagram-modal-title',
                    htmlContainer: 'instagram-modal-content',
                    confirmButton: 'instagram-confirm-btn',
                    actions: 'instagram-modal-actions'
                },
                buttonsStyling: true,
                timer: 2000,
                timerProgressBar: false
            });

            // Navigate to feed
            navigate('/feed');
        } catch (error) {
            console.error('Error uploading post:', error);
            Swal.fire({
                title: 'Failed to Upload',
                html: `
                  <div style="text-align: center; padding: 20px 0;">
                    <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                      There was an error uploading your video. Please try again.
                    </p>
                  </div>
                `,
                showConfirmButton: true,
                confirmButtonText: 'OK',
                confirmButtonColor: '#0095f6',
                background: '#262626',
                color: '#ffffff',
                customClass: {
                    popup: 'instagram-style-modal',
                    title: 'instagram-modal-title',
                    htmlContainer: 'instagram-modal-content',
                    confirmButton: 'instagram-confirm-btn',
                    actions: 'instagram-modal-actions'
                }
            });
        }
    }

    async function handleSendToClips() {
        if (!videoUrl || postingFeed || postingClips) return;
        setPostingClips(true);
        try {
            let urlToUse = exportUrl;

            // If filters are applied but not exported yet, export quickly with 2D first
            if (hasFiltersApplied() && !urlToUse) {
                const v = videoRef.current;
                const duration = v?.duration && isFinite(v.duration) ? v.duration : 5;
                const exportTimeout = Math.min(8000, Math.max(2000, duration * 2000));
                setExporting(true);
                const twoD = exportWithCanvas2D();
                const timeoutTwoD = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), exportTimeout));
                urlToUse = await Promise.race([twoD, timeoutTwoD]);
                if (!urlToUse) {
                    const webgl = handleExport();
                    const timeoutWebgl = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), exportTimeout));
                    urlToUse = await Promise.race([webgl, timeoutWebgl]);
                }
            }

            // Fall back to original video if export failed
            let finalUrl = urlToUse || videoUrl;
            if (!finalUrl) {
                alert('No video available to post.');
                return;
            }

            // Split video into 15-second segments if longer than 15 seconds (with timeout fallback)
            setTrimming(true);
            const segments = await Promise.race([
                splitVideoInto15SecondSegments(finalUrl),
                new Promise<string[]>((resolve) => setTimeout(() => resolve([finalUrl]), 6000))
            ]);
            if (!segments || segments.length === 0) {
                // Fallback to original
                navigate('/clip', {
                    state: { videoUrl: finalUrl, videoSegments: [finalUrl], filtered: hasFiltersApplied(), segmentIndex: 0 }
                });
                return;
            }

            // Navigate to ClipPage with all segments - it will post them sequentially
            navigate('/clip', {
                state: {
                    videoUrl: segments[0], // First segment to start with
                    videoSegments: segments, // All segments for sequential posting
                    filtered: hasFiltersApplied(),
                    segmentIndex: 0 // Track which segment we're on
                }
            });
        } catch (err) {
            console.error('Error preparing Clips posting:', err);
            alert('Failed to prepare clip. Please try again.');
        } finally {
            setTrimming(false);
            setExporting(false);
            setPostingClips(false);
        }
    }

    const handleCategoryClick = (categoryId: string) => {
        if (selectedCategory === categoryId) {
            setSelectedCategory(null); // Close if already open
        } else {
            setSelectedCategory(categoryId); // Open category
        }
    };

    return (
        <>
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .slider-thumb::-webkit-slider-thumb {
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
                    border: 2px solid rgba(255, 255, 255, 0.9);
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.5), 0 0 0 4px rgba(139, 92, 246, 0.1);
                    transition: all 0.2s ease;
                }
                .slider-thumb::-webkit-slider-thumb:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.7), 0 0 0 6px rgba(139, 92, 246, 0.15);
                }
                .slider-thumb::-webkit-slider-thumb:active {
                    transform: scale(0.95);
                }
                .slider-thumb::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
                    border: 2px solid rgba(255, 255, 255, 0.9);
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.5);
                    transition: all 0.2s ease;
                }
                .slider-thumb::-moz-range-thumb:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.7);
                }
                .category-sheet {
                    animation: slideUp 0.3s ease-out;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .custom-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                }
                @keyframes shimmerGradient {
                    0% {
                        background-position: 0% 0%;
                    }
                    100% {
                        background-position: 100% 0%;
                    }
                }
                @keyframes spin-slow {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
                .animate-spin-slow {
                    animation: spin-slow 3s linear infinite;
                }
                @keyframes pulse-glow {
                    0%, 100% {
                        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
                    }
                    50% {
                        box-shadow: 0 0 0 8px rgba(255, 255, 255, 0);
                    }
                }
                .animate-pulse-glow {
                    animation: pulse-glow 2s ease-in-out infinite;
                }
            `}</style>
            <div className="fixed inset-0 bg-black flex flex-col z-50">
                {/* NEW UI LAYOUT - Preview at top, Categories at bottom */}
                {/* Header - Top with Close Button, Title, and Post Button */}
                <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/create/instant')}
                        className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                    <div className="flex-1 text-center">
                        <h1 className="text-white text-lg font-bold">Edit Video</h1>
                        <p className="text-white/60 text-xs">Tap categories below to edit</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedTemplate && (
                            <div className="px-3 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold rounded-full">
                                {selectedTemplate.name}
                            </div>
                        )}
                        {/* Save to Drafts Button - Frontend only, no backend */}
                        <button
                            onClick={handleSaveToDrafts}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-700/90 backdrop-blur-sm text-white font-semibold hover:bg-gray-600 transition-all shadow-lg"
                        >
                            <FiSave className="w-4 h-4" />
                            <span className="hidden sm:inline">Save Draft</span>
                        </button>
                        {/* Upload to Newsfeed Button - Triggers Laravel backend */}
                        <button
                            onClick={handleUpload}
                            disabled={postingFeed || postingClips}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            <FiSend className="w-4 h-4" />
                            <span>Upload to Newsfeed</span>
                        </button>
                    </div>
                </div>

                {/* TikTok-Style Layout: Preview Area */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden pt-16 pb-40" style={{ minHeight: 0 }}>
                    {/* Video Preview */}
                    <div className="relative w-full h-full max-w-md mx-auto" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedTemplate ? (
                            <div className="relative aspect-[9/16] w-full rounded-lg overflow-hidden bg-gray-900 border border-white/20">
                                <div className="absolute inset-0 bg-black">
                                    {isImage ? (
                                        <img
                                            src={actualVideoUrl}
                                            alt="Preview"
                                            className="w-full h-full object-contain"
                                            style={{
                                                filter: active === 'bw' ? 'grayscale(1)'
                                                    : active === 'sepia' ? 'sepia(0.8)'
                                                        : active === 'vivid' ? 'saturate(1.6) contrast(1.1)'
                                                            : active === 'cool' ? 'hue-rotate(200deg) saturate(1.2)'
                                                                : 'none',
                                                display: 'block'
                                            }}
                                            onLoad={() => {
                                                console.log('✅ Image loaded in template preview');
                                            }}
                                            onError={(e) => {
                                                console.error('❌ Error loading image in template:', e);
                                            }}
                                        />
                                    ) : (
                                        <video
                                            ref={videoRef}
                                            src={actualVideoUrl}
                                            playsInline
                                            muted={false}
                                            volume={videoVolume}
                                            loop
                                            className="w-full h-full object-contain cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const v = videoRef.current;
                                                if (v) {
                                                    if (v.paused) {
                                                        v.play().catch(err => console.error('Error playing video:', err));
                                                    } else {
                                                        v.pause();
                                                    }
                                                }
                                            }}
                                            style={{
                                                filter: active === 'bw' ? 'grayscale(1)'
                                                    : active === 'sepia' ? 'sepia(0.8)'
                                                        : active === 'vivid' ? 'saturate(1.6) contrast(1.1)'
                                                            : active === 'cool' ? 'hue-rotate(200deg) saturate(1.2)'
                                                                : 'none',
                                                display: 'block'
                                            }}
                                            onLoadedMetadata={() => {
                                                const v = videoRef.current;
                                                if (v) {
                                                    setTimelineDuration(v.duration || 0);
                                                }
                                                console.log('✅ Video metadata loaded (template):', {
                                                    duration: v?.duration,
                                                    videoWidth: v?.videoWidth,
                                                    videoHeight: v?.videoHeight
                                                });
                                                // Don't auto-play - wait for user interaction
                                            }}
                                            onTimeUpdate={() => {
                                                const v = videoRef.current;
                                                if (v) {
                                                    setTimelineCurrentTime(v.currentTime || 0);
                                                }
                                            }}
                                            onCanPlay={() => {
                                                const v = videoRef.current;
                                                console.log('✅ Video can play (template)');
                                                // Don't auto-play - wait for user interaction
                                            }}
                                            onLoadedData={() => {
                                                const v = videoRef.current;
                                                console.log('✅ Video data loaded (template)');
                                                // Don't auto-play - wait for user interaction
                                            }}
                                            onError={(e) => {
                                                console.error('❌ Video error (template):', e);
                                                console.error('Video src:', actualVideoUrl);
                                            }}
                                            onPlay={() => {
                                                console.log('✅ Video started playing (template)');
                                            }}
                                        />
                                    )}
                                    <canvas
                                        ref={canvasRef}
                                        className={webglOk ? 'w-full h-full object-cover' : 'hidden'}
                                        style={{
                                            display: webglOk ? 'block' : 'none',
                                            width: '100%',
                                            height: '100%'
                                        }}
                                    />
                                    
                                    {/* Sticker Overlays for Template Mode */}
                                    {(() => {
                                        console.log('🎨 TEMPLATE MODE - Sticker render section', {
                                            stickersLength: stickers.length,
                                            containerSize,
                                            hasVideoContainer: !!videoContainerRef.current,
                                            hasVideoRef: !!videoRef.current
                                        });
                                        
                                        if (stickers.length === 0) return null;
                                        
                                        const containerWidth = videoContainerRef.current?.offsetWidth || videoRef.current?.videoWidth || 400;
                                        const containerHeight = videoContainerRef.current?.offsetHeight || videoRef.current?.videoHeight || 400;
                                        
                                        return (
                                            <>
                                                {stickers.map((sticker) => {
                                                    const currentTime = timelineCurrentTime || 0;
                                                    const startTime = sticker.startTime ?? 0;
                                                    const endTime = sticker.endTime ?? (timelineDuration || videoDuration || 90);
                                                    const isVisible = currentTime >= startTime && currentTime <= endTime;
                                                    
                                                    if (!isVisible || (containerWidth === 0 && containerHeight === 0)) return null;
                                                    
                                                    return (
                                                        <StickerOverlayComponent
                                                            key={sticker.id}
                                                            overlay={sticker as StickerOverlay}
                                                            onUpdate={(updated) => {
                                                                setStickers(stickers.map(s => 
                                                                    s.id === sticker.id ? updated as typeof sticker : s
                                                                ));
                                                            }}
                                                            onRemove={() => {
                                                                setStickers(stickers.filter(s => s.id !== sticker.id));
                                                                if (selectedSticker === sticker.id) {
                                                                    setSelectedSticker(null);
                                                                }
                                                            }}
                                                            isSelected={selectedSticker === sticker.id}
                                                            onSelect={() => setSelectedSticker(sticker.id)}
                                                            containerWidth={containerWidth}
                                                            containerHeight={containerHeight}
                                                        />
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        ) : (
                            <div className="relative w-full h-full rounded-lg overflow-hidden bg-gray-900" style={{ minHeight: '400px' }}>
                                {isImage ? (
                                    // Image preview
                                    <img
                                        src={actualVideoUrl}
                                        alt="Preview"
                                        className="w-full h-full object-contain"
                                        style={{
                                            filter: active === 'bw' ? 'grayscale(1)'
                                                : active === 'sepia' ? 'sepia(0.8)'
                                                    : active === 'vivid' ? 'saturate(1.6) contrast(1.1)'
                                                        : active === 'cool' ? 'hue-rotate(200deg) saturate(1.2)'
                                                            : 'none',
                                            display: 'block',
                                            maxWidth: '100%',
                                            maxHeight: '100%'
                                        }}
                                        onLoad={() => {
                                            console.log('✅ Image loaded successfully and visible');
                                        }}
                                        onError={(e) => {
                                            console.error('❌ Error loading image:', e);
                                        }}
                                    />
                                ) : (
                                    // Video preview
                                    <div 
                                        ref={videoContainerRef}
                                        className="relative w-full h-full"
                                        onLoad={() => {
                                            if (videoContainerRef.current) {
                                                setContainerSize({
                                                    width: videoContainerRef.current.offsetWidth,
                                                    height: videoContainerRef.current.offsetHeight
                                                });
                                            }
                                        }}
                                    >
                                        <video
                                            ref={videoRef}
                                            src={clips.length > 1 ? (clips[currentClipIndex]?.url || actualVideoUrl) : actualVideoUrl}
                                            playsInline
                                            muted={false}
                                            volume={videoVolume}
                                            loop={clips.length <= 1}
                                            autoPlay
                                            className="w-full h-full object-contain"
                                            style={{
                                                filter: active === 'bw' ? 'grayscale(1)'
                                                    : active === 'sepia' ? 'sepia(0.8)'
                                                        : active === 'vivid' ? 'saturate(1.6) contrast(1.1)'
                                                            : active === 'cool' ? 'hue-rotate(200deg) saturate(1.2)'
                                                                : 'none',
                                                display: 'block'
                                            }}
                                            onLoadedMetadata={() => {
                                                const v = videoRef.current;
                                                if (v) {
                                                    setTimelineDuration(v.duration || 0);
                                                }
                                                // Update container size
                                                if (videoContainerRef.current) {
                                                    const width = videoContainerRef.current.offsetWidth;
                                                    const height = videoContainerRef.current.offsetHeight;
                                                    if (width > 0 && height > 0) {
                                                        setContainerSize({ width, height });
                                                        console.log('📐 Container size from video metadata:', { width, height });
                                                    }
                                                }
                                                console.log('✅ Video metadata loaded:', {
                                                    duration: v?.duration,
                                                    videoWidth: v?.videoWidth,
                                                    videoHeight: v?.videoHeight,
                                                    readyState: v?.readyState,
                                                    clipIndex: clips.length > 1 ? currentClipIndex : 'single'
                                                });
                                                // Don't auto-play - wait for user interaction
                                            }}
                                            onTimeUpdate={() => {
                                                const v = videoRef.current;
                                                if (v) {
                                                    setTimelineCurrentTime(v.currentTime || 0);
                                                }
                                            }}
                                            onCanPlay={() => {
                                                const v = videoRef.current;
                                                console.log('✅ Video can play');
                                                // Update container size
                                                if (videoContainerRef.current) {
                                                    const width = videoContainerRef.current.offsetWidth;
                                                    const height = videoContainerRef.current.offsetHeight;
                                                    if (width > 0 && height > 0) {
                                                        setContainerSize({ width, height });
                                                        console.log('📐 Container size from canPlay:', { width, height });
                                                    }
                                                }
                                                // Don't auto-play - wait for user interaction
                                            }}
                                            onLoadedData={() => {
                                                const v = videoRef.current;
                                                console.log('✅ Video data loaded');
                                                // Don't auto-play - wait for user interaction
                                            }}
                                            onError={(e) => {
                                                console.error('❌ Video error:', e);
                                                console.error('Video src:', clips.length > 1 ? clips[currentClipIndex]?.url : actualVideoUrl);
                                                console.error('Video element:', videoRef.current);
                                            }}
                                            onPlay={() => {
                                                console.log('✅ Video started playing');
                                            }}
                                        />
                                        
                                        {/* Sticker Overlays */}
                                        {(() => {
                                            // Always log to verify this code is being executed
                                            console.log('🎨 STICKER RENDER SECTION CALLED', {
                                                stickersLength: stickers.length,
                                                containerSize,
                                                hasVideoContainer: !!videoContainerRef.current,
                                                hasVideoRef: !!videoRef.current,
                                                isImage,
                                                webglOk
                                            });
                                            
                                            if (stickers.length === 0) {
                                                console.log('⏸️ No stickers to render');
                                                return null;
                                            }
                                            
                                            return (
                                                <>
                                                    {stickers.map((sticker) => {
                                                        // Check if sticker should be visible at current time
                                                        const currentTime = timelineCurrentTime || 0;
                                                        const startTime = sticker.startTime ?? 0;
                                                        const endTime = sticker.endTime ?? (timelineDuration || videoDuration || 90);
                                                        const isVisible = currentTime >= startTime && currentTime <= endTime;
                                                        
                                                        // Get container dimensions - use video dimensions if container size not available
                                                        const containerWidth = containerSize.width || 
                                                            videoContainerRef.current?.offsetWidth || 
                                                            videoRef.current?.videoWidth || 
                                                            videoRef.current?.clientWidth || 
                                                            400;
                                                        const containerHeight = containerSize.height || 
                                                            videoContainerRef.current?.offsetHeight || 
                                                            videoRef.current?.videoHeight || 
                                                            videoRef.current?.clientHeight || 
                                                            400;
                                                        
                                                        console.log(`🎨 Processing sticker ${sticker.id} (${sticker.sticker.name}):`, {
                                                            containerWidth,
                                                            containerHeight,
                                                            containerSize,
                                                            videoContainerSize: videoContainerRef.current ? {
                                                                offsetWidth: videoContainerRef.current.offsetWidth,
                                                                offsetHeight: videoContainerRef.current.offsetHeight
                                                            } : 'no container ref',
                                                            videoSize: videoRef.current ? {
                                                                videoWidth: videoRef.current.videoWidth,
                                                                videoHeight: videoRef.current.videoHeight,
                                                                clientWidth: videoRef.current.clientWidth,
                                                                clientHeight: videoRef.current.clientHeight
                                                            } : 'no video ref',
                                                            currentTime,
                                                            startTime,
                                                            endTime,
                                                            isVisible,
                                                            willRender: isVisible && containerWidth > 0 && containerHeight > 0
                                                        });
                                                        
                                                        // Always render if container size is available, or use fallback
                                                        if (containerWidth === 0 && containerHeight === 0) {
                                                            console.warn(`⚠️ Sticker ${sticker.id} - Container size is 0, skipping render`);
                                                            return null;
                                                        }
                                                        
                                                        if (!isVisible) {
                                                            console.log(`⏸️ Sticker ${sticker.id} not visible (time: ${currentTime.toFixed(2)}s, range: ${startTime.toFixed(2)}s-${endTime.toFixed(2)}s)`);
                                                            return null;
                                                        }
                                                        
                                                        console.log(`✅ Rendering sticker ${sticker.id} with size ${containerWidth}x${containerHeight}`);
                                                    
                                                    return (
                                                        <StickerOverlayComponent
                                                            key={sticker.id}
                                                            overlay={sticker as StickerOverlay}
                                                            onUpdate={(updated) => {
                                                                setStickers(stickers.map(s => 
                                                                    s.id === sticker.id ? updated as typeof sticker : s
                                                                ));
                                                            }}
                                                            onRemove={() => {
                                                                setStickers(stickers.filter(s => s.id !== sticker.id));
                                                                if (selectedSticker === sticker.id) {
                                                                    setSelectedSticker(null);
                                                                }
                                                            }}
                                                            isSelected={selectedSticker === sticker.id}
                                                            onSelect={() => setSelectedSticker(sticker.id)}
                                                            containerWidth={containerWidth}
                                                            containerHeight={containerHeight}
                                                        />
                                                    );
                                                })}
                                                </>
                                            );
                                        })()}
                                        
                                        {/* Multi-clip indicator */}
                                        {clips.length > 1 && (
                                            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-sm font-semibold">
                                                Clip {currentClipIndex + 1} of {clips.length}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <canvas
                                    ref={canvasRef}
                                    className={webglOk ? 'w-full h-full object-cover' : 'hidden'}
                                    style={{
                                        display: webglOk ? 'block' : 'none',
                                        width: '100%',
                                        height: '100%'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* TikTok-Style Timeline */}
                <div className="absolute bottom-24 left-0 right-0 z-40 px-4 py-3 bg-gradient-to-t from-black/95 via-black/90 to-transparent">
                    <div className="relative h-16 bg-gray-800 rounded-lg overflow-hidden">
                        {/* Clip Thumbnails */}
                        <div className="absolute inset-0 flex">
                            {clips.length > 0 ? (
                                clips.map((clip, index) => {
                                    const clipDuration = Math.round((clip.trimEnd - clip.trimStart) / clip.speed);
                                    const totalDuration = clips.reduce((sum, c) => sum + Math.round((c.trimEnd - c.trimStart) / c.speed), 0);
                                    const clipWidthPercent = totalDuration > 0 ? (clipDuration / totalDuration) * 100 : 100 / clips.length;
                                    const isImage = clip.mediaType === 'image' || clip.url.toLowerCase().includes('.jpg') || clip.url.toLowerCase().includes('.png') || clip.url.toLowerCase().includes('.jpeg');
                                    
                                    return (
                                        <div
                                            key={clip.id}
                                            className="border-r border-black/40 relative"
                                            style={{ width: `${clipWidthPercent}%` }}
                                        >
                                            {isImage ? (
                                                <img
                                                    src={clip.url}
                                                    alt={`Clip ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <video
                                                    src={clip.url}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    playsInline
                                                />
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                // Single clip - show actual video thumbnail
                                actualVideoUrl ? (
                                    isImage ? (
                                        <img
                                            src={actualVideoUrl}
                                            alt="Video thumbnail"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <video
                                            src={actualVideoUrl}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                        />
                                    )
                                ) : (
                                    // Fallback placeholder
                                    [1, 2, 3, 4, 5, 6].map((i) => (
                                        <div
                                            key={i}
                                            className="flex-1 bg-gray-700 border-r border-black/40"
                                        ></div>
                                    ))
                                )
                            )}
                        </div>
                        {/* Scrubber */}
                        {timelineDuration > 0 && (
                            <div
                                className="absolute top-0 bottom-0 w-1 bg-red-500 pointer-events-none z-10"
                                style={{ left: `${Math.min(100, (timelineCurrentTime / timelineDuration) * 100)}%` }}
                            ></div>
                        )}
                    </div>
                    {/* Time display */}
                    <div className="text-right text-sm mt-1 opacity-70 text-white">
                        {timelineCurrentTime.toFixed(1)} / {timelineDuration.toFixed(1)}s
                    </div>
                </div>

                {/* TikTok-Style Button Toolbar - Single Edits Menu Button with Scrim Effect */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-black/40 backdrop-blur-xl border-t border-white/10 flex items-center justify-center z-40 pb-safe">
                    <ToolButton
                        icon={<FiMenu className="w-6 h-6 text-white" />}
                        label="Edits Menu"
                        onClick={() => {
                            // If no category is selected, open filters by default, otherwise toggle
                            if (!selectedCategory) {
                                handleCategoryClick('filters');
                            } else {
                                // If already open, close it, otherwise keep it open
                                setSelectedCategory(null);
                            }
                        }}
                        isActive={selectedCategory !== null}
                        isEditsMenu={true}
                    />
                </div>

                {/* Category Bottom Sheet - Pulls up from bottom */}
                {selectedCategory && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/50 z-[60]"
                            onClick={() => setSelectedCategory(null)}
                        />
                        {/* Bottom Sheet */}
                        <div className="fixed bottom-0 left-0 right-0 z-[70] bg-gradient-to-b from-black/98 via-black/95 to-black/98 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-white/10 max-h-[70vh] overflow-y-auto category-sheet">
                            {/* Header with drag handle and close button */}
                            <div className="sticky top-0 bg-black/98 backdrop-blur-xl z-10 border-b border-white/10 px-4 pt-4 pb-3">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                        {(() => {
                                            const category = categories.find(c => c.id === selectedCategory);
                                            const Icon = category?.icon || FiFilter;
                                            return <Icon className="w-5 h-5" />;
                                        })()}
                                        {categories.find(c => c.id === selectedCategory)?.name || 'Category'}
                                    </h3>
                                    <button
                                        onClick={() => setSelectedCategory(null)}
                                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                        aria-label="Close category"
                                    >
                                        <FiX className="w-5 h-5 text-white/70" />
                                    </button>
                                </div>
                                <div className="w-12 h-1 bg-white/30 rounded-full mx-auto"></div>
                            </div>

                            {/* All Categories - Horizontal Scrollable */}
                            <div className="px-4 pt-2 pb-3 border-b border-white/10">
                                <div
                                    ref={categoryScrollRef}
                                    className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 focus:outline-none"
                                    style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                            e.preventDefault();
                                            const scrollAmount = 150;
                                            if (categoryScrollRef.current) {
                                                categoryScrollRef.current.scrollBy({
                                                    left: e.key === 'ArrowLeft' ? -scrollAmount : scrollAmount,
                                                    behavior: 'smooth'
                                                });
                                            }
                                        }
                                    }}
                                >
                                    {categories.map((category) => {
                                        const Icon = category.icon;
                                        const isActive = selectedCategory === category.id;
                                        const isMultiClip = category.id === 'multi-clip';

                                        return (
                                            <div key={category.id} className="relative flex-shrink-0">
                                                {/* Clip Thumbnails Above Multi-Clip Button */}
                                                {isMultiClip && clips.length > 0 && (
                                                    <div
                                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex gap-2 max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-hide pb-2 z-50"
                                                        style={{ maxWidth: '400px', WebkitOverflowScrolling: 'touch' }}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                        }}
                                                        onDrop={(e) => {
                                                            if (e.target === e.currentTarget) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                    >
                                                        {clips.map((clip, index) => {
                                                            const clipDuration = Math.round((clip.trimEnd - clip.trimStart) / clip.speed);
                                                            const isImage = clip.mediaType === 'image' || clip.url.toLowerCase().includes('.jpg') || clip.url.toLowerCase().includes('.png') || clip.url.toLowerCase().includes('.jpeg');
                                                            const isDragging = draggedClipId === clip.id;
                                                            const isDragOver = dragOverIndex === index && draggedClipId !== clip.id;

                                                            return (
                                                                <div
                                                                    key={clip.id}
                                                                    draggable={true}
                                                                    onDragStart={(e) => {
                                                                        console.log('🔄 DRAG START - clip:', clip.id, 'at index:', index);
                                                                        setDraggedClipId(clip.id);
                                                                        e.dataTransfer.effectAllowed = 'move';
                                                                        e.dataTransfer.dropEffect = 'move';
                                                                        e.dataTransfer.setData('text/plain', clip.id);
                                                                        e.dataTransfer.setData('application/json', JSON.stringify({ clipId: clip.id, index }));
                                                                    }}
                                                                    onDragEnd={(e) => {
                                                                        console.log('🛑 Drag ended for clip:', clip.id);
                                                                        setDraggedClipId(null);
                                                                        setDragOverIndex(null);
                                                                    }}
                                                                    onDragEnter={(e) => {
                                                                        e.preventDefault();
                                                                        if (draggedClipId && draggedClipId !== clip.id) {
                                                                            console.log('📍 Drag entered index:', index);
                                                                            setDragOverIndex(index);
                                                                        }
                                                                    }}
                                                                    onDragOver={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        e.dataTransfer.dropEffect = 'move';
                                                                        if (draggedClipId && draggedClipId !== clip.id) {
                                                                            setDragOverIndex(index);
                                                                        }
                                                                    }}
                                                                    onDragLeave={(e) => {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const x = e.clientX;
                                                                        const y = e.clientY;
                                                                        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                                                                            if (dragOverIndex === index) {
                                                                                setDragOverIndex(null);
                                                                            }
                                                                        }
                                                                    }}
                                                                    onDrop={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        console.log('📦 Drop on clip:', clip.id, 'at index:', index);
                                                                        if (draggedClipId && draggedClipId !== clip.id) {
                                                                            const draggedIndex = clips.findIndex(c => c.id === draggedClipId);
                                                                            console.log('🔄 Reordering: moving clip from index', draggedIndex, 'to index', index);
                                                                            const newClips = [...clips];
                                                                            const [draggedClip] = newClips.splice(draggedIndex, 1);
                                                                            newClips.splice(index, 0, draggedClip);
                                                                            setClips(newClips);
                                                                            console.log('✅ Clips reordered:', newClips.map((c, i) => `Clip ${i + 1}: ${c.id.substring(0, 10)}`));
                                                                        }
                                                                        setDraggedClipId(null);
                                                                        setDragOverIndex(null);
                                                                    }}
                                                                    className={`relative flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-gray-800 border border-white/20 shadow-lg transition-all cursor-move select-none ${isDragging ? 'opacity-50 scale-95' : ''
                                                                        } ${isDragOver ? 'border-blue-500 border-2 scale-105' : ''
                                                                        }`}
                                                                    style={{
                                                                        userSelect: 'none',
                                                                        WebkitUserSelect: 'none',
                                                                        touchAction: 'pan-y',
                                                                        pointerEvents: 'auto'
                                                                    }}
                                                                    onPointerDown={(e) => {
                                                                        if ((e.target as HTMLElement).closest('button')) {
                                                                            return;
                                                                        }
                                                                    }}
                                                                >
                                                                    {isImage ? (
                                                                        <img
                                                                            src={clip.url}
                                                                            alt={`Clip ${index + 1}`}
                                                                            className="w-full h-full object-cover pointer-events-none"
                                                                            draggable={false}
                                                                            onDragStart={(e) => e.preventDefault()}
                                                                        />
                                                                    ) : (
                                                                        <video
                                                                            src={clip.url}
                                                                            className="w-full h-full object-cover pointer-events-none"
                                                                            muted
                                                                            playsInline
                                                                            draggable={false}
                                                                            onDragStart={(e) => e.preventDefault()}
                                                                        />
                                                                    )}
                                                                    {/* Drag Handle */}
                                                                    <div className="absolute top-1 right-1 bg-black/70 rounded px-1.5 py-1 flex items-center gap-0.5 pointer-events-none z-20">
                                                                        <div className="w-1 h-1 rounded-full bg-white"></div>
                                                                        <div className="w-1 h-1 rounded-full bg-white"></div>
                                                                        <div className="w-1 h-1 rounded-full bg-white"></div>
                                                                    </div>
                                                                    {/* Duration Badge */}
                                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 py-1">
                                                                        <span className="text-white text-[10px] font-medium">{clipDuration}s</span>
                                                                    </div>
                                                                    {/* Reorder Buttons */}
                                                                    <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-row gap-1 z-30 pointer-events-auto">
                                                                        {index > 0 && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();
                                                                                    handleMoveClipEarlier(index);
                                                                                }}
                                                                                onMouseDown={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();
                                                                                }}
                                                                                onTouchStart={(e) => {
                                                                                    e.stopPropagation();
                                                                                }}
                                                                                className="w-5 h-5 rounded bg-black/80 hover:bg-blue-600/90 active:bg-blue-700 flex items-center justify-center transition-colors pointer-events-auto shadow-lg"
                                                                                title="Move earlier"
                                                                                style={{ pointerEvents: 'auto' }}
                                                                            >
                                                                                <FiArrowLeft className="w-3 h-3 text-white" />
                                                                            </button>
                                                                        )}
                                                                        {index < clips.length - 1 && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();
                                                                                    handleMoveClipLater(index);
                                                                                }}
                                                                                onMouseDown={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();
                                                                                }}
                                                                                onTouchStart={(e) => {
                                                                                    e.stopPropagation();
                                                                                }}
                                                                                className="w-5 h-5 rounded bg-black/80 hover:bg-blue-600/90 active:bg-blue-700 flex items-center justify-center transition-colors pointer-events-auto shadow-lg"
                                                                                title="Move later"
                                                                                style={{ pointerEvents: 'auto' }}
                                                                            >
                                                                                <FiArrowRight className="w-3 h-3 text-white" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {/* Delete Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            setClips(prev => prev.filter(c => c.id !== clip.id));
                                                                        }}
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                        }}
                                                                        onTouchStart={(e) => {
                                                                            e.stopPropagation();
                                                                        }}
                                                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600/80 flex items-center justify-center transition-colors z-10"
                                                                    >
                                                                        <FiX className="w-3 h-3 text-white" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                        {/* Add Clip Button */}
                                                        <button
                                                            onClick={() => multiClipInputRef.current?.click()}
                                                            className="flex-shrink-0 w-20 h-28 rounded-lg bg-white/10 border-2 border-dashed border-white/30 hover:bg-white/20 hover:border-white/50 flex items-center justify-center transition-all"
                                                        >
                                                            <FiPlus className="w-6 h-6 text-white" />
                                                        </button>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => handleCategoryClick(category.id)}
                                                    className={`rounded-lg p-[2px] transition-transform active:scale-[.98] flex-shrink-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${isActive ? 'animate-[shimmerGradient_3s_linear_infinite]' : ''}`}
                                                    style={isActive ? {
                                                        background: 'linear-gradient(to right, #2A1FC2, #1FC2C2, #000000, #2A1FC2, #1FC2C2, #000000)',
                                                        backgroundSize: '400% 100%',
                                                        outline: 'none',
                                                        boxShadow: 'none'
                                                    } : {}}
                                                    onFocus={(e) => {
                                                        e.currentTarget.style.outline = 'none';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }}
                                                >
                                                    <span className={`flex flex-col items-center gap-0.5 rounded-md text-white transition-all ${isActive
                                                        ? 'bg-gray-900 px-2 py-1.5'
                                                        : 'bg-white/10 border border-white/20 hover:bg-white/20 px-2 py-1.5'
                                                        }`}>
                                                        <Icon className="w-3.5 h-3.5" />
                                                        <span className="text-[9px] font-medium whitespace-nowrap leading-tight">{category.name}</span>
                                                    </span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Category Content */}
                            <div className="p-4">
                                {selectedCategory === 'filters' && (
                                    <div className="space-y-4">
                                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Video Filters</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            {filters.map((filter) => (
                                                <button
                                                    key={filter.id}
                                                    onClick={() => setActive(filter.id)}
                                                    className={`p-4 rounded-xl border-2 transition-all ${active === filter.id
                                                        ? 'bg-purple-500/30 border-purple-500/60'
                                                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <span className="text-white text-sm font-medium">{filter.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedCategory === 'adjustments' && (
                                    <div className="space-y-6">
                                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Color Adjustments</h4>
                                        <div className="space-y-5">
                                            {[
                                                {
                                                    label: 'Brightness',
                                                    icon: '☀️',
                                                    value: brightness,
                                                    min: 0.4,
                                                    max: 1.8,
                                                    step: 0.01,
                                                    onChange: (v: number) => setBrightness(v),
                                                    default: 1.0
                                                },
                                                {
                                                    label: 'Contrast',
                                                    icon: '⚡',
                                                    value: contrast,
                                                    min: 0.5,
                                                    max: 2.0,
                                                    step: 0.01,
                                                    onChange: (v: number) => setContrast(v),
                                                    default: 1.0
                                                },
                                                {
                                                    label: 'Saturation',
                                                    icon: '🌈',
                                                    value: saturation,
                                                    min: 0.0,
                                                    max: 2.0,
                                                    step: 0.01,
                                                    onChange: (v: number) => setSaturation(v),
                                                    default: 1.0
                                                },
                                                {
                                                    label: 'Hue',
                                                    icon: '🎨',
                                                    value: hue,
                                                    min: -1.0,
                                                    max: 1.0,
                                                    step: 0.001,
                                                    onChange: (v: number) => setHue(v),
                                                    default: 0.0
                                                },
                                            ].map(({ label, icon, value, min, max, step, onChange, default: defaultValue }) => {
                                                const isDefault = value === defaultValue;
                                                const percentage = ((value - min) / (max - min)) * 100;
                                                return (
                                                    <div key={label} className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">{icon}</span>
                                                                <span className="text-sm font-semibold text-white">{label}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {!isDefault && (
                                                                    <button
                                                                        onClick={() => onChange(defaultValue)}
                                                                        className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                                                                        title="Reset to default"
                                                                    >
                                                                        Reset
                                                                    </button>
                                                                )}
                                                                <span className="text-sm font-bold text-white/90 min-w-[3rem] text-right">
                                                                    {value > 0 ? '+' : ''}{((value - defaultValue) * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                type="range"
                                                                min={min}
                                                                max={max}
                                                                step={step}
                                                                value={value}
                                                                onChange={(e) => onChange(parseFloat(e.target.value))}
                                                                className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb"
                                                                style={{
                                                                    background: `linear-gradient(to right, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, 0.8) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%, rgba(255, 255, 255, 0.1) 100%)`
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {selectedCategory === 'lut' && (
                                    <div className="space-y-6">
                                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Color Grading</h4>

                                        {/* LUT Intensity */}
                                        <div className="space-y-3 mb-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">🎬</span>
                                                    <span className="text-sm font-semibold text-white">LUT Intensity</span>
                                                </div>
                                                <span className="text-sm font-bold text-white/90 min-w-[3rem] text-right">
                                                    {Math.round(lutAmount * 100)}%
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={lutAmount}
                                                onChange={(e) => setLutAmount(parseFloat(e.target.value))}
                                                className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb"
                                                style={{
                                                    background: `linear-gradient(to right, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, 0.8) ${lutAmount * 100}%, rgba(255, 255, 255, 0.1) ${lutAmount * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                                                }}
                                            />
                                        </div>

                                        {/* Built-in LUTs */}
                                        <div className="space-y-3">
                                            <label className="block text-sm font-semibold text-white mb-2">Preset LUTs</label>
                                            <select
                                                className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/10 focus:bg-white/10 focus:border-purple-500/50 transition-all cursor-pointer"
                                                value={selectedBuiltin.id}
                                                onChange={(e) => {
                                                    const item = builtinLuts.find(b => b.id === e.target.value) || builtinLuts[0];
                                                    loadBuiltinLut(item);
                                                }}
                                            >
                                                {builtinLuts.map(b => (
                                                    <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Custom LUT */}
                                        <div className="space-y-3 mt-4">
                                            <label className="block text-sm font-semibold text-white mb-2">Custom LUT</label>
                                            <label className="block w-full px-4 py-3 rounded-xl border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-sm text-white text-sm font-medium cursor-pointer hover:bg-white/10 hover:border-purple-500/50 transition-all text-center">
                                                <input type="file" accept="image/png" onChange={onPickLut} className="hidden" />
                                                <span className="flex items-center justify-center gap-2">
                                                    <FiImage className="w-4 h-4" />
                                                    Choose LUT File
                                                </span>
                                            </label>
                                            {lutMeta && (
                                                <div className="px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                                                    <p className="text-xs text-white/90 font-medium">
                                                        ✓ Loaded: {lutMeta.size}³ grid ({lutMeta.tiles}×{lutMeta.tiles} tiles)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Multi-Clip Category */}
                                {selectedCategory === 'multi-clip' && (
                                    <div className="space-y-4">
                                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Multi-Clip</h4>

                                        {/* Clips List */}
                                        {clips.length > 0 ? (
                                            <div className="space-y-3">
                                                <p className="text-white/70 text-sm mb-3">
                                                    {clips.length} clip{clips.length !== 1 ? 's' : ''} added. They will be stitched together in order.
                                                </p>

                                                {/* Horizontal Scrollable Clips */}
                                                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                                                    {clips.map((clip, index) => {
                                                        const clipDuration = Math.round((clip.trimEnd - clip.trimStart) / clip.speed);
                                                        const isImage = clip.mediaType === 'image' || clip.url.toLowerCase().includes('.jpg') || clip.url.toLowerCase().includes('.png') || clip.url.toLowerCase().includes('.jpeg');
                                                        const isDragging = draggedClipId === clip.id;
                                                        const isDragOver = dragOverIndex === index && draggedClipId !== clip.id;

                                                        return (
                                                            <div
                                                                key={clip.id}
                                                                draggable={true}
                                                                onMouseDown={(e) => {
                                                                    console.log('🖱️ Mouse down on clip (bottom sheet):', clip.id);
                                                                }}
                                                                onDragStart={(e) => {
                                                                    console.log('🔄 Drag started for clip (bottom sheet):', clip.id, 'at index:', index);
                                                                    setDraggedClipId(clip.id);
                                                                    e.dataTransfer.effectAllowed = 'move';
                                                                    e.dataTransfer.setData('text/plain', clip.id);
                                                                    e.dataTransfer.setData('application/json', JSON.stringify({ clipId: clip.id, index }));
                                                                }}
                                                                onDragEnd={(e) => {
                                                                    console.log('🛑 Drag ended (bottom sheet)');
                                                                    setDraggedClipId(null);
                                                                    setDragOverIndex(null);
                                                                }}
                                                                onDragEnter={(e) => {
                                                                    e.preventDefault();
                                                                    if (draggedClipId && draggedClipId !== clip.id) {
                                                                        console.log('📍 Drag entered index (bottom sheet):', index);
                                                                        setDragOverIndex(index);
                                                                    }
                                                                }}
                                                                onDragOver={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    e.dataTransfer.dropEffect = 'move';
                                                                    if (draggedClipId && draggedClipId !== clip.id) {
                                                                        setDragOverIndex(index);
                                                                    }
                                                                }}
                                                                onDragLeave={(e) => {
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    const x = e.clientX;
                                                                    const y = e.clientY;
                                                                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                                                                        if (dragOverIndex === index) {
                                                                            setDragOverIndex(null);
                                                                        }
                                                                    }
                                                                }}
                                                                onDrop={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    console.log('📦 Drop on clip (bottom sheet):', clip.id, 'at index:', index);
                                                                    if (draggedClipId && draggedClipId !== clip.id) {
                                                                        const draggedIndex = clips.findIndex(c => c.id === draggedClipId);
                                                                        console.log('🔄 Reordering (bottom sheet): moving clip from index', draggedIndex, 'to index', index);
                                                                        const newClips = [...clips];
                                                                        const [draggedClip] = newClips.splice(draggedIndex, 1);
                                                                        newClips.splice(index, 0, draggedClip);
                                                                        setClips(newClips);
                                                                        console.log('✅ Clips reordered (bottom sheet):', newClips.map((c, i) => `Clip ${i + 1}: ${c.id.substring(0, 10)}`));
                                                                    }
                                                                    setDraggedClipId(null);
                                                                    setDragOverIndex(null);
                                                                }}
                                                                className={`relative flex-shrink-0 w-32 h-48 rounded-lg overflow-hidden bg-gray-800 border border-white/20 transition-all cursor-move select-none ${isDragging ? 'opacity-50 scale-95' : ''
                                                                    } ${isDragOver ? 'border-blue-500 border-2 scale-105' : ''
                                                                    }`}
                                                                style={{
                                                                    userSelect: 'none',
                                                                    WebkitUserSelect: 'none',
                                                                    touchAction: 'pan-y' // Allow vertical scrolling but enable drag
                                                                }}
                                                            >
                                                                {isImage ? (
                                                                    <img
                                                                        src={clip.url}
                                                                        alt={`Clip ${index + 1}`}
                                                                        className="w-full h-full object-cover pointer-events-none"
                                                                        draggable={false}
                                                                        onDragStart={(e) => e.preventDefault()}
                                                                    />
                                                                ) : (
                                                                    <video
                                                                        src={clip.url}
                                                                        className="w-full h-full object-cover pointer-events-none"
                                                                        muted
                                                                        playsInline
                                                                        draggable={false}
                                                                        onDragStart={(e) => e.preventDefault()}
                                                                    />
                                                                )}
                                                                {/* Drag Handle Indicator */}
                                                                <div className="absolute top-2 left-2 flex gap-1 opacity-70">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                                                </div>
                                                                {/* Reorder Buttons - Left Side */}
                                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-row gap-1.5 z-30 pointer-events-auto">
                                                                    {index > 0 && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                console.log('⬅️ Move earlier button clicked (bottom sheet) for clip at index', index);
                                                                                handleMoveClipEarlier(index);
                                                                            }}
                                                                            onMouseDown={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                            }}
                                                                            onTouchStart={(e) => {
                                                                                e.stopPropagation();
                                                                            }}
                                                                            className="w-6 h-6 rounded bg-black/80 hover:bg-blue-600/90 active:bg-blue-700 flex items-center justify-center transition-colors pointer-events-auto shadow-lg"
                                                                            title="Move earlier (left)"
                                                                            style={{ pointerEvents: 'auto' }}
                                                                        >
                                                                            <FiArrowLeft className="w-3.5 h-3.5 text-white" />
                                                                        </button>
                                                                    )}
                                                                    {index < clips.length - 1 && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                console.log('➡️ Move later button clicked (bottom sheet) for clip at index', index);
                                                                                handleMoveClipLater(index);
                                                                            }}
                                                                            onMouseDown={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                            }}
                                                                            onTouchStart={(e) => {
                                                                                e.stopPropagation();
                                                                            }}
                                                                            className="w-6 h-6 rounded bg-black/80 hover:bg-blue-600/90 active:bg-blue-700 flex items-center justify-center transition-colors pointer-events-auto shadow-lg"
                                                                            title="Move later (right)"
                                                                            style={{ pointerEvents: 'auto' }}
                                                                        >
                                                                            <FiArrowRight className="w-3.5 h-3.5 text-white" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {/* Clip Info Overlay */}
                                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-2">
                                                                    <div className="text-white text-xs font-medium">Clip {index + 1}</div>
                                                                    <div className="text-white/80 text-[10px]">{clipDuration}s</div>
                                                                </div>
                                                                {/* Delete Button */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        setClips(prev => prev.filter(c => c.id !== clip.id));
                                                                    }}
                                                                    onMouseDown={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                    }}
                                                                    onTouchStart={(e) => {
                                                                        e.stopPropagation();
                                                                    }}
                                                                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600/80 flex items-center justify-center transition-colors z-10"
                                                                >
                                                                    <FiX className="w-4 h-4 text-white" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Add More Clips Button */}
                                                    <button
                                                        onClick={() => multiClipInputRef.current?.click()}
                                                        className="flex-shrink-0 w-32 h-48 rounded-lg bg-white/10 border-2 border-dashed border-white/30 hover:bg-white/20 hover:border-white/50 flex flex-col items-center justify-center gap-2 transition-all"
                                                    >
                                                        <FiPlus className="w-8 h-8 text-white" />
                                                        <span className="text-white text-xs font-medium">Add Clip</span>
                                                    </button>
                                                </div>

                                                {/* Reorder Instructions */}
                                                <div className="mt-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                                                    <p className="text-white/90 text-xs">
                                                        💡 Clips will be stitched together in the order shown (left to right). Drag clips to reorder them, or use the left/right arrow buttons on each clip to move them earlier or later in the sequence.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <FiLayers className="w-12 h-12 text-white/30 mx-auto mb-4" />
                                                <p className="text-white/70 text-sm mb-4">
                                                    No clips added yet. Add clips to stitch them together.
                                                </p>
                                                <button
                                                    onClick={() => multiClipInputRef.current?.click()}
                                                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-2 mx-auto"
                                                >
                                                    <FiPlus className="w-5 h-5" />
                                                    Add First Clip
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Trim Category */}
                                {selectedCategory === 'trim' && (
                                    <div className="space-y-6">
                                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Trim Video</h4>

                                        {clips.length > 0 ? (
                                            // Multi-clip trim mode
                                            <div className="space-y-4">
                                                <p className="text-white/70 text-sm mb-4">
                                                    Select a clip to trim, or trim the main video below.
                                                </p>

                                                {/* Clip Selection */}
                                                <div className="space-y-3">
                                                    <label className="block text-sm font-semibold text-white mb-2">Select Clip to Trim</label>
                                                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                                        {clips.map((clip, index) => {
                                                            const clipDuration = Math.round((clip.trimEnd - clip.trimStart) / clip.speed);
                                                            const isSelected = selectedClipForTrim === index;
                                                            return (
                                                                <button
                                                                    key={clip.id}
                                                                    onClick={() => setSelectedClipForTrim(isSelected ? null : index)}
                                                                    className={`flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border-2 transition-all ${isSelected
                                                                        ? 'border-blue-500 bg-blue-500/20'
                                                                        : 'border-white/20 bg-gray-800/50 hover:border-white/40'
                                                                        }`}
                                                                >
                                                                    {clip.mediaType === 'image' ? (
                                                                        <img src={clip.url} alt={`Clip ${index + 1}`} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <video src={clip.url} className="w-full h-full object-cover" muted playsInline />
                                                                    )}
                                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1">
                                                                        <div className="text-white text-xs font-medium">Clip {index + 1}</div>
                                                                        <div className="text-white/80 text-[10px]">{clipDuration}s</div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Trim Controls for Selected Clip */}
                                                {selectedClipForTrim !== null && clips[selectedClipForTrim] && (() => {
                                                    const clip = clips[selectedClipForTrim!];
                                                    const clipTrimStart = clip.trimStart;
                                                    const clipTrimEnd = clip.trimEnd;
                                                    const clipDuration = clip.duration;

                                                    return (
                                                        <div className="space-y-4 p-4 rounded-xl bg-gray-800/50 border border-white/10">
                                                            <h5 className="text-white font-semibold text-sm">Trim Clip {selectedClipForTrim! + 1}</h5>

                                                            {/* Timeline Scrubber */}
                                                            <div className="space-y-2">
                                                                <div ref={trimTimelineRef} className="relative h-12 bg-gray-900/50 rounded-lg overflow-hidden">
                                                                    <div className="absolute inset-0 flex">
                                                                        {/* Trimmed area (active) */}
                                                                        <div
                                                                            className="bg-blue-500/30 border-y border-blue-500/50"
                                                                            style={{
                                                                                width: `${((clipTrimEnd - clipTrimStart) / clipDuration) * 100}%`,
                                                                                marginLeft: `${(clipTrimStart / clipDuration) * 100}%`
                                                                            }}
                                                                        />
                                                                    </div>

                                                                    {/* Trim Handles */}
                                                                    <div
                                                                        className="absolute top-0 bottom-0 w-1 bg-yellow-400 cursor-ew-resize z-10"
                                                                        style={{ left: `${(clipTrimStart / clipDuration) * 100}%` }}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
                                                                            setIsDraggingTrimHandle('start');
                                                                        }}
                                                                    >
                                                                        <div className="absolute -top-1 -left-2 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white shadow-lg"></div>
                                                                    </div>
                                                                    <div
                                                                        className="absolute top-0 bottom-0 w-1 bg-yellow-400 cursor-ew-resize z-10"
                                                                        style={{ left: `${(clipTrimEnd / clipDuration) * 100}%` }}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
                                                                            setIsDraggingTrimHandle('end');
                                                                        }}
                                                                    >
                                                                        <div className="absolute -top-1 -left-2 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white shadow-lg"></div>
                                                                    </div>
                                                                </div>

                                                                {/* Trim Input Fields */}
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs text-white/70 font-medium">Start Time</label>
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            max={clipTrimEnd - 0.1}
                                                                            step={0.1}
                                                                            value={clipTrimStart.toFixed(1)}
                                                                            onChange={(e) => {
                                                                                const newStart = Math.max(0, Math.min(parseFloat(e.target.value) || 0, clipTrimEnd - 0.1));
                                                                                setClips(prev => prev.map((c, i) =>
                                                                                    i === selectedClipForTrim
                                                                                        ? { ...c, trimStart: newStart }
                                                                                        : c
                                                                                ));
                                                                            }}
                                                                            className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-white/20 text-white text-sm focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                        <span className="text-xs text-white/50">{clipTrimStart.toFixed(1)}s</span>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs text-white/70 font-medium">End Time</label>
                                                                        <input
                                                                            type="number"
                                                                            min={clipTrimStart + 0.1}
                                                                            max={clipDuration}
                                                                            step={0.1}
                                                                            value={clipTrimEnd.toFixed(1)}
                                                                            onChange={(e) => {
                                                                                const newEnd = Math.max(clipTrimStart + 0.1, Math.min(parseFloat(e.target.value) || clipDuration, clipDuration));
                                                                                setClips(prev => prev.map((c, i) =>
                                                                                    i === selectedClipForTrim
                                                                                        ? { ...c, trimEnd: newEnd }
                                                                                        : c
                                                                                ));
                                                                            }}
                                                                            className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-white/20 text-white text-sm focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                        <span className="text-xs text-white/50">{clipTrimEnd.toFixed(1)}s</span>
                                                                    </div>
                                                                </div>

                                                                {/* Duration Display */}
                                                                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                                                                    <span className="text-white/90 text-sm font-medium">Trimmed Duration:</span>
                                                                    <span className="text-white font-bold text-lg">{(clipTrimEnd - clipTrimStart).toFixed(1)}s</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            // Single clip trim mode
                                            <div className="space-y-4">
                                                {isImage ? (
                                                    <div className="text-center py-8">
                                                        <p className="text-white/60 text-sm">
                                                            Images cannot be trimmed. Trim is only available for videos.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Timeline Scrubber */}
                                                        <div className="space-y-2">
                                                            <div ref={trimTimelineRef} className="relative h-16 bg-gray-900/50 rounded-lg overflow-hidden">
                                                                <div className="absolute inset-0 flex">
                                                                    {/* Trimmed area (active) */}
                                                                    <div
                                                                        className="bg-blue-500/30 border-y border-blue-500/50"
                                                                        style={{
                                                                            width: `${videoDuration > 0 ? ((trimEnd - trimStart) / videoDuration) * 100 : 0}%`,
                                                                            marginLeft: `${videoDuration > 0 ? (trimStart / videoDuration) * 100 : 0}%`
                                                                        }}
                                                                    />
                                                                </div>

                                                                {/* Trim Handles */}
                                                                <div
                                                                    className="absolute top-0 bottom-0 w-1 bg-yellow-400 cursor-ew-resize z-10 hover:bg-yellow-300 transition-colors"
                                                                    style={{ left: `${videoDuration > 0 ? (trimStart / videoDuration) * 100 : 0}%` }}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        setIsDraggingTrimHandle('start');
                                                                    }}
                                                                >
                                                                    <div className="absolute -top-1 -left-2 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white shadow-lg"></div>
                                                                </div>
                                                                <div
                                                                    className="absolute top-0 bottom-0 w-1 bg-yellow-400 cursor-ew-resize z-10 hover:bg-yellow-300 transition-colors"
                                                                    style={{ left: `${videoDuration > 0 ? (trimEnd / videoDuration) * 100 : 0}%` }}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        setIsDraggingTrimHandle('end');
                                                                    }}
                                                                >
                                                                    <div className="absolute -top-1 -left-2 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white shadow-lg"></div>
                                                                </div>

                                                                {/* Time Markers */}
                                                                <div className="absolute bottom-1 left-2 text-white text-[10px] font-medium">
                                                                    {trimStart.toFixed(1)}s
                                                                </div>
                                                                <div className="absolute bottom-1 right-2 text-white text-[10px] font-medium">
                                                                    {trimEnd.toFixed(1)}s
                                                                </div>
                                                            </div>

                                                            {/* Trim Input Fields */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <label className="text-xs text-white/70 font-medium">Start Time (seconds)</label>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={trimEnd - 0.1}
                                                                        step={0.1}
                                                                        value={trimStart.toFixed(1)}
                                                                        onChange={(e) => {
                                                                            const newStart = Math.max(0, Math.min(parseFloat(e.target.value) || 0, trimEnd - 0.1));
                                                                            setTrimStart(newStart);
                                                                        }}
                                                                        className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-white/20 text-white text-sm focus:border-blue-500 focus:outline-none"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-xs text-white/70 font-medium">End Time (seconds)</label>
                                                                    <input
                                                                        type="number"
                                                                        min={trimStart + 0.1}
                                                                        max={videoDuration}
                                                                        step={0.1}
                                                                        value={trimEnd.toFixed(1)}
                                                                        onChange={(e) => {
                                                                            const newEnd = Math.max(trimStart + 0.1, Math.min(parseFloat(e.target.value) || videoDuration, videoDuration));
                                                                            setTrimEnd(newEnd);
                                                                        }}
                                                                        className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-white/20 text-white text-sm focus:border-blue-500 focus:outline-none"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Duration Display */}
                                                            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                                                                <span className="text-white/90 text-sm font-medium">Trimmed Duration:</span>
                                                                <span className="text-white font-bold text-lg">{(trimEnd - trimStart).toFixed(1)}s</span>
                                                            </div>

                                                            {/* Quick Trim Buttons */}
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setTrimStart(0);
                                                                    }}
                                                                    className="flex-1 px-4 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white text-sm font-medium transition-colors"
                                                                >
                                                                    Reset Start
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setTrimEnd(videoDuration);
                                                                    }}
                                                                    className="flex-1 px-4 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white text-sm font-medium transition-colors"
                                                                >
                                                                    Reset End
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Speed Category */}
                                {selectedCategory === 'speed' && (
                                    <div className="space-y-6">
                                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Video Speed</h4>

                                        {clips.length > 0 ? (
                                            // Multi-clip speed mode
                                            <div className="space-y-4">
                                                <p className="text-white/70 text-sm mb-4">
                                                    Select a clip to adjust speed, or adjust the main video below.
                                                </p>

                                                {/* Clip Selection */}
                                                <div className="space-y-3">
                                                    <label className="block text-sm font-semibold text-white mb-2">Select Clip to Adjust Speed</label>
                                                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                                        {clips.map((clip, index) => {
                                                            const isSelected = selectedClipForSpeed === index;
                                                            return (
                                                                <button
                                                                    key={clip.id}
                                                                    onClick={() => setSelectedClipForSpeed(isSelected ? null : index)}
                                                                    className={`flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border-2 transition-all ${isSelected
                                                                        ? 'border-purple-500 bg-purple-500/20'
                                                                        : 'border-white/20 bg-gray-800/50 hover:border-white/40'
                                                                        }`}
                                                                >
                                                                    {clip.mediaType === 'image' ? (
                                                                        <img src={clip.url} alt={`Clip ${index + 1}`} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <video src={clip.url} className="w-full h-full object-cover" muted playsInline />
                                                                    )}
                                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1">
                                                                        <div className="text-white text-xs font-medium">Clip {index + 1}</div>
                                                                        <div className="text-white/80 text-[10px]">{clip.speed}x</div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Speed Controls for Selected Clip */}
                                                {selectedClipForSpeed !== null && clips[selectedClipForSpeed] && (() => {
                                                    const clip = clips[selectedClipForSpeed!];
                                                    const clipSpeed = clip.speed;

                                                    return (
                                                        <div className="space-y-4 p-4 rounded-xl bg-gray-800/50 border border-white/10">
                                                            <h5 className="text-white font-semibold text-sm">Speed for Clip {selectedClipForSpeed! + 1}</h5>

                                                            {/* Speed Slider */}
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <FiZap className="w-5 h-5 text-purple-400" />
                                                                        <span className="text-sm font-semibold text-white">Speed</span>
                                                                    </div>
                                                                    <span className="text-sm font-bold text-white/90 min-w-[4rem] text-right">
                                                                        {clipSpeed.toFixed(2)}x
                                                                    </span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min={0.25}
                                                                    max={4}
                                                                    step={0.05}
                                                                    value={clipSpeed}
                                                                    onChange={(e) => {
                                                                        const newSpeed = parseFloat(e.target.value);
                                                                        setClips(prev => prev.map((c, i) =>
                                                                            i === selectedClipForSpeed
                                                                                ? { ...c, speed: newSpeed }
                                                                                : c
                                                                        ));
                                                                    }}
                                                                    className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb"
                                                                    style={{
                                                                        background: `linear-gradient(to right, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, 0.8) ${((clipSpeed - 0.25) / (4 - 0.25)) * 100}%, rgba(255, 255, 255, 0.1) ${((clipSpeed - 0.25) / (4 - 0.25)) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                                                                    }}
                                                                />
                                                                <div className="flex justify-between text-xs text-white/50">
                                                                    <span>0.25x (Slow)</span>
                                                                    <span>1x (Normal)</span>
                                                                    <span>4x (Fast)</span>
                                                                </div>
                                                            </div>

                                                            {/* Quick Speed Buttons */}
                                                            <div className="grid grid-cols-5 gap-2">
                                                                {[0.5, 0.75, 1.0, 1.5, 2.0].map((speedValue) => (
                                                                    <button
                                                                        key={speedValue}
                                                                        onClick={() => {
                                                                            setClips(prev => prev.map((c, i) =>
                                                                                i === selectedClipForSpeed
                                                                                    ? { ...c, speed: speedValue }
                                                                                    : c
                                                                            ));
                                                                        }}
                                                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                                            clipSpeed === speedValue
                                                                                ? 'bg-purple-600 text-white'
                                                                                : 'bg-gray-700/50 text-white/70 hover:bg-gray-600/50'
                                                                        }`}
                                                                    >
                                                                        {speedValue}x
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            // Single clip speed mode
                                            <div className="space-y-4">
                                                {isImage ? (
                                                    <div className="text-center py-8">
                                                        <p className="text-white/60 text-sm">
                                                            Images cannot have speed adjusted. Speed is only available for videos.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Speed Slider */}
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <FiZap className="w-5 h-5 text-purple-400" />
                                                                    <span className="text-sm font-semibold text-white">Playback Speed</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-white/90 min-w-[4rem] text-right">
                                                                    {speed.toFixed(2)}x
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                id="speedSlider"
                                                                min={0.25}
                                                                max={4}
                                                                step={0.05}
                                                                value={speed}
                                                                onChange={(e) => {
                                                                    const newSpeed = parseFloat(e.target.value);
                                                                    setSpeed(newSpeed);
                                                                }}
                                                                className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb"
                                                                style={{
                                                                    background: `linear-gradient(to right, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, 0.8) ${((speed - 0.25) / (4 - 0.25)) * 100}%, rgba(255, 255, 255, 0.1) ${((speed - 0.25) / (4 - 0.25)) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                                                                }}
                                                            />
                                                            <div className="flex justify-between text-xs text-white/50">
                                                                <span>0.25x (Slow)</span>
                                                                <span>1x (Normal)</span>
                                                                <span>4x (Fast)</span>
                                                            </div>
                                                        </div>

                                                        {/* Quick Speed Buttons */}
                                                        <div className="grid grid-cols-5 gap-2">
                                                            {[0.5, 0.75, 1.0, 1.5, 2.0].map((speedValue) => (
                                                                <button
                                                                    key={speedValue}
                                                                    data-speed={speedValue}
                                                                    onClick={() => setSpeed(speedValue)}
                                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                                        speed === speedValue
                                                                            ? 'bg-purple-600 text-white'
                                                                            : 'bg-gray-700/50 text-white/70 hover:bg-gray-600/50'
                                                                    }`}
                                                                >
                                                                    {speedValue}x
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Info Message */}
                                                        <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                                                            <p className="text-white/90 text-xs">
                                                                💡 Speed adjustment is previewed here. The actual speed change will be applied on the server when you upload.
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Reverse Category */}
                                {selectedCategory === 'reverse' && (
                                    <div className="space-y-6">
                                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Reverse Playback</h4>

                                        {clips.length > 0 ? (
                                            // Multi-clip reverse mode
                                            <div className="space-y-4">
                                                <p className="text-white/70 text-sm mb-4">
                                                    Select a clip to reverse, or reverse the main video below.
                                                </p>

                                                {/* Clip Selection */}
                                                <div className="space-y-3">
                                                    <label className="block text-sm font-semibold text-white mb-2">Select Clip to Reverse</label>
                                                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                                        {clips.map((clip, index) => {
                                                            const isSelected = selectedClipForReverse === index;
                                                            return (
                                                                <button
                                                                    key={clip.id}
                                                                    onClick={() => setSelectedClipForReverse(isSelected ? null : index)}
                                                                    className={`flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border-2 transition-all ${isSelected
                                                                        ? 'border-purple-500 bg-purple-500/20'
                                                                        : 'border-white/20 bg-gray-800/50 hover:border-white/40'
                                                                        }`}
                                                                >
                                                                    {clip.mediaType === 'image' ? (
                                                                        <img src={clip.url} alt={`Clip ${index + 1}`} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <video src={clip.url} className="w-full h-full object-cover" muted playsInline />
                                                                    )}
                                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1">
                                                                        <div className="text-white text-xs font-medium">Clip {index + 1}</div>
                                                                        <div className="text-white/80 text-[10px]">{clip.reverse ? '↩️ Reversed' : '▶️ Normal'}</div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Reverse Control for Selected Clip */}
                                                {selectedClipForReverse !== null && clips[selectedClipForReverse] && (() => {
                                                    const clip = clips[selectedClipForReverse!];
                                                    const clipReverse = clip.reverse;

                                                    return (
                                                        <div className="space-y-4 p-4 rounded-xl bg-gray-800/50 border border-white/10">
                                                            <h5 className="text-white font-semibold text-sm">Reverse for Clip {selectedClipForReverse! + 1}</h5>

                                                            {/* Reverse Toggle Button */}
                                                            <button
                                                                id="reverseBtn"
                                                                onClick={() => {
                                                                    const newReverse = !clipReverse;
                                                                    // Just update the reverse flag - server will handle the actual reversal
                                                                    setClips(prev => prev.map((c, i) =>
                                                                        i === selectedClipForReverse
                                                                            ? { ...c, reverse: newReverse }
                                                                            : c
                                                                    ));
                                                                }}
                                                                className={`w-full px-6 py-4 rounded-xl text-base font-semibold transition-all ${
                                                                    clipReverse
                                                                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                                        : 'bg-gray-700/50 text-white/70 hover:bg-gray-600/50'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-center gap-3">
                                                                    <FiRepeat className={`w-5 h-5 ${clipReverse ? 'rotate-180' : ''} transition-transform`} />
                                                                    <span>{clipReverse ? 'Reversed' : 'Reverse Playback'}</span>
                                                                </div>
                                                            </button>

                                                            {/* Info Message */}
                                                            <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                                                                <p className="text-white/90 text-xs">
                                                                    💡 Reverse will be applied on the server when you upload. The reversal cannot be previewed in the browser.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            // Single clip reverse mode
                                            <div className="space-y-4">
                                                {isImage ? (
                                                    <div className="text-center py-8">
                                                        <p className="text-white/60 text-sm">
                                                            Images cannot be reversed. Reverse is only available for videos.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Reverse Toggle Button */}
                                                        <button
                                                            id="reverseBtn"
                                                            onClick={() => {
                                                                const newReverse = !reverse;
                                                                setReverse(newReverse);
                                                            }}
                                                            className={`w-full px-6 py-4 rounded-xl text-base font-semibold transition-all ${
                                                                reverse
                                                                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                                    : 'bg-gray-700/50 text-white/70 hover:bg-gray-600/50'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-center gap-3">
                                                                <FiRepeat className={`w-5 h-5 ${reverse ? 'rotate-180' : ''} transition-transform`} />
                                                                <span>{reverse ? 'Reversed' : 'Reverse Playback'}</span>
                                                            </div>
                                                        </button>

                                                        {/* Info Message */}
                                                        <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                                                            <p className="text-white/90 text-xs">
                                                                💡 Reverse will be applied on the server when you upload. The reversal cannot be previewed in the browser.
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Music Category - Instagram-style with improved layout */}
                                {selectedCategory === 'music' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-white font-semibold text-lg">Music</h4>
                                            {selectedMusicUrl && (
                                                <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded-full">
                                                    Selected
                                                </span>
                                            )}
                                        </div>

                                        {/* Music Tabs: Library vs AI */}
                                        <div className="flex gap-2 mb-4 bg-gray-800/30 p-1 rounded-lg">
                                            <button
                                                onClick={() => setMusicTab('library')}
                                                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                                    musicTab === 'library'
                                                        ? 'bg-purple-600 text-white shadow-lg'
                                                        : 'text-white/60 hover:text-white/80'
                                                }`}
                                            >
                                                Library
                                            </button>
                                            <button
                                                onClick={() => setMusicTab('ai')}
                                                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                                    musicTab === 'ai'
                                                        ? 'bg-purple-600 text-white shadow-lg'
                                                        : 'text-white/60 hover:text-white/80'
                                                }`}
                                            >
                                                AI Generate
                                            </button>
                                        </div>

                                        {/* AI Music Generation Tab */}
                                        {musicTab === 'ai' && (
                                            <div className="space-y-4">
                                                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30 text-center">
                                                    <div className="mb-4">
                                                        <FiZap className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                                                        <h5 className="text-white font-semibold mb-2 text-lg">
                                                            AI Music Generation
                                                        </h5>
                                                        <p className="text-white/60 text-sm mb-4">
                                                            AI music generation requires additional setup
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-4 text-left">
                                                        <p className="text-yellow-200 text-sm mb-2">
                                                            <strong>Setup Required:</strong>
                                                        </p>
                                                        <p className="text-yellow-100/80 text-xs mb-3">
                                                            AI music generation uses a self-hosted MusicGen service that needs to be running separately. This requires:
                                                        </p>
                                                        <ul className="text-yellow-100/80 text-xs space-y-1 list-disc list-inside mb-3">
                                                            <li>Python environment with MusicGen installed</li>
                                                            <li>Service running on http://localhost:5000</li>
                                                            <li>Additional dependencies and setup</li>
                                                        </ul>
                                                        <p className="text-yellow-100/80 text-xs">
                                                            See <code className="bg-yellow-900/30 px-1 rounded">musicgen-service/README.md</code> for setup instructions.
                                                        </p>
                                                    </div>

                                                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                                                        <p className="text-blue-200 text-sm font-medium mb-2">
                                                            💡 Use the Library Tab Instead
                                                        </p>
                                                        <p className="text-blue-100/80 text-xs mb-3">
                                                            The <strong>Library</strong> tab has 17+ royalty-free tracks ready to use right now - no setup required!
                                                        </p>
                                                        <button
                                                            onClick={() => setMusicTab('library')}
                                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm"
                                                        >
                                                            Go to Library
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Library Music Tab */}
                                        {musicTab === 'library' && (
                                            <>
                                        {/* Search Bar */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search music..."
                                                value={libraryFilters.search}
                                                onChange={(e) => {
                                                    setLibraryFilters({ ...libraryFilters, search: e.target.value });
                                                    // Auto-search on type
                                                    if (e.target.value.length > 2 || e.target.value.length === 0) {
                                                        setLibraryLoading(true);
                                                        (async () => {
                                                            try {
                                                                const { getMusicLibrary } = await import('../api/music');
                                                                const result = await getMusicLibrary({
                                                                    search: e.target.value || undefined,
                                                                    genre: libraryFilters.genre || undefined,
                                                                    mood: libraryFilters.mood || undefined,
                                                                });
                                                                if (result.success && result.data) {
                                                                    setLibraryTracks(Array.isArray(result.data) ? result.data : []);
                                                                }
                                                            } catch (error: any) {
                                                                console.error('Failed to search music:', error);
                                                                // Silently fail for search - don't show modal on every keystroke
                                                                // The main error message is already shown when music section opens
                                                            } finally {
                                                                setLibraryLoading(false);
                                                            }
                                                        })();
                                                    }
                                                }}
                                                className="w-full px-4 py-3 pl-10 rounded-xl bg-gray-800/50 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                                            />
                                            <FiMusic className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                        </div>

                                        {/* Genre & Mood Filters */}
                                        <div className="flex flex-wrap gap-2">
                                            {['All', 'Pop', 'Rock', 'Electronic', 'Hip-Hop', 'Jazz', 'Classical', 'Ambient'].map((genre) => (
                                            <button
                                                    key={genre}
                                                    onClick={async () => {
                                                        const newGenre = genre === 'All' ? '' : genre.toLowerCase();
                                                        setLibraryLoading(true);
                                                        try {
                                                            const { getMusicLibrary } = await import('../api/music');
                                                            const result = await getMusicLibrary({
                                                                genre: newGenre || undefined,
                                                                mood: libraryFilters.mood || undefined,
                                                                search: libraryFilters.search || undefined,
                                                            });
                                                            if (result.success && result.data) {
                                                                setLibraryTracks(Array.isArray(result.data) ? result.data : []);
                                                                setLibraryFilters({ ...libraryFilters, genre: newGenre });
                                                            }
                                                        } catch (error: any) {
                                                            console.error('Failed to filter music:', error);
                                                            // Check if it's a connection error
                                                            const isConnectionError = error?.message?.includes('Failed to fetch') || 
                                                                                     error?.message?.includes('Cannot connect') ||
                                                                                     error?.message?.includes('Connection refused');
                                                            
                                                            if (isConnectionError) {
                                                                // Show user-friendly error message
                                                                Swal.fire({
                                                                    title: 'Backend Not Running',
                                                                    html: `
                                                                        <div style="text-align: center; padding: 10px 0;">
                                                                            <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0 0 10px 0;">
                                                                                The Laravel backend server needs to be running to filter music.
                                                                            </p>
                                                                            <p style="color: #ffffff; font-size: 12px; line-height: 18px; margin: 0;">
                                                                                Please start the backend server and try again.
                                                                            </p>
                                                                        </div>
                                                                    `,
                                                                    showConfirmButton: true,
                                                                    confirmButtonText: 'OK',
                                                                    confirmButtonColor: '#0095f6',
                                                                    background: '#262626',
                                                                    color: '#ffffff',
                                                                    customClass: {
                                                                        popup: 'instagram-style-modal',
                                                                        title: 'instagram-modal-title',
                                                                        htmlContainer: 'instagram-modal-content',
                                                                        confirmButton: 'instagram-confirm-btn',
                                                                    }
                                                                });
                                                            }
                                                        } finally {
                                                            setLibraryLoading(false);
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                        (genre === 'All' && !libraryFilters.genre) || libraryFilters.genre === genre.toLowerCase()
                                                            ? 'bg-purple-600 text-white'
                                                            : 'bg-gray-800/50 text-white/70 hover:bg-gray-700/50'
                                                    }`}
                                                >
                                                    {genre}
                                            </button>
                                            ))}
                                        </div>

                                        {/* Tracks List - Instagram-style cards */}
                                        {libraryLoading ? (
                                            <div className="text-center py-12">
                                                <div className="w-8 h-8 border-2 border-white/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3"></div>
                                                <p className="text-white/60 text-sm">Loading music...</p>
                                            </div>
                                        ) : libraryTracks.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                                <div className="text-xs text-white/40 mb-2 px-1">
                                                    {libraryTracks.length} tracks available - scroll to see more
                                                </div>
                                                {libraryTracks.map((track) => {
                                                    const isSelected = selectedMusicUrl && (window as any).selectedMusicTrackId === track.id;
                                                    return (
                                                        <div
                                                            key={track.id}
                                                            className={`group relative p-3 rounded-xl cursor-pointer transition-all ${
                                                                isSelected
                                                                    ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-2 border-purple-500 shadow-lg shadow-purple-500/20'
                                                                    : 'bg-gray-800/50 border border-white/10 hover:bg-gray-700/50 hover:border-white/20'
                                                            }`}
                                                            onClick={async () => {
                                                                const trackId = typeof track.id === 'string' ? parseInt(track.id, 10) : track.id;
                                                                (window as any).selectedMusicTrackId = trackId;
                                                                const musicUrl = track.preview_url || track.url || `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/music/file/${trackId}`;
                                                                
                                                                if (musicAudioRef.current) {
                                                                    musicAudioRef.current.pause();
                                                                    musicAudioRef.current = null;
                                                                }
                                                                
                                                                setSelectedMusicUrl(musicUrl);
                                                                // Mute video audio by default (Instagram style)
                                                                setVideoVolume(0);
                                                                if (videoRef.current) {
                                                                    videoRef.current.volume = 0;
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {/* Cover Image or Icon */}
                                                                <div className="relative w-14 h-14 rounded-lg bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                                    {track.cover || track.image ? (
                                                                        <img 
                                                                            src={track.cover || track.image} 
                                                                            alt={track.title}
                                                                            className="w-full h-full object-cover"
                                                                            onError={(e) => {
                                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <FiMusic className={`w-6 h-6 ${track.cover || track.image ? 'hidden' : 'text-purple-400'}`} />
                                                                    {isSelected && (
                                                                        <div className="absolute inset-0 bg-purple-500/40 flex items-center justify-center">
                                                                            <div className="w-3 h-3 rounded-full bg-white"></div>
                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Track Info */}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-white font-semibold truncate text-sm">{track.title}</p>
                                                                    <p className="text-white/60 text-xs truncate mt-0.5">
                                                                        {track.artist || 'Unknown Artist'}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        {track.genre && (
                                                                            <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                                                                                {track.genre}
                                                                            </span>
                                                                        )}
                                                                        {track.mood && (
                                                                            <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                                                                                {track.mood}
                                                                            </span>
                                                                        )}
                                                        </div>
                                                    </div>

                                                                {/* Like Button */}
                                                    <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const trackId = typeof track.id === 'string' ? parseInt(track.id, 10) : track.id;
                                                                        setLikedTracks(prev => {
                                                                            const next = new Set(prev);
                                                                            if (next.has(trackId)) {
                                                                                next.delete(trackId);
                                                                            } else {
                                                                                next.add(trackId);
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                                                                        likedTracks.has(typeof track.id === 'string' ? parseInt(track.id, 10) : track.id)
                                                                            ? 'bg-red-500/20 hover:bg-red-500/30'
                                                                            : 'bg-white/5 hover:bg-white/10'
                                                                    }`}
                                                                >
                                                                    <FiHeart 
                                                                        className={`w-4 h-4 transition-colors ${
                                                                            likedTracks.has(typeof track.id === 'string' ? parseInt(track.id, 10) : track.id)
                                                                                ? 'text-red-500 fill-red-500'
                                                                                : 'text-white/60'
                                                                        }`}
                                                                    />
                                                                </button>

                                                                {/* Preview Button */}
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        const trackId = typeof track.id === 'string' ? parseInt(track.id, 10) : track.id;
                                                                        const musicUrl = track.preview_url || track.url || `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/music/file/${trackId}`;
                                                                        
                                                                        // Validate URL before creating Audio element
                                                                        if (!musicUrl || (!musicUrl.startsWith('http') && !musicUrl.startsWith('blob:') && !musicUrl.startsWith('data:'))) {
                                                                            console.warn('Invalid music URL:', musicUrl);
                                                                    Swal.fire({
                                                                                icon: 'info',
                                                                                title: 'Preview Not Available',
                                                                                text: 'Audio preview is not available for this track. The music will be added when you post.',
                                                                        confirmButtonColor: '#6366f1',
                                                                        background: '#1f2937',
                                                                        color: '#fff'
                                                                    });
                                                                    return;
                                                                }

                                                                        if (!musicAudioRef.current || musicAudioRef.current.src !== musicUrl) {
                                                                            if (musicAudioRef.current) {
                                                                                musicAudioRef.current.pause();
                                                                                musicAudioRef.current = null;
                                                                            }
                                                                            
                                                                            try {
                                                                                // Initialize AudioContext if needed
                                                                                if (!audioContext) {
                                                                                    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                                                                                    setAudioContext(ctx);
                                                                                }
                                                                                
                                                                                // Create Audio element with error handling
                                                                                const audio = new Audio();
                                                                                audio.volume = musicVolume;
                                                                                audio.loop = true;
                                                                                
                                                                                // Add error handler before setting src
                                                                                audio.addEventListener('error', (e) => {
                                                                                    console.warn('Audio loading error:', e, 'URL:', musicUrl);
                                                                                    setIsMusicPlaying(false);
                                                                                    // Don't show alert on every error - just log it
                                                                                    // The user can still select the track for posting
                                                                                });
                                                                                
                                                                                // Add load error handler
                                                                                audio.addEventListener('loadstart', () => {
                                                                                    console.log('Audio loading started:', musicUrl);
                                                                                });
                                                                                
                                                                                audio.addEventListener('canplay', () => {
                                                                                    console.log('Audio can play:', musicUrl);
                                                                                });
                                                                                
                                                                                audio.src = musicUrl;
                                                                                musicAudioRef.current = audio;
                                                                                
                                                                                // Setup audio analyser after src is set
                                                                                if (audioContext) {
                                                                                    try {
                                                                                        const source = audioContext.createMediaElementSource(audio);
                                                                                        const analyser = audioContext.createAnalyser();
                                                                                        analyser.fftSize = 256;
                                                                                        analyser.smoothingTimeConstant = 0.8;
                                                                                        source.connect(analyser);
                                                                                        analyser.connect(audioContext.destination);
                                                                                        setAudioAnalyser(analyser);
                                                                                    } catch (analyserError) {
                                                                                        console.warn('Could not setup audio analyser:', analyserError);
                                                                                    }
                                                                                }
                                                                                
                                                                                // Try to play - if it fails, don't show error (user can still select track)
                                                                                try {
                                                                                    await audio.play();
                                                                                    setIsMusicPlaying(true);
                                                                                } catch (playError: any) {
                                                                                    console.warn('Could not play preview (this is okay):', playError);
                                                                                    setIsMusicPlaying(false);
                                                                                    // Don't show alert - track can still be selected for posting
                                                                                    // The error handler will catch loading failures silently
                                                                                }
                                                                                
                                                                                audio.addEventListener('pause', () => setIsMusicPlaying(false));
                                                                                audio.addEventListener('play', () => setIsMusicPlaying(true));
                                                                            } catch (error) {
                                                                                console.warn('Could not create audio preview:', error);
                                                                                setIsMusicPlaying(false);
                                                                                // Don't show alert - track can still be selected for posting
                                                                            }
                                                                        } else {
                                                                            // Same track is already loaded - toggle play/pause
                                                                            if (musicAudioRef.current) {
                                                                                // Check if audio has a valid source
                                                                                const currentSrc = musicAudioRef.current.src;
                                                                                const hasValidSource = currentSrc && 
                                                                                    currentSrc !== '' && 
                                                                                    currentSrc !== window.location.href &&
                                                                                    (currentSrc.startsWith('http') || currentSrc.startsWith('blob:') || currentSrc.startsWith('data:'));
                                                                                
                                                                                if (!hasValidSource) {
                                                                                    console.warn('Audio element has no valid source, recreating...');
                                                                                    // Recreate audio element with valid URL
                                                                                    const audio = new Audio();
                                                                                    audio.volume = musicVolume;
                                                                                    audio.loop = true;
                                                                                    audio.src = musicUrl;
                                                                                    musicAudioRef.current = audio;
                                                                                    
                                                                                    try {
                                                                                        await audio.play();
                                                                                        setIsMusicPlaying(true);
                                                                                    } catch (playError: any) {
                                                                                        console.warn('Could not play after recreating:', playError);
                                                                                        setIsMusicPlaying(false);
                                                                                    }
                                                                                } else if (musicAudioRef.current.paused) {
                                                                                    // Check if audio has a valid source before trying to play
                                                                                    const currentSrc = musicAudioRef.current.src;
                                                                                    const hasValidSource = currentSrc && 
                                                                                        currentSrc !== '' && 
                                                                                        currentSrc !== window.location.href &&
                                                                                        (currentSrc.startsWith('http') || currentSrc.startsWith('blob:') || currentSrc.startsWith('data:'));
                                                                                    
                                                                                    // Check if preview failed
                                                                                    const previewFailed = (musicAudioRef.current as any).__previewFailed;
                                                                                    
                                                                                    if (!hasValidSource || previewFailed) {
                                                                                        // Silently handle - just log to console
                                                                                        // Music will still be added when posting, so no need to alert user
                                                                                        console.log('Preview not available for this track - music will be added when posting');
                                                                                        setIsMusicPlaying(false);
                                                                                    } else {
                                                                                        try {
                                                                                            await musicAudioRef.current.play();
                                                                                            setIsMusicPlaying(true);
                                                                                        } catch (playError: any) {
                                                                                            console.warn('Could not resume playback:', playError);
                                                                                            setIsMusicPlaying(false);
                                                                                            // Mark as failed
                                                                                            if (musicAudioRef.current) {
                                                                                                (musicAudioRef.current as any).__previewFailed = true;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                } else {
                                                                                    musicAudioRef.current.pause();
                                                                                    setIsMusicPlaying(false);
                                                                                }
                                                                            }
                                                                        }
                                                                    }}
                                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                                                                        isMusicPlaying && (window as any).selectedMusicTrackId === track.id
                                                                            ? 'bg-purple-500 hover:bg-purple-600'
                                                                            : 'bg-white/10 hover:bg-white/20'
                                                                    }`}
                                                                >
                                                                    {isMusicPlaying && (window as any).selectedMusicTrackId === track.id ? (
                                                                        <div className="w-3 h-3 flex items-center justify-center gap-0.5">
                                                                            <div className="w-0.5 h-2 bg-white rounded-full"></div>
                                                                            <div className="w-0.5 h-3 bg-white rounded-full"></div>
                                                                            <div className="w-0.5 h-2 bg-white rounded-full"></div>
                                                    </div>
                                                                    ) : (
                                                                        <FiPlay className="w-4 h-4 text-white ml-0.5" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : libraryTracks.length === 0 && !libraryLoading ? (
                                            <div className="text-center py-12 px-4">
                                                <FiMusic className="w-16 h-16 text-white/20 mx-auto mb-3" />
                                                <p className="text-white/60 text-sm font-medium mb-2">Music Library Unavailable</p>
                                                <p className="text-white/40 text-xs mb-4">
                                                    The Laravel backend server needs to be running to load music tracks.
                                                </p>
                                                <div className="bg-gray-800/50 rounded-lg p-4 text-left max-w-md mx-auto">
                                                    <p className="text-white/70 text-xs font-medium mb-2">To start the backend:</p>
                                                    <ol className="text-white/50 text-xs space-y-1 list-decimal list-inside">
                                                        <li>Open terminal in the <code className="bg-gray-900/50 px-1 rounded">laravel-backend</code> directory</li>
                                                        <li>Run: <code className="bg-gray-900/50 px-1 rounded">php artisan serve</code></li>
                                                        <li>Refresh this page</li>
                                                    </ol>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setLibraryTracks([]);
                                                        setLibraryLoading(false);
                                                        // Force reload by clearing state
                                                        const currentCategory = selectedCategory;
                                                        setSelectedCategory(null);
                                                        setTimeout(() => setSelectedCategory(currentCategory), 100);
                                                    }}
                                                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    Retry Loading
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <FiMusic className="w-16 h-16 text-white/20 mx-auto mb-3" />
                                                <p className="text-white/60 text-sm font-medium">No music found</p>
                                                <p className="text-white/40 text-xs mt-1">Try different search terms or filters</p>
                                            </div>
                                        )}

                                        {/* Audio Volume Controls - Bottom Sheet Style */}
                                        <div className="mt-4 pt-4 border-t border-white/10 bg-black/85 rounded-t-3xl px-4 pb-6">
                                            {/* Waveform Visualization - Only when music is playing */}
                                            {selectedMusicUrl && isMusicPlaying && (
                                                <div className="relative h-16 rounded-lg bg-gradient-to-b from-purple-900/20 to-pink-900/20 p-3 overflow-hidden mb-4">
                                                    {/* Bass glow effect */}
                                                    <div 
                                                        className="absolute inset-0 opacity-30 blur-xl transition-opacity"
                                                        style={{
                                                            background: `radial-gradient(circle at center, rgba(168, 85, 247, ${bassLevel * 0.8}), transparent)`,
                                                        }}
                                                    />
                                                    
                                                    {/* Waveform bars */}
                                                    <div className="relative h-full flex items-end justify-center gap-1">
                                                        {waveHeights.map((height, index) => (
                                                            <div
                                                                key={index}
                                                                className="w-1.5 bg-gradient-to-t from-purple-400 to-pink-400 rounded-full transition-all duration-75"
                                                                style={{
                                                                    height: `${height}px`,
                                                                    minHeight: '4px',
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Title */}
                                            <h5 className="text-white text-base font-semibold mb-4 text-center">Audio Controls</h5>

                                            {/* Original Video Audio Volume */}
                                            <div className="mb-5">
                                                <div className="flex items-center mb-1">
                                                    <span className="text-lg w-7">🎤</span>
                                                    <span className="flex-1 text-white text-sm font-medium">Original audio</span>
                                                    <span className="w-10 text-right text-white/70 text-sm">{Math.round(videoVolume * 100)}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    value={videoVolume}
                                                    onChange={(e) => {
                                                        const vol = parseFloat(e.target.value);
                                                        setVideoVolume(vol);
                                                        if (videoRef.current) {
                                                            videoRef.current.volume = vol;
                                                        }
                                                    }}
                                                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                                    style={{
                                                        background: `linear-gradient(to right, #fff 0%, #fff ${videoVolume * 100}%, #555 ${videoVolume * 100}%, #555 100%)`
                                                    }}
                                                />
                                            </div>

                                            {/* Music Volume - Only when music is selected */}
                                            {selectedMusicUrl && (
                                                <div className="mb-5">
                                                    <div className="flex items-center mb-1">
                                                        <span className="text-lg w-7">🎵</span>
                                                        <span className="flex-1 text-white text-sm font-medium">Added music</span>
                                                        <span className="w-10 text-right text-white/70 text-sm">{Math.round(musicVolume * 100)}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={1}
                                                        step={0.01}
                                                        value={musicVolume}
                                                        onChange={(e) => {
                                                            const vol = parseFloat(e.target.value);
                                                            setMusicVolume(vol);
                                                            if (musicAudioRef.current) {
                                                                musicAudioRef.current.volume = vol;
                                                            }
                                                        }}
                                                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                                        style={{
                                                            background: `linear-gradient(to right, #fff 0%, #fff ${musicVolume * 100}%, #555 ${musicVolume * 100}%, #555 100%)`
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {/* Remove Music Button - Only when music is selected */}
                                            {selectedMusicUrl && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedMusicUrl(null);
                                                        setIsMusicPlaying(false);
                                                        if (musicAudioRef.current) {
                                                            musicAudioRef.current.pause();
                                                            musicAudioRef.current = null;
                                                        }
                                                        if (waveformAnimationRef.current) {
                                                            cancelAnimationFrame(waveformAnimationRef.current);
                                                            waveformAnimationRef.current = null;
                                                        }
                                                        setAudioAnalyser(null);
                                                        (window as any).selectedMusicTrackId = undefined;
                                                        // Restore video audio
                                                        setVideoVolume(1);
                                                        if (videoRef.current) {
                                                            videoRef.current.volume = 1;
                                                        }
                                                    }}
                                                    className="w-full mt-4 px-4 py-2.5 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 transition-colors font-medium flex items-center justify-center gap-2"
                                                >
                                                    <FiX className="w-4 h-4" />
                                                    Remove Music
                                                </button>
                                            )}
                                        </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* OLD CODE REMOVED - All tabs (AI, Upload, Library) removed - using simplified Instagram-style above */}

                                {/* Transitions Section */}
                                {selectedCategory === 'transitions' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-white font-semibold text-lg">Transitions</h4>
                                            {clips.length < 2 && (
                                                <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full">
                                                    Add 2+ clips to use transitions
                                                </span>
                                            )}
                                        </div>

                                        {/* Add Clip Button - Always visible */}
                                        <div className="mb-4">
                                            <button
                                                onClick={() => multiClipInputRef.current?.click()}
                                                className="w-full px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border-2 border-dashed border-purple-500/50 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2"
                                            >
                                                <FiPlus className="w-5 h-5" />
                                                <span>Add Video/Image Clip</span>
                                            </button>
                                        </div>

                                        {/* Current Clips List */}
                                        {clips.length > 0 && (
                                            <div className="mb-4 p-3 bg-gray-800/30 rounded-lg">
                                                <p className="text-white/60 text-xs mb-2">Current clips ({clips.length}):</p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {clips.map((clip, index) => (
                                                        <div
                                                            key={clip.id}
                                                            className="px-2 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-white flex items-center gap-1"
                                                        >
                                                            <span>Clip {index + 1}</span>
                                                            <button
                                                                onClick={() => {
                                                                    setClips(prev => prev.filter(c => c.id !== clip.id));
                                                                    // Remove transition if this clip is removed
                                                                    if (index < transitions.length) {
                                                                        setTransitions(prev => prev.filter((_, i) => i !== index && i !== index - 1));
                                                                    }
                                                                }}
                                                                className="ml-1 hover:text-red-400"
                                                            >
                                                                <FiX className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {clips.length >= 2 ? (
                                            <>
                                                {/* Transition Selection Grid - Matching FFmpeg xfade transitions */}
                                                <div className="grid grid-cols-3 gap-3 mb-4">
                                                    {[
                                                        { id: 'none', name: 'None', icon: '—', ffmpeg: 'none' },
                                                        { id: 'fade', name: 'Fade', icon: '↔', ffmpeg: 'fade' },
                                                        { id: 'crossfade', name: 'Crossfade', icon: '↔', ffmpeg: 'fade' },
                                                        { id: 'slideleft', name: 'Slide Left', icon: '←', ffmpeg: 'slideleft' },
                                                        { id: 'slideright', name: 'Slide Right', icon: '→', ffmpeg: 'slideright' },
                                                        { id: 'slideup', name: 'Slide Up', icon: '↑', ffmpeg: 'slideup' },
                                                        { id: 'slidedown', name: 'Slide Down', icon: '↓', ffmpeg: 'slidedown' },
                                                        { id: 'wiperight', name: 'Wipe Right', icon: '→', ffmpeg: 'wiperight' },
                                                        { id: 'wipeleft', name: 'Wipe Left', icon: '←', ffmpeg: 'wipeleft' },
                                                        { id: 'zoom', name: 'Zoom', icon: '⊕', ffmpeg: 'zoom' },
                                                        { id: 'zoomin', name: 'Zoom In', icon: '⊕', ffmpeg: 'zoomin' },
                                                        { id: 'zoomout', name: 'Zoom Out', icon: '⊖', ffmpeg: 'zoomout' },
                                                        { id: 'spin', name: 'Spin', icon: '⟲', ffmpeg: 'spin' },
                                                        { id: 'fadewhite', name: 'Flash', icon: '⚡', ffmpeg: 'fadewhite' },
                                                        { id: 'fadeblack', name: 'Fade Black', icon: '⬛', ffmpeg: 'fadeblack' },
                                                    ].map((transition) => (
                                                        <button
                                                            key={transition.id}
                                                            onClick={() => {
                                                                // Apply transition to all clip boundaries
                                                                const newTransitions: Transition[] = [];
                                                                for (let i = 0; i < clips.length - 1; i++) {
                                                                    newTransitions.push({
                                                                        type: transition.id as Transition['type'],
                                                                        duration: 0.5,
                                                                        direction: transition.id.includes('slide') ? 'right' : undefined,
                                                                    });
                                                                }
                                                                setTransitions(newTransitions);
                                                            }}
                                                            className={`p-4 rounded-xl border-2 transition-all ${
                                                                transitions.length > 0 && transitions[0]?.type === transition.id
                                                                    ? 'bg-purple-500/30 border-purple-500/60 shadow-lg shadow-purple-500/20'
                                                                    : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30'
                                                            }`}
                                                        >
                                                            <div className="text-2xl mb-1">{transition.icon}</div>
                                                            <div className="text-white text-xs font-medium">{transition.name}</div>
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Transition Duration Slider */}
                                                {transitions.length > 0 && transitions[0]?.type !== 'none' && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-white text-sm font-medium">Transition Duration</span>
                                                            <span className="text-white/70 text-sm">{transitions[0]?.duration.toFixed(1)}s</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0.1"
                                                            max="2.0"
                                                            step="0.1"
                                                            value={transitions[0]?.duration || 0.5}
                                                            onChange={(e) => {
                                                                const newDuration = parseFloat(e.target.value);
                                                                setTransitions(prev => prev.map(t => ({ ...t, duration: newDuration })));
                                                            }}
                                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                                        />
                                                    </div>
                                                )}

                                                {/* Transition Preview - Show which clips have transitions */}
                                                <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
                                                    <p className="text-white/60 text-xs mb-2">Transitions between clips:</p>
                                                    <div className="flex gap-2 flex-wrap mb-3">
                                                        {Array.from({ length: clips.length - 1 }).map((_, index) => (
                                                            <div
                                                                key={index}
                                                                className="px-2 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-white"
                                                            >
                                                                Clip {index + 1} → {index + 2}: {transitions[index]?.type || 'none'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    {/* Transition Preview Canvas */}
                                                    {transitions.length > 0 && transitions[0]?.type !== 'none' && clips.length >= 2 && (
                                                        <div className="mt-3">
                                                            <p className="text-white/60 text-xs mb-2">Preview (animated):</p>
                                                            <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ height: '180px', minHeight: '180px' }}>
                                                                <canvas
                                                                    ref={transitionCanvasRef}
                                                                    className="w-full h-full"
                                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-8">
                                                <FiGrid className="w-16 h-16 text-white/20 mx-auto mb-3" />
                                                <p className="text-white/60 text-sm mb-2">
                                                    {clips.length === 0 
                                                        ? 'Add 2+ clips to use transitions' 
                                                        : `Add ${2 - clips.length} more clip${2 - clips.length > 1 ? 's' : ''} to use transitions`
                                                    }
                                                </p>
                                                <p className="text-white/40 text-xs mt-1">Transitions appear between consecutive clips</p>
                                                {clips.length === 1 && (
                                                    <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
                                                        <p className="text-white/60 text-xs mb-2">Current clips:</p>
                                                        <div className="flex gap-2 justify-center">
                                                            <div className="px-2 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-white">
                                                                Clip 1
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Voice-over Section */}
                                {selectedCategory === 'voiceover' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-white font-semibold text-lg">Voice Over</h4>
                                            {voiceoverUrl && (
                                                <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded-full">
                                                    Recorded
                                                </span>
                                            )}
                                        </div>

                                        {/* Timeline Scrubber for Start Time */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-white text-sm font-medium">Start Time</span>
                                                <span className="text-white/70 text-sm">{voiceoverStartTime.toFixed(1)}s</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max={timelineDuration || videoDuration || 90}
                                                step="0.1"
                                                value={voiceoverStartTime}
                                                onChange={(e) => {
                                                    const time = parseFloat(e.target.value);
                                                    setVoiceoverStartTime(time);
                                                    // Seek video to this time for preview
                                                    if (videoRef.current) {
                                                        videoRef.current.currentTime = time;
                                                    }
                                                }}
                                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                            />
                                            <div className="flex gap-2 text-xs text-white/50">
                                                <button
                                                    onClick={() => {
                                                        if (videoRef.current) {
                                                            const newTime = Math.max(0, videoRef.current.currentTime - 1);
                                                            setVoiceoverStartTime(newTime);
                                                            videoRef.current.currentTime = newTime;
                                                        }
                                                    }}
                                                    className="px-2 py-1 bg-gray-800/50 rounded hover:bg-gray-700/50"
                                                >
                                                    -1s
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (videoRef.current) {
                                                            const newTime = Math.min(timelineDuration || videoDuration || 90, videoRef.current.currentTime + 1);
                                                            setVoiceoverStartTime(newTime);
                                                            videoRef.current.currentTime = newTime;
                                                        }
                                                    }}
                                                    className="px-2 py-1 bg-gray-800/50 rounded hover:bg-gray-700/50"
                                                >
                                                    +1s
                                                </button>
                                            </div>
                                        </div>

                                        {/* Hold to Record Button */}
                                        <div className="flex flex-col items-center gap-4">
                                            <button
                                                onMouseDown={async () => {
                                                    try {
                                                        // Request microphone access first (before playing video)
                                                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                                        const mediaRecorder = new MediaRecorder(stream);
                                                        mediaRecorderRef.current = mediaRecorder;
                                                        audioChunksRef.current = [];
                                                        
                                                        mediaRecorder.ondataavailable = (e) => {
                                                            if (e.data.size > 0) {
                                                                audioChunksRef.current.push(e.data);
                                                            }
                                                        };
                                                        
                                                        mediaRecorder.onstop = () => {
                                                            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                                                            setVoiceoverBlob(blob);
                                                            const url = URL.createObjectURL(blob);
                                                            setVoiceoverUrl(url);
                                                            
                                                            // Stop video playback
                                                            if (videoRef.current) {
                                                                videoRef.current.pause();
                                                            }
                                                            
                                                            // Stop microphone stream
                                                            stream.getTracks().forEach(track => track.stop());
                                                            
                                                            // Play preview
                                                            if (voiceoverAudioRef.current) {
                                                                voiceoverAudioRef.current.src = url;
                                                                voiceoverAudioRef.current.load();
                                                            }
                                                        };
                                                        
                                                        // Start recording
                                                        mediaRecorder.start();
                                                        setIsRecordingVoiceover(true);
                                                        
                                                        // Seek and play video after recording starts
                                                        if (videoRef.current) {
                                                            videoRef.current.currentTime = voiceoverStartTime;
                                                            // Play video - handle promise rejection gracefully
                                                            videoRef.current.play().catch((playError) => {
                                                                // Ignore play interruption errors - they're expected if user releases button quickly
                                                                if (playError.name !== 'AbortError' && playError.name !== 'NotAllowedError') {
                                                                    console.warn('Video play error during voice-over:', playError);
                                                                }
                                                            });
                                                        }
                                                    } catch (error: any) {
                                                        console.error('Error starting voice-over recording:', error);
                                                        setIsRecordingVoiceover(false);
                                                        
                                                        let errorMessage = 'Please allow microphone access to record voice-over.';
                                                        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                                                            errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings.';
                                                        } else if (error.name === 'NotFoundError') {
                                                            errorMessage = 'No microphone found. Please connect a microphone and try again.';
                                                        }
                                                        
                                                        Swal.fire({
                                                            title: 'Microphone Access Required',
                                                            html: `
                                                                <div style="text-align: center; padding: 10px 0;">
                                                                    <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                                                                        ${errorMessage}
                                                                    </p>
                                                                </div>
                                                            `,
                                                            showConfirmButton: true,
                                                            confirmButtonText: 'OK',
                                                            confirmButtonColor: '#0095f6',
                                                            background: '#262626',
                                                            color: '#ffffff',
                                                        });
                                                    }
                                                }}
                                                onMouseUp={async () => {
                                                    if (mediaRecorderRef.current && isRecordingVoiceover) {
                                                        mediaRecorderRef.current.stop();
                                                        setIsRecordingVoiceover(false);
                                                        
                                                        // Stop video playback
                                                        if (videoRef.current) {
                                                            videoRef.current.pause();
                                                        }
                                                    }
                                                }}
                                                onMouseLeave={() => {
                                                    // Stop recording if mouse leaves button
                                                    if (mediaRecorderRef.current && isRecordingVoiceover) {
                                                        mediaRecorderRef.current.stop();
                                                        setIsRecordingVoiceover(false);
                                                        if (videoRef.current) {
                                                            videoRef.current.pause();
                                                        }
                                                    }
                                                }}
                                                className={`w-20 h-20 rounded-full text-white font-semibold transition-all flex items-center justify-center ${
                                                    isRecordingVoiceover
                                                        ? 'bg-red-600 scale-110 animate-pulse'
                                                        : 'bg-red-500 hover:bg-red-600'
                                                }`}
                                            >
                                                {isRecordingVoiceover ? (
                                                    <div className="w-4 h-4 bg-white rounded"></div>
                                                ) : (
                                                    <FiVolume2 className="w-8 h-8" />
                                                )}
                                            </button>
                                            <p className="text-white/60 text-sm text-center">
                                                {isRecordingVoiceover ? 'Recording... Release to stop' : 'Hold to Record'}
                                            </p>
                                        </div>

                                        {/* Voice-over Controls */}
                                        {voiceoverUrl && (
                                            <div className="space-y-4 p-4 bg-gray-800/30 rounded-lg">
                                                {/* Video Volume Control */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-white text-sm font-medium">Video Volume</span>
                                                        <span className="text-white/70 text-sm">{Math.round(videoVolume * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={videoVolume}
                                                        onChange={(e) => {
                                                            const vol = parseFloat(e.target.value);
                                                            setVideoVolume(vol);
                                                            if (videoRef.current) {
                                                                videoRef.current.volume = vol;
                                                            }
                                                        }}
                                                        disabled={!keepOriginalAudio}
                                                        className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb ${
                                                            !keepOriginalAudio ? 'opacity-50 cursor-not-allowed' : ''
                                                        }`}
                                                    />
                                                    {!keepOriginalAudio && (
                                                        <p className="text-white/50 text-xs">Enable "Keep Original Audio" to adjust video volume</p>
                                                    )}
                                                </div>
                                                
                                                {/* Voice-over Volume Control */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-white text-sm font-medium">Voice-over Volume</span>
                                                        <span className="text-white/70 text-sm">{Math.round(voiceoverVolume * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="2"
                                                        step="0.1"
                                                        value={voiceoverVolume}
                                                        onChange={(e) => setVoiceoverVolume(parseFloat(e.target.value))}
                                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                                    />
                                                </div>
                                                
                                                {/* Noise Reduction Control */}
                                                <div className="space-y-2 pt-2 border-t border-white/10">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={noiseReduction}
                                                            onChange={(e) => setNoiseReduction(e.target.checked)}
                                                            className="w-4 h-4 rounded"
                                                        />
                                                        <span className="text-white text-sm">Noise Reduction</span>
                                                    </label>
                                                    {noiseReduction && (
                                                        <div className="ml-6 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-white/70 text-xs">Strength</span>
                                                                <span className="text-white/50 text-xs">{Math.round(noiseReductionStrength * 100)}%</span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="1"
                                                                step="0.05"
                                                                value={noiseReductionStrength}
                                                                onChange={(e) => setNoiseReductionStrength(parseFloat(e.target.value))}
                                                                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={keepOriginalAudio}
                                                        onChange={(e) => setKeepOriginalAudio(e.target.checked)}
                                                        className="w-4 h-4 rounded"
                                                    />
                                                    <span className="text-white text-sm">Keep Original Audio</span>
                                                </label>
                                                
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (voiceoverAudioRef.current) {
                                                                if (voiceoverAudioRef.current.paused) {
                                                                    voiceoverAudioRef.current.play();
                                                                } else {
                                                                    voiceoverAudioRef.current.pause();
                                                                }
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        Preview
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setVoiceoverBlob(null);
                                                            setVoiceoverUrl(null);
                                                            if (voiceoverAudioRef.current) {
                                                                voiceoverAudioRef.current.src = '';
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        <FiX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Hidden audio element for preview */}
                                        <audio
                                            ref={voiceoverAudioRef}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                )}

                                {selectedCategory === 'overlays' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-white font-semibold text-lg">Stickers</h4>
                                            <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded-full">
                                                {stickers.length} added
                                            </span>
                                        </div>

                                        {/* Add Sticker Button */}
                                        <button
                                            onClick={() => setIsStickerPickerOpen(true)}
                                            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <FiPlus className="w-5 h-5" />
                                            <span>Add Sticker</span>
                                        </button>

                                        {/* Sticker Picker */}
                                        <StickerPicker
                                            isOpen={isStickerPickerOpen}
                                            onClose={() => setIsStickerPickerOpen(false)}
                                            onSelectSticker={(sticker: Sticker) => {
                                                const duration = timelineDuration || videoDuration || 90;
                                                const newSticker = {
                                                    id: `sticker-${Date.now()}`,
                                                    stickerId: sticker.id,
                                                    sticker: sticker,
                                                    x: 50, // Center position
                                                    y: 50,
                                                    scale: 1.0,
                                                    rotation: 0,
                                                    opacity: 1.0,
                                                    startTime: 0,
                                                    endTime: duration
                                                };
                                                console.log('✅ Adding sticker:', newSticker);
                                                console.log('📊 Current stickers before add:', stickers.length);
                                                setStickers(prev => {
                                                    const updated = [...prev, newSticker];
                                                    console.log('📊 Stickers after add:', updated.length, updated);
                                                    return updated;
                                                });
                                                setSelectedSticker(newSticker.id);
                                                setIsStickerPickerOpen(false);
                                                
                                                // Force container size update
                                                setTimeout(() => {
                                                    if (videoContainerRef.current) {
                                                        const width = videoContainerRef.current.offsetWidth;
                                                        const height = videoContainerRef.current.offsetHeight;
                                                        if (width > 0 && height > 0) {
                                                            setContainerSize({ width, height });
                                                            console.log('📐 Forced container size update:', { width, height });
                                                        }
                                                    }
                                                }, 100);
                                                
                                                // Show success feedback
                                                Swal.fire({
                                                    icon: 'success',
                                                    title: 'Sticker Added!',
                                                    text: `${sticker.name} has been added to your video`,
                                                    timer: 2000,
                                                    showConfirmButton: false,
                                                    toast: true,
                                                    position: 'top-end'
                                                });
                                            }}
                                        />

                                        {/* Current Stickers List */}
                                        {stickers.length > 0 && (
                                            <div className="space-y-2">
                                                <h5 className="text-white/70 text-sm font-medium">Added Stickers</h5>
                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                    {stickers.map((sticker) => (
                                                        <div
                                                            key={sticker.id}
                                                            className={`p-3 rounded-lg border ${
                                                                selectedSticker === sticker.id
                                                                    ? 'bg-purple-500/20 border-purple-500'
                                                                    : 'bg-gray-800/50 border-gray-700'
                                                            }`}
                                                            onClick={() => setSelectedSticker(sticker.id)}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    {sticker.sticker.emoji ? (
                                                                        <span className="text-2xl">{sticker.sticker.emoji}</span>
                                                                    ) : sticker.sticker.url ? (
                                                                        <img src={sticker.sticker.url} alt="" className="w-8 h-8 object-contain" />
                                                                    ) : (
                                                                        <span className="text-white/60 text-sm">{sticker.sticker.name}</span>
                                                                    )}
                                                                    <span className="text-white/70 text-sm">{sticker.sticker.name}</span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setStickers(stickers.filter(s => s.id !== sticker.id));
                                                                        if (selectedSticker === sticker.id) {
                                                                            setSelectedSticker(null);
                                                                        }
                                                                    }}
                                                                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                                                >
                                                                    <FiX className="w-4 h-4 text-red-400" />
                                                                </button>
                                                            </div>
                                                            {selectedSticker === sticker.id && (
                                                                <div className="mt-3 space-y-2 pt-3 border-t border-white/10">
                                                                    {/* Opacity Control */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-white/70 text-xs">Opacity</span>
                                                                            <span className="text-white/50 text-xs">{Math.round(sticker.opacity * 100)}%</span>
                                                                        </div>
                                                                        <input
                                                                            type="range"
                                                                            min="0"
                                                                            max="1"
                                                                            step="0.05"
                                                                            value={sticker.opacity}
                                                                            onChange={(e) => {
                                                                                const updated = stickers.map(s =>
                                                                                    s.id === sticker.id ? { ...s, opacity: parseFloat(e.target.value) } : s
                                                                                );
                                                                                setStickers(updated);
                                                                            }}
                                                                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                                                        />
                                                                    </div>
                                                                    {/* Scale Control */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-white/70 text-xs">Scale</span>
                                                                            <span className="text-white/50 text-xs">{Math.round(sticker.scale * 100)}%</span>
                                                                        </div>
                                                                        <input
                                                                            type="range"
                                                                            min="0.5"
                                                                            max="2"
                                                                            step="0.1"
                                                                            value={sticker.scale}
                                                                            onChange={(e) => {
                                                                                const updated = stickers.map(s =>
                                                                                    s.id === sticker.id ? { ...s, scale: parseFloat(e.target.value) } : s
                                                                                );
                                                                                setStickers(updated);
                                                                            }}
                                                                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                                                        />
                                                                    </div>
                                                                    {/* Rotation Control */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-white/70 text-xs">Rotation</span>
                                                                            <span className="text-white/50 text-xs">{Math.round(sticker.rotation)}°</span>
                                                                        </div>
                                                                        <input
                                                                            type="range"
                                                                            min="0"
                                                                            max="360"
                                                                            step="15"
                                                                            value={sticker.rotation}
                                                                            onChange={(e) => {
                                                                                const updated = stickers.map(s =>
                                                                                    s.id === sticker.id ? { ...s, rotation: parseFloat(e.target.value) } : s
                                                                                );
                                                                                setStickers(updated);
                                                                            }}
                                                                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {stickers.length === 0 && (
                                            <div className="text-center py-8">
                                                <FiSmile className="w-12 h-12 text-white/30 mx-auto mb-2" />
                                                <p className="text-white/60 text-sm">No stickers added yet</p>
                                                <p className="text-white/40 text-xs mt-1">Click "Add Sticker" to get started</p>
                                            </div>
                                        )}

                                        {/* Sticker Timeline */}
                                        {stickers.length > 0 && (() => {
                                            const duration = timelineDuration || videoDuration || 90;
                                            const pxPerSecond = 50; // pixels per second (zoom level)
                                            const timelineWidth = duration * pxPerSecond;
                                            
                                            return (
                                                <div className="mt-6 pt-4 border-t border-white/10">
                                                    <h5 className="text-white/70 text-sm font-medium mb-3">Sticker Timeline</h5>
                                                    <div className="relative w-full bg-gray-900 rounded-md overflow-x-auto" style={{ minHeight: `${stickers.length * 36 + 40}px` }}>
                                                        <div className="relative" style={{ width: `${timelineWidth}px`, minWidth: '100%', height: `${stickers.length * 36 + 20}px`, padding: '8px' }}>
                                                            {/* Playhead indicator */}
                                                            <div
                                                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                                                                style={{
                                                                    left: `${(timelineCurrentTime || 0) * pxPerSecond + 8}px`,
                                                                    height: `${stickers.length * 36}px`
                                                                }}
                                                            />
                                                            
                                                            {/* Sticker timeline bars */}
                                                            {stickers.map((sticker, index) => {
                                                                const leftPos = (sticker.startTime || 0) * pxPerSecond;
                                                                const width = ((sticker.endTime || duration) - (sticker.startTime || 0)) * pxPerSecond;
                                                                
                                                                return (
                                                                    <div
                                                                        key={sticker.id}
                                                                        className="relative mb-1"
                                                                        style={{ height: '32px', top: `${index * 36}px` }}
                                                                    >
                                                                        <div
                                                                            className="absolute top-0 h-full bg-purple-500/70 hover:bg-purple-500 rounded-md cursor-move flex items-center justify-center group"
                                                                            style={{
                                                                                left: `${leftPos}px`,
                                                                                width: `${width}px`,
                                                                                minWidth: '20px'
                                                                            }}
                                                                            onMouseDown={(e) => {
                                                                                setTimelineDragState({
                                                                                    stickerId: sticker.id,
                                                                                    type: 'drag',
                                                                                    startX: e.clientX,
                                                                                    startTime: sticker.startTime || 0
                                                                                });
                                                                            }}
                                                                        >
                                                                            {/* Sticker preview */}
                                                                            <div className="flex items-center gap-1 px-2 text-white text-xs pointer-events-none">
                                                                                {sticker.sticker.emoji ? (
                                                                                    <span className="text-sm">{sticker.sticker.emoji}</span>
                                                                                ) : sticker.sticker.url ? (
                                                                                    <img src={sticker.sticker.url} alt="" className="w-4 h-4 object-contain" />
                                                                                ) : (
                                                                                    <span className="truncate max-w-[80px] text-[10px]">{sticker.sticker.name}</span>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            {/* Left resize handle */}
                                                                            <div
                                                                                className="absolute left-0 top-0 h-full w-2 bg-white/80 hover:bg-white cursor-w-resize rounded-l-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                onMouseDown={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setTimelineDragState({
                                                                                        stickerId: sticker.id,
                                                                                        type: 'resize-left',
                                                                                        startX: e.clientX,
                                                                                        startTime: sticker.startTime || 0
                                                                                    });
                                                                                }}
                                                                            />
                                                                            
                                                                            {/* Right resize handle */}
                                                                            <div
                                                                                className="absolute right-0 top-0 h-full w-2 bg-white/80 hover:bg-white cursor-e-resize rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                onMouseDown={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setTimelineDragState({
                                                                                        stickerId: sticker.id,
                                                                                        type: 'resize-right',
                                                                                        startX: e.clientX,
                                                                                        startTime: sticker.endTime || duration
                                                                                    });
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        
                                                                        {/* Time labels - only show if bar is wide enough */}
                                                                        {width > 60 && (
                                                                            <>
                                                                                <div className="absolute -top-4 left-0 text-white/50 text-[10px]" style={{ left: `${leftPos}px` }}>
                                                                                    {((sticker.startTime || 0).toFixed(1))}s
                                                                                </div>
                                                                                <div className="absolute -top-4 text-white/50 text-[10px]" style={{ left: `${leftPos + width}px`, transform: 'translateX(-100%)' }}>
                                                                                    {((sticker.endTime || duration).toFixed(1))}s
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            
                                                            {/* Timeline scale/ruler */}
                                                            <div className="absolute bottom-0 left-0 right-0 h-4 border-t border-white/10">
                                                                {Array.from({ length: Math.ceil(duration / 5) + 1 }).map((_, i) => {
                                                                    const time = i * 5;
                                                                    if (time > duration) return null;
                                                                    const pos = time * pxPerSecond;
                                                                    return (
                                                                        <div
                                                                            key={i}
                                                                            className="absolute top-0 h-full border-l border-white/20"
                                                                            style={{ left: `${pos}px` }}
                                                                        >
                                                                            <span className="absolute -top-4 left-0.5 text-white/40 text-[10px]">{time}s</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Placeholder for other categories */}
                                {!['filters', 'adjustments', 'lut', 'multi-clip', 'trim', 'music', 'transitions', 'voiceover', 'overlays'].includes(selectedCategory) && (
                                    <div className="space-y-4">
                                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">
                                            {categories.find(c => c.id === selectedCategory)?.name || 'Category'}
                                        </h4>
                                        <p className="text-white/60 text-sm">
                                            {selectedCategory} options coming soon...
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

            </div>

            {/* Hidden file input for adding clips */}
            <input
                ref={multiClipInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleAddClip}
            />
        </>
    );
}


