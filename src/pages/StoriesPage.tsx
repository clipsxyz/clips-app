import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiChevronRight, FiChevronLeft, FiMessageCircle, FiHeart, FiVolume2, FiVolumeX, FiMaximize2, FiMapPin } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchStoryGroups, fetchUserStories, markStoryViewed, incrementStoryViews, addStoryReaction, addStoryReply, fetchFollowedUsersStoryGroups, fetchStoryGroupByHandle } from '../api/stories';
import { appendMessage } from '../api/messages';
import Swal from 'sweetalert2';
import { isProfilePrivate, canSendMessage } from '../api/privacy';
import { getFollowedUsers, getPostById } from '../api/posts';
import { showToast } from '../utils/toast';
import ScenesModal from '../components/ScenesModal';
import { getFlagForHandle, getAvatarForHandle } from '../api/users';
import Flag from '../components/Flag';
import { timeAgo } from '../utils/timeAgo';
import type { Story, StoryGroup, Post } from '../types';

export default function StoriesPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const openUserHandle = location.state?.openUserHandle;
    const [storyGroups, setStoryGroups] = React.useState<StoryGroup[]>([]);
    const [currentGroupIndex, setCurrentGroupIndex] = React.useState(0);
    const [currentStoryIndex, setCurrentStoryIndex] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [viewingStories, setViewingStories] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [paused, setPaused] = React.useState(false);
    const [isMuted, setIsMuted] = React.useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const [showReplyModal, setShowReplyModal] = React.useState(false);
    const [replyText, setReplyText] = React.useState('');
    const [showControls, setShowControls] = React.useState(true);
    const [showScenesModal, setShowScenesModal] = React.useState(false);
    const [fullPost, setFullPost] = React.useState<Post | null>(null);
    const [originalPost, setOriginalPost] = React.useState<Post | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const elapsedTimeRef = React.useRef<number>(0);
    const pausedRef = React.useRef<boolean>(false);

    // Keep ref in sync with state
    React.useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    // Load stories function  
    const loadStories = React.useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        try {
            // Get followed users
            const followedUserHandles = await getFollowedUsers(user.id);

            // Fetch only followed users' stories (including current user's stories)
            let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);

            // If opening a specific user's stories from profile click, add their stories even if not followed
            if (openUserHandle) {
                const storyGroup = await fetchStoryGroupByHandle(openUserHandle);
                if (storyGroup) {
                    // Check if this user is already in the groups
                    const existingGroupIndex = groups.findIndex(g => g.userHandle === openUserHandle);

                    if (existingGroupIndex === -1) {
                        // Add the user's story group
                        groups.push(storyGroup);
                    }
                }
            }

            // Add current user's avatar to their story groups
            const groupsWithAvatars = groups.map(group => {
                if (group.userId === user.id && user.avatarUrl) {
                    return { ...group, avatarUrl: user.avatarUrl };
                }
                return group;
            });

            setStoryGroups(groupsWithAvatars);
        } catch (error) {
            console.error('Error loading stories:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.avatarUrl, openUserHandle]);

    // Load story groups when user is available
    React.useEffect(() => {
        loadStories();
    }, [loadStories]);

    // Auto-open specific user's stories if requested
    React.useEffect(() => {
        if (openUserHandle && storyGroups.length > 0) {
            const targetGroup = storyGroups.find(g => g.userHandle === openUserHandle);
            if (targetGroup) {
                startViewingStories(targetGroup);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openUserHandle, storyGroups.length]);

    // Handle starting to view stories for a specific user
    async function startViewingStories(group: StoryGroup) {
        if (!group || !user?.id || !group.stories || group.stories.length === 0) return;

        const stories = await fetchUserStories(user.id, group.userId);
        if (!stories || stories.length === 0) return;

        // Find the group index in the original array
        const groupIndex = storyGroups.findIndex(g => g.userId === group.userId);
        if (groupIndex === -1) return;

        // Update the current group with the fetched stories and avatar
        setStoryGroups(prev => {
            const updated = [...prev];
            updated[groupIndex] = { ...group, stories, avatarUrl: group.avatarUrl };
            return updated;
        });

        setCurrentGroupIndex(groupIndex);
        setCurrentStoryIndex(0);
        setViewingStories(true);
        setProgress(0);
        setPaused(false);
        setIsMuted(true);
        elapsedTimeRef.current = 0;
    }

    // Close story viewer
    function closeStories() {
        setViewingStories(false);
        setProgress(0);
        setPaused(false);
        setIsMuted(true);
        elapsedTimeRef.current = 0;

        // If we came from feed (via avatar click), navigate back
        if (openUserHandle) {
            // Dispatch event to refresh story indicators
            window.dispatchEvent(new CustomEvent('storiesViewed', {
                detail: { userHandle: openUserHandle }
            }));
            navigate(-1);
        }
    }

    // Navigate to next story
    function nextStory() {
        const currentGroup = storyGroups[currentGroupIndex];
        if (!currentGroup) return;

        if (currentStoryIndex < currentGroup.stories.length - 1) {
            setCurrentStoryIndex(currentStoryIndex + 1);
            setProgress(0);
            setIsMuted(true);
            elapsedTimeRef.current = 0;
        } else {
            // Move to next user's stories
            if (currentGroupIndex < storyGroups.length - 1) {
                setCurrentGroupIndex(currentGroupIndex + 1);
                setCurrentStoryIndex(0);
                setProgress(0);
                setIsMuted(true);
                elapsedTimeRef.current = 0;
            } else {
                closeStories();
            }
        }
    }

    // Navigate to previous story
    function previousStory() {
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(currentStoryIndex - 1);
            setProgress(0);
            setIsMuted(true);
            elapsedTimeRef.current = 0;
        } else {
            // Move to previous user's stories
            if (currentGroupIndex > 0) {
                setCurrentGroupIndex(currentGroupIndex - 1);
                const prevGroup = storyGroups[currentGroupIndex - 1];
                setCurrentStoryIndex(prevGroup?.stories.length - 1 || 0);
                setProgress(0);
                setIsMuted(true);
                elapsedTimeRef.current = 0;
            }
        }
    }

    // Handle reaction
    async function handleReaction(emoji: string) {
        if (!currentStory || !user?.id || !user?.handle) return;
        try {
            await addStoryReaction(currentStory.id, user.id, user.handle, emoji);
            setShowEmojiPicker(false);
            // Refresh story data
            const groups = await fetchStoryGroups(user.id);
            setStoryGroups(groups);
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    }

    // Handle reply
    async function handleReply() {
        if (!currentStory || !user?.id || !user?.handle || !replyText.trim()) return;
        try {
            await addStoryReply(currentStory.id, user.id, user.handle, replyText);
            // Also append to chat between replier and story owner
            const toHandle = currentGroup?.userHandle;
            if (toHandle) {
                await appendMessage(user.handle, toHandle, { text: replyText, imageUrl: currentStory.mediaUrl });
                // Optional: system echo for owner (kept same conversation id)
                await appendMessage(toHandle, user.handle, { text: `You replied to their story`, isSystemMessage: true });
                showToast?.('Reply sent');
            }
            setReplyText('');
            setShowReplyModal(false);
        } catch (error) {
            console.error('Error adding reply:', error);
        }
    }

    // Fetch original post if this is a shared text-only post
    React.useEffect(() => {
        const currentGroup = storyGroups[currentGroupIndex];
        if (!currentGroup || !currentGroup.stories) return;
        const currentStory = currentGroup.stories[currentStoryIndex];

        // Check if this is a shared post - if it has sharedFromPost, fetch the original
        if (currentStory?.sharedFromPost) {
            console.log('Fetching original post for shared story:', currentStory.sharedFromPost);
            // Fetch the original post to display it
            getPostById(currentStory.sharedFromPost)
                .then((post) => {
                    if (post) {
                        console.log('Original post fetched:', {
                            id: post.id,
                            hasText: !!post.text,
                            hasMediaUrl: !!post.mediaUrl,
                            mediaUrl: post.mediaUrl,
                            hasMediaItems: !!(post.mediaItems && post.mediaItems.length > 0)
                        });
                        // Set the post regardless of media - we'll handle display in the render
                        setOriginalPost(post);
                    } else {
                        console.warn('Original post not found:', currentStory.sharedFromPost);
                        setOriginalPost(null);
                    }
                })
                .catch((error) => {
                    console.error('Failed to fetch original post:', error);
                    setOriginalPost(null);
                });
        } else {
            setOriginalPost(null);
        }
    }, [currentGroupIndex, currentStoryIndex, storyGroups]);

    // Track story view progress
    React.useEffect(() => {
        if (!viewingStories || !user?.id || showScenesModal) return; // Don't run progress when ScenesModal is open

        const currentGroup = storyGroups[currentGroupIndex];
        if (!currentGroup || !currentGroup.stories) return;

        const currentStory = currentGroup.stories[currentStoryIndex];
        if (!currentStory) return;

        // Reset elapsed time when starting a new story
        elapsedTimeRef.current = 0;
        setProgress(0);

        // Mark story as viewed
        markStoryViewed(currentStory.id, user.id).catch(console.error);
        incrementStoryViews(currentStory.id).catch(console.error);

        // Progress bar animation (15 seconds per story)
        const duration = 15000;
        const interval = 50;

        const timer = setInterval(() => {
            if (pausedRef.current || showScenesModal) return; // Don't update progress when paused or ScenesModal is open

            elapsedTimeRef.current += interval;
            const newProgress = Math.min((elapsedTimeRef.current / duration) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                clearInterval(timer);
                elapsedTimeRef.current = 0; // Reset for next story
                setTimeout(() => {
                    nextStory();
                }, 300);
            }
        }, interval);

        return () => clearInterval(timer);
    }, [viewingStories, currentGroupIndex, currentStoryIndex, storyGroups, user?.id, showScenesModal]);

    // Auto-hide controls on inactivity
    React.useEffect(() => {
        if (!viewingStories) return;

        let hideTimer: number | undefined;

        const resetTimer = () => {
            setShowControls(true);
            if (hideTimer) window.clearTimeout(hideTimer);
            hideTimer = window.setTimeout(() => setShowControls(false), 2000);
        };

        // Show immediately when entering
        resetTimer();

        const onInteract = () => resetTimer();
        window.addEventListener('mousemove', onInteract);
        window.addEventListener('touchstart', onInteract, { passive: true } as any);
        window.addEventListener('keydown', onInteract);

        return () => {
            if (hideTimer) window.clearTimeout(hideTimer);
            window.removeEventListener('mousemove', onInteract);
            window.removeEventListener('touchstart', onInteract as any);
            window.removeEventListener('keydown', onInteract);
        };
    }, [viewingStories]);

    // Keyboard navigation
    React.useEffect(() => {
        if (!viewingStories) return;

        function handleKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable) {
                return; // Don't hijack keys while typing
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                previousStory();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextStory();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeStories();
            } else if (e.key === ' ') {
                e.preventDefault();
                setPaused(v => !v);
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewingStories, currentGroupIndex, currentStoryIndex, storyGroups]);

    // Control video playback based on paused state
    React.useEffect(() => {
        if (!viewingStories || !videoRef.current) return;

        try {
            const currentGroup = storyGroups[currentGroupIndex];
            const currentStory = currentGroup?.stories?.[currentStoryIndex];

            if (currentStory?.mediaType === 'video') {
                if (paused) {
                    videoRef.current.pause().catch(() => { });
                } else {
                    videoRef.current.play().catch(() => { });
                }
            }
        } catch (error) {
            console.error('Error controlling video:', error);
        }
    }, [paused, viewingStories, currentGroupIndex, currentStoryIndex, storyGroups]);

    // Sort story groups by latest story (most recent first) - MUST be before conditional returns
    const sortedGroups = React.useMemo(() => {
        return [...storyGroups].filter(group => group.stories && group.stories.length > 0).sort((a, b) => {
            const aLatest = a.stories.length > 0 ? Math.max(...a.stories.map(s => s.createdAt)) : 0;
            const bLatest = b.stories.length > 0 ? Math.max(...b.stories.map(s => s.createdAt)) : 0;
            return bLatest - aLatest;
        });
    }, [storyGroups]);

    // Helper function to get time ago text
    const getTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return 'Active now';
        if (seconds < 3600) return `Active ${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `Active ${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `Active ${Math.floor(seconds / 86400)}d ago`;
        return `Active ${Math.floor(seconds / 604800)}w ago`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading clips...</p>
                </div>
            </div>
        );
    }

    // Guard: don't render if no user
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">Please sign in to view stories.</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="mt-4 px-4 py-2 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    const currentGroup = storyGroups[currentGroupIndex];
    const currentStory = currentGroup?.stories?.[currentStoryIndex];
    const hasStories = storyGroups.length > 0;

    // Story viewing UI
    if (viewingStories && currentStory && currentGroup && currentGroup.stories) {
        return (
            <>
                <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-black to-gray-950 z-50">
                    {/* Progress bars for each story */}
                    <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-3 pb-2">
                        <div className="flex gap-1.5">
                            {currentGroup.stories.map((story, idx) => (
                                <div key={story.id} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                                    <div
                                        className="h-full rounded-full transition-all ease-linear"
                                        style={
                                            idx < currentStoryIndex
                                                ? {
                                                    width: '100%',
                                                    background: 'linear-gradient(to right, rgb(255, 140, 0) 5%, rgb(248, 0, 50) 25%, rgb(255, 0, 160) 45%, rgb(140, 40, 255) 65%, rgb(0, 35, 255) 82%, rgb(25, 160, 255) 96%)',
                                                    transitionDuration: '100ms'
                                                }
                                                : idx === currentStoryIndex && !paused && progress > 0
                                                    ? {
                                                        width: `${progress}%`,
                                                        background: 'linear-gradient(to right, rgb(255, 140, 0) 5%, rgb(248, 0, 50) 25%, rgb(255, 0, 160) 45%, rgb(140, 40, 255) 65%, rgb(0, 35, 255) 82%, rgb(25, 160, 255) 96%)',
                                                        transitionDuration: '50ms'
                                                    }
                                                    : {
                                                        width: idx === currentStoryIndex ? `${progress}%` : '0%',
                                                        background: idx === currentStoryIndex ? 'rgba(255,255,255,0.6)' : 'transparent',
                                                        transitionDuration: '100ms'
                                                    }
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Story Media - Full screen with elegant container */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-full h-full max-w-[420px] max-h-[90vh] aspect-[9/16] flex items-center justify-center">
                            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-black">
                                {(() => {
                                    // Debug logging
                                    if (currentStory?.sharedFromPost) {
                                        console.log('Rendering shared post story:', {
                                            sharedFromPost: currentStory.sharedFromPost,
                                            hasOriginalPost: !!originalPost,
                                            storyHasMediaUrl: !!currentStory.mediaUrl,
                                            storyHasText: !!currentStory.text,
                                            originalPostText: originalPost?.text,
                                            originalPostMediaUrl: originalPost?.mediaUrl,
                                            originalPostHasMediaItems: !!(originalPost?.mediaItems && originalPost.mediaItems.length > 0)
                                        });
                                    }
                                    
                                    if (currentStory?.sharedFromPost && !originalPost) {
                                        // Loading state while fetching original post
                                        return (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                                            </div>
                                        );
                                    }
                                    
                                    if (currentStory?.sharedFromPost && originalPost) {
                                        // This is a shared post - ALWAYS show the original post format, not the generated image
                                        // Check if it has media or is text-only
                                        const hasRealMedia = (originalPost.mediaUrl && originalPost.mediaUrl.trim() !== '' && !originalPost.mediaUrl.startsWith('data:image')) || (originalPost.mediaItems && originalPost.mediaItems.length > 0);
                                        
                                        if (hasRealMedia) {
                                            // Shared post with media - show the media
                                            return originalPost.mediaType === 'video' || originalPost.mediaItems?.[0]?.type === 'video' ? (
                                                <video
                                                    ref={videoRef}
                                                    src={originalPost.mediaUrl || originalPost.mediaItems?.[0]?.url}
                                                    className="w-full h-full object-cover"
                                                    autoPlay
                                                    loop
                                                    muted={isMuted}
                                                    playsInline
                                                />
                                            ) : (
                                                <img
                                                    src={originalPost.mediaUrl || originalPost.mediaItems?.[0]?.url}
                                                    alt="Shared post"
                                                    className="w-full h-full object-cover"
                                                />
                                            );
                                        } else if (originalPost.text) {
                                            // Display shared text-only post as screenshot of original post card (Twitter style)
                                            // This handles text-only posts (tweets) - ignore any generated mediaUrl from ShareModal
                                            return (
                                                <div
                                                    className="w-full h-full flex items-center justify-center p-4"
                                                    style={{
                                                        background: '#000000' // Black background
                                                    }}
                                                >
                                                    <div 
                                                        className="w-full max-w-md rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-2xl" 
                                                        style={{ 
                                                            maxWidth: '100%', 
                                                            boxSizing: 'border-box',
                                                            backgroundColor: '#ffffff' // Force white background
                                                        }}
                                                    >
                                                        {/* Post Header */}
                                                        <div 
                                                            className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-200" 
                                                            style={{ backgroundColor: '#ffffff' }}
                                                        >
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <Avatar
                                                                    src={getAvatarForHandle(originalPost.userHandle)}
                                                                    name={originalPost.userHandle.split('@')[0]}
                                                                    size="sm"
                                                                />
                                                                <div className="flex-1">
                                                                    <h3 className="font-semibold flex items-center gap-1.5 text-gray-900 text-sm">
                                                                        <span>{originalPost.userHandle}</span>
                                                                        <Flag
                                                                            value={getFlagForHandle(originalPost.userHandle) || ''}
                                                                            size={14}
                                                                        />
                                                                    </h3>
                                                                    <div className="text-xs text-gray-600 flex items-center gap-2 mt-0.5">
                                                                        {originalPost.locationLabel && (
                                                                            <>
                                                                                <span className="flex items-center gap-1">
                                                                                    <FiMapPin className="w-3 h-3" />
                                                                                    {originalPost.locationLabel}
                                                                                </span>
                                                                                {originalPost.createdAt && <span className="text-gray-400">·</span>}
                                                                            </>
                                                                        )}
                                                                        {originalPost.createdAt && (
                                                                            <span>{timeAgo(originalPost.createdAt)}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Text Content - styled like feed (Twitter card style) */}
                                                        <div 
                                                            className="p-4 w-full overflow-hidden" 
                                                            style={{ 
                                                                maxWidth: '100%', 
                                                                boxSizing: 'border-box', 
                                                                backgroundColor: '#ffffff' 
                                                            }}
                                                        >
                                                            <div 
                                                                className="p-4 rounded-lg bg-black overflow-hidden w-full" 
                                                                style={{ 
                                                                    maxWidth: '100%', 
                                                                    boxSizing: 'border-box', 
                                                                    backgroundColor: '#000000' 
                                                                }}
                                                            >
                                                                <div 
                                                                    className="text-base leading-relaxed whitespace-pre-wrap font-normal text-white break-words w-full" 
                                                                    style={{ 
                                                                        wordBreak: 'break-word', 
                                                                        overflowWrap: 'anywhere', 
                                                                        maxWidth: '100%', 
                                                                        boxSizing: 'border-box', 
                                                                        color: '#ffffff' 
                                                                    }}
                                                                >
                                                                    {originalPost.text || 'Shared post'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            // Fallback for shared post that doesn't match media or text-only
                                            return (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <p className="text-white">Shared post</p>
                                                </div>
                                            );
                                        }
                                    }
                                    
                                    // Not a shared post - show regular story content
                                    if (currentStory?.mediaUrl) {
                                        return currentStory.mediaType === 'video' ? (
                                            <video
                                                ref={videoRef}
                                                src={currentStory.mediaUrl}
                                                className="w-full h-full object-cover"
                                                autoPlay
                                                loop
                                                muted={isMuted}
                                                playsInline
                                            />
                                        ) : (
                                            <img
                                                src={currentStory.mediaUrl}
                                                alt=""
                                                className="w-full h-full object-cover select-none"
                                                draggable={false}
                                            />
                                        );
                                    }
                                    
                                    // Text-only story display (directly created, not shared) - keep original style with gradient/textStyle
                                    return (
                                        <div
                                            className="w-full h-full flex items-center justify-center p-4"
                                            style={{
                                                background: currentStory?.textStyle?.background || '#1a1a1a'
                                            }}
                                        >
                                            <div className="w-full max-w-md">
                                                <div
                                                    className="text-base leading-relaxed whitespace-pre-wrap font-normal px-6 py-8"
                                                    style={{
                                                        color: currentStory?.textStyle?.color || '#ffffff'
                                                    }}
                                                >
                                                    {currentStory?.text}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Sticker Overlays for all stories */}
                                {currentStory?.stickers && currentStory.stickers.length > 0 && (
                                    <>
                                        {currentStory.stickers.map((overlay) => (
                                            <div
                                                key={overlay.id}
                                                className="absolute"
                                                style={{
                                                    left: `${overlay.x}%`,
                                                    top: `${overlay.y}%`,
                                                    transform: `translate(-50%, -50%) scale(${overlay.scale}) rotate(${overlay.rotation}deg)`,
                                                    opacity: overlay.opacity,
                                                    zIndex: 20
                                                }}
                                            >
                                                {overlay.sticker.emoji ? (
                                                    <span className="text-4xl" style={{ fontSize: `${50 * overlay.scale}px` }}>
                                                        {overlay.sticker.emoji}
                                                    </span>
                                                ) : overlay.sticker.url ? (
                                                    <img
                                                        src={overlay.sticker.url}
                                                        alt=""
                                                        className="max-w-[100px] max-h-[100px]"
                                                        style={{ pointerEvents: 'none' }}
                                                    />
                                                ) : null}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Subtle gradient overlay for text readability - only show for media stories */}
                    {currentStory?.mediaUrl && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />
                        </div>
                    )}

                    {/* Header with user info - Refined with backdrop blur */}
                    <div className="absolute top-12 left-0 right-0 px-4 z-50">
                        <div className="flex items-center justify-between backdrop-blur-md bg-black/30 rounded-2xl px-4 py-3 border border-white/10 shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Avatar
                                        src={currentGroup?.avatarUrl}
                                        name={currentGroup?.name || 'User'}
                                        size="sm"
                                    />
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-sm">{currentGroup?.userHandle}</p>
                                    {currentStory?.sharedFromUser && (
                                        <p className="text-white/80 text-xs flex items-center gap-1">
                                            <span>shared from</span>
                                            <span className="font-semibold">{currentStory.sharedFromUser}</span>
                                        </p>
                                    )}
                                    {!currentStory?.sharedFromUser && currentStory?.location && (
                                        <p className="text-white/70 text-xs">{currentStory.location}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Full Scenes Button - Always visible in header */}
                                {currentStory && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            // If story was shared from a post, fetch the full post
                                            if (currentStory.sharedFromPost) {
                                                try {
                                                    const post = await getPostById(currentStory.sharedFromPost);
                                                    if (post) {
                                                        setFullPost(post);
                                                        setShowScenesModal(true);
                                                        return;
                                                    }
                                                } catch (error) {
                                                    console.error('Error fetching post:', error);
                                                }
                                            }

                                            // Otherwise, convert story to Post-like object for ScenesModal
                                            const storyAsPost: Post = {
                                                id: currentStory.id,
                                                userHandle: currentStory.userHandle,
                                                locationLabel: currentStory.location || '',
                                                tags: [],
                                                mediaUrl: currentStory.mediaUrl,
                                                mediaType: currentStory.mediaType,
                                                text: currentStory.text,
                                                caption: currentStory.text,
                                                textStyle: currentStory.textStyle,
                                                stickers: currentStory.stickers,
                                                taggedUsers: currentStory.taggedUsers,
                                                createdAt: currentStory.createdAt,
                                                stats: {
                                                    likes: 0,
                                                    views: currentStory.views,
                                                    comments: currentStory.replies.length,
                                                    shares: 0,
                                                    reclips: 0
                                                },
                                                isBookmarked: false,
                                                isFollowing: false,
                                                userLiked: !!currentStory.userReaction
                                            };
                                            setFullPost(storyAsPost);
                                            setShowScenesModal(true);
                                        }}
                                        className="pointer-events-auto px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity shadow-lg backdrop-blur-sm"
                                        title="Show Full Scenes"
                                    >
                                        <FiMaximize2 className="w-3.5 h-3.5" />
                                        <span>Scenes</span>
                                    </button>
                                )}
                                {/* Mute/Unmute button - only show for videos */}
                                {currentStory?.mediaType === 'video' && (
                                    <button
                                        onClick={() => setIsMuted(!isMuted)}
                                        className="pointer-events-auto p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-white/20 transition-colors border border-white/10"
                                        title={isMuted ? 'Unmute' : 'Mute'}
                                    >
                                        {isMuted ? (
                                            <FiVolumeX className="w-5 h-5 text-white" />
                                        ) : (
                                            <FiVolume2 className="w-5 h-5 text-white" />
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={closeStories}
                                    className="pointer-events-auto p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-white/20 transition-colors border border-white/10"
                                >
                                    <FiX className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Story Text - Only show if media is not a generated text image (data URL) */}
                    {currentStory?.text && currentStory?.mediaUrl && !currentStory.mediaUrl.startsWith('data:image') && (
                        <div className="absolute bottom-24 left-0 right-0 px-4 z-[60] pointer-events-none">
                            <div className="backdrop-blur-md bg-black/30 rounded-2xl px-4 py-3 border border-white/10 shadow-lg max-w-md mx-auto pointer-events-auto">
                                <p
                                    className={`font-semibold text-center ${currentStory?.textSize === 'small' ? 'text-sm' :
                                        currentStory?.textSize === 'large' ? 'text-2xl' :
                                            'text-lg'
                                        }`}
                                    style={{
                                        color: currentStory?.textColor || 'white',
                                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                                    }}
                                >
                                    {(() => {
                                        // Parse mentions (@handle) and make them clickable
                                        const text = currentStory.text || '';
                                        const parts: (string | JSX.Element)[] = [];
                                        // Match @handle (including @ in handle like @Sarah@Artane)
                                        // Updated regex to match @ followed by word characters, @, and more word characters
                                        const mentionRegex = /@([\w@]+)/g;
                                        let lastIndex = 0;
                                        let match;

                                        while ((match = mentionRegex.exec(text)) !== null) {
                                            // Add text before the mention
                                            if (match.index > lastIndex) {
                                                parts.push(text.substring(lastIndex, match.index));
                                            }
                                            
                                            // Check if this mention is in taggedUsers
                                            const handle = match[1]; // This will be "Sarah@Artane" from "@Sarah@Artane"
                                            const isTagged = currentStory.taggedUsers?.includes(handle);
                                            
                                            // Debug logging
                                            if (process.env.NODE_ENV === 'development') {
                                                console.log('Story mention check:', {
                                                    text,
                                                    handle,
                                                    taggedUsers: currentStory.taggedUsers,
                                                    isTagged
                                                });
                                            }
                                            
                                            if (isTagged) {
                                                // Make it a clickable link
                                                parts.push(
                                                    <span
                                                        key={match.index}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            console.log('Clicked mention:', handle);
                                                            // Close stories first, then navigate
                                                            setViewingStories(false);
                                                            setTimeout(() => {
                                                                navigate(`/user/${encodeURIComponent(handle)}`);
                                                            }, 100);
                                                        }}
                                                        onTouchStart={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                        onTouchEnd={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            console.log('Touched mention:', handle);
                                                            // Close stories first, then navigate
                                                            setViewingStories(false);
                                                            setTimeout(() => {
                                                                navigate(`/user/${encodeURIComponent(handle)}`);
                                                            }, 100);
                                                        }}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                        className="underline hover:opacity-80 active:opacity-60 transition-opacity cursor-pointer font-semibold inline-block"
                                                        style={{
                                                            color: currentStory?.textColor || 'white',
                                                            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                                                            pointerEvents: 'auto',
                                                            zIndex: 1000,
                                                            position: 'relative'
                                                        }}
                                                    >
                                                        @{handle}
                                                    </span>
                                                );
                                            } else {
                                                // Just show as text if not tagged
                                                parts.push(`@${handle}`);
                                            }
                                            
                                            lastIndex = match.index + match[0].length;
                                        }
                                        
                                        // Add remaining text
                                        if (lastIndex < text.length) {
                                            parts.push(text.substring(lastIndex));
                                        }
                                        
                                        return parts.length > 0 ? parts : text;
                                    })()}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons - vertical right side (auto-hide) */}
                    <div className={`absolute right-4 bottom-16 z-[70] flex flex-col items-center gap-3 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        {/* Reaction Button (single like) */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleReaction('❤️');
                            }}
                            className="pointer-events-auto w-14 h-14 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-all active:scale-95 border border-white/20 shadow-xl"
                        >
                            {currentStory?.userReaction ? (
                                <span className="text-2xl">{currentStory.userReaction}</span>
                            ) : (
                                <FiHeart className="w-6 h-6 text-white" />
                            )}
                        </button>

                        {/* Reply Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowReplyModal(true);
                            }}
                            className="pointer-events-auto w-14 h-14 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-all active:scale-95 border border-white/20 shadow-xl"
                        >
                            <FiMessageCircle className="w-6 h-6 text-white" />
                        </button>
                    </div>

                    {/* Tap Zones for Navigation and Pause */}
                    <div className="absolute inset-0 z-40 pointer-events-none">
                        {/* Center tap zone - Pause/Resume - but exclude bottom area where text is */}
                        <div
                            onClick={() => setPaused(!paused)}
                            className="absolute left-1/3 right-1/3 top-0"
                            style={{ bottom: '200px' }} // Exclude bottom area where story text appears
                        />

                        {/* Left zone - Previous Story */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                previousStory();
                            }}
                            className="absolute left-0 top-0 bottom-0 w-1/4 pointer-events-auto"
                        />

                        {/* Right zone - Next Story */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                nextStory();
                            }}
                            className="absolute right-0 top-0 bottom-0 w-1/4 pointer-events-auto"
                        />
                    </div>
                </div>

                {/* Reply Modal - Inside story viewer */}
                {showReplyModal && currentStory && (
                    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setShowReplyModal(false)}>
                        <div className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Reply to {currentGroup?.userHandle}
                                </h3>
                                <button
                                    onClick={() => setShowReplyModal(false)}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <FiX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </button>
                            </div>
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Type a reply..."
                                className="w-full h-24 p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                autoFocus
                            />
                            <div className="mt-4 flex items-center gap-3">
                                <button
                                    onClick={handleReply}
                                    disabled={!replyText.trim()}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                                >
                                    Send Reply
                                </button>
                                {currentGroup?.userHandle && (
                                    <button
                                        onClick={async () => {
                                            setShowReplyModal(false);
                                            
                                            // Check if user can message (privacy check)
                                            if (user?.id && user?.handle && currentGroup.userHandle) {
                                                const followedUsers = await getFollowedUsers(user.id);
                                                if (!canSendMessage(user.handle, currentGroup.userHandle, followedUsers)) {
                                                    Swal.fire({
                                                        title: 'Cannot Send Message',
                                                        text: 'You must follow this user to send them a message.',
                                                        icon: 'warning'
                                                    });
                                                    return;
                                                }
                                            }
                                            
                                            setViewingStories(false);

                                                // Get the current story to check if it's a shared post
                                                const group = storyGroups[currentGroupIndex];
                                                const story = group?.stories?.[currentStoryIndex];

                                                // If this is a shared post, pass the post URL
                                                let shareState: any = undefined;
                                                if (story?.sharedFromPost) {
                                                    const postUrl = `${window.location.origin}/post/${story.sharedFromPost}`;
                                                    shareState = {
                                                        sharePostUrl: postUrl,
                                                        sharePostId: story.sharedFromPost
                                                    };
                                                }

                                                navigate(`/messages/${encodeURIComponent(currentGroup.userHandle!)}`, {
                                                    state: shareState
                                                });
                                        }}
                                        className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        View in chat
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Scenes Modal for Shared Posts */}
                {showScenesModal && fullPost && (
                    <ScenesModal
                        post={fullPost}
                        isOpen={showScenesModal}
                        onClose={() => {
                            setShowScenesModal(false);
                            setFullPost(null);
                            // Resume story progress when closing ScenesModal
                            // The progress timer will automatically resume since showScenesModal is now false
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
            </>
        );
    }

    // Story list UI
    return (
        <div className="min-h-screen bg-black text-white p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Clips 24</h1>
                <button
                    onClick={() => navigate('/feed')}
                    className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                >
                    <FiX className="w-6 h-6 text-gray-400" />
                </button>
            </div>

            {!hasStories ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
                        <div className="w-12 h-12 rounded-full bg-gray-950 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-white/30 rounded-full flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                        No clips available
                    </h3>
                    <p className="text-gray-400">
                        Share your first clip to get started!
                    </p>
                    <button
                        onClick={() => navigate('/create')}
                        className="mt-4 px-6 py-3 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity"
                    >
                        Create Clip
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3">
                    {sortedGroups.map((group, index) => {
                        if (!group.stories || group.stories.length === 0) return null;

                        const isUnviewed = group.stories.some(s => !s.hasViewed);
                        const latestStory = group.stories.reduce((latest, current) =>
                            current.createdAt > latest.createdAt ? current : latest
                        );
                        
                        // Extract location from userHandle (e.g., "Sarah@Artane" -> "Artane")
                        const locationMatch = group.userHandle.match(/@(.+)/);
                        const location = locationMatch ? locationMatch[1] : '';
                        const displayName = group.userHandle.split('@')[0];
                        const usernameLocation = location ? `${displayName}@${location}` : group.userHandle;
                        
                        // Generate gazetteer-style color based on location
                        const getLocationColor = (loc: string): string => {
                            if (!loc) return 'rgb(140, 40, 255)'; // Default purple
                            
                            // Create a consistent color based on location string
                            let hash = 0;
                            for (let i = 0; i < loc.length; i++) {
                                hash = loc.charCodeAt(i) + ((hash << 5) - hash);
                            }
                            
                            // Generate a vibrant color palette
                            const hue = Math.abs(hash % 360);
                            const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
                            const lightness = 50 + (Math.abs(hash) % 15); // 50-65%
                            
                            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                        };
                        
                        const locationColor = getLocationColor(location || group.userHandle);
                        
                        // Check if this is a shared post - if so, we need to fetch and show the original post format
                        const StoryThumbnail = React.memo(({ story }: { story: Story }) => {
                            const [originalPost, setOriginalPost] = React.useState<Post | null>(null);
                            const [loading, setLoading] = React.useState(false);
                            
                            React.useEffect(() => {
                                if (story.sharedFromPost) {
                                    setLoading(true);
                                    getPostById(story.sharedFromPost)
                                        .then((post) => {
                                            if (post) {
                                                setOriginalPost(post);
                                            }
                                            setLoading(false);
                                        })
                                        .catch(() => {
                                            setLoading(false);
                                        });
                                }
                            }, [story.sharedFromPost]);
                            
                            // If it's a shared post, show the original post format
                            if (story.sharedFromPost && originalPost) {
                                const hasRealMedia = (originalPost.mediaUrl && originalPost.mediaUrl.trim() !== '' && !originalPost.mediaUrl.startsWith('data:image')) || (originalPost.mediaItems && originalPost.mediaItems.length > 0);
                                
                                if (hasRealMedia) {
                                    // Shared post with media
                                    return originalPost.mediaType === 'video' || originalPost.mediaItems?.[0]?.type === 'video' ? (
                                        <video
                                            src={originalPost.mediaUrl || originalPost.mediaItems?.[0]?.url}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                            preload="metadata"
                                        />
                                    ) : (
                                        <img
                                            src={originalPost.mediaUrl || originalPost.mediaItems?.[0]?.url}
                                            alt="Shared post"
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    );
                                } else if (originalPost.text) {
                                    // Shared text-only post - show Twitter card style preview
                                    return (
                                        <div className="w-full h-full flex items-center justify-center p-2 bg-black">
                                            <div className="w-full max-w-full rounded-lg overflow-hidden bg-white border border-gray-200 shadow-lg">
                                                {/* Post Header */}
                                                <div className="px-2 pt-1.5 pb-1 border-b border-gray-200 bg-white">
                                                    <div className="flex items-center gap-1.5">
                                                        <Avatar
                                                            src={getAvatarForHandle(originalPost.userHandle)}
                                                            name={originalPost.userHandle.split('@')[0]}
                                                            size="xs"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-semibold text-[9px] text-gray-900 truncate">{originalPost.userHandle}</span>
                                                                <Flag
                                                                    value={getFlagForHandle(originalPost.userHandle) || ''}
                                                                    size={8}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Text Content - Twitter card style */}
                                                <div className="p-1.5 bg-white">
                                                    <div className="p-1.5 rounded bg-black">
                                                        <div className="text-[8px] leading-tight text-white line-clamp-4 whitespace-pre-wrap break-words">
                                                            {originalPost.text}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            }
                            
                            if (story.sharedFromPost && loading) {
                                return (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                    </div>
                                );
                            }
                            
                            // Not a shared post - show regular story thumbnail
                            const thumbnailUrl = story.mediaUrl;
                            
                            if (thumbnailUrl) {
                                return story.mediaType === 'video' ? (
                                    <video
                                        src={thumbnailUrl}
                                        className="w-full h-full object-cover"
                                        muted
                                        playsInline
                                        preload="metadata"
                                    />
                                ) : (
                                    <img
                                        src={thumbnailUrl}
                                        alt={`${group.userHandle} clip`}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            if (!target.src.includes('via.placeholder')) {
                                                target.src = 'https://via.placeholder.com/400x600/1a1a1a/ffffff?text=' + encodeURIComponent(displayName);
                                            }
                                        }}
                                    />
                                );
                            } else if (story.text) {
                                // Text-only story (directly created, not shared) - show with gradient background
                                return (
                                    <div
                                        className="w-full h-full flex items-center justify-center p-4 rounded-lg"
                                        style={{
                                            background: story.textStyle?.background || '#1a1a1a'
                                        }}
                                    >
                                        <div
                                            className="text-xs leading-relaxed whitespace-pre-wrap font-normal text-center line-clamp-4"
                                            style={{
                                                color: story.textStyle?.color || '#ffffff'
                                            }}
                                        >
                                            {story.text}
                                        </div>
                                    </div>
                                );
                            } else {
                                // Fallback placeholder
                                return (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                        <Avatar
                                            src={group.avatarUrl}
                                            name={group.name}
                                            size="lg"
                                        />
                                    </div>
                                );
                            }
                        });
                        
                        StoryThumbnail.displayName = 'StoryThumbnail';
                        
                        return (
                            <button
                                key={group.userId}
                                onClick={() => startViewingStories(group)}
                                className={`relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-900 group cursor-pointer border focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black ${
                                    isUnviewed 
                                        ? 'border-transparent' 
                                        : 'border-white'
                                }`}
                                style={isUnviewed ? {
                                    background: 'linear-gradient(to right, rgb(255, 140, 0) 5%, rgb(248, 0, 50) 25%, rgb(255, 0, 160) 45%, rgb(140, 40, 255) 65%, rgb(0, 35, 255) 82%, rgb(25, 160, 255) 96%)',
                                    padding: '2px'
                                } : {}}
                            >
                                <div className={`relative w-full h-full rounded-lg overflow-hidden ${isUnviewed ? 'bg-gray-900' : ''}`}>
                                    {/* Improved Thumbnail */}
                                    <div className="absolute inset-0">
                                        <StoryThumbnail story={latestStory} />
                                    </div>
                                    
                                    {/* Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg z-10" />

                                    {/* Centered Profile Picture with Gazetteer Border */}
                                    <div className="absolute inset-0 flex items-center justify-center z-20">
                                        <div 
                                            className="relative w-16 h-16 rounded-full overflow-hidden border-4 shadow-lg"
                                            style={{
                                                borderColor: locationColor,
                                                boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)`
                                            }}
                                        >
                                            {group.avatarUrl ? (
                                                <img
                                                    src={group.avatarUrl}
                                                    alt={group.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div 
                                                    className="w-full h-full flex items-center justify-center"
                                                    style={{ backgroundColor: locationColor + '40' }}
                                                >
                                                    <span className="text-xl text-white font-bold">
                                                        {group.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Username at bottom */}
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/70 to-transparent rounded-b-lg z-20">
                                        <p className="text-white text-[10px] font-medium text-center truncate leading-tight">
                                            {usernameLocation}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

