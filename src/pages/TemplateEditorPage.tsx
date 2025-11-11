import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiImage, FiVideo, FiPlus, FiSmile, FiUser, FiChevronLeft, FiChevronRight, FiType, FiMessageSquare } from 'react-icons/fi';
import { VideoTemplate, StickerOverlay, Sticker } from '../types';
import { incrementTemplateUsage } from '../api/templates';
import { createPost } from '../api/posts';
import { useAuth } from '../context/Auth';
import { TEMPLATE_IDS, TEMPLATE_GRADIENTS, MAX_CLIPS, MIN_CLIPS, DEFAULT_CLIP_DURATION, ANIMATION_DURATIONS } from '../constants';
import StickerPicker from '../components/StickerPicker';
import { transcribeVideo } from '../utils/transcription';
import StickerOverlayComponent from '../components/StickerOverlay';
import TextStickerModal from '../components/TextStickerModal';
import UserTaggingModal from '../components/UserTaggingModal';
import EffectWrapper from '../components/EffectWrapper';
import type { EffectConfig } from '../utils/effects';

type UserMedia = {
    clipId: string;
    url: string;
    mediaType: 'image' | 'video';
    file?: File;
};

export default function TemplateEditorPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const template = (location.state as { template?: VideoTemplate })?.template;

    const [userMedia, setUserMedia] = React.useState<Map<string, UserMedia>>(new Map());
    const [currentClipIndex, setCurrentClipIndex] = React.useState(0);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [text, setText] = React.useState('');
    const [locationLabel, setLocationLabel] = React.useState('');
    const [bannerText, setBannerText] = React.useState('');
    const [captionsEnabled, setCaptionsEnabled] = React.useState(false);
    const [videoCaptionText, setVideoCaptionText] = React.useState('');
    const [subtitlesEnabled, setSubtitlesEnabled] = React.useState(false);
    const [subtitleText, setSubtitleText] = React.useState('');
    const [isTranscribing, setIsTranscribing] = React.useState(false);
    const [stickers, setStickers] = React.useState<Map<string, StickerOverlay[]>>(new Map()); // clipId -> stickers
    const [showStickerPicker, setShowStickerPicker] = React.useState(false);
    const [showTextStickerModal, setShowTextStickerModal] = React.useState(false);
    const [selectedStickerOverlay, setSelectedStickerOverlay] = React.useState<string | null>(null);
    const [taggedUsers, setTaggedUsers] = React.useState<string[]>([]);
    const [showUserTagging, setShowUserTagging] = React.useState(false);
    const [currentStep, setCurrentStep] = React.useState<'media' | 'stickers' | 'details'>('media');
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);

    // For top 3 templates (Gazetteer, Instagram, TikTok), support dynamic clips (1-20)
    const isTopTemplate = template?.id === TEMPLATE_IDS.INSTAGRAM || template?.id === TEMPLATE_IDS.TIKTOK || template?.id === TEMPLATE_IDS.GAZETTEER;
    const [dynamicClips, setDynamicClips] = React.useState<Array<{ id: string; mediaType: 'image' | 'video'; duration: number }>>(
        isTopTemplate ? [{ id: 'clip-1', mediaType: 'video', duration: DEFAULT_CLIP_DURATION }] : []
    );

    // Use dynamic clips for top templates, otherwise use template.clips
    const activeClips = isTopTemplate ? dynamicClips : (template?.clips || []);

    React.useEffect(() => {
        if (!template) {
            navigate('/templates');
        }
    }, [template, navigate]);

    if (!template) {
        return null;
    }

    const currentClip = activeClips[currentClipIndex] || activeClips[0];
    const allClipsFilled = activeClips.length > 0 && activeClips.every(clip => userMedia.has(clip.id));

    // Get gradient style for button text based on template
    const buttonTextStyle = React.useMemo((): React.CSSProperties => {
        if (template?.id === TEMPLATE_IDS.INSTAGRAM) {
            return {
                background: TEMPLATE_GRADIENTS.INSTAGRAM,
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`,
                display: 'block'
            };
        } else if (template?.id === TEMPLATE_IDS.TIKTOK) {
            return {
                background: TEMPLATE_GRADIENTS.TIKTOK,
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`,
                display: 'block'
            };
        } else if (template?.id === TEMPLATE_IDS.GAZETTEER) {
            return {
                background: TEMPLATE_GRADIENTS.GAZETTEER,
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`,
                display: 'block'
            };
        }
        return { color: 'white', display: 'block' };
    }, [template?.id]);
    const showPinnedNext = currentStep === 'media' && userMedia.size > 0;
    const canGoPrevious = currentClipIndex > 0;
    const canGoNext = currentClipIndex < activeClips.length - 1;

    // Auto-advance to details step when all clips are filled
    React.useEffect(() => {
        if (allClipsFilled && currentStep === 'media') {
            // Don't auto-advance, let user click Next
        }
    }, [allClipsFilled, currentStep]);

    function handleMediaSelect(clipId: string, event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate MP4 for video templates (but top templates accept both images and videos)
        if (!isTopTemplate) {
            const currentClip = activeClips.find(c => c.id === clipId);
            if (currentClip?.mediaType === 'video') {
                if (!file.type.includes('mp4') && !file.name.toLowerCase().endsWith('.mp4')) {
                    alert('Please select an MP4 video file only.');
                    return;
                }
            }
        } else {
            // For top templates, validate video is MP4 if it's a video file
            if (file.type.startsWith('video/') && !file.type.includes('mp4') && !file.name.toLowerCase().endsWith('.mp4')) {
                alert('Please select an MP4 video file or an image.');
                return;
            }
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target?.result as string;
            const mediaType = file.type.startsWith('image/') ? 'image' : 'video';

            // For top templates, update the clip's mediaType based on what was selected
            if (isTopTemplate) {
                const clipIndex = dynamicClips.findIndex(c => c.id === clipId);
                if (clipIndex !== -1) {
                    setDynamicClips(prev => {
                        const newClips = [...prev];
                        newClips[clipIndex] = { ...newClips[clipIndex], mediaType };
                        return newClips;
                    });
                }
            }

            setUserMedia(prev => {
                const newMap = new Map(prev);
                newMap.set(clipId, {
                    clipId,
                    url,
                    mediaType,
                    file
                });
                return newMap;
            });

            // Auto-advance to next clip if available (only if not at max)
            const currentIndex = activeClips.findIndex(c => c.id === clipId);
            if (currentIndex < activeClips.length - 1) {
                setTimeout(() => {
                    setCurrentClipIndex(currentIndex + 1);
                }, 300);
            }
        };
        reader.readAsDataURL(file);
    }

    function handleNext() {
        if (currentClipIndex < activeClips.length - 1) {
            setCurrentClipIndex(currentClipIndex + 1);
        }
    }

    function handlePrevious() {
        if (currentClipIndex > 0) {
            setCurrentClipIndex(currentClipIndex - 1);
        }
    }

    function handleRemoveMedia(clipId: string) {
        setUserMedia(prev => {
            const newMap = new Map(prev);
            newMap.delete(clipId);
            return newMap;
        });
    }

    function handleAddClip() {
        if (!isTopTemplate || dynamicClips.length >= MAX_CLIPS) return;

        const newClipId = `clip-${dynamicClips.length + 1}`;
        const newClip = {
            id: newClipId,
            mediaType: 'video' as const,
            duration: DEFAULT_CLIP_DURATION
        };
        setDynamicClips([...dynamicClips, newClip]);
        setCurrentClipIndex(dynamicClips.length); // Navigate to the new clip
    }

    // Removed unused function - clips are managed via dynamic state
    // function handleRemoveClip(clipId: string) {
    //     if (!isTopTemplate || dynamicClips.length <= 1) return;
    //     
    //     const index = dynamicClips.findIndex(c => c.id === clipId);
    //     if (index === -1) return;
    //     
    //     // Remove media and stickers for this clip
    //     setUserMedia(prev => {
    //         const newMap = new Map(prev);
    //         newMap.delete(clipId);
    //         return newMap;
    //     });
    //     setStickers(prev => {
    //         const newMap = new Map(prev);
    //         newMap.delete(clipId);
    //         return newMap;
    //     });
    //     
    //     // Remove the clip
    //     const newClips = dynamicClips.filter(c => c.id !== clipId);
    //     setDynamicClips(newClips);
    //     
    //     // Adjust current index if needed
    //     if (currentClipIndex >= newClips.length) {
    //         setCurrentClipIndex(newClips.length - 1);
    //     }
    // }

    async function handleCreateVideo() {
        // Allow creating post with at least one clip filled
        const filledClips = activeClips.filter(clip => userMedia.has(clip.id));
        if (filledClips.length === 0 || !user) return;

        setIsProcessing(true);
        try {
            // Increment template usage
            await incrementTemplateUsage(template?.id || '');

            // For now, we'll use the first clip's media as the main post media
            // In a full implementation, you'd combine all clips into a single video
            const firstMedia = Array.from(userMedia.values())[0];
            if (!firstMedia) return;

            // Collect only media items from clips that have been filled, including effects
            const allMediaItems = activeClips
                .map(clip => {
                    const media = userMedia.get(clip.id);
                    if (!media) return null;
                    // Get effects from template clip if it exists, otherwise empty array
                    const clipEffects: any[] = 'effects' in clip && Array.isArray(clip.effects) ? clip.effects : [];
                    return {
                        url: media.url,
                        type: media.mediaType,
                        duration: clip.duration,
                        effects: clipEffects
                    };
                })
                .filter((item): item is { url: string; type: 'image' | 'video'; duration: number; effects: any[] } => item !== null && item !== undefined);

            // Combine stickers from all clips
            const allStickers: StickerOverlay[] = [];
            activeClips.forEach(clip => {
                const clipStickers = stickers.get(clip.id) || [];
                allStickers.push(...clipStickers);
            });

            // Create post with all clips' media as a carousel
            const taggedUsersToPass = taggedUsers && Array.isArray(taggedUsers) && taggedUsers.length > 0 ? taggedUsers : undefined;

            await createPost(
                user.id,
                user.handle,
                text.trim(),
                locationLabel.trim(),
                allMediaItems[0]?.url, // First media for backward compatibility
                allMediaItems[0]?.type, // First media type for backward compatibility
                undefined, // imageText
                text.trim() || undefined, // caption
                user.local,
                user.regional,
                user.national,
                allStickers.length > 0 ? allStickers : undefined, // Pass all stickers
                template?.id || undefined, // templateId
                allMediaItems.filter(item => item !== null) as Array<{ url: string; type: 'image' | 'video'; duration?: number }>, // Pass all media items for carousel
                bannerText.trim() || undefined, // bannerText
                undefined, // textStyle
                taggedUsersToPass, // taggedUsers
                captionsEnabled, // videoCaptionsEnabled
                videoCaptionText.trim() || undefined, // videoCaptionText
                subtitlesEnabled, // subtitlesEnabled
                subtitleText.trim() || undefined // subtitleText
            );

            // Dispatch event to refresh feed
            window.dispatchEvent(new CustomEvent('postCreated'));

            // Navigate back to feed
            navigate('/feed');
        } catch (error) {
            console.error('Error creating video from template:', error);
            alert('Failed to create video. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    }

    const currentMedia = currentClip ? userMedia.get(currentClip.id) : null;
    const currentStickers = currentClip ? stickers.get(currentClip.id) || [] : [];
    const progress = ((currentClipIndex + 1) / activeClips.length) * 100;
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        if (mediaContainerRef.current) {
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
    }, [currentMedia]);

    function handleSelectSticker(sticker: Sticker) {
        if (!currentClip) return;

        const newOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random()}`,
            stickerId: sticker.id,
            sticker,
            x: 50, // Center position
            y: 50,
            scale: 1,
            rotation: 0,
            opacity: 1
        };

        setStickers(prev => {
            const newMap = new Map(prev);
            const clipStickers = newMap.get(currentClip.id) || [];
            newMap.set(currentClip.id, [...clipStickers, newOverlay]);
            return newMap;
        });

        setSelectedStickerOverlay(newOverlay.id);
    }

    function handleAddTextSticker(text: string, fontSize: 'small' | 'medium' | 'large', color: string) {
        if (!currentClip) return;

        // Create a text sticker
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
            sticker: {
                ...textSticker,
                // Store custom properties in the sticker name for now
                // In production, you'd have a proper text property
            },
            x: 50,
            y: 50,
            scale: fontSize === 'small' ? 0.8 : fontSize === 'medium' ? 1 : 1.2,
            rotation: 0,
            opacity: 1
        };

        // Store text and color in a way we can access it
        // We'll use a custom property approach
        (newOverlay as any).textContent = text;
        (newOverlay as any).textColor = color;
        (newOverlay as any).fontSize = fontSize;

        setStickers(prev => {
            const newMap = new Map(prev);
            const clipStickers = newMap.get(currentClip.id) || [];
            newMap.set(currentClip.id, [...clipStickers, newOverlay]);
            return newMap;
        });

        setSelectedStickerOverlay(newOverlay.id);
    }

    function handleUpdateSticker(clipId: string, overlayId: string, updated: StickerOverlay) {
        setStickers(prev => {
            const newMap = new Map(prev);
            const clipStickers = newMap.get(clipId) || [];
            const index = clipStickers.findIndex(s => s.id === overlayId);
            if (index !== -1) {
                clipStickers[index] = updated;
                newMap.set(clipId, [...clipStickers]);
            }
            return newMap;
        });
    }

    function handleRemoveSticker(clipId: string, overlayId: string) {
        setStickers(prev => {
            const newMap = new Map(prev);
            const clipStickers = newMap.get(clipId) || [];
            newMap.set(clipId, clipStickers.filter(s => s.id !== overlayId));
            return newMap;
        });
        if (selectedStickerOverlay === overlayId) {
            setSelectedStickerOverlay(null);
        }
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-gray-800">
                <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2"
                        aria-label="Back"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    <div className="flex-1 mx-4">
                        {currentStep === 'media' ? (
                            <>
                                <div className="text-sm text-gray-400 mb-1">
                                    Clip {currentClipIndex + 1} of {activeClips.length} {isTopTemplate && `(Max ${MAX_CLIPS})`}
                                </div>
                                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-white transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </>
                        ) : currentStep === 'stickers' ? (
                            <div className="text-sm font-medium text-white">
                                Add Stickers
                            </div>
                        ) : (
                            <div className="text-sm font-medium text-white">
                                Post Details
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                    </div>
                </div>
            </div>

            {showPinnedNext && (
                <div className="fixed bottom-0 left-0 right-0 z-40">
                    <div className="mx-auto max-w-md px-4 pt-3 pb-4">
                        <div className="rounded-xl bg-black/85 backdrop-blur border border-white/10 p-2 shadow-lg">
                            <div className="flex items-center gap-2">
                                {/* Add Another Clip Button - Left */}
                                {isTopTemplate && activeClips.length < MAX_CLIPS && (
                                    <button
                                        onClick={handleAddClip}
                                        className="flex-1 py-2.5 bg-black text-white border border-white/40 rounded-lg text-sm font-semibold hover:bg-black/80 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <FiPlus className="w-1.5 h-1.5" />
                                        <span style={buttonTextStyle} className="text-sm">Add Another Clip ({activeClips.length}/{MAX_CLIPS})</span>
                                    </button>
                                )}

                                {/* Next Button - Right */}
                                <button
                                    onClick={() => {
                                        // Skip stickers step for Instagram and TikTok templates
                                        if (template?.id === TEMPLATE_IDS.INSTAGRAM || template?.id === TEMPLATE_IDS.TIKTOK) {
                                            setCurrentStep('details');
                                        } else {
                                            setCurrentStep('stickers');
                                        }
                                    }}
                                    className={`py-2.5 bg-black text-white border border-white/40 rounded-lg text-sm font-semibold hover:bg-black/80 transition-colors flex items-center justify-center gap-1.5 ${isTopTemplate && activeClips.length < MAX_CLIPS ? 'px-4' : 'w-full'}`}
                                >
                                    <span style={buttonTextStyle} className="text-sm">Next</span>
                                    <svg className="w-1.5 h-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Post Now Button - Pinned Footer (Details Step Only) */}
            {currentStep === 'details' && (
                <div className="fixed bottom-0 left-0 right-0 z-40">
                    <div className="mx-auto max-w-md px-4 pt-3 pb-4">
                        <div className="rounded-xl bg-black/85 backdrop-blur border border-white/10 p-2 shadow-lg">
                            <button
                                onClick={handleCreateVideo}
                                disabled={userMedia.size === 0 || isProcessing}
                                className="w-full py-2.5 bg-black text-white border border-white/40 rounded-lg text-sm font-semibold hover:bg-black/80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm">Creating...</span>
                                    </>
                                ) : (
                                    <>
                                        <span style={buttonTextStyle} className="text-sm">Post Now</span>
                                        <svg className="w-1.5 h-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`max-w-md mx-auto px-4 py-4 ${showPinnedNext || currentStep === 'details' ? 'pb-40' : 'pb-24'}`}>
                {currentStep === 'media' ? (
                    <>
                        {/* Step 1: Add Media */}
                        {/* Current Clip Preview - Clean and Simple */}
                        <div className="mb-6">
                            {currentMedia ? (
                                <div className="flex items-center justify-center gap-4">
                                    {activeClips.length > 1 && (
                                        <button
                                            onClick={handlePrevious}
                                            disabled={!canGoPrevious}
                                            className={`p-3 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 transition-colors ${!canGoPrevious ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <FiChevronLeft className="w-5 h-5 text-white" />
                                            <span className="sr-only">Previous clip</span>
                                        </button>
                                    )}
                                    <div
                                        ref={mediaContainerRef}
                                        className="relative aspect-[9/16] max-h-[55vh] rounded-2xl overflow-hidden bg-gray-900 mx-auto shadow-lg"
                                        onClick={(e) => {
                                            // Deselect sticker when clicking on media
                                            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).tagName === 'IMG') {
                                                setSelectedStickerOverlay(null);
                                            }
                                        }}
                                    >
                                        {/* Apply effects from template clip */}
                                        {(() => {
                                            // Get effects from template clip if it exists, otherwise empty array
                                            const clipEffects: any[] = 'effects' in currentClip && Array.isArray(currentClip.effects) ? currentClip.effects : [];

                                            let mediaElement: React.ReactNode = currentMedia.mediaType === 'video' ? (
                                                <video
                                                    src={currentMedia.url}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                    autoPlay
                                                    loop
                                                    muted
                                                />
                                            ) : (
                                                <img
                                                    src={currentMedia.url}
                                                    alt={`Clip ${currentClipIndex + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            );

                                            // Apply effects in reverse order (last effect wraps everything)
                                            clipEffects.forEach((effect: EffectConfig) => {
                                                mediaElement = (
                                                    <EffectWrapper key={effect.type} effect={effect} isActive={true}>
                                                        {mediaElement}
                                                    </EffectWrapper>
                                                );
                                            });

                                            return mediaElement;
                                        })()}

                                        {/* Show active effects indicator */}
                                        {(() => {
                                            const hasEffects = 'effects' in (currentClip || {}) && currentClip && 'effects' in currentClip && Array.isArray(currentClip.effects) && currentClip.effects.length > 0;
                                            return hasEffects ? (
                                                <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1">
                                                    {Array.isArray(currentClip.effects) && currentClip.effects.map((effect: EffectConfig, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className="px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded-full"
                                                            title={`${effect.type}${effect.colorGrading ? ` - ${effect.colorGrading}` : ''}`}
                                                        >
                                                            {effect.type === 'color-grading' && effect.colorGrading ? (
                                                                <span className="capitalize">{effect.colorGrading.replace('-', ' ')}</span>
                                                            ) : (
                                                                <span className="capitalize">{effect.type.replace('-', ' ')}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}

                                        {/* Sticker Overlays */}
                                        {currentStickers.map((overlay) => (
                                            <StickerOverlayComponent
                                                key={overlay.id}
                                                overlay={overlay}
                                                onUpdate={(updated) => handleUpdateSticker(currentClip?.id || '', overlay.id, updated)}
                                                onRemove={() => handleRemoveSticker(currentClip?.id || '', overlay.id)}
                                                isSelected={selectedStickerOverlay === overlay.id}
                                                onSelect={() => setSelectedStickerOverlay(overlay.id)}
                                                containerWidth={containerSize.width || 400}
                                                containerHeight={containerSize.height || 711}
                                            />
                                        ))}

                                        <button
                                            onClick={() => handleRemoveMedia(currentClip?.id || '')}
                                            className="absolute top-3 right-3 p-2 bg-black/70 backdrop-blur-sm text-white rounded-full hover:bg-black/90 transition-colors z-10"
                                        >
                                            <FiX className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {activeClips.length > 1 && (
                                        <button
                                            onClick={handleNext}
                                            disabled={!canGoNext}
                                            className={`p-3 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 transition-colors ${!canGoNext ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <FiChevronRight className="w-5 h-5 text-white" />
                                            <span className="sr-only">Next clip</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-4">
                                    {activeClips.length > 1 && (
                                        <button
                                            onClick={handlePrevious}
                                            disabled={!canGoPrevious}
                                            className={`p-3 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 transition-colors ${!canGoPrevious ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <FiChevronLeft className="w-5 h-5 text-white" />
                                            <span className="sr-only">Previous clip</span>
                                        </button>
                                    )}
                                    <label className={`block aspect-[9/16] max-h-[55vh] rounded-2xl cursor-pointer mx-auto bg-gray-900/30 transition-colors ${template.id === TEMPLATE_IDS.INSTAGRAM
                                        ? 'ig-animated-border'
                                        : template.id === TEMPLATE_IDS.TIKTOK
                                            ? 'tt-animated-border'
                                            : template.id === TEMPLATE_IDS.GAZETTEER
                                                ? 'gz-animated-border'
                                                : 'border-2 border-dashed border-gray-700 hover:border-gray-600'
                                        }`}>
                                        <input
                                            type="file"
                                            accept={isTopTemplate ? 'image/*,video/mp4,.mp4' : (currentClip?.mediaType === 'video' ? 'video/mp4,.mp4' : 'image/*')}
                                            onChange={(e) => handleMediaSelect(currentClip?.id || '', e)}
                                            className="hidden"
                                        />
                                        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                                            {isTopTemplate ? (
                                                <>
                                                    <FiImage className="w-12 h-12 text-gray-500 mb-4" />
                                                    <div className="text-white text-lg font-semibold mb-2">
                                                        Add Photo or Video
                                                    </div>
                                                    <div className="text-gray-400 text-sm">
                                                        Tap to select image or MP4 video
                                                    </div>
                                                    <div className="text-gray-500 text-xs mt-2">
                                                        {activeClips.length === 1 ? `Add ${MIN_CLIPS}-${MAX_CLIPS} items` : `Add up to ${MAX_CLIPS - activeClips.length} more`}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {currentClip?.mediaType === 'video' ? (
                                                        <FiVideo className="w-12 h-12 text-gray-500 mb-4" />
                                                    ) : (
                                                        <FiImage className="w-12 h-12 text-gray-500 mb-4" />
                                                    )}
                                                    <div className="text-white text-lg font-semibold mb-2">
                                                        Add {currentClip?.mediaType === 'video' ? 'Video (MP4 only)' : 'Photo'}
                                                    </div>
                                                    <div className="text-gray-400 text-sm">
                                                        {currentClip?.mediaType === 'video' ? 'Tap to select MP4 video' : 'Tap to select from gallery'}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                    {activeClips.length > 1 && (
                                        <button
                                            onClick={handleNext}
                                            disabled={!canGoNext}
                                            className={`p-3 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 transition-colors ${!canGoNext ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <FiChevronRight className="w-5 h-5 text-white" />
                                            <span className="sr-only">Next clip</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Clip Navigation - Simple Dots */}
                        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                            {activeClips.map((clip, index) => {
                                const media = userMedia.get(clip.id);
                                const isCurrent = index === currentClipIndex;
                                return (
                                    <button
                                        key={clip.id}
                                        onClick={() => setCurrentClipIndex(index)}
                                        className={`w-2 h-2 rounded-full transition-all ${isCurrent
                                            ? 'bg-white w-8'
                                            : media
                                                ? 'bg-gray-500'
                                                : 'bg-gray-700'
                                            }`}
                                        aria-label={`Go to clip ${index + 1}`}
                                    />
                                );
                            })}
                        </div>

                    </>
                ) : currentStep === 'stickers' ? (
                    <>
                        {/* Step 2: Add Stickers */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => setCurrentStep('media')}
                                    className="p-2 rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2"
                                    aria-label="Back to media"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    <span className="text-sm font-medium">Back</span>
                                </button>
                                <div className="text-sm text-gray-400">
                                    Step 2 of 3
                                </div>
                            </div>

                            <h2 className="text-xl font-semibold text-white mb-6">Add Stickers</h2>
                        </div>

                        {/* Add Stickers Section */}
                        <div className="mb-6">
                            <div className="mb-4">
                                <div className="text-sm text-gray-400 mb-3">
                                    Select a clip to add stickers
                                </div>
                                {/* Clip Thumbnails for Sticker Selection */}
                                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                    {activeClips.map((clip, index) => {
                                        const media = userMedia.get(clip.id);
                                        const clipStickers = stickers.get(clip.id) || [];
                                        const isSelected = index === currentClipIndex;

                                        return (
                                            <button
                                                key={clip.id}
                                                onClick={() => setCurrentClipIndex(index)}
                                                className={`flex-shrink-0 aspect-[9/16] w-20 rounded-lg overflow-hidden relative ${isSelected ? 'ring-2 ring-white' : 'ring-1 ring-gray-700'
                                                    }`}
                                            >
                                                {media ? (
                                                    media.mediaType === 'video' ? (
                                                        <video
                                                            src={media.url}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                            playsInline
                                                            preload="metadata"
                                                        />
                                                    ) : (
                                                        <img
                                                            src={media.url}
                                                            alt={`Clip ${index + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )
                                                ) : (
                                                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                                        <FiPlus className="w-4 h-4 text-gray-600" />
                                                    </div>
                                                )}
                                                {clipStickers.length > 0 && (
                                                    <div className="absolute top-1 right-1 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center text-xs font-semibold text-white">
                                                        {clipStickers.length}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Current Clip Preview with Stickers */}
                            {currentMedia && (
                                <div className="mb-4">
                                    <div
                                        ref={mediaContainerRef}
                                        className="relative aspect-[9/16] max-h-[50vh] rounded-xl overflow-hidden bg-gray-900 mx-auto shadow-lg"
                                        onClick={(e) => {
                                            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).tagName === 'IMG') {
                                                setSelectedStickerOverlay(null);
                                            }
                                        }}
                                    >
                                        {/* Apply effects from template clip */}
                                        {(() => {
                                            // Get effects from template clip if it exists, otherwise empty array
                                            const clipEffects: any[] = 'effects' in currentClip && Array.isArray(currentClip.effects) ? currentClip.effects : [];
                                            let mediaElement: React.ReactNode = currentMedia.mediaType === 'video' ? (
                                                <video
                                                    src={currentMedia.url}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                    autoPlay
                                                    loop
                                                    muted
                                                />
                                            ) : (
                                                <img
                                                    src={currentMedia.url}
                                                    alt={`Clip ${currentClipIndex + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            );

                                            // Apply effects in reverse order (last effect wraps everything)
                                            clipEffects.forEach((effect: EffectConfig) => {
                                                mediaElement = (
                                                    <EffectWrapper key={effect.type} effect={effect} isActive={true}>
                                                        {mediaElement}
                                                    </EffectWrapper>
                                                );
                                            });

                                            return mediaElement;
                                        })()}

                                        {/* Show active effects indicator */}
                                        {(() => {
                                            const hasEffects = 'effects' in (currentClip || {}) && currentClip && 'effects' in currentClip && Array.isArray(currentClip.effects) && currentClip.effects.length > 0;
                                            if (!hasEffects) return null;
                                            return (
                                                <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1">
                                                    {Array.isArray(currentClip.effects) && currentClip.effects.map((effect: EffectConfig, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className="px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded-full"
                                                            title={`${effect.type}${effect.colorGrading ? ` - ${effect.colorGrading}` : ''}`}
                                                        >
                                                            {effect.type === 'color-grading' && effect.colorGrading ? (
                                                                <span className="capitalize">{effect.colorGrading.replace('-', ' ')}</span>
                                                            ) : (
                                                                <span className="capitalize">{effect.type.replace('-', ' ')}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                        {/* Sticker Overlays */}
                                        {currentStickers.map((overlay) => (
                                            <StickerOverlayComponent
                                                key={overlay.id}
                                                overlay={overlay}
                                                onUpdate={(updated) => handleUpdateSticker(currentClip.id, overlay.id, updated)}
                                                onRemove={() => handleRemoveSticker(currentClip.id, overlay.id)}
                                                isSelected={selectedStickerOverlay === overlay.id}
                                                onSelect={() => setSelectedStickerOverlay(overlay.id)}
                                                containerWidth={containerSize.width || 400}
                                                containerHeight={containerSize.height || 711}
                                            />
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setShowStickerPicker(true)}
                                        className="w-full mt-3 py-3 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FiSmile className="w-5 h-5" />
                                        <span>Add Stickers to Clip {currentClipIndex + 1}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Next Button */}
                        <div className="mt-6">
                            <button
                                onClick={() => setCurrentStep('details')}
                                className="w-full py-4 bg-white text-black rounded-xl text-base font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                            >
                                <span>Next</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Step 3: Post Details */}
                        {/* Post Details - Simple and Clean */}
                        <div className="space-y-4 mb-6">
                            {/* Caption */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Caption
                                </label>
                                <div className="relative rounded-xl">
                                    {/* Outer glow animation */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-60 blur-sm animate-pulse"></div>
                                    {/* Shimmer sweep */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                        <div
                                            className="absolute inset-0 rounded-xl"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 3s linear infinite'
                                            }}
                                        ></div>
                                    </div>
                                    <textarea
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        placeholder="Start typing"
                                        className="relative w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-800 focus:outline-none focus:ring-2 focus:ring-white resize-none text-sm"
                                        rows={3}
                                        maxLength={500}
                                    />
                                </div>
                                <div className="text-right text-xs text-gray-500 mt-1">
                                    {text.length}/500
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Location
                                </label>
                                <div className="relative rounded-xl">
                                    {/* Outer glow animation */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-60 blur-sm animate-pulse"></div>
                                    {/* Shimmer sweep */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                        <div
                                            className="absolute inset-0 rounded-xl"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 3s linear infinite'
                                            }}
                                        ></div>
                                    </div>
                                    <input
                                        type="text"
                                        value={locationLabel}
                                        onChange={(e) => setLocationLabel(e.target.value)}
                                        placeholder="Where did this happen?"
                                        className="relative w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-800 focus:outline-none focus:ring-2 focus:ring-white text-sm"
                                    />
                                </div>
                            </div>

                            {/* Banner Text */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    News Ticker Banner
                                </label>
                                <div className="relative rounded-xl">
                                    {/* Outer glow animation */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-60 blur-sm animate-pulse"></div>
                                    {/* Shimmer sweep */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                        <div
                                            className="absolute inset-0 rounded-xl"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 3s linear infinite'
                                            }}
                                        ></div>
                                    </div>
                                    <input
                                        type="text"
                                        value={bannerText}
                                        onChange={(e) => setBannerText(e.target.value)}
                                        placeholder="Enter scrolling banner text..."
                                        maxLength={200}
                                        className="relative w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-800 focus:outline-none focus:ring-2 focus:ring-white text-sm"
                                    />
                                </div>
                                <div className="text-right text-xs text-gray-500 mt-1">
                                    {bannerText.length}/200
                                </div>
                            </div>

                            {/* Tag People */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                    <FiUser className="w-4 h-4" />
                                    Tag People
                                </label>
                                <button
                                    onClick={() => setShowUserTagging(true)}
                                    className={`w-full p-3 rounded-xl border-2 transition-colors flex items-center justify-between text-sm ${taggedUsers.length > 0
                                        ? 'bg-brand-500/20 border-brand-500 text-white hover:bg-brand-500/30'
                                        : 'bg-gray-900 text-white border-gray-800 hover:bg-gray-800 hover:border-gray-700'
                                        }`}
                                >
                                    <span className={taggedUsers.length > 0 ? 'font-medium' : ''}>
                                        {taggedUsers.length > 0
                                            ? `${taggedUsers.length} ${taggedUsers.length === 1 ? 'person' : 'people'} tagged`
                                            : 'Tap to tag people'}
                                    </span>
                                    {taggedUsers.length > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            {taggedUsers.slice(0, 2).map((handle) => (
                                                <div key={handle} className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-xs font-semibold text-white">
                                                    {handle.charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                            {taggedUsers.length > 2 && (
                                                <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-xs font-semibold text-white">
                                                    +{taggedUsers.length - 2}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </button>
                            </div>

                            {/* Video Captions - Only for Instagram, TikTok, and Gazetteer */}
                            {(template?.id === TEMPLATE_IDS.INSTAGRAM || template?.id === TEMPLATE_IDS.TIKTOK || template?.id === TEMPLATE_IDS.GAZETTEER) && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setCaptionsEnabled(!captionsEnabled)}
                                                className={`p-1.5 rounded-lg transition-colors ${captionsEnabled
                                                    ? 'bg-brand-500 text-white'
                                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                    }`}
                                                aria-label="Toggle captions"
                                            >
                                                <FiType className="w-4 h-4" />
                                            </button>
                                            <span>Video Captions</span>
                                            <span className={`text-xs ml-auto ${captionsEnabled ? 'text-brand-400' : 'text-gray-500'}`}>
                                                {captionsEnabled ? 'ON' : 'OFF'}
                                            </span>
                                        </label>
                                        {captionsEnabled && (
                                            <div className="relative rounded-xl">
                                                {/* Outer glow animation */}
                                                <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-60 blur-sm animate-pulse"></div>
                                                {/* Shimmer sweep */}
                                                <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                                    <div
                                                        className="absolute inset-0 rounded-xl"
                                                        style={{
                                                            background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 3s linear infinite'
                                                        }}
                                                    ></div>
                                                </div>
                                                <textarea
                                                    value={videoCaptionText}
                                                    onChange={(e) => setVideoCaptionText(e.target.value)}
                                                    placeholder="Enter caption text to display on video..."
                                                    className="relative w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-800 focus:outline-none focus:ring-2 focus:ring-white resize-none text-sm"
                                                    rows={3}
                                                    maxLength={500}
                                                />
                                            </div>
                                        )}
                                        {captionsEnabled && (
                                            <div className="text-right text-xs text-gray-500 mt-1">
                                                {videoCaptionText.length}/500
                                            </div>
                                        )}
                                    </div>

                                    {/* Video Subtitles - Only for Instagram, TikTok, and Gazetteer */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const newEnabled = !subtitlesEnabled;
                                                    setSubtitlesEnabled(newEnabled);

                                                    // Auto-transcribe when enabling subtitles if video exists and no text yet
                                                    if (newEnabled && !subtitleText) {
                                                        const currentClip = activeClips[currentClipIndex] || activeClips[0];
                                                        const media = currentClip ? userMedia.get(currentClip.id) : null;

                                                        if (media && media.mediaType === 'video' && media.url) {
                                                            setIsTranscribing(true);
                                                            try {
                                                                const transcription = await transcribeVideo(media.url);
                                                                if (transcription) {
                                                                    setSubtitleText(transcription);
                                                                }
                                                            } catch (error) {
                                                                console.error('Transcription error:', error);
                                                            } finally {
                                                                setIsTranscribing(false);
                                                            }
                                                        }
                                                    }
                                                }}
                                                className={`p-1.5 rounded-lg transition-colors ${subtitlesEnabled
                                                    ? 'bg-brand-500 text-white'
                                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                    }`}
                                                aria-label="Toggle subtitles"
                                            >
                                                <FiMessageSquare className="w-4 h-4" />
                                            </button>
                                            <span>Video Subtitles</span>
                                            <span className={`text-xs ml-auto ${subtitlesEnabled ? 'text-brand-400' : 'text-gray-500'}`}>
                                                {subtitlesEnabled ? 'ON' : 'OFF'}
                                            </span>
                                        </label>
                                        {isTranscribing && (
                                            <div className="mb-2 text-sm text-brand-400 flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"></div>
                                                <span>Generating subtitles...</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Sticker Picker Modal */}
            <StickerPicker
                isOpen={showStickerPicker}
                onClose={() => setShowStickerPicker(false)}
                onSelectSticker={handleSelectSticker}
                onAddText={() => setShowTextStickerModal(true)}
            />

            {/* Text Sticker Modal */}
            <TextStickerModal
                isOpen={showTextStickerModal}
                onClose={() => setShowTextStickerModal(false)}
                onConfirm={(text, fontSize, color) => {
                    handleAddTextSticker(text, fontSize, color);
                    setShowTextStickerModal(false);
                }}
            />

            {/* User Tagging Modal */}
            <UserTaggingModal
                isOpen={showUserTagging}
                onClose={() => setShowUserTagging(false)}
                onSelectUser={(handle) => {
                    if (!taggedUsers.includes(handle)) {
                        const newTaggedUsers = [...taggedUsers, handle];
                        setTaggedUsers(newTaggedUsers);
                    }
                }}
                taggedUsers={taggedUsers}
            />
        </div>
    );
}

