import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiHeart, FiShare2, FiRepeat, FiMapPin, FiVolume2, FiVolumeX, FiMessageSquare, FiChevronUp } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import Avatar from './Avatar';
import ShareModal from './ShareModal';
import StickerOverlayComponent from './StickerOverlay';
import EffectWrapper from './EffectWrapper';
import Flag from './Flag';
import type { EffectConfig } from '../utils/effects';
import { useAuth } from '../context/Auth';
import { useOnline } from '../hooks/useOnline';
import { addComment, fetchComments } from '../api/posts';
import type { Comment } from '../types';
import { enqueue } from '../utils/mutationQueue';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import type { Post } from '../types';
import { DOUBLE_TAP_THRESHOLD, ANIMATION_DURATIONS } from '../constants';

// Heart drop animation component - animates from tap position to like button
function HeartDropAnimation({ startX, startY, targetElement, onComplete }: { startX: number; startY: number; targetElement: HTMLElement; onComplete: () => void }) {
    const [progress, setProgress] = React.useState(0);
    const [endPosition, setEndPosition] = React.useState<{ x: number; y: number } | null>(null);
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
            onComplete();
        }
    }, [targetElement, onComplete]);

    if (!endPosition) return null;

    const deltaX = endPosition.x - startX;
    const deltaY = endPosition.y - startY;
    const currentX = startX + deltaX * progress;
    const currentY = startY + deltaY * progress;
    const scale = 1 - (progress * 0.7); // Scale from 1 to 0.3
    const opacity = 1 - progress;

    return (
        <div
            ref={heartRef}
            className="fixed pointer-events-none z-[9999]"
            style={{
                left: `${currentX}px`,
                top: `${currentY}px`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                opacity: opacity,
                transition: 'none'
            }}
        >
            <svg
                className="w-20 h-20 text-red-500 drop-shadow-lg"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
            </svg>
        </div>
    );
}

type ScenesModalProps = {
    post: Post;
    isOpen: boolean;
    onClose: () => void;
    onLike: () => Promise<void>;
    onFollow: () => Promise<void>;
    onShare: () => Promise<void>;
    onOpenComments: () => void;
    onReclip: () => Promise<void>;
};

export default function ScenesModal({
    post,
    isOpen,
    onClose,
    onLike,
    onFollow,
    onShare,
    onOpenComments,
    onReclip
}: ScenesModalProps) {
    const [liked, setLiked] = React.useState(post.userLiked);
    const [likes, setLikes] = React.useState(post.stats.likes);
    const [comments, setComments] = React.useState(post.stats.comments);
    const [shares, setShares] = React.useState(post.stats.shares);
    const [reclips, setReclips] = React.useState(post.stats.reclips);
    const [isFollowing, setIsFollowing] = React.useState(post.isFollowing);
    const [userReclipped, setUserReclipped] = React.useState(post.userReclipped || false);
    const [busy, setBusy] = React.useState(false);
    const [commentText, setCommentText] = React.useState('');
    const [isAddingComment, setIsAddingComment] = React.useState(false);
    const [heartBurst, setHeartBurst] = React.useState(false);
    const [shareModalOpen, setShareModalOpen] = React.useState(false);
    const [videoProgress, setVideoProgress] = React.useState(0);
    const [isMuted, setIsMuted] = React.useState(true);
    const [isPaused, setIsPaused] = React.useState(false);
    const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false);
    const [commentsList, setCommentsList] = React.useState<Comment[]>([]);
    const [isLoadingComments, setIsLoadingComments] = React.useState(false);
    const [sheetDragY, setSheetDragY] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);
    const sheetRef = React.useRef<HTMLDivElement>(null);
    const dragStartY = React.useRef<number>(0);
    const [tapPosition, setTapPosition] = React.useState<{ x: number; y: number } | null>(null);
    const [heartAnimation, setHeartAnimation] = React.useState<{ startX: number; startY: number } | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const lastTapRef = React.useRef<number>(0);
    const touchHandledRef = React.useRef<boolean>(false);
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);
    const likeButtonRef = React.useRef<HTMLButtonElement>(null);
    const isProcessingDoubleTap = React.useRef<boolean>(false);
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
    const { user } = useAuth();
    const online = useOnline();

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
        setHeartAnimation(null);
        setHeartBurst(false);
        isProcessingDoubleTap.current = false;
    }, [currentIndex, currentItem?.type]);

    // Sync video muted state with ref
    React.useEffect(() => {
        if (videoRef.current && currentItem?.type === 'video') {
            videoRef.current.muted = isMuted;
        }
    }, [isMuted, currentItem?.type]);

    // Ensure video is paused when isPaused is true
    React.useEffect(() => {
        if (videoRef.current && currentItem?.type === 'video') {
            if (isPaused && !videoRef.current.paused) {
                videoRef.current.pause();
                // Force pause to ensure audio stops immediately
                videoRef.current.currentTime = videoRef.current.currentTime;
                // Also pause all other videos on the page to prevent background audio
                const allVideos = document.querySelectorAll('video');
                allVideos.forEach((video) => {
                    if (video !== videoRef.current && !video.paused) {
                        video.pause();
                    }
                });
            } else if (!isPaused && videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
            }
        }
    }, [isPaused, currentItem?.type]);

    // Pause all videos on the page when Scenes opens
    React.useEffect(() => {
        if (isOpen) {
            // Pause all video elements on the page to prevent background audio
            const allVideos = document.querySelectorAll('video');
            allVideos.forEach((video) => {
                if (!video.paused) {
                    video.pause();
                }
            });
        }
    }, [isOpen]);

    // Cleanup animation states when modal closes
    React.useEffect(() => {
        if (!isOpen) {
            // Pause video when modal closes to stop any audio
            if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
            }
            setTapPosition(null);
            setHeartAnimation(null);
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

    // Sync with post data changes
    React.useEffect(() => {
        setLiked(post.userLiked);
        setLikes(post.stats.likes);
        setComments(post.stats.comments);
        setShares(post.stats.shares);
        setReclips(post.stats.reclips);
        setIsFollowing(post.isFollowing);
        setUserReclipped(post.userReclipped || false);
    }, [post.userLiked, post.stats.likes, post.stats.comments, post.stats.shares, post.stats.reclips, post.isFollowing, post.userReclipped]);

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

    React.useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        if (isOpen) {
            document.addEventListener('keydown', onKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    async function handleLike() {
        if (busy) return;
        setBusy(true);
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
            setBusy(false);
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

            // Show heart burst animation
            setHeartBurst(true);

            // Trigger heart animation to like button - start after pop-up animation has appeared
            // The pop-up animation is 400ms, start drop animation at 200ms so they overlap smoothly
            setTimeout(() => {
                if (likeButtonRef.current) {
                    setHeartAnimation({ startX: clientX, startY: clientY });
                }
            }, 200);

            // Clear tap position and burst after pop-up animation completes (400ms)
            setTimeout(() => {
                setTapPosition(null);
                setHeartBurst(false);
            }, 400);

            // Reset processing flag after all animations complete (pop-up 400ms + drop 800ms = 1200ms)
            setTimeout(() => {
                isProcessingDoubleTap.current = false;
            }, 1200);

            if (!busy && !liked) {
                setBusy(true);
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
                    setBusy(false);
                }
            }
            // Note: Processing flag is reset after 1200ms regardless of whether we liked or not
        } else {
            // Single tap - toggle play/pause for videos
            if (currentItem?.type === 'video' && videoRef.current) {
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
        }
        lastTapRef.current = now;
    }, [currentItem?.type, onLike, busy, liked]);

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

    async function handleFollow() {
        if (busy) return;
        setBusy(true);
        try {
            // Optimistically update UI
            setIsFollowing(prev => !prev);
            await onFollow();
        } catch (error) {
            // Revert on error
            setIsFollowing(post.isFollowing);
            console.error('Error toggling follow:', error);
        } finally {
            setBusy(false);
        }
    }

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
        if (busy) return;
        if (post.userHandle === user?.handle) {
            return;
        }
        if (userReclipped) {
            return;
        }
        setBusy(true);
        try {
            await onReclip();
        } catch (error) {
            console.error('Error reclipping post:', error);
        } finally {
            setBusy(false);
        }
    }

    // Handle caption expansion
    const handleCaptionClick = async () => {
        if (isCaptionExpanded) {
            setIsCaptionExpanded(false);
            setSheetDragY(0);
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

    // Drag handlers for bottom sheet
    const handleSheetTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        dragStartY.current = e.touches[0].clientY;
    };

    const handleSheetTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - dragStartY.current;
        if (deltaY > 0) {
            setSheetDragY(deltaY);
        }
    };

    const handleSheetTouchEnd = () => {
        if (sheetDragY > 100) {
            // Dismiss if dragged down more than 100px
            setIsCaptionExpanded(false);
        }
        setSheetDragY(0);
        setIsDragging(false);
    };

    async function handleAddComment(e: React.FormEvent) {
        e.preventDefault();
        if (!commentText.trim() || isAddingComment || !user) return;

        const text = commentText.trim();

        // Clear the input immediately for better UX (before disabling)
        setCommentText('');
        setIsAddingComment(true);

        try {
            // Increment comment count optimistically using functional update
            setComments(prev => prev + 1);

            if (!online) {
                await enqueue({ type: 'comment', postId: post.id, userId: user.id, text });
            } else {
                // Use the same addComment function as CommentsModal
                await addComment(post.id, user?.handle || 'darraghdublin', text);
                // Refresh comments list
                const fetchedComments = await fetchComments(post.id);
                setCommentsList(fetchedComments);
            }

            // Dispatch event after successful comment
            window.dispatchEvent(new CustomEvent(`commentAdded-${post.id}`, {
                detail: { text }
            }));
        } catch (error) {
            console.error('Error adding comment:', error);
            // Restore text on error
            setCommentText(text);
            // Revert comment count on error
            setComments(prev => Math.max(0, prev - 1));
        } finally {
            setIsAddingComment(false);
        }
    }

    if (!isOpen) return null;

    React.useEffect(() => {
        console.log('ScenesModal - shareModalOpen changed:', shareModalOpen);
    }, [shareModalOpen]);

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
                    {/* Top Left - Location and Time */}
                    <div className="absolute top-6 left-4 z-10 flex flex-col gap-1">
                        {post.locationLabel && (
                            <div className="bg-red-500 text-white text-sm font-medium flex items-center gap-1.5 px-2 py-1 rounded">
                                <FiMapPin className="w-4 h-4" />
                                <span>{post.locationLabel}</span>
                            </div>
                        )}
                        {post.createdAt && (
                            <div className="bg-black text-white text-xs px-2 py-1 rounded">
                                {timeAgo(post.createdAt)}
                            </div>
                        )}
                    </div>

                    {/* Top Bar - Counter and Close Button - Evenly Spaced */}
                    <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-4">
                        {/* Left side - Empty spacer */}
                        <div className="flex-1 flex justify-start">
                        </div>

                        {/* Center - Counter (only for multi-item posts) */}
                        <div className="flex-1 flex justify-center">
                            {hasMultipleItems && (
                                <div className="px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                                    {currentIndex + 1} / {items.length}
                                </div>
                            )}
                        </div>

                        {/* Right side - Close button */}
                        <div className="flex-1 flex justify-end">
                            <button
                                onClick={onClose}
                                aria-label="Close scenes"
                                className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Main Media Content */}
                    <div
                        ref={mediaContainerRef}
                        className={`w-full h-full flex items-center justify-center relative select-none cursor-pointer transition-all duration-300 ease-out ${isCaptionExpanded
                            ? 'scale-[0.45] -translate-y-[25%] origin-top'
                            : 'scale-100 translate-y-0'
                            }`}
                        onClick={(e) => {
                            // Only handle media click if clicking directly on the media area (not on buttons)
                            if (e.target === e.currentTarget || (e.target instanceof HTMLElement && !e.target.closest('button'))) {
                                handleMediaClick(e);
                            }
                        }}
                        onTouchEnd={handleMediaTouchEnd}
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
                                        className="w-full h-full object-contain pointer-events-none"
                                        src={currentItem.url}
                                        controls={false}
                                        autoPlay
                                        loop
                                        playsInline
                                        muted={isMuted}
                                        onPlay={() => setIsPaused(false)}
                                        onPause={() => setIsPaused(true)}
                                        onTimeUpdate={(e) => {
                                            const video = e.currentTarget;
                                            if (video.duration) {
                                                setVideoProgress(video.currentTime / video.duration);
                                            }
                                        }}
                                    />
                                    {/* Video progress bar - positioned at top */}
                                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/50 z-20">
                                        <div
                                            className="h-full transition-all duration-100"
                                            style={{
                                                width: `${Math.max(0, Math.min(100, videoProgress * 100))}%`,
                                                background: 'linear-gradient(to right, rgb(255, 140, 0) 5%, rgb(248, 0, 50) 25%, rgb(255, 0, 160) 45%, rgb(140, 40, 255) 65%, rgb(0, 35, 255) 82%, rgb(25, 160, 255) 96%)',
                                                boxShadow: '0 0 12px rgba(139,92,246,0.45)'
                                            }}
                                        />
                                    </div>
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

                        {/* Permanent small hearts on left side when liked */}
                        {liked && (
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-3 pointer-events-none">
                                <div className="w-4 h-4">
                                    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
                                        <path fill="#ef4444" d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
                                    </svg>
                                </div>
                                <div className="w-3 h-3">
                                    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
                                        <path fill="#ef4444" d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
                                    </svg>
                                </div>
                                <div className="w-2.5 h-2.5">
                                    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
                                        <path fill="#ef4444" d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
                                    </svg>
                                </div>
                            </div>
                        )}

                        {/* Heart pop-up animation at tap position */}
                        {tapPosition && (
                            <div
                                className="absolute pointer-events-none z-50 transition-opacity duration-300"
                                style={{
                                    left: `${tapPosition.x}px`,
                                    top: `${tapPosition.y}px`,
                                    transform: 'translate(-50%, -50%)',
                                    animation: 'heartPopUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                                }}
                            >
                                {/* Enhanced heart burst animation with Gazetteer gradient */}
                                <div className={`relative transition-all duration-300 ${heartBurst ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                    {/* Main heart */}
                                    <svg className="w-20 h-20 drop-shadow-lg animate-pulse" viewBox="0 0 24 24">
                                        <defs>
                                            <linearGradient id="scenesHeartGradientMain" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#ff4ecb" />
                                                <stop offset="50%" stopColor="#8f5bff" />
                                                <stop offset="100%" stopColor="#ff4ecb" />
                                            </linearGradient>
                                        </defs>
                                        <path
                                            d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                                            fill="url(#scenesHeartGradientMain)"
                                        />
                                    </svg>

                                    {/* Floating hearts */}
                                    <div className="absolute inset-0">
                                        <div className={`absolute top-2 left-2 w-4 h-4 transition-all duration-500 ${heartBurst ? 'opacity-100 translate-y-[-20px]' : 'opacity-0 translate-y-0'}`}>
                                            <svg viewBox="0 0 24 24">
                                                <defs>
                                                    <linearGradient id="scenesHeartGradientSmall1" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#ff4ecb" stopOpacity="0.9" />
                                                        <stop offset="100%" stopColor="#8f5bff" stopOpacity="0.9" />
                                                    </linearGradient>
                                                </defs>
                                                <path
                                                    d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                                                    fill="url(#scenesHeartGradientSmall1)"
                                                />
                                            </svg>
                                        </div>
                                        <div className={`absolute top-4 right-2 w-3 h-3 transition-all duration-700 delay-100 ${heartBurst ? 'opacity-100 translate-y-[-25px] translate-x-[10px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                                            <svg viewBox="0 0 24 24">
                                                <defs>
                                                    <linearGradient id="scenesHeartGradientSmall2" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#ff4ecb" stopOpacity="0.8" />
                                                        <stop offset="100%" stopColor="#8f5bff" stopOpacity="0.8" />
                                                    </linearGradient>
                                                </defs>
                                                <path
                                                    d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                                                    fill="url(#scenesHeartGradientSmall2)"
                                                />
                                            </svg>
                                        </div>
                                        <div className={`absolute bottom-2 left-4 w-2 h-2 transition-all duration-600 delay-200 ${heartBurst ? 'opacity-100 translate-y-[-15px] translate-x-[-8px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                                            <svg viewBox="0 0 24 24">
                                                <defs>
                                                    <linearGradient id="scenesHeartGradientSmall3" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#ff4ecb" stopOpacity="0.7" />
                                                        <stop offset="100%" stopColor="#8f5bff" stopOpacity="0.7" />
                                                    </linearGradient>
                                                </defs>
                                                <path
                                                    d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                                                    fill="url(#scenesHeartGradientSmall3)"
                                                />
                                            </svg>
                                        </div>
                                        <div className={`absolute bottom-4 right-4 w-3 h-3 transition-all duration-500 delay-150 ${heartBurst ? 'opacity-100 translate-y-[-20px] translate-x-[5px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                                            <svg viewBox="0 0 24 24">
                                                <defs>
                                                    <linearGradient id="scenesHeartGradientSmall4" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#ff4ecb" stopOpacity="0.85" />
                                                        <stop offset="100%" stopColor="#8f5bff" stopOpacity="0.85" />
                                                    </linearGradient>
                                                </defs>
                                                <path
                                                    d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                                                    fill="url(#scenesHeartGradientSmall4)"
                                                />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Pulse rings */}
                                    <div className={`absolute inset-0 rounded-full transition-all duration-1000 border-2 ${heartBurst ? 'opacity-100 scale-150 border-pink-400/80' : 'opacity-0 scale-100 border-pink-400/40'}`}></div>
                                    <div className={`absolute inset-0 rounded-full transition-all duration-1200 delay-100 border ${heartBurst ? 'opacity-100 scale-200 border-purple-300/80' : 'opacity-0 scale-100 border-purple-300/40'}`}></div>
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
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setIsMuted(prev => !prev);
                                        }}
                                        onTouchEnd={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setIsMuted(prev => !prev);
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

                    {/* Right Side Engagement Bar - Instagram Reels Style with Scrim */}
                    <div className="absolute right-0 bottom-32 z-20 flex flex-col items-center gap-6 px-4 py-3 pointer-events-none" onClick={(e) => e.stopPropagation()}>
                        {/* Scrim effect - gradient overlay for better readability */}
                        <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/50 to-transparent pointer-events-none z-0 rounded-l-2xl" />

                        {/* Content layer - above scrim */}
                        <div className="relative z-10 flex flex-col items-center gap-6 pointer-events-auto">
                            {/* Like Button */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    ref={likeButtonRef}
                                    onClick={handleLike}
                                    className={`w-8 h-8 flex items-center justify-center rounded transition-all duration-200 ${liked
                                        ? 'bg-white/20'
                                        : 'bg-black/30 hover:bg-black/50'
                                        }`}
                                    aria-label={liked ? 'Unlike' : 'Like'}
                                >
                                    {liked ? (
                                        <AiFillHeart className="text-red-500 w-4 h-4" />
                                    ) : (
                                        <FiHeart className="text-white w-4 h-4" />
                                    )}
                                </button>
                                <span className="text-white text-[10px] font-semibold drop-shadow-md">{likes}</span>
                            </div>

                            {/* Share Button */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    onClick={handleShare}
                                    className="w-8 h-8 flex items-center justify-center rounded bg-black/30 hover:bg-black/50 transition-colors"
                                    aria-label="Share"
                                >
                                    <FiShare2 className="text-white w-4 h-4" />
                                </button>
                                <span className="text-white text-[10px] font-semibold drop-shadow-md">{shares}</span>
                            </div>

                            {/* Reclip Button */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    onClick={(e) => handleReclip(e)}
                                    disabled={post.userHandle === user?.handle || userReclipped || busy}
                                    className={`w-8 h-8 flex items-center justify-center rounded transition-colors relative z-10 ${post.userHandle === user?.handle || busy ? 'opacity-30 cursor-not-allowed' : userReclipped ? 'bg-green-500/20 hover:bg-green-500/30' : 'bg-black/30 hover:bg-black/50'}`}
                                    aria-label={post.userHandle === user?.handle ? "Cannot reclip your own post" : userReclipped ? "Post already reclipped" : "Reclip"}
                                    title={post.userHandle === user?.handle ? "Cannot reclip your own post" : userReclipped ? "Post already reclipped" : "Reclip"}
                                >
                                    <FiRepeat className={`w-4 h-4 ${userReclipped ? 'text-green-500' : 'text-white'}`} />
                                </button>
                                <span className="text-white text-[10px] font-semibold drop-shadow-md">{reclips}</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section with Profile, Caption, and Comment Input - Instagram Reels Style */}
                    {!isCaptionExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                            <div className="max-w-md mx-auto px-4 pr-16 pb-safe">
                                {/* Profile & Caption Section */}
                                <div className="pt-12 pb-4">
                                    {/* Profile Section */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <Avatar
                                            src={user?.handle === post.userHandle ? user?.avatarUrl : getAvatarForHandle(post.userHandle)}
                                            name={post.userHandle.split('@')[0]}
                                            size="sm"
                                            className="border-2 border-white"
                                        />
                                        <div className="flex-1">
                                            <button className="text-white font-semibold text-sm hover:opacity-80">
                                                {post.userHandle}
                                            </button>
                                            {post.locationLabel && (
                                                <div className="text-white/70 text-xs flex items-center gap-1 mt-0.5">
                                                    <FiMapPin className="w-3 h-3" />
                                                    {post.locationLabel}
                                                </div>
                                            )}
                                        </div>
                                        {!isFollowing && (
                                            <button
                                                onClick={handleFollow}
                                                disabled={busy}
                                                className="px-4 py-1.5 bg-white text-black text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {busy ? 'Following...' : 'Follow'}
                                            </button>
                                        )}
                                        {isFollowing && (
                                            <button
                                                onClick={handleFollow}
                                                disabled={busy}
                                                className="px-4 py-1.5 bg-white/10 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {busy ? 'Unfollowing...' : 'Following'}
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

                                    {/* Comment Count - Clickable to open comments */}
                                    {comments > 0 && (
                                        <button
                                            onClick={onOpenComments}
                                            className="text-white text-xs opacity-80 hover:opacity-100 mb-3"
                                        >
                                            View all {comments} {comments === 1 ? 'comment' : 'comments'}
                                        </button>
                                    )}
                                </div>

                                {/* Comment Input at Bottom - Instagram Reels Style */}
                                <div className="pb-4">
                                    <form onSubmit={handleAddComment} className="flex items-center gap-2">
                                        <Avatar
                                            src={user?.avatarUrl}
                                            name={user?.name || user?.handle || 'User'}
                                            size="sm"
                                            className="border border-white/50"
                                        />
                                        <div className="relative flex-1 rounded">
                                            {/* Scrim effect */}
                                            <div className="pointer-events-none absolute inset-0 rounded bg-black/30 backdrop-blur-sm"></div>
                                            <input
                                                type="text"
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                placeholder="Add Comment..."
                                                className="relative w-full px-3 py-1.5 rounded bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/15"
                                                disabled={isAddingComment || !user}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={!commentText.trim() || isAddingComment || !user}
                                            className="w-12 h-8 flex items-center justify-center text-white font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity border-2 border-white rounded"
                                        >
                                            {isAddingComment ? '...' : 'Post'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Sheet - Caption and Comments (Instagram Reels Style) */}
                    {isCaptionExpanded && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 bg-black/50 z-40"
                                onClick={handleCaptionClick}
                            />
                            {/* Bottom Sheet */}
                            <div
                                ref={sheetRef}
                                className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out flex flex-col"
                                style={{
                                    transform: `translateY(${Math.max(0, sheetDragY)}px)`,
                                    maxHeight: '80vh',
                                    height: sheetDragY > 0 ? `calc(80vh - ${sheetDragY}px)` : '80vh',
                                    paddingBottom: 'env(safe-area-inset-bottom, 0px)'
                                }}
                                onTouchStart={handleSheetTouchStart}
                                onTouchMove={handleSheetTouchMove}
                                onTouchEnd={handleSheetTouchEnd}
                            >
                                {/* Drag Handle */}
                                <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                                    <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                                </div>

                                {/* Content */}
                                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                                    {/* Scrollable Content */}
                                    <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
                                        {/* Profile Section */}
                                        <div className="flex items-center gap-3 mb-4 pt-2">
                                            <Avatar
                                                src={getAvatarForHandle(post.userHandle)}
                                                name={post.userHandle.split('@')[0]}
                                                size="sm"
                                                className="border-2 border-gray-200 dark:border-gray-700"
                                            />
                                            <div className="flex-1">
                                                <button className="text-gray-900 dark:text-white font-semibold text-sm hover:opacity-80">
                                                    {post.userHandle}
                                                </button>
                                                {post.locationLabel && (
                                                    <div className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                                                        <FiMapPin className="w-3 h-3" />
                                                        {post.locationLabel}
                                                    </div>
                                                )}
                                            </div>
                                            {!isFollowing && (
                                                <button
                                                    onClick={handleFollow}
                                                    disabled={busy}
                                                    className="px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {busy ? 'Following...' : 'Follow'}
                                                </button>
                                            )}
                                            {isFollowing && (
                                                <button
                                                    onClick={handleFollow}
                                                    disabled={busy}
                                                    className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {busy ? 'Unfollowing...' : 'Following'}
                                                </button>
                                            )}
                                        </div>

                                        {/* Full Caption */}
                                        {(post.caption || post.text) && (
                                            <div className="mb-6">
                                                <p className="text-gray-900 dark:text-white text-sm whitespace-pre-line break-words">
                                                    {post.caption || post.text}
                                                </p>
                                            </div>
                                        )}

                                        {/* Comments Section */}
                                        <div className="mb-4">
                                            <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-4">
                                                Comments ({comments})
                                            </h3>

                                            {isLoadingComments ? (
                                                <div className="flex justify-center py-8">
                                                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-black dark:border-t-white rounded-full animate-spin" />
                                                </div>
                                            ) : commentsList.length === 0 ? (
                                                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                                                    No comments yet. Be the first to comment!
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {commentsList.map((comment) => (
                                                        <div key={comment.id} className="flex gap-3">
                                                            <Avatar
                                                                name={comment.userHandle?.split('@')[0] || 'User'}
                                                                size="sm"
                                                            />
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                                                                        {comment.userHandle}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {timeAgo(comment.createdAt)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                                                                    {comment.text}
                                                                </p>
                                                                <div className="flex items-center gap-4">
                                                                    <button className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                                                        <FiHeart className="w-3.5 h-3.5" />
                                                                        {comment.likes || 0}
                                                                    </button>
                                                                    <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                                                        Reply
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Comment Input at Bottom */}
                                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 pt-4 pb-6 bg-white dark:bg-gray-900 flex-shrink-0 safe-area-inset-bottom">
                                        <form onSubmit={handleAddComment} className="flex items-center gap-2">
                                            <Avatar
                                                src={user?.avatarUrl}
                                                name={user?.name || user?.handle || 'User'}
                                                size="sm"
                                                className="border border-gray-200 dark:border-gray-700"
                                            />
                                            <div className="relative flex-1 rounded">
                                                <div className="pointer-events-none absolute inset-0 rounded bg-gray-100 dark:bg-gray-800"></div>
                                                <input
                                                    type="text"
                                                    value={commentText}
                                                    onChange={(e) => setCommentText(e.target.value)}
                                                    placeholder="Add a comment..."
                                                    className="relative w-full px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:bg-white dark:focus:bg-gray-700"
                                                    disabled={isAddingComment || !user}
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={!commentText.trim() || isAddingComment || !user}
                                                className="w-12 h-8 flex items-center justify-center text-black dark:text-white font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity border-2 border-black dark:border-white rounded"
                                            >
                                                {isAddingComment ? '...' : 'Post'}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
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

            {/* Heart animation from tap to like button - rendered after EngagementBar so ref is set */}
            {heartAnimation && likeButtonRef.current && (
                <HeartDropAnimation
                    key={`heart-${post.id}-${heartAnimation.startX}-${heartAnimation.startY}`}
                    startX={heartAnimation.startX}
                    startY={heartAnimation.startY}
                    targetElement={likeButtonRef.current}
                    onComplete={() => setHeartAnimation(null)}
                />
            )}
        </>
    );
}


