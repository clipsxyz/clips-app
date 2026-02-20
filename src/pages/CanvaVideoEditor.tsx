import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiPlay, FiPause, FiScissors, FiType, FiSmile, FiMusic, FiImage, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { createPost } from '../api/posts';
import { uploadFile } from '../api/client';
import { useAuth } from '../context/Auth';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';

type Clip = {
    id: number;
    url: string;
    duration: number;
    trimStart: number;
    trimEnd: number;
    blob?: Blob;
    file?: File;
};

type TextOverlay = {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    font: string;
    startTime: number;
    endTime: number;
};

type StickerOverlay = {
    id: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    startTime: number;
    endTime: number;
};

export default function CanvaVideoEditor() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [clips, setClips] = useState<Clip[]>([]);
    const [currentClipIndex, setCurrentClipIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
    const [draggingTrimHandle, setDraggingTrimHandle] = useState<'start' | 'end' | null>(null);
    const [previewTime, setPreviewTime] = useState<number | null>(null);
    const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
    const [stickerOverlays, setStickerOverlays] = useState<StickerOverlay[]>([]);
    const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
    const [draggingOverlay, setDraggingOverlay] = useState<string | null>(null);
    const [thumbnails, setThumbnails] = useState<Map<number, string[]>>(new Map());
    const [activeTool, setActiveTool] = useState<'text' | 'sticker' | 'audio' | null>(null);
    const [textInput, setTextInput] = useState('');
    const [textColor, setTextColor] = useState('#FFFFFF');
    const [textSize, setTextSize] = useState(36);
    const [textFont, setTextFont] = useState('Arial');
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ffmpegRef = useRef<FFmpeg | null>(null);

    // Load FFmpeg
    useEffect(() => {
        const loadFFmpeg = async () => {
            try {
                const ffmpeg = new FFmpeg();
                ffmpegRef.current = ffmpeg;

                ffmpeg.on('log', ({ message }) => {
                    console.log('FFmpeg:', message);
                });

                await ffmpeg.load({
                    coreURL: '/ffmpeg-core.js',
                    wasmURL: '/ffmpeg-core.wasm',
                });

                setFfmpegLoaded(true);
            } catch (error) {
                console.error('Failed to load FFmpeg:', error);
                Swal.fire(bottomSheet({
                    title: 'FFmpeg Load Error',
                    message: 'Failed to load video processing library. Please refresh the page.',
                    icon: 'alert',
                }));
            }
        };

        loadFFmpeg();
    }, []);

    // Generate thumbnails for clips
    const generateThumbnails = useCallback(async (clip: Clip, count: number = 8) => {
        return new Promise<string[]>((resolve) => {
            const video = document.createElement('video');
            video.src = clip.url;
            video.crossOrigin = 'anonymous';

            video.addEventListener('loadedmetadata', () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = 160;
                canvas.height = Math.round((video.videoHeight / video.videoWidth) * 160) || 90;

                const thumbnails: string[] = [];
                let loaded = 0;

                const seekAndCapture = (index: number) => {
                    const time = (video.duration * index) / Math.max(1, count - 1);
                    video.currentTime = Math.min(time, video.duration - 0.001);

                    const onSeeked = () => {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        thumbnails[index] = canvas.toDataURL('image/jpeg', 0.7);
                        loaded++;

                        if (loaded === count) {
                            video.removeEventListener('seeked', onSeeked);
                            resolve(thumbnails);
                        }
                    };

                    video.addEventListener('seeked', onSeeked, { once: true });
                };

                for (let i = 0; i < count; i++) {
                    seekAndCapture(i);
                }
            });

            video.addEventListener('error', () => {
                resolve([]);
            });
        });
    }, []);

    // Load clips from files
    const loadClipsFromFiles = useCallback(async (files: FileList) => {
        const newClips: Clip[] = [];
        const newThumbnails = new Map<number, string[]>();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('video/')) continue;

            const url = URL.createObjectURL(file);
            const clip: Clip = {
                id: Date.now() + i,
                url,
                duration: 0,
                trimStart: 0,
                trimEnd: 0,
                blob: file,
                file,
            };

            // Get duration
            await new Promise<void>((resolve) => {
                const video = document.createElement('video');
                video.src = url;
                video.addEventListener('loadedmetadata', () => {
                    clip.duration = video.duration;
                    clip.trimEnd = video.duration;
                    resolve();
                });
                video.addEventListener('error', () => resolve());
            });

            newClips.push(clip);

            // Generate thumbnails
            const thumbs = await generateThumbnails(clip);
            newThumbnails.set(clip.id, thumbs);
        }

        setClips(prev => [...prev, ...newClips]);
        setThumbnails(prev => {
            const merged = new Map(prev);
            newThumbnails.forEach((thumbs, id) => merged.set(id, thumbs));
            return merged;
        });

        // Auto-play first video
        if (newClips.length > 0 && clips.length === 0) {
            setCurrentClipIndex(0);
            setSelectedClipId(newClips[0].id);
            setTimeout(() => {
                try {
                    videoRef.current?.play().catch((e) => {
                        if (e.name !== 'AbortError') {
                            console.error('Auto-play failed:', e);
                        }
                    });
                } catch (e) {
                    console.error('Auto-play error:', e);
                }
            }, 100);
        }
    }, [clips.length, generateThumbnails]);

    // Render canvas with video and overlays
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video || video.readyState < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const currentClip = clips[currentClipIndex];
        if (!currentClip) return;

        const clipStartTime = clips.slice(0, currentClipIndex).reduce((sum, c) => sum + (c.trimEnd - c.trimStart), 0);
        const relativeTime = currentTime - clipStartTime;

        // Draw text overlays
        textOverlays.forEach(overlay => {
            if (relativeTime >= overlay.startTime && relativeTime <= overlay.endTime) {
                ctx.fillStyle = overlay.color;
                ctx.font = `${overlay.fontSize}px ${overlay.font}`;
                ctx.textBaseline = 'top';
                const x = (overlay.x / 100) * canvas.width;
                const y = (overlay.y / 100) * canvas.height;
                ctx.fillText(overlay.text, x, y);
            }
        });

        // Draw sticker overlays
        stickerOverlays.forEach(overlay => {
            if (relativeTime >= overlay.startTime && relativeTime <= overlay.endTime) {
                const img = new Image();
                img.src = overlay.url;
                img.onload = () => {
                    const x = (overlay.x / 100) * canvas.width;
                    const y = (overlay.y / 100) * canvas.height;
                    const width = (overlay.width / 100) * canvas.width;
                    const height = (overlay.height / 100) * canvas.height;
                    ctx.drawImage(img, x, y, width, height);
                };
            }
        });
    }, [clips, currentClipIndex, currentTime, textOverlays, stickerOverlays]);

    // Update canvas on video time update
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            renderCanvas();
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }, [renderCanvas]);

    // Handle preview time during trim dragging
    useEffect(() => {
        if (previewTime === null || !videoRef.current) return;

        const video = videoRef.current;
        const wasPlaying = !video.paused;

        video.pause();
        video.currentTime = previewTime;

        video.addEventListener('seeked', () => {
            renderCanvas();
            if (wasPlaying) {
                video.play().catch(() => {});
            }
        }, { once: true });
    }, [previewTime, renderCanvas]);

    // Handle video metadata loaded
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            if (canvasRef.current) {
                canvasRef.current.width = video.videoWidth;
                canvasRef.current.height = video.videoHeight;
            }
            renderCanvas();

            // Auto-play first video on load
            if (clips.length > 0 && currentClipIndex === 0) {
                setTimeout(() => {
                    try {
                        video.play().catch((e) => {
                            if (e.name !== 'AbortError') {
                                console.error('Auto-play failed:', e);
                            }
                        });
                    } catch (e) {
                        console.error('Auto-play error:', e);
                    }
                }, 100);
            }
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }, [clips, currentClipIndex, renderCanvas]);

    // Add text overlay
    const addTextOverlay = useCallback(() => {
        if (!textInput.trim()) return;

        const overlay: TextOverlay = {
            id: `text-${Date.now()}`,
            text: textInput,
            x: 10,
            y: 10,
            fontSize: textSize,
            color: textColor,
            font: textFont,
            startTime: currentTime,
            endTime: currentTime + 5,
        };

        setTextOverlays(prev => [...prev, overlay]);
        setTextInput('');
        setActiveTool(null);
    }, [textInput, textSize, textColor, textFont, currentTime]);

    // Handle canvas click for overlay selection/dragging
    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Check text overlays (with padding for easier clicking)
        for (const overlay of textOverlays) {
            const overlayX = (overlay.x / 100) * canvas.width;
            const overlayY = (overlay.y / 100) * canvas.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.font = `${overlay.fontSize}px ${overlay.font}`;
                const metrics = ctx.measureText(overlay.text);
                const textWidth = metrics.width;
                const textHeight = overlay.fontSize;

                const clickX = (e.clientX - rect.left);
                const clickY = (e.clientY - rect.top);
                const padding = 10;

                if (
                    clickX >= overlayX - padding &&
                    clickX <= overlayX + textWidth + padding &&
                    clickY >= overlayY - padding &&
                    clickY <= overlayY + textHeight + padding
                ) {
                    setSelectedOverlayId(overlay.id);
                    setDraggingOverlay(overlay.id);
                    return;
                }
            }
        }

        // Check sticker overlays
        for (const overlay of stickerOverlays) {
            const overlayX = (overlay.x / 100) * canvas.width;
            const overlayY = (overlay.y / 100) * canvas.height;
            const overlayWidth = (overlay.width / 100) * canvas.width;
            const overlayHeight = (overlay.height / 100) * canvas.height;

            const clickX = (e.clientX - rect.left);
            const clickY = (e.clientY - rect.top);
            const padding = 10;

            if (
                clickX >= overlayX - padding &&
                clickX <= overlayX + overlayWidth + padding &&
                clickY >= overlayY - padding &&
                clickY <= overlayY + overlayHeight + padding
            ) {
                setSelectedOverlayId(overlay.id);
                setDraggingOverlay(overlay.id);
                return;
            }
        }

        setSelectedOverlayId(null);
    }, [textOverlays, stickerOverlays]);

    // Handle mouse move for dragging overlays
    useEffect(() => {
        if (!draggingOverlay) return;

        const handleMouseMove = (e: MouseEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            // Clamp to canvas bounds
            const clampedX = Math.max(0, Math.min(100, x));
            const clampedY = Math.max(0, Math.min(100, y));

            setTextOverlays(prev => prev.map(o =>
                o.id === draggingOverlay ? { ...o, x: clampedX, y: clampedY } : o
            ));
            setStickerOverlays(prev => prev.map(o =>
                o.id === draggingOverlay ? { ...o, x: clampedX, y: clampedY } : o
            ));
        };

        const handleMouseUp = () => {
            setDraggingOverlay(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingOverlay]);

    // Export video
    const exportVideo = useCallback(async () => {
        if (!ffmpegRef.current || !ffmpegLoaded || clips.length === 0) {
            Swal.fire(bottomSheet({
                title: 'Export Error',
                message: 'FFmpeg not loaded or no clips to export',
                icon: 'alert',
            }));
            return;
        }

        setIsExporting(true);

        try {
            const ffmpeg = ffmpegRef.current;

            // Write input files
            for (const clip of clips) {
                if (clip.file) {
                    await ffmpeg.writeFile(`input-${clip.id}.mp4`, await fetchFile(clip.file));
                }
            }

            // Build FFmpeg command
            let command: string[];
            if (clips.length === 1) {
                const clip = clips[0];
                const hasTrims = clip.trimStart > 0 || clip.trimEnd < clip.duration;
                const hasOverlays = textOverlays.length > 0 || stickerOverlays.length > 0;

                if (!hasTrims && !hasOverlays) {
                    // Simple copy
                    command = ['-i', `input-${clip.id}.mp4`, '-c', 'copy', 'output.mp4'];
                } else {
                    // Apply trims and overlays
                    let filter = '';
                    if (hasTrims) {
                        filter += `[0:v]trim=start=${clip.trimStart}:end=${clip.trimEnd},setpts=PTS-STARTPTS[v0];`;
                        filter += `[0:a]atrim=start=${clip.trimStart}:end=${clip.trimEnd},asetpts=PTS-STARTPTS[a0];`;
                    } else {
                        filter += `[0:v]copy[v0];[0:a]copy[a0];`;
                    }

                    // Add text overlays
                    textOverlays.forEach((overlay, idx) => {
                        filter += `[v${idx}]drawtext=text='${overlay.text}':x=${overlay.x}*W/100:y=${overlay.y}*H/100:fontsize=${overlay.fontSize}:fontcolor=${overlay.color}[v${idx + 1}];`;
                    });

                    command = ['-i', `input-${clip.id}.mp4`, '-filter_complex', filter, '-map', '[v' + textOverlays.length + ']', '-map', '[a0]', 'output.mp4'];
                }
            } else {
                // Multi-clip: use concat demuxer
                const concatList = clips.map((_, idx) => `file 'input-${clips[idx].id}.mp4'`).join('\n');
                await ffmpeg.writeFile('concat.txt', concatList);

                command = ['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4'];
            }

            await ffmpeg.exec(command);

            // Read output
            const data = await ffmpeg.readFile('output.mp4');
            const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : (data as Uint8Array);
            const blob = new Blob([bytes as BlobPart], { type: 'video/mp4' });

            // Convert to data URL for local persistence
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            // Check size (50MB limit for data URLs)
            if (dataUrl.length > 50 * 1024 * 1024) {
                Swal.fire(bottomSheet({
                    title: 'File Too Large',
                    message: 'Video is too large for local storage. Please start the backend server to upload.',
                    icon: 'alert',
                }));
                setIsExporting(false);
                return;
            }

            // Try to upload to backend
            let finalUrl = dataUrl;
            try {
                const uploadResponse = await uploadFile(blob as any);
                if (uploadResponse?.url) {
                    finalUrl = uploadResponse.url;
                }
            } catch (error) {
                console.log('Backend upload failed, using data URL:', error);
            }

            // Create post
            await createPost(
                user?.id || 'test user',
                user?.handle || 'test-user',
                '',
                'Ireland',
                finalUrl,
                'video',
                undefined,
                undefined,
                'Finglas',
                'Dublin',
                'Ireland'
            );

            Swal.fire(bottomSheet({
                title: 'Video Exported!',
                message: 'Your video has been posted to the feed.',
                icon: 'success',
            }));

            navigate('/feed');
        } catch (error: any) {
            console.error('Export error:', error);
            Swal.fire(bottomSheet({
                title: 'Export Failed',
                message: error?.message || 'Failed to export video',
                icon: 'alert',
            }));
        } finally {
            setIsExporting(false);
        }
    }, [clips, textOverlays, stickerOverlays, ffmpegLoaded, user, navigate]);

    const currentClip = clips[currentClipIndex];

    return (
        <div className="fixed inset-0 bg-gray-900 text-white z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-800 rounded"
                >
                    <FiChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-semibold">Video Editor</h1>
                <button
                    onClick={exportVideo}
                    disabled={isExporting || clips.length === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                >
                    {isExporting ? 'Exporting...' : 'Next'}
                </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 flex items-center justify-center bg-black relative">
                <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full"
                    onMouseDown={handleCanvasMouseDown}
                />
                <video
                    ref={videoRef}
                    src={currentClip?.url}
                    className="hidden"
                    playsInline
                />
                {previewTime !== null && (
                    <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded text-sm">
                        Preview: {Math.floor(previewTime / 60)}:{(previewTime % 60).toFixed(1).padStart(4, '0')}
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="p-4 bg-gray-800 border-t border-gray-700">
                <div
                    className="relative h-24 bg-gray-900 rounded overflow-hidden"
                    onPointerMove={(e) => {
                        if (!draggingTrimHandle || selectedClipId === null) return;

                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
                        const timePercent = x / rect.width;
                        const newTime = timePercent * totalDuration;

                        const clip = clips.find(c => c.id === selectedClipId);
                        if (!clip) return;

                        if (draggingTrimHandle === 'start') {
                            const newTrimStart = Math.max(0, Math.min(newTime, clip.trimEnd - 0.1));
                            setClips(prev => prev.map(c =>
                                c.id === selectedClipId ? { ...c, trimStart: newTrimStart } : c
                            ));
                            setPreviewTime(newTrimStart);
                        } else {
                            const newTrimEnd = Math.min(clip.duration, Math.max(newTime, clip.trimStart + 0.1));
                            setClips(prev => prev.map(c =>
                                c.id === selectedClipId ? { ...c, trimEnd: newTrimEnd } : c
                            ));
                            setPreviewTime(newTrimEnd);
                        }
                    }}
                    onPointerUp={() => {
                        if (draggingTrimHandle) {
                            setDraggingTrimHandle(null);
                            setPreviewTime(null);
                            try {
                                videoRef.current?.pause();
                            } catch (e) {
                                // Ignore abort errors
                            }
                        }
                    }}
                >
                    {clips.map((clip, idx) => {
                        const clipThumbnails = thumbnails.get(clip.id) || [];
                        const clipStart = clips.slice(0, idx).reduce((sum, c) => sum + (c.trimEnd - c.trimStart), 0);
                        const clipDuration = clip.trimEnd - clip.trimStart;
                        const totalDuration = clips.reduce((sum, c) => sum + (c.trimEnd - c.trimStart), 0);
                        const clipWidth = totalDuration > 0 ? (clipDuration / totalDuration) * 100 : 0;

                        return (
                            <div
                                key={clip.id}
                                className="absolute top-0 bottom-0 flex"
                                style={{
                                    left: `${totalDuration > 0 ? (clipStart / totalDuration) * 100 : 0}%`,
                                    width: `${clipWidth}%`,
                                }}
                            >
                                {clipThumbnails.map((thumb, thumbIdx) => (
                                    <img
                                        key={thumbIdx}
                                        src={thumb}
                                        alt=""
                                        className="h-full object-cover"
                                        style={{ width: `${100 / Math.max(1, clipThumbnails.length)}%` }}
                                    />
                                ))}
                                {/* Trim handles */}
                                <div
                                    className="absolute left-0 top-0 bottom-0 w-2 bg-white cursor-ew-resize hover:bg-blue-500"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        setDraggingTrimHandle('start');
                                        setSelectedClipId(clip.id);
                                        try {
                                            videoRef.current?.pause();
                                        } catch (e) {
                                            // Ignore abort errors
                                        }
                                    }}
                                />
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-2 bg-white cursor-ew-resize hover:bg-blue-500"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        setDraggingTrimHandle('end');
                                        setSelectedClipId(clip.id);
                                        try {
                                            videoRef.current?.pause();
                                        } catch (e) {
                                            // Ignore abort errors
                                        }
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tools Footer */}
            <div className="p-4 bg-gray-800 border-t border-gray-700 flex items-center justify-around">
                <button
                    onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
                    className={`p-3 rounded ${activeTool === 'text' ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                    <FiType className="w-6 h-6" />
                </button>
                <button
                    onClick={() => setActiveTool(activeTool === 'sticker' ? null : 'sticker')}
                    className={`p-3 rounded ${activeTool === 'sticker' ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                    <FiSmile className="w-6 h-6" />
                </button>
                <button
                    onClick={() => {
                        fileInputRef.current?.click();
                    }}
                    className="p-3 rounded bg-gray-700"
                >
                    <FiImage className="w-6 h-6" />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) {
                            loadClipsFromFiles(e.target.files);
                        }
                    }}
                />
            </div>

            {/* Text Input Panel */}
            {activeTool === 'text' && (
                <div className="absolute bottom-20 left-0 right-0 p-4 bg-gray-800 border-t border-gray-700">
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Enter text"
                        className="w-full p-2 bg-gray-700 rounded mb-2"
                    />
                    <div className="flex gap-2">
                        <input
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-12 h-10"
                        />
                        <input
                            type="number"
                            value={textSize}
                            onChange={(e) => setTextSize(Number(e.target.value))}
                            className="w-20 p-2 bg-gray-700 rounded"
                        />
                        <button
                            onClick={addTextOverlay}
                            className="px-4 py-2 bg-blue-600 rounded"
                        >
                            Add
                        </button>
                        <button
                            onClick={() => setActiveTool(null)}
                            className="px-4 py-2 bg-gray-700 rounded"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Overlay Inspector Panel */}
            {selectedOverlayId && (
                <div className="absolute right-0 top-0 bottom-0 w-64 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
                    <h3 className="text-lg font-semibold mb-4">Edit Overlay</h3>
                    {(() => {
                        const textOverlay = textOverlays.find(o => o.id === selectedOverlayId);
                        const stickerOverlay = stickerOverlays.find(o => o.id === selectedOverlayId);
                        const overlay = textOverlay || stickerOverlay;
                        if (!overlay) return null;

                        return (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm mb-1">X Position</label>
                                    <input
                                        type="number"
                                        value={overlay.x}
                                        onChange={(e) => {
                                            if (textOverlay) {
                                                setTextOverlays(prev => prev.map(o =>
                                                    o.id === selectedOverlayId ? { ...o, x: Number(e.target.value) } : o
                                                ));
                                            } else if (stickerOverlay) {
                                                setStickerOverlays(prev => prev.map(o =>
                                                    o.id === selectedOverlayId ? { ...o, x: Number(e.target.value) } : o
                                                ));
                                            }
                                        }}
                                        className="w-full p-2 bg-gray-700 rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">Y Position</label>
                                    <input
                                        type="number"
                                        value={overlay.y}
                                        onChange={(e) => {
                                            if (textOverlay) {
                                                setTextOverlays(prev => prev.map(o =>
                                                    o.id === selectedOverlayId ? { ...o, y: Number(e.target.value) } : o
                                                ));
                                            } else if (stickerOverlay) {
                                                setStickerOverlays(prev => prev.map(o =>
                                                    o.id === selectedOverlayId ? { ...o, y: Number(e.target.value) } : o
                                                ));
                                            }
                                        }}
                                        className="w-full p-2 bg-gray-700 rounded"
                                    />
                                </div>
                                {textOverlay && (
                                    <>
                                        <div>
                                            <label className="block text-sm mb-1">Text</label>
                                            <input
                                                type="text"
                                                value={textOverlay.text}
                                                onChange={(e) => {
                                                    setTextOverlays(prev => prev.map(o =>
                                                        o.id === selectedOverlayId ? { ...o, text: e.target.value } : o
                                                    ));
                                                }}
                                                className="w-full p-2 bg-gray-700 rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-1">Color</label>
                                            <input
                                                type="color"
                                                value={textOverlay.color}
                                                onChange={(e) => {
                                                    setTextOverlays(prev => prev.map(o =>
                                                        o.id === selectedOverlayId ? { ...o, color: e.target.value } : o
                                                    ));
                                                }}
                                                className="w-full h-10"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

