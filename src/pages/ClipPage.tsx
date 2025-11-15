import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiCamera, FiMapPin, FiX, FiImage, FiType, FiPalette, FiMaximize2, FiHome, FiSmile, FiSettings, FiUser } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import ScenesModal from '../components/ScenesModal';
import { getPostById } from '../api/posts';
import GifPicker from '../components/GifPicker';
import StickerPicker from '../components/StickerPicker';
import UserTaggingModal from '../components/UserTaggingModal';
import StickerOverlayComponent from '../components/StickerOverlay';
import type { Post, StickerOverlay, Sticker } from '../types';

export default function ClipPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedMedia, setSelectedMedia] = React.useState<string | null>(null);
  const [mediaType, setMediaType] = React.useState<'image' | 'video' | null>(null);
  const [text, setText] = React.useState('');
  const [textColor, setTextColor] = React.useState('#FFFFFF');
  const [textSize, setTextSize] = React.useState<'small' | 'medium' | 'large'>('medium');
  const [background, setBackground] = React.useState<string>('linear-gradient(to bottom right, #ef4444, #f97316, #fbbf24)');
  const [showBackgroundPicker, setShowBackgroundPicker] = React.useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = React.useState(false);
  const [showGifPicker, setShowGifPicker] = React.useState(false);
  const [showStickerPicker, setShowStickerPicker] = React.useState(false);
  const [showUserTagging, setShowUserTagging] = React.useState(false);
  const [gifOverlays, setGifOverlays] = React.useState<StickerOverlay[]>([]);
  const [selectedGifOverlay, setSelectedGifOverlay] = React.useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = React.useState<string[]>([]);
  const [storyLocation, setStoryLocation] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [showTextEditor, setShowTextEditor] = React.useState(false);
  const [showControls, setShowControls] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [sharedPostInfo, setSharedPostInfo] = React.useState<{ postId?: string; userId?: string } | null>(null);
  const [filteredFromFlow, setFilteredFromFlow] = React.useState(false);
  const [videoSegments, setVideoSegments] = React.useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = React.useState(0);
  const [isPostingSegments, setIsPostingSegments] = React.useState(false);
  const [sharedPostTemplate, setSharedPostTemplate] = React.useState<{ templateId?: string; mediaItems?: Array<{ url: string; type: 'image' | 'video'; duration?: number }>; stickers?: any[] } | null>(null);
  const [showScenesModal, setShowScenesModal] = React.useState(false);
  const [fullPost, setFullPost] = React.useState<Post | null>(null);
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [videoSize, setVideoSize] = React.useState<{ w: number; h: number } | null>(null);

  // Check for shared post data on mount
  React.useEffect(() => {
    console.log('ClipPage mounted, checking location state...');
    const sharedStory = location.state?.sharedStory;
    const passedVideo = location.state?.videoUrl as string | undefined;
    console.log('Shared story from location state:', sharedStory);

    if (sharedStory) {
      try {
        console.log('Processing shared story data:', sharedStory);
        if (sharedStory.mediaUrl) {
          console.log('Setting media from shared story:', sharedStory.mediaUrl);
          setSelectedMedia(sharedStory.mediaUrl);
          setMediaType(sharedStory.mediaType || 'image');
          if (sharedStory.text) {
            setText(sharedStory.text);
          }
          // Store the original post info for when we create the story
          if (sharedStory.sharedFromPost) {
            setSharedPostInfo({
              postId: sharedStory.sharedFromPost,
              userId: sharedStory.sharedFromUser
            });
          }
          // Store template info if available
          if (sharedStory.templateId || (sharedStory.mediaItems && sharedStory.mediaItems.length > 1)) {
            setSharedPostTemplate({
              templateId: sharedStory.templateId,
              mediaItems: sharedStory.mediaItems,
              stickers: sharedStory.stickers
            });
          }
          console.log('Media set successfully');
        }
      } catch (error) {
        console.error('Error processing shared story data:', error);
      }
    }

    // Accept direct video from filters flow
    if (passedVideo) {
      setSelectedMedia(passedVideo);
      setMediaType('video');
      if (location.state?.filtered) setFilteredFromFlow(true);

      // Handle multiple segments from instant create flow
      const segments = location.state?.videoSegments as string[] | undefined;
      const segmentIndex = location.state?.segmentIndex as number | undefined;
      if (segments && segments.length > 1) {
        setVideoSegments(segments);
        setCurrentSegmentIndex(segmentIndex || 0);
      }

      setShowControls(true);
      // Keep text editor collapsed by default to match regular Clips UX
      setShowTextEditor(false);
      setTimeout(() => textAreaRef.current?.focus(), 0);
    }
  }, [location.state]);

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const textColors = {
    white: '#FFFFFF',
    yellow: '#FFD700',
    red: '#FF0000',
    blue: '#0080FF',
    green: '#00FF00',
    purple: '#8000FF',
    pink: '#FF00FF',
    orange: '#FF8000',
    cyan: '#00FFFF',
    black: '#000000'
  };

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedMedia(e.target?.result as string);
        if (file.type.startsWith('image/')) {
          setMediaType('image');
        } else if (file.type.startsWith('video/')) {
          setMediaType('video');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    setMediaType(null);
    setText('');
  };

  const handleSubmit = async () => {
    // Allow text-only stories (no media required)
    if (!selectedMedia && !text.trim() && gifOverlays.length === 0) {
      alert('Please add text, media, or a GIF to your story.');
      return;
    }
    if (!user) return;

    // If we have multiple segments, post them sequentially
    if (videoSegments.length > 1) {
      await postAllSegmentsSequentially();
      return;
    }

    // Single segment, regular clip, or text-only story
    setIsUploading(true);
    try {
      await createStory(
        user.id,
        user.handle,
        selectedMedia || undefined,
        mediaType || undefined,
        text.trim() || undefined,
        storyLocation.trim() || undefined,
        textColor,
        textSize,
        sharedPostInfo?.postId,
        sharedPostInfo?.userId,
        text.trim() ? { color: textColor, size: textSize, background: background } : undefined, // textStyle
        gifOverlays.length > 0 ? gifOverlays : undefined, // stickers
        taggedUsers.length > 0 ? taggedUsers : undefined // taggedUsers
      );

      // Dispatch event to refresh story indicators
      window.dispatchEvent(new CustomEvent('storyCreated', {
        detail: { userHandle: user.handle }
      }));

      navigate('/feed');
    } catch (error) {
      console.error('Error creating story:', error);
      alert('Failed to create story. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const postAllSegmentsSequentially = async () => {
    if (!user || videoSegments.length === 0) return;

    setIsPostingSegments(true);
    try {
      // Post each segment sequentially
      for (let i = 0; i < videoSegments.length; i++) {
        setCurrentSegmentIndex(i); // Update UI to show current segment being posted
        const segmentUrl = videoSegments[i];

        await createStory(
          user.id,
          user.handle,
          segmentUrl,
          'video',
          i === 0 ? text.trim() || undefined : undefined, // Only add text to first segment
          i === 0 ? storyLocation.trim() || undefined : undefined, // Only add location to first segment
          textColor,
          textSize,
          i === 0 ? sharedPostInfo?.postId : undefined,
          i === 0 ? sharedPostInfo?.userId : undefined
        );

        // Dispatch event to refresh story indicators after each post
        window.dispatchEvent(new CustomEvent('storyCreated', {
          detail: { userHandle: user.handle }
        }));

        // Small delay between posts to avoid overwhelming the server
        if (i < videoSegments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // All segments posted, navigate to feed
      navigate('/feed');
    } catch (error) {
      console.error('Error creating story segments:', error);
      alert(`Failed to create story segment ${currentSegmentIndex + 1}. Please try again.`);
    } finally {
      setIsPostingSegments(false);
      setCurrentSegmentIndex(0);
    }
  };

  const handleBack = () => {
    navigate('/feed');
  };

  const [textOnlyMode, setTextOnlyMode] = React.useState(false);

  // Update container size for GIF overlays
  React.useEffect(() => {
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
  }, [textOnlyMode]);

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
      x: 50,
      y: 50,
      scale: 1.5,
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
      x: 50,
      y: 50,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0
    };
    setGifOverlays([...gifOverlays, stickerOverlay]);
    setSelectedGifOverlay(stickerOverlay.id);
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

  if (!selectedMedia) {
    // Initial state - no media selected
    if (textOnlyMode) {
      // Text-only mode
      return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-red-500 via-orange-500 to-yellow-400">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm">
            <button
              onClick={() => {
                setTextOnlyMode(false);
                setText('');
                setGifOverlays([]);
                setTaggedUsers([]);
              }}
              className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
              aria-label="Back"
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
            <div className="w-full h-full flex flex-col items-center justify-center px-4 pointer-events-none max-w-full overflow-hidden">
              {!text.trim() ? (
                <div className="text-white/60 text-lg font-medium">
                  Tap to type
                </div>
              ) : (
                <div
                  className={`text-center w-full max-w-full overflow-hidden ${getTextSizeClass()}`}
                  style={{ color: textColor }}
                >
                  <div className="leading-relaxed whitespace-pre-wrap font-bold drop-shadow-lg break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%' }}>
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
              ref={textAreaRef}
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
                  <div className="grid grid-cols-4 gap-1">
                    {Object.entries(textColors).map(([name, color]) => (
                      <button
                        key={name}
                        onClick={() => setTextColor(color)}
                        className={`w-8 h-8 rounded-full ${textColor === color ? 'ring-2 ring-black' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Background Picker */}
              {showBackgroundPicker && (
                <div className="flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-2xl p-2 shadow-lg max-h-[400px] overflow-y-auto">
                  <div className="text-xs font-semibold text-gray-700 mb-1">Background</div>
                  {/* Gradient Options */}
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {[
                      'linear-gradient(to bottom right, #ef4444, #f97316, #fbbf24)',
                      'linear-gradient(to bottom right, #3b82f6, #8b5cf6, #ec4899)',
                      'linear-gradient(to bottom right, rgb(255, 140, 0), rgb(255, 0, 160), rgb(140, 40, 255))',
                      'linear-gradient(to bottom right, #f59e0b, #ef4444, #ec4899)',
                    ].map((gradient) => (
                      <button
                        key={gradient}
                        onClick={() => setBackground(gradient)}
                        className={`h-12 rounded-lg ${background === gradient ? 'ring-2 ring-black' : ''}`}
                        style={{ background: gradient }}
                      />
                    ))}
                  </div>
                  {/* Solid Color Options */}
                  <div className="grid grid-cols-4 gap-1">
                    {['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setBackground(color)}
                        className={`w-8 h-8 rounded-full ${background === color ? 'ring-2 ring-black' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 p-4 bg-black/20 backdrop-blur-sm z-10">
              {/* Text Color Button */}
              <button
                onClick={() => {
                  setShowTextColorPicker(!showTextColorPicker);
                  setShowBackgroundPicker(false);
                }}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                aria-label="Text Color"
              >
                <span className="text-xl font-bold">Aa</span>
              </button>

              {/* Tag Users Button */}
              <button
                onClick={() => setShowUserTagging(true)}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors relative"
                aria-label="Tag Users"
              >
                <FiUser className="w-5 h-5" />
                {taggedUsers.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                    {taggedUsers.length}
                  </span>
                )}
              </button>

              {/* GIF Button */}
              <button
                onClick={() => setShowGifPicker(true)}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                aria-label="Add GIF"
              >
                <span className="text-xl font-bold">GIF</span>
              </button>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isUploading || (!text.trim() && gifOverlays.length === 0)}
                className="px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>

          {/* Modals */}
          {showGifPicker && (
            <GifPicker
              isOpen={showGifPicker}
              onClose={() => setShowGifPicker(false)}
              onSelectGif={(gifUrl) => {
                handleAddGif(gifUrl);
                setShowGifPicker(false);
              }}
            />
          )}

          {showStickerPicker && (
            <StickerPicker
              isOpen={showStickerPicker}
              onClose={() => setShowStickerPicker(false)}
              onSelectSticker={handleSelectSticker}
            />
          )}

          {showUserTagging && (
            <UserTaggingModal
              isOpen={showUserTagging}
              onClose={() => setShowUserTagging(false)}
              onSelectUser={(handle, displayName) => {
                if (!taggedUsers.includes(handle)) {
                  setTaggedUsers([...taggedUsers, handle]);
                }
              }}
              taggedUsers={taggedUsers}
            />
          )}
        </div>
      );
    }

    // Original upload UI
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/feed')}
                className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                aria-label="Go to Home Feed"
                title="Home"
              >
                <FiHome className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/feed')}
                className="font-light text-lg tracking-tight"
                aria-label="Go to Home Feed"
                title="Gazetteer"
                style={{ 
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                <span
                  style={{
                    background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.3) 100%)',
                    backgroundSize: '200% 100%',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    animation: 'shimmer 3s linear infinite',
                    display: 'inline-block'
                  }}
                >
                  Gazetteer
                </span>
              </button>
            </div>
            <h1 className="text-white font-bold text-lg">Create Story</h1>
            <div className="w-10"></div>
          </div>
        </div>

        {/* Main Upload Area */}
        <div className="flex items-center justify-center h-screen px-6">
          <div className="text-center max-w-md">
            {/* Camera Icon with Gradient Border */}
            <button
              onClick={handleCameraClick}
              className="relative mx-auto mb-6 w-32 h-32 cursor-pointer hover:scale-105 transition-transform"
            >
              {/* Outer glowing border - static */}
              <div
                className="w-32 h-32 rounded-full p-0.5 absolute top-0 left-0"
                style={{
                  background: 'conic-gradient(from 0deg, rgb(255, 140, 0), rgb(248, 0, 50), rgb(255, 0, 160), rgb(140, 40, 255), rgb(0, 35, 255), rgb(25, 160, 255), rgb(255, 140, 0))',
                }}
              >
                {/* Inner container */}
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center relative overflow-hidden">
                  <FiCamera className="w-16 h-16 text-white relative z-10" />
                </div>
              </div>

              {/* Glow ring effect */}
              <div
                className="absolute top-0 left-0 w-32 h-32 rounded-full opacity-30 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, rgba(16,185,129,0.5) 50%, transparent 70%)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
            </button>

            <h2 className="text-2xl font-bold text-white mb-3">
              Add to your Clips page
            </h2>
            <p className="text-gray-400 mb-8">
              Share moments that disappear in 24 hours
            </p>

            {/* Upload Button */}
            <label className="block mb-4">
              <div className="relative inline-block overflow-visible">
                {/* Gradient border wrapper */}
                <div className="absolute -inset-[2px] rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 via-purple-500 to-pink-500 blur-sm opacity-75"></div>
                <div className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 via-purple-500 to-pink-500"></div>
                {/* Button content */}
                <div className="relative px-8 py-4 rounded-full bg-white text-black font-semibold hover:scale-105 transition-transform cursor-pointer">
                  <span>Select Photo or Video</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelect}
                className="hidden"
              />
            </label>

            {/* Text Only Option */}
            <button
              onClick={() => setTextOnlyMode(true)}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-semibold transition-colors border border-white/20"
            >
              Create Text Story
            </button>
          </div>
        </div>

        {/* Gradient Background Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-blue-500/10 to-blue-600/10 pointer-events-none"></div>
      </div>
    );
  }

  // Media selected - full screen preview
  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/feed')}
              className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
              aria-label="Go to Home Feed"
              title="Home"
            >
              <FiHome className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/feed')}
              className="font-light text-base tracking-tight"
              aria-label="Go to Home Feed"
              title="Gazetteer"
              style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.3) 100%)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  animation: 'shimmer 3s linear infinite',
                  display: 'inline-block'
                }}
              >
                Gazetteer
              </span>
            </button>
          </div>
          <h1 className="text-white font-semibold text-base">Your Story</h1>
          <div className="flex items-center gap-2">
            {/* Show Full Scenes Button - Show for any post shared to clips */}
            {sharedPostInfo?.postId && (
              <button
                onClick={async () => {
                  // Fetch the full post to show in Scenes
                  if (sharedPostInfo?.postId) {
                    try {
                      const post = await getPostById(sharedPostInfo.postId);
                      if (post) {
                        setFullPost(post);
                        setShowScenesModal(true);
                      }
                    } catch (error) {
                      console.error('Error fetching post:', error);
                    }
                  }
                }}
                className="px-3 py-1.5 bg-purple-600/80 backdrop-blur-sm text-white rounded-full hover:bg-purple-600 transition-colors text-xs font-semibold flex items-center gap-1.5"
                title="Show Full Scenes"
              >
                <FiMaximize2 className="w-3.5 h-3.5" />
                <span>Full Scenes</span>
              </button>
            )}
            <button
              onClick={() => setShowControls(!showControls)}
              className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <FiImage className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Media Preview - Full Screen (reserve space for controls when open) */}
      <div className={`w-full h-full flex items-center justify-center bg-black ${showControls ? 'pb-[40vh]' : ''}`}>
        {mediaType === 'image' ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={selectedMedia}
              alt="Story preview"
              className="max-w-full max-h-full w-auto h-auto"
            />
            {filteredFromFlow && (
              <span className="absolute top-4 left-4 z-10 px-2 py-1 rounded-full text-[11px] font-semibold bg-purple-600 text-white shadow">Filtered</span>
            )}
            {/* Text Overlay Preview */}
            {text && (
              <div className="absolute bottom-20 left-0 right-0 px-6 pointer-events-none">
                <div
                  className={`font-bold text-center ${textSize === 'small' ? 'text-sm' :
                    textSize === 'large' ? 'text-3xl' :
                      'text-xl'
                    }`}
                  style={{
                    color: textColors[textColor as keyof typeof textColors] || textColor,
                    textShadow: '2px 2px 8px rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9)'
                  }}
                >
                  {text}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <div
              className="flex items-center justify-center"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                aspectRatio: videoSize ? `${videoSize.w} / ${videoSize.h}` : undefined,
              }}
            >
              <video
                ref={videoRef}
                src={selectedMedia}
                controls
                className="w-full h-full"
                style={{ objectFit: 'contain', display: 'block' }}
                onLoadedMetadata={() => {
                  const v = videoRef.current;
                  if (v && v.videoWidth && v.videoHeight) {
                    setVideoSize({ w: v.videoWidth, h: v.videoHeight });
                  }
                }}
              />
            </div>
            {filteredFromFlow && (
              <span className="absolute top-4 left-4 z-10 px-2 py-1 rounded-full text-[11px] font-semibold bg-purple-600 text-white shadow">Filtered</span>
            )}
          </div>
        )}
      </div>

      {/* Controls Panel - Slides up from bottom */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 max-h-[70vh] overflow-y-auto">
          {/* Text Editor Section */}
          <div className="space-y-6">
            {/* Add Text Button */}
            <button
              onClick={() => setShowTextEditor(!showTextEditor)}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-3"
            >
              <FiType className="w-5 h-5" />
              {showTextEditor ? 'Hide Text Editor' : 'Add Text'}
            </button>

            {/* Text Input - Expanded */}
            {showTextEditor && (
              <div className="space-y-4">
                <textarea
                  ref={textAreaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type your story text..."
                  maxLength={200}
                  className="w-full h-32 p-4 rounded-2xl bg-gray-900 text-white placeholder-gray-500 resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <div className="text-right text-sm text-gray-500">{text.length}/200</div>

                {/* Color Picker */}
                {text && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-3">Text Color</label>
                    <div className="flex gap-3 flex-wrap justify-center">
                      {Object.entries(textColors).map(([name, color]) => (
                        <button
                          key={name}
                          onClick={() => setTextColor(name)}
                          className={`w-12 h-12 rounded-full border-3 transition-all ${textColor === name
                            ? 'border-white scale-110'
                            : 'border-gray-600'
                            }`}
                          style={{ backgroundColor: color }}
                          title={name.charAt(0).toUpperCase() + name.slice(1)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Size Picker */}
                {text && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-3">Text Size</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => setTextSize(size)}
                          className={`py-3 rounded-xl border-2 font-medium transition-all ${textSize === size
                            ? 'border-white bg-white text-black'
                            : 'border-gray-600 text-gray-400 hover:border-gray-500'
                            }`}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Location Input */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <FiMapPin className="w-4 h-4" />
                Add Location
              </label>
              <input
                type="text"
                value={storyLocation}
                onChange={(e) => setStoryLocation(e.target.value)}
                placeholder="Where are you?"
                className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Info */}
            <div className="rounded-2xl bg-gray-900/50 p-4 text-center">
              <div className="text-sm text-gray-400">
                📸 Your story will be visible for 24 hours
              </div>
            </div>

            {/* Share Button */}
            {videoSegments.length > 1 && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                  📹 Your video will be split into {videoSegments.length} clips (15 seconds each)
                </p>
                {isPostingSegments && (
                  <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                    Posting clips... ({currentSegmentIndex + 1} of {videoSegments.length})
                  </p>
                )}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={isUploading || isPostingSegments}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 via-blue-500 to-blue-600 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              {isPostingSegments
                ? `Posting ${videoSegments.length} Clips... (${currentSegmentIndex + 1}/${videoSegments.length})`
                : isUploading
                  ? 'Sharing Your Story...'
                  : videoSegments.length > 1
                    ? `Share ${videoSegments.length} Clips to Story`
                    : 'Share to Story'}
            </button>
          </div>
        </div>
      )}


      {/* Scenes Modal for Template Posts */}
      {showScenesModal && fullPost && (
        <ScenesModal
          post={fullPost}
          isOpen={showScenesModal}
          onClose={() => {
            setShowScenesModal(false);
            setFullPost(null);
          }}
          onLike={async () => {
            // Mock like handler for scenes
          }}
          onFollow={async () => {
            // Mock follow handler for scenes
          }}
          onShare={async () => {
            // Mock share handler for scenes
          }}
          onOpenComments={() => {
            // Mock comments handler for scenes
          }}
          onReclip={async () => {
            // Mock reclip handler for scenes
          }}
        />
      )}
    </div>
  );
}