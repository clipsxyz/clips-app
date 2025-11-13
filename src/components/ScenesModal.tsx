import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiHeart, FiShare2, FiRepeat, FiMapPin } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import Avatar from './Avatar';
import ShareModal from './ShareModal';
import StickerOverlayComponent from './StickerOverlay';
import EffectWrapper from './EffectWrapper';
import Flag from './Flag';
import type { EffectConfig } from '../utils/effects';
import { useAuth } from '../context/Auth';
import { useOnline } from '../hooks/useOnline';
import { addComment } from '../api/posts';
import { enqueue } from '../utils/mutationQueue';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import type { Post } from '../types';

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
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const lastTapRef = React.useRef<number>(0);
    const touchHandledRef = React.useRef<boolean>(false);
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
    const { user } = useAuth();
    const online = useOnline();

    // Determine if we have multiple media items (carousel)
    const items = post.mediaItems && post.mediaItems.length > 0
        ? post.mediaItems
        : (post.mediaUrl ? [{ url: post.mediaUrl, type: post.mediaType || 'image' }] : []);
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
            videoRef.current.load();
            setVideoProgress(0);
        }
    }, [currentIndex, currentItem?.type]);

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
        const handleCommentAdded = () => {
            setComments(prev => prev + 1);
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
    }, [post.id]);

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
    const handleMediaTap = React.useCallback(async () => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < 300) {
            // Double tap detected - trigger like
            setHeartBurst(true);
            // Always hide the heart burst animation after 1 second
            setTimeout(() => setHeartBurst(false), 1000);

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
        } else {
            // Single tap - toggle play/pause for videos
            if (currentItem?.type === 'video' && videoRef.current) {
                if (videoRef.current.paused) {
                    videoRef.current.play();
                } else {
                    videoRef.current.pause();
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
        handleMediaTap();
    }, [handleMediaTap]);

    const handleMediaTouchEnd = React.useCallback(() => {
        touchHandledRef.current = true;
        handleMediaTap();
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
            }

            // Dispatch event after successful comment
            window.dispatchEvent(new CustomEvent(`commentAdded-${post.id}`, {
                detail: { text }
            }));
            // Open comments modal after successfully adding a comment
            setTimeout(() => {
                onOpenComments();
            }, 100);
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
                    {/* Scenes Logo - Top Left */}
                    <div className="absolute top-6 left-4 z-10 flex items-center gap-2">
                        <div className="p-1 rounded-md border-2 border-white">
                            <svg
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                className="text-white flex-shrink-0"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                {/* Square border */}
                                <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                {/* Play button triangle */}
                                <path d="M9 7 L9 17 L17 12 Z" fill="currentColor" />
                            </svg>
                        </div>
                        <span className="text-white text-xl font-bold tracking-tight">Scenes</span>
                    </div>

                    {/* Close Button - Top Right */}
                    <button
                        onClick={onClose}
                        aria-label="Close scenes"
                        className="absolute top-6 right-4 z-10 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
                    >
                        <FiX size={24} />
                    </button>

                    {/* Main Media Content */}
                    <div
                        ref={mediaContainerRef}
                        className="w-full h-full flex items-center justify-center relative select-none cursor-pointer"
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
                                        muted
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
                                                background: 'linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6, #ec4899, #f59e0b)',
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
                                        className="absolute left-4 top-1/3 transform -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors z-30"
                                        aria-label="Previous image"
                                    >
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                        className="absolute right-4 top-1/3 transform -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors z-30"
                                        aria-label="Next image"
                                    >
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                                {/* Image Counter */}
                                <div className="absolute top-20 right-4 px-3 py-1.5 bg-black/50 text-white text-sm rounded-full z-30">
                                    {currentIndex + 1} / {items.length}
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

                        {/* Enhanced heart burst animation - only shows during burst */}
                        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-20 ${heartBurst ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="relative">
                                {/* Main heart */}
                                <svg className="w-24 h-24 drop-shadow-lg animate-pulse transition-opacity duration-300" viewBox="0 0 24 24" fill="#ef4444">
                                    <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
                                </svg>

                                {/* Pulse rings */}
                                <div className={`absolute inset-0 border-2 border-red-400 rounded-full transition-all duration-1000 ${heartBurst ? 'opacity-0 scale-150' : 'opacity-100 scale-100'}`}></div>
                                <div className={`absolute inset-0 border border-red-300 rounded-full transition-all duration-1200 delay-100 ${heartBurst ? 'opacity-0 scale-200' : 'opacity-100 scale-100'}`}></div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side Engagement Bar - Instagram Reels Style */}
                    <div className="absolute right-4 bottom-32 z-20 flex flex-col items-center gap-6" onClick={(e) => e.stopPropagation()}>
                        {/* Like Button */}
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={handleLike}
                                className={`p-3 rounded-full transition-all duration-200 ${liked
                                    ? 'bg-white/20'
                                    : 'bg-black/30 hover:bg-black/50'
                                    }`}
                                aria-label={liked ? 'Unlike' : 'Like'}
                            >
                                {liked ? (
                                    <AiFillHeart className="text-red-500 w-6 h-6" />
                                ) : (
                                    <FiHeart className="text-white w-6 h-6" />
                                )}
                            </button>
                            <span className="text-white text-xs font-semibold">{likes}</span>
                        </div>

                        {/* Share Button */}
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={handleShare}
                                className="p-3 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                                aria-label="Share"
                            >
                                <FiShare2 className="text-white w-6 h-6" />
                            </button>
                            <span className="text-white text-xs font-semibold">{shares}</span>
                        </div>

                        {/* Reclip Button */}
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={(e) => handleReclip(e)}
                                disabled={post.userHandle === user?.handle || userReclipped || busy}
                                className={`p-3 rounded-full transition-colors relative z-10 ${post.userHandle === user?.handle || busy ? 'opacity-30 cursor-not-allowed' : userReclipped ? 'bg-green-500/20 hover:bg-green-500/30' : 'bg-black/30 hover:bg-black/50'}`}
                                aria-label={post.userHandle === user?.handle ? "Cannot reclip your own post" : userReclipped ? "Post already reclipped" : "Reclip"}
                                title={post.userHandle === user?.handle ? "Cannot reclip your own post" : userReclipped ? "Post already reclipped" : "Reclip"}
                            >
                                <FiRepeat className={`w-6 h-6 ${userReclipped ? 'text-green-500' : 'text-white'}`} />
                            </button>
                            <span className="text-white text-xs font-semibold">{reclips}</span>
                        </div>
                    </div>

                    {/* Bottom Section with Profile, Caption, and Comment Input - Instagram Reels Style */}
                    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                        <div className="max-w-md mx-auto px-4 pr-16 pb-safe">
                            {/* Profile & Caption Section */}
                            <div className="pt-12 pb-4">
                                {/* Profile Section */}
                                <div className="flex items-center gap-3 mb-3">
                                    <Avatar
                                        name={post.userHandle.split('@')[0]}
                                        size="sm"
                                        className="border-2 border-white"
                                    />
                                    <div className="flex-1">
                                        <button className="text-white font-semibold text-sm hover:opacity-80">
                                            {post.userHandle}
                                        </button>
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
                                    <div className="text-white text-sm mb-2 line-clamp-2">
                                        {post.caption}
                                    </div>
                                )}

                                {/* Text Content (for text-only posts without media) - Only show if NOT displaying as post card screenshot */}
                                {/* Don't show text in bottom if it's a text-only post (will be shown in post card screenshot above) */}
                                {!post.mediaUrl && !post.mediaItems?.length && post.text ? (
                                    // Text-only post - text is shown in post card screenshot, so don't show here
                                    null
                                ) : !post.mediaUrl && post.text ? (
                                    // Other text-only cases (if any) - show text
                                    <div className="text-white text-sm opacity-90 whitespace-pre-line mb-2">
                                        {post.text}
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
                                    <div className="relative flex-1 rounded-full">
                                        {/* Outer glow like Discover page */}
                                        {!commentText && (
                                            <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-60 blur-sm animate-pulse"></div>
                                        )}
                                        {/* Shimmer sweep */}
                                        {!commentText && (
                                            <div className="pointer-events-none absolute inset-0 rounded-full overflow-hidden">
                                                <div
                                                    className="absolute inset-0 rounded-full"
                                                    style={{
                                                        background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
                                                        backgroundSize: '200% 100%',
                                                        animation: 'shimmer 3s linear infinite'
                                                    }}
                                                ></div>
                                            </div>
                                        )}
                                        <input
                                            type="text"
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Add a comment..."
                                            className="relative w-full px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/15"
                                            disabled={isAddingComment || !user}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!commentText.trim() || isAddingComment || !user}
                                        className="px-4 py-2.5 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity border-2 border-white rounded-full"
                                    >
                                        {isAddingComment ? 'Posting...' : 'Post'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
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
        </>
    );
}


