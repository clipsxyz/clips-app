import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiSmile, FiSettings, FiType, FiUser, FiHome } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { createPost } from '../api/posts';
import { showToast } from '../utils/toast';
import GifPicker from '../components/GifPicker';
import UserTaggingModal from '../components/UserTaggingModal';
import StickerPicker from '../components/StickerPicker';
import type { StickerOverlay, Sticker } from '../types';
import StickerOverlayComponent from '../components/StickerOverlay';

export default function TextOnlyPostPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const [text, setText] = useState('');
    const [showTextEditor, setShowTextEditor] = useState(false);
    const [textColor, setTextColor] = useState('white');
    const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
    const [background, setBackground] = useState<string>('linear-gradient(to bottom right, #ef4444, #f97316, #fbbf24)');
    const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
    const [showTextColorPicker, setShowTextColorPicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [gifOverlays, setGifOverlays] = useState<StickerOverlay[]>([]);
    const [selectedGifOverlay, setSelectedGifOverlay] = useState<string | null>(null);
    const [showUserTagging, setShowUserTagging] = useState(false);
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        // Focus text input when component mounts
        if (textInputRef.current) {
            textInputRef.current.focus();
        }
    }, []);

    // Update container size for GIF overlays
    useEffect(() => {
        if (containerRef.current) {
            const updateSize = () => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                    setContainerSize({ width: rect.width, height: rect.height });
                }
            };
            updateSize();
            const resizeObserver = new ResizeObserver(updateSize);
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    // Handle adding GIF as overlay
    const handleAddGif = (gifUrl: string) => {
        const gifOverlay: StickerOverlay = {
            id: `gif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            stickerId: `gif-${gifUrl}`,
            sticker: {
                id: `gif-${gifUrl}`,
                name: 'GIF',
                category: 'GIF',
                url: gifUrl,
                isAnimated: true
            },
            x: 50, // Center position
            y: 50,
            scale: 1.5, // Larger default size for GIFs
            rotation: 0,
            opacity: 1.0
        };
        setGifOverlays([...gifOverlays, gifOverlay]);
        setSelectedGifOverlay(gifOverlay.id);
    };

    // Handle updating GIF overlay
    const handleUpdateGifOverlay = (overlayId: string, updated: StickerOverlay) => {
        setGifOverlays(gifOverlays.map(overlay => overlay.id === overlayId ? updated : overlay));
    };

    // Handle removing GIF overlay
    const handleRemoveGifOverlay = (overlayId: string) => {
        setGifOverlays(gifOverlays.filter(overlay => overlay.id !== overlayId));
        if (selectedGifOverlay === overlayId) {
            setSelectedGifOverlay(null);
        }
    };

    // Handle adding sticker as overlay
    const handleSelectSticker = (sticker: Sticker) => {
        const stickerOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            stickerId: sticker.id,
            sticker: sticker,
            x: 50, // Center position
            y: 50,
            scale: 1.0,
            rotation: 0,
            opacity: 1.0
        };
        setGifOverlays([...gifOverlays, stickerOverlay]);
        setSelectedGifOverlay(stickerOverlay.id);
    };

    const handleSubmit = async () => {
        if (!text.trim() && gifOverlays.length === 0) {
            showToast('Please add some text or a GIF to your post');
            return;
        }
        if (!user) {
            showToast('Please log in to create a post');
            return;
        }

        setIsSubmitting(true);
        try {
            await createPost(
                user.id,
                user.handle,
                text.trim() || '', // text
                '', // location
                undefined, // imageUrl (no longer using this for GIFs)
                undefined, // mediaType
                undefined, // imageText
                undefined, // caption
                user.local,
                user.regional,
                user.national,
                gifOverlays.length > 0 ? gifOverlays : undefined, // stickers (GIFs stored as stickers)
                undefined, // templateId
                undefined, // mediaItems
                undefined, // bannerText
                text.trim() ? { color: textColor, size: textSize, background: background } : undefined, // textStyle (only if text exists)
                taggedUsers.length > 0 ? taggedUsers : undefined // taggedUsers
            );

            window.dispatchEvent(new CustomEvent('postCreated'));
            showToast('Post created successfully!');
            navigate('/feed');
        } catch (error) {
            console.error('Error creating post:', error);
            showToast('Failed to create post. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTextSizeClass = () => {
        switch (textSize) {
            case 'small':
                return 'text-2xl';
            case 'medium':
                return 'text-4xl';
            case 'large':
                return 'text-6xl';
            default:
                return 'text-4xl';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-red-500 via-orange-500 to-yellow-400">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm">
                <button
                    onClick={() => navigate('/feed')}
                    className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Close"
                >
                    <FiX className="w-6 h-6" />
                </button>
                <button
                    onClick={() => setShowStickerPicker(true)}
                    className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Stickers"
                >
                    <FiSmile className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
                    className="px-3 py-1.5 text-white hover:bg-white/10 rounded-full transition-colors text-sm font-medium"
                    aria-label="Background Settings"
                >
                    Background
                </button>
            </div>

            {/* Main Content Area */}
            <div 
                ref={containerRef}
                className="flex-1 flex items-center justify-center relative overflow-hidden"
                style={{
                    background: background.includes('gradient') 
                        ? undefined 
                        : background,
                    backgroundImage: background.includes('gradient') 
                        ? background 
                        : undefined
                }}
                onClick={(e) => {
                    // Deselect GIF overlay when clicking on background
                    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
                        setSelectedGifOverlay(null);
                    }
                }}
            >
                {/* Text Display Area */}
                <div className="w-full h-full flex flex-col items-center justify-center px-4 pointer-events-none">
                    {!text.trim() ? (
                        <div className="text-white/60 text-lg font-medium">
                            Tap to type
                        </div>
                    ) : (
                        <div
                            className={`text-center w-full ${getTextSizeClass()}`}
                            style={{ color: textColor }}
                        >
                            <div className="leading-relaxed whitespace-pre-wrap font-bold drop-shadow-lg">
                                {text}
                            </div>
                        </div>
                    )}
                    {/* Tagged Users Display */}
                    {taggedUsers.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            {taggedUsers.map((handle) => (
                                <div
                                    key={handle}
                                    className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium"
                                >
                                    @{handle}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* GIF Overlays */}
                {gifOverlays.length > 0 && containerSize.width > 0 && (
                    <>
                        {gifOverlays.map((overlay) => (
                            <StickerOverlayComponent
                                key={overlay.id}
                                overlay={overlay}
                                onUpdate={(updated) => handleUpdateGifOverlay(overlay.id, updated)}
                                onRemove={() => handleRemoveGifOverlay(overlay.id)}
                                isSelected={selectedGifOverlay === overlay.id}
                                onSelect={() => setSelectedGifOverlay(overlay.id)}
                                containerWidth={containerSize.width || 400}
                                containerHeight={containerSize.height || 400}
                            />
                        ))}
                    </>
                )}

                {/* Text Input - Overlay for typing */}
                <textarea
                    ref={textInputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-white resize-none cursor-text"
                    placeholder=""
                    style={{ fontSize: '16px' }}
                />

                {/* Left-Side Floating Elements */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
                    {/* Text Color Picker */}
                    {showTextColorPicker && (
                        <div className="flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-2xl p-2 shadow-lg">
                            <div className="text-xs font-semibold text-gray-700 mb-1">Text Color</div>
                            {/* Color Options */}
                            <div className="grid grid-cols-4 gap-1">
                                <button
                                    onClick={() => setTextColor('white')}
                                    className={`w-8 h-8 rounded-full ${textColor === 'white' ? 'ring-2 ring-black' : ''}`}
                                    style={{ backgroundColor: 'white' }}
                                />
                                <button
                                    onClick={() => setTextColor('black')}
                                    className={`w-8 h-8 rounded-full ${textColor === 'black' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: 'black' }}
                                />
                                <button
                                    onClick={() => setTextColor('#FF6B6B')}
                                    className={`w-8 h-8 rounded-full ${textColor === '#FF6B6B' ? 'ring-2 ring-black' : ''}`}
                                    style={{ backgroundColor: '#FF6B6B' }}
                                />
                                <button
                                    onClick={() => setTextColor('#4ECDC4')}
                                    className={`w-8 h-8 rounded-full ${textColor === '#4ECDC4' ? 'ring-2 ring-black' : ''}`}
                                    style={{ backgroundColor: '#4ECDC4' }}
                                />
                                <button
                                    onClick={() => setTextColor('#FFD93D')}
                                    className={`w-8 h-8 rounded-full ${textColor === '#FFD93D' ? 'ring-2 ring-black' : ''}`}
                                    style={{ backgroundColor: '#FFD93D' }}
                                />
                                <button
                                    onClick={() => setTextColor('#6BCF7F')}
                                    className={`w-8 h-8 rounded-full ${textColor === '#6BCF7F' ? 'ring-2 ring-black' : ''}`}
                                    style={{ backgroundColor: '#6BCF7F' }}
                                />
                                <button
                                    onClick={() => setTextColor('#95A5F7')}
                                    className={`w-8 h-8 rounded-full ${textColor === '#95A5F7' ? 'ring-2 ring-black' : ''}`}
                                    style={{ backgroundColor: '#95A5F7' }}
                                />
                                <button
                                    onClick={() => setTextColor('#FF8C94')}
                                    className={`w-8 h-8 rounded-full ${textColor === '#FF8C94' ? 'ring-2 ring-black' : ''}`}
                                    style={{ backgroundColor: '#FF8C94' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Background Picker */}
                    {showBackgroundPicker && (
                        <div className="flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-2xl p-2 shadow-lg">
                            <div className="text-xs font-semibold text-gray-700 mb-1">Background</div>
                            {/* Gradient Options */}
                            <div className="grid grid-cols-2 gap-1">
                                <button
                                    onClick={() => setBackground('linear-gradient(to bottom right, #ef4444, #f97316, #fbbf24)')}
                                    className={`h-12 rounded-lg ${background === 'linear-gradient(to bottom right, #ef4444, #f97316, #fbbf24)' ? 'ring-2 ring-black' : ''}`}
                                    style={{ background: 'linear-gradient(to bottom right, #ef4444, #f97316, #fbbf24)' }}
                                />
                                <button
                                    onClick={() => setBackground('linear-gradient(to bottom right, #3b82f6, #8b5cf6, #ec4899)')}
                                    className={`h-12 rounded-lg ${background === 'linear-gradient(to bottom right, #3b82f6, #8b5cf6, #ec4899)' ? 'ring-2 ring-black' : ''}`}
                                    style={{ background: 'linear-gradient(to bottom right, #3b82f6, #8b5cf6, #ec4899)' }}
                                />
                                <button
                                    onClick={() => setBackground('linear-gradient(to bottom right, #10b981, #3b82f6, #8b5cf6)')}
                                    className={`h-12 rounded-lg ${background === 'linear-gradient(to bottom right, #10b981, #3b82f6, #8b5cf6)' ? 'ring-2 ring-black' : ''}`}
                                    style={{ background: 'linear-gradient(to bottom right, #10b981, #3b82f6, #8b5cf6)' }}
                                />
                                <button
                                    onClick={() => setBackground('linear-gradient(to bottom right, #f59e0b, #ef4444, #ec4899)')}
                                    className={`h-12 rounded-lg ${background === 'linear-gradient(to bottom right, #f59e0b, #ef4444, #ec4899)' ? 'ring-2 ring-black' : ''}`}
                                    style={{ background: 'linear-gradient(to bottom right, #f59e0b, #ef4444, #ec4899)' }}
                                />
                            </div>
                            {/* Solid Color Options */}
                            <div className="grid grid-cols-4 gap-1 pt-2 border-t border-gray-200">
                                <button
                                    onClick={() => setBackground('#1e3a8a')}
                                    className={`h-8 rounded ${background === '#1e3a8a' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: '#1e3a8a' }}
                                />
                                <button
                                    onClick={() => setBackground('#1e40af')}
                                    className={`h-8 rounded ${background === '#1e40af' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: '#1e40af' }}
                                />
                                <button
                                    onClick={() => setBackground('#1d4ed8')}
                                    className={`h-8 rounded ${background === '#1d4ed8' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: '#1d4ed8' }}
                                />
                                <button
                                    onClick={() => setBackground('#2563eb')}
                                    className={`h-8 rounded ${background === '#2563eb' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: '#2563eb' }}
                                />
                                <button
                                    onClick={() => setBackground('#3b82f6')}
                                    className={`h-8 rounded ${background === '#3b82f6' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: '#3b82f6' }}
                                />
                                <button
                                    onClick={() => setBackground('#1e293b')}
                                    className={`h-8 rounded ${background === '#1e293b' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: '#1e293b' }}
                                />
                                <button
                                    onClick={() => setBackground('#0f172a')}
                                    className={`h-8 rounded ${background === '#0f172a' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: '#0f172a' }}
                                />
                                <button
                                    onClick={() => setBackground('#1a202c')}
                                    className={`h-8 rounded ${background === '#1a202c' ? 'ring-2 ring-white' : ''}`}
                                    style={{ backgroundColor: '#1a202c' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="px-4 py-4 bg-black/20 backdrop-blur-sm flex items-center justify-center gap-4">
                {/* Text Color Button */}
                <button
                    onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform relative"
                    aria-label="Text Color"
                >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
                        <span className="text-white font-bold text-xl">Aa</span>
                    </div>
                </button>

                {/* Person/Tagging Icon */}
                <button
                    onClick={() => setShowUserTagging(true)}
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform relative"
                    aria-label="Tag People"
                >
                    <FiUser className="w-6 h-6 text-purple-600" />
                    {taggedUsers.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {taggedUsers.length}
                        </span>
                    )}
                </button>

                {/* GIF Button */}
                <button
                    onClick={() => setShowGifPicker(true)}
                    className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold text-sm shadow-lg hover:scale-105 transition-transform"
                    aria-label="Add GIF"
                >
                    GIF
                </button>
            </div>

            {/* Submit Button */}
            {(text.trim() || gifOverlays.length > 0) && (
                <div className="px-4 py-3 bg-black/20 backdrop-blur-sm">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Posting...' : 'Share'}
                    </button>
                </div>
            )}

            {/* GIF Picker Modal */}
            <GifPicker
                isOpen={showGifPicker}
                onClose={() => setShowGifPicker(false)}
                onSelectGif={(gifUrl) => {
                    handleAddGif(gifUrl);
                    setShowGifPicker(false);
                }}
            />

            {/* User Tagging Modal */}
            <UserTaggingModal
                isOpen={showUserTagging}
                onClose={() => setShowUserTagging(false)}
                onSelectUser={(handle) => {
                    if (!taggedUsers.includes(handle)) {
                        setTaggedUsers([...taggedUsers, handle]);
                    }
                }}
                taggedUsers={taggedUsers}
            />

            {/* Sticker Picker Modal */}
            <StickerPicker
                isOpen={showStickerPicker}
                onClose={() => setShowStickerPicker(false)}
                onSelectSticker={handleSelectSticker}
            />
        </div>
    );
}

