import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCircle, FiX, FiCheck, FiPlay, FiPause, FiRotateCw, FiMic, FiMicOff, FiImage } from 'react-icons/fi';

export default function InstantCreatePage() {
    const navigate = useNavigate();
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const previewVideoRef = React.useRef<HTMLVideoElement | null>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const recordedChunksRef = React.useRef<Blob[]>([]);
    const streamRef = React.useRef<MediaStream | null>(null);
    const isMountedRef = React.useRef(true);
    const [recording, setRecording] = React.useState(false);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [videoDuration, setVideoDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [showControls, setShowControls] = React.useState(true);
    const controlsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('user');
    const [micOn, setMicOn] = React.useState(true);
    const [countdown, setCountdown] = React.useState<number | null>(null);
    const [greenEnabled, setGreenEnabled] = React.useState(false);
    const [bgUrl, setBgUrl] = React.useState<string | null>(null);
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
    const presets = React.useRef<string[]>([
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200',
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
        'https://images.unsplash.com/photo-1503264116251-35a269479413?w=1200',
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200'
    ]);
    const presetIdxRef = React.useRef(0);

    async function initStream(mode: 'user' | 'environment', audio: boolean) {
        try {
            // Stop previous stream if any
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try { await videoRef.current.play(); } catch { }
            }
        } catch (e: any) {
            console.error('Stream init error:', e);
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
        initStream(facingMode, micOn);

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
        };
    }, []);

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
        mr.onstop = () => {
            // Ensure all chunks are collected
            if (recordedChunksRef.current.length > 0) {
                const blobType = options.mimeType || 'video/webm';
                const blob = new Blob(recordedChunksRef.current, { type: blobType });
                const url = URL.createObjectURL(blob);
                console.log('Preview URL created:', url, 'Blob size:', blob.size, 'Type:', blobType);
                setPreviewUrl(url);
            } else {
                console.error('No video chunks recorded');
            }
        };
        mr.start(100); // Request data every 100ms
        setRecording(true);
    }

    function stopRecording() {
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
                const duration = video.duration;
                setVideoDuration(duration);
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
        if (!previewUrl) return;

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

        navigate('/create/filters', { state: { videoUrl: previewUrl, videoDuration } });
    }

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Back Button - Top Left */}
            <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
                <button
                    onClick={() => navigate('/feed')}
                    className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                >
                    <FiArrowLeft className="w-6 h-6" />
                </button>
                <div className="w-10"></div>
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
                        />
                        {/* Green screen composited canvas */}
                        <canvas
                            ref={greenCanvasRef}
                            className={`${greenEnabled ? 'block' : 'hidden'} absolute inset-0 w-full h-full object-cover`}
                            style={{ zIndex: greenEnabled ? 10 : 0 }}
                        />
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

                            {/* Time Display and Controls */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePlayPause();
                                        }}
                                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
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
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls - Bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-6 pb-safe">
                {!recording && !previewUrl && (
                    <div className="flex items-center justify-center">
                        <button
                            onClick={() => {
                                // Optional 3s countdown before recording
                                setCountdown(3);
                                const t1 = setTimeout(() => setCountdown(2), 1000);
                                const t2 = setTimeout(() => setCountdown(1), 2000);
                                const t3 = setTimeout(() => { setCountdown(null); startRecording(); }, 3000);
                            }}
                            className="w-20 h-20 rounded-full bg-red-600 border-4 border-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
                            aria-label="Record video"
                        >
                            <FiCircle className="w-10 h-10 text-white" fill="white" />
                        </button>
                    </div>
                )}
                {recording && (
                    <div className="flex items-center justify-center">
                        <button
                            onClick={stopRecording}
                            className="w-20 h-20 rounded-full bg-gray-900 border-4 border-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
                            aria-label="Stop recording"
                        >
                            <div className="w-8 h-8 rounded bg-white"></div>
                        </button>
                    </div>
                )}
                {previewUrl && (
                    <div className="flex items-center justify-center gap-4 pt-20">
                        <button
                            onClick={() => { setPreviewUrl(null); }}
                            className="w-16 h-16 rounded-full bg-gray-800/90 backdrop-blur-sm border-2 border-white/30 shadow-2xl flex items-center justify-center hover:scale-105 hover:bg-gray-700 transition-all active:scale-95"
                            aria-label="Retake"
                        >
                            <FiX className="w-7 h-7 text-white" />
                        </button>
                        <button
                            onClick={handleNext}
                            className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 border-2 border-white/30 shadow-2xl flex items-center justify-center hover:scale-105 hover:from-blue-700 hover:to-blue-600 transition-all active:scale-95"
                            aria-label="Next"
                        >
                            <FiCheck className="w-7 h-7 text-white" />
                        </button>
                    </div>
                )}
            </div>

            {/* Left Action Rail (icons similar to Instagram) */}
            {!previewUrl && (
                <div className="absolute left-2 top-1/4 z-40 flex flex-col gap-3">
                    <button title="Flip camera" className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60" onClick={() => { const next = facingMode === 'user' ? 'environment' : 'user'; setFacingMode(next); initStream(next, micOn); }}>
                        <FiRotateCw className="w-5 h-5" />
                    </button>
                    <button title={micOn ? 'Mute mic' : 'Unmute mic'} className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60" onClick={() => { const next = !micOn; setMicOn(next); initStream(facingMode, next); }}>
                        {micOn ? <FiMic className="w-5 h-5" /> : <FiMicOff className="w-5 h-5" />}
                    </button>
                    <button
                        title="Choose Green Screen background"
                        className={`p-2 rounded-full ${greenEnabled ? 'bg-green-600' : 'bg-black/40'} text-white hover:bg-black/60`}
                        onClick={() => {
                            // Always open picker to choose a background
                            bgInputRef.current?.click();
                        }}
                    >
                        GS
                    </button>
                    <button
                        title="Preset background"
                        className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
                        onClick={() => {
                            const list = presets.current;
                            presetIdxRef.current = (presetIdxRef.current + 1) % list.length;
                            setBgUrl(list[presetIdxRef.current]);
                            setGreenEnabled(true);
                        }}
                    >
                        PR
                    </button>
                    <button
                        title={showGuides ? 'Hide guides' : 'Show guides'}
                        className={`p-2 rounded-full ${showGuides ? 'bg-white/70 text-black' : 'bg-black/40 text-white'} hover:bg-black/60`}
                        onClick={() => setShowGuides(!showGuides)}
                    >
                        G
                    </button>
                    <input
                        ref={bgInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const url = URL.createObjectURL(f);
                            console.log('GS: File selected', { type: f.type, size: f.size, name: f.name });
                            setBgUrl(url);
                            setGreenEnabled(true);
                        }}
                    />
                </div>
            )}

            {/* GS Adjustments */}
            {greenEnabled && (
                <div className="absolute bottom-20 right-2 z-40 bg-black/50 text-white rounded-xl p-3 space-y-3 backdrop-blur">
                    <div>
                        <div className="text-xs mb-1">Background blur</div>
                        <input type="range" min={0} max={10} step={1} value={bgBlurPx} onChange={(e) => setBgBlurPx(parseInt(e.target.value))} />
                    </div>
                    <div>
                        <div className="text-xs mb-1">Edge feather</div>
                        <input type="range" min={0} max={8} step={1} value={featherPx} onChange={(e) => setFeatherPx(parseInt(e.target.value))} />
                    </div>
                </div>
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


