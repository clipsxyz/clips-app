import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiChevronRight, FiChevronLeft, FiMessageCircle, FiHeart, FiVolume2, FiVolumeX } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchStoryGroups, fetchUserStories, markStoryViewed, incrementStoryViews, addStoryReaction, addStoryReply, fetchFollowedUsersStoryGroups, fetchStoryGroupByHandle } from '../api/stories';
import { getFollowedUsers } from '../api/posts';
import type { Story, StoryGroup } from '../types';

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
            setReplyText('');
            setShowReplyModal(false);
        } catch (error) {
            console.error('Error adding reply:', error);
        }
    }

    // Track story view progress
    React.useEffect(() => {
        if (!viewingStories || !user?.id) return;

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
            if (pausedRef.current) return; // Don't update progress when paused

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
    }, [viewingStories, currentGroupIndex, currentStoryIndex, storyGroups, user?.id]);

    // Keyboard navigation
    React.useEffect(() => {
        if (!viewingStories) return;

        function handleKeyDown(e: KeyboardEvent) {
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
                    <p className="text-gray-600 dark:text-gray-400">Loading stories...</p>
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
                <div className="fixed inset-0 bg-black z-50">
                    {/* Progress bars for each story */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gray-900 z-50 flex gap-1 px-3 py-3">
                        {currentGroup.stories.map((story, idx) => (
                            <div key={story.id} className="flex-1 bg-gray-800 rounded-full overflow-hidden relative h-1">
                                <div
                                    className="h-full transition-all"
                                    style={
                                        idx < currentStoryIndex
                                            ? {
                                                width: '100%',
                                                background: '#ffffff',
                                                transitionDuration: '100ms'
                                            }
                                            : idx === currentStoryIndex && !paused && progress > 0
                                                ? {
                                                    width: `${progress}%`,
                                                    background: 'linear-gradient(to right, #10b981, #3b82f6, #1d4ed8)',
                                                    transitionDuration: '50ms'
                                                }
                                                : {
                                                    width: idx === currentStoryIndex ? `${progress}%` : '0%',
                                                    background: idx === currentStoryIndex ? 'rgba(255,255,255,0.5)' : '#4b5563',
                                                    transitionDuration: '100ms'
                                                }
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    {/* Story Media */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        {currentStory?.mediaType === 'video' ? (
                            <video
                                ref={videoRef}
                                src={currentStory?.mediaUrl}
                                className="w-full h-full object-contain"
                                autoPlay
                                loop
                                muted={isMuted}
                                playsInline
                            />
                        ) : (
                            <img
                                src={currentStory?.mediaUrl}
                                alt=""
                                className="w-full h-full object-contain"
                                draggable={false}
                            />
                        )}
                    </div>

                    {/* Story Overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                        {/* Gradient overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
                    </div>

                    {/* Header with user info */}
                    <div className="absolute top-16 left-0 right-0 px-6 z-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar
                                    src={currentGroup?.avatarUrl}
                                    name={currentGroup?.name || 'User'}
                                    size="sm"
                                />
                                <div>
                                    <p className="text-white font-semibold">{currentGroup?.userHandle}</p>
                                    {currentStory?.location && (
                                        <p className="text-white/70 text-xs">{currentStory.location}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Mute/Unmute button - only show for videos */}
                                {currentStory?.mediaType === 'video' && (
                                    <button
                                        onClick={() => setIsMuted(!isMuted)}
                                        className="pointer-events-auto p-2 rounded-full hover:bg-white/20 transition-colors"
                                        title={isMuted ? 'Unmute' : 'Mute'}
                                    >
                                        {isMuted ? (
                                            <FiVolumeX className="w-6 h-6 text-white" />
                                        ) : (
                                            <FiVolume2 className="w-6 h-6 text-white" />
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={closeStories}
                                    className="pointer-events-auto p-2 rounded-full hover:bg-white/20 transition-colors"
                                >
                                    <FiX className="w-6 h-6 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Story Text */}
                    {currentStory?.text && (
                        <div className="absolute bottom-20 left-0 right-0 px-6 z-50 pointer-events-none">
                            <p
                                className={`font-semibold ${currentStory?.textSize === 'small' ? 'text-sm' :
                                    currentStory?.textSize === 'large' ? 'text-2xl' :
                                        'text-lg'
                                    }`}
                                style={{
                                    color: currentStory?.textColor || 'white',
                                    textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 rgba(0,0,0,0.8), 1px -1px 0 rgba(0,0,0,0.8), -1px 1px 0 rgba(0,0,0,0.8)'
                                }}
                            >
                                {currentStory.text}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="absolute bottom-6 left-0 right-0 px-6 z-[60] pointer-events-none">
                        <div className="flex items-center justify-center gap-6">
                            {/* Reaction Button */}
                            <div className="relative z-[70]">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowEmojiPicker(!showEmojiPicker);
                                    }}
                                    className="pointer-events-auto w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                                >
                                    {currentStory?.userReaction ? (
                                        <span className="text-2xl">{currentStory.userReaction}</span>
                                    ) : (
                                        <FiHeart className="w-6 h-6 text-white" />
                                    )}
                                </button>

                                {/* Emoji Picker */}
                                {showEmojiPicker && (
                                    <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl flex gap-3 z-[80] pointer-events-auto">
                                        {['❤️', '😍', '🔥', '👍', '😎', '😱'].map(emoji => (
                                            <button
                                                key={emoji}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReaction(emoji);
                                                }}
                                                className="text-2xl hover:scale-125 transition-transform"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Reply Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowReplyModal(true);
                                }}
                                className="pointer-events-auto z-[70] w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                            >
                                <FiMessageCircle className="w-6 h-6 text-white" />
                            </button>

                            {/* View Full Post Button - Only for shared stories */}
                            {currentStory?.sharedFromPost && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Close stories view and navigate to feed
                                        setViewingStories(false);
                                        navigate('/feed');
                                    }}
                                    className="pointer-events-auto z-[70] w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center hover:opacity-90 transition-colors shadow-lg"
                                    title="View full post"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tap Zones for Navigation and Pause */}
                    <div className="absolute inset-0 z-40">
                        {/* Center tap zone - Pause/Resume */}
                        <div
                            onClick={() => setPaused(!paused)}
                            className="absolute left-1/3 right-1/3 top-0 bottom-0"
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
                    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setShowReplyModal(false)}>
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
                            <button
                                onClick={handleReply}
                                disabled={!replyText.trim()}
                                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                            >
                                Send Reply
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Story list UI
    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stories</h1>
                <button
                    onClick={() => navigate('/feed')}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <FiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        No stories available
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        Share your first story to get started!
                    </p>
                    <button
                        onClick={() => navigate('/create')}
                        className="mt-4 px-6 py-3 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity"
                    >
                        Create Story
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {sortedGroups.map((group, index) => {
                        if (!group.stories || group.stories.length === 0) return null;

                        const isUnviewed = group.stories.some(s => !s.hasViewed);
                        const latestStory = group.stories.reduce((latest, current) =>
                            current.createdAt > latest.createdAt ? current : latest
                        );
                        const timeAgo = getTimeAgo(latestStory.createdAt);

                        return (
                            <button
                                key={group.userId}
                                onClick={() => startViewingStories(group)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                {/* Profile Picture with Glow Effect */}
                                <div className="relative flex-shrink-0">
                                    {isUnviewed ? (
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 p-0.5 animate-pulse">
                                            <div className="w-full h-full rounded-full bg-gray-950 flex items-center justify-center">
                                                <Avatar
                                                    src={group.avatarUrl}
                                                    name={group.name}
                                                    size="lg"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 rounded-full">
                                            <Avatar
                                                src={group.avatarUrl}
                                                name={group.name}
                                                size="lg"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* User Info */}
                                <div className="flex-1 text-left min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                        {group.userHandle}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        {timeAgo}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

