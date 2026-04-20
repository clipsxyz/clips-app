import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiCircle, FiX, FiPlay, FiPause, FiRotateCw, FiMic, FiMicOff, FiImage, FiLayers, FiZap, FiGrid, FiUser, FiUsers, FiFilter, FiRefreshCw, FiEdit3, FiBookmark, FiUpload, FiSliders, FiDroplet, FiVideo, FiVideoOff, FiCopy, FiSave, FiPlus, FiType, FiCamera } from 'react-icons/fi';
import { saveDraft } from '../api/drafts';
import { getTemplate } from '../api/templates';
import { TEMPLATE_IDS } from '../constants';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { setGalleryPreviewMedia } from '../utils/galleryPreviewCache';
import CreateGroupModal from '../components/CreateGroupModal';

/** Same gradient as `Avatar` story ring (profile picture story border). */
const PROFILE_STORY_RING_GRADIENT = 'linear-gradient(135deg, #f6e27a 0%, #d4af37 22%, #f4f4f4 44%, #bfc5cc 66%, #ffe8a3 82%, #d4af37 100%)';

type SocialUploadTarget = 'youtube_shorts' | 'tiktok' | 'instagram_reels';

export default function InstantCreatePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const previewVideoRef = React.useRef<HTMLVideoElement | null>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const recordedChunksRef = React.useRef<Blob[]>([]);
    const streamRef = React.useRef<MediaStream | null>(null);
    const isMountedRef = React.useRef(true);
    const blobRef = React.useRef<Blob | null>(null); // Keep blob reference alive
    const [recording, setRecording] = React.useState(false);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [videoDuration, setVideoDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [trimStart, setTrimStart] = React.useState(0);
    const [trimEnd, setTrimEnd] = React.useState(0);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [showControls, setShowControls] = React.useState(true);
    const controlsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('user');
    const [micOn, setMicOn] = React.useState(true);
    const [cameraOn, setCameraOn] = React.useState(false);
    const [dualCamera, setDualCamera] = React.useState(false);
    const dualCameraRef = React.useRef<HTMLVideoElement | null>(null);
    const dualStreamRef = React.useRef<MediaStream | null>(null);
    const [showGazetteerMenu, setShowGazetteerMenu] = React.useState(false);
    const gazetteerCameraRollInputRef = React.useRef<HTMLInputElement | null>(null);
    const [countdown, setCountdown] = React.useState<number | null>(null);
    const [greenEnabled, setGreenEnabled] = React.useState(false);
    const [bgUrl, setBgUrl] = React.useState<string | null>(null);
    const cameraRollInputRef = React.useRef<HTMLInputElement | null>(null);
    const bgInputRef = React.useRef<HTMLInputElement | null>(null);
    const greenCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const segRef = React.useRef<any>(null);
    const segTimerRef = React.useRef<number | null>(null);
    const segRafRef = React.useRef<number | null>(null);
    const segReadyRef = React.useRef<boolean>(false);
    const bgElRef = React.useRef<HTMLImageElement | HTMLVideoElement | null>(null);
    const [bgBlurPx, setBgBlurPx] = React.useState(2);
    const [featherPx, setFeatherPx] = React.useState(3);
    const [showGuides, setShowGuides] = React.useState(false);
    const [showEffectsCard, setShowEffectsCard] = React.useState(false);
    const [showLayoutOptions, setShowLayoutOptions] = React.useState(false);
    const [selectedLayout, setSelectedLayout] = React.useState<string | null>(null);
    const [showGreenScreenOptions, setShowGreenScreenOptions] = React.useState(false);
    const [showFilters, setShowFilters] = React.useState(false);
    const [selectedFilter, setSelectedFilter] = React.useState<string>('None');
    const [showAdjustments, setShowAdjustments] = React.useState(false);
    const [brightness, setBrightness] = React.useState(1.0);
    const [contrast, setContrast] = React.useState(1.0);
    const [saturation, setSaturation] = React.useState(1.0);
    const [hue, setHue] = React.useState(0.0); // Hue adjustment for hybrid model
    const [speed, setSpeed] = React.useState(1.0); // Video playback speed
    const [reverse, setReverse] = React.useState(false); // Reverse video
    
    // Multi-clip support
    type Clip = {
        id: string;
        url: string;
        duration: number;
        trimStart: number;
        trimEnd: number;
        speed: number;
        reverse: boolean;
        blob?: Blob; // Optional blob reference for upload
    };
    type Transition = {
        type: 'none' | 'fade' | 'swipe' | 'zoom';
        duration: number; // Transition duration in seconds
    };
    const [clips, setClips] = React.useState<Clip[]>([]);
    const [transitions, setTransitions] = React.useState<Transition[]>([]); // Transitions between clips
    
    // Voiceover recording
    const [voiceoverUrl, setVoiceoverUrl] = React.useState<string | null>(null);
    const [isRecordingVoiceover, setIsRecordingVoiceover] = React.useState(false);
    const voiceoverRecorderRef = React.useRef<MediaRecorder | null>(null);
    const voiceoverChunksRef = React.useRef<Blob[]>([]);
    const presets = React.useRef<string[]>([
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200',
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
        'https://images.unsplash.com/photo-1503264116251-35a269479413?w=1200',
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200'
    ]);
    const presetIdxRef = React.useRef(0);
    const MAX_VIDEO_SECONDS = 60;

    type CreateModeAction = 'community' | 'text' | 'gallery' | 'story' | 'youtube' | 'tiktok' | 'instagram_reels';
    type StoryAudience = 'public' | 'close_friends' | 'only_me';
    type StoryPreviewAction = 'filters' | 'audience' | 'save' | 'next';
    const [showCreateModePicker, setShowCreateModePicker] = React.useState(true);
    const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
    const pendingSocialUploadRef = React.useRef<SocialUploadTarget | null>(null);
    const [recordingTime, setRecordingTime] = React.useState(MAX_VIDEO_SECONDS);
    const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const verticalPickerRef = React.useRef<HTMLDivElement | null>(null);
    const verticalPickerRafRef = React.useRef<number | null>(null);
    const [isVerticalPickerDragging, setIsVerticalPickerDragging] = React.useState(false);
    const [centeredCreateMode, setCenteredCreateMode] = React.useState<CreateModeAction>('gallery');
    const [isStoryMode, setIsStoryMode] = React.useState(false);
    const [storyAudience, setStoryAudience] = React.useState<StoryAudience>('public');
    const [showStoryAudienceSheet, setShowStoryAudienceSheet] = React.useState(false);
    const storyPreviewRailRef = React.useRef<HTMLDivElement | null>(null);
    const storyPreviewRafRef = React.useRef<number | null>(null);
    const [isStoryPreviewDragging, setIsStoryPreviewDragging] = React.useState(false);
    const [centeredStoryPreviewAction, setCenteredStoryPreviewAction] = React.useState<StoryPreviewAction>('next');

    const recordingLimitForDisplay = MAX_VIDEO_SECONDS;
    const TIMER_CIRCUMFERENCE = 2 * Math.PI * 20;

    const centerRailItem = React.useCallback((rail: HTMLDivElement | null, selector: string, smooth = true) => {
        if (!rail) return;
        const target = rail.querySelector<HTMLElement>(selector);
        if (!target) return;
        const desiredLeft = target.offsetLeft - (rail.clientWidth / 2) + (target.clientWidth / 2);
        rail.scrollTo({ left: Math.max(0, desiredLeft), behavior: smooth ? 'smooth' : 'auto' });
    }, []);

    const centerVerticalPickerItem = React.useCallback((rail: HTMLDivElement | null, actionId: CreateModeAction, smooth = true) => {
        if (!rail) return;
        const target = rail.querySelector<HTMLElement>(`[data-create-mode="${actionId}"]`);
        if (!target) return;
        const desiredTop = target.offsetTop - (rail.clientHeight / 2) + (target.clientHeight / 2);
        rail.scrollTo({ top: Math.max(0, desiredTop), behavior: smooth ? 'smooth' : 'auto' });
    }, []);

    const updateVerticalPickerVisuals = React.useCallback(() => {
        const rail = verticalPickerRef.current;
        if (!rail) return;
        const railRect = rail.getBoundingClientRect();
        if (railRect.height < 32) return;
        const centerY = railRect.top + railRect.height / 2;
        let closestId: CreateModeAction | null = null;
        let closestDist = Number.POSITIVE_INFINITY;
        rail.querySelectorAll<HTMLElement>('[data-create-mode]').forEach((el) => {
            const rect = el.getBoundingClientRect();
            const icy = rect.top + rect.height / 2;
            const dist = Math.abs(icy - centerY);
            const id = el.dataset.createMode as CreateModeAction | undefined;
            if (id && dist < closestDist) {
                closestDist = dist;
                closestId = id;
            }
            // Subtle vertical tilt only (no rotateY — that read as “crooked”). No translateZ — avoids skew with scroll clipping.
            const denom = Math.max(260, railRect.height * 0.45);
            const raw = (icy - centerY) / denom;
            const t = Math.max(-1, Math.min(1, raw));
            const absT = Math.abs(t);
            const rotateX = -t * 34;
            const scale = Math.max(0.82, 1.28 - absT * 0.42);
            const opacity = Math.max(0.55, 1 - absT * 0.32);
            el.style.transformOrigin = '50% 50%';
            el.style.transform = `rotateX(${rotateX}deg) scale(${scale})`;
            el.style.opacity = String(opacity);
        });
        if (closestId) setCenteredCreateMode(closestId);
    }, []);

    const handleInstantBack = React.useCallback(() => {
        if (previewUrl) {
            navigate('/feed');
            return;
        }
        if (!showCreateModePicker) {
            setShowCreateModePicker(true);
            setCameraOn(false);
            pendingSocialUploadRef.current = null;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
            }
            if (dualStreamRef.current) {
                dualStreamRef.current.getTracks().forEach(t => t.stop());
                dualStreamRef.current = null;
            }
            if (dualCameraRef.current) {
                dualCameraRef.current.srcObject = null;
            }
            setDualCamera(false);
            return;
        }
        navigate('/feed');
    }, [previewUrl, showCreateModePicker, navigate]);

    const updateCenteredStoryPreviewAction = React.useCallback(() => {
        const rail = storyPreviewRailRef.current;
        if (!rail) return;
        const railRect = rail.getBoundingClientRect();
        const centerX = railRect.left + (railRect.width / 2);
        let closestId: StoryPreviewAction | null = null;
        let closestDist = Number.POSITIVE_INFINITY;
        const nodes = rail.querySelectorAll<HTMLButtonElement>('[data-story-preview-action]');
        nodes.forEach((node) => {
            const id = node.dataset.storyPreviewAction as StoryPreviewAction | undefined;
            if (!id) return;
            const rect = node.getBoundingClientRect();
            const itemCenter = rect.left + (rect.width / 2);
            const dist = Math.abs(itemCenter - centerX);
            if (dist < closestDist) {
                closestDist = dist;
                closestId = id;
            }
        });
        if (closestId) setCenteredStoryPreviewAction(closestId);
    }, []);

    React.useEffect(() => {
        if (!showCreateModePicker) return;
        const t = window.setTimeout(() => {
            const rail = verticalPickerRef.current;
            if (rail) {
                const galleryItem = rail.querySelector<HTMLElement>('[data-create-mode="gallery"]');
                if (galleryItem) {
                    const desiredTop = galleryItem.offsetTop - (rail.clientHeight / 2) + (galleryItem.clientHeight / 2);
                    rail.scrollTo({ top: Math.max(0, desiredTop), behavior: 'auto' });
                }
                updateVerticalPickerVisuals();
            }
        }, 0);
        return () => window.clearTimeout(t);
    }, [showCreateModePicker, updateVerticalPickerVisuals]);

    React.useEffect(() => {
        if (!showCreateModePicker) return;
        const rail = verticalPickerRef.current;
        if (!rail) return;
        const onScroll = () => {
            if (verticalPickerRafRef.current != null) cancelAnimationFrame(verticalPickerRafRef.current);
            verticalPickerRafRef.current = requestAnimationFrame(updateVerticalPickerVisuals);
        };
        rail.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            rail.removeEventListener('scroll', onScroll);
            if (verticalPickerRafRef.current != null) cancelAnimationFrame(verticalPickerRafRef.current);
        };
    }, [showCreateModePicker, updateVerticalPickerVisuals]);

    React.useEffect(() => {
        const rail = storyPreviewRailRef.current;
        if (!rail) return;
        const t = window.setTimeout(() => {
            centerRailItem(rail, `[data-story-preview-action="${centeredStoryPreviewAction}"]`, false);
            updateCenteredStoryPreviewAction();
        }, 0);
        const onScroll = () => {
            if (storyPreviewRafRef.current != null) cancelAnimationFrame(storyPreviewRafRef.current);
            storyPreviewRafRef.current = requestAnimationFrame(updateCenteredStoryPreviewAction);
        };
        rail.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.clearTimeout(t);
            rail.removeEventListener('scroll', onScroll);
            if (storyPreviewRafRef.current != null) cancelAnimationFrame(storyPreviewRafRef.current);
        };
    }, [centeredStoryPreviewAction, updateCenteredStoryPreviewAction]);

    // Load draft when navigated from profile drafts
    React.useEffect(() => {
        const state = location.state as {
            draftId?: string;
            draftVideoUrl?: string;
            draftVideoDuration?: number;
            trimStart?: number;
            trimEnd?: number;
            storyMode?: boolean;
        } | null;

        if (state?.draftVideoUrl) {
            const duration = state.draftVideoDuration ?? 0;
            const start = state.trimStart ?? 0;
            const end = state.trimEnd ?? duration;
            setPreviewUrl(state.draftVideoUrl);
            setVideoDuration(duration);
            setTrimStart(start);
            setTrimEnd(end);
            setShowCreateModePicker(false);
        }
        if (state?.storyMode) {
            setIsStoryMode(true);
        }
    }, [location.state]);

    async function initStream(mode: 'user' | 'environment', audio: boolean, video: boolean = true) {
        try {
            // Stop previous stream if any
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            if (!video && !audio) {
                // Both off, just clear the video
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
                return;
            }

            // Check if we're in a secure context (HTTPS or localhost)
            const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            // Check if getUserMedia is available (with fallback for older browsers)
            let getUserMedia: any = null;
            
            // First check modern API
            if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
                getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            } 
            // Fallback to legacy API (might work even if mediaDevices is undefined)
            else if ((navigator as any).getUserMedia && typeof (navigator as any).getUserMedia === 'function') {
                getUserMedia = (navigator as any).getUserMedia.bind(navigator);
            } 
            // WebKit fallback
            else if ((navigator as any).webkitGetUserMedia && typeof (navigator as any).webkitGetUserMedia === 'function') {
                getUserMedia = (navigator as any).webkitGetUserMedia.bind(navigator);
            }
            // Try to create mediaDevices if it doesn't exist (some browsers)
            else if (!navigator.mediaDevices && (navigator as any).getUserMedia) {
                // Polyfill mediaDevices
                (navigator as any).mediaDevices = {
                    getUserMedia: (constraints: any) => {
                        return new Promise((resolve, reject) => {
                            (navigator as any).getUserMedia(constraints, resolve, reject);
                        });
                    }
                };
                getUserMedia = (navigator as any).mediaDevices.getUserMedia.bind((navigator as any).mediaDevices);
            }

            if (!getUserMedia) {
                console.error('getUserMedia not available. Navigator:', {
                    hasMediaDevices: !!navigator.mediaDevices,
                    hasGetUserMedia: !!(navigator as any).getUserMedia,
                    hasWebkitGetUserMedia: !!(navigator as any).webkitGetUserMedia,
                    isSecureContext: isSecureContext,
                    protocol: window.location.protocol,
                    hostname: window.location.hostname
                });
                
                Swal.fire(bottomSheet({
                    title: 'Camera Not Available',
                    message: 'Camera access is not available (e.g. Android Chrome needs HTTPS, or permissions blocked). Use the "Take Photo/Video" button below, which works on HTTP.',
                    icon: 'alert',
                }));
                return;
            }

            // Warn if not secure context (but still try)
            if (!isSecureContext && navigator.mediaDevices) {
                console.warn('Camera access may be blocked: not in secure context (HTTPS required on Android Chrome)');
            }

            const stream = await getUserMedia({ 
                video: video ? { facingMode: mode } : false, 
                audio 
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try { await videoRef.current.play(); } catch { }
            }
        } catch (e: any) {
            console.error('Stream init error:', e);
            Swal.fire(bottomSheet({
                title: 'Camera Access Failed',
                message: e.name === 'NotAllowedError' ? 'Please allow camera access in your browser settings' : `Error: ${e.message || e.name || 'Unknown error'}`,
                icon: 'alert',
            }));
        }
    }

    function toggleCamera() {
        const newCameraOn = !cameraOn;
        setCameraOn(newCameraOn);
        if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = newCameraOn;
            }
        } else if (newCameraOn) {
            // If stream doesn't exist and we're turning camera on, initialize it
            initStream(facingMode, micOn, true);
        }
    }

    async function toggleDualCamera() {
        const newDualCamera = !dualCamera;
        setDualCamera(newDualCamera);

        if (newDualCamera) {
            // Enable dual camera - get both front and back cameras
            try {
                // Get the opposite camera
                const oppositeMode = facingMode === 'user' ? 'environment' : 'user';
                
                // Check if getUserMedia is available
                let getUserMedia: any = null;
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
                } else if ((navigator as any).getUserMedia) {
                    getUserMedia = (navigator as any).getUserMedia.bind(navigator);
                } else if ((navigator as any).webkitGetUserMedia) {
                    getUserMedia = (navigator as any).webkitGetUserMedia.bind(navigator);
                }

                if (!getUserMedia) {
                    Swal.fire(bottomSheet({
                        title: 'Camera Not Supported',
                        message: 'Your browser does not support camera access.',
                        icon: 'alert',
                    }));
                    setDualCamera(false);
                    return;
                }

                const dualStream = await getUserMedia({ 
                    video: { facingMode: oppositeMode }, 
                    audio: false 
                });
                dualStreamRef.current = dualStream;
                
                if (dualCameraRef.current) {
                    dualCameraRef.current.srcObject = dualStream;
                    try { await dualCameraRef.current.play(); } catch { }
                }
            } catch (e: any) {
                console.error('Dual camera init error:', e);
                setDualCamera(false);
            }
        } else {
            // Disable dual camera
            if (dualStreamRef.current) {
                dualStreamRef.current.getTracks().forEach(t => t.stop());
                dualStreamRef.current = null;
            }
            if (dualCameraRef.current) {
                dualCameraRef.current.srcObject = null;
            }
        }
    }

    // Load/prepare background media element when bgUrl changes
    React.useEffect(() => {
        if (!bgUrl) { bgElRef.current = null; return; }
        console.log('GS: Loading background from', bgUrl.substring(0, 50));
        // Determine if image or video by checking file type or extension
        const isVideo = bgUrl.includes('video') || /\.(mp4|webm|ogg)/i.test(bgUrl);
        if (isVideo) {
            const v = document.createElement('video');
            v.src = bgUrl;
            v.loop = true;
            v.muted = true;
            v.playsInline = true;
            v.onloadeddata = () => {
                console.log('GS: Video background loaded');
                try { v.play(); } catch { }
                bgElRef.current = v;
            };
            v.onerror = () => console.error('GS: Video background failed to load');
        } else {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                console.log('GS: Image background loaded', img.width, 'x', img.height);
                bgElRef.current = img;
            };
            img.onerror = () => console.error('GS: Image background failed to load');
            img.src = bgUrl;
        }
    }, [bgUrl]);

    // Initialize/teardown green screen processing
    React.useEffect(() => {
        if (!greenEnabled) {
            // Stop any timers
            if (segTimerRef.current) {
                clearInterval(segTimerRef.current);
                segTimerRef.current = null;
            }
            if (segRafRef.current) {
                cancelAnimationFrame(segRafRef.current);
                segRafRef.current = null;
            }
            return;
        }

        let cancelled = false;
        let selfieSeg: any = null;

        async function setup() {
            try {
                // Dynamically inject script (CDN exposes global SelfieSegmentation.SelfieSegmentation)
                if (!(window as any).SelfieSegmentation) {
                    await new Promise<void>((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
                        s.onload = () => resolve();
                        s.onerror = () => reject(new Error('Failed to load mediapipe'));
                        document.body.appendChild(s);
                    });
                }
                const GlobalSeg = (window as any).SelfieSegmentation?.SelfieSegmentation || (window as any).SelfieSegmentation;
                if (!GlobalSeg) throw new Error('SelfieSegmentation global not found');
                selfieSeg = new GlobalSeg({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}` });
                selfieSeg.setOptions({ modelSelection: 1 });
                segRef.current = selfieSeg;
                segReadyRef.current = true;

                const canvas = greenCanvasRef.current;
                const video = videoRef.current as HTMLVideoElement;
                if (!canvas || !video) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                selfieSeg.onResults((results: any) => {
                    if (cancelled || !canvas || !ctx) {
                        console.log('GS: Skipping - cancelled:', cancelled, 'canvas:', !!canvas, 'ctx:', !!ctx);
                        return;
                    }
                    if (!results || !results.segmentationMask || !results.image) {
                        console.log('GS: Missing results', { hasMask: !!results?.segmentationMask, hasImage: !!results?.image });
                        return;
                    }
                    const w = canvas.clientWidth || video.videoWidth || 640;
                    const h = canvas.clientHeight || video.videoHeight || 480;
                    if (canvas.width !== w || canvas.height !== h) {
                        canvas.width = w; canvas.height = h;
                        console.log('GS: Canvas resized to', w, h);
                    }
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Draw background first with optional blur
                    const bgEl = bgElRef.current;
                    let bgDrawn = false;
                    if (bgEl) {
                        try {
                            ctx.save();
                            ctx.filter = bgBlurPx > 0 ? `blur(${bgBlurPx}px)` : 'none';
                            if (bgEl instanceof HTMLImageElement) {
                                if (bgEl.complete && bgEl.naturalWidth > 0) {
                                    ctx.drawImage(bgEl, 0, 0, canvas.width, canvas.height);
                                    bgDrawn = true;
                                } else {
                                    console.log('GS: Image not ready yet', { complete: bgEl.complete, naturalWidth: bgEl.naturalWidth });
                                }
                            } else if (bgEl instanceof HTMLVideoElement) {
                                if (bgEl.readyState >= 2 && bgEl.videoWidth > 0) {
                                    ctx.drawImage(bgEl, 0, 0, canvas.width, canvas.height);
                                    bgDrawn = true;
                                } else {
                                    console.log('GS: Video not ready yet', { readyState: bgEl.readyState, videoWidth: bgEl.videoWidth });
                                }
                            }
                            ctx.restore();
                        } catch (e) {
                            console.warn('GS: Background draw error:', e);
                        }
                    }
                    if (!bgDrawn) {
                        // Fallback: black background if image not ready
                        ctx.fillStyle = 'black';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }

                    // Composite person over background using mask with feathering
                    const mask = results.segmentationMask;
                    const personImg = results.image;
                    if (mask && personImg) {
                        // Create temporary canvas for person with mask applied
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = canvas.width;
                        tempCanvas.height = canvas.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        if (tempCtx) {
                            // Draw person on temp canvas
                            tempCtx.drawImage(personImg as CanvasImageSource, 0, 0, canvas.width, canvas.height);
                            // Apply mask to person (keep only where mask is white)
                            tempCtx.globalCompositeOperation = 'destination-in';
                            if (featherPx > 0) {
                                tempCtx.filter = `blur(${featherPx}px)`;
                                tempCtx.drawImage(mask as CanvasImageSource, 0, 0, canvas.width, canvas.height);
                                tempCtx.filter = 'none';
                            } else {
                                tempCtx.drawImage(mask as CanvasImageSource, 0, 0, canvas.width, canvas.height);
                            }
                            // Draw masked person over background
                            ctx.drawImage(tempCanvas, 0, 0);
                        }
                    }
                });

                // Drive frames via requestAnimationFrame to avoid piling up sends
                console.log('GS: Starting segmentation loop');
                const tick = async () => {
                    if (!segReadyRef.current || cancelled) return;
                    if (videoRef.current && videoRef.current.readyState >= 2) {
                        try {
                            await selfieSeg.send({ image: videoRef.current });
                        } catch (e) {
                            // Stop on persistent WASM errors
                            console.error('GS: Segmentation send error:', e);
                            segReadyRef.current = false;
                            return;
                        }
                    }
                    segRafRef.current = requestAnimationFrame(tick);
                };
                segRafRef.current = requestAnimationFrame(tick);
            } catch (err) {
                console.error('Failed to initialize green screen segmentation:', err);
                setGreenEnabled(false);
            }
        }

        setup();
        return () => {
            cancelled = true;
            if (segTimerRef.current) {
                clearInterval(segTimerRef.current);
                segTimerRef.current = null;
            }
            if (segRafRef.current) {
                cancelAnimationFrame(segRafRef.current);
                segRafRef.current = null;
            }
            try { segRef.current?.close?.(); } catch { }
            segRef.current = null;
            segReadyRef.current = false;
        };
    }, [greenEnabled, bgUrl]);

    React.useEffect(() => {
        isMountedRef.current = true;
        
        // Only initialize stream after user leaves the mode picker (no instant camera on entry)
        if (cameraOn && !previewUrl && !showCreateModePicker) {
            initStream(facingMode, micOn, cameraOn);
        } else if (previewUrl) {
            // If preview is showing, stop the camera stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }

        return () => {
            isMountedRef.current = false;

            // Stop video playback first
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
            }

            // Stop MediaRecorder
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try {
                    mediaRecorderRef.current.stop();
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }

            // Stop camera stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => {
                    try {
                        t.stop();
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                });
                streamRef.current = null;
            }

            // Clean up preview URL
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }

            // Clean up dual camera stream
            if (dualStreamRef.current) {
                dualStreamRef.current.getTracks().forEach(t => t.stop());
                dualStreamRef.current = null;
            }
            
            // Clean up recording timer
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        };
    }, [facingMode, micOn, cameraOn, previewUrl, showCreateModePicker]);

    function startRecording() {
        const cameraStream = videoRef.current?.srcObject as MediaStream | null;
        if (!cameraStream) return;
        recordedChunksRef.current = [];

        // Try to find a supported MIME type
        let options: MediaRecorderOptions = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            options = { mimeType: 'video/webm;codecs=vp9,opus' };
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            options = { mimeType: 'video/webm;codecs=vp8,opus' };
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            options = { mimeType: 'video/webm' };
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            options = { mimeType: 'video/mp4' };
        }

        // If green screen is enabled, record from canvas stream (add mic track)
        let recStream: MediaStream = cameraStream;
        if (greenEnabled && greenCanvasRef.current) {
            const canvasStream = greenCanvasRef.current.captureStream(30);
            const audioTrack = (streamRef.current?.getAudioTracks() || [])[0];
            if (audioTrack) canvasStream.addTrack(audioTrack);
            recStream = canvasStream;
        }

        const mr = new MediaRecorder(recStream, options);
        mediaRecorderRef.current = mr;
        mr.ondataavailable = (e: BlobEvent) => {
            if (e.data && e.data.size > 0) {
                recordedChunksRef.current.push(e.data);
            }
        };
        mr.onstop = async () => {
            // Ensure all chunks are collected
            if (recordedChunksRef.current.length > 0) {
                const blobType = options.mimeType || 'video/webm';
                const blob = new Blob(recordedChunksRef.current, { type: blobType });
                
                // CRITICAL: Store blob reference to keep it alive
                blobRef.current = blob;
                
                console.log('📹 Recording stopped, blob created. Blob size:', blob.size, 'Type:', blobType);
                
                // Create a blob URL for immediate preview (will be replaced with backend URL after upload)
                const blobUrl = URL.createObjectURL(blob);
                let persistentUrl = blobUrl;
                
                // Upload video to backend immediately
                try {
                    console.log('📤 Uploading video to backend...', { size: blob.size, type: blobType });
                    const file = new File([blob], `video-${Date.now()}.webm`, { type: blobType });
                    const { uploadFile } = await import('../api/client');
                    const uploadResult = await uploadFile(file);
                    
                    if (uploadResult && uploadResult.success && uploadResult.fileUrl) {
                        persistentUrl = uploadResult.fileUrl;
                        console.log('✅ Video uploaded to backend:', persistentUrl);
                        // Revoke the blob URL since we now have a backend URL
                        URL.revokeObjectURL(blobUrl);
                        // Clear blob reference since we have backend URL
                        blobRef.current = null;
                    } else {
                        throw new Error('Upload failed - invalid response: ' + JSON.stringify(uploadResult));
                    }
                } catch (error) {
                    console.error('❌ Failed to upload video to backend:', error);
                    console.error('Error details:', {
                        errorMessage: error instanceof Error ? error.message : String(error),
                        blobSize: blob.size,
                        blobType: blobType
                    });
                    console.warn('⚠️ Using blob URL for preview - blob reference kept alive, will upload in InstantFiltersPage:', blobUrl.substring(0, 50));
                    // Keep blob URL AND blob reference - don't revoke until uploaded
                    // InstantFiltersPage will upload it and then we can revoke
                }
                
                // Create a video element to get duration
                const tempVideo = document.createElement('video');
                tempVideo.preload = 'metadata';
                tempVideo.muted = true;
                tempVideo.playsInline = true;
                tempVideo.crossOrigin = 'anonymous';
                
                let durationResolved = false;
                const resolveDuration = (duration: number) => {
                    if (durationResolved) return;
                    durationResolved = true;
                    
                    const newClip: Clip = {
                        id: `clip-${Date.now()}`,
                        url: persistentUrl, // Use persistent URL (backend URL if uploaded, blob URL if not)
                        duration: duration || 0,
                        trimStart: 0,
                        trimEnd: duration || 0,
                        speed: 1.0,
                        reverse: false,
                        blob: blobRef.current || undefined // Keep blob reference for upload in next step
                    };
                    
                    const urlType = persistentUrl.startsWith('http://') || persistentUrl.startsWith('https://') ? 'backend' :
                                   persistentUrl.startsWith('data:') ? 'data' : 'blob';
                    console.log('📝 Clip created with URL type:', urlType, 'duration:', duration);
                    
                    // Add to clips array
                    setClips(prev => {
                        const updated = [...prev, newClip];
                        // Set as preview (for single clip view)
                        setPreviewUrl(persistentUrl);
                        setVideoDuration(duration || 0);
                        setTrimStart(0);
                        setTrimEnd(duration || 0);
                        
                        // After recording: use same preview flow as gallery picker (GalleryPreviewPage)
                        setTimeout(() => {
                            const clipsToPass = updated.length > 0 ? updated : [newClip];
                            if (clipsToPass.length > 0) {
                                // Stop camera stream before navigating
                                if (streamRef.current) {
                                    streamRef.current.getTracks().forEach(t => t.stop());
                                    streamRef.current = null;
                                }
                                if (videoRef.current) {
                                    videoRef.current.pause();
                                    videoRef.current.srcObject = null;
                                }
                                const duration = clipsToPass[0].duration || 0;
                                const galleryItems = [{ blob, mediaType: 'video' as const, videoDuration: duration }];
                                setGalleryPreviewMedia(galleryItems);
                                navigate('/create/gallery-preview', {
                                    state: {
                                        mediaUrl: undefined,
                                        mediaType: 'video' as const,
                                        videoDuration: duration,
                                        fromInstantRecording: true
                                    }
                                });
                            }
                        }, 500); // Small delay to ensure state is set
                        
                        return updated;
                    });
                };
                
                tempVideo.onloadedmetadata = async () => {
                    // Wait a bit for duration to be available (especially for blob URLs)
                    let duration = tempVideo.duration;
                    let attempts = 0;
                    const maxAttempts = 20; // Wait up to 2 seconds
                    
                    while ((!isFinite(duration) || duration <= 0 || isNaN(duration)) && attempts < maxAttempts && !durationResolved) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        duration = tempVideo.duration;
                        attempts++;
                    }
                    
                    if (isFinite(duration) && duration > 0 && !durationResolved) {
                        console.log('✅ Video metadata loaded, duration:', duration);
                        resolveDuration(duration);
                    } else if (!durationResolved) {
                        // Try seeking to end to get duration (for blob URLs)
                        try {
                            const originalTime = tempVideo.currentTime;
                            tempVideo.currentTime = 1e10; // Seek to end
                            await new Promise(resolve => setTimeout(resolve, 300));
                            duration = tempVideo.duration;
                            tempVideo.currentTime = originalTime;
                            
                            if (isFinite(duration) && duration > 0) {
                                console.log('✅ Got duration from seeking:', duration);
                                resolveDuration(duration);
                            } else {
                                // Fallback: estimate from blob size
                                const estimatedDuration = Math.max(1, Math.min(90, Math.round(blob.size / 150000))); // Rough estimate
                                console.warn('⚠️ Could not get video duration, using estimate:', estimatedDuration);
                                resolveDuration(estimatedDuration);
                            }
                        } catch (e) {
                            // Fallback: estimate from blob size
                            const estimatedDuration = Math.max(1, Math.min(90, Math.round(blob.size / 150000)));
                            console.warn('⚠️ Error seeking for duration, using estimate:', estimatedDuration);
                            resolveDuration(estimatedDuration);
                        }
                    }
                };
                
                tempVideo.ondurationchange = () => {
                    const duration = tempVideo.duration;
                    if (isFinite(duration) && duration > 0 && !durationResolved) {
                        console.log('✅ Video duration changed, duration:', duration);
                        resolveDuration(duration);
                    }
                };
                
                tempVideo.onseeked = () => {
                    const duration = tempVideo.duration;
                    if (isFinite(duration) && duration > 0 && !durationResolved) {
                        console.log('✅ Video seeked, duration:', duration);
                        resolveDuration(duration);
                    }
                };
                
                tempVideo.onerror = (e) => {
                    console.error('❌ Error loading video for duration:', e);
                    console.error('Video error details:', {
                        error: tempVideo.error,
                        networkState: tempVideo.networkState,
                        readyState: tempVideo.readyState,
                        urlType: persistentUrl.startsWith('data:') ? 'data' : 'blob',
                        urlPreview: persistentUrl.substring(0, 50)
                    });
                    
                    // Fallback: use a default duration or estimate from blob size
                    if (!durationResolved) {
                        const estimatedDuration = Math.max(1, Math.round(blob.size / 100000)); // Rough estimate: 1 second per 100KB
                        console.warn('⚠️ Using estimated duration due to error:', estimatedDuration);
                        resolveDuration(estimatedDuration);
                    }
                };
                
                // Set source and load
                tempVideo.src = persistentUrl;
                tempVideo.load();
                
                // Timeout fallback
                setTimeout(() => {
                    if (!durationResolved) {
                        const estimatedDuration = Math.max(1, Math.round(blob.size / 100000));
                        console.warn('⚠️ Duration detection timeout, using estimate:', estimatedDuration);
                        resolveDuration(estimatedDuration);
                    }
                }, 5000);
            } else {
                console.error('No video chunks recorded');
            }
        };
        mr.start(100); // Request data every 100ms

        setRecording(true);
        setRecordingTime(MAX_VIDEO_SECONDS);

        // Start countdown timer
        recordingTimerRef.current = setInterval(() => {
            setRecordingTime(prev => {
                if (prev <= 1) {
                    // Stop recording when timer reaches 0
                    if (recordingTimerRef.current) {
                        clearInterval(recordingTimerRef.current);
                        recordingTimerRef.current = null;
                    }
                    stopRecording();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    function stopRecording() {
        // Clear recording timer
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setRecordingTime(MAX_VIDEO_SECONDS);
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setRecording(false);
        }
    }

    // Format time to MM:SS
    function formatTime(seconds: number): string {
        if (!isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Toggle play/pause
    function togglePlayPause() {
        if (previewVideoRef.current) {
            if (previewVideoRef.current.paused) {
                previewVideoRef.current.play();
            } else {
                previewVideoRef.current.pause();
            }
        }
    }

    // Get video duration when preview loads and ensure it plays
    React.useEffect(() => {
        if (previewUrl && previewVideoRef.current) {
            const video = previewVideoRef.current;

            // Stop camera stream when preview is shown
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }

            const handleLoadedMetadata = async () => {
                // Wait a bit for duration to be available (especially for blob URLs)
                let duration = video.duration;
                let attempts = 0;
                const maxAttempts = 10;
                
                // For blob URLs, duration might not be immediately available
                while ((!isFinite(duration) || duration <= 0 || isNaN(duration)) && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    duration = video.duration;
                    attempts++;
                }
                
                // Check if duration is valid (not NaN or Infinity)
                if (!isFinite(duration) || duration <= 0 || isNaN(duration)) {
                    // Try to get duration by seeking to end (for blob URLs)
                    let fallbackDuration = 0;
                    if (video.readyState >= 2) {
                        try {
                            // Store original time
                            const originalTime = video.currentTime;
                            // Seek to end to trigger duration update
                            video.currentTime = 1e10;
                            await new Promise(resolve => setTimeout(resolve, 200));
                            fallbackDuration = video.duration;
                            // Reset to beginning
                            video.currentTime = originalTime;
                        } catch (e) {
                            // Silent fail - will use default
                        }
                    }
                    
                    if (fallbackDuration > 0 && isFinite(fallbackDuration)) {
                        duration = fallbackDuration;
                    }
                }
                
                // Final check - if still invalid, use a reasonable default
                if (!isFinite(duration) || duration <= 0 || isNaN(duration)) {
                    // Use a default duration of 5 seconds for videos without metadata
                    duration = 5;
                    setVideoDuration(duration);
                    setTrimStart(0);
                    setTrimEnd(duration);
                } else {
                    setVideoDuration(duration);
                    setTrimStart(0);
                    setTrimEnd(duration);

                    // Enforce 90 second limit in Instant Create preview (only if duration is valid)
                    if (duration > MAX_VIDEO_SECONDS) {
                        Swal.fire(bottomSheet({
                            title: 'Video too long',
                            message: `Videos created here must be ${MAX_VIDEO_SECONDS} seconds or less. Please record or select a shorter clip.`,
                            icon: 'alert',
                        }));
                        setPreviewUrl(null);
                        setCurrentTime(0);
                        setIsPlaying(false);
                        return;
                    }
                }

                // Ensure video plays
                try {
                    await video.play();
                    setIsPlaying(true);
                } catch (e) {
                    console.error('Error playing preview video:', e);
                }
            };

            const handleTimeUpdate = () => {
                setCurrentTime(video.currentTime);
            };

            const handlePlay = () => {
                setIsPlaying(true);
                // Auto-hide controls after 3 seconds when playing
                if (controlsTimeoutRef.current) {
                    clearTimeout(controlsTimeoutRef.current);
                }
                controlsTimeoutRef.current = setTimeout(() => {
                    setShowControls(false);
                }, 3000);
            };

            const handlePause = () => {
                setIsPlaying(false);
                // Show controls when paused
                if (controlsTimeoutRef.current) {
                    clearTimeout(controlsTimeoutRef.current);
                }
                setShowControls(true);
            };

            const handleLoadedData = async () => {
                try {
                    await video.play();
                    setIsPlaying(true);
                } catch (e) {
                    console.error('Error playing preview video:', e);
                }
            };

            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            video.addEventListener('loadeddata', handleLoadedData);
            video.addEventListener('timeupdate', handleTimeUpdate);
            video.addEventListener('play', handlePlay);
            video.addEventListener('pause', handlePause);
            video.addEventListener('error', (e) => {
                console.error('Video error:', e);
            });

            return () => {
                video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                video.removeEventListener('loadeddata', handleLoadedData);
                video.removeEventListener('timeupdate', handleTimeUpdate);
                video.removeEventListener('play', handlePlay);
                video.removeEventListener('pause', handlePause);
                if (controlsTimeoutRef.current) {
                    clearTimeout(controlsTimeoutRef.current);
                }
            };
        }
    }, [previewUrl, isPlaying]);

    function handleNext() {
        // Use clips array if available, otherwise use single preview
        const clipsToPass = clips.length > 0 ? clips : (previewUrl ? [{
            id: `clip-${Date.now()}`,
            url: previewUrl,
            duration: videoDuration,
            trimStart: trimStart,
            trimEnd: trimEnd || videoDuration,
            speed: speed,
            reverse: reverse,
            blob: blobRef.current || undefined // Pass blob reference for upload in next step
        }] : []);

        if (clipsToPass.length === 0) return;

        // Check URL types - warn if blob URLs found (they'll be uploaded in InstantFiltersPage)
        const blobUrls = clipsToPass.filter(clip => clip.url && clip.url.startsWith('blob:'));
        const dataUrls = clipsToPass.filter(clip => clip.url && clip.url.startsWith('data:'));
        const backendUrls = clipsToPass.filter(clip => clip.url && (clip.url.startsWith('http://') || clip.url.startsWith('https://')));
        
        if (blobUrls.length > 0) {
            console.warn('⚠️ Found blob URLs in clips - will be uploaded to backend in next step:', blobUrls.map(c => ({ id: c.id, url: c.url.substring(0, 50) })));
        }
        
        if (dataUrls.length > 0) {
            console.warn('⚠️ Found data URLs in clips - will be uploaded to backend in next step:', dataUrls.length);
        }
        
        if (backendUrls.length > 0) {
            console.log('✅ Found backend URLs in clips:', backendUrls.length);
        }

        // Verify all URLs are data URLs
        const allDataUrls = clipsToPass.every(clip => !clip.url || clip.url.startsWith('data:') || clip.url.startsWith('http'));
        if (!allDataUrls) {
            console.warn('⚠️ Some clips have unexpected URL types:', clipsToPass.map(c => ({ 
                id: c.id, 
                urlType: c.url?.substring(0, 10) 
            })));
        }

        console.log('✅ All clips verified, navigating to filters page', {
            clipCount: clipsToPass.length,
            firstClipUrlType: clipsToPass[0].url?.startsWith('data:') ? 'data' : 
                             clipsToPass[0].url?.startsWith('blob:') ? 'blob' : 
                             clipsToPass[0].url?.startsWith('http') ? 'http' : 'unknown'
        });

        // Stop camera stream before navigating
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        // Stop video playback
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
        }

        // For now, pass the first clip's URL for preview in filters page
        // The full clips array will be passed through to CreatePage
        navigate('/create', {
            state: {
                videoUrl: clipsToPass[0].url,
                videoDuration: clipsToPass[0].duration,
                filterInfo: {
                    active: selectedFilter,
                    brightness,
                    contrast,
                    saturation,
                    hue,
                    exportFailed: false
                },
                filtered: selectedFilter !== 'None' || brightness !== 1 || contrast !== 1 || saturation !== 1 || hue !== 0,
                mediaType: 'video',
                storyMode: isStoryMode,
                storyAudience,
                storyExpiresHours: isStoryMode ? 24 : undefined,
            }
        });
    }

    async function handleSaveToDrafts() {
        if (!previewUrl) return;
        
        try {
            let persistentUrl = previewUrl;
            if (previewUrl.startsWith('blob:')) {
                try {
                    const res = await fetch(previewUrl);
                    const blob = await res.blob();
                    persistentUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error('Failed to convert previewUrl blob to data URL for draft:', e);
                    Swal.fire(bottomSheet({
                        title: 'Could not save draft',
                        message: 'Video could not be stored. Try again.',
                        icon: 'alert',
                    }));
                    return;
                }
            }

            await saveDraft({
                videoUrl: persistentUrl,
                videoDuration,
                trimStart,
                trimEnd,
                mediaType: 'video',
            });
            
            await Swal.fire(bottomSheet({
                title: 'Saved to Drafts!',
                message: 'Your video has been saved. You can find it in your profile page.',
                icon: 'success',
                confirmButtonText: 'Done',
            }));
            
            // Navigate back to feed
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
            }
            navigate('/feed');
        } catch (error) {
            console.error('Error saving draft:', error);
            Swal.fire(bottomSheet({
                title: 'Failed to Save',
                message: 'There was an error saving your draft. Please try again.',
                icon: 'alert',
            }));
        }
    }

    // Filter styles function
    const getFilterStyle = (filterName: string): React.CSSProperties => {
        let baseFilter = '';
        let hasVignette = false;
        
        switch (filterName) {
            case 'None':
                baseFilter = '';
                break;
            case 'Beauty':
                baseFilter = 'brightness(1.1) contrast(0.95) saturate(1.2)';
                break;
            case 'B&W':
                baseFilter = 'grayscale(100%)';
                break;
            case 'Sepia':
                baseFilter = 'sepia(100%)';
                break;
            case 'Vivid':
                baseFilter = 'brightness(1.1) contrast(1.2) saturate(1.5)';
                break;
            case 'Cool':
                baseFilter = 'brightness(1.05) contrast(1.1) saturate(0.8) hue-rotate(10deg)';
                break;
            case 'Vignette':
                baseFilter = 'brightness(0.9) contrast(1.1)';
                hasVignette = true;
                break;
            default:
                baseFilter = '';
        }
        
        // Combine base filter with adjustments (including hue)
        const hueRotate = hue !== 0.0 ? `hue-rotate(${hue * 180}deg)` : '';
        const adjustmentFilter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})${hueRotate ? ` ${hueRotate}` : ''}`;
        
        const result: React.CSSProperties = {};
        
        if (baseFilter && (brightness !== 1.0 || contrast !== 1.0 || saturation !== 1.0 || hue !== 0.0)) {
            result.filter = `${baseFilter} ${adjustmentFilter}`;
        } else if (baseFilter) {
            result.filter = baseFilter;
        } else if (brightness !== 1.0 || contrast !== 1.0 || saturation !== 1.0 || hue !== 0.0) {
            result.filter = adjustmentFilter;
        }
        
        if (hasVignette) {
            result.boxShadow = 'inset 0 0 200px rgba(0, 0, 0, 0.5)';
        }
        
        return result;
    };

    // Custom icon components matching Instagram style
    const EffectsIcon = ({ className }: { className?: string }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
            {/* Three sparkles in triangular pattern (two bottom, one top center) */}
            {/* Top sparkle */}
            <path d="M12 4 L12 8 M10 6 L14 6" strokeLinecap="round" />
            <circle cx="12" cy="6" r="1.5" fill="currentColor" />
            {/* Bottom left sparkle */}
            <path d="M6 16 L6 20 M4 18 L8 18" strokeLinecap="round" />
            <circle cx="6" cy="18" r="1.5" fill="currentColor" />
            {/* Bottom right sparkle */}
            <path d="M18 16 L18 20 M16 18 L20 18" strokeLinecap="round" />
            <circle cx="18" cy="18" r="1.5" fill="currentColor" />
        </svg>
    );

    const VideoLayoutIcon = ({ className }: { className?: string }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            {/* Rectangle divided into 4 quadrants */}
            <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="2" />
            <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" />
            {/* Fill top-left and bottom-right quadrants */}
            <rect x="4" y="4" width="8" height="8" fill="currentColor" />
            <rect x="12" y="12" width="8" height="8" fill="currentColor" />
        </svg>
    );

    const GreenScreenIcon = ({ className }: { className?: string }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
            {/* Dashed square outline */}
            <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" fill="none" />
            {/* Person silhouette inside - head and shoulders */}
            <circle cx="12" cy="9" r="2.5" fill="currentColor" />
            <path d="M9 16 Q12 12 15 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="currentColor" />
        </svg>
    );

    // Layout option icons
    const VerticalSplitIcon = ({ className, selected }: { className?: string; selected?: boolean }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <rect x="4" y="4" width="7" height="16" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="13" y="4" width="7" height="16" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
        </svg>
    );

    const HorizontalSplitIcon = ({ className, selected }: { className?: string; selected?: boolean }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <rect x="4" y="4" width="16" height="7" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="4" y="13" width="16" height="7" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
        </svg>
    );

    const Grid2x2Icon = ({ className, selected }: { className?: string; selected?: boolean }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <rect x="4" y="4" width="7" height="7" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="13" y="4" width="7" height="7" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="4" y="13" width="7" height="7" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="13" y="13" width="7" height="7" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
        </svg>
    );

    const Grid3x3Icon = ({ className, selected }: { className?: string; selected?: boolean }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
                      {/* 3x3 grid */}
            <rect x="4" y="4" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="9.75" y="4" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="15.5" y="4" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="4" y="9.75" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="9.75" y="9.75" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="15.5" y="9.75" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="4" y="15.5" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="9.75" y="15.5" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
            <rect x="15.5" y="15.5" width="4.5" height="4.5" fill={selected ? "currentColor" : "none"} stroke="currentColor" />
        </svg>
    );

    const YoutubeShortsMark = ({ className }: { className?: string }) => (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
            <path fill="currentColor" d="M23.5 6.2s-.2-1.7-1-2.4c-.9-1-2-1-2.4-1.1C17 2.5 12 2.5 12 2.5h0s-5 0-8.1.2c-.4 0-1.5.1-2.4 1.1-.7.7-1 2.4-1 2.4S.5 8.1.5 10v1.9c0 1.9.2 3.8.2 3.8s.2 1.7 1 2.4c.9 1 2.1.9 2.6 1 1.9.2 7.7.2 7.7.2s5 0 8.1-.2c.4 0 1.5-.1 2.4-1.1.7-.7 1-2.4 1-2.4s.2-1.9.2-3.8V10c0-1.9-.2-3.8-.2-3.8z" />
            {/* Knock-out play on black button = reads as white frame + play */}
            <path fill="#000000" d="M9.8 15.5V8.5L15.5 12l-5.7 3.5z" />
        </svg>
    );

    const TikTokMark = ({ className }: { className?: string }) => (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
            <path
                fill="currentColor"
                d="M19.32 8.28v3.38a8.3 8.3 0 0 1-4.76-1.48v6.7a6.38 6.38 0 1 1-6.38-6.38c.34 0 .67.03 1 .09v3.5a2.9 2.9 0 1 0 2.03 2.76V2h3.45v.45a4.82 4.82 0 0 0 4.66 4.53z"
            />
            <path
                fill="currentColor"
                d="M19.32 8.28a4.8 4.8 0 0 1-2.93-1v3.9a8.3 8.3 0 0 0 4.76 1.48V8.59a4.85 4.85 0 0 1-1.83-.31z"
            />
        </svg>
    );

    /** Instagram Reels–style mark (white frame + play cutout). */
    const ReelsMark = ({ className }: { className?: string }) => (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
            <rect x="3" y="5" width="18" height="15" rx="2.5" fill="currentColor" />
            <path fill="#000000" d="M11.2 12.2l4.2 2.4a.6.6 0 0 1 0 1.04l-4.2 2.4A.6.6 0 0 1 10.3 17V13a.6.6 0 0 1 .9-.52z" />
        </svg>
    );

        return (
        <div className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-black">
            {/* Profile story-ring palette (Avatar hasStory), soft corners ~20% viewport */}
            <div
                className="pointer-events-none absolute left-0 top-0 z-[6] h-[20vh] w-[20vw] min-h-[120px] min-w-[120px] max-h-[320px] max-w-[320px]"
                style={{ background: PROFILE_STORY_RING_GRADIENT, opacity: 0.38, maskImage: 'radial-gradient(ellipse 90% 90% at 0% 0%, black 38%, transparent 72%)', WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 0% 0%, black 38%, transparent 72%)' }}
                aria-hidden
            />
            <div
                className="pointer-events-none absolute bottom-0 right-0 z-[6] h-[20vh] w-[20vw] min-h-[120px] min-w-[120px] max-h-[320px] max-w-[320px]"
                style={{ background: PROFILE_STORY_RING_GRADIENT, opacity: 0.38, maskImage: 'radial-gradient(ellipse 90% 90% at 100% 100%, black 38%, transparent 72%)', WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 100% 100%, black 38%, transparent 72%)' }}
                aria-hidden
            />
            {/* Top bar: mode picker (simple) vs camera controls */}
            <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent px-4 py-3">
                {showCreateModePicker && !previewUrl ? (
                    <div className="flex items-center justify-between w-full">
                        <button
                            type="button"
                            onClick={handleInstantBack}
                            className="p-1.5 bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-black/80 active:scale-95 transition-colors"
                            aria-label="Back"
                        >
                            <FiArrowLeft className="w-4 h-4" />
                        </button>
                        <span className="text-white text-sm font-semibold tracking-wide">Create</span>
                        <div className="w-8" aria-hidden />
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 w-full">
                            <button
                                type="button"
                                onClick={handleInstantBack}
                                className="p-1.5 bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-black/80 active:scale-95 transition-colors"
                                aria-label="Back"
                            >
                                <FiArrowLeft className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                title="Flip camera"
                                className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 active:scale-95 transition-all duration-200"
                                onClick={() => {
                                    const next = facingMode === 'user' ? 'environment' : 'user';
                                    setFacingMode(next);
                                    initStream(next, micOn, cameraOn);
                                    if (dualCamera && dualStreamRef.current) {
                                        dualStreamRef.current.getTracks().forEach(t => t.stop());
                                        toggleDualCamera();
                                        setTimeout(() => toggleDualCamera(), 100);
                                    }
                                }}
                            >
                                <FiRotateCw className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                title={dualCamera ? 'Disable dual camera' : 'Enable dual camera'}
                                className={`p-2 rounded-lg ${dualCamera ? 'bg-white/25' : 'bg-black/60'} text-white hover:bg-black/80 active:scale-95 transition-all duration-200`}
                                onClick={toggleDualCamera}
                            >
                                <FiCopy className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                                className={`p-2 rounded-lg ${cameraOn ? 'bg-black/60' : 'bg-red-600/80'} text-white hover:bg-black/80 active:scale-95 transition-all duration-200`}
                                onClick={toggleCamera}
                            >
                                {cameraOn ? <FiVideo className="w-4 h-4" /> : <FiVideoOff className="w-4 h-4" />}
                            </button>
                            <button
                                type="button"
                                title={micOn ? 'Mute mic' : 'Unmute mic'}
                                className={`p-2 rounded-lg ${micOn ? 'bg-black/60' : 'bg-red-600/80'} text-white hover:bg-black/80 active:scale-95 transition-all duration-200`}
                                onClick={() => {
                                    const next = !micOn;
                                    setMicOn(next);
                                    if (streamRef.current) {
                                        const audioTrack = streamRef.current.getAudioTracks()[0];
                                        if (audioTrack) {
                                            audioTrack.enabled = next;
                                        }
                                    } else if (next) {
                                        initStream(facingMode, true, cameraOn);
                                    }
                                }}
                            >
                                {micOn ? <FiMic className="w-4 h-4" /> : <FiMicOff className="w-4 h-4" />}
                            </button>
                            <button
                                type="button"
                                title={showGuides ? 'Hide guides' : 'Show guides'}
                                className={`p-2 rounded-lg ${showGuides ? 'bg-white/70 text-black' : 'bg-black/60 text-white'} hover:bg-black/80 active:scale-95 transition-all duration-200`}
                                onClick={() => setShowGuides(!showGuides)}
                            >
                                <span className="text-xs font-semibold">G</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {previewUrl && (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-gray-100 transition-colors"
                                >
                                    {isStoryMode ? 'Share story' : 'Next'}
                                </button>
                            )}
                            {recording && (
                                <div className="relative w-8 h-8">
                                    <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 48 48">
                                        <circle cx="24" cy="24" r="20" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="4" fill="none" />
                                        <circle
                                            cx="24" cy="24" r="20"
                                            stroke="rgba(255, 255, 255, 0.9)" strokeWidth="4" fill="none"
                                            strokeDasharray={`${TIMER_CIRCUMFERENCE}`}
                                            strokeDashoffset={`${TIMER_CIRCUMFERENCE * (1 - ((recordingLimitForDisplay - recordingTime) / recordingLimitForDisplay))}`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-white text-[10px] font-bold">{recordingTime}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Video preview / vertical mode picker — picker stays in-flow so flex-1 gets real height */}
            <div className="relative z-10 flex min-h-0 flex-1 flex-col bg-black">
                {!previewUrl ? (
                    <>
                        {!showCreateModePicker && (
                            <div className="relative flex min-h-0 flex-1">
                                <video
                                    ref={videoRef}
                                    playsInline
                                    muted
                                    className={`h-full min-h-0 w-full flex-1 ${greenEnabled ? 'hidden' : 'block'} object-cover`}
                                    style={getFilterStyle(selectedFilter)}
                                />
                                <canvas
                                    ref={greenCanvasRef}
                                    className={`${greenEnabled ? 'block' : 'hidden'} absolute inset-0 h-full w-full object-cover`}
                                    style={{ zIndex: greenEnabled ? 10 : 0, ...getFilterStyle(selectedFilter) }}
                                />
                                {dualCamera && !greenEnabled && (
                                    <video
                                        ref={dualCameraRef}
                                        playsInline
                                        muted
                                        className="absolute bottom-20 right-4 z-20 h-48 w-32 rounded-xl border-2 border-white/30 object-cover shadow-2xl"
                                    />
                                )}
                            </div>
                        )}

                        {showCreateModePicker && (
                            <div
                                className="relative flex min-h-0 flex-1 flex-col bg-gradient-to-b from-zinc-950 via-neutral-950 to-black"
                                style={{
                                    perspective: '1400px',
                                    perspectiveOrigin: '50% 50%',
                                }}
                            >
                                {/* Narrow side rails: white → grey, centre stays dark */}
                                <div
                                    className="pointer-events-none absolute inset-y-0 left-0 z-[18] w-[min(15vw,80px)] bg-gradient-to-r from-white/30 via-neutral-400/22 to-transparent"
                                    aria-hidden
                                />
                                <div
                                    className="pointer-events-none absolute inset-y-0 right-0 z-[18] w-[min(15vw,80px)] bg-gradient-to-l from-white/30 via-neutral-400/22 to-transparent"
                                    aria-hidden
                                />
                                <div className="relative z-[20] min-h-0 w-full flex-1 pt-14 opacity-[0.98]">
                                    <div
                                        ref={verticalPickerRef}
                                        className="scrollbar-hide relative z-[20] h-full min-h-0 touch-pan-y overflow-x-hidden overflow-y-auto"
                                        style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
                                        onPointerDown={() => setIsVerticalPickerDragging(true)}
                                        onPointerUp={() => window.setTimeout(() => setIsVerticalPickerDragging(false), 70)}
                                        onPointerCancel={() => setIsVerticalPickerDragging(false)}
                                        onPointerLeave={() => setIsVerticalPickerDragging(false)}
                                    >
                                        <div className="min-h-[28vh] shrink-0" aria-hidden />
                                        {([
                                            { id: 'community' as const, title: 'Community', icon: 'community' as const },
                                            { id: 'text' as const, title: 'Text only', icon: 'type' as const },
                                            { id: 'story' as const, title: '24h Story', icon: 'story' as const },
                                            { id: 'gallery' as const, title: 'Gallery', icon: 'gallery' as const },
                                            { id: 'youtube' as const, title: 'YouTube Shorts', icon: 'youtube' as const },
                                            { id: 'tiktok' as const, title: 'TikTok', icon: 'tiktok' as const },
                                            { id: 'instagram_reels' as const, title: 'Instagram Reels', icon: 'reels' as const },
                                        ]).map((item) => {
                                            const isCentered = centeredCreateMode === item.id;
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex shrink-0 min-h-[136px] items-center justify-center px-6"
                                                    style={{ scrollSnapAlign: 'center' }}
                                                >
                                                    <button
                                                        type="button"
                                                        data-create-mode={item.id}
                                                        title={item.title}
                                                        aria-label={item.title}
                                                        className={`relative flex w-full max-w-[240px] flex-col items-center gap-2 rounded-2xl py-1 outline-none will-change-transform transition-all duration-300 ${
                                                            isCentered ? 'drop-shadow-[0_0_40px_rgba(255,255,255,0.55)]' : ''
                                                        }`}
                                                        onClick={() => {
                                                            if (isVerticalPickerDragging) return;
                                                            if (!isCentered) {
                                                                centerVerticalPickerItem(verticalPickerRef.current, item.id, true);
                                                                return;
                                                            }
                                                            if (item.id === 'gallery') {
                                                                setIsStoryMode(false);
                                                                pendingSocialUploadRef.current = null;
                                                                cameraRollInputRef.current?.click();
                                                                return;
                                                            }
                                                            if (item.id === 'community') {
                                                                (async () => {
                                                                    const res = await Swal.fire(bottomSheet({
                                                                        title: 'Create a community',
                                                                        message:
                                                                            'Communities let members chat in one group space. Create a community, then invite people with the + button in the group chat.',
                                                                        icon: 'info',
                                                                        confirmButtonText: 'Continue',
                                                                        cancelButtonText: 'Not now',
                                                                        showCancelButton: true,
                                                                    }));
                                                                    if (res.isConfirmed) {
                                                                        setCreateGroupOpen(true);
                                                                    }
                                                                })();
                                                                return;
                                                            }
                                                            if (item.id === 'story') {
                                                                pendingSocialUploadRef.current = null;
                                                                setIsStoryMode(true);
                                                                navigate('/clip', { state: { storyMode: true, storyAudience } });
                                                                return;
                                                            }
                                                            if (item.id === 'text') {
                                                                pendingSocialUploadRef.current = null;
                                                                setIsStoryMode(false);
                                                                navigate('/create/text-only');
                                                                return;
                                                            }
                                                            if (item.id === 'youtube') {
                                                                setIsStoryMode(false);
                                                                pendingSocialUploadRef.current = 'youtube_shorts';
                                                                cameraRollInputRef.current?.click();
                                                                return;
                                                            }
                                                            if (item.id === 'tiktok') {
                                                                setIsStoryMode(false);
                                                                pendingSocialUploadRef.current = 'tiktok';
                                                                cameraRollInputRef.current?.click();
                                                                return;
                                                            }
                                                            if (item.id === 'instagram_reels') {
                                                                setIsStoryMode(false);
                                                                pendingSocialUploadRef.current = 'instagram_reels';
                                                                cameraRollInputRef.current?.click();
                                                                return;
                                                            }
                                                        }}
                                                    >
                                                        <div
                                                            className={`relative rounded-full p-[3px] transition-[box-shadow,background-color] duration-300 ${
                                                                isCentered
                                                                    ? 'shadow-[0_0_0_1px_rgba(246,226,122,0.9),0_0_26px_rgba(212,175,55,0.75),0_0_54px_rgba(212,175,55,0.5),0_0_92px_rgba(192,198,205,0.35)]'
                                                                    : 'shadow-none'
                                                            }`}
                                                            style={{
                                                                background: isCentered
                                                                    ? 'linear-gradient(135deg, #f5f6f8 0%, #d7dce2 26%, #c0c6cd 52%, #f0f2f5 78%, #d4af37 100%)'
                                                                    : 'rgba(255,255,255,0.75)'
                                                            }}
                                                        >
                                                            {(item.id === 'youtube' || item.id === 'tiktok' || item.id === 'instagram_reels') && (
                                                                <span
                                                                    className="absolute -right-1 -top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg ring-2 ring-black/50"
                                                                    title="Upload from your gallery"
                                                                    aria-hidden
                                                                >
                                                                    <FiUpload className="h-4 w-4" strokeWidth={2.25} />
                                                                </span>
                                                            )}
                                                            <div
                                                                className={`${isCentered ? 'h-[76px] w-[76px]' : 'h-[48px] w-[48px]'} flex items-center justify-center rounded-full bg-black transition-[width,height,box-shadow] duration-300 ${
                                                                    isCentered
                                                                        ? 'shadow-[0_0_22px_rgba(192,198,205,0.55),inset_0_0_0_1px_rgba(240,242,245,0.55)]'
                                                                        : ''
                                                                }`}
                                                            >
                                                                {item.icon === 'community' && <FiUsers className={isCentered ? 'h-8 w-8 text-[#eef1f4]' : 'h-6 w-6 text-white'} />}
                                                                {item.icon === 'type' && <FiType className={isCentered ? 'h-8 w-8 text-[#eef1f4]' : 'h-6 w-6 text-white'} />}
                                                                {item.icon === 'gallery' && <FiUpload className={isCentered ? 'h-8 w-8 text-[#eef1f4]' : 'h-6 w-6 text-white'} />}
                                                                {item.icon === 'story' && <FiCamera className={isCentered ? 'h-8 w-8 text-[#eef1f4]' : 'h-6 w-6 text-white'} />}
                                                                {item.icon === 'youtube' && <YoutubeShortsMark className={isCentered ? 'h-9 w-9 text-[#eef1f4]' : 'h-6 w-6 text-white'} />}
                                                                {item.icon === 'tiktok' && <TikTokMark className={isCentered ? 'h-9 w-9 text-[#eef1f4]' : 'h-6 w-6 text-white'} />}
                                                                {item.icon === 'reels' && <ReelsMark className={isCentered ? 'h-9 w-9 text-[#eef1f4]' : 'h-6 w-6 text-white'} />}
                                                            </div>
                                                        </div>
                                                        <span
                                                            className={`max-w-[220px] text-center text-[13px] font-semibold leading-tight text-white ${isCentered ? 'opacity-100' : 'opacity-70'}`}
                                                        >
                                                            {item.title}
                                                            {(item.id === 'youtube' || item.id === 'tiktok' || item.id === 'instagram_reels') && (
                                                                <span className="mt-0.5 block text-[10px] font-medium text-white/65">Upload for this format</span>
                                                            )}
                                                        </span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        <div className="min-h-[28vh] shrink-0" aria-hidden />
                                    </div>
                                </div>
                                <p
                                    className="shrink-0 px-4 pb-4 text-center text-[11px] text-white/55"
                                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 0.75rem)' }}
                                >
                                    Scroll to choose · tap the highlighted option
                                </p>
                            </div>
                        )}
                        <CreateGroupModal
                            isOpen={createGroupOpen}
                            onClose={() => setCreateGroupOpen(false)}
                            onCreated={(g) => {
                                setCreateGroupOpen(false);
                                navigate(`/messages/group/${encodeURIComponent(g.id)}`);
                                void Swal.fire(bottomSheet({
                                    title: 'Community created',
                                    message: `You are in "${g.name}". Use + in the header to invite members.`,
                                    icon: 'success',
                                    confirmButtonText: 'Open chat',
                                }));
                            }}
                        />
                    </>
                ) : (
                    <div
                        className="relative flex h-full min-h-0 w-full flex-1 items-center justify-center"
                        onMouseEnter={() => {
                            setShowControls(true);
                            if (controlsTimeoutRef.current) {
                                clearTimeout(controlsTimeoutRef.current);
                            }
                        }}
                        onMouseLeave={() => {
                            if (isPlaying) {
                                if (controlsTimeoutRef.current) {
                                    clearTimeout(controlsTimeoutRef.current);
                                }
                                controlsTimeoutRef.current = setTimeout(() => {
                                    setShowControls(false);
                                }, 3000);
                            }
                        }}
                        onClick={() => {
                            setShowControls(true);
                            if (controlsTimeoutRef.current) {
                                clearTimeout(controlsTimeoutRef.current);
                            }
                            togglePlayPause();
                        }}
                        onTouchStart={() => {
                            setShowControls(true);
                            if (controlsTimeoutRef.current) {
                                clearTimeout(controlsTimeoutRef.current);
                            }
                        }}
                    >
                        <video
                            key={previewUrl}
                            ref={previewVideoRef}
                            src={previewUrl}
                            autoPlay
                            playsInline
                            muted={false}
                            className="w-full h-full object-contain"
                            loop
                            style={getFilterStyle(selectedFilter)}
                        />

                        {/* Custom Play/Pause Overlay */}
                        {showControls && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        togglePlayPause();
                                    }}
                                    className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-all hover:scale-110 shadow-2xl"
                                    aria-label={isPlaying ? 'Pause' : 'Play'}
                                >
                                    {isPlaying ? (
                                        <FiPause className="w-10 h-10 text-white ml-1" />
                                    ) : (
                                        <FiPlay className="w-10 h-10 text-white ml-1" />
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Custom Video Controls Bar */}
                        <div
                            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Progress Bar */}
                            <div className="mb-3">
                                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-100"
                                        style={{ width: `${videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            {/* Timeline Scrubber - Enhanced */}
                            <div className="relative mb-3">
                                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                                    onClick={(e) => {
                                        if (!previewVideoRef.current) return;
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const clickX = e.clientX - rect.left;
                                        const percentage = clickX / rect.width;
                                        const newTime = percentage * videoDuration;
                                        previewVideoRef.current.currentTime = Math.max(0, Math.min(newTime, videoDuration));
                                    }}
                                >
                                    <div className="h-full bg-gradient-to-r from-neutral-300 to-neutral-500 transition-all duration-100"
                                        style={{ width: `${videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            {/* Time Display and Controls */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePlayPause();
                                        }}
                                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors active:scale-95"
                                        aria-label={isPlaying ? 'Pause' : 'Play'}
                                    >
                                        {isPlaying ? (
                                            <FiPause className="w-5 h-5 text-white" />
                                        ) : (
                                            <FiPlay className="w-5 h-5 text-white ml-0.5" />
                                        )}
                                    </button>
                                    <span className="text-white text-sm font-medium tabular-nums">
                                        {formatTime(currentTime)} / {formatTime(videoDuration)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (previewVideoRef.current) {
                                                previewVideoRef.current.currentTime = Math.max(0, previewVideoRef.current.currentTime - 1);
                                            }
                                        }}
                                        className="px-2 py-1 rounded bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
                                        title="Rewind 1s"
                                    >
                                        -1s
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (previewVideoRef.current) {
                                                previewVideoRef.current.currentTime = Math.min(videoDuration, previewVideoRef.current.currentTime + 1);
                                            }
                                        }}
                                        className="px-2 py-1 rounded bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
                                        title="Forward 1s"
                                    >
                                        +1s
                                    </button>
                                </div>
                            </div>
                        </div>

                        {isStoryMode && (
                            <>
                                <div className="absolute left-3 right-3 bottom-[124px] z-40 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                    <div className="rounded-2xl border border-white/20 bg-black/55 backdrop-blur-md px-3 py-2 text-white">
                                        <div className="flex items-center justify-between gap-3 text-[11px]">
                                            <div className="font-semibold">Story preflight</div>
                                            <div className="text-white/70">Expires in 24h</div>
                                        </div>
                                        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-white/80">
                                            <span>{previewUrl ? '✓ clip ready' : '• add clip'}</span>
                                            <span>✓ audience: {storyAudience === 'close_friends' ? 'Followers' : storyAudience === 'only_me' ? 'Only me' : 'Public'}</span>
                                            <span>✓ safe area visible</span>
                                            <span>✓ audio: {micOn ? 'on' : 'off'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 z-40" onClick={(e) => e.stopPropagation()}>
                                    <div
                                        aria-hidden
                                        className="pointer-events-none absolute inset-x-0 -top-16 h-24 bg-gradient-to-t from-black/72 via-black/38 to-transparent"
                                    />
                                    <div className="bg-black/30 backdrop-blur-[1px] border-t border-white/20 shadow-lg">
                                        <div className="px-3 py-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 0.4rem)' }}>
                                            <div
                                                ref={storyPreviewRailRef}
                                                className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1"
                                                style={{ scrollSnapType: 'x mandatory' }}
                                                onPointerDown={() => setIsStoryPreviewDragging(true)}
                                                onPointerUp={() => window.setTimeout(() => setIsStoryPreviewDragging(false), 80)}
                                                onPointerCancel={() => setIsStoryPreviewDragging(false)}
                                                onPointerLeave={() => setIsStoryPreviewDragging(false)}
                                            >
                                                <div className="shrink-0 w-[36%]" aria-hidden />
                                                {([
                                                    { id: 'filters' as const, title: 'Filters', icon: FiFilter },
                                                    { id: 'audience' as const, title: 'Audience', icon: FiUser },
                                                    { id: 'save' as const, title: 'Draft', icon: FiSave },
                                                    { id: 'next' as const, title: 'Share', icon: FiArrowLeft },
                                                ]).map((item) => {
                                                    const Icon = item.icon;
                                                    const isCentered = centeredStoryPreviewAction === item.id;
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            data-story-preview-action={item.id}
                                                            onClick={() => {
                                                                if (isStoryPreviewDragging) return;
                                                                if (!isCentered) {
                                                                    centerRailItem(storyPreviewRailRef.current, `[data-story-preview-action="${item.id}"]`, true);
                                                                    return;
                                                                }
                                                                if (item.id === 'filters') {
                                                                    setShowFilters(true);
                                                                    return;
                                                                }
                                                                if (item.id === 'audience') {
                                                                    setShowStoryAudienceSheet(true);
                                                                    return;
                                                                }
                                                                if (item.id === 'save') {
                                                                    handleSaveToDrafts();
                                                                    return;
                                                                }
                                                                handleNext();
                                                            }}
                                                            title={item.title}
                                                            aria-label={item.title}
                                                            className="relative shrink-0 w-[72px] h-[76px] flex items-center justify-center transition-transform duration-200"
                                                            style={{
                                                                scrollSnapAlign: 'center',
                                                                transform: `scale(${isCentered ? 1.1 : 0.86})`,
                                                                opacity: isCentered ? 1 : 0.62,
                                                            }}
                                                        >
                                                            <div className="flex flex-col items-center gap-1">
                                                                <div
                                                                    className={`p-[2px] rounded-full transition-shadow duration-200 ${isCentered ? 'shadow-[0_0_24px_rgba(255,255,255,0.22)]' : ''}`}
                                                                    style={{ background: isCentered ? '#ffffff' : 'rgba(255,255,255,0.78)' }}
                                                                >
                                                                    <div className={`${isCentered ? 'w-11 h-11' : 'w-10 h-10'} rounded-full bg-black flex items-center justify-center transition-all duration-200`}>
                                                                        <Icon className={`w-5 h-5 ${item.id === 'next' ? 'rotate-180' : ''} text-white`} />
                                                                    </div>
                                                                </div>
                                                                <span className={`text-[10px] leading-none font-medium text-white ${isCentered ? 'opacity-95' : 'opacity-75'}`}>
                                                                    {item.title}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                                <div className="shrink-0 w-[36%]" aria-hidden />
                                            </div>
                                            <div className="pt-1 text-center text-[10px] text-white/70">
                                                This story is live for 24 hours. Audience: {storyAudience === 'close_friends' ? 'Followers' : storyAudience === 'only_me' ? 'Only me' : 'Public'}.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Record Button */}
            {!previewUrl && !showCreateModePicker && (
                <div className="absolute bottom-28 left-0 right-0 z-50 flex flex-col items-center justify-center gap-3">
                    {/* Main record button */}
                    {!recording && countdown === null ? (
                        <button
                            onClick={() => {
                                // Optional 3s countdown before recording/capture
                                setCountdown(3);
                                const t1 = setTimeout(() => setCountdown(2), 1000);
                                const t2 = setTimeout(() => setCountdown(1), 2000);
                                const t3 = setTimeout(() => { setCountdown(null); startRecording(); }, 3000);
                            }}
                            className="w-20 h-20 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-500 border-4 border-white shadow-2xl flex items-center justify-center hover:scale-105 transition-all duration-300 active:scale-95"
                            aria-label="Record video"
                        >
                            <FiCircle className="w-10 h-10 text-black" fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className={`w-20 h-20 rounded-full border-4 border-white shadow-2xl flex items-center justify-center hover:scale-105 transition-all duration-500 active:scale-95 ${
                                countdown !== null
                                    ? 'bg-red-500 animate-pulse'
                                    : 'bg-red-500'
                            }`}
                            aria-label={recording ? "Stop recording" : "Recording starting..."}
                        >
                            {recording ? (
                                <div className="w-8 h-8 rounded bg-white"></div>
                            ) : countdown !== null ? (
                                <div className="text-white text-2xl font-bold">{countdown}</div>
                            ) : (
                                <div className="w-8 h-8 rounded bg-white"></div>
                            )}
                        </button>
                    )}
                </div>
            )}



            {/* Effects Card - Slides up from bottom */}
            {showEffectsCard && !previewUrl && (
                <div className="absolute inset-0 z-50 flex items-end">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowEffectsCard(false)}
                    />
                    {/* Card */}
                    <div className="relative w-full bg-gradient-to-b from-gray-900 to-gray-950 rounded-t-3xl p-6 pb-safe transform transition-transform duration-300 ease-out shadow-2xl border-t border-white/10">
                        {/* Handle bar */}
                        <div className="w-16 h-1.5 bg-gray-500/50 rounded-full mx-auto mb-6" />
                        
                        {/* Title */}
                        <div className="flex items-center justify-center gap-2 mb-6">
                            <EffectsIcon className="w-5 h-5 text-white/80" />
                            <h3 className="text-white text-xl font-bold">Effects</h3>
                        </div>
                        
                        {/* Options */}
                        <div className="flex flex-col gap-3">
                            {/* Boomerang Option */}
                            <button
                                onClick={() => {
                                    // TODO: Implement boomerang functionality
                                    console.log('Boomerang option clicked');
                                    setShowEffectsCard(false);
                                }}
                                className="group flex items-center gap-4 p-4 bg-gray-800/80 hover:bg-white/10 rounded-xl border border-gray-700/50 hover:border-white/30 transition-all duration-200 active:scale-98"
                            >
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/15 to-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/30">
                                    <FiRefreshCw className="w-7 h-7 text-white/90" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-white font-semibold text-base mb-0.5">Boomerang</div>
                                    <div className="text-gray-400 text-sm">Record a boomerang video</div>
                                </div>
                                <div className="text-gray-500 group-hover:text-white/80 transition-colors">
                                    <FiArrowLeft className="w-5 h-5 rotate-180" />
                                </div>
                            </button>
                            
                            {/* Edit Option */}
                            <button
                                onClick={() => {
                                    // Navigate to filters page for editing
                                    if (previewUrl || clips.length > 0) {
                                        const clipsToPass = clips.length > 0 ? clips : (previewUrl ? [{
                                            id: `clip-${Date.now()}`,
                                            url: previewUrl,
                                            duration: videoDuration,
                                            trimStart: trimStart,
                                            trimEnd: trimEnd || videoDuration,
                                            speed: speed,
                                            reverse: reverse,
                                            blob: blobRef.current || undefined
                                        }] : []);

                                        if (clipsToPass.length > 0) {
                                            // Stop camera stream before navigating
                                            if (streamRef.current) {
                                                streamRef.current.getTracks().forEach(t => t.stop());
                                                streamRef.current = null;
                                            }

                                            // Stop video playback
                                            if (videoRef.current) {
                                                videoRef.current.pause();
                                                videoRef.current.srcObject = null;
                                            }

                                            navigate('/create', {
                                                state: {
                                                    videoUrl: clipsToPass[0].url,
                                                    videoDuration: clipsToPass[0].duration,
                                                    filterInfo: {
                                                        active: selectedFilter,
                                                        brightness,
                                                        contrast,
                                                        saturation,
                                                        hue,
                                                        exportFailed: false
                                                    },
                                                    filtered: selectedFilter !== 'None' || brightness !== 1 || contrast !== 1 || saturation !== 1 || hue !== 0,
                                                    mediaType: 'video',
                                                }
                                            });
                                        }
                                    } else {
                                        // No video to edit, show message
                                        Swal.fire(bottomSheet({
                                            title: 'No Video to Edit',
                                            message: 'Please record or select a video first',
                                            icon: 'alert',
                                        }));
                                    }
                                    setShowEffectsCard(false);
                                }}
                                className="group flex items-center gap-4 p-4 bg-gray-800/80 hover:bg-white/10 rounded-xl border border-gray-700/50 hover:border-white/30 transition-all duration-200 active:scale-98"
                            >
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/15 to-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/30">
                                    <FiEdit3 className="w-7 h-7 text-white/90" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-white font-semibold text-base mb-0.5">Edit</div>
                                    <div className="text-gray-400 text-sm">Edit video settings</div>
                                </div>
                                <div className="text-gray-500 group-hover:text-white/80 transition-colors">
                                    <FiArrowLeft className="w-5 h-5 rotate-180" />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters Card - Slides up from bottom */}
            {showFilters && (
                <div className="absolute inset-0 z-50 flex items-end">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowFilters(false)}
                    />
                    {/* Card */}
                    <div className="relative w-full bg-gradient-to-b from-gray-900 to-gray-950 rounded-t-3xl p-6 pb-safe transform transition-transform duration-300 ease-out shadow-2xl border-t border-white/10">
                        {/* Handle bar */}
                        <div className="w-16 h-1.5 bg-gray-500/50 rounded-full mx-auto mb-6" />
                        
                        {/* Title */}
                        <div className="flex items-center justify-center gap-2 mb-6">
                            <FiFilter className="w-5 h-5 text-white/80" />
                            <h3 className="text-white text-xl font-bold">Filters</h3>
                        </div>
                        
                        {/* Filter Options - Horizontal Scroll */}
                        <div className="flex gap-3 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                            {['None', 'B&W', 'Sepia', 'Vivid', 'Cool', 'Vignette', 'Beauty'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setSelectedFilter(filter)}
                                    className={`flex-shrink-0 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                                        selectedFilter === filter
                                            ? 'bg-white text-black shadow-lg shadow-white/20'
                                            : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>

                        {/* Adjustments Toggle */}
                        <button
                            onClick={() => {
                                setShowAdjustments(!showAdjustments);
                                setShowFilters(false);
                            }}
                            className="w-full flex items-center justify-between p-4 bg-gray-800/80 hover:bg-gray-700 rounded-xl border border-gray-700/50 transition-all duration-200"
                        >
                            <div className="flex items-center gap-3">
                                <FiSliders className="w-5 h-5 text-white/80" />
                                <div className="text-left">
                                    <div className="text-white font-semibold text-base">Adjustments</div>
                                    <div className="text-gray-400 text-sm">Brightness, Contrast, Saturation, Hue</div>
                                </div>
                            </div>
                            <FiArrowLeft className="w-5 h-5 text-gray-400 rotate-180" />
                        </button>
                    </div>
                </div>
            )}

            {/* Adjustments Card - Slides up from bottom */}
            {showAdjustments && (
                <div className="absolute inset-0 z-50 flex items-end">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowAdjustments(false)}
                    />
                    {/* Card */}
                    <div className="relative w-full bg-gradient-to-b from-gray-900 to-gray-950 rounded-t-3xl p-6 pb-safe transform transition-transform duration-300 ease-out shadow-2xl border-t border-white/10">
                        {/* Handle bar */}
                        <div className="w-16 h-1.5 bg-gray-500/50 rounded-full mx-auto mb-6" />
                        
                        {/* Title */}
                        <div className="flex items-center justify-center gap-2 mb-6">
                            <FiSliders className="w-5 h-5 text-white/80" />
                            <h3 className="text-white text-xl font-bold">Adjustments</h3>
                        </div>
                        
                        {/* Adjustment Controls */}
                        <div className="space-y-6">
                            {/* Brightness */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiZap className="w-4 h-4 text-white/70" />
                                        <span className="text-sm font-medium text-gray-200">Brightness</span>
                                    </div>
                                    <span className="text-xs font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded">
                                        {Math.round(brightness * 100)}%
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min={0.4} 
                                    max={1.8} 
                                    step={0.01} 
                                    value={brightness} 
                                    onChange={(e) => setBrightness(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neutral-300"
                                    style={{
                                        background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${((brightness - 0.4) / 1.4) * 100}%, #374151 ${((brightness - 0.4) / 1.4) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>

                            {/* Contrast */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiLayers className="w-4 h-4 text-white/70" />
                                        <span className="text-sm font-medium text-gray-200">Contrast</span>
                                    </div>
                                    <span className="text-xs font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded">
                                        {Math.round(contrast * 100)}%
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min={0.5} 
                                    max={2.0} 
                                    step={0.01} 
                                    value={contrast} 
                                    onChange={(e) => setContrast(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neutral-300"
                                    style={{
                                        background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${((contrast - 0.5) / 1.5) * 100}%, #374151 ${((contrast - 0.5) / 1.5) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>

                            {/* Saturation */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiDroplet className="w-4 h-4 text-white/70" />
                                        <span className="text-sm font-medium text-gray-200">Saturation</span>
                                    </div>
                                    <span className="text-xs font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded">
                                        {Math.round(saturation * 100)}%
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min={0.0} 
                                    max={2.0} 
                                    step={0.01} 
                                    value={saturation} 
                                    onChange={(e) => setSaturation(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neutral-300"
                                    style={{
                                        background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${(saturation / 2.0) * 100}%, #374151 ${(saturation / 2.0) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>

                            {/* Hue */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiGrid className="w-4 h-4 text-white/70" />
                                        <span className="text-sm font-medium text-gray-200">Hue</span>
                                    </div>
                                    <span className="text-xs font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded">
                                        {hue > 0 ? '+' : ''}{Math.round(hue * 100)}%
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min={-1.0} 
                                    max={1.0} 
                                    step={0.01} 
                                    value={hue} 
                                    onChange={(e) => setHue(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neutral-300"
                                    style={{
                                        background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${((hue + 1.0) / 2.0) * 100}%, #374151 ${((hue + 1.0) / 2.0) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={() => {
                                    setBrightness(1.0);
                                    setContrast(1.0);
                                    setSaturation(1.0);
                                    setHue(0.0);
                                }}
                                className="w-full p-3 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <FiRefreshCw className="w-4 h-4" />
                                Reset to Default
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showStoryAudienceSheet && isStoryMode && (
                <div className="fixed inset-0 z-[110] flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setShowStoryAudienceSheet(false)}>
                    <div
                        className="w-full rounded-t-2xl border-t border-white/15 bg-[#0b0b0f] p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
                        <h3 className="text-white text-base font-semibold">Story audience</h3>
                        <p className="mt-1 text-xs text-white/70">Choose who can view this 24-hour story.</p>
                        <div className="mt-4 space-y-2">
                            {([
                                { id: 'public' as const, title: 'Public', desc: 'Anyone who can view your stories' },
                                { id: 'close_friends' as const, title: 'Followers', desc: 'Only users who follow you can view' },
                                { id: 'only_me' as const, title: 'Only me', desc: 'Private story for your own archive' },
                            ]).map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => {
                                        setStoryAudience(option.id);
                                        setShowStoryAudienceSheet(false);
                                    }}
                                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                        storyAudience === option.id
                                            ? 'border-white bg-white/15 text-white'
                                            : 'border-white/20 bg-black/30 text-white/90 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold">{option.title}</div>
                                            <div className="text-xs text-white/70">{option.desc}</div>
                                        </div>
                                        <div className={`h-2.5 w-2.5 rounded-full ${storyAudience === option.id ? 'bg-white' : 'bg-white/35'}`} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Gazetteer Menu Modal */}
            {showGazetteerMenu && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowGazetteerMenu(false)}>
                    <div className="bg-gray-900 rounded-2xl p-6 w-80 max-w-[90vw] border border-white/20 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white text-lg font-semibold">Gazetteer</h3>
                            <button
                                onClick={() => setShowGazetteerMenu(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {/* Create a carousel */}
                            <button
                                onClick={async () => {
                                    setShowGazetteerMenu(false);
                                    try {
                                        const gazetteerTemplate = await getTemplate(TEMPLATE_IDS.GAZETTEER);
                                        if (gazetteerTemplate) {
                                            navigate('/template-editor', {
                                                state: { template: gazetteerTemplate }
                                            });
                                        } else {
                                            Swal.fire(bottomSheet({
                                                title: 'Error',
                                                message: 'Could not load Gazetteer template',
                                                icon: 'alert',
                                            }));
                                        }
                                    } catch (error) {
                                        console.error('Error loading Gazetteer template:', error);
                                        Swal.fire(bottomSheet({
                                            title: 'Error',
                                            message: 'Failed to load Gazetteer template',
                                            icon: 'alert',
                                        }));
                                    }
                                }}
                                className="w-full p-4 rounded-xl bg-white/5 border border-white/15 hover:border-white/35 transition-all text-left"
                            >
                                <div className="text-white font-semibold mb-1">Create a carousel</div>
                                <div className="text-gray-400 text-sm">Create a multi-clip carousel post</div>
                            </button>
                            
                            {/* Create a scenes */}
                            <button
                                onClick={() => {
                                    setShowGazetteerMenu(false);
                                    gazetteerCameraRollInputRef.current?.click();
                                }}
                                className="w-full p-4 rounded-xl bg-white/5 border border-white/15 hover:border-white/35 transition-all text-left"
                            >
                                <div className="text-white font-semibold mb-1">Create a scenes</div>
                                <div className="text-gray-400 text-sm">Select from camera roll</div>
                            </button>
                            
                            {/* Create a 24hr clip */}
                            <button
                                onClick={() => {
                                    setShowGazetteerMenu(false);
                                    navigate('/clip', { state: { storyMode: true, storyAudience } });
                                }}
                                className="w-full p-4 rounded-xl bg-white/5 border border-white/15 hover:border-white/35 transition-all text-left"
                            >
                                <div className="text-white font-semibold mb-1">Create a 24hr clip</div>
                                <div className="text-gray-400 text-sm">Create a 24-hour story clip</div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Camera Roll Input for Gazetteer */}
            <input
                ref={gazetteerCameraRollInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) {
                        return;
                    }
                    
                    // Process files similar to the main camera roll input
                    const clips: Clip[] = [];
                    
                    for (const file of Array.from(files)) {
                        if (file.type.startsWith('video/')) {
                            const url = URL.createObjectURL(file);
                            const tempVideo = document.createElement('video');
                            tempVideo.src = url;
                            tempVideo.preload = 'metadata';
                            
                            await new Promise<void>((resolve) => {
                                let resolved = false;
                                const handleLoaded = () => {
                                    if (resolved) return;
                                    resolved = true;
                                    const duration = tempVideo.duration && isFinite(tempVideo.duration) ? tempVideo.duration : 5;
                                    const newClip: Clip = {
                                        id: `clip-${Date.now()}-${Math.random()}`,
                                        url: url,
                                        duration: duration,
                                        trimStart: 0,
                                        trimEnd: duration,
                                        speed: 1.0,
                                        reverse: false,
                                        blob: file
                                    };
                                    clips.push(newClip);
                                    resolve();
                                };
                                tempVideo.addEventListener('loadedmetadata', handleLoaded);
                                setTimeout(() => {
                                    if (!resolved) {
                                        resolved = true;
                                        const newClip: Clip = {
                                            id: `clip-${Date.now()}-${Math.random()}`,
                                            url: url,
                                            duration: 5,
                                            trimStart: 0,
                                            trimEnd: 5,
                                            speed: 1.0,
                                            reverse: false,
                                            blob: file
                                        };
                                        clips.push(newClip);
                                        resolve();
                                    }
                                }, 5000);
                            });
                        } else if (file.type.startsWith('image/')) {
                            const url = URL.createObjectURL(file);
                            const newClip: Clip = {
                                id: `clip-${Date.now()}-${Math.random()}`,
                                url: url,
                                duration: 3,
                                trimStart: 0,
                                trimEnd: 3,
                                speed: 1.0,
                                reverse: false,
                                blob: file
                            };
                            clips.push(newClip);
                        }
                    }
                    
                    // Navigate to create page with first clip (no video editing)
                    if (clips.length > 0) {
                        navigate('/create', {
                            state: {
                                videoUrl: clips[0].url,
                                videoDuration: clips[0].duration,
                                mediaType: clips[0].blob?.type.startsWith('image/') ? 'image' : 'video',
                                fromGazetteer: true
                            }
                        });
                    }
                    
                    // Reset input
                    if (gazetteerCameraRollInputRef.current) {
                        gazetteerCameraRollInputRef.current.value = '';
                    }
                }}
            />

            {/* Hidden Camera Roll Input */}
            <input
                ref={cameraRollInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) {
                        console.log('No files selected');
                        return;
                    }

                    const MAX_ITEMS = 10;
                    const selectedFiles = Array.from(files).filter((file) =>
                        file.type.startsWith('image/') || file.type.startsWith('video/')
                    );

                    if (selectedFiles.length === 0) {
                        Swal.fire(bottomSheet({
                            title: 'No Supported Files',
                            message: 'Please select images or videos from your gallery.',
                            icon: 'alert',
                        }));
                        if (cameraRollInputRef.current) {
                            cameraRollInputRef.current.value = '';
                        }
                        return;
                    }

                    if (selectedFiles.length > MAX_ITEMS) {
                        Swal.fire(bottomSheet({
                            title: 'Too Many Items',
                            message: `You can select up to ${MAX_ITEMS} items for a carousel.`,
                            icon: 'alert',
                        }));
                    }

                    const itemsToProcess = selectedFiles.slice(0, MAX_ITEMS);
                    console.log('📁 Gallery files selected for carousel:', itemsToProcess.length, itemsToProcess.map(f => ({
                        name: f.name,
                        type: f.type,
                        size: f.size,
                    })));

                    const galleryItems: { blob: Blob; mediaType: 'image' | 'video'; videoDuration: number }[] = [];

                    for (const file of itemsToProcess) {
                        if (file.type.startsWith('image/')) {
                            galleryItems.push({
                                blob: file,
                                mediaType: 'image',
                                videoDuration: 3,
                            });
                        } else if (file.type.startsWith('video/')) {
                            const url = URL.createObjectURL(file);
                            const tempVideo = document.createElement('video');
                            tempVideo.src = url;
                            tempVideo.preload = 'metadata';

                            // Measure duration with timeout fallback
                            const duration = await new Promise<number>((resolve) => {
                                let resolved = false;

                                const finalize = (dur: number) => {
                                    if (resolved) return;
                                    resolved = true;
                                    URL.revokeObjectURL(url);
                                    resolve(dur);
                                };

                                tempVideo.onloadedmetadata = () => {
                                    const dur = tempVideo.duration && isFinite(tempVideo.duration) ? tempVideo.duration : 5;
                                    // Cap stored duration for UI/limits; do not block import or show a scary alert (full file is kept; no trim step here).
                                    finalize(Math.min(dur, MAX_VIDEO_SECONDS));
                                };

                                tempVideo.onerror = () => {
                                    console.error('Error loading video:', file.name);
                                    finalize(5);
                                };

                                setTimeout(() => {
                                    if (!resolved) {
                                        console.log('Video metadata timeout, using default duration for', file.name);
                                        finalize(5);
                                    }
                                }, 5000);
                            });

                            galleryItems.push({
                                blob: file,
                                mediaType: 'video',
                                videoDuration: duration,
                            });
                        }
                    }

                    if (galleryItems.length === 0) {
                        Swal.fire(bottomSheet({
                            title: 'No Supported Files',
                            message: 'Unable to use the selected files. Please try different photos or videos.',
                            icon: 'alert',
                        }));
                        if (cameraRollInputRef.current) {
                            cameraRollInputRef.current.value = '';
                        }
                        return;
                    }

                    // Stop camera stream and clear live preview before navigating
                    if (streamRef.current) {
                        streamRef.current.getTracks().forEach(t => t.stop());
                        streamRef.current = null;
                    }
                    if (videoRef.current) {
                        videoRef.current.pause();
                        videoRef.current.srcObject = null;
                    }

                    // Cache gallery items for GalleryPreviewPage and navigate once
                    setGalleryPreviewMedia(galleryItems);

                    const firstItem = galleryItems[0];
                    const socialUploadTarget = pendingSocialUploadRef.current;
                    pendingSocialUploadRef.current = null;
                    navigate('/create/gallery-preview', {
                        state: {
                            mediaUrl: undefined,
                            mediaType: firstItem.mediaType,
                            videoDuration: firstItem.videoDuration,
                            socialUploadTarget: socialUploadTarget ?? undefined,
                        },
                    });

                    // Reset input so same files can be selected again
                    if (cameraRollInputRef.current) {
                        cameraRollInputRef.current.value = '';
                    }
                }}
            />

            {/* Left Action Rail - Layout Options or Green Screen Options */}
            {!previewUrl && !showCreateModePicker && (
                <>
                    {showLayoutOptions ? (
                        /* Layout Options */
                        <div className="absolute left-2 top-1/4 z-40 flex flex-col gap-3">
                            <button
                                title="Vertical Split"
                                onClick={() => {
                                    setSelectedLayout('vertical');
                                    // TODO: Apply vertical split layout
                                    console.log('Vertical split selected');
                                }}
                                className={`p-3 rounded-xl ${selectedLayout === 'vertical' ? 'bg-white text-black shadow-lg shadow-white/25' : 'bg-black/60'} text-white hover:bg-white/15 active:scale-95 transition-all duration-200`}
                            >
                                <VerticalSplitIcon className="w-6 h-6" selected={selectedLayout === 'vertical'} />
                            </button>
                            <button
                                title="Horizontal Split"
                                onClick={() => {
                                    setSelectedLayout('horizontal');
                                    // TODO: Apply horizontal split layout
                                    console.log('Horizontal split selected');
                                }}
                                className={`p-3 rounded-xl ${selectedLayout === 'horizontal' ? 'bg-white text-black shadow-lg shadow-white/25' : 'bg-black/60'} text-white hover:bg-white/15 active:scale-95 transition-all duration-200`}
                            >
                                <HorizontalSplitIcon className="w-6 h-6" selected={selectedLayout === 'horizontal'} />
                            </button>
                            <button
                                title="Grid 2x2"
                                onClick={() => {
                                    setSelectedLayout('grid2x2');
                                    // TODO: Apply 2x2 grid layout
                                    console.log('2x2 grid selected');
                                }}
                                className={`p-3 rounded-xl ${selectedLayout === 'grid2x2' ? 'bg-white text-black shadow-lg shadow-white/25' : 'bg-black/60'} text-white hover:bg-white/15 active:scale-95 transition-all duration-200`}
                            >
                                <Grid2x2Icon className="w-6 h-6" selected={selectedLayout === 'grid2x2'} />
                            </button>
                            <button
                                title="Grid 3x3"
                                onClick={() => {
                                    setSelectedLayout('grid3x3');
                                    // TODO: Apply 3x3 grid layout
                                    console.log('3x3 grid selected');
                                }}
                                className={`p-3 rounded-xl ${selectedLayout === 'grid3x3' ? 'bg-white text-black shadow-lg shadow-white/25' : 'bg-black/60'} text-white hover:bg-white/15 active:scale-95 transition-all duration-200`}
                            >
                                <Grid3x3Icon className="w-6 h-6" selected={selectedLayout === 'grid3x3'} />
                            </button>
                        </div>
                    ) : showGreenScreenOptions ? (
                        /* Green Screen Options */
                        <div className="absolute left-2 top-1/4 z-40 flex flex-col gap-3">
                            {/* Choose Background Button */}
                            <button
                                title="Choose Green Screen background"
                                onClick={() => {
                                    bgInputRef.current?.click();
                                }}
                                className={`p-3 rounded-xl ${greenEnabled ? 'bg-white text-black shadow-lg shadow-white/25' : 'bg-black/60'} text-white hover:bg-white/15 active:scale-95 transition-all duration-200 flex items-center justify-center`}
                            >
                                <FiImage className="w-5 h-5" />
                            </button>
                            
                            {/* Preset Background Button */}
                            <button
                                title="Preset background"
                                onClick={() => {
                                    const list = presets.current;
                                    presetIdxRef.current = (presetIdxRef.current + 1) % list.length;
                                    setBgUrl(list[presetIdxRef.current]);
                                    setGreenEnabled(true);
                                }}
                                className="p-3 rounded-xl bg-black/60 text-white hover:bg-white/15 active:scale-95 transition-all duration-200 flex items-center justify-center"
                            >
                                <FiDroplet className="w-5 h-5" />
                            </button>
                            
                            {/* Adjustments - Only show when green screen is enabled */}
                            {greenEnabled && (
                                <div className="bg-black/60 rounded-xl p-3 space-y-4 backdrop-blur-sm border border-white/10">
                                    {/* Blur Control */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FiSliders className="w-4 h-4 text-gray-300" />
                                                <span className="text-xs font-medium text-gray-200">Blur</span>
                                            </div>
                                            <span className="text-xs font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded">{bgBlurPx}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min={0} 
                                            max={10} 
                                            step={1} 
                                            value={bgBlurPx} 
                                            onChange={(e) => setBgBlurPx(parseInt(e.target.value))}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neutral-300"
                                            style={{
                                                background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${(bgBlurPx / 10) * 100}%, #374151 ${(bgBlurPx / 10) * 100}%, #374151 100%)`
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Feather Control */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FiLayers className="w-4 h-4 text-gray-300" />
                                                <span className="text-xs font-medium text-gray-200">Feather</span>
                                            </div>
                                            <span className="text-xs font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded">{featherPx}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min={0} 
                                            max={8} 
                                            step={1} 
                                            value={featherPx} 
                                            onChange={(e) => setFeatherPx(parseInt(e.target.value))}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neutral-300"
                                            style={{
                                                background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${(featherPx / 8) * 100}%, #374151 ${(featherPx / 8) * 100}%, #374151 100%)`
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Disable Button */}
                                    <button
                                        title="Disable Green Screen"
                                        onClick={() => {
                                            setGreenEnabled(false);
                                            setBgUrl(null);
                                        }}
                                        className="w-full p-2.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 mt-2"
                                    >
                                        <FiX className="w-4 h-4" />
                                        <span className="text-xs font-medium">Disable</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </>
            )}


            {/* Framing guides overlay */}
            {showGuides && !previewUrl && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                        <div className="border border-white/30" />
                        <div className="border border-white/30" />
                        <div className="border border-white/30" />
                        <div className="border border-white/30" />
                        <div className="border border-white/30" />
                        <div className="border border-white/30" />
                        <div className="border border-white/30" />
                        <div className="border border-white/30" />
                        <div className="border border-white/30" />
                    </div>
                </div>
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="text-white text-6xl font-bold">{countdown}</div>
                </div>
            )}
        </div>
    );
}


