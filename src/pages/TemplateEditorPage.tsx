import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiCheck, FiImage, FiVideo, FiPlus, FiSmile } from 'react-icons/fi';
import { VideoTemplate, TemplateClip, StickerOverlay, Sticker } from '../types';
import { incrementTemplateUsage } from '../api/templates';
import { createPost } from '../api/posts';
import { useAuth } from '../context/Auth';
import StickerPicker from '../components/StickerPicker';
import StickerOverlayComponent from '../components/StickerOverlay';
import TextStickerModal from '../components/TextStickerModal';

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
    const [stickers, setStickers] = React.useState<Map<string, StickerOverlay[]>>(new Map()); // clipId -> stickers
    const [showStickerPicker, setShowStickerPicker] = React.useState(false);
    const [showTextStickerModal, setShowTextStickerModal] = React.useState(false);
    const [selectedStickerOverlay, setSelectedStickerOverlay] = React.useState<string | null>(null);
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!template) {
            navigate('/templates');
        }
    }, [template, navigate]);

    if (!template) {
        return null;
    }

    const currentClip = template.clips[currentClipIndex];
    const allClipsFilled = template.clips.every(clip => userMedia.has(clip.id));

    function handleMediaSelect(clipId: string, event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target?.result as string;
            const mediaType = file.type.startsWith('image/') ? 'image' : 'video';

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

            // Auto-advance to next clip if available
            const currentIndex = template.clips.findIndex(c => c.id === clipId);
            if (currentIndex < template.clips.length - 1) {
                setTimeout(() => {
                    setCurrentClipIndex(currentIndex + 1);
                }, 300);
            }
        };
        reader.readAsDataURL(file);
    }

    function handleNext() {
        if (currentClipIndex < template.clips.length - 1) {
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

    async function handleCreateVideo() {
        if (!allClipsFilled || !user) return;

        setIsProcessing(true);
        try {
            // Increment template usage
            await incrementTemplateUsage(template.id);

            // For now, we'll use the first clip's media as the main post media
            // In a full implementation, you'd combine all clips into a single video
            const firstMedia = Array.from(userMedia.values())[0];
            if (!firstMedia) return;

            // Collect all media items from all clips in order
            const allMediaItems = template.clips
                .map(clip => {
                    const media = userMedia.get(clip.id);
                    if (!media) return null;
                    return {
                        url: media.url,
                        type: media.mediaType,
                        duration: clip.duration
                    };
                })
                .filter((item): item is { url: string; type: 'image' | 'video'; duration: number } => item !== null);

            // Combine stickers from all clips
            const allStickers: StickerOverlay[] = [];
            template.clips.forEach(clip => {
                const clipStickers = stickers.get(clip.id) || [];
                allStickers.push(...clipStickers);
            });

            // Create post with all clips' media as a carousel
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
                template.id, // templateId
                allMediaItems // Pass all media items for carousel
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
    const progress = ((currentClipIndex + 1) / template.clips.length) * 100;
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
                        className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                        aria-label="Back"
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                    <div className="flex-1 mx-4">
                        <div className="text-sm text-gray-400 mb-1">
                            Clip {currentClipIndex + 1} of {template.clips.length}
                        </div>
                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleCreateVideo}
                        disabled={!allClipsFilled || isProcessing}
                        className="px-4 py-1.5 bg-white text-black rounded-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Creating...</span>
                            </>
                        ) : (
                            <>
                                <FiCheck className="w-4 h-4" />
                                <span>Create</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-md mx-auto px-4 py-6">
                {/* Current Clip Preview/Media Selector */}
                <div className="mb-6">
                    {currentMedia ? (
                        <div
                            ref={mediaContainerRef}
                            className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-900"
                            onClick={(e) => {
                                // Deselect sticker when clicking on media
                                if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).tagName === 'IMG') {
                                    setSelectedStickerOverlay(null);
                                }
                            }}
                        >
                            {currentMedia.mediaType === 'video' ? (
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
                            )}

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

                            {/* Sticker Button */}
                            <button
                                onClick={() => setShowStickerPicker(true)}
                                className="absolute bottom-2 right-2 p-3 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors shadow-lg"
                                title="Add Sticker"
                            >
                                <FiSmile className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => handleRemoveMedia(currentClip.id)}
                                className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors z-10"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                                {currentClip.duration}ms
                            </div>
                        </div>
                    ) : (
                        <label className="block aspect-[9/16] rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                            <input
                                type="file"
                                accept={currentClip.mediaType === 'video' ? 'video/*' : 'image/*'}
                                onChange={(e) => handleMediaSelect(currentClip.id, e)}
                                className="hidden"
                            />
                            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                                {currentClip.mediaType === 'video' ? (
                                    <FiVideo className="w-12 h-12 text-gray-500 mb-4" />
                                ) : (
                                    <FiImage className="w-12 h-12 text-gray-500 mb-4" />
                                )}
                                <div className="text-white font-medium mb-2">
                                    Add {currentClip.mediaType === 'video' ? 'Video' : 'Photo'}
                                </div>
                                <div className="text-gray-400 text-sm mb-1">
                                    Duration: {currentClip.duration}ms
                                </div>
                                <div className="text-gray-500 text-xs">
                                    Tap to select from gallery
                                </div>
                            </div>
                        </label>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex gap-3 mb-6">
                    <button
                        onClick={handlePrevious}
                        disabled={currentClipIndex === 0}
                        className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={currentClipIndex === template.clips.length - 1}
                        className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                        Next
                    </button>
                </div>

                {/* Clips Overview */}
                <div className="mb-6">
                    <div className="text-sm font-medium text-gray-400 mb-3">
                        Clips Overview ({userMedia.size}/{template.clips.length} filled)
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {template.clips.map((clip, index) => {
                            const media = userMedia.get(clip.id);
                            const isCurrent = index === currentClipIndex;

                            return (
                                <button
                                    key={clip.id}
                                    onClick={() => setCurrentClipIndex(index)}
                                    className={`aspect-[9/16] rounded-lg overflow-hidden relative ${isCurrent ? 'ring-2 ring-white' : ''
                                        } ${media ? '' : 'border-2 border-dashed border-gray-700'}`}
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
                                            <FiPlus className="w-6 h-6 text-gray-600" />
                                        </div>
                                    )}
                                    {media && (
                                        <div className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Caption Input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Caption
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Write a caption..."
                        className="w-full p-3 bg-gray-900 text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-white resize-none"
                        rows={3}
                        maxLength={500}
                    />
                    <div className="text-right text-xs text-gray-500 mt-1">
                        {text.length}/500
                    </div>
                </div>

                {/* Location Input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Location
                    </label>
                    <input
                        type="text"
                        value={locationLabel}
                        onChange={(e) => setLocationLabel(e.target.value)}
                        placeholder="Where did this happen?"
                        className="w-full p-3 bg-gray-900 text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-white"
                    />
                </div>
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
        </div>
    );
}

