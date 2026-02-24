import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiCircle, FiX, FiCheck, FiPlay, FiPause, FiRotateCw, FiMic, FiMicOff, FiImage, FiMusic, FiLayers, FiZap, FiGrid, FiUser, FiFilter, FiRefreshCw, FiEdit3, FiSearch, FiBookmark, FiUpload, FiSliders, FiDroplet, FiVideo, FiVideoOff, FiCopy, FiSave, FiPlus, FiType, FiCamera } from 'react-icons/fi';
import { saveDraft } from '../api/drafts';
import { getTemplate } from '../api/templates';
import { TEMPLATE_IDS } from '../constants';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { setGalleryPreviewMedia } from '../utils/galleryPreviewCache';

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
    const [cameraOn, setCameraOn] = React.useState(true);
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
    const [showMusicCard, setShowMusicCard] = React.useState(false);
    const [activeMusicTab, setActiveMusicTab] = React.useState('For you');
    const [selectedMusicTrackId, setSelectedMusicTrackId] = React.useState<number | null>(null);
    const [libraryTracks, setLibraryTracks] = React.useState<any[]>([]);
    const [libraryLoading, setLibraryLoading] = React.useState(false);
    const [librarySearch, setLibrarySearch] = React.useState('');
    const [libraryGenre, setLibraryGenre] = React.useState('');
    const [libraryMood, setLibraryMood] = React.useState('');
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
    const [recordingTime, setRecordingTime] = React.useState(60); // Countdown from 60 to 0
    const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    // Load draft when navigated from profile drafts
    React.useEffect(() => {
        const state = location.state as {
            draftId?: string;
            draftVideoUrl?: string;
            draftVideoDuration?: number;
            trimStart?: number;
            trimEnd?: number;
        } | null;

        if (state?.draftVideoUrl) {
            const duration = state.draftVideoDuration ?? 0;
            const start = state.trimStart ?? 0;
            const end = state.trimEnd ?? duration;
            setPreviewUrl(state.draftVideoUrl);
            setVideoDuration(duration);
            setTrimStart(start);
            setTrimEnd(end);
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
        
        // Only initialize stream if camera is enabled and we don't have a preview
        if (cameraOn && !previewUrl) {
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
    }, [facingMode, micOn, cameraOn, previewUrl]);

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
                        
                        // Auto-navigate to new gallery-style preview flow after recording
                        setTimeout(() => {
                            const clipsToPass = updated.length > 0 ? updated : [newClip];
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
                                
                                // Use the same preview flow as gallery file picker:
                                // cache the recorded clip as a single gallery item,
                                // then navigate to /create/gallery-preview.
                                const galleryItems = [
                                    {
                                        blob,
                                        mediaType: 'video' as const,
                                        videoDuration: duration || 0,
                                    },
                                ];
                                setGalleryPreviewMedia(galleryItems);

                                navigate('/create/gallery-preview', {
                                    state: {
                                        mediaUrl: undefined,
                                        mediaType: 'video' as const,
                                        videoDuration: duration || 0,
                                        fromInstantRecording: true,
                                    },
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
        setRecordingTime(60); // Reset to 60 seconds
        
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
        setRecordingTime(60); // Reset timer
        
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
                musicTrackId: selectedMusicTrackId
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

        return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Regular Icons - Top Bar (always visible) */}
            {!previewUrl && (
                <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-6 py-4">
                    <button 
                        title="Flip camera" 
                        className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 active:scale-95 transition-all duration-200" 
                        onClick={() => { 
                            const next = facingMode === 'user' ? 'environment' : 'user'; 
                            setFacingMode(next); 
                            initStream(next, micOn, cameraOn);
                            // If dual camera is on, update the dual camera stream
                            if (dualCamera && dualStreamRef.current) {
                                dualStreamRef.current.getTracks().forEach(t => t.stop());
                                toggleDualCamera(); // Turn off and on to get new camera
                                setTimeout(() => toggleDualCamera(), 100);
                            }
                        }}
                    >
                        <FiRotateCw className="w-4 h-4" />
                    </button>
                    <button 
                        title={dualCamera ? 'Disable dual camera' : 'Enable dual camera'} 
                        className={`p-2 rounded-lg ${dualCamera ? 'bg-purple-600/80' : 'bg-black/60'} text-white hover:bg-black/80 active:scale-95 transition-all duration-200`}
                        onClick={toggleDualCamera}
                    >
                        <FiCopy className="w-4 h-4" />
                    </button>
                    <button 
                        title={cameraOn ? 'Turn camera off' : 'Turn camera on'} 
                        className={`p-2 rounded-lg ${cameraOn ? 'bg-black/60' : 'bg-red-600/80'} text-white hover:bg-black/80 active:scale-95 transition-all duration-200`}
                        onClick={toggleCamera}
                    >
                        {cameraOn ? <FiVideo className="w-4 h-4" /> : <FiVideoOff className="w-4 h-4" />}
                    </button>
                    <button 
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
                        title={showGuides ? 'Hide guides' : 'Show guides'}
                        className={`p-2 rounded-lg ${showGuides ? 'bg-white/70 text-black' : 'bg-black/60 text-white'} hover:bg-black/80 active:scale-95 transition-all duration-200`}
                        onClick={() => setShowGuides(!showGuides)}
                    >
                        <span className="text-xs font-semibold">G</span>
                    </button>
                    {/* 60 Second Timer - Circular Progress Bar when recording */}
                    <div className="relative">
                        {recording && (
                            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-12 h-12 z-50">
                                <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
                                    <circle cx="24" cy="24" r="20" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="4" fill="none" />
                                    <circle
                                        cx="24" cy="24" r="20"
                                        stroke="rgba(255, 255, 255, 0.9)" strokeWidth="4" fill="none"
                                        strokeDasharray={`${2 * Math.PI * 20}`}
                                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - (60 - recordingTime) / 60)}`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">{recordingTime}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Back / Next - Below Icons */}
            <div className="absolute top-16 left-0 right-0 z-50 p-4 flex items-center justify-between">
                <button
                    onClick={() => navigate('/feed')}
                    className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                >
                    <FiArrowLeft className="w-6 h-6" />
                </button>
                {previewUrl ? (
                    <button
                        onClick={handleNext}
                        className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors"
                    >
                        Next: post to feed
                    </button>
                ) : (
                    <div className="w-10" />
                )}
            </div>

            {/* Video Preview - Full Screen */}
            <div className="flex-1 flex items-center justify-center bg-black relative">
                {!previewUrl ? (
                    <>
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            className={`w-full h-full ${greenEnabled ? 'hidden' : 'block'} object-cover`}
                            style={getFilterStyle(selectedFilter)}
                        />
                        {/* Green screen composited canvas */}
                        <canvas
                            ref={greenCanvasRef}
                            className={`${greenEnabled ? 'block' : 'hidden'} absolute inset-0 w-full h-full object-cover`}
                            style={{ zIndex: greenEnabled ? 10 : 0, ...getFilterStyle(selectedFilter) }}
                        />
                        {/* Dual Camera - Picture in Picture */}
                        {dualCamera && !greenEnabled && (
                            <video
                                ref={dualCameraRef}
                                playsInline
                                muted
                                className="absolute bottom-20 right-4 w-32 h-48 rounded-xl border-2 border-white/30 shadow-2xl object-cover z-20"
                            />
                        )}

                        {/* Footer: Gallery, Stories, Text - small dashed icons */}
                        <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5 bg-gradient-to-t from-black/60 to-transparent border-t border-white/5 gap-2">
                            <button
                                onClick={() => cameraRollInputRef.current?.click()}
                                className="flex flex-row items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border border-transparent bg-white text-black font-medium text-[11px] backdrop-blur-sm hover:bg-gray-100 active:scale-95 transition-all flex-1"
                            >
                                <FiUpload className="w-4 h-4" />
                                <span>Gallery +10</span>
                            </button>
                            <button
                                onClick={() => navigate('/clip')}
                                className="flex flex-row items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border border-white/30 bg-black/30 backdrop-blur-sm text-white/90 hover:bg-white/10 active:scale-95 transition-all flex-1"
                            >
                                <FiCamera className="w-4 h-4" />
                                <span className="text-[11px] font-medium">Story</span>
                            </button>
                            <button
                                onClick={() => navigate('/create/text-only')}
                                className="flex flex-row items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border border-white/30 bg-black/30 backdrop-blur-sm text-white/90 hover:bg-white/10 active:scale-95 transition-all flex-1"
                            >
                                <FiType className="w-4 h-4" />
                                <span className="text-[11px] font-medium">Text post</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <div
                        className="relative w-full h-full flex items-center justify-center"
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
                                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-100"
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
                    </div>
                )}
            </div>

            {/* Record Button */}
            {!previewUrl && (
                <div className="absolute bottom-24 left-0 right-0 z-50 flex flex-col items-center justify-center gap-4">
                    {!recording && countdown === null ? (
                        <button
                            onClick={() => {
                                // Optional 3s countdown before recording
                                setCountdown(3);
                                const t1 = setTimeout(() => setCountdown(2), 1000);
                                const t2 = setTimeout(() => setCountdown(1), 2000);
                                const t3 = setTimeout(() => { setCountdown(null); startRecording(); }, 3000);
                            }}
                            className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 border-4 border-white shadow-2xl flex items-center justify-center hover:scale-105 transition-all duration-300 active:scale-95"
                            aria-label="Record video"
                        >
                            <FiCircle className="w-10 h-10 text-white" fill="white" />
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

            {/* Platform Icons - Left Side Vertical */}
            {!previewUrl && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
                    {/* TikTok Icon */}
                    <button
                        onClick={async () => {
                            try {
                                const tiktokTemplate = await getTemplate(TEMPLATE_IDS.TIKTOK);
                                if (tiktokTemplate) {
                                    navigate('/template-editor', {
                                        state: { template: tiktokTemplate }
                                    });
                                } else {
                                    Swal.fire(bottomSheet({
                                        title: 'Error',
                                        message: 'Could not load TikTok template',
                                        icon: 'alert',
                                    }));
                                }
                            } catch (error) {
                                console.error('Error loading TikTok template:', error);
                                Swal.fire(bottomSheet({
                                    title: 'Error',
                                    message: 'Failed to load TikTok template',
                                    icon: 'alert',
                                }));
                            }
                        }}
                        className="w-10 h-10 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-black/80 active:scale-95 transition-all cursor-pointer"
                        aria-label="Open TikTok template"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.65 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                        </svg>
                    </button>
                    
                    {/* Instagram Icon */}
                    <button
                        onClick={async () => {
                            try {
                                const instagramTemplate = await getTemplate(TEMPLATE_IDS.INSTAGRAM);
                                if (instagramTemplate) {
                                    navigate('/template-editor', {
                                        state: { template: instagramTemplate }
                                    });
                                } else {
                                    Swal.fire(bottomSheet({
                                        title: 'Error',
                                        message: 'Could not load Instagram template',
                                        icon: 'alert',
                                    }));
                                }
                            } catch (error) {
                                console.error('Error loading Instagram template:', error);
                                Swal.fire(bottomSheet({
                                    title: 'Error',
                                    message: 'Failed to load Instagram template',
                                    icon: 'alert',
                                }));
                            }
                        }}
                        className="w-10 h-10 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-black/80 active:scale-95 transition-all cursor-pointer"
                        aria-label="Open Instagram template"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                    </button>
                    
                    {/* YouTube Shorts Icon */}
                    <button
                        onClick={async () => {
                            try {
                                const youtubeShortsTemplate = await getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
                                if (youtubeShortsTemplate) {
                                    navigate('/template-editor', {
                                        state: { template: youtubeShortsTemplate }
                                    });
                                } else {
                                    Swal.fire(bottomSheet({
                                        title: 'Error',
                                        message: 'Could not load YouTube Shorts template',
                                        icon: 'alert',
                                    }));
                                }
                            } catch (error) {
                                console.error('Error loading YouTube Shorts template:', error);
                                Swal.fire(bottomSheet({
                                    title: 'Error',
                                    message: 'Failed to load YouTube Shorts template',
                                    icon: 'alert',
                                }));
                            }
                        }}
                        className="w-10 h-10 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-black/80 active:scale-95 transition-all cursor-pointer"
                        aria-label="Open YouTube Shorts template"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                            <path d="M17.77 10.32c-.77-.32-1.2-.5-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.94c-1.84.96-2.53 3.23-1.56 5.06.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.06-1.42-.92-2.67-2.21-3.25zM10 14.65v-5.3L15 12l-5 2.65z"/>
                        </svg>
                    </button>
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
                            <EffectsIcon className="w-5 h-5 text-red-400" />
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
                                className="group flex items-center gap-4 p-4 bg-gray-800/80 hover:bg-purple-600/20 rounded-xl border border-gray-700/50 hover:border-purple-500/50 transition-all duration-200 active:scale-98"
                            >
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-600/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/20">
                                    <FiRefreshCw className="w-7 h-7 text-purple-400" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-white font-semibold text-base mb-0.5">Boomerang</div>
                                    <div className="text-gray-400 text-sm">Record a boomerang video</div>
                                </div>
                                <div className="text-gray-500 group-hover:text-purple-400 transition-colors">
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
                                                    musicTrackId: selectedMusicTrackId
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
                                className="group flex items-center gap-4 p-4 bg-gray-800/80 hover:bg-green-600/20 rounded-xl border border-gray-700/50 hover:border-green-500/50 transition-all duration-200 active:scale-98"
                            >
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/30 to-green-600/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-green-500/20">
                                    <FiEdit3 className="w-7 h-7 text-green-400" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-white font-semibold text-base mb-0.5">Edit</div>
                                    <div className="text-gray-400 text-sm">Edit video settings</div>
                                </div>
                                <div className="text-gray-500 group-hover:text-green-400 transition-colors">
                                    <FiArrowLeft className="w-5 h-5 rotate-180" />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters Card - Slides up from bottom */}
            {showFilters && !previewUrl && (
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
                            <FiFilter className="w-5 h-5 text-purple-400" />
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
                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
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
                                <FiSliders className="w-5 h-5 text-blue-400" />
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
            {showAdjustments && !previewUrl && (
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
                            <FiSliders className="w-5 h-5 text-blue-400" />
                            <h3 className="text-white text-xl font-bold">Adjustments</h3>
                        </div>
                        
                        {/* Adjustment Controls */}
                        <div className="space-y-6">
                            {/* Brightness */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiZap className="w-4 h-4 text-yellow-400" />
                                        <span className="text-sm font-medium text-gray-200">Brightness</span>
                                    </div>
                                    <span className="text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
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
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((brightness - 0.4) / 1.4) * 100}%, #374151 ${((brightness - 0.4) / 1.4) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>

                            {/* Contrast */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiLayers className="w-4 h-4 text-purple-400" />
                                        <span className="text-sm font-medium text-gray-200">Contrast</span>
                                    </div>
                                    <span className="text-xs font-semibold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
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
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    style={{
                                        background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((contrast - 0.5) / 1.5) * 100}%, #374151 ${((contrast - 0.5) / 1.5) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>

                            {/* Saturation */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiDroplet className="w-4 h-4 text-pink-400" />
                                        <span className="text-sm font-medium text-gray-200">Saturation</span>
                                    </div>
                                    <span className="text-xs font-semibold text-pink-400 bg-pink-500/20 px-2 py-0.5 rounded">
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
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                    style={{
                                        background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${(saturation / 2.0) * 100}%, #374151 ${(saturation / 2.0) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>

                            {/* Hue */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiGrid className="w-4 h-4 text-green-400" />
                                        <span className="text-sm font-medium text-gray-200">Hue</span>
                                    </div>
                                    <span className="text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
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
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    style={{
                                        background: `linear-gradient(to right, #10b981 0%, #10b981 ${((hue + 1.0) / 2.0) * 100}%, #374151 ${((hue + 1.0) / 2.0) * 100}%, #374151 100%)`
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

            {/* Music Card - Slides up from bottom */}
            {showMusicCard && !previewUrl && (
                <div className="absolute inset-0 z-50 flex items-end">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/50 transition-opacity"
                        onClick={() => setShowMusicCard(false)}
                    />
                    {/* Card */}
                    <div className="relative w-full bg-gray-900 rounded-t-3xl h-[85vh] flex flex-col transform transition-transform duration-300 ease-out">
                        {/* Handle bar */}
                        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-4" />
                        
                        {/* Search Bar and Import Button */}
                        <div className="px-4 mb-4 flex gap-2">
                            <div className="flex-1 relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search music"
                                    value={librarySearch}
                                    onChange={(e) => {
                                        setLibrarySearch(e.target.value);
                                        // Auto-load when typing (debounced)
                                        const timer = setTimeout(async () => {
                                            if (e.target.value.length > 2 || e.target.value.length === 0) {
                                                setLibraryLoading(true);
                                                try {
                                                    const { getMusicLibrary } = await import('../api/music');
                                                    const result = await getMusicLibrary({
                                                        genre: libraryGenre || undefined,
                                                        mood: libraryMood || undefined,
                                                        search: e.target.value || undefined,
                                                    });
                                                    if (result.success && result.data) {
                                                        setLibraryTracks(result.data);
                                                    }
                                                } catch (error) {
                                                    console.error('Failed to search music:', error);
                                                } finally {
                                                    setLibraryLoading(false);
                                                }
                                            }
                                        }, 500);
                                        return () => clearTimeout(timer);
                                    }}
                                    className="w-full bg-gray-800 text-white placeholder-gray-400 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <button className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 text-white transition-colors">
                                <FiUpload className="w-5 h-5" />
                                <span className="text-sm font-medium">Import</span>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="px-4 mb-4 flex gap-4 border-b border-gray-700 overflow-x-auto">
                            {['Library'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={async () => {
                                        setActiveMusicTab(tab);
                                        // Auto-load library when tab is clicked
                                        if (libraryTracks.length === 0) {
                                            setLibraryLoading(true);
                                            try {
                                                const { getMusicLibrary } = await import('../api/music');
                                                const result = await getMusicLibrary({
                                                    genre: libraryGenre || undefined,
                                                    mood: libraryMood || undefined,
                                                    search: librarySearch || undefined,
                                                });
                                                if (result.success && result.data) {
                                                    setLibraryTracks(result.data);
                                                }
                                            } catch (error) {
                                                console.error('Failed to load music library:', error);
                                            } finally {
                                                setLibraryLoading(false);
                                            }
                                        }
                                    }}
                                    className={`pb-3 px-2 text-sm font-medium whitespace-nowrap transition-colors ${
                                        activeMusicTab === tab
                                            ? 'text-white border-b-2 border-white'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        
                        {/* Genre and Mood Filters */}
                        <div className="px-4 mb-4 grid grid-cols-2 gap-2">
                            <select
                                value={libraryGenre}
                                onChange={(e) => {
                                    setLibraryGenre(e.target.value);
                                    // Auto-reload when filter changes
                                    setLibraryLoading(true);
                                    (async () => {
                                        try {
                                            const { getMusicLibrary } = await import('../api/music');
                                            const result = await getMusicLibrary({
                                                genre: e.target.value || undefined,
                                                mood: libraryMood || undefined,
                                                search: librarySearch || undefined,
                                            });
                                            if (result.success && result.data) {
                                                setLibraryTracks(result.data);
                                            }
                                        } catch (error) {
                                            console.error('Failed to filter music:', error);
                                        } finally {
                                            setLibraryLoading(false);
                                        }
                                    })();
                                }}
                                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            >
                                <option value="">All Genres</option>
                                <option value="pop">Pop</option>
                                <option value="rock">Rock</option>
                                <option value="electronic">Electronic</option>
                                <option value="hip-hop">Hip-Hop</option>
                                <option value="jazz">Jazz</option>
                                <option value="classical">Classical</option>
                                <option value="ambient">Ambient</option>
                            </select>
                            <select
                                value={libraryMood}
                                onChange={(e) => {
                                    setLibraryMood(e.target.value);
                                    // Auto-reload when filter changes
                                    setLibraryLoading(true);
                                    (async () => {
                                        try {
                                            const { getMusicLibrary } = await import('../api/music');
                                            const result = await getMusicLibrary({
                                                genre: libraryGenre || undefined,
                                                mood: e.target.value || undefined,
                                                search: librarySearch || undefined,
                                            });
                                            if (result.success && result.data) {
                                                setLibraryTracks(result.data);
                                            }
                                        } catch (error) {
                                            console.error('Failed to filter music:', error);
                                        } finally {
                                            setLibraryLoading(false);
                                        }
                                    })();
                                }}
                                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            >
                                <option value="">All Moods</option>
                                <option value="happy">Happy</option>
                                <option value="energetic">Energetic</option>
                                <option value="calm">Calm</option>
                                <option value="dramatic">Dramatic</option>
                                <option value="romantic">Romantic</option>
                                <option value="upbeat">Upbeat</option>
                            </select>
                        </div>

                        {/* Featured Music Carousel */}
                        <div className="px-4 mb-4">
                            <div className="relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-purple-600 to-blue-600">
                                <div className="absolute inset-0 bg-black/30" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                    <div className="text-white font-bold text-lg">HARD</div>
                                    <div className="text-white/80 text-sm">FKA twigs</div>
                                </div>
                                {/* Carousel dots */}
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                                    {[true, false, false, false, false].map((active, i) => (
                                        <div
                                            key={i}
                                            className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-white/40'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Music List */}
                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                            {libraryLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                                </div>
                            ) : libraryTracks.length > 0 ? (
                                libraryTracks.map((track) => {
                                    const isSelected = selectedMusicTrackId === track.id;
                                    const duration = track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : 'N/A';
                                    
                                    return (
                                        <button
                                            key={track.id}
                                            onClick={async () => {
                                                setSelectedMusicTrackId(track.id);
                                                setShowMusicCard(false);
                                                Swal.fire(bottomSheet({
                                                    title: 'Music Selected!',
                                                    message: `"${track.title}" by ${track.artist || 'Unknown'}`,
                                                    icon: 'success',
                                                }));
                                            }}
                                            className={`w-full flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors mb-2 ${
                                                isSelected ? 'bg-yellow-500/20 border border-yellow-500/50' : ''
                                            }`}
                                        >
                                            {/* Album Art Placeholder */}
                                            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex-shrink-0 flex items-center justify-center">
                                                <FiMusic className="w-6 h-6 text-white" />
                                            </div>
                                            
                                            {/* Track Info */}
                                            <div className="flex-1 text-left min-w-0">
                                                <div className="text-white font-medium text-sm truncate">{track.title}</div>
                                                <div className="text-gray-400 text-xs truncate">{track.artist || 'Unknown Artist'}</div>
                                                <div className="text-gray-500 text-xs mt-1">
                                                    {track.genre || 'N/A'} • {track.mood || 'N/A'} • {duration}
                                                    {track.license_type && (
                                                        <span className="ml-2">({track.license_type})</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {isSelected && (
                                                <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                                                    <FiCheck className="w-4 h-4 text-black" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12">
                                    <FiMusic className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 text-sm mb-4">No tracks loaded</p>
                                    <button
                                        onClick={async () => {
                                            setLibraryLoading(true);
                                            try {
                                                const { getMusicLibrary } = await import('../api/music');
                                                const result = await getMusicLibrary({
                                                    genre: libraryGenre || undefined,
                                                    mood: libraryMood || undefined,
                                                    search: librarySearch || undefined,
                                                });
                                                if (result.success && result.data) {
                                                    setLibraryTracks(result.data);
                                                }
                                            } catch (error: any) {
                                                console.error('Failed to load music library:', error);
                                                Swal.fire(bottomSheet({
                                                    title: 'Load Failed',
                                                    message: error.message || 'Failed to load music library.',
                                                    icon: 'alert',
                                                }));
                                            } finally {
                                                setLibraryLoading(false);
                                            }
                                        }}
                                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium"
                                    >
                                        Load Music Library
                                    </button>
                                </div>
                            )}
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
                                className="w-full p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-white/10 border border-green-500/30 hover:border-green-500/50 transition-all text-left"
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
                                className="w-full p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-white/10 border border-green-500/30 hover:border-green-500/50 transition-all text-left"
                            >
                                <div className="text-white font-semibold mb-1">Create a scenes</div>
                                <div className="text-gray-400 text-sm">Select from camera roll</div>
                            </button>
                            
                            {/* Create a 24hr clip */}
                            <button
                                onClick={() => {
                                    setShowGazetteerMenu(false);
                                    navigate('/clip');
                                }}
                                className="w-full p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-white/10 border border-green-500/30 hover:border-green-500/50 transition-all text-left"
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
                                    if (dur > MAX_VIDEO_SECONDS) {
                                        Swal.fire(bottomSheet({
                                            title: 'Video Too Long',
                                            message: `Video "${file.name}" is ${Math.round(dur)}s. Maximum is ${MAX_VIDEO_SECONDS}s. It will be trimmed in the editor.`,
                                            icon: 'alert',
                                        }));
                                    }
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
                    navigate('/create/gallery-preview', {
                        state: {
                            mediaUrl: undefined,
                            mediaType: firstItem.mediaType,
                            videoDuration: firstItem.videoDuration,
                        },
                    });

                    // Reset input so same files can be selected again
                    if (cameraRollInputRef.current) {
                        cameraRollInputRef.current.value = '';
                    }
                }}
            />

            {/* Left Action Rail - Layout Options or Green Screen Options */}
            {!previewUrl && (
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
                                className={`p-3 rounded-xl ${selectedLayout === 'vertical' ? 'bg-purple-600 shadow-lg shadow-purple-500/50' : 'bg-black/60'} text-white hover:bg-purple-500/80 active:scale-95 transition-all duration-200`}
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
                                className={`p-3 rounded-xl ${selectedLayout === 'horizontal' ? 'bg-purple-600 shadow-lg shadow-purple-500/50' : 'bg-black/60'} text-white hover:bg-purple-500/80 active:scale-95 transition-all duration-200`}
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
                                className={`p-3 rounded-xl ${selectedLayout === 'grid2x2' ? 'bg-purple-600 shadow-lg shadow-purple-500/50' : 'bg-black/60'} text-white hover:bg-purple-500/80 active:scale-95 transition-all duration-200`}
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
                                className={`p-3 rounded-xl ${selectedLayout === 'grid3x3' ? 'bg-purple-600 shadow-lg shadow-purple-500/50' : 'bg-black/60'} text-white hover:bg-purple-500/80 active:scale-95 transition-all duration-200`}
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
                                className={`p-3 rounded-xl ${greenEnabled ? 'bg-green-600 shadow-lg shadow-green-500/50' : 'bg-black/60'} text-white hover:bg-green-500/80 active:scale-95 transition-all duration-200 flex items-center justify-center`}
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
                                className="p-3 rounded-xl bg-black/60 text-white hover:bg-purple-600/80 active:scale-95 transition-all duration-200 flex items-center justify-center"
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
                                            <span className="text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">{bgBlurPx}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min={0} 
                                            max={10} 
                                            step={1} 
                                            value={bgBlurPx} 
                                            onChange={(e) => setBgBlurPx(parseInt(e.target.value))}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                            style={{
                                                background: `linear-gradient(to right, #10b981 0%, #10b981 ${(bgBlurPx / 10) * 100}%, #374151 ${(bgBlurPx / 10) * 100}%, #374151 100%)`
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
                                            <span className="text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">{featherPx}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min={0} 
                                            max={8} 
                                            step={1} 
                                            value={featherPx} 
                                            onChange={(e) => setFeatherPx(parseInt(e.target.value))}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                            style={{
                                                background: `linear-gradient(to right, #10b981 0%, #10b981 ${(featherPx / 8) * 100}%, #374151 ${(featherPx / 8) * 100}%, #374151 100%)`
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


