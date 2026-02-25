import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiX, FiHeart, FiShare2, FiRepeat, FiMapPin, FiVolume2, FiVolumeX, FiMessageSquare, FiMessageCircle, FiChevronUp, FiChevronDown, FiBookmark, FiMoreHorizontal, FiSend, FiSmile } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import SavePostModal from './SavePostModal';
import PostMenuModal from './PostMenuModal';
import Avatar from './Avatar';
import ShareModal from './ShareModal';
import StickerOverlayComponent from './StickerOverlay';
import EffectWrapper from './EffectWrapper';
import Flag from './Flag';
import type { EffectConfig } from '../utils/effects';
import { useAuth } from '../context/Auth';
import { useOnline } from '../hooks/useOnline';
import { addComment, addReply, fetchComments, toggleCommentLike, toggleReplyLike } from '../api/posts';
import { getCollectionsForPost } from '../api/collections';
import { isProfilePrivate, canSendMessage, hasPendingFollowRequest, createFollowRequest } from '../api/privacy';
import { getFollowedUsers, setFollowState } from '../api/posts';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import type { Comment } from '../types';
import { enqueue } from '../utils/mutationQueue';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import type { Post } from '../types';
import { DOUBLE_TAP_THRESHOLD, ANIMATION_DURATIONS } from '../constants';
import StreetSign from './StreetSign';

/** Radiating red/pink lines burst for YouTube Shorts-style double-tap like (used in Scenes). */
function ShortsLikeBurstLines() {
    const id = React.useId().replace(/:/g, '');
    const cx = 50;
    const cy = 50;
    const count = 36;
    const lines = React.useMemo(() => {
        return Array.from({ length: count }, (_, i) => {
            const angle = (i * 360) / count * (Math.PI / 180);
            const r = 38 + (i % 3) * 4;
            const x2 = cx + r * Math.cos(angle);
            const y2 = cy + r * Math.sin(angle);
            const stroke = i % 2 === 0 ? `url(#${id}-red)` : `url(#${id}-pink)`;
            const strokeWidth = i % 2 === 0 ? 2.2 : 1.6;
            return { x2, y2, stroke, strokeWidth };
        });
    }, [id]);
    return (
        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
            <defs>
                <linearGradient id={`${id}-red`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ff1744" />
                    <stop offset="100%" stopColor="#e53935" />
                </linearGradient>
                <linearGradient id={`${id}-pink`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f48fb1" />
                    <stop offset="100%" stopColor="#ec407a" />
                </linearGradient>
            </defs>
            <g strokeLinecap="round">
                {lines.map((l, i) => (
                    <line key={i} x1={cx} y1={cy} x2={l.x2} y2={l.y2} stroke={l.stroke} strokeWidth={l.strokeWidth} />
                ))}
            </g>
        </svg>
    );
}

// Thumb drop animation - animates from tap position to like button (YouTube Shorts-style white thumb)
function HeartDropAnimation({ startX, startY, targetElement, onComplete }: { startX: number; startY: number; targetElement: HTMLElement; onComplete: () => void }) {
    const [progress, setProgress] = React.useState(0);
    const [endPosition, setEndPosition] = React.useState<{ x: number; y: number } | null>(null);
    const [isComplete, setIsComplete] = React.useState(false);
    const heartRef = React.useRef<HTMLDivElement>(null);
    const animationFrameRef = React.useRef<number | null>(null);
    const startTimeRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (!targetElement) return;

        // Get target position (like button center)
        try {
            const rect = targetElement.getBoundingClientRect();
            const targetX = rect.left + rect.width / 2;
            const targetY = rect.top + rect.height / 2;
            setEndPosition({ x: targetX, y: targetY });
            startTimeRef.current = Date.now();

            // Animate using requestAnimationFrame
            const animate = () => {
                if (!startTimeRef.current) return;

                const elapsed = Date.now() - startTimeRef.current;
                const duration = 800; // 800ms
                const t = Math.min(elapsed / duration, 1);

                // Ease-in function
                const eased = t * t;
                setProgress(eased);

                if (t < 1) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                } else {
                    // Mark as complete immediately
                    setIsComplete(true);
                    // Cancel any pending animation frames
                    if (animationFrameRef.current) {
                        cancelAnimationFrame(animationFrameRef.current);
                        animationFrameRef.current = null;
                    }
                    // Call onComplete immediately to clean up
                    onComplete();
                }
            };

            animationFrameRef.current = requestAnimationFrame(animate);

            return () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };
        } catch (error) {
            console.error('Error calculating heart animation target:', error);
            setIsComplete(true);
            onComplete();
        }
    }, [targetElement, onComplete]);

    // Don't render if complete or no end position
    if (!endPosition || isComplete) return null;

    const deltaX = endPosition.x - startX;
    const deltaY = endPosition.y - startY;
    const currentX = startX + deltaX * progress;
    const currentY = startY + deltaY * progress;
    const scale = 1 - (progress * 0.7); // Scale from 1 to 0.3
    const opacity = Math.max(0, 1 - progress); // Ensure opacity never goes below 0

    // Don't render if opacity is 0 or very close to 0, or if complete
    if (opacity <= 0.01 || isComplete) return null;

    return (
        <div
            ref={heartRef}
            className="fixed pointer-events-none z-[9999]"
            style={{
                left: `${currentX}px`,
                top: `${currentY}px`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                opacity: opacity,
                transition: 'none',
                willChange: 'transform, opacity'
            }}
        >
            <svg className="w-10 h-10 drop-shadow-lg" viewBox="0 0 24 24" fill="none">
                <path
                    fill="#ffffff"
                    d="M2 9H5V21H2C1.45 21 1 20.55 1 20V10C1 9.45 1.45 9 2 9ZM7.29 7.71L13.69 1.31C13.87 1.13 14.15 1.11 14.35 1.26L15.2 1.9C15.68 2.26 15.9 2.88 15.75 3.47L14.6 8H21C22.1 8 23 8.9 23 10V12.1C23 12.36 22.95 12.62 22.85 12.87L19.76 20.38C19.6 20.76 19.24 21 18.83 21H8C7.45 21 7 20.55 7 20V8.41C7 8.15 7.11 7.89 7.29 7.71Z"
                />
            </svg>
        </div>
    );
}

type ScenesModalProps = {
    post: Post;
    isOpen: boolean;
    initialVideoTime?: number | null;
    initialMutedState?: boolean | null;
    onClose: (savedTime?: number) => void;
    onLike: () => Promise<void>;
    onFollow: () => Promise<boolean | void>;
    onShare: () => Promise<void>;
    onOpenComments: () => void;
    onReclip: () => Promise<void>;
    /** Only for posts the current user created (not reclips). When provided, Boost menu option is shown. */
    onBoost?: () => void;
    /** Feed carousel: list of posts to swipe through (from current feed). When provided, enables vertical swipe between posts. */
    posts?: Post[];
    /** Label for the feed (e.g. "National", "Dublin", "Galway Feed"). Shown at top when in carousel mode. */
    feedLabel?: string;
    /** Called when user swipes to a different post. Pass saved video time for the previous post. */
    onPostChange?: (newIndex: number, savedVideoTime?: number) => void;
};

export default function ScenesModal({
    post,
    isOpen,
    initialVideoTime,
    initialMutedState,
    onClose,
    onLike,
    onFollow,
    onShare,
    onOpenComments: _onOpenComments, // kept for API; we use handleCaptionClick for inline comments
    onReclip,
    onBoost,
    posts,
    feedLabel,
    onPostChange
}: ScenesModalProps) {
    const [liked, setLiked] = React.useState(post.userLiked);
    const [likes, setLikes] = React.useState(post.stats.likes);
    const [comments, setComments] = React.useState(post.stats.comments);
    const [shares, setShares] = React.useState(post.stats.shares);
    const [reclips, setReclips] = React.useState(post.stats.reclips);
    const [isFollowing, setIsFollowing] = React.useState(post.isFollowing);
    const [userReclipped, setUserReclipped] = React.useState(post.userReclipped || false);
    // Separate busy flags so Reclip doesn't visually affect Follow and vice versa
    const [followBusy, setFollowBusy] = React.useState(false);
    const [reclipBusy, setReclipBusy] = React.useState(false);
    const [commentText, setCommentText] = React.useState('');
    const [isAddingComment, setIsAddingComment] = React.useState(false);
    const [heartBurst, setHeartBurst] = React.useState(false);
    const [shareModalOpen, setShareModalOpen] = React.useState(false);
    const [videoProgress, setVideoProgress] = React.useState(0);
    const [isMuted, setIsMuted] = React.useState(initialMutedState !== null ? initialMutedState : true);
    const [isPaused, setIsPaused] = React.useState(false);
    const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false);
    const [commentsList, setCommentsList] = React.useState<Comment[]>([]);
    // Which comment threads have their replies expanded in the Scenes comments sheet
    const [expandedReplyThreads, setExpandedReplyThreads] = React.useState<Record<string, boolean>>({});
    const [isLoadingComments, setIsLoadingComments] = React.useState(false);
    const [replyingToCommentId, setReplyingToCommentId] = React.useState<string | null>(null);
    const [replyInputText, setReplyInputText] = React.useState('');
    const [submittingReplyId, setSubmittingReplyId] = React.useState<string | null>(null);
    const [likingCommentId, setLikingCommentId] = React.useState<string | null>(null);
    const [likingReplyKey, setLikingReplyKey] = React.useState<string | null>(null);
    const [showCommentEmojiPicker, setShowCommentEmojiPicker] = React.useState(false);
    const [sheetDragY, setSheetDragY] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);
    // Height of the comments sheet. Keep it to about half the screen so video stays visible above.
    const [sheetHeight, setSheetHeight] = React.useState('50vh'); // shrinks when keyboard opens
    const sheetRef = React.useRef<HTMLDivElement>(null);
    const dragStartY = React.useRef<number>(0);
    const [tapPosition, setTapPosition] = React.useState<{ x: number; y: number } | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const lastTapRef = React.useRef<number>(0);
    const touchHandledRef = React.useRef<boolean>(false);
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);
    const likeButtonRef = React.useRef<HTMLButtonElement>(null);
    const isProcessingDoubleTap = React.useRef<boolean>(false);
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
    const profileBorderOverlayRef = React.useRef<HTMLDivElement>(null);
    const profileBorderOverlayRef2 = React.useRef<HTMLDivElement>(null);
    const expandedCommentInputRef = React.useRef<HTMLInputElement>(null);
    const { user } = useAuth();
    const online = useOnline();
    const navigate = useNavigate();
    const [saveModalOpen, setSaveModalOpen] = React.useState(false);
    const [isSaved, setIsSaved] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);

    const effectivePosts = React.useMemo(() => (posts && posts.length > 0 ? posts : (post ? [post] : [])), [posts, post]);
    const isCarousel = Boolean(effectivePosts.length > 1);
    const carouselTouchStart = React.useRef<number>(0);
    const carouselTouchHandled = React.useRef(false);
    const [carouselTouchDelta, setCarouselTouchDelta] = React.useState(0);
    const [carouselAnimating, setCarouselAnimating] = React.useState(false);
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

    // Determine if we have multiple media items (carousel)
    const items: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; effects?: Array<any>; text?: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }> = post.mediaItems && post.mediaItems.length > 0
        ? post.mediaItems
        : (post.mediaUrl ? [{ url: post.mediaUrl, type: (post.mediaType || 'image') as 'image' | 'video' }] : []);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const hasMultipleItems = items.length > 1;
    const currentItem = items[currentIndex];

    // Update container size for stickers
    React.useEffect(() => {
        if (mediaContainerRef.current && post.stickers && post.stickers.length > 0) {
            const updateSize = () => {
                const rect = mediaContainerRef.current?.getBoundingClientRect();
                if (rect) {
                    setContainerSize({ width: rect.width, height: rect.height });
                }
            };
            updateSize();
            window.addEventListener('resize', updateSize);
            const observer = new ResizeObserver(updateSize);
            if (mediaContainerRef.current) {
                observer.observe(mediaContainerRef.current);
            }
            return () => {
                window.removeEventListener('resize', updateSize);
                observer.disconnect();
            };
        }
    }, [post.stickers, currentIndex]);

    // Animate profile picture borders on mount (same animation as location newsfeed borders)
    React.useEffect(() => {
        if (!isOpen) return;
        
        const animateBorder = (overlay: HTMLDivElement | null) => {
            if (!overlay) return;
            
            const duration = 1500; // 1.5 seconds
            const startTime = Date.now();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const angle = progress * 360;
                
                // Create mask that reveals progressively going around
                const mask = `conic-gradient(from 0deg, transparent 0deg, transparent ${angle}deg, black ${angle}deg, black 360deg)`;
                overlay.style.maskImage = mask;
                overlay.style.webkitMaskImage = mask;
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation complete - make overlay fully transparent so border is fully visible
                    overlay.style.maskImage = 'conic-gradient(from 0deg, transparent 0deg, transparent 360deg)';
                    overlay.style.webkitMaskImage = 'conic-gradient(from 0deg, transparent 0deg, transparent 360deg)';
                }
            };
            
            // Start animation
            requestAnimationFrame(animate);
        };
        
        // Animate both profile picture borders
        animateBorder(profileBorderOverlayRef.current);
        animateBorder(profileBorderOverlayRef2.current);
    }, [isOpen]);

    // Reset carousel touch delta when closing
    React.useEffect(() => {
        if (!isOpen) setCarouselTouchDelta(0);
    }, [isOpen]);

    // Don't auto-focus the comment input when the sheet opens — on mobile that opens the keyboard
    // and pushes the video off-screen. User can tap the input when they want to type.

    // Lock body scroll when comments sheet is open so video doesn't move (TikTok-style)
    React.useEffect(() => {
        if (!isCaptionExpanded) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isCaptionExpanded]);

    // Shrink sheet when keyboard opens (Visual Viewport API) so video stays visible
    React.useEffect(() => {
        if (!isCaptionExpanded) return;
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => {
            const visible = vv.height;
            const full = window.innerHeight;
            const keyboardOpen = visible < full * 0.85;
            // Use at most ~50% of the screen height so the video area stays in view.
            const maxPx = keyboardOpen ? Math.round(visible * 0.5) : Math.round(full * 0.5);
            setSheetHeight(`${maxPx}px`);
        };
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, [isCaptionExpanded]);

    // Reset video state when switching items
    React.useEffect(() => {
        if (currentItem?.type === 'video' && videoRef.current) {
            // Pause any currently playing video before loading new one
            if (!videoRef.current.paused) {
                videoRef.current.pause();
            }
            videoRef.current.load();
            setVideoProgress(0);
            setIsMuted(true); // Reset to muted when switching videos
            setIsPaused(false); // Reset to playing when switching videos
        }
        // Reset animation states when switching items
        setTapPosition(null);
        setHeartBurst(false);
        isProcessingDoubleTap.current = false;
    }, [currentIndex, currentItem?.type]);

    // Sync video muted state with ref and restore from feed if available
    React.useEffect(() => {
        if (videoRef.current && currentItem?.type === 'video') {
            const video = videoRef.current;
            const shouldBeMuted = !!isMuted;
            
            // Always sync the video's muted property with state
            video.muted = shouldBeMuted;
            
            // If unmuting, ensure video is playing and audio is enabled
            if (!shouldBeMuted) {
                // Double-check muted is false
                video.muted = false;
                
                // Ensure video is playing
                if (video.paused) {
                    video.play().catch(() => { /* ignore */ });
                    setIsPaused(false);
                }
                
                // Use a small delay to ensure the muted state is applied
                const timeoutId = setTimeout(() => {
                    if (videoRef.current && !shouldBeMuted) {
                        videoRef.current.muted = false;
                        if (videoRef.current.paused) {
                            videoRef.current.play().catch(() => { /* ignore */ });
                        }
                    }
                }, 50);
                
                return () => clearTimeout(timeoutId);
            }
        }
    }, [isMuted, currentItem?.type]);

    // Ensure video is paused when isPaused is true (but not when initially loading)
    // This effect only handles pausing, not playing - let autoPlay handle initial playback
    React.useEffect(() => {
        if (videoRef.current && currentItem?.type === 'video' && videoRef.current.readyState >= 2 && isOpen) {
            // Only pause if user explicitly paused (isPaused is true)
            if (isPaused && !videoRef.current.paused) {
                videoRef.current.pause();
                // Also pause all other videos on the page to prevent background audio
                const allVideos = document.querySelectorAll('video');
                allVideos.forEach((video) => {
                    if (video !== videoRef.current && !video.paused) {
                        video.pause();
                    }
                });
            }
            // Don't force play here - let autoPlay attribute handle initial playback
        }
    }, [isPaused, currentItem?.type, isOpen]);

    // Pause all videos on the page when Scenes opens (after a brief delay for smooth transition)
    React.useEffect(() => {
        if (isOpen) {
            // Small delay to allow Scenes video to sync before pausing feed videos
            // This creates a smoother, Instagram-like transition
            const pauseTimer = setTimeout(() => {
            const allVideos = document.querySelectorAll('video');
            allVideos.forEach((video) => {
                    // Don't pause the Scenes video itself
                    if (video !== videoRef.current && !video.paused) {
                    video.pause();
                }
            });
            }, 150); // 150ms delay for smooth transition - matches Media component delay
            
            return () => clearTimeout(pauseTimer);
        }
    }, [isOpen]);

    // Set initial muted state when video first loads
    React.useEffect(() => {
        if (!isOpen || currentItem?.type !== 'video' || !videoRef.current) return;
        
        if (initialMutedState !== null && initialMutedState !== undefined) {
            const handleLoadedData = () => {
                if (videoRef.current) {
                    videoRef.current.muted = initialMutedState;
                    setIsMuted(initialMutedState);
                }
            };
            
            if (videoRef.current.readyState >= 2) {
                // Video already loaded
                handleLoadedData();
            } else {
                videoRef.current.addEventListener('loadeddata', handleLoadedData);
                return () => {
                    if (videoRef.current) {
                        videoRef.current.removeEventListener('loadeddata', handleLoadedData);
                    }
                };
            }
        }
    }, [isOpen, currentItem?.type, initialMutedState]);

    // Set initial video time when opening Scenes (seamless transition from feed)
    React.useEffect(() => {
        if (!isOpen || currentItem?.type !== 'video' || !videoRef.current) return;
        
        let hasSynced = false;
        
        // Function to sync video time (only once) - don't try to play, let autoPlay handle it
        const syncVideoTime = () => {
            if (hasSynced || !videoRef.current) return;
            
            // Wait for video to have duration
            if (!videoRef.current.duration || videoRef.current.duration === 0) {
                return;
            }
            
            if (initialVideoTime !== null && initialVideoTime !== undefined && initialVideoTime > 0) {
                if (initialVideoTime < videoRef.current.duration) {
                    videoRef.current.currentTime = initialVideoTime;
                    hasSynced = true;
                }
            }
            // Don't try to play here - let autoPlay attribute handle playback
        };

        // Try to set immediately if video is already loaded
        if (videoRef.current.readyState >= 2) {
            syncVideoTime();
        }

        // Listen for when video data is loaded
        const handleLoadedData = () => {
            syncVideoTime();
        };
        
        // Listen for canplay event
        const handleCanPlay = () => {
            syncVideoTime();
        };
        
        // Listen for loadedmetadata for better compatibility
        const handleLoadedMetadata = () => {
            syncVideoTime();
        };

        videoRef.current.addEventListener('loadeddata', handleLoadedData);
        videoRef.current.addEventListener('canplay', handleCanPlay);
        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);

        return () => {
            if (videoRef.current) {
                videoRef.current.removeEventListener('loadeddata', handleLoadedData);
                videoRef.current.removeEventListener('canplay', handleCanPlay);
                videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
            }
        };
    }, [isOpen, currentItem?.type, initialVideoTime]);

    // Cleanup animation states when modal closes
    React.useEffect(() => {
        if (!isOpen) {
            // Pause video when modal closes to stop any audio
            if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
            }
            // Clear heart animation state immediately
            setTapPosition(null);
            setHeartBurst(false);
            isProcessingDoubleTap.current = false;
        }
    }, [isOpen]);

    function handleNext() {
        if (hasMultipleItems) {
            setCurrentIndex((prev) => (prev + 1) % items.length);
        }
    }

    function handlePrevious() {
        if (hasMultipleItems) {
            setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
        }
    }

    function handleDotClick(index: number) {
        setCurrentIndex(index);
    }

    // Sync with post data changes without clobbering local optimistic reclip state
    React.useEffect(() => {
        setLiked(post.userLiked);
        setLikes(post.stats.likes);
        setComments(post.stats.comments);
        setShares(post.stats.shares);
        setReclips(post.stats.reclips);
        setIsFollowing(post.isFollowing);
        // Only ever turn userReclipped ON from the post; never force it OFF here,
        // so a local optimistic reclip in Scenes is not immediately reset.
        if (post.userReclipped) {
            setUserReclipped(true);
        }
    }, [
        post.userLiked,
        post.stats.likes,
        post.stats.comments,
        post.stats.shares,
        post.stats.reclips,
        post.isFollowing,
        post.userReclipped
    ]);

    // Listen for engagement updates
    React.useEffect(() => {
        const handleCommentAdded = async () => {
            setComments(prev => prev + 1);
            // Refresh comments list if sheet is open
            if (isCaptionExpanded) {
                try {
                    const fetchedComments = await fetchComments(post.id);
                    setCommentsList(fetchedComments);
                } catch (error) {
                    console.error('Failed to refresh comments:', error);
                }
            }
        };
        const handleLikeToggled = (event: CustomEvent) => {
            console.log('ScenesModal: likeToggled event received', event.detail);
            if (event.detail && event.detail.liked !== undefined) {
                setLiked(event.detail.liked);
            }
            if (event.detail && event.detail.likes !== undefined) {
                setLikes(event.detail.likes);
            }
        };
        const handleShareAdded = () => {
            setShares(prev => prev + 1);
        };
        const handleReclipAdded = (event: CustomEvent) => {
            if (event.detail && event.detail.reclips !== undefined) {
                setReclips(event.detail.reclips);
            } else {
                setReclips(prev => prev + 1);
            }
            // Update userReclipped state when reclip happens
            setUserReclipped(true);
        };

        window.addEventListener(`commentAdded-${post.id}`, handleCommentAdded);
        window.addEventListener(`likeToggled-${post.id}`, handleLikeToggled as EventListener);
        window.addEventListener(`shareAdded-${post.id}`, handleShareAdded);
        window.addEventListener(`reclipAdded-${post.id}`, handleReclipAdded as EventListener);

        return () => {
            window.removeEventListener(`commentAdded-${post.id}`, handleCommentAdded);
            window.removeEventListener(`likeToggled-${post.id}`, handleLikeToggled as EventListener);
            window.removeEventListener(`shareAdded-${post.id}`, handleShareAdded);
            window.removeEventListener(`reclipAdded-${post.id}`, handleReclipAdded as EventListener);
        };
    }, [post.id, isCaptionExpanded]);

    // When the underlying post changes (e.g. swipe from post 1 to post 4),
    // reset the comments UI so we never show comments from the previous post.
    React.useEffect(() => {
        setCommentsList([]);
        setIsLoadingComments(false);
        setReplyingToCommentId(null);
        setReplyInputText('');
        setShowCommentEmojiPicker(false);
        setSheetDragY(0);
        setIsCaptionExpanded(false);
        setExpandedReplyThreads({});
    }, [post.id]);

    React.useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                // Save current video time before closing
                let savedTime: number | undefined;
                if (videoRef.current && currentItem?.type === 'video') {
                    savedTime = videoRef.current.currentTime;
                }
                onClose(savedTime);
            }
        }
        if (isOpen) {
            document.addEventListener('keydown', onKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose, currentItem?.type]);

    // Check if this post is saved (for Scenes save icon state)
    React.useEffect(() => {
        async function checkIfSaved() {
            if (!user?.id) return;
            try {
                const collections = await getCollectionsForPost(user.id, post.id);
                setIsSaved(collections.length > 0);
            } catch (error) {
                console.error('Error checking if post is saved in Scenes:', error);
            }
        }
        checkIfSaved();
    }, [user?.id, post.id]);

    // Listen for global save events to keep Scenes icon in sync
    React.useEffect(() => {
        if (!user?.id) return;

        const handlePostSaved = () => {
            getCollectionsForPost(user.id, post.id)
                .then(collections => setIsSaved(collections.length > 0))
                .catch(console.error);
        };

        window.addEventListener(`postSaved-${post.id}`, handlePostSaved);
        return () => {
            window.removeEventListener(`postSaved-${post.id}`, handlePostSaved);
        };
    }, [user?.id, post.id]);

    async function handleLike() {
        // Reuse reclipBusy for like operations so they don't interfere with follow UI
        if (reclipBusy) return;
        setReclipBusy(true);
        let previousLiked: boolean = liked;
        try {
            // Optimistically update liked state immediately using functional updates
            setLiked(prev => {
                previousLiked = prev;
                return !prev;
            });
            setLikes(prev => previousLiked ? Math.max(0, prev - 1) : prev + 1);
            await onLike();
        } catch (error) {
            // Revert on error
            setLiked(previousLiked);
            setLikes(prev => previousLiked ? prev + 1 : Math.max(0, prev - 1));
            console.error('Error toggling like:', error);
        } finally {
            setReclipBusy(false);
        }
    }

    // Handle double tap to like
    const handleMediaTap = React.useCallback(async (e?: React.MouseEvent | React.TouchEvent) => {
        // Prevent processing if already handling a double tap
        if (isProcessingDoubleTap.current) {
            return;
        }

        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < DOUBLE_TAP_THRESHOLD) {
            // Double tap detected - clear any pending single tap timer
            if ((lastTapRef as any).singleTapTimer) {
                clearTimeout((lastTapRef as any).singleTapTimer);
                (lastTapRef as any).singleTapTimer = null;
            }
            // Double tap detected
            isProcessingDoubleTap.current = true;

            // Get tap position relative to media container
            let tapX = 0;
            let tapY = 0;
            let clientX = 0;
            let clientY = 0;

            if (mediaContainerRef.current && e) {
                const rect = mediaContainerRef.current.getBoundingClientRect();

                if ('touches' in e && e.touches.length > 0) {
                    // Touch event - use touch position
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                } else if ('changedTouches' in e && e.changedTouches.length > 0) {
                    // Touch end event - use changedTouches
                    clientX = e.changedTouches[0].clientX;
                    clientY = e.changedTouches[0].clientY;
                } else if ('clientX' in e) {
                    // Mouse event
                    clientX = e.clientX;
                    clientY = e.clientY;
                } else {
                    // Fallback to center
                    clientX = rect.left + rect.width / 2;
                    clientY = rect.top + rect.height / 2;
                }

                tapX = clientX - rect.left;
                tapY = clientY - rect.top;
            } else {
                // Fallback to center if no event or container
                if (mediaContainerRef.current) {
                    const rect = mediaContainerRef.current.getBoundingClientRect();
                    tapX = rect.width / 2;
                    tapY = rect.height / 2;
                    clientX = rect.left + tapX;
                    clientY = rect.top + tapY;
                }
            }

            // Set tap position for heart pop-up animation
            setTapPosition({ x: tapX, y: tapY });

            // Show heart burst animation (big purple heart at tap position)
            setHeartBurst(true);

            // Clear tap position and burst after pop-up animation completes (400ms)
            // Add a fade-out before clearing to ensure smooth transition
            setTimeout(() => {
                setHeartBurst(false);
                // Clear tap position after fade-out completes
                setTimeout(() => {
                    setTapPosition(null);
                    // Double-check to ensure it's cleared
            setTimeout(() => {
                setTapPosition(null);
                setHeartBurst(false);
                    }, 100);
                }, 300); // Wait for fade-out transition
            }, 400);

            // Reset processing flag after all animations complete (pop-up 400ms + drop 800ms = 1200ms)
            setTimeout(() => {
                isProcessingDoubleTap.current = false;
            }, 1200);

            if (!reclipBusy && !liked) {
                setReclipBusy(true);
                try {
                    // Optimistically update liked state immediately for double-tap
                    setLiked(true);
                    setLikes(prev => prev + 1);
                    await onLike();
                } catch (error) {
                    // Revert on error
                    setLiked(false);
                    setLikes(prev => Math.max(0, prev - 1));
                    console.error('Error toggling like:', error);
                } finally {
                    setReclipBusy(false);
                }
            }
            // Note: Processing flag is reset after 1200ms regardless of whether we liked or not
        } else {
            // Single tap - wait to see if it's actually a double tap before pausing
            // This prevents conflict between double tap like and single tap pause
            const singleTapTimer = setTimeout(() => {
                // Only process single tap if no second tap came within threshold
                if (!isProcessingDoubleTap.current && currentItem?.type === 'video' && videoRef.current) {
                if (videoRef.current.paused) {
                    videoRef.current.play().catch(console.error);
                    setIsPaused(false);
                } else {
                    // Force pause and ensure audio stops immediately
                    videoRef.current.pause();
                    // Ensure the pause takes effect by setting currentTime
                    const currentTime = videoRef.current.currentTime;
                    videoRef.current.currentTime = currentTime;
                    setIsPaused(true);
                    // Also pause all other videos on the page to prevent background audio
                    const allVideos = document.querySelectorAll('video');
                    allVideos.forEach((video) => {
                        if (video !== videoRef.current && !video.paused) {
                            video.pause();
                        }
                    });
                }
            }
            }, DOUBLE_TAP_THRESHOLD);
            
            // Store timer to clear if double tap occurs
            (lastTapRef as any).singleTapTimer = singleTapTimer;
        }
        lastTapRef.current = now;
    }, [currentItem?.type, onLike, reclipBusy, liked]);

    const handleMediaClick = React.useCallback((e: React.MouseEvent) => {
        if (touchHandledRef.current) {
            e.preventDefault();
            return;
        }
        handleMediaTap(e);
    }, [handleMediaTap]);

    const handleMediaTouchEnd = React.useCallback((e: React.TouchEvent) => {
        touchHandledRef.current = true;
        handleMediaTap(e);
        setTimeout(() => {
            touchHandledRef.current = false;
        }, 300);
    }, [handleMediaTap]);

    // Carousel: vertical swipe - content follows finger (Reels/TikTok style)
    // When comments sheet is open, do not respond to carousel touch so the video stays fixed
    const handleCarouselTouchStart = React.useCallback((e: React.TouchEvent) => {
        if (isCaptionExpanded) return;
        if (isCarousel && e.touches.length > 0) {
            carouselTouchStart.current = e.touches[0].clientY;
            carouselTouchHandled.current = false;
            setCarouselAnimating(false);
            setCarouselTouchDelta(0);
        }
    }, [isCarousel, isCaptionExpanded]);

    const handleCarouselTouchMove = React.useCallback((e: React.TouchEvent) => {
        if (isCaptionExpanded) return;
        if (!isCarousel || effectivePosts.length === 0 || e.touches.length === 0) return;
        e.preventDefault();
        const idx = effectivePosts.findIndex((p) => p.id === post.id);
        if (idx < 0) return;
        const deltaY = e.touches[0].clientY - carouselTouchStart.current;
        const maxDelta = vh * 0.5;
        let clamped = deltaY;
        if (deltaY < 0 && idx >= effectivePosts.length - 1) clamped = Math.max(deltaY, -40);
        else if (deltaY > 0 && idx <= 0) clamped = Math.min(deltaY, 40);
        else clamped = Math.max(-maxDelta, Math.min(maxDelta, deltaY));
        setCarouselTouchDelta(clamped);
    }, [isCarousel, isCaptionExpanded, effectivePosts, post.id, vh]);

    const handleCarouselTouchEnd = React.useCallback((e: React.TouchEvent) => {
        if (isCaptionExpanded) return;
        if (!isCarousel || effectivePosts.length === 0 || e.changedTouches.length === 0) return;
        const deltaY = e.changedTouches[0].clientY - carouselTouchStart.current;
        const threshold = vh * 0.12;
        const idx = effectivePosts.findIndex((p) => p.id === post.id);
        if (idx < 0) return;

        let newIndex: number | null = null;
        if (deltaY < -threshold && idx < effectivePosts.length - 1) {
            newIndex = idx + 1;
        } else if (deltaY > threshold && idx > 0) {
            newIndex = idx - 1;
        }

        if (newIndex !== null && onPostChange) {
            carouselTouchHandled.current = true;
            touchHandledRef.current = true;
            setCarouselAnimating(true);
            const targetOffset = newIndex > idx ? -vh : vh;
            setCarouselTouchDelta(targetOffset);
            const savedTime = videoRef.current && currentItem?.type === 'video' ? videoRef.current.currentTime : undefined;
            const transitionMs = 280;
            setTimeout(() => {
                onPostChange(newIndex!, savedTime);
                setCarouselTouchDelta(0);
                setCarouselAnimating(false);
            }, transitionMs);
        } else {
            setCarouselAnimating(true);
            setCarouselTouchDelta(0);
            setTimeout(() => setCarouselAnimating(false), 320);
        }
    }, [isCarousel, isCaptionExpanded, effectivePosts, post.id, onPostChange, currentItem?.type, vh]);

    async function handleFollow() {
        if (followBusy) return;
        setFollowBusy(true);
        try {
            const res = await onFollow();
            // If parent returns false (e.g. private profile – request sent, not following), keep Follow state
            if (typeof res === 'boolean') {
                setIsFollowing(res);
            } else {
                setIsFollowing(prev => !prev);
            }
        } catch (error) {
            setIsFollowing(post.isFollowing);
            console.error('Error toggling follow:', error);
        } finally {
            setFollowBusy(false);
        }
    }

    // Private user + pending follow request = show "Requested" instead of "Follow" or "Following"
    const isPrivateProfile = isProfilePrivate(post.userHandle);
    const hasPendingRequest = Boolean(user?.handle && isPrivateProfile && hasPendingFollowRequest(user.handle, post.userHandle));

    function handleShare() {
        console.log('Share clicked in ScenesModal, opening ShareModal, current state:', shareModalOpen);
        setShareModalOpen(true);
        // Also call parent's onShare for consistency (don't await to avoid blocking)
        onShare().catch(console.error);
    }

    async function handleReclip(e?: React.MouseEvent) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (reclipBusy) return;
        if (post.userHandle === user?.handle) {
            return;
        }
        if (userReclipped) {
            return;
        }
        setReclipBusy(true);
        setUserReclipped(true);
        setReclips(prev => prev + 1);
        onReclip().catch(error => console.warn('Reclip request failed:', error)).finally(() => setReclipBusy(false));
    }

    // Handle caption expansion
    const handleCaptionClick = async () => {
        if (isCaptionExpanded) {
            setIsCaptionExpanded(false);
            setSheetDragY(0);
            setReplyingToCommentId(null);
            setReplyInputText('');
            setShowCommentEmojiPicker(false);
            setExpandedReplyThreads({});
        } else {
            setIsCaptionExpanded(true);
            // Fetch comments when expanding
            if (commentsList.length === 0 && !isLoadingComments) {
                setIsLoadingComments(true);
                try {
                    const fetchedComments = await fetchComments(post.id);
                    setCommentsList(fetchedComments);
                } catch (error) {
                    console.error('Failed to load comments:', error);
                } finally {
                    setIsLoadingComments(false);
                }
            }
        }
    };

    // Drag handlers for bottom sheet - TikTok style: only drag when touch starts on the handle bar so comments list can scroll
    const handleSheetTouchStart = (e: React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-sheet-drag-handle]')) return;
        if (target.closest('button, input, textarea')) return;
        setIsDragging(true);
        dragStartY.current = e.touches[0].clientY;
        e.stopPropagation();
    };

    const handleSheetTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        e.stopPropagation();
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - dragStartY.current;
        if (deltaY > 0) {
            setSheetDragY(deltaY);
        }
    };

    const handleSheetTouchEnd = (e: React.TouchEvent) => {
        if (isDragging) {
            e.stopPropagation();
        }
        if (sheetDragY > 100) {
            setIsCaptionExpanded(false);
        }
        setSheetDragY(0);
        setIsDragging(false);
    };

    async function handleAddComment(textOrEvent?: string | React.FormEvent) {
        const e = typeof textOrEvent === 'object' && textOrEvent;
        if (e && 'preventDefault' in e) e.preventDefault();
        const text = (typeof textOrEvent === 'string' ? textOrEvent.trim() : commentText.trim());
        if (!text || isAddingComment) return;
        if (!user) {
            Swal.fire(bottomSheet({
                title: 'Log in to comment',
                message: 'Please log in from Profile to post comments.',
                icon: 'alert',
            }));
            return;
        }

        setCommentText('');
        setShowCommentEmojiPicker(false);
        setIsAddingComment(true);

        const tempId = `temp-${Date.now()}`;
        const optimisticComment: Comment = {
            id: tempId,
            postId: post.id,
            userHandle: user.handle || 'You',
            text,
            createdAt: Date.now(),
            likes: 0,
            userLiked: false,
        };
        setComments(prev => prev + 1);
        // Keep ordering consistent with feed comments: newest at the bottom.
        // Append optimistic comment so there is no position "jump" when the real one arrives.
        setCommentsList(prev => [...prev, optimisticComment]);

        try {
            if (!online) {
                await enqueue({ type: 'comment', postId: post.id, userId: user.id, text });
                // Offline: keep optimistic comment; it will sync later
            } else {
                const newComment = await addComment(post.id, user.handle || 'darraghdublin', text);
                // Replace optimistic comment with real one from API/mock store without changing order
                setCommentsList(prev =>
                    prev.map(c => c.id === tempId ? newComment : c)
                );
            }

            window.dispatchEvent(new CustomEvent(`commentAdded-${post.id}`, {
                detail: { text }
            }));
        } catch (error: any) {
            console.error('Error adding comment:', error);
            setCommentText(text);
            setComments(prev => Math.max(0, prev - 1));
            setCommentsList(prev => prev.filter(c => c.id !== tempId));
            const msg = error?.message || error?.response?.message || (error?.response?.error) || 'Could not post comment. Try again.';
            const isAuth = error?.status === 401 || (typeof msg === 'string' && (msg.toLowerCase().includes('unauthenticated') || msg.toLowerCase().includes('unauthorized')));
            Swal.fire(bottomSheet({
                title: 'Comment failed',
                message: isAuth ? 'Please log in with the app login (Profile → Log in) to post comments.' : msg,
                icon: 'alert',
            }));
        } finally {
            setIsAddingComment(false);
        }
    }

    const handleLikeComment = async (commentId: string) => {
        if (!user || likingCommentId !== null) return;
        setLikingCommentId(commentId);
        setCommentsList(prev => prev.map(c => {
            if (c.id !== commentId) return c;
            const newLiked = !c.userLiked;
            return { ...c, userLiked: newLiked, likes: (c.likes || 0) + (newLiked ? 1 : -1) };
        }));
        try {
            if (!online) {
                await enqueue({ type: 'commentLike', commentId, userId: user.id });
                return;
            }
            const updated = await toggleCommentLike(commentId);
            setCommentsList(prev => prev.map(c => c.id === commentId ? updated : c));
        } catch (err) {
            console.error('Failed to like comment:', err);
            setCommentsList(prev => prev.map(c => {
                if (c.id !== commentId) return c;
                return { ...c, userLiked: !c.userLiked, likes: (c.likes || 0) + (c.userLiked ? 1 : -1) };
            }));
        } finally {
            setLikingCommentId(null);
        }
    };

    const handleLikeReply = async (parentCommentId: string, replyId: string) => {
        const key = `${parentCommentId}-${replyId}`;
        if (!user || likingReplyKey !== null) return;
        setLikingReplyKey(key);
        setCommentsList(prev => prev.map(c => {
            if (c.id !== parentCommentId || !c.replies) return c;
            return {
                ...c,
                replies: c.replies.map(r => {
                    if (r.id !== replyId) return r;
                    const newLiked = !r.userLiked;
                    return { ...r, userLiked: newLiked, likes: (r.likes || 0) + (newLiked ? 1 : -1) };
                }),
            };
        }));
        try {
            if (!online) {
                await enqueue({ type: 'replyLike', parentCommentId, replyId, userId: user.id });
                return;
            }
            const updatedParent = await toggleReplyLike(parentCommentId, replyId);
            setCommentsList(prev => prev.map(c => c.id === parentCommentId ? updatedParent : c));
        } catch (err) {
            console.error('Failed to like reply:', err);
            setCommentsList(prev => prev.map(c => {
                if (c.id !== parentCommentId || !c.replies) return c;
                return {
                    ...c,
                    replies: c.replies.map(r => {
                        if (r.id !== replyId) return r;
                        return { ...r, userLiked: !r.userLiked, likes: (r.likes || 0) + (r.userLiked ? 1 : -1) };
                    }),
                };
            }));
        } finally {
            setLikingReplyKey(null);
        }
    };

    const handleReplyToComment = async (parentId: string, text: string) => {
        if (!user || !text.trim()) return;
        setSubmittingReplyId(parentId);
        const optimisticReply: Comment = {
            id: `temp-reply-${Date.now()}`,
            postId: post.id,
            userHandle: user.handle || 'You',
            text: text.trim(),
            createdAt: Date.now(),
            likes: 0,
            userLiked: false,
            parentId: parentId,
        };
        setCommentsList(prev => prev.map(c => {
            if (c.id !== parentId) return c;
            return { ...c, replies: [...(c.replies || []), optimisticReply], replyCount: (c.replyCount || 0) + 1 };
        }));
        setReplyInputText('');
        setReplyingToCommentId(null);
        try {
            if (!online) {
                await enqueue({ type: 'reply', postId: post.id, parentId, userId: user.id, text: text.trim() });
            } else {
                const newReply = await addReply(post.id, parentId, user.handle || 'darraghdublin', text.trim());
                setCommentsList(prev => prev.map(c => {
                    if (c.id !== parentId) return c;
                    return {
                        ...c,
                        replies: (c.replies || []).map(r => r.id === optimisticReply.id ? newReply : r),
                    };
                }));
            }
            window.dispatchEvent(new CustomEvent(`commentAdded-${post.id}`));
        } catch (err) {
            console.error('Failed to add reply:', err);
            setCommentsList(prev => prev.map(c => {
                if (c.id !== parentId) return c;
                return { ...c, replies: (c.replies || []).filter(r => r.id !== optimisticReply.id), replyCount: Math.max(0, (c.replyCount || 1) - 1) };
            }));
        } finally {
            setSubmittingReplyId(null);
        }
    };

    if (!isOpen) return null;

    React.useEffect(() => {
        console.log('ScenesModal - shareModalOpen changed:', shareModalOpen);
    }, [shareModalOpen]);

    const carouselIdx = effectivePosts.length > 0 ? Math.max(0, effectivePosts.findIndex((p) => p.id === post.id)) : 0;
    const carouselPrevPost = carouselIdx > 0 ? effectivePosts[carouselIdx - 1] : null;
    const carouselNextPost = carouselIdx >= 0 && carouselIdx < effectivePosts.length - 1 ? effectivePosts[carouselIdx + 1] : null;

    const CarouselSlidePreview = ({ p }: { p: Post }) => {
        const mediaUrl = p.mediaItems?.[0]?.url || p.mediaUrl;
        const mediaType = p.mediaItems?.[0]?.type || p.mediaType || 'image';
        if (!mediaUrl) return <div className="w-full h-full bg-black" />;
        return (
            <div className="w-full h-full flex items-center justify-center bg-black">
                {mediaType === 'video' ? (
                    <video src={mediaUrl} className="max-w-full max-h-full object-contain" muted playsInline />
                ) : (
                    <img src={mediaUrl} alt="" className="max-w-full max-h-full object-contain" />
                )}
            </div>
        );
    };

    // Render ShareModal in a portal outside ScenesModal DOM hierarchy
    return (
        <>
            {isOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Scenes fullscreen viewer"
                    className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
                >
                    {effectivePosts.length > 0 ? (
                        <div
                            className="fixed left-0 right-0 top-0 overflow-hidden touch-none"
                            style={{
                                touchAction: 'none',
                                // Smoothly animate between full-screen and top-half when comments sheet opens/closes
                                height: isCaptionExpanded ? '50vh' : '100vh',
                                zIndex: isCaptionExpanded ? 105 : undefined,
                                transition: 'height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                            }}
                            onTouchStart={handleCarouselTouchStart}
                            onTouchMove={handleCarouselTouchMove}
                            onTouchEnd={(e) => {
                                handleCarouselTouchEnd(e);
                                if (!carouselTouchHandled.current) {
                                    handleMediaTouchEnd(e);
                                }
                            }}
                        >
                            <div
                                className="w-full"
                                style={{
                                    transform: `translate3d(0, ${(carouselIdx > 0 ? -vh : 0) + carouselTouchDelta}px, 0)`,
                                    transition: carouselAnimating ? 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
                                    willChange: carouselAnimating ? 'transform' : undefined,
                                    backfaceVisibility: 'hidden' as const
                                }}
                            >
                                {carouselPrevPost && (
                                    <div className="w-full flex items-center justify-center bg-black" style={{ height: vh }}>
                                        <CarouselSlidePreview p={carouselPrevPost} />
                                    </div>
                                )}
                                <div className="w-full relative" style={{ height: vh }}>
                                    {/* Current post - full content */}
                                    {/* Top Left - Street sign with location (top) and time (bottom) */}
                                    <div className="absolute top-5 left-3 z-10">
                                        <StreetSign
                            topLabel={post.locationLabel || ''}
                            bottomLabel={post.createdAt ? timeAgo(post.createdAt) : ''}
                        />
                    </div>

                    {/* Top Bar - Feed label (centre), Counter, Close Button */}
                    <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-4">
                        {/* Left side - Counter (only for multi-item posts) */}
                        <div className="flex-1 flex justify-start">
                            {hasMultipleItems && (
                                <div className="px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                                    {currentIndex + 1} / {items.length}
                                </div>
                            )}
                        </div>

                        {/* Center - Feed label when in carousel mode */}
                        <div className="absolute left-0 right-0 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                            {feedLabel && (
                                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-black/60 px-3 py-1.5 text-white">
                                    <FiMapPin className="w-4 h-4 flex-shrink-0" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">
                                        {feedLabel}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Right side - Close button with circular progress ring around it */}
                        <div className="flex-1 flex justify-end">
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                {/* Progress ring behind the X */}
                                <svg className="absolute inset-0 w-10 h-10 transform -rotate-90" viewBox="0 0 48 48">
                                    {/* Background circle */}
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="18"
                                        stroke="rgba(255,255,255,0.25)"
                                        strokeWidth="3"
                                        fill="none"
                                    />
                                    {/* Progress circle */}
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="18"
                                        stroke="rgba(255,255,255,0.95)"
                                        strokeWidth="3"
                                        fill="none"
                                        strokeDasharray={`${2 * Math.PI * 18}`}
                                        strokeDashoffset={`${2 * Math.PI * 18 * (1 - Math.max(0, Math.min(1, videoProgress)))}`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <button
                                    onClick={() => {
                                        // Save current video time before closing
                                        let savedTime: number | undefined;
                                        if (videoRef.current && currentItem?.type === 'video') {
                                            savedTime = videoRef.current.currentTime;
                                        }
                                        onClose(savedTime);
                                    }}
                                    aria-label="Close scenes"
                                    className="relative z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
                                >
                                    <FiX size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Media Content */}
                    <div
                        ref={mediaContainerRef}
                        className={`w-full flex items-center justify-center select-none cursor-pointer transition-all duration-300 ease-out ${isCaptionExpanded
                            ? 'absolute top-[8%] left-1/2 -translate-x-1/2 scale-[0.45] origin-top'
                            : isCarousel
                                ? 'absolute inset-0 scale-100'
                                : 'relative h-full scale-100'
                            }`}
                        onClick={(e) => {
                            if (carouselTouchHandled.current) return;
                            // Only handle media click if clicking directly on the media area (not on buttons)
                            if (e.target === e.currentTarget || (e.target instanceof HTMLElement && !e.target.closest('button'))) {
                                handleMediaClick(e);
                            }
                        }}
                        {...(isCarousel ? {} : {
                            onTouchEnd: handleMediaTouchEnd
                        })}
                    >
                        {currentItem ? (() => {
                            // Get effects for current media item
                            const itemEffects = currentItem.effects || [];

                            // Handle text-only clips - display as Twitter card preview
                            if (currentItem.type === 'text') {
                                // Extract text from data URL or use text property
                                let textContent = '';
                                let textStyle: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } | undefined;

                                if ((currentItem as any).text) {
                                    textContent = (currentItem as any).text;
                                    textStyle = (currentItem as any).textStyle;
                                } else if (currentItem.url && currentItem.url.startsWith('data:text/plain;base64,')) {
                                    try {
                                        const base64Text = currentItem.url.split(',')[1];
                                        textContent = atob(base64Text);
                                        textStyle = (currentItem as any).textStyle || { color: '#ffffff', size: 'medium', background: '#000000' };
                                    } catch (e) {
                                        console.error('Error decoding text from data URL:', e);
                                        textContent = 'Text content';
                                    }
                                }

                                // Display as Twitter card preview (white card with black text box)
                                return (
                                    <div className="w-full h-full flex items-center justify-center p-4 bg-black">
                                        <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-2xl" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                            {/* Post Header */}
                                            <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-200">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <Avatar
                                                        src={getAvatarForHandle(post.userHandle)}
                                                        name={post.userHandle.split('@')[0]}
                                                        size="sm"
                                                    />
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold flex items-center gap-1.5 text-gray-900 text-sm">
                                                            <span>{post.userHandle}</span>
                                                            <Flag
                                                                value={getFlagForHandle(post.userHandle) || ''}
                                                                size={14}
                                                            />
                                                        </h3>
                                                        <div className="text-xs text-gray-600 flex items-center gap-2 mt-0.5">
                                                            {post.locationLabel && (
                                                                <>
                                                                    <span className="flex items-center gap-1">
                                                                        <FiMapPin className="w-3 h-3" />
                                                                        {post.locationLabel}
                                                                    </span>
                                                                    {post.createdAt && <span className="text-gray-400">·</span>}
                                                                </>
                                                            )}
                                                            {post.createdAt && (
                                                                <span>{timeAgo(post.createdAt)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Text Content - Twitter card style (white card with black text box) */}
                                            <div className="p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                                <div className="p-4 rounded-lg bg-black overflow-hidden w-full" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                                    <div className="text-base leading-relaxed whitespace-pre-wrap font-normal text-white break-words w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%', boxSizing: 'border-box' }}>
                                                        {textContent}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Create media element
                            let mediaElement = currentItem.type === 'video' ? (
                                <div className="relative w-full h-full">
                                    <video
                                        ref={videoRef}
                                        className="w-full h-full object-contain pointer-events-none transition-opacity duration-200"
                                        src={currentItem.url}
                                        controls={false}
                                        autoPlay
                                        loop
                                        playsInline
                                        muted={isMuted}
                                        preload="auto"
                                        onPlay={() => setIsPaused(false)}
                                        onPause={() => setIsPaused(true)}
                                        onTimeUpdate={(e) => {
                                            const video = e.currentTarget;
                                            if (video.duration) {
                                                setVideoProgress(video.currentTime / video.duration);
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <img
                                    className="w-full h-full object-contain"
                                    src={currentItem.url}
                                    alt={post.caption || post.text || 'Post media'}
                                />
                            );

                            // Apply effects in reverse order (last effect wraps everything)
                            itemEffects.forEach((effect: EffectConfig) => {
                                mediaElement = (
                                    <EffectWrapper key={effect.type} effect={effect} isActive={true}>
                                        {mediaElement}
                                    </EffectWrapper>
                                );
                            });

                            return mediaElement;
                        })() : (
                            // Text-only post display
                            // Check if this is a shared text-only post (no media, has text) - show as post card screenshot
                            !post.mediaUrl && !post.mediaItems?.length && post.text ? (
                                // Display as screenshot of original post card (like StoriesPage)
                                <div
                                    className="w-full h-full flex items-center justify-center p-4"
                                    style={{
                                        background: '#000000' // Black background
                                    }}
                                >
                                    <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                        {/* Post Header */}
                                        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-3 flex-1">
                                                <Avatar
                                                    src={getAvatarForHandle(post.userHandle)}
                                                    name={post.userHandle.split('@')[0]}
                                                    size="sm"
                                                />
                                                <div className="flex-1">
                                                    <h3 className="font-semibold flex items-center gap-1.5 text-gray-900 dark:text-gray-100 text-sm">
                                                        <span>{post.userHandle}</span>
                                                        <Flag
                                                            value={getFlagForHandle(post.userHandle) || ''}
                                                            size={14}
                                                        />
                                                    </h3>
                                                    <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-0.5">
                                                        {post.locationLabel && (
                                                            <>
                                                                <span className="flex items-center gap-1">
                                                                    <FiMapPin className="w-3 h-3" />
                                                                    {post.locationLabel}
                                                                </span>
                                                                {post.createdAt && <span className="text-gray-400">·</span>}
                                                            </>
                                                        )}
                                                        {post.createdAt && (
                                                            <span>{timeAgo(post.createdAt)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Text Content - styled like feed */}
                                        <div className="p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                            <div className="p-4 rounded-lg bg-black overflow-hidden w-full" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                                <div className="text-base leading-relaxed whitespace-pre-wrap font-normal text-white break-words w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%', boxSizing: 'border-box' }}>
                                                    {post.text}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Text-only story display (directly created, not shared) - keep original style with gradient/textStyle
                                <div
                                    className="w-full h-full flex items-center justify-center px-6"
                                    style={{
                                        background: post.textStyle?.background?.includes('gradient')
                                            ? undefined
                                            : post.textStyle?.background,
                                        backgroundImage: post.textStyle?.background?.includes('gradient')
                                            ? post.textStyle.background
                                            : undefined
                                    }}
                                >
                                    <div className="text-center w-full max-w-full overflow-hidden px-4">
                                        {post.text && (
                                            <div
                                                className={`leading-relaxed whitespace-pre-wrap font-bold drop-shadow-lg break-words ${post.textStyle?.size === 'small' ? 'text-4xl' :
                                                    post.textStyle?.size === 'large' ? 'text-8xl' :
                                                        'text-6xl'
                                                    }`}
                                                style={{ color: post.textStyle?.color || 'white', wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%' }}
                                            >
                                                {post.text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        )}

                        {/* Sticker Overlays */}
                        {post.stickers && post.stickers.length > 0 && containerSize.width > 0 && (
                            <>
                                {post.stickers.map((overlay) => (
                                    <StickerOverlayComponent
                                        key={overlay.id}
                                        overlay={overlay}
                                        onUpdate={() => { }} // Read-only in scenes
                                        onRemove={() => { }} // Read-only in scenes
                                        isSelected={false} // Read-only in scenes
                                        onSelect={() => { }} // Read-only in scenes
                                        containerWidth={containerSize.width}
                                        containerHeight={containerSize.height}
                                    />
                                ))}
                            </>
                        )}

                        {/* Carousel Navigation - Only show if multiple items */}
                        {hasMultipleItems && (
                            <>
                                {/* Previous Button */}
                                {currentIndex > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePrevious();
                                        }}
                                        className="absolute left-4 top-1/4 transform -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors z-30"
                                        aria-label="Previous image"
                                    >
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                )}

                                {/* Next Button */}
                                {currentIndex < items.length - 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleNext();
                                        }}
                                        className="absolute right-4 top-1/4 transform -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors z-30"
                                        aria-label="Next image"
                                    >
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                )}

                                {/* Dots Indicator */}
                                <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex gap-2 z-30">
                                    {items.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDotClick(index);
                                            }}
                                            className={`h-2 rounded-full transition-all ${index === currentIndex
                                                ? 'bg-white w-8'
                                                : 'bg-white/50 hover:bg-white/75 w-2'
                                                }`}
                                            aria-label={`Go to image ${index + 1}`}
                                        />
                                    ))}
                                </div>

                            </>
                        )}

                        {/* YouTube Shorts-style double-tap: thumbs-up + red/pink burst (same as feed) */}
                        {tapPosition && heartBurst && (
                            <div
                                className="absolute pointer-events-none z-50"
                                style={{
                                    left: `${tapPosition.x}px`,
                                    top: `${tapPosition.y}px`,
                                    transform: 'translate(-50%, -50%)',
                                    width: 0,
                                    height: 0,
                                }}
                            >
                                <div
                                    className="absolute z-0"
                                    style={{
                                        left: '50%',
                                        top: '50%',
                                        width: '200px',
                                        height: '200px',
                                        transform: 'translate(-50%, -50%)',
                                        animation: 'shortsThumbGlow 0.5s ease-out forwards',
                                    }}
                                >
                                    <ShortsLikeBurstLines />
                                </div>
                                <div
                                    className="absolute flex items-center justify-center z-10"
                                    style={{
                                        left: '50%',
                                        top: '50%',
                                        width: '96px',
                                        height: '96px',
                                        marginLeft: '-48px',
                                        marginTop: '-48px',
                                        animation: 'heartPopUp 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) forwards',
                                    }}
                                >
                                    <svg className="w-full h-full flex-shrink-0" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}>
                                        <path
                                            fill="#ffffff"
                                            d="M2 9H5V21H2C1.45 21 1 20.55 1 20V10C1 9.45 1.45 9 2 9ZM7.29 7.71L13.69 1.31C13.87 1.13 14.15 1.11 14.35 1.26L15.2 1.9C15.68 2.26 15.9 2.88 15.75 3.47L14.6 8H21C22.1 8 23 8.9 23 10V12.1C23 12.36 22.95 12.62 22.85 12.87L19.76 20.38C19.6 20.76 19.24 21 18.83 21H8C7.45 21 7 20.55 7 20V8.41C7 8.15 7.11 7.89 7.29 7.71Z"
                                        />
                                    </svg>
                                </div>
                            </div>
                        )}

                        {/* Paused Overlay - Scenes Logo with Mute Button */}
                        {isPaused && currentItem?.type === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                                <div className="flex flex-col items-center gap-3">
                                    {/* Scenes Logo */}
                                    <div className="p-3 rounded-lg border-2 border-white/80 bg-black/50 backdrop-blur-sm">
                                        <svg
                                            width="48"
                                            height="48"
                                            viewBox="0 0 24 24"
                                            className="text-white"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            {/* Square border */}
                                            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                            {/* Play button triangle */}
                                            <path d="M9 7 L9 17 L17 12 Z" fill="currentColor" />
                                        </svg>
                                    </div>
                                    {/* Mute Button over logo */}
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            const newMuted = !isMuted;
                                            setIsMuted(newMuted);
                                            
                                            // Force update video muted state immediately
                                            if (videoRef.current) {
                                                videoRef.current.muted = newMuted;
                                                
                                                // If unmuting, ensure video is playing and audio is enabled
                                                if (!newMuted) {
                                                    try {
                                                        // Double-check muted is false
                                                        videoRef.current.muted = false;
                                                        
                                                        // Ensure video is playing
                                                        if (videoRef.current.paused) {
                                                            await videoRef.current.play();
                                                            setIsPaused(false);
                                                        }
                                                        
                                                        // Use a small delay to ensure the muted state is applied
                                                        setTimeout(() => {
                                                            if (videoRef.current && !newMuted) {
                                                                videoRef.current.muted = false;
                                                                if (videoRef.current.paused) {
                                                                    videoRef.current.play().catch(console.error);
                                                                }
                                                            }
                                                        }, 50);
                                                    } catch (error) {
                                                        console.error('Error unmuting video:', error);
                                                    }
                                                }
                                            }
                                        }}
                                        onTouchEnd={async (e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            const newMuted = !isMuted;
                                            setIsMuted(newMuted);
                                            
                                            // Force update video muted state immediately
                                            if (videoRef.current) {
                                                videoRef.current.muted = newMuted;
                                                
                                                // If unmuting, ensure video is playing and audio is enabled
                                                if (!newMuted) {
                                                    try {
                                                        // Double-check muted is false
                                                        videoRef.current.muted = false;
                                                        
                                                        // Ensure video is playing
                                                        if (videoRef.current.paused) {
                                                            await videoRef.current.play();
                                                            setIsPaused(false);
                                                        }
                                                        
                                                        // Use a small delay to ensure the muted state is applied
                                                        setTimeout(() => {
                                                            if (videoRef.current && !newMuted) {
                                                                videoRef.current.muted = false;
                                                                if (videoRef.current.paused) {
                                                                    videoRef.current.play().catch(console.error);
                                                                }
                                                            }
                                                        }, 50);
                                                    } catch (error) {
                                                        console.error('Error unmuting video:', error);
                                                    }
                                                }
                                            }
                                        }}
                                        className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 active:bg-black/80 text-white transition-colors pointer-events-auto z-50"
                                        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                                        title={isMuted ? 'Unmute video' : 'Mute video'}
                                    >
                                        {isMuted ? (
                                            <FiVolumeX size={16} />
                                        ) : (
                                            <FiVolume2 size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Section with Profile, Caption, and Bottom Action Bar (Bluesky-style) */}
                    {!isCaptionExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                            <div className="max-w-md mx-auto px-4 pb-safe">
                                {/* Profile & Caption Section */}
                                <div className="pt-12 pb-4">
                                    {/* Profile Section */}
                                    <div className="flex items-center gap-3 mb-4">
                                        {/* Profile picture with rounded-md shape and animated white border */}
                                        <button
                                            onClick={() => {
                                                window.scrollTo(0, 0);
                                                navigate(`/user/${encodeURIComponent(post.userHandle)}`);
                                                onClose();
                                            }}
                                            className="relative w-8 h-8 rounded-md overflow-visible cursor-pointer"
                                        >
                                            {/* Animated white border wrapper */}
                                            <div
                                                className="absolute inset-0 rounded-md p-0.5 overflow-hidden z-0"
                                                style={{
                                                    background: 'white',
                                                }}
                                            >
                                                {/* Overlay that covers border initially, then rotates to reveal it */}
                                                <div
                                                    ref={profileBorderOverlayRef}
                                                    className="absolute inset-0 bg-black rounded-md"
                                                    style={{
                                                        maskImage: 'conic-gradient(from 0deg, black 360deg)',
                                                        WebkitMaskImage: 'conic-gradient(from 0deg, black 360deg)',
                                                    }}
                                                />
                                                <div className="w-full h-full rounded-md bg-black" />
                                            </div>
                                            {/* Profile picture content - positioned above border */}
                                            <div className="absolute inset-[2px] rounded-md overflow-hidden flex items-center justify-center bg-black z-10">
                                                {user?.handle === post.userHandle && user?.avatarUrl ? (
                                                    <img
                                                        src={user.avatarUrl}
                                                        alt={post.userHandle.split('@')[0]}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                ) : getAvatarForHandle(post.userHandle) ? (
                                                    <img
                                                        src={getAvatarForHandle(post.userHandle)}
                                                        alt={post.userHandle.split('@')[0]}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                ) : null}
                                                {/* Fallback initials if no image */}
                                                {(!user?.avatarUrl && (!getAvatarForHandle(post.userHandle) || 
                                                    (user?.handle === post.userHandle && !user?.avatarUrl))) && (
                                                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                                        <span className="text-white text-xs font-semibold">
                                                            {post.userHandle.split('@')[0].charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                        <div className="flex-1">
                                            <button
                                                onClick={() => {
                                                    window.scrollTo(0, 0);
                                                    navigate(`/user/${encodeURIComponent(post.userHandle)}`);
                                                    onClose();
                                                }}
                                                className="text-white font-semibold text-sm hover:opacity-80"
                                            >
                                                {post.userHandle}
                                            </button>
                                            {post.locationLabel && (
                                                <div className="text-white/70 text-xs flex items-center gap-1 mt-0.5">
                                                    <FiMapPin className="w-3 h-3" />
                                                    {post.locationLabel}
                                                </div>
                                            )}
                                        </div>
                                        {/* Follow / Following button – interactive on Scenes */}
                                        {!isFollowing && !hasPendingRequest && (
                                            <button
                                                type="button"
                                                onClick={handleFollow}
                                                disabled={followBusy}
                                                className={`px-4 py-1.5 bg-white/15 text-white text-sm font-semibold rounded-md ${
                                                    followBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/25'
                                                }`}
                                            >
                                                Follow
                                            </button>
                                        )}
                                        {!isFollowing && hasPendingRequest && (
                                            <span
                                                className="px-4 py-1.5 bg-white/20 text-white text-sm font-semibold rounded-md cursor-default select-none"
                                                aria-label="Follow request sent"
                                            >
                                                Requested
                                            </span>
                                        )}
                                        {isFollowing && (
                                            <button
                                                type="button"
                                                onClick={handleFollow}
                                                disabled={followBusy}
                                                className={`px-4 py-1.5 bg-white/10 text-white text-sm font-semibold rounded-md ${
                                                    followBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/20'
                                                }`}
                                            >
                                                Following
                                            </button>
                                        )}
                                    </div>

                                    {/* Caption - Only show if media is not a generated text image (data URL) */}
                                    {post.caption && post.mediaUrl && !post.mediaUrl.startsWith('data:image') && (
                                        <div className="text-white text-sm mb-2 text-left w-full">
                                            <span className="line-clamp-1">{post.caption}</span>
                                            {post.caption.length > 50 && (
                                                <button
                                                    onClick={handleCaptionClick}
                                                    className="text-white/80 hover:text-white font-medium ml-1"
                                                >
                                                    more
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Text Content (for text-only posts without media) - Only show if NOT displaying as post card screenshot */}
                                    {/* Don't show text in bottom if it's a text-only post (will be shown in post card screenshot above) */}
                                    {!post.mediaUrl && !post.mediaItems?.length && post.text ? (
                                        // Text-only post - text is shown in post card screenshot, so don't show here
                                        null
                                    ) : !post.mediaUrl && post.text ? (
                                        // Other text-only cases (if any) - show text
                                        <div className="text-white text-sm opacity-90 mb-2 text-left w-full">
                                            <span className="line-clamp-1">{post.text}</span>
                                            {post.text.length > 50 && (
                                                <button
                                                    onClick={handleCaptionClick}
                                                    className="text-white/80 hover:text-white font-medium ml-1"
                                                >
                                                    more
                                                </button>
                                            )}
                                        </div>
                                    ) : null}

                                    {/* Comment Count or Add prompt - opens comments panel */}
                                    {comments > 0 ? (
                                        <button
                                            type="button"
                                            onClick={handleCaptionClick}
                                            className="text-white text-xs opacity-80 hover:opacity-100 mb-3"
                                        >
                                            💬 View all {comments} {comments === 1 ? 'comment' : 'comments'}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleCaptionClick}
                                            className="text-white text-xs opacity-80 hover:opacity-100 mb-3"
                                        >
                                            💬 Add the first comment
                                        </button>
                                    )}

                                    {/* Bottom action bar: likes / shares / save / reclip (left), DM & more (right).
                                        Extra top margin so it's clearly separated from the Follow button row above,
                                        reducing accidental taps on Follow when aiming for Reclip on small screens. */}
                                    <div className="flex items-center justify-between mt-3 mb-3">
                                    <div className="flex items-center gap-6">
                                            {/* Like - YouTube Shorts-style thumbs up */}
                                            <button
                                                ref={likeButtonRef}
                                                onClick={handleLike}
                                                className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-opacity"
                                                aria-label={liked ? 'Unlike' : 'Like'}
                                            >
                                                <span className="w-6 h-6 inline-block">
                                                    <svg className={`w-full h-full ${liked ? 'text-white' : 'text-gray-300'}`} viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={liked ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M2 9H5V21H2C1.45 21 1 20.55 1 20V10C1 9.45 1.45 9 2 9ZM7.29 7.71L13.69 1.31C13.87 1.13 14.15 1.11 14.35 1.26L15.2 1.9C15.68 2.26 15.9 2.88 15.75 3.47L14.6 8H21C22.1 8 23 8.9 23 10V12.1C23 12.36 22.95 12.62 22.85 12.87L19.76 20.38C19.6 20.76 19.24 21 18.83 21H8C7.45 21 7 20.55 7 20V8.41C7 8.15 7.11 7.89 7.29 7.71Z" />
                                                    </svg>
                                                </span>
                                                <span className="text-xs font-semibold">{likes}</span>
                                            </button>

                                            {/* Share */}
                                            <button
                                                onClick={handleShare}
                                                className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-opacity"
                                                aria-label="Share"
                                            >
                                                <FiShare2 className="w-5 h-5" />
                                                <span className="text-xs font-semibold">{shares}</span>
                                            </button>

                                            {/* Save */}
                                            <button
                                                onClick={() => setSaveModalOpen(true)}
                                                className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-opacity"
                                                aria-label="Save to collection"
                                            >
                                                <FiBookmark
                                                    className={`w-5 h-5 ${isSaved ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                                />
                                                <span className="text-xs font-semibold">
                                                    {isSaved ? 'Saved' : 'Save'}
                                                </span>
                                            </button>

                                            {/* Reclip */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReclip(e);
                                                }}
                                                disabled={post.userHandle === user?.handle || userReclipped || reclipBusy}
                                                className={`flex items-center gap-1.5 text-gray-300 hover:text-white transition-opacity ${
                                                    post.userHandle === user?.handle || reclipBusy
                                                        ? 'opacity-30 cursor-not-allowed'
                                                        : ''
                                                }`}
                                                aria-label={
                                                    post.userHandle === user?.handle
                                                        ? "Cannot reclip your own post"
                                                        : userReclipped
                                                            ? "Post already reclipped"
                                                            : "Reclip"
                                                }
                                                title={
                                                    post.userHandle === user?.handle
                                                        ? "Cannot reclip your own post"
                                                        : userReclipped
                                                            ? "Post already reclipped"
                                                            : "Reclip"
                                                }
                                            >
                                                <FiRepeat className={`w-5 h-5 ${userReclipped ? 'text-green-500' : 'text-gray-300'}`} />
                                                <span className="text-xs font-semibold">{reclips}</span>
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* DM */}
                                            <button
                                                onClick={async () => {
                                                    if (!post.userHandle || !user?.handle || !user?.id) return;
                                                    if (post.userHandle === user.handle) return;
                                                    
                                                    // Check privacy and follow status
                                                    const followedUsers = await getFollowedUsers(user.id);
                                                    const profilePrivate = isProfilePrivate(post.userHandle);
                                                    const canMessage = canSendMessage(user.handle, post.userHandle, followedUsers);
                                                    const hasPending = hasPendingFollowRequest(user.handle, post.userHandle);
                                                    
                                                    if (!canMessage && profilePrivate) {
                                                        // Show SweetAlert explaining they need to follow
                                                        if (hasPending) {
                                                            await Swal.fire(bottomSheet({
                                                                title: 'Follow Request Pending',
                                                                message: "This user has a private profile. You have already sent a follow request. Once they accept, you'll be able to send them a message.",
                                                                icon: 'alert',
                                                            }));
                                                            return;
                                                        }
                                                        
                                                        const result = await Swal.fire(bottomSheet({
                                                            title: 'Cannot Send Message',
                                                            message: "This user has a private profile. You must follow them and have your follow request accepted before you can send them a message.",
                                                            icon: 'alert',
                                                            showCancelButton: true,
                                                            confirmButtonText: 'Request to Follow',
                                                            cancelButtonText: 'Cancel',
                                                        }));
                                                        
                                                        if (result.isConfirmed) {
                                                            createFollowRequest(user.handle, post.userHandle);
                                                            if (user?.id) setFollowState(user.id, post.userHandle, false);
                                                            Swal.fire(bottomSheet({
                                                                title: 'Follow Request Sent',
                                                                message: "You will be notified when they accept your request.",
                                                                icon: 'success',
                                                            }));
                                                        }
                                                        return;
                                                    }
                                                    
                                                    // If they can message, navigate to DM page
                                                    navigate(`/messages/${encodeURIComponent(post.userHandle)}`);
                                                    onClose();
                                                }}
                                                disabled={!user || post.userHandle === user?.handle}
                                                className="flex items-center justify-center text-gray-300 hover:text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                                                aria-label="Send direct message"
                                            >
                                                <FiSend className="w-5 h-5" />
                                            </button>

                                            {/* More Options (three dots) */}
                                            <button
                                                onClick={() => setMenuOpen(true)}
                                                className="flex items-center justify-center text-gray-300 hover:text-white transition-opacity"
                                                aria-label="More options"
                                            >
                                                <FiMoreHorizontal className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Comment Input at Bottom - acts as full-width trigger to open comments sheet */}
                                <div className="pb-4 px-3 sm:px-4">
                                    <button
                                        type="button"
                                        onClick={handleCaptionClick}
                                        className="w-full flex items-center px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm text-left placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/15"
                                    >
                                        <span className="opacity-70">Add comment...</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Comments panel - portaled so it displays correctly (not clipped by carousel overflow) */}
                    {isCaptionExpanded && createPortal(
                        <>
                            {/* Backdrop - only from 30vh down, so video stays visible at top */}
                            <div
                                className="fixed left-0 right-0 bottom-0 z-[110] bg-black/50"
                                // Leave more space for the video at the top when comments sheet is open.
                                style={{ top: '40vh' }}
                                onClick={handleCaptionClick}
                            />
                            {/* Comments sheet - TikTok style: white card, fixed to viewport; only handle bar triggers drag */}
                            <div
                                ref={sheetRef}
                                className="fixed left-0 right-0 bottom-0 z-[120] bg-white rounded-t-2xl flex flex-col shadow-[0_-4px_24px_rgba(0,0,0,0.2)]"
                                style={{
                                    transform: `translateY(${Math.max(0, sheetDragY)}px)`,
                                    maxHeight: sheetHeight,
                                    height: sheetDragY > 0 ? `calc(${sheetHeight} - ${sheetDragY}px)` : sheetHeight,
                                    paddingBottom: 'env(safe-area-inset-bottom, 0px)'
                                }}
                                onTouchStart={handleSheetTouchStart}
                                onTouchMove={handleSheetTouchMove}
                                onTouchEnd={handleSheetTouchEnd}
                            >
                                {/* Drag Handle - only this area starts sheet drag so list can scroll */}
                                <div data-sheet-drag-handle className="flex justify-center pt-2 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none">
                                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                                </div>
                                {/* Header - TikTok style: "X comments" + sort + close */}
                                <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0 border-b border-gray-200">
                                    <h3 className="text-black font-semibold text-base">
                                        {comments} {comments === 1 ? 'comment' : 'comments'}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button type="button" className="p-2 -mr-1 text-gray-600 hover:text-gray-900" aria-label="Sort comments">
                                            <FiChevronDown className="w-5 h-5" />
                                        </button>
                                        <button type="button" onClick={handleCaptionClick} className="p-2 -mr-1 text-gray-600 hover:text-gray-900" aria-label="Close comments">
                                            <FiX className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Scrollable Comments */}
                                <div className="flex-1 overflow-y-auto min-h-0">
                                    {(post.caption || post.text) && (
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-gray-900 text-sm whitespace-pre-line break-words">
                                                {post.caption || post.text}
                                            </p>
                                        </div>
                                    )}
                                    {isLoadingComments ? (
                                        <div className="flex justify-center py-12">
                                            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                                        </div>
                                    ) : commentsList.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500 text-sm">
                                            No comments yet. Be the first to comment!
                                        </div>
                                    ) : (
                                        <div className="px-4 py-2 space-y-4">
                                            {commentsList.map((comment) => (
                                                <div key={comment.id} className="flex gap-3">
                                                    <Avatar
                                                        src={
                                                            comment.userHandle === user?.handle
                                                                ? (user?.avatarUrl || getAvatarForHandle(comment.userHandle))
                                                                : getAvatarForHandle(comment.userHandle)
                                                        }
                                                        name={comment.userHandle?.split('@')[0] || 'User'}
                                                        size="sm"
                                                        className="flex-shrink-0 ring-1 ring-gray-200"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline gap-2 mb-0.5">
                                                            <span className="font-semibold text-sm text-gray-900">
                                                                {comment.userHandle}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {timeAgo(comment.createdAt)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-900 mb-2">{comment.text}</p>
                                                        <div className="flex items-center justify-between">
                                                            <button
                                                                type="button"
                                                                onClick={() => setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id)}
                                                                className="text-xs text-gray-500 hover:text-gray-900 font-medium"
                                                            >
                                                                Reply
                                                            </button>
                                                            <div className="flex items-center gap-1 text-gray-500">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLikeComment(comment.id)}
                                                                    disabled={likingCommentId === comment.id}
                                                                    className="p-0.5 hover:text-red-500 disabled:opacity-50 disabled:pointer-events-none"
                                                                    aria-label={comment.userLiked ? 'Unlike' : 'Like'}
                                                                >
                                                                    {comment.userLiked ? (
                                                                        <AiFillHeart className="w-4 h-4 text-red-500" />
                                                                    ) : (
                                                                        <FiHeart className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                                <span className="text-xs">{comment.likes || 0}</span>
                                                            </div>
                                                        </div>
                                                        {/* Reply input for this comment */}
                                                        {replyingToCommentId === comment.id && (
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={replyInputText}
                                                                    onChange={(e) => setReplyInputText(e.target.value)}
                                                                    placeholder="Write a reply..."
                                                                    className="flex-1 min-w-0 px-3 py-2 rounded-full bg-gray-100 text-gray-900 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                                                    disabled={!!submittingReplyId}
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReplyToComment(comment.id, replyInputText)}
                                                                    disabled={!replyInputText.trim() || !!submittingReplyId}
                                                                    className="p-2 text-gray-900 hover:text-black disabled:opacity-40"
                                                                >
                                                                    <FiSend className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        {/* Replies - nested under parent comment (collapsed by default) */}
                                                        {(comment.replies?.length ?? 0) > 0 && (
                                                            <div className="mt-2 ml-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setExpandedReplyThreads(prev => ({
                                                                            ...prev,
                                                                            [comment.id]: !prev[comment.id]
                                                                        }))
                                                                    }
                                                                    className="text-xs font-medium text-gray-500 hover:text-gray-800"
                                                                >
                                                                    {expandedReplyThreads[comment.id]
                                                                        ? `Hide replies (${comment.replies!.length})`
                                                                        : `View replies (${comment.replies!.length})`}
                                                                </button>

                                                                {expandedReplyThreads[comment.id] && (
                                                                    <div className="mt-2 pl-4 border-l-2 border-gray-200 bg-gray-50/80 rounded-r-md py-2 space-y-3">
                                                                        {comment.replies!.map((reply) => (
                                                                            <div key={reply.id} className="flex gap-2">
                                                                                <Avatar
                                                                                    src={
                                                                                        reply.userHandle === user?.handle
                                                                                            ? (user?.avatarUrl || getAvatarForHandle(reply.userHandle))
                                                                                            : getAvatarForHandle(reply.userHandle)
                                                                                    }
                                                                                    name={reply.userHandle?.split('@')[0] || 'User'}
                                                                                    size="sm"
                                                                                    className="flex-shrink-0 ring-1 ring-gray-200 w-6 h-6"
                                                                                />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-baseline gap-2 mb-0.5">
                                                                                        <span className="font-semibold text-xs text-gray-900">{reply.userHandle}</span>
                                                                                        <span className="text-xs text-gray-400">{timeAgo(reply.createdAt)}</span>
                                                                                    </div>
                                                                                    <p className="text-xs text-gray-900 mb-1">{reply.text}</p>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleLikeReply(comment.id, reply.id)}
                                                                                        disabled={likingReplyKey === `${comment.id}-${reply.id}`}
                                                                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 disabled:opacity-50 disabled:pointer-events-none"
                                                                                        aria-label={reply.userLiked ? 'Unlike reply' : 'Like reply'}
                                                                                        title={(reply.likes ?? 0) === 0 ? 'Like this reply' : `${reply.likes ?? 0} likes`}
                                                                                    >
                                                                                        {reply.userLiked ? (
                                                                                            <AiFillHeart className="w-3.5 h-3.5 text-red-500" />
                                                                                        ) : (
                                                                                            <FiHeart className="w-3.5 h-3.5" />
                                                                                        )}
                                                                                        <span className="text-xs" title="Likes on this reply">{reply.likes ?? 0}</span>
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Comment Input - TikTok style: avatar | Add comment... | icons.
                                    Hidden while replying to keep only one focused input on screen. */}
                                {replyingToCommentId === null && (
                                    <div className="px-4 py-3 flex-shrink-0 border-t border-gray-200 bg-white safe-area-inset-bottom">
                                        <form
                                            onSubmit={(e) => { e.preventDefault(); handleAddComment(); }}
                                            className="flex items-center gap-2"
                                        >
                                            <Avatar
                                                src={user?.avatarUrl}
                                                name={user?.name || user?.handle || 'User'}
                                                size="sm"
                                                className="flex-shrink-0 ring-1 ring-gray-200"
                                            />
                                            <input
                                                ref={expandedCommentInputRef}
                                                type="text"
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey && commentText.trim() && user) {
                                                        e.preventDefault();
                                                        handleAddComment(commentText.trim());
                                                    }
                                                }}
                                                placeholder="Add comment..."
                                                className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-gray-100 text-gray-900 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-gray-50"
                                                disabled={isAddingComment || !user}
                                            />
                                            <div className="flex items-center gap-1 flex-shrink-0 relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCommentEmojiPicker((v) => !v)}
                                                    className={`p-2 rounded-full ${showCommentEmojiPicker ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                                    aria-label="Add emoji"
                                                >
                                                    <FiSmile className="w-5 h-5" />
                                                </button>
                                                {showCommentEmojiPicker && (
                                                    <div className="absolute bottom-full left-0 mb-1 w-[min(100vw,320px)] h-[220px] min-h-[220px] p-2 rounded-xl bg-white border border-gray-200 shadow-xl z-[130] overflow-y-auto flex flex-col">
                                                        <div className="grid grid-cols-8 gap-1 flex-none" style={{ gridAutoRows: 'minmax(36px, 36px)' }}>
                                                            {['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤔', '😐', '😑', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '😵', '🤯', '😎', '🤓', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😢', '😭', '😤', '😡', '🤬', '💀', '💩', '👍', '👎', '👏', '🙌', '🤝', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💖', '💗', '💘', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].map((emoji) => (
                                                                <button
                                                                    key={emoji}
                                                                    type="button"
                                                                    className="flex items-center justify-center w-full h-9 text-xl hover:bg-gray-100 rounded touch-manipulation"
                                                                    onClick={() => {
                                                                        setCommentText((prev) => prev + emoji);
                                                                    }}
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={!commentText.trim() || isAddingComment || !user}
                                                    className="p-2 text-gray-900 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
                                                    aria-label="Send comment"
                                                >
                                                    <FiSend className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </>,
                        document.body
                    )}
                                </div>
                                {carouselNextPost && (
                                    <div className="w-full flex items-center justify-center bg-black" style={{ height: vh }}>
                                        <CarouselSlidePreview p={carouselNextPost} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
            {/* Share Modal - Render in portal outside ScenesModal */}
            {shareModalOpen && createPortal(
                <ShareModal
                    post={post}
                    isOpen={shareModalOpen}
                    onClose={() => {
                        console.log('Closing ShareModal from Scenes');
                        setShareModalOpen(false);
                    }}
                />,
                document.body
            )}
            {/* Save Post Modal - Render directly so it appears above Scenes overlay */}
            {saveModalOpen && user && (
                <SavePostModal
                    post={post}
                    userId={user.id}
                    isOpen={saveModalOpen}
                    onClose={() => {
                        setSaveModalOpen(false);
                    }}
                />
            )}
            {/* Post Options Menu - same as feed 3-dots menu */}
            {menuOpen && user && (
                <PostMenuModal
                    post={post}
                    userId={user.id}
                    isOpen={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    onCopyLink={() => { }}
                    onShare={onShare}
                    onReport={() => {
                        console.log('Report post from Scenes:', post.id);
                    }}
                    onUnfollow={async () => {
                        await onFollow();
                    }}
                    onMute={async () => {
                        console.log('Mute user from Scenes:', post.userHandle);
                    }}
                    onBlock={async () => {
                        console.log('Block user from Scenes:', post.userHandle);
                    }}
                    onHide={() => {
                        console.log('Hide post from Scenes:', post.id);
                    }}
                    onNotInterested={() => {
                        console.log('Not interested in post from Scenes:', post.id);
                    }}
                    onDelete={async () => {
                        console.log('Delete post from Scenes:', post.id);
                    }}
                    onEdit={() => {
                        console.log('Edit post from Scenes:', post.id);
                    }}
                    onArchive={async () => {
                        console.log('Archive post from Scenes:', post.id);
                    }}
                    onBoost={onBoost}
                    onReclip={onReclip}
                    onTurnOnNotifications={() => {
                        console.log('Turn on notifications for post from Scenes:', post.id);
                    }}
                    onTurnOffNotifications={() => {
                        console.log('Turn off notifications for post from Scenes:', post.id);
                    }}
                    isCurrentUser={user.handle === post.userHandle}
                    isFollowing={post.isFollowing === true}
                    isSaved={isSaved}
                    isMuted={false}
                    isBlocked={false}
                    hasNotifications={false}
                />
            )}
        </>
    );
}



