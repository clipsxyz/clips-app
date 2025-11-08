import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiPlay, FiPause, FiScissors, FiMove, FiRotateCw, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import type { MediaClip, Transition, EditedMedia } from '../types';
import Timeline from '../components/Timeline';

export default function VideoEditorPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = location.state as {
        mediaUrl?: string;
        mediaType?: 'image' | 'video';
        mediaItems?: Array<{ url: string; type: 'image' | 'video'; duration?: number }>;
    } | null;

    const [clips, setClips] = React.useState<MediaClip[]>([]);
    const [transitions, setTransitions] = React.useState<Transition[]>([]);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [selectedClipId, setSelectedClipId] = React.useState<string | null>(null);
    const [isTrimming, setIsTrimming] = React.useState(false);
    const [trimStart, setTrimStart] = React.useState(0);
    const [trimEnd, setTrimEnd] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const previewRef = React.useRef<HTMLDivElement>(null);

    // Initialize clips from location state
    React.useEffect(() => {
        if (locationState) {
            const initialClips: MediaClip[] = [];

            if (locationState.mediaItems && locationState.mediaItems.length > 0) {
                // Multiple media items (carousel)
                let currentTime = 0;
                locationState.mediaItems.forEach((item, index) => {
                    const duration = item.type === 'video' ? (item.duration || 5) : 3; // Default 3s for images
                    initialClips.push({
                        id: `clip-${index}`,
                        mediaUrl: item.url,
                        type: item.type,
                        startTime: currentTime,
                        duration: duration,
                        trimStart: 0,
                        trimEnd: 0,
                        speed: 1,
                        reverse: false,
                        originalDuration: item.type === 'video' ? item.duration : undefined
                    });
                    currentTime += duration;
                });
                setClips(initialClips);
                if (initialClips.length > 0) {
                    setSelectedClipId(initialClips[0].id);
                }
                setIsLoading(false);
            } else if (locationState.mediaUrl) {
                // Single media item - need to get video duration
                if (locationState.mediaType === 'video') {
                    // Create a temporary video element to get duration
                    const tempVideo = document.createElement('video');
                    tempVideo.src = locationState.mediaUrl;
                    tempVideo.preload = 'metadata';
                    tempVideo.crossOrigin = 'anonymous';

                    const handleLoadedMetadata = () => {
                        const duration = tempVideo.duration && isFinite(tempVideo.duration) ? tempVideo.duration : 5; // Fallback to 5 seconds
                        const clip: MediaClip = {
                            id: 'clip-0',
                            mediaUrl: locationState.mediaUrl!,
                            type: 'video',
                            startTime: 0,
                            duration: duration,
                            trimStart: 0,
                            trimEnd: 0,
                            speed: 1,
                            reverse: false,
                            originalDuration: duration
                        };
                        setClips([clip]);
                        setSelectedClipId(clip.id);
                        setIsLoading(false);
                        tempVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
                        tempVideo.removeEventListener('error', handleError);
                    };

                    const handleError = () => {
                        // Fallback if video fails to load
                        const clip: MediaClip = {
                            id: 'clip-0',
                            mediaUrl: locationState.mediaUrl!,
                            type: 'video',
                            startTime: 0,
                            duration: 5,
                            trimStart: 0,
                            trimEnd: 0,
                            speed: 1,
                            reverse: false,
                            originalDuration: 5
                        };
                        setClips([clip]);
                        setSelectedClipId(clip.id);
                        setIsLoading(false);
                        tempVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
                        tempVideo.removeEventListener('error', handleError);
                    };

                    tempVideo.addEventListener('loadedmetadata', handleLoadedMetadata);
                    tempVideo.addEventListener('error', handleError);
                } else {
                    // Image
                    const clip: MediaClip = {
                        id: 'clip-0',
                        mediaUrl: locationState.mediaUrl,
                        type: 'image',
                        startTime: 0,
                        duration: 3,
                        trimStart: 0,
                        trimEnd: 0,
                        speed: 1,
                        reverse: false
                    };
                    setClips([clip]);
                    setSelectedClipId(clip.id);
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    }, [locationState]);

    // Calculate total duration
    const totalDuration = React.useMemo(() => {
        if (clips.length === 0) return 0;
        const lastClip = clips[clips.length - 1];
        return lastClip.startTime + lastClip.duration;
    }, [clips]);

    // Get current clip at current time
    const currentClip = React.useMemo(() => {
        if (clips.length === 0) return null;
        return clips.find(clip =>
            currentTime >= clip.startTime &&
            currentTime < clip.startTime + clip.duration
        ) || clips[0];
    }, [clips, currentTime]);

    // Playback control
    React.useEffect(() => {
        if (!isPlaying || !videoRef.current) return;

        const interval = setInterval(() => {
            setCurrentTime(prev => {
                const newTime = prev + 0.1;
                if (newTime >= totalDuration) {
                    setIsPlaying(false);
                    return 0;
                }
                return newTime;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [isPlaying, totalDuration]);

    // Video playback sync
    React.useEffect(() => {
        if (!videoRef.current || !currentClip || currentClip.type !== 'video' || clips.length === 0) return;

        const clipTime = currentTime - currentClip.startTime;
        const videoTime = clipTime * currentClip.speed + currentClip.trimStart;

        if (isPlaying) {
            videoRef.current.currentTime = videoTime;
            videoRef.current.play().catch(() => { });
        } else {
            videoRef.current.pause();
        }
    }, [currentTime, currentClip, isPlaying]);

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    const handleTimeChange = (time: number) => {
        setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
    };

    const handleSplitClip = (clipId: string, splitTime: number) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return;

        const clipTime = splitTime - clip.startTime;
        if (clipTime <= 0 || clipTime >= clip.duration) return;

        // Create two new clips
        const clip1: MediaClip = {
            ...clip,
            id: `${clipId}-1`,
            duration: clipTime,
            trimEnd: clip.trimEnd + (clip.duration - clipTime)
        };

        const clip2: MediaClip = {
            ...clip,
            id: `${clipId}-2`,
            startTime: splitTime,
            duration: clip.duration - clipTime,
            trimStart: clip.trimStart + clipTime
        };

        // Update all clips after the split
        const clipIndex = clips.findIndex(c => c.id === clipId);
        const updatedClips = [...clips];
        updatedClips.splice(clipIndex, 1, clip1, clip2);

        // Update start times for subsequent clips
        updatedClips.forEach((c, idx) => {
            if (idx > clipIndex + 1) {
                c.startTime = updatedClips[idx - 1].startTime + updatedClips[idx - 1].duration;
            }
        });

        setClips(updatedClips);
    };

    const handleReorderClips = (fromIndex: number, toIndex: number) => {
        const updatedClips = [...clips];
        const [moved] = updatedClips.splice(fromIndex, 1);
        updatedClips.splice(toIndex, 0, moved);

        // Recalculate start times
        let currentTime = 0;
        updatedClips.forEach(clip => {
            clip.startTime = currentTime;
            currentTime += clip.duration;
        });

        setClips(updatedClips);
    };

    const handleTrimClip = (clipId: string, newTrimStart: number, newTrimEnd: number) => {
        setClips(prev => prev.map(clip => {
            if (clip.id === clipId) {
                const originalDuration = clip.originalDuration || clip.duration;
                const maxTrim = originalDuration;

                return {
                    ...clip,
                    trimStart: Math.max(0, Math.min(newTrimStart, maxTrim)),
                    trimEnd: Math.max(0, Math.min(newTrimEnd, maxTrim)),
                    duration: originalDuration - newTrimStart - newTrimEnd
                };
            }
            return clip;
        }));
    };

    const handleDeleteClip = (clipId: string) => {
        const clipIndex = clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return;

        const updatedClips = clips.filter(c => c.id !== clipId);

        // Recalculate start times
        let currentTime = 0;
        updatedClips.forEach(clip => {
            clip.startTime = currentTime;
            currentTime += clip.duration;
        });

        setClips(updatedClips);
        if (selectedClipId === clipId) {
            setSelectedClipId(updatedClips[0]?.id || null);
        }
    };

    const handleAddTransition = (fromClipId: string, toClipId: string, type: Transition['type']) => {
        const newTransition: Transition = {
            id: `transition-${Date.now()}`,
            fromClipId,
            toClipId,
            type,
            duration: 0.5 // Default 0.5 seconds
        };
        setTransitions(prev => [...prev, newTransition]);
    };

    const handleSave = () => {
        const editedMedia: EditedMedia = {
            clips,
            transitions,
            totalDuration
        };

        // Navigate back to CreatePage with edited media
        navigate('/create', {
            state: {
                editedMedia,
                mediaItems: clips.map(clip => ({
                    url: clip.mediaUrl,
                    type: clip.type,
                    duration: clip.duration
                }))
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading video editor...</p>
                </div>
            </div>
        );
    }

    if (clips.length === 0 || !locationState) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {!locationState ? 'No media selected. Please go back and select a video or image to edit.' : 'No media to edit'}
                    </p>
                    <button
                        onClick={() => navigate('/create')}
                        className="px-4 py-2 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate('/create')}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <FiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Video</h1>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity"
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div
                    ref={previewRef}
                    className="relative w-full max-w-md aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl"
                >
                    {currentClip && (
                        <>
                            {currentClip.type === 'video' ? (
                                <video
                                    ref={videoRef}
                                    src={currentClip.mediaUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={currentClip.mediaUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                        onClick={() => handleTimeChange(currentTime - 0.1)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <FiChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                        onClick={handlePlayPause}
                        className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                    >
                        {isPlaying ? (
                            <FiPause className="w-6 h-6" />
                        ) : (
                            <FiPlay className="w-6 h-6 ml-0.5" />
                        )}
                    </button>
                    <button
                        onClick={() => handleTimeChange(currentTime + 0.1)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <FiChevronRight className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* Timeline */}
                <Timeline
                    clips={clips}
                    currentTime={currentTime}
                    totalDuration={totalDuration}
                    selectedClipId={selectedClipId}
                    onTimeChange={handleTimeChange}
                    onClipSelect={setSelectedClipId}
                    onSplitClip={handleSplitClip}
                    onReorderClips={handleReorderClips}
                    onTrimClip={handleTrimClip}
                    onDeleteClip={handleDeleteClip}
                />

                {/* Editing Tools */}
                <div className="mt-4 flex items-center justify-center gap-4">
                    <button
                        onClick={() => {
                            if (selectedClipId) {
                                handleSplitClip(selectedClipId, currentTime);
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="Split clip at current time"
                    >
                        <FiScissors className="w-5 h-5" />
                        <span className="text-sm font-medium">Split</span>
                    </button>
                    <button
                        onClick={() => setIsTrimming(!isTrimming)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full ${isTrimming ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} hover:opacity-90 transition-colors`}
                        title="Trim clip"
                    >
                        <FiRotateCw className="w-5 h-5" />
                        <span className="text-sm font-medium">Trim</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

