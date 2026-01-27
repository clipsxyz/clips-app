import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiX, FiHeart, FiShare2, FiRepeat, FiMapPin, FiVolume2, FiVolumeX, FiMessageSquare, FiMessageCircle, FiChevronUp, FiBookmark, FiMoreHorizontal, FiSend } from 'react-icons/fi';
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
import { addComment, fetchComments } from '../api/posts';
import { getCollectionsForPost } from '../api/collections';
import { isProfilePrivate, canSendMessage, hasPendingFollowRequest, createFollowRequest } from '../api/privacy';
import { getFollowedUsers, setFollowState } from '../api/posts';
import Swal from 'sweetalert2';
import type { Comment } from '../types';
import { enqueue } from '../utils/mutationQueue';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import type { Post } from '../types';
import { DOUBLE_TAP_THRESHOLD, ANIMATION_DURATIONS } from '../constants';
import StreetSign from './StreetSign';

// Heart drop animation component - animates from tap position to like button
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
    initialVideoTime?: number | null;
    initialMutedState?: boolean | null;
    onClose: (savedTime?: number) => void;
    onLike: () => Promise<void>;
    onFollow: () => Promise<boolean | void>;
    onShare: () => Promise<void>;
    onOpenComments: () => void;
    onReclip: () => Promise<void>;
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
    const [isMuted, setIsMuted] = React.useState(initialMutedState !== null ? initialMutedState : true);
    const [isPaused, setIsPaused] = React.useState(false);
    const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false);
    const [commentsList, setCommentsList] = React.useState<Comment[]>([]);
    const [isLoadingComments, setIsLoadingComments] = React.useState(false);
    const [sheetDragY, setSheetDragY] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);
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
    const { user } = useAuth();
    const online = useOnline();
    const navigate = useNavigate();
    const [saveModalOpen, setSaveModalOpen] = React.useState(false);
    const [isSaved, setIsSaved] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);

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
                    {/* Top Left - Street sign with location (top) and time (bottom) */}
                    <div className="absolute top-5 left-3 z-10">
                        <StreetSign
                            topLabel={post.locationLabel || ''}
                            bottomLabel={post.createdAt ? timeAgo(post.createdAt) : ''}
                        />
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
                        className={`w-full h-full flex items-center justify-center select-none cursor-pointer transition-all duration-300 ease-out ${isCaptionExpanded
                            ? 'absolute top-[8%] left-1/2 -translate-x-1/2 scale-[0.45] origin-top'
                            : 'relative scale-100'
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

                        {/* Heart pop-up animation at tap position */}
                        {tapPosition && heartBurst && (
                            <div
                                className="absolute pointer-events-none z-50"
                                style={{
                                    left: `${tapPosition.x}px`,
                                    top: `${tapPosition.y}px`,
                                    transform: 'translate(-50%, -50%)',
                                    animation: 'heartPopUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                                    opacity: 1,
                                    transition: 'opacity 0.3s ease-out'
                                }}
                            >
                                {/* Enhanced heart burst animation with white to purple gradient */}
                                <div className="relative transition-all duration-300 opacity-100 scale-100">
                                    {/* Main heart - doubled in size (removed animate-pulse to prevent continuous flashing) */}
                                    <svg className="w-40 h-40 drop-shadow-lg" viewBox="0 0 24 24">
                                        <defs>
                                            <linearGradient id="scenesHeartGradientMain" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#ffffff" />
                                                <stop offset="50%" stopColor="#a855f7" />
                                                <stop offset="100%" stopColor="#8f5bff" />
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

                    {/* Right Side Engagement Bar - centered vertically, no background scrim */}
                    <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-6 px-3 pointer-events-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Content layer */}
                        <div className="flex flex-col items-center gap-6 pointer-events-auto">
                            {/* Like Button */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    ref={likeButtonRef}
                                    onClick={handleLike}
                                    className="flex items-center justify-center transition-all duration-200"
                                    aria-label={liked ? 'Unlike' : 'Like'}
                                >
                                    {liked ? (
                                        <AiFillHeart className="text-purple-500 w-7 h-7" />
                                    ) : (
                                        <AiFillHeart className="text-white w-7 h-7" />
                                    )}
                                </button>
                                <span className="text-white text-[10px] font-semibold">{likes}</span>
                            </div>

                            {/* Share Button */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    onClick={handleShare}
                                    className="flex items-center justify-center transition-colors"
                                    aria-label="Share"
                                >
                                    <FiShare2 className="text-white w-7 h-7" />
                                </button>
                                <span className="text-white text-[10px] font-semibold">{shares}</span>
                            </div>

                            {/* Save to Collection Button */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    onClick={() => {
                                        setSaveModalOpen(true);
                                    }}
                                    className="flex items-center justify-center transition-colors"
                                    aria-label="Save to collection"
                                >
                                    <FiBookmark
                                        className={`w-7 h-7 ${isSaved ? 'text-yellow-400 fill-yellow-400' : 'text-white'}`}
                                    />
                                </button>
                                <span className="text-white text-[10px] font-semibold">
                                    {isSaved ? 'Saved' : 'Save'}
                                </span>
                            </div>

                            {/* Reclip Button */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    onClick={(e) => handleReclip(e)}
                                    disabled={post.userHandle === user?.handle || userReclipped || busy}
                                    className={`flex items-center justify-center transition-colors relative z-10 ${post.userHandle === user?.handle || busy ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    aria-label={post.userHandle === user?.handle ? "Cannot reclip your own post" : userReclipped ? "Post already reclipped" : "Reclip"}
                                    title={post.userHandle === user?.handle ? "Cannot reclip your own post" : userReclipped ? "Post already reclipped" : "Reclip"}
                                >
                                    <FiRepeat className={`w-7 h-7 ${userReclipped ? 'text-green-500' : 'text-white'}`} />
                                </button>
                                <span className="text-white text-[10px] font-semibold">{reclips}</span>
                            </div>

                            {/* DM Button */}
                            <div className="flex flex-col items-center gap-1.5">
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
                                                await Swal.fire({
                                                    title: 'Follow Request Pending',
                                                    html: `
                                                        <div style="text-align: center; padding: 10px 0;">
                                                            <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0 0 20px 0;">
                                                                This user has a private profile. You have already sent a follow request. Once they accept, you'll be able to send them a message.
                                                            </p>
                                                        </div>
                                                    `,
                                                    icon: 'info',
                                                    background: '#262626',
                                                    color: '#ffffff',
                                                    confirmButtonText: 'OK',
                                                    confirmButtonColor: '#8B5CF6'
                                                });
                                                return;
                                            }
                                            
                                            const result = await Swal.fire({
                                                title: 'Cannot Send Message',
                                                html: `
                                                    <div style="text-align: center; padding: 10px 0;">
                                                        <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0 0 20px 0;">
                                                            This user has a private profile. You must follow them and have your follow request accepted before you can send them a message.
                                                        </p>
                                                    </div>
                                                `,
                                                icon: 'warning',
                                                background: '#262626',
                                                color: '#ffffff',
                                                showCancelButton: true,
                                                confirmButtonText: 'Request to Follow',
                                                confirmButtonColor: '#8B5CF6',
                                                cancelButtonText: 'Cancel',
                                                cancelButtonColor: '#6B7280'
                                            });
                                            
                                            if (result.isConfirmed) {
                                                createFollowRequest(user.handle, post.userHandle);
                                                if (user?.id) setFollowState(user.id, post.userHandle, false);
                                                Swal.fire({
                                                    title: 'Follow Request Sent',
                                                    text: 'You will be notified when they accept your request.',
                                                    icon: 'success',
                                                    timer: 2000,
                                                    showConfirmButton: false,
                                                    background: '#262626',
                                                    color: '#ffffff'
                                                });
                                            }
                                            return;
                                        }
                                        
                                        // If they can message, navigate to DM page
                                        navigate(`/messages/${encodeURIComponent(post.userHandle)}`);
                                        onClose();
                                    }}
                                    disabled={!user || post.userHandle === user?.handle}
                                    className="flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
                                    aria-label="Send direct message"
                                >
                                    <FiSend className="w-7 h-7 text-white" />
                                </button>
                            </div>

                            {/* More Options (three dots) */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    onClick={() => setMenuOpen(true)}
                                    className="flex items-center justify-center transition-colors"
                                    aria-label="More options"
                                >
                                    <FiMoreHorizontal className="text-white w-7 h-7" />
                                </button>
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
                                <div className="pb-4 px-3 sm:px-4">
                                    <form onSubmit={handleAddComment} className="flex items-center gap-2">
                                        <Avatar
                                            src={user?.avatarUrl}
                                            name={user?.name || user?.handle || 'User'}
                                            size="sm"
                                            className="border border-white/50 flex-shrink-0"
                                        />
                                        <input
                                            type="text"
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Add Comment..."
                                            className="flex-1 px-3 sm:px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/15 min-w-0"
                                            disabled={isAddingComment || !user}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!commentText.trim() || isAddingComment || !user}
                                            className="px-3 sm:px-4 h-9 flex items-center justify-center text-white font-semibold text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity flex-shrink-0 whitespace-nowrap"
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
                                    maxHeight: '50vh',
                                    height: sheetDragY > 0 ? `calc(50vh - ${sheetDragY}px)` : '50vh',
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
                                            {/* Profile picture with rounded-md shape and animated white border */}
                                            <div className="relative w-8 h-8 rounded-md overflow-visible">
                                                {/* Animated white border wrapper */}
                                                <div
                                                    className="absolute inset-0 rounded-md p-0.5 overflow-hidden z-0"
                                                    style={{
                                                        background: 'white',
                                                    }}
                                                >
                                                    {/* Overlay that covers border initially, then rotates to reveal it */}
                                                    <div
                                                        ref={profileBorderOverlayRef2}
                                                        className="absolute inset-0 bg-white dark:bg-gray-900 rounded-md"
                                                        style={{
                                                            maskImage: 'conic-gradient(from 0deg, black 360deg)',
                                                            WebkitMaskImage: 'conic-gradient(from 0deg, black 360deg)',
                                                        }}
                                                    />
                                                    <div className="w-full h-full rounded-md bg-white dark:bg-gray-900" />
                                                </div>
                                                {/* Profile picture content - positioned above border */}
                                                <div className="absolute inset-[2px] rounded-md overflow-hidden flex items-center justify-center bg-white dark:bg-gray-900 z-10">
                                                    {getAvatarForHandle(post.userHandle) ? (
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
                                                    {!getAvatarForHandle(post.userHandle) && (
                                                        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                                            <span className="text-white text-xs font-semibold">
                                                                {post.userHandle.split('@')[0].charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
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
                                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 pt-4 pb-6 bg-white dark:bg-gray-900 flex-shrink-0 safe-area-inset-bottom">
                                        <form onSubmit={handleAddComment} className="flex items-center gap-3 sm:gap-4">
                                            <Avatar
                                                src={user?.avatarUrl}
                                                name={user?.name || user?.handle || 'User'}
                                                size="sm"
                                                className="border border-gray-200 dark:border-gray-700 flex-shrink-0"
                                            />
                                            <div className="relative flex-1 rounded min-w-0">
                                                <div className="pointer-events-none absolute inset-0 rounded bg-gray-100 dark:bg-gray-800"></div>
                                                <input
                                                    type="text"
                                                    value={commentText}
                                                    onChange={(e) => setCommentText(e.target.value)}
                                                    placeholder="Add a comment..."
                                                    className="relative w-full px-3 sm:px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:bg-white dark:focus:bg-gray-700"
                                                    disabled={isAddingComment || !user}
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={!commentText.trim() || isAddingComment || !user}
                                                className="px-4 sm:px-5 h-9 sm:h-10 flex items-center justify-center text-black dark:text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity border-2 border-black dark:border-white rounded-full flex-shrink-0"
                                            >
                                                {isAddingComment ? '...' : 'Post'}
                                            </button>
                                            <button
                                                type="button"
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
                                                            await Swal.fire({
                                                                title: 'Follow Request Pending',
                                                                html: `
                                                                    <div style="text-align: center; padding: 10px 0;">
                                                                        <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0 0 20px 0;">
                                                                            This user has a private profile. You have already sent a follow request. Once they accept, you'll be able to send them a message.
                                                                        </p>
                                                                    </div>
                                                                `,
                                                                icon: 'info',
                                                                background: '#262626',
                                                                color: '#ffffff',
                                                                confirmButtonText: 'OK',
                                                                confirmButtonColor: '#8B5CF6'
                                                            });
                                                            return;
                                                        }
                                                        
                                                        const result = await Swal.fire({
                                                            title: 'Cannot Send Message',
                                                            html: `
                                                                <div style="text-align: center; padding: 10px 0;">
                                                                    <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0 0 20px 0;">
                                                                        This user has a private profile. You must follow them and have your follow request accepted before you can send them a message.
                                                                    </p>
                                                                </div>
                                                            `,
                                                            icon: 'warning',
                                                            background: '#262626',
                                                            color: '#ffffff',
                                                            showCancelButton: true,
                                                            confirmButtonText: 'Request to Follow',
                                                            confirmButtonColor: '#8B5CF6',
                                                            cancelButtonText: 'Cancel',
                                                            cancelButtonColor: '#6B7280'
                                                        });
                                                        
                                                        if (result.isConfirmed) {
                                                            createFollowRequest(user.handle, post.userHandle);
                                                            if (user?.id) setFollowState(user.id, post.userHandle, false);
                                                            Swal.fire({
                                                                title: 'Follow Request Sent',
                                                                text: 'You will be notified when they accept your request.',
                                                                icon: 'success',
                                                                timer: 2000,
                                                                showConfirmButton: false,
                                                                background: '#262626',
                                                                color: '#ffffff'
                                                            });
                                                        }
                                                        return;
                                                    }
                                                    
                                                    // If they can message, navigate to DM page
                                                    window.scrollTo(0, 0);
                                                    navigate(`/messages/${encodeURIComponent(post.userHandle)}`);
                                                    onClose();
                                                }}
                                                disabled={!user || post.userHandle === user?.handle}
                                                className="ml-3 sm:ml-4 p-2 h-9 sm:h-10 flex items-center justify-center text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity flex-shrink-0"
                                                aria-label="Send direct message"
                                            >
                                                <FiSend className="w-5 h-5 sm:w-6 sm:h-6" />
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
                    onBoost={() => {
                        console.log('Boost post from Scenes:', post.id);
                    }}
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



