import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiCamera, FiMapPin, FiX, FiImage, FiType, FiSliders, FiMaximize2, FiHome, FiSmile, FiSettings, FiUser, FiPlus, FiLink } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import ScenesModal from '../components/ScenesModal';
import { reclipPost } from '../api/posts';
import { getPostById } from '../api/posts';
import GifPicker from '../components/GifPicker';
import StickerPicker from '../components/StickerPicker';
import UserTaggingModal from '../components/UserTaggingModal';
import StickerOverlayComponent from '../components/StickerOverlay';
import type { Post, StickerOverlay, Sticker } from '../types';
import { TEXT_STORY_TEMPLATES, TextStoryTemplate } from '../textStoryTemplates';

// Tagged User Overlay Component (draggable)
interface TaggedUserOverlayProps {
    taggedUser: { handle: string; x: number; y: number; id: string };
    onUpdate: (taggedUser: { handle: string; x: number; y: number; id: string }) => void;
    onRemove: () => void;
    isSelected: boolean;
    onSelect: () => void;
    containerWidth: number;
    containerHeight: number;
    isModalOpen?: boolean; // Whether any modal is open
    containerRef?: React.RefObject<HTMLDivElement | null>; // Container ref for accurate positioning
}

function TaggedUserOverlay({
    taggedUser,
    onUpdate,
    onRemove,
    isSelected,
    onSelect,
    containerWidth,
    containerHeight,
    isModalOpen = false,
    containerRef: _containerRef
}: TaggedUserOverlayProps) {
    const [isDragging, setIsDragging] = React.useState(false);
    const [isResizing, setIsResizing] = React.useState(false);
    const [isRotating, setIsRotating] = React.useState(false);
    const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
    const [initialState, setInitialState] = React.useState<{ handle: string; x: number; y: number; id: string } | null>(null);
    const taggedUserRef = React.useRef<HTMLDivElement>(null);

    // Calculate pixel positions from percentages
    const pixelX = (taggedUser.x / 100) * containerWidth;
    const pixelY = (taggedUser.y / 100) * containerHeight;

    function startDrag(clientX: number, clientY: number) {
        const target = document.elementFromPoint(clientX, clientY) as HTMLElement;
        if (target?.closest('button')) {
            return; // Let controls handle their own clicks
        }
        
        onSelect();
        setIsDragging(true);
        setDragStart({ x: clientX - pixelX, y: clientY - pixelY });
        setInitialState({ ...taggedUser });
    }

    function handleMouseDown(e: React.MouseEvent) {
        e.stopPropagation();
        // Don't start dragging if clicking on controls (remove button, etc.)
        const target = e.target as HTMLElement;
        if (target.closest('button')) {
            return; // Let controls handle their own clicks
        }
        
        startDrag(e.clientX, e.clientY);
    }

    function handleMouseMove(e: React.MouseEvent) {
        if (isDragging && initialState) {
            const newX = ((e.clientX - dragStart.x) / containerWidth) * 100;
            const newY = ((e.clientY - dragStart.y) / containerHeight) * 100;

            onUpdate({
                ...taggedUser,
                x: Math.max(0, Math.min(100, newX)),
                y: Math.max(0, Math.min(100, newY))
            });
        }
    }

    function handleMouseUp() {
        setIsDragging(false);
        setIsResizing(false);
        setIsRotating(false);
        setInitialState(null);
    }

    // Use native event listeners for better mobile support - CRITICAL for mobile
    // Same approach as StickerOverlay - EXACT COPY
    React.useEffect(() => {
        const element = taggedUserRef.current;
        if (!element) return;

        // Use local variables to avoid stale closures
        let isDraggingTouch = false;
        let currentDragStart = { x: 0, y: 0 };
        let currentInitialState: { handle: string; x: number; y: number; id: string } | null = null;
        let currentTaggedUser = taggedUser; // Capture current tagged user
        let touchStartElement: HTMLElement | null = null;

        const handleNativeTouchStart = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            // Check if touch started on this tagged user or its children
            if (!element.contains(target)) return;
            
            // Don't handle if clicking on button
            if (target.closest('button')) {
                return;
            }
            
            // Stop propagation FIRST to prevent container from handling it
            e.stopPropagation();
            e.preventDefault();
            
            const touch = e.touches[0];
            if (touch) {
                touchStartElement = target;
                onSelect();
                isDraggingTouch = true;
                setIsDragging(true);
                
                // Get the actual container element (parent of parent)
                const containerElement = element.parentElement?.parentElement || document.body;
                const containerRect = containerElement.getBoundingClientRect();
                const touchX = touch.clientX - containerRect.left;
                const touchY = touch.clientY - containerRect.top;
                
                // Calculate current tagged user position in pixels
                const currentPixelX = (currentTaggedUser.x / 100) * containerWidth;
                const currentPixelY = (currentTaggedUser.y / 100) * containerHeight;
                
                // Store offset from touch point to tagged user center
                currentDragStart = { 
                    x: touchX - currentPixelX, 
                    y: touchY - currentPixelY 
                };
                currentInitialState = { ...currentTaggedUser };
                setDragStart(currentDragStart);
                setInitialState(currentInitialState);
                
                // Add document-level listeners for touchmove/touchend to ensure we capture all events
                document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false, capture: true });
                document.addEventListener('touchend', handleDocumentTouchEnd, { passive: false, capture: true });
                document.addEventListener('touchcancel', handleDocumentTouchEnd, { passive: false, capture: true });
            }
        };

        const handleDocumentTouchMove = (e: TouchEvent) => {
            if (isDraggingTouch && currentInitialState && touchStartElement) {
                // Only handle if this touch is related to our tagged user
                const touch = e.touches[0];
                if (!touch) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                // Get container - find the parent container element
                const containerElement = element.parentElement?.parentElement || document.body;
                const containerRect = containerElement.getBoundingClientRect();
                const touchX = touch.clientX - containerRect.left;
                const touchY = touch.clientY - containerRect.top;
                // Calculate new position using the drag offset
                const newPixelX = touchX - currentDragStart.x;
                const newPixelY = touchY - currentDragStart.y;
                // Convert to percentage
                const newX = (newPixelX / containerWidth) * 100;
                const newY = (newPixelY / containerHeight) * 100;
                onUpdate({
                    ...currentInitialState,
                    x: Math.max(0, Math.min(100, newX)),
                    y: Math.max(0, Math.min(100, newY))
                });
            }
        };

        const handleDocumentTouchEnd = () => {
            if (isDraggingTouch) {
                isDraggingTouch = false;
                currentInitialState = null;
                touchStartElement = null;
                setIsDragging(false);
                setIsResizing(false);
                setIsRotating(false);
                setInitialState(null);
                
                // Remove document-level listeners
                document.removeEventListener('touchmove', handleDocumentTouchMove, { capture: true } as any);
                document.removeEventListener('touchend', handleDocumentTouchEnd, { capture: true } as any);
                document.removeEventListener('touchcancel', handleDocumentTouchEnd, { capture: true } as any);
            }
        };

        // Update currentTaggedUser when taggedUser changes
        currentTaggedUser = taggedUser;

        // Add native touch listeners with capture phase for better mobile support
        // Capture phase ensures we handle events before React synthetic events and container handlers
        const options = { passive: false, capture: true };
        element.addEventListener('touchstart', handleNativeTouchStart, options);

        return () => {
            element.removeEventListener('touchstart', handleNativeTouchStart, options as any);
            document.removeEventListener('touchmove', handleDocumentTouchMove, { capture: true } as any);
            document.removeEventListener('touchend', handleDocumentTouchEnd, { capture: true } as any);
            document.removeEventListener('touchcancel', handleDocumentTouchEnd, { capture: true } as any);
        };
    }, [taggedUser, onSelect, onUpdate, containerWidth, containerHeight]);

    React.useEffect(() => {
        if (isDragging || isResizing || isRotating) {
            const handleMouseMoveGlobal = (e: MouseEvent) => {
                if (isDragging && initialState) {
                    const newX = ((e.clientX - dragStart.x) / containerWidth) * 100;
                    const newY = ((e.clientY - dragStart.y) / containerHeight) * 100;

                    onUpdate({
                        ...taggedUser,
                        x: Math.max(0, Math.min(100, newX)),
                        y: Math.max(0, Math.min(100, newY))
                    });
                }
            };

            const handleTouchMoveGlobal = (e: TouchEvent) => {
                if (isDragging || isResizing || isRotating) {
                    e.preventDefault(); // Prevent scrolling while dragging
                    const touch = e.touches[0];
                    if (touch && isDragging && initialState) {
                        const newX = ((touch.clientX - dragStart.x) / containerWidth) * 100;
                        const newY = ((touch.clientY - dragStart.y) / containerHeight) * 100;

                        onUpdate({
                            ...taggedUser,
                            x: Math.max(0, Math.min(100, newX)),
                            y: Math.max(0, Math.min(100, newY))
                        });
                    }
                }
            };

            document.addEventListener('mousemove', handleMouseMoveGlobal);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
            document.addEventListener('touchend', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMoveGlobal);
                document.removeEventListener('mouseup', handleMouseUp);
                document.removeEventListener('touchmove', handleTouchMoveGlobal);
                document.removeEventListener('touchend', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, isRotating, initialState, dragStart, taggedUser, onUpdate, containerWidth, containerHeight]);

    return (
        <div
            ref={taggedUserRef}
            data-tagged-user="true"
            data-tagged-user-id={taggedUser.id}
            className={`absolute cursor-move ${isSelected ? 'ring-2 ring-purple-500' : ''}`}
            style={{
                left: `${taggedUser.x}%`,
                top: `${taggedUser.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isModalOpen 
                    ? 1  // Lower z-index when modals are open (modals are z-[200])
                    : (isSelected ? 100 : 50), // Higher z-index to be above textarea when no modals
                pointerEvents: 'auto',
                touchAction: 'none', // Disable default touch behaviors to allow dragging
                userSelect: 'none', // Prevent text selection
                WebkitTouchCallout: 'none', // Disable iOS callout menu
                WebkitUserSelect: 'none', // Disable iOS text selection
                ...({ WebkitUserDrag: 'none' } as React.CSSProperties) // Prevent dragging on WebKit
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            // Pointer events are handled by native listeners - just stop propagation
            onPointerDown={(e) => {
                e.stopPropagation();
            }}
        >
            {/* Tagged User Content - EXACT same structure as sticker */}
            <div className="tagged-user-content w-full h-full flex items-center justify-center" style={{ pointerEvents: 'none' }}>
                <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium whitespace-nowrap">
                    @{taggedUser.handle}
                </div>
            </div>
            
            {/* Remove Button (shown when selected) */}
            {isSelected && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-20"
                >
                    <FiX className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

export default function ClipPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedMedia, setSelectedMedia] = React.useState<string | null>(null);
  const [mediaType, setMediaType] = React.useState<'image' | 'video' | null>(null);
  const [text, setText] = React.useState('');
  const [textColor, setTextColor] = React.useState('#FFFFFF');
  const [textSize, setTextSize] = React.useState<'small' | 'medium' | 'large'>('small');
  const [background, setBackground] = React.useState<string>('linear-gradient(to bottom right, #ec4899, #a855f7, #9333ea)');
  const [textFontFamily, setTextFontFamily] = React.useState<string>('system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif');
  const [showBackgroundPicker, setShowBackgroundPicker] = React.useState(false);
  const [textTemplateId, setTextTemplateId] = React.useState<string>(TEXT_STORY_TEMPLATES[2]?.id || TEXT_STORY_TEMPLATES[0]?.id);
  const applyTextTemplate = React.useCallback((templateId: string) => {
    const tpl: TextStoryTemplate | undefined = TEXT_STORY_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setTextTemplateId(tpl.id);
    setBackground(tpl.background);
    setTextColor(tpl.textColor);
    setTextSize(tpl.textSize);
    setTextFontFamily(tpl.fontFamily);
  }, []);
  const [showTextColorPicker, setShowTextColorPicker] = React.useState(false);
  const [showGifPicker, setShowGifPicker] = React.useState(false);
  const [showStickerPicker, setShowStickerPicker] = React.useState(false);
  const [showUserTagging, setShowUserTagging] = React.useState(false);
  const [showLinkModal, setShowLinkModal] = React.useState(false);
  const [gifOverlays, setGifOverlays] = React.useState<StickerOverlay[]>([]);
  const [linkOverlays, setLinkOverlays] = React.useState<StickerOverlay[]>([]);
  const [selectedGifOverlay, setSelectedGifOverlay] = React.useState<string | null>(null);
  const [selectedLinkOverlay, setSelectedLinkOverlay] = React.useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = React.useState<Array<{ handle: string; x: number; y: number; id: string }>>([]);
  const [selectedTaggedUser, setSelectedTaggedUser] = React.useState<string | null>(null);
  const [storyLocation, setStoryLocation] = React.useState('');
  const [venue, setVenue] = React.useState('');
  // New media editing mode states
  const [showTextCard, setShowTextCard] = React.useState(false);
  const [showLocationCard, setShowLocationCard] = React.useState(false);
  const [showLinkCard, setShowLinkCard] = React.useState(false);
  const [showTagUserCard, setShowTagUserCard] = React.useState(false);
  const [textStickers, setTextStickers] = React.useState<StickerOverlay[]>([]);
  const [locationStickers, setLocationStickers] = React.useState<StickerOverlay[]>([]);
  const [selectedTextSticker, setSelectedTextSticker] = React.useState<string | null>(null);
  const [selectedLocationSticker, setSelectedLocationSticker] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [showTextEditor, setShowTextEditor] = React.useState(false);
  const [showControls, setShowControls] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [sharedPostInfo, setSharedPostInfo] = React.useState<{ postId?: string; userId?: string } | null>(null);
  const [keyboardOffset, setKeyboardOffset] = React.useState(0);
  const [showStoryLocationSheet, setShowStoryLocationSheet] = React.useState(false);
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

    // Check for question reply
    const replyData = location.state?.replyToQuestion;
    if (replyData) {
      setReplyToQuestion(replyData);
      // Pre-fill text with the response
      setText(replyData.response);
    }
  }, [location.state]);

  const handleCameraClick = async () => {
    // In poll mode, use file picker (for selecting background images)
    if (pollMode) {
    fileInputRef.current?.click();
    } else {
      // In regular story mode, use camera input with capture attribute
      if (cameraInputRef.current) {
        // Force click on camera input which has capture attribute
        cameraInputRef.current.click();
      } else {
        // Fallback to regular file input
        fileInputRef.current?.click();
      }
    }
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
      // In poll mode, only allow images
      if (pollMode && !file.type.startsWith('image/')) {
        alert('Only images can be used as background for polls. Please select an image file.');
        event.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedMedia(e.target?.result as string);
        if (file.type.startsWith('image/')) {
          setMediaType('image');
        } else if (file.type.startsWith('video/')) {
          setMediaType('video');
        }
        // If in poll mode, stay in poll mode - don't switch to regular story mode
        // The poll card will show on top of the media
      };
      reader.readAsDataURL(file);
      // Reset the input so the same file can be selected again if needed
      event.target.value = '';
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
      // Convert text and location to sticker overlays when media is present
      let allStickers = [...gifOverlays, ...linkOverlays, ...textStickers, ...locationStickers];
      
      // If we have media, convert text and location to stickers
      if (selectedMedia) {
        // Add text as a sticker overlay
        if (text.trim()) {
          const textSticker: StickerOverlay = {
            id: `text-sticker-${Date.now()}`,
            stickerId: `text-sticker-${Date.now()}`,
            sticker: {
              id: `text-sticker-${Date.now()}`,
              name: text.trim(),
              category: 'Text',
              emoji: undefined,
              url: undefined,
              isTrending: false
            },
            x: 50, // Center horizontally
            y: 75, // Position near bottom (75% from top)
            scale: textSize === 'small' ? 0.8 : textSize === 'large' ? 1.4 : 1.0,
            rotation: 0,
            opacity: 1,
            textContent: text.trim(),
            textColor: textColors[textColor as keyof typeof textColors] || textColor,
            fontSize: textSize
          };
          allStickers.push(textSticker);
        }
        
        // Add location as a sticker overlay
        if (storyLocation.trim()) {
          const locationSticker: StickerOverlay = {
            id: `location-sticker-${Date.now()}`,
            stickerId: `location-sticker-${Date.now()}`,
            sticker: {
              id: `location-sticker-${Date.now()}`,
              name: storyLocation.trim(),
              category: 'Location',
              emoji: undefined,
              url: undefined,
              isTrending: false
            },
            x: 50, // Center horizontally
            y: 85, // Position at bottom (85% from top)
            scale: 0.9,
            rotation: 0,
            opacity: 1,
            textContent: storyLocation.trim(),
            textColor: '#FFFFFF',
            fontSize: 'small'
          };
          allStickers.push(locationSticker);
        }
      }
      
      // If replying to a question, create a special story with question card
      if (replyToQuestion) {
        // Create question card sticker
        const questionCardSticker: StickerOverlay = {
          id: `question-card-${Date.now()}`,
          stickerId: `question-card-${Date.now()}`,
          sticker: {
            id: `question-card-${Date.now()}`,
            name: 'Question Card',
            category: 'Question',
            emoji: undefined,
            url: undefined,
            isTrending: false
          },
          x: 50, // Center horizontally
          y: 30, // Position at top (30% from top)
          scale: 1.0,
          rotation: 0,
          opacity: 1,
          textContent: `Q: ${replyToQuestion.question}\nA: ${replyToQuestion.response}`, // Question and their answer
          textColor: '#000000',
          fontSize: 'small',
          isQuestionCard: true // Special flag for question card styling
        };
        allStickers.push(questionCardSticker);
        
        // Your reply text as a sticker at the bottom
        if (text.trim()) {
          const replySticker: StickerOverlay = {
            id: `reply-sticker-${Date.now()}`,
            stickerId: `reply-sticker-${Date.now()}`,
            sticker: {
              id: `reply-sticker-${Date.now()}`,
              name: 'Your Reply',
              category: 'Text',
              emoji: undefined,
              url: undefined,
              isTrending: false
            },
            x: 50,
            y: 75, // Position at bottom
            scale: 1.0,
            rotation: 0,
            opacity: 1,
            textContent: text.trim(),
            textColor: textColor,
            fontSize: textSize
          };
          allStickers.push(replySticker);
        }
      }
      
      const createdStory = await createStory(
        user.id,
        user.handle,
        selectedMedia || undefined,
        mediaType || undefined,
        // Only pass text/location if no media (for text-only stories)
        selectedMedia ? undefined : (text.trim() || undefined),
        selectedMedia ? undefined : (storyLocation.trim() || undefined),
        textColor,
        textSize,
        sharedPostInfo?.postId,
        sharedPostInfo?.userId,
        // Only pass textStyle if no media (for text-only stories)
        selectedMedia ? undefined : (text.trim() ? ({ color: textColor, size: textSize, background: background, fontFamily: textFontFamily } as any) : undefined),
        allStickers.length > 0 ? allStickers : undefined, // stickers (including text and location)
        taggedUsers.length > 0 ? taggedUsers.map(tu => tu.handle) : undefined, // taggedUsers (send handles for API compatibility)
        undefined, // poll
        taggedUsers.length > 0 ? taggedUsers.map(tu => ({ handle: tu.handle, x: tu.x, y: tu.y })) : undefined, // taggedUsersPositions
        undefined, // question
        venue.trim() || undefined // venue for metadata carousel
      );
      
      // Mark question as replied if this was a question reply
      if (replyToQuestion?.questionId) {
        const { markQuestionReplied } = await import('../api/questions');
        await markQuestionReplied(replyToQuestion.questionId, createdStory.id);
      }

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
      // Convert text and location to sticker overlays for all segments
      let allStickers: StickerOverlay[] = [...linkOverlays];
      
      // Add text as a sticker overlay (for all segments)
      if (text.trim()) {
        const textSticker: StickerOverlay = {
          id: `text-sticker-${Date.now()}`,
          stickerId: `text-sticker-${Date.now()}`,
          sticker: {
            id: `text-sticker-${Date.now()}`,
            name: text.trim(),
            category: 'Text',
            emoji: undefined,
            url: undefined,
            isTrending: false
          },
          x: 50, // Center horizontally
          y: 75, // Position near bottom (75% from top)
          scale: textSize === 'small' ? 0.8 : textSize === 'large' ? 1.4 : 1.0,
          rotation: 0,
          opacity: 1,
          textContent: text.trim(),
          textColor: textColors[textColor as keyof typeof textColors] || textColor,
          fontSize: textSize
        };
        allStickers.push(textSticker);
      }
      
      // Add location as a sticker overlay (for all segments)
      if (storyLocation.trim()) {
        const locationSticker: StickerOverlay = {
          id: `location-sticker-${Date.now()}`,
          stickerId: `location-sticker-${Date.now()}`,
          sticker: {
            id: `location-sticker-${Date.now()}`,
            name: storyLocation.trim(),
            category: 'Location',
            emoji: undefined,
            url: undefined,
            isTrending: false
          },
          x: 50, // Center horizontally
          y: 85, // Position at bottom (85% from top)
          scale: 0.9,
          rotation: 0,
          opacity: 1,
          textContent: storyLocation.trim(),
          textColor: '#FFFFFF',
          fontSize: 'small'
        };
        allStickers.push(locationSticker);
      }
      
      // Post each segment sequentially
      for (let i = 0; i < videoSegments.length; i++) {
        setCurrentSegmentIndex(i); // Update UI to show current segment being posted
        const segmentUrl = videoSegments[i];

        await createStory(
          user.id,
          user.handle,
          segmentUrl,
          'video',
          undefined, // Don't pass text as separate parameter (it's a sticker now)
          undefined, // Don't pass location as separate parameter (it's a sticker now)
          textColor,
          textSize,
          i === 0 ? sharedPostInfo?.postId : undefined,
          i === 0 ? sharedPostInfo?.userId : undefined,
          undefined, // textStyle (not needed for video segments with stickers)
          allStickers.length > 0 ? allStickers : undefined, // stickers (including text and location)
          undefined, // taggedUsers
          undefined, // poll
          undefined, // taggedUsersPositions
          undefined // question
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
  const [pollMode, setPollMode] = React.useState(false);
  const [pollQuestion, setPollQuestion] = React.useState('');
  const [pollOption1, setPollOption1] = React.useState('Yes');
  const [pollOption2, setPollOption2] = React.useState('No');
  const [pollOption3, setPollOption3] = React.useState('');
  const [showPollOption3, setShowPollOption3] = React.useState(false);
  const [questionMode, setQuestionMode] = React.useState(false);
  const [questionPrompt, setQuestionPrompt] = React.useState('Ask me anything');
  const [replyToQuestion, setReplyToQuestion] = React.useState<{
    question?: string;
    questionId?: string;
    response: string;
    responderHandle: string;
  } | null>(null);

  // Update container size for GIF overlays and stickers
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
  }, [textOnlyMode, selectedMedia]);

  // Move bottom controls up when keyboard opens in text-only mode (mobile web)
  React.useEffect(() => {
    if (!textOnlyMode || selectedMedia) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const updateOffset = () => {
      const visible = vv.height;
      const full = window.innerHeight || visible;
      const keyboardOpen = visible < full * 0.9;
      const offset = keyboardOpen ? Math.max(0, full - visible) : 0;
      setKeyboardOffset(offset);
    };

    updateOffset();
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);
    return () => {
      vv.removeEventListener('resize', updateOffset);
      vv.removeEventListener('scroll', updateOffset);
    };
  }, [textOnlyMode, selectedMedia]);

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

  // Handle adding link as overlay
  const handleAddLink = (url: string, name: string) => {
    // Ensure URL has protocol
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const linkOverlay: StickerOverlay = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      stickerId: `link-${formattedUrl}`,
      sticker: {
        id: `link-${formattedUrl}`,
        name: name || formattedUrl,
        category: 'Link',
        emoji: undefined,
        url: undefined,
        isTrending: false
      },
      x: 50,
      y: 50,
      scale: 1.0,
      rotation: 0,
      opacity: 1,
      textContent: name || formattedUrl,
      textColor: '#FFFFFF',
      fontSize: 'medium',
      linkUrl: formattedUrl,
      linkName: name || formattedUrl
    };
    setLinkOverlays([...linkOverlays, linkOverlay]);
    setSelectedLinkOverlay(linkOverlay.id);
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

  // Handle updating link overlay
  const handleUpdateLinkOverlay = (overlayId: string, updated: StickerOverlay) => {
    setLinkOverlays(linkOverlays.map(overlay => overlay.id === overlayId ? updated : overlay));
  };

  // Handle removing link overlay
  const handleRemoveLinkOverlay = (overlayId: string) => {
    setLinkOverlays(linkOverlays.filter(overlay => overlay.id !== overlayId));
    if (selectedLinkOverlay === overlayId) {
      setSelectedLinkOverlay(null);
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
        return 'text-xl';
      case 'medium':
        return 'text-3xl';
      case 'large':
        return 'text-5xl';
      default:
        return 'text-3xl';
    }
  };

  // Check question mode first - it should work with or without media
  if (questionMode) {
    // Question creation mode
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm">
          <button
            onClick={() => {
              setQuestionMode(false);
              setQuestionPrompt('Ask me anything');
              setSelectedMedia(null);
              setMediaType(null);
            }}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="Back"
          >
            <FiX className="w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-lg">Ask a Question</h1>
          <button
            onClick={handleCameraClick}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="Add Background"
            title="Add Background Photo"
          >
            <FiCamera className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleMediaSelect}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleMediaSelect}
            className="hidden"
          />
        </div>

        {/* Main Content Area */}
        <div 
          className="flex-1 flex items-center justify-center relative overflow-hidden"
          style={{
            background: selectedMedia && mediaType === 'image'
              ? undefined
              : 'linear-gradient(to bottom right, rgba(255, 78, 203, 0.2), rgba(0, 0, 0, 0.9), rgba(143, 91, 255, 0.2))'
          }}
        >
          {/* Background Image Preview */}
          {selectedMedia && mediaType === 'image' && (
            <img
              src={selectedMedia}
              alt="Question background"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Question Content Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10">
            {/* Question Card Container */}
            <div className="backdrop-blur-md bg-white/95 rounded-2xl p-6 border border-white/30 shadow-2xl max-w-md w-full">
              {/* Question Prompt Input */}
              <div className="mb-6">
                <input
                  type="text"
                  value={questionPrompt}
                  onChange={(e) => setQuestionPrompt(e.target.value)}
                  placeholder="Ask me anything..."
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-lg font-medium"
                  maxLength={60}
                />
                <p className="text-gray-500 text-xs mt-1 text-center">{questionPrompt.length}/60</p>
              </div>

              {/* Question Sticker Preview */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 text-center">
                <p className="text-white font-semibold text-sm">{questionPrompt || 'Ask me anything'}</p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 p-4 bg-black/20 backdrop-blur-sm z-10">
            {/* Submit Button */}
            <button
              onClick={async () => {
                if (!questionPrompt.trim()) {
                  alert('Please enter a question prompt.');
                  return;
                }
                if (!user) return;

                setIsUploading(true);
                try {
                  // Create question story
                  await createStory(
                    user.id,
                    user.handle,
                    selectedMedia || undefined,
                    mediaType || undefined,
                    undefined, // text
                    storyLocation.trim() || undefined,
                    undefined, // textColor
                    undefined, // textSize
                    sharedPostInfo?.postId,
                    sharedPostInfo?.userId,
                    undefined, // textStyle
                    undefined, // stickers
                    undefined, // taggedUsers
                    undefined, // poll
                    undefined, // taggedUsersPositions
                    questionPrompt.trim() // question prompt
                  );

                  // Dispatch event to refresh story indicators
                  window.dispatchEvent(new CustomEvent('storyCreated', {
                    detail: { userHandle: user.handle }
                  }));

                  navigate('/feed');
                } catch (error) {
                  console.error('Error creating question story:', error);
                  alert('Failed to create question. Please try again.');
                } finally {
                  setIsUploading(false);
                }
              }}
              disabled={isUploading || !questionPrompt.trim()}
              className="px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Posting...' : 'Post Question'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check poll mode - it should work with or without media
  if (pollMode) {
    // Poll creation mode
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm">
          <button
            onClick={() => {
              setPollMode(false);
              setPollQuestion('');
              setPollOption1('Yes');
              setPollOption2('No');
              setPollOption3('');
              setShowPollOption3(false);
              setSelectedMedia(null);
              setMediaType(null);
            }}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="Back"
          >
            <FiX className="w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-lg">Create Poll</h1>
          <button
            onClick={handleCameraClick}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="Add Background"
            title="Add Background Photo/Video"
          >
            <FiCamera className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleMediaSelect}
            className="hidden"
          />
          {/* Hidden Camera Input for Poll Mode */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleMediaSelect}
            className="hidden"
          />
        </div>

        {/* Main Content Area */}
        <div 
          className="flex-1 flex items-center justify-center relative overflow-hidden"
          style={{
            background: selectedMedia && mediaType === 'image'
              ? undefined
              : 'linear-gradient(to bottom right, rgba(255, 78, 203, 0.2), rgba(0, 0, 0, 0.9), rgba(143, 91, 255, 0.2))'
          }}
        >
          {/* Background Image Preview - only images allowed for poll backgrounds */}
          {selectedMedia && mediaType === 'image' && (
            <img
              src={selectedMedia}
              alt="Poll background"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Poll Content Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10">
            {/* Poll Card Container */}
            <div className="backdrop-blur-md bg-white/95 rounded-2xl p-6 border border-white/30 shadow-2xl max-w-md w-full">
              {/* Poll Question Input */}
              <div className="mb-6">
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-lg font-medium"
                  maxLength={200}
                />
              </div>

              {/* Poll Options */}
              <div className="space-y-4">
                {/* Option 1 */}
                <div>
                  <input
                    type="text"
                    value={pollOption1}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 26) {
                        setPollOption1(value);
                      }
                    }}
                    placeholder=""
                    className="w-full px-4 py-4 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-lg font-semibold text-center"
                    maxLength={26}
                  />
                  <p className="text-gray-500 text-xs mt-1 text-center">{pollOption1.length}/26</p>
                </div>

                {/* Option 2 */}
                <div>
                  <input
                    type="text"
                    value={pollOption2}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 26) {
                        setPollOption2(value);
                      }
                    }}
                    placeholder=""
                    className="w-full px-4 py-4 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-lg font-semibold text-center"
                    maxLength={26}
                  />
                  <p className="text-gray-500 text-xs mt-1 text-center">{pollOption2.length}/26</p>
                </div>

                {/* Option 3 - Show when added */}
                {showPollOption3 && (
                  <div>
                    <input
                      type="text"
                      value={pollOption3}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= 26) {
                          setPollOption3(value);
                        }
                      }}
                      placeholder=""
                      className="w-full px-4 py-4 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-lg font-semibold text-center"
                      maxLength={26}
                      autoFocus
                    />
                    <p className="text-gray-500 text-xs mt-1 text-center">{pollOption3.length}/26</p>
                  </div>
                )}

                {/* Add Option Button - Instagram style */}
                {!showPollOption3 && (
                  <button
                    onClick={() => setShowPollOption3(true)}
                    className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl border-2 border-dashed border-gray-300 text-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <FiPlus className="w-5 h-5" />
                    Add option
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 p-4 bg-black/20 backdrop-blur-sm z-10">
            {/* Submit Button */}
            <button
              onClick={async () => {
                if (!pollQuestion.trim()) {
                  alert('Please enter a question for your poll.');
                  return;
                }
                if (!pollOption1.trim() || !pollOption2.trim()) {
                  alert('Please enter at least two poll options.');
                  return;
                }
                if (showPollOption3 && !pollOption3.trim()) {
                  alert('Please enter the third poll option or remove it.');
                  return;
                }
                if (!user) return;

                setIsUploading(true);
                try {
                  // Create poll story
                  await createStory(
                    user.id,
                    user.handle,
                    selectedMedia || undefined,
                    mediaType || undefined,
                    undefined, // text
                    storyLocation.trim() || undefined,
                    undefined, // textColor
                    undefined, // textSize
                    sharedPostInfo?.postId,
                    sharedPostInfo?.userId,
                    undefined, // textStyle
                    undefined, // stickers
                    undefined, // taggedUsers
                    {
                      question: pollQuestion.trim(),
                      option1: pollOption1.trim(),
                      option2: pollOption2.trim(),
                      option3: showPollOption3 && pollOption3.trim() ? pollOption3.trim() : undefined
                    } // poll data
                  );

                  // Dispatch event to refresh story indicators
                  window.dispatchEvent(new CustomEvent('storyCreated', {
                    detail: { userHandle: user.handle }
                  }));

                  navigate('/feed');
                } catch (error) {
                  console.error('Error creating poll story:', error);
                  alert('Failed to create poll. Please try again.');
                } finally {
                  setIsUploading(false);
                }
              }}
              disabled={isUploading || !pollQuestion.trim() || !pollOption1.trim() || !pollOption2.trim() || (showPollOption3 && !pollOption3.trim())}
              className="px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Posting...' : 'Post Poll'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedMedia) {
    // Initial state - no media selected
    if (textOnlyMode) {
      // Text-only mode
      return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-pink-500 via-purple-600 to-purple-700">
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
            <div className="w-10" />
            <div className="w-10" />
          </div>

          {/* Main Content Area - bounded scroll region (TikTok-style: text canvas between header and footer) */}
          <div 
            ref={containerRef}
            className={`flex-1 min-h-0 flex items-center ${keyboardOffset > 0 ? 'justify-start pt-6' : 'justify-center'} relative overflow-y-auto`}
            style={{
              background: background.includes('gradient') 
                ? undefined 
                : background,
              backgroundImage: background.includes('gradient') 
                ? background 
                : undefined,
              touchAction: 'pan-y' // Allow vertical scrolling but prevent horizontal interference
            }}
            onClick={(e) => {
              // Deselect GIF overlay and tagged users when clicking on background
              if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
                setSelectedGifOverlay(null);
                setSelectedTaggedUser(null);
              }
            }}
            onTouchStart={(e) => {
              // Only deselect if touching the background, not a sticker/tagged user
              const target = e.target as HTMLElement;
              // Check if touch is on a sticker or tagged user
              const isSticker = target.closest('[data-sticker]') || target.closest('.sticker-content');
              const isTaggedUser = target.closest('[data-tagged-user]') || target.closest('.tagged-user-content');
              
              // Don't interfere with sticker/tagged user touches - let them handle it
              if (isSticker || isTaggedUser) {
                e.stopPropagation(); // Stop container from handling it
                return; // Let the sticker/tagged user handle the touch
              }
              
              // Only deselect if touching the actual background
              if (target === e.currentTarget || (target.tagName === 'DIV' && !isSticker && !isTaggedUser)) {
                setSelectedGifOverlay(null);
                setSelectedTaggedUser(null);
              }
            }}
          >
            {/* Text Display Area */}
            <div 
              className={`w-full min-h-full flex flex-col items-center ${keyboardOffset > 0 ? 'justify-start pt-4' : 'justify-center'} px-4 pb-4 pointer-events-none max-w-full overflow-hidden`}
              onTouchStart={(e) => {
                // Focus textarea when tapping on text area (but not on stickers/tagged users)
                const target = e.target as HTMLElement;
                if (!target.closest('[data-sticker]') && !target.closest('.sticker-content') && !target.closest('[data-tagged-user]') && !target.closest('.tagged-user-content')) {
                  // Native listeners on stickers/tagged users will have already handled their touches
                  // So we can safely focus the textarea
                  textAreaRef.current?.focus();
                }
              }}
              onClick={(e) => {
                // Focus textarea when clicking on text area (but not on stickers/tagged users)
                const target = e.target as HTMLElement;
                if (!target.closest('[data-sticker]') && !target.closest('.sticker-content') && !target.closest('[data-tagged-user]') && !target.closest('.tagged-user-content')) {
                  textAreaRef.current?.focus();
                }
              }}
            >
              {!text.trim() ? (
                <div className="text-white/60 text-lg font-medium">
                  Tap to type
                </div>
              ) : (
                <div
                  className={`text-center w-full max-w-full overflow-hidden ${getTextSizeClass()}`}
                  style={{ color: textColor, fontFamily: textFontFamily }}
                >
                  <div className="leading-relaxed whitespace-pre-wrap font-bold drop-shadow-lg break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%' }}>
                    {text}
                  </div>
                </div>
              )}
            </div>

            {/* Tagged Users Display - Draggable - OUTSIDE text display area so pointer events work */}
            {taggedUsers.length > 0 && containerSize.width > 0 && (
              <>
                {taggedUsers.map((taggedUser) => (
                  <TaggedUserOverlay
                    key={taggedUser.id}
                    taggedUser={taggedUser}
                    onUpdate={(updated) => {
                      setTaggedUsers(taggedUsers.map(tu => tu.id === taggedUser.id ? updated : tu));
                    }}
                    onRemove={() => {
                      setTaggedUsers(taggedUsers.filter(tu => tu.id !== taggedUser.id));
                      if (selectedTaggedUser === taggedUser.id) {
                        setSelectedTaggedUser(null);
                      }
                    }}
                    isSelected={selectedTaggedUser === taggedUser.id}
                    onSelect={() => setSelectedTaggedUser(taggedUser.id)}
                    containerWidth={containerSize.width || 400}
                    containerHeight={containerSize.height || 400}
                    isModalOpen={showGifPicker || showStickerPicker || showUserTagging || showBackgroundPicker || showTextColorPicker}
                    containerRef={containerRef}
                  />
                ))}
              </>
            )}

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
                    isModalOpen={showGifPicker || showStickerPicker || showUserTagging || showBackgroundPicker || showTextColorPicker || showLinkModal}
                  />
                ))}
              </>
            )}

            {/* Link Overlays */}
            {linkOverlays.length > 0 && containerSize.width > 0 && (
              <>
                {linkOverlays.map((overlay) => (
                  <StickerOverlayComponent
                    key={overlay.id}
                    overlay={overlay}
                    onUpdate={(updated) => handleUpdateLinkOverlay(overlay.id, updated)}
                    onRemove={() => handleRemoveLinkOverlay(overlay.id)}
                    isSelected={selectedLinkOverlay === overlay.id}
                    onSelect={() => setSelectedLinkOverlay(overlay.id)}
                    containerWidth={containerSize.width || 400}
                    containerHeight={containerSize.height || 400}
                    isModalOpen={showGifPicker || showStickerPicker || showUserTagging || showBackgroundPicker || showTextColorPicker || showLinkModal}
                  />
                ))}
              </>
            )}

            {/* Text Input - Overlay for typing */}
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={(e) => {
                if (e.target.value.length <= 300) {
                  setText(e.target.value);
                }
              }}
              onClick={(e) => {
                // Don't block if clicking on a sticker or tagged user
                const target = e.target as HTMLElement;
                if (target.closest('[data-sticker]') || target.closest('.sticker-content') || target.closest('[data-tagged-user]') || target.closest('.tagged-user-content')) {
                  return; // Let sticker/tagged user handle the click
                }
                e.stopPropagation();
              }}
              // Touch events are handled by native listeners on stickers/tagged users with capture phase
              // They handle their touches first, so textarea can have pointerEvents: 'auto' without interfering
              className="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-white resize-none cursor-text"
              placeholder=""
              style={{ 
                fontSize: '16px',
                pointerEvents: 'auto', // Allow text input - native touch listeners on stickers/tagged users handle their touches first
                zIndex: 1, // Lower than stickers (zIndex 50-100)
                touchAction: 'auto' // Allow normal touch behavior for text input
              }}
              maxLength={300}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
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
            </div>

            {/* Character Counter */}
            {text.length > 0 && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
                <div className={`px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm ${
                  text.length > 270 
                    ? text.length >= 300 
                      ? 'bg-red-500/80 text-white' 
                      : 'bg-yellow-500/80 text-white'
                    : 'bg-black/50 text-white'
                }`}>
                  {text.length}/300
                </div>
              </div>
            )}

          </div>

          {/* Fixed footer: templates row + controls bar (outside scroll area so it never covers text) */}
          <div
            className="flex-shrink-0 left-0 right-0 bg-black/20 backdrop-blur-sm z-10"
            style={{
              marginBottom: keyboardOffset > 0 ? keyboardOffset : 0,
              transition: 'margin-bottom 0.18s ease-out',
            }}
          >
              {/* Templates carousel (TikTok-style) */}
              <div className="flex gap-2 overflow-x-auto px-4 pt-2 pb-2">
                {TEXT_STORY_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTextTemplate(tpl.id)}
                    className={`flex flex-col items-center gap-1 flex-shrink-0 ${
                      textTemplateId === tpl.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-14 h-20 rounded-xl shadow-sm flex items-center justify-center text-[10px] font-semibold ${
                        textTemplateId === tpl.id ? 'ring-2 ring-white' : ''
                      }`}
                      style={{ background: tpl.background, color: tpl.textColor }}
                    >
                      Aa
                    </div>
                    <span className="text-[9px] text-white/90">{tpl.name}</span>
                  </button>
                ))}
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-center gap-6 px-4 pb-4 pt-1">
                {/* Story Location / Venue Button */}
                <button
                  onClick={() => setShowStoryLocationSheet(true)}
                  className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                  aria-label="Add story location and venue"
                >
                  <FiMapPin className="w-5 h-5" />
                </button>

                {/* Sticker Button (moved from header) */}
                <button
                  onClick={() => setShowStickerPicker(true)}
                  className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                  aria-label="Add stickers"
                >
                  <FiSmile className="w-5 h-5" />
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

                {/* Add Link Button */}
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors relative"
                  aria-label="Add Link"
                >
                  <FiLink className="w-5 h-5" />
                  {linkOverlays.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full text-xs flex items-center justify-center text-white">
                      {linkOverlays.length}
                    </span>
                  )}
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
              onSelectUser={(handle, _displayName) => {
                if (!taggedUsers.some(tu => tu.handle === handle)) {
                  const newTaggedUser = {
                    handle,
                    x: 50, // Default center position
                    y: 50,
                    id: `tagged-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
                  };
                  setTaggedUsers([...taggedUsers, newTaggedUser]);
                  setSelectedTaggedUser(newTaggedUser.id);
                }
              }}
              taggedUsers={taggedUsers.map(tu => tu.handle)}
            />
          )}

          {/* Link Modal */}
          {showLinkModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Add Link</h2>
                  <button
                    onClick={() => setShowLinkModal(false)}
                    className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <FiX className="w-5 h-5 text-white" />
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const url = formData.get('url') as string;
                    const name = formData.get('name') as string;
                    if (url) {
                      handleAddLink(url, name || '');
                      setShowLinkModal(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Link Name / Description
                    </label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g., Check out my website"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL
                    </label>
                    <input
                      type="url"
                      name="url"
                      placeholder="https://example.com"
                      required
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLinkModal(false)}
                      className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                      Add Link
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Story Location / Venue Sheet (text-only mode) */}
          {showStoryLocationSheet && (
            <div
              className="fixed inset-0 z-[220] flex items-end bg-black/70 backdrop-blur-sm"
              onClick={() => setShowStoryLocationSheet(false)}
            >
              <div
                className="w-full max-h-[75vh] bg-[#050816] rounded-t-2xl border-t border-white/10 p-4 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FiMapPin className="w-4 h-4 text-white/80" />
                    <h2 className="text-white text-base font-semibold">Story location</h2>
                  </div>
                  <button
                    onClick={() => setShowStoryLocationSheet(false)}
                    className="p-1.5 rounded-full text-white/70 hover:bg-white/10 transition-colors"
                    aria-label="Close"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Location (shown at top of story and in feed carousel)
                    </label>
                    <input
                      type="text"
                      value={storyLocation}
                      onChange={(e) => setStoryLocation(e.target.value)}
                      placeholder="e.g. Dublin, Ireland"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-900 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={60}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Venue (café, stadium, park, etc.)
                    </label>
                    <input
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder="e.g. Phoenix Park, Local café"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-900 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={60}
                    />
                  </div>

                  <div className="rounded-2xl bg-gray-900/60 border border-white/10 p-3 text-xs text-gray-400">
                    Your location and venue help other users discover where this story is from.
                  </div>

                  <button
                    onClick={() => setShowStoryLocationSheet(false)}
                    className="w-full py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Original upload UI - fixed viewport, no scrolling (fixed so parent scroll cannot affect it)
    return (
      <div className="fixed inset-0 w-full h-full overflow-hidden flex flex-col bg-black">
        {/* Header */}
        <div className="flex-shrink-0 z-10 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-sm p-4">
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
            <div className="w-10"></div>
            <div className="flex items-center">
              <span className="text-white font-light text-base tracking-tight">Clips 24</span>
            </div>
          </div>
        </div>

        {/* Main Upload Area - fills remaining space, no scroll */}
        <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-6">
          <div className="text-center max-w-md">
            {/* Camera Icon with Gradient Border (blue–purple) */}
            <button
              onClick={handleCameraClick}
              className="relative mx-auto mb-6 w-32 h-32 cursor-pointer hover:scale-105 transition-transform"
            >
              {/* Outer border: linear gradient blue → purple */}
              <div
                className="w-32 h-32 rounded-full p-[3px] absolute top-0 left-0"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #a855f7)',
                }}
              >
                {/* Inner container */}
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center relative overflow-visible">
                  <FiCamera className="w-16 h-16 text-white relative z-10" />
                </div>
                
                {/* + icon overlay sitting on the border (same style as follow button) */}
                <div 
                  className="absolute w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-600 border-2 border-white flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg z-30 pointer-events-none"
                  style={{
                    bottom: '6px',
                    right: '6px',
                  }}
                >
                  <FiPlus className="w-3 h-3 text-white" strokeWidth={2.5} />
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

            {/* Upload Button - Sticker Style */}
            <div className="block mb-4 flex justify-center">
              <label className="cursor-pointer inline-block">
                <div className="relative group transition-transform hover:scale-105 active:scale-95"
                  style={{ 
                    filter: 'drop-shadow(0 3px 8px rgba(0, 0, 0, 0.25))'
                  }}
                >
                  <div 
                    className="px-5 py-3.5 rounded-2xl relative overflow-visible"
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%)',
                      border: '2.5px solid rgba(255, 255, 255, 0.9)',
                      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    {/* Decorative elements */}
                    <div className="absolute top-1 left-2 text-lg opacity-80">📷</div>
                    <div className="absolute top-0.5 right-2.5 text-base opacity-60">🎬</div>
                    <div className="absolute bottom-1 left-2.5 text-sm opacity-50">✨</div>
                    
                    {/* Text */}
                    <div className="relative z-10">
                      <div className="text-white font-bold text-sm tracking-tight" style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}>
                        Select Photo or Video
                      </div>
                    </div>
                    
                    {/* Plus icon on border */}
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg z-20">
                      <span className="text-white text-[8px] font-bold">+</span>
                    </div>
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
            </div>
            
            {/* Hidden Camera Input - Camera Only (Photo) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleMediaSelect}
              className="hidden"
            />

            {/* Text-only, Ask a Question, and Poll stickers have been removed to keep stories focused on photo and video only */}
          </div>
        </div>

        {/* Gradient Background Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-blue-500/10 to-blue-600/10 pointer-events-none"></div>
      </div>
    );
  }

  // Media selected - new full screen editing mode (similar to text-only mode)
  if (selectedMedia && !pollMode && !questionMode && !replyToQuestion) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm">
          <button
            onClick={() => {
              removeMedia();
              setTextStickers([]);
              setLocationStickers([]);
              setLinkOverlays([]);
              setTaggedUsers([]);
            }}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="Back"
          >
            <FiX className="w-6 h-6" />
          </button>
          <h1 className="text-white font-semibold text-base">Your Story</h1>
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className="px-4 py-2 bg-white text-black rounded-full font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Posting...' : 'Post'}
          </button>
        </div>

        {/* Main Content Area - Media as Background */}
        <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center relative overflow-hidden"
          onClick={(e) => {
            // Deselect stickers when clicking on background
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
              setSelectedGifOverlay(null);
              setSelectedLinkOverlay(null);
              setSelectedTextSticker(null);
              setSelectedLocationSticker(null);
              setSelectedTaggedUser(null);
            }
          }}
          onTouchStart={(e) => {
            const target = e.target as HTMLElement;
            const isSticker = target.closest('[data-sticker]') || target.closest('.sticker-content');
            const isTaggedUser = target.closest('[data-tagged-user]') || target.closest('.tagged-user-content');
            
            if (isSticker || isTaggedUser) {
              e.stopPropagation();
              return;
            }
            
            if (target === e.currentTarget || (target.tagName === 'DIV' && !isSticker && !isTaggedUser)) {
              setSelectedGifOverlay(null);
              setSelectedLinkOverlay(null);
              setSelectedTextSticker(null);
              setSelectedLocationSticker(null);
              setSelectedTaggedUser(null);
            }
          }}
          style={{ touchAction: 'pan-y' }}
        >
          {/* Media Background */}
          {mediaType === 'image' ? (
            <img
              src={selectedMedia}
              alt="Story background"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <video
              src={selectedMedia}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          )}

          {/* Sticker Overlays - Text Stickers */}
          {textStickers.length > 0 && (
            <>
              {textStickers.map((overlay) => {
                // Calculate container dimensions if not set
                const containerWidth = containerSize.width || (containerRef.current?.getBoundingClientRect().width || window.innerWidth);
                const containerHeight = containerSize.height || (containerRef.current?.getBoundingClientRect().height || window.innerHeight);
                return (
                  <StickerOverlayComponent
                    key={overlay.id}
                    overlay={overlay}
                    onUpdate={(updated) => {
                      setTextStickers(prev => prev.map(o => o.id === overlay.id ? updated : o));
                    }}
                    onRemove={() => {
                      setTextStickers(prev => prev.filter(o => o.id !== overlay.id));
                      if (selectedTextSticker === overlay.id) {
                        setSelectedTextSticker(null);
                      }
                    }}
                    isSelected={selectedTextSticker === overlay.id}
                    onSelect={() => setSelectedTextSticker(overlay.id)}
                    containerWidth={containerWidth}
                    containerHeight={containerHeight}
                    isModalOpen={showTextCard || showLocationCard || showLinkCard || showTagUserCard}
                  />
                );
              })}
            </>
          )}

          {/* Sticker Overlays - Location Stickers */}
          {locationStickers.length > 0 && (
            <>
              {locationStickers.map((overlay) => {
                // Calculate container dimensions if not set
                const containerWidth = containerSize.width || (containerRef.current?.getBoundingClientRect().width || window.innerWidth);
                const containerHeight = containerSize.height || (containerRef.current?.getBoundingClientRect().height || window.innerHeight);
                return (
                  <StickerOverlayComponent
                    key={overlay.id}
                    overlay={overlay}
                    onUpdate={(updated) => {
                      setLocationStickers(prev => prev.map(o => o.id === overlay.id ? updated : o));
                    }}
                    onRemove={() => {
                      setLocationStickers(prev => prev.filter(o => o.id !== overlay.id));
                      if (selectedLocationSticker === overlay.id) {
                        setSelectedLocationSticker(null);
                      }
                    }}
                    isSelected={selectedLocationSticker === overlay.id}
                    onSelect={() => setSelectedLocationSticker(overlay.id)}
                    containerWidth={containerWidth}
                    containerHeight={containerHeight}
                    isModalOpen={showTextCard || showLocationCard || showLinkCard || showTagUserCard}
                  />
                );
              })}
            </>
          )}

          {/* Tagged Users Display */}
          {taggedUsers.length > 0 && (
            <>
              {taggedUsers.map((taggedUser) => {
                // Calculate container dimensions if not set
                const containerWidth = containerSize.width || (containerRef.current?.getBoundingClientRect().width || window.innerWidth);
                const containerHeight = containerSize.height || (containerRef.current?.getBoundingClientRect().height || window.innerHeight);
                return (
                  <TaggedUserOverlay
                    key={taggedUser.id}
                    taggedUser={taggedUser}
                    onUpdate={(updated) => {
                      setTaggedUsers(prev => prev.map(tu => tu.id === taggedUser.id ? updated : tu));
                    }}
                    onRemove={() => {
                      setTaggedUsers(prev => prev.filter(tu => tu.id !== taggedUser.id));
                      if (selectedTaggedUser === taggedUser.id) {
                        setSelectedTaggedUser(null);
                      }
                    }}
                    isSelected={selectedTaggedUser === taggedUser.id}
                    onSelect={() => setSelectedTaggedUser(taggedUser.id)}
                    containerWidth={containerWidth}
                    containerHeight={containerHeight}
                    isModalOpen={showTextCard || showLocationCard || showLinkCard || showTagUserCard}
                    containerRef={containerRef}
                  />
                );
              })}
            </>
          )}

          {/* GIF Overlays */}
          {gifOverlays.length > 0 && (
            <>
              {gifOverlays.map((overlay) => {
                // Calculate container dimensions if not set
                const containerWidth = containerSize.width || (containerRef.current?.getBoundingClientRect().width || window.innerWidth);
                const containerHeight = containerSize.height || (containerRef.current?.getBoundingClientRect().height || window.innerHeight);
                return (
                  <StickerOverlayComponent
                    key={overlay.id}
                    overlay={overlay}
                    onUpdate={(updated) => handleUpdateGifOverlay(overlay.id, updated)}
                    onRemove={() => handleRemoveGifOverlay(overlay.id)}
                    isSelected={selectedGifOverlay === overlay.id}
                    onSelect={() => setSelectedGifOverlay(overlay.id)}
                    containerWidth={containerWidth}
                    containerHeight={containerHeight}
                    isModalOpen={showTextCard || showLocationCard || showLinkCard || showTagUserCard || showGifPicker || showStickerPicker || showUserTagging || showBackgroundPicker || showTextColorPicker || showLinkModal}
                  />
                );
              })}
            </>
          )}

          {/* Link Overlays */}
          {linkOverlays.length > 0 && (
            <>
              {linkOverlays.map((overlay) => {
                // Calculate container dimensions if not set
                const containerWidth = containerSize.width || (containerRef.current?.getBoundingClientRect().width || window.innerWidth);
                const containerHeight = containerSize.height || (containerRef.current?.getBoundingClientRect().height || window.innerHeight);
                return (
                  <StickerOverlayComponent
                    key={overlay.id}
                    overlay={overlay}
                    onUpdate={(updated) => handleUpdateLinkOverlay(overlay.id, updated)}
                    onRemove={() => handleRemoveLinkOverlay(overlay.id)}
                    isSelected={selectedLinkOverlay === overlay.id}
                    onSelect={() => setSelectedLinkOverlay(overlay.id)}
                    containerWidth={containerWidth}
                    containerHeight={containerHeight}
                    isModalOpen={showTextCard || showLocationCard || showLinkCard || showTagUserCard || showGifPicker || showStickerPicker || showUserTagging || showBackgroundPicker || showTextColorPicker || showLinkModal}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* Footer with Icon Buttons */}
        <svg width="0" height="0" className="absolute" aria-hidden>
          <defs>
            <linearGradient id="clipPageIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 p-4 bg-black/20 backdrop-blur-sm z-10">
          {/* Add Text Button - gradient border */}
          <div className="rounded-full p-[2px] flex-shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
            <button
              onClick={() => {
                setShowTextCard(true);
                setShowLocationCard(false);
                setShowLinkCard(false);
                setShowTagUserCard(false);
              }}
              className="p-3 bg-black/80 hover:bg-black/90 rounded-full text-white transition-colors relative"
              aria-label="Add Text"
            >
              <FiType className="w-5 h-5 shrink-0" style={{ stroke: 'url(#clipPageIconGrad)', fill: 'none' }} />
            {textStickers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full text-xs flex items-center justify-center text-white">
                {textStickers.length}
              </span>
            )}
            </button>
          </div>

          {/* Add Location Button - gradient border */}
          <div className="rounded-full p-[2px] flex-shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
            <button
              onClick={() => {
                setShowLocationCard(true);
                setShowTextCard(false);
                setShowLinkCard(false);
                setShowTagUserCard(false);
              }}
              className="p-3 bg-black/80 hover:bg-black/90 rounded-full text-white transition-colors relative"
              aria-label="Add Location"
            >
              <FiMapPin className="w-5 h-5 shrink-0" style={{ stroke: 'url(#clipPageIconGrad)', fill: 'none' }} />
              {locationStickers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full text-xs flex items-center justify-center text-white">
                  {locationStickers.length}
                </span>
              )}
            </button>
          </div>

          {/* Add Link Button - gradient border */}
          <div className="rounded-full p-[2px] flex-shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
            <button
              onClick={() => {
                setShowLinkCard(true);
                setShowTextCard(false);
                setShowLocationCard(false);
                setShowTagUserCard(false);
              }}
              className="p-3 bg-black/80 hover:bg-black/90 rounded-full text-white transition-colors relative"
              aria-label="Add Link"
            >
              <FiLink className="w-5 h-5 shrink-0" style={{ stroke: 'url(#clipPageIconGrad)', fill: 'none' }} />
              {linkOverlays.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full text-xs flex items-center justify-center text-white">
                  {linkOverlays.length}
                </span>
              )}
            </button>
          </div>

          {/* Tag User Button - gradient border */}
          <div className="rounded-full p-[2px] flex-shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
            <button
              onClick={() => {
                setShowTagUserCard(true);
                setShowTextCard(false);
                setShowLocationCard(false);
                setShowLinkCard(false);
              }}
              className="p-3 bg-black/80 hover:bg-black/90 rounded-full text-white transition-colors relative"
              aria-label="Tag User"
            >
              <FiUser className="w-5 h-5 shrink-0" style={{ stroke: 'url(#clipPageIconGrad)', fill: 'none' }} />
              {taggedUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                  {taggedUsers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Text Card Modal */}
        {showTextCard && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="rounded-2xl p-[2px] max-w-md w-full mx-4" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
              <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
                <defs>
                  <linearGradient id="clipPageTextCardIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="bg-gray-900 rounded-[14px] p-6 w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FiType className="w-6 h-6 shrink-0" style={{ stroke: 'url(#clipPageTextCardIconGrad)', fill: 'none', strokeWidth: 2 }} />
                  <h2 className="text-xl font-bold text-white">Add Text</h2>
                </div>
                <button
                  onClick={() => setShowTextCard(false)}
                  className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                  <FiX className="w-5 h-5 text-white" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const textContent = formData.get('text') as string;
                  // Use state values for color and size
                  const textColorValue = textColors[textColor as keyof typeof textColors] || textColor || '#FFFFFF';
                  const fontSizeValue = textSize || 'medium';
                  if (textContent && textContent.trim()) {
                    const textSticker: StickerOverlay = {
                      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                      stickerId: `text-${textContent}`,
                      sticker: {
                        id: `text-${textContent}`,
                        name: textContent,
                        category: 'Text',
                        emoji: undefined,
                        url: undefined,
                        isTrending: false
                      },
                      x: 50,
                      y: 50,
                      scale: 1.0,
                      rotation: 0,
                      opacity: 1,
                      textContent: textContent.trim(),
                      textColor: textColorValue,
                      fontSize: fontSizeValue
                    };
                    setTextStickers([...textStickers, textSticker]);
                    setSelectedTextSticker(textSticker.id);
                    setShowTextCard(false);
                    // Reset form
                    (e.target as HTMLFormElement).reset();
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Text
                  </label>
                  <textarea
                    name="text"
                    placeholder="Enter your text..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    rows={3}
                    maxLength={100}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Text Color
                  </label>
                  <div className="grid grid-cols-8 gap-2">
                    {Object.entries(textColors).map(([name, color]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setTextColor(name)}
                        className={`w-10 h-10 rounded-full border-2 ${textColor === name ? 'border-white ring-2 ring-purple-500' : 'border-gray-600'}`}
                        style={{ backgroundColor: color }}
                        title={name}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Font Size
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setTextSize(size)}
                        className={`py-2 rounded-xl border-2 font-medium transition-all ${
                          textSize === size
                            ? 'border-white bg-white text-black'
                            : 'border-gray-600 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowTextCard(false)}
                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    Add Text
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {/* Location Card Modal */}
        {showLocationCard && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="rounded-2xl p-[2px] max-w-md w-full mx-4" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
              <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
                <defs>
                  <linearGradient id="clipPageLocationCardIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="bg-gray-900 rounded-[14px] p-6 w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FiMapPin className="w-6 h-6 shrink-0" style={{ stroke: 'url(#clipPageLocationCardIconGrad)', fill: 'none', strokeWidth: 2 }} />
                  <h2 className="text-xl font-bold text-white">Add Location</h2>
                </div>
                <button
                  onClick={() => setShowLocationCard(false)}
                  className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                  <FiX className="w-5 h-5 text-white" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const locationText = formData.get('location') as string;
                  if (locationText) {
                    const locationSticker: StickerOverlay = {
                      id: `location-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                      stickerId: `location-${locationText}`,
                      sticker: {
                        id: `location-${locationText}`,
                        name: locationText,
                        category: 'Location',
                        emoji: undefined,
                        url: undefined,
                        isTrending: false
                      },
                      x: 50,
                      y: 50,
                      scale: 0.9,
                      rotation: 0,
                      opacity: 1,
                      textContent: locationText,
                      textColor: '#FFFFFF',
                      fontSize: 'small'
                    };
                    setLocationStickers([...locationStickers, locationSticker]);
                    setSelectedLocationSticker(locationSticker.id);
                    setShowLocationCard(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    placeholder="e.g., Dublin, Ireland"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    maxLength={50}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLocationCard(false)}
                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    Add Location
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {/* Link Card Modal */}
        {showLinkCard && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="rounded-2xl p-[2px] max-w-md w-full mx-4" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
              <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
                <defs>
                  <linearGradient id="clipPageLinkCardIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="bg-gray-900 rounded-[14px] p-6 w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FiLink className="w-6 h-6 shrink-0" style={{ stroke: 'url(#clipPageLinkCardIconGrad)', fill: 'none', strokeWidth: 2 }} />
                  <h2 className="text-xl font-bold text-white">Add Link</h2>
                </div>
                <button
                  onClick={() => setShowLinkCard(false)}
                  className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                  <FiX className="w-5 h-5 text-white" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const url = formData.get('url') as string;
                  const name = formData.get('name') as string;
                  if (url) {
                    handleAddLink(url, name || '');
                    setShowLinkCard(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Link Name / Description
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="e.g., Check out my website"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    URL
                  </label>
                  <input
                    type="url"
                    name="url"
                    placeholder="https://example.com"
                    required
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLinkCard(false)}
                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    Add Link
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {/* Tag User Card Modal */}
        {showTagUserCard && (
          <UserTaggingModal
            isOpen={showTagUserCard}
            onClose={() => setShowTagUserCard(false)}
            onSelectUser={(handle, _displayName) => {
              if (!taggedUsers.some(tu => tu.handle === handle)) {
                const newTaggedUser = {
                  handle,
                  x: 50,
                  y: 50,
                  id: `tagged-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
                };
                setTaggedUsers([...taggedUsers, newTaggedUser]);
                setSelectedTaggedUser(newTaggedUser.id);
                setShowTagUserCard(false);
              }
            }}
            taggedUsers={taggedUsers.map(tu => tu.handle)}
          />
        )}
      </div>
    );
  }

  // Media selected - full screen preview (original - for reply to question and other special cases)
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
          <h1 className="text-white font-semibold text-base">
            {replyToQuestion ? 'Reply to Question' : 'Your Story'}
          </h1>
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
              className="px-4 py-2 bg-transparent text-white rounded-full hover:bg-white/10 transition-colors font-semibold text-sm"
            >
              Next
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
            {/* Question Reply Overlay - Show the response */}
            {replyToQuestion && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[80%]">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border-2 border-purple-500">
                  <p className="text-xs text-gray-500 mb-1 font-semibold">Question:</p>
                  <p className="text-sm text-gray-700 mb-3 font-medium">{replyToQuestion.question || 'Ask me anything'}</p>
                  <p className="text-xs text-gray-500 mb-1 font-semibold">Response from {replyToQuestion.responderHandle}:</p>
                  <p className="text-base text-gray-900 font-semibold">{replyToQuestion.response}</p>
                </div>
              </div>
            )}
            
            {/* Text Overlay Preview - Your reply */}
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
            {/* Question Reply Overlay - Show the response */}
            {replyToQuestion && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[80%]">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border-2 border-purple-500">
                  <p className="text-xs text-gray-500 mb-1 font-semibold">Question:</p>
                  <p className="text-sm text-gray-700 mb-3 font-medium">{replyToQuestion.question || 'Ask me anything'}</p>
                  <p className="text-xs text-gray-500 mb-1 font-semibold">Response from {replyToQuestion.responderHandle}:</p>
                  <p className="text-base text-gray-900 font-semibold">{replyToQuestion.response}</p>
                </div>
              </div>
            )}
            
            {/* Text Overlay Preview - Your reply */}
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
                  placeholder={replyToQuestion ? "Type your reply..." : "Type your story text..."}
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

            {/* Venue Input - shown in metadata carousel when story appears on feed */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <FiMapPin className="w-4 h-4" />
                Add Venue
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. café, stadium, park"
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

      {/* Story Location / Venue Sheet for text-only stories */}
      {showStoryLocationSheet && (
        <div
          className="fixed inset-0 z-[220] flex items-end bg-black/70 backdrop-blur-sm"
          onClick={() => setShowStoryLocationSheet(false)}
        >
          <div
            className="w-full max-h-[75vh] bg-[#050816] rounded-t-2xl border-t border-white/10 p-4 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FiMapPin className="w-4 h-4 text-white/80" />
                <h2 className="text-white text-base font-semibold">Story location</h2>
              </div>
              <button
                onClick={() => setShowStoryLocationSheet(false)}
                className="p-1.5 rounded-full text-white/70 hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Location input */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Location (shown at top of story and in feed carousel)
                </label>
                <input
                  type="text"
                  value={storyLocation}
                  onChange={(e) => setStoryLocation(e.target.value)}
                  placeholder="e.g. Dublin, Ireland"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-900 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={60}
                />
              </div>

              {/* Venue input */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Venue (café, stadium, park, etc.)
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Phoenix Park, Local café"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-900 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={60}
                />
              </div>

              <div className="rounded-2xl bg-gray-900/60 border border-white/10 p-3 text-xs text-gray-400">
                Your location and venue help other users discover where this story is from.
              </div>

              <button
                onClick={() => setShowStoryLocationSheet(false)}
                className="w-full py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                Done
              </button>
            </div>
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
            if (!fullPost || !user?.id || !user?.handle) return;
            await reclipPost(user.id, fullPost.id, user.handle);
          }}
        />
      )}

      {/* Link Modal - Accessible from all modes */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Add Link</h2>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5 text-white" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const url = formData.get('url') as string;
                const name = formData.get('name') as string;
                if (url) {
                  handleAddLink(url, name || '');
                  setShowLinkModal(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Link Name / Description
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g., Check out my website"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  name="url"
                  placeholder="https://example.com"
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  Add Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}