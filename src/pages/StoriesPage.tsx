import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiChevronRight, FiChevronLeft, FiMessageCircle, FiHeart, FiVolume2, FiVolumeX, FiMaximize2, FiMapPin, FiSend, FiLink, FiCopy } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchStoryGroups, fetchUserStories, markStoryViewed, incrementStoryViews, addStoryReaction, addStoryReply, fetchFollowedUsersStoryGroups, fetchStoryGroupByHandle, voteOnPoll } from '../api/stories';
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
    const currentGroupIndexRef = React.useRef(0);
    const currentStoryIndexRef = React.useRef(0);
    
    // Keep refs in sync with state
    React.useEffect(() => {
        currentGroupIndexRef.current = currentGroupIndex;
    }, [currentGroupIndex]);
    
    React.useEffect(() => {
        currentStoryIndexRef.current = currentStoryIndex;
    }, [currentStoryIndex]);
    const [loading, setLoading] = React.useState(true);
    const [viewingStories, setViewingStories] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [paused, setPaused] = React.useState(false);
    const [isMuted, setIsMuted] = React.useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const [showReplyModal, setShowReplyModal] = React.useState(false);
    const [replyText, setReplyText] = React.useState('');
    const [showStoryShareModal, setShowStoryShareModal] = React.useState(false);
    const [showControls, setShowControls] = React.useState(true);
    const [showScenesModal, setShowScenesModal] = React.useState(false);
    const [fullPost, setFullPost] = React.useState<Post | null>(null);
    const [originalPost, setOriginalPost] = React.useState<Post | null>(null);
    const [optimisticVote, setOptimisticVote] = React.useState<'option1' | 'option2' | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const elapsedTimeRef = React.useRef<number>(0);
    const pausedRef = React.useRef<boolean>(false);
    const isVotingRef = React.useRef<boolean>(false);
    const nextStoryTimeoutRef = React.useRef<number | null>(null);
    const voteStartTimeRef = React.useRef<number | null>(null); // Track when voting started
    const lastStoryIdRef = React.useRef<string | null>(null); // Track last story ID to preserve timer

    // Swipe gesture tracking for story navigation
    const swipeStartXRef = React.useRef<number | null>(null);
    const swipeStartYRef = React.useRef<number | null>(null);
    const swipeStartedOnPollRef = React.useRef<boolean>(false);

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

            // Add avatar URLs to all story groups
            const groupsWithAvatars = await Promise.all(groups.map(async (group) => {
                // If it's the current user, use their avatar from context
                if (group.userId === user.id && user.avatarUrl) {
                    return { ...group, avatarUrl: user.avatarUrl };
                }
                
                // Try to get avatar from getAvatarForHandle first (for mock data)
                let avatarUrl = getAvatarForHandle(group.userHandle);
                
                // If not found in mock data, try fetching from backend API
                if (!avatarUrl) {
                    try {
                        const { fetchUserProfile } = await import('../api/client');
                        const profile = await fetchUserProfile(group.userHandle, user.id);
                        // Check both avatar_url (snake_case from API) and avatarUrl (camelCase)
                        if (profile && (profile.avatar_url || profile.avatarUrl)) {
                            avatarUrl = profile.avatar_url || profile.avatarUrl;
                        }
                    } catch (error) {
                        // If API call fails, fall back to undefined (will show initial letter)
                        console.warn(`Failed to fetch avatar for ${group.userHandle}:`, error);
                    }
                }
                
                // Log for debugging
                if (!avatarUrl) {
                    console.log(`No avatar found for ${group.userHandle}`);
                }
                
                return { ...group, avatarUrl };
            }));

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

    // Handle moving to next user's stories
    function handleNextUserStories(currentGroups: StoryGroup[], currentIdx: number) {
        console.log('handleNextUserStories called. Current group index:', currentIdx, 'Total groups:', currentGroups.length, 'Condition check:', currentIdx < currentGroups.length - 1);
        console.log('All groups:', currentGroups.map((g, idx) => ({ index: idx, userHandle: g.userHandle, storiesCount: g.stories?.length || 0 })));
        
        if (currentIdx < currentGroups.length - 1) {
            const nextGroupIndex = currentIdx + 1;
            const nextGroup = currentGroups[nextGroupIndex];
            
            console.log('Next group found:', {
                index: nextGroupIndex,
                userHandle: nextGroup?.userHandle,
                userId: nextGroup?.userId,
                hasStories: !!(nextGroup?.stories),
                storiesLength: nextGroup?.stories?.length || 0
            });
            
            // Always fetch stories for next user to ensure they're loaded
            if (nextGroup && user?.id && nextGroup.userId) {
                console.log('Fetching stories for next user:', nextGroup.userHandle);
                fetchUserStories(user.id, nextGroup.userId)
                    .then((stories) => {
                        console.log('Fetched stories for next user:', stories?.length || 0);
                        if (stories && stories.length > 0) {
                            // Update the group with fetched stories
                            setStoryGroups(prev => {
                                const updated = [...prev];
                                updated[nextGroupIndex] = { ...nextGroup, stories, avatarUrl: nextGroup.avatarUrl };
                                return updated;
                            });
                            
                            // Navigate to the next user's first story
                            console.log('Navigating to next user stories');
                            setCurrentGroupIndex(nextGroupIndex);
                            currentGroupIndexRef.current = nextGroupIndex;
                            setCurrentStoryIndex(0);
                            currentStoryIndexRef.current = 0;
            setProgress(0);
            setIsMuted(true);
            elapsedTimeRef.current = 0;
                            setPaused(false);
                            pausedRef.current = false;
        } else {
                            console.warn('Next user group has no stories after fetching, trying next group or closing');
                            // Try to find next group with stories, or close
                            const nextGroupWithStories = currentGroups.find((g, idx) => idx > nextGroupIndex && g.stories && g.stories.length > 0);
                            if (nextGroupWithStories) {
                                const foundIndex = currentGroups.findIndex(g => g.userId === nextGroupWithStories.userId);
                                setCurrentGroupIndex(foundIndex);
                                currentGroupIndexRef.current = foundIndex;
                setCurrentStoryIndex(0);
                                currentStoryIndexRef.current = 0;
                setProgress(0);
                setIsMuted(true);
                elapsedTimeRef.current = 0;
                                setPaused(false);
                                pausedRef.current = false;
            } else {
                closeStories();
            }
        }
                    })
                    .catch((error) => {
                        console.error('Error fetching next user stories:', error);
                        closeStories();
                    });
            } else {
                console.warn('Next user group is invalid:', { nextGroup: !!nextGroup, userId: user?.id, nextGroupUserId: nextGroup?.userId });
                closeStories();
            }
        } else {
            // At the end of all stories, close
            console.log('Reached end of all stories. Current index:', currentGroupIndex, 'Total groups:', currentGroups.length);
            closeStories();
        }
    }

    // Navigate to next story
    function nextStory() {
        // Don't advance if user is voting
        if (isVotingRef.current) {
            console.log('nextStory blocked: user is voting');
            return;
        }
        
        // Use refs to get latest values (avoid stale closures)
        const currentIdx = currentGroupIndexRef.current;
        const currentStoryIdx = currentStoryIndexRef.current;
        
        setStoryGroups(currentGroups => {
            const currentGroup = currentGroups[currentIdx];
            if (!currentGroup || !currentGroup.stories || currentGroup.stories.length === 0) {
                console.warn('Cannot navigate: currentGroup or stories is invalid', { currentGroupIndex: currentIdx, storyGroupsLength: currentGroups.length });
                return currentGroups;
            }

            if (currentStoryIdx < currentGroup.stories.length - 1) {
                // Move to next story within same user
                const nextStoryIdx = currentStoryIdx + 1;
                setCurrentStoryIndex(nextStoryIdx);
                currentStoryIndexRef.current = nextStoryIdx;
                setProgress(0);
                setIsMuted(true);
                elapsedTimeRef.current = 0;
                setPaused(false);
                pausedRef.current = false;
                return currentGroups;
            } else {
                // Move to next user's stories - call handler with latest groups and indices
                handleNextUserStories(currentGroups, currentIdx);
                return currentGroups;
            }
        });
    }

    // Swipe gesture handlers (horizontal drag to change story)
    const SWIPE_THRESHOLD_PX = 40; // Minimum horizontal movement

    function handleSwipeStart(e: React.TouchEvent | React.MouseEvent) {
        if (!viewingStories) return;
        // Check if touch started on poll area
        const target = e.target as HTMLElement;
        const isOnPoll = target.closest('[data-poll-container]');
        if (isOnPoll) {
            swipeStartedOnPollRef.current = true;
            return;
        }
        swipeStartedOnPollRef.current = false;
        const point = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
        swipeStartXRef.current = point.clientX;
        swipeStartYRef.current = point.clientY;
    }

    function handleSwipeEnd(e: React.TouchEvent | React.MouseEvent) {
        if (!viewingStories) return;
        // Don't navigate if user is voting
        if (isVotingRef.current) {
            swipeStartXRef.current = null;
            swipeStartYRef.current = null;
            swipeStartedOnPollRef.current = false;
            return;
        }
        // Don't navigate if swipe started on poll
        if (swipeStartedOnPollRef.current) {
            swipeStartedOnPollRef.current = false;
            swipeStartXRef.current = null;
            swipeStartYRef.current = null;
            return;
        }
        if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;

        const point = 'changedTouches' in e ? e.changedTouches[0] : (e as React.MouseEvent);
        const dx = point.clientX - swipeStartXRef.current;
        const dy = point.clientY - swipeStartYRef.current;

        swipeStartXRef.current = null;
        swipeStartYRef.current = null;

        // Only consider primarily horizontal swipes
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) {
            return;
        }

        // Double check voting state before navigating
        if (isVotingRef.current) {
            return;
        }

        if (dx < 0) {
            // Swipe left -> next story (within same user, or next user if at end)
            nextStory();
        } else if (dx > 0) {
            // Swipe right -> previous story (within same user, or previous user if at start)
            previousStory();
        }
    }

    function handleSwipeCancel() {
        swipeStartXRef.current = null;
        swipeStartYRef.current = null;
        swipeStartedOnPollRef.current = false;
    }

    // Navigate to previous story (within same user)
    function previousStory() {
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(currentStoryIndex - 1);
            setProgress(0);
            setIsMuted(true);
            elapsedTimeRef.current = 0;
            // Reset paused state for new story (poll check will handle pausing if needed)
            setPaused(false);
            pausedRef.current = false;
        } else {
            // Move to previous user's stories
            if (currentGroupIndex > 0) {
                setCurrentGroupIndex(currentGroupIndex - 1);
                const prevGroup = storyGroups[currentGroupIndex - 1];
                setCurrentStoryIndex(prevGroup?.stories.length - 1 || 0);
                setProgress(0);
                setIsMuted(true);
                elapsedTimeRef.current = 0;
                // Reset paused state for new story (poll check will handle pausing if needed)
                setPaused(false);
                pausedRef.current = false;
            }
        }
    }

    // Navigate to next user's stories (Instagram style - skip remaining stories from current user)
    function nextUserStories() {
        if (isVotingRef.current) {
            return;
        }
        
        if (currentGroupIndex < storyGroups.length - 1) {
            setCurrentGroupIndex(currentGroupIndex + 1);
            setCurrentStoryIndex(0);
            setProgress(0);
            setIsMuted(true);
            elapsedTimeRef.current = 0;
            setPaused(false);
            pausedRef.current = false;
        } else {
            // At the end of all stories, close
            closeStories();
        }
    }

    // Navigate to previous user's stories (Instagram style)
    function previousUserStories() {
        if (currentGroupIndex > 0) {
            setCurrentGroupIndex(currentGroupIndex - 1);
            const prevGroup = storyGroups[currentGroupIndex - 1];
            setCurrentStoryIndex(prevGroup?.stories.length - 1 || 0);
            setProgress(0);
            setIsMuted(true);
            elapsedTimeRef.current = 0;
            setPaused(false);
            pausedRef.current = false;
        }
    }

    // Handle reaction
    async function handleReaction(emoji: string) {
        if (!currentStory || !user?.id || !user?.handle) return;
        try {
            // Preserve current position before refreshing
            const currentUserId = currentGroup?.userId;
            const currentStoryIdx = currentStoryIndex;
            
            await addStoryReaction(currentStory.id, user.id, user.handle, emoji);
            setShowEmojiPicker(false);
            
            // Refresh story data but preserve current position
            // Use the same function that loaded initial stories
            const followedUserHandles = await getFollowedUsers(user.id);
            let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);
            
            // Load avatars for refreshed groups
            groups = await Promise.all(groups.map(async (group) => {
                if (group.userId === user.id && user.avatarUrl) {
                    return { ...group, avatarUrl: user.avatarUrl };
                }
                let avatarUrl = getAvatarForHandle(group.userHandle);
                if (!avatarUrl) {
                    try {
                        const { fetchUserProfile } = await import('../api/client');
                        const profile = await fetchUserProfile(group.userHandle, user.id);
                        if (profile && (profile.avatar_url || profile.avatarUrl)) {
                            avatarUrl = profile.avatar_url || profile.avatarUrl;
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch avatar for ${group.userHandle}:`, error);
                    }
                }
                return { ...group, avatarUrl };
            }));
            
            // Find the same user's group to maintain position
            const sameUserGroupIndex = groups.findIndex(g => g.userId === currentUserId);
            if (sameUserGroupIndex !== -1) {
                const sameUserGroup = groups[sameUserGroupIndex];
                // Make sure we don't go beyond the available stories
                const safeStoryIndex = Math.min(currentStoryIdx, sameUserGroup.stories.length - 1);
                
                // Update story groups
            setStoryGroups(groups);
                // Restore position to same user and same story
                setCurrentGroupIndex(sameUserGroupIndex);
                setCurrentStoryIndex(safeStoryIndex);
            } else {
                // If user not found, just update groups
                setStoryGroups(groups);
            }
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

        // For poll stories, allow timer to run but it will pause when voting
        // Only reset elapsed time if this is a new story (not resuming after vote)
        const storyId = currentStory.id;
        
        if (lastStoryIdRef.current !== storyId) {
            // New story - reset timer
        elapsedTimeRef.current = 0;
        setProgress(0);
            lastStoryIdRef.current = storyId;
        }
        // If same story, preserve elapsedTimeRef (for resuming after vote)

        // Mark story as viewed
        markStoryViewed(currentStory.id, user.id).catch(console.error);
        incrementStoryViews(currentStory.id).catch(console.error);

        // Progress bar animation (15 seconds per story)
        const duration = 15000;
        const interval = 50;

        const timer = setInterval(() => {
            // Don't update progress when paused, voting, or ScenesModal is open
            if (pausedRef.current || showScenesModal || isVotingRef.current) {
                return;
            }

            elapsedTimeRef.current += interval;
            const newProgress = Math.min((elapsedTimeRef.current / duration) * 100, 100);
            setProgress(newProgress);

            // Only advance if not voting and progress is complete
            if (newProgress >= 100) {
                // Double check voting state before scheduling navigation
                if (isVotingRef.current || pausedRef.current) {
                    return; // Don't advance if voting or paused
                }
                clearInterval(timer);
                elapsedTimeRef.current = 0; // Reset for next story

                // Clear any existing scheduled navigation
                if (nextStoryTimeoutRef.current !== null) {
                    clearTimeout(nextStoryTimeoutRef.current);
                }

                // Schedule a small delay before moving to the next story
                nextStoryTimeoutRef.current = window.setTimeout(() => {
                    // Triple check before actually calling nextStory
                    if (!isVotingRef.current && !pausedRef.current) {
                        nextStory();
                    }
                    nextStoryTimeoutRef.current = null;
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

    // Reset optimistic vote when story changes - MUST be before conditional returns
    React.useEffect(() => {
        setOptimisticVote(null);
    }, [currentStoryIndex, currentGroupIndex]);

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

    // Build a shareable URL for the current story
    const getCurrentStoryShareUrl = () => {
        if (!currentGroup || !currentStory) return window.location.href;
        try {
            const base = window.location.origin;
            const handle = encodeURIComponent(currentGroup.userHandle);
            const storyId = encodeURIComponent(currentStory.id);
            return `${base}/stories?user=${handle}&story=${storyId}`;
        } catch {
            return window.location.href;
        }
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
                <div className="fixed inset-0 z-50 bg-black">
                    {/* Progress bars for each story - Instagram style */}
                    <div className="absolute top-0 left-0 right-0 z-50 px-2 pt-2 pb-1">
                        <div className="flex gap-1">
                            {currentGroup.stories.map((story, idx) => (
                                <div key={story.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-white rounded-full transition-all ease-linear"
                                        style={
                                            idx < currentStoryIndex
                                                ? {
                                                    width: '100%',
                                                    transitionDuration: '100ms'
                                                }
                                                : idx === currentStoryIndex && !paused && progress > 0
                                                    ? {
                                                        width: `${progress}%`,
                                                        transitionDuration: '50ms'
                                                    }
                                                    : {
                                                        width: idx === currentStoryIndex ? `${progress}%` : '0%',
                                                        transitionDuration: '100ms'
                                                    }
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Story Media - Full screen Instagram style */}
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        onMouseDown={handleSwipeStart}
                        onMouseUp={handleSwipeEnd}
                        onMouseLeave={handleSwipeCancel}
                        onTouchStart={handleSwipeStart}
                        onTouchEnd={handleSwipeEnd}
                        onTouchCancel={handleSwipeCancel}
                    >
                        <div className="relative w-full h-full flex items-center justify-center">
                            <div className="relative w-full h-full overflow-hidden bg-black">
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
                                    // Poll story with media - show media (poll overlay will be shown separately)
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
                                    
                                    // Poll story without media - show poll background with Gazetteer gradient (poll overlay will show the content)
                                    if (currentStory?.poll && !currentStory.mediaUrl) {
                                        return (
                                            <div
                                                className="w-full h-full flex items-center justify-center p-4"
                                                style={{
                                                    background: 'linear-gradient(to bottom right, rgba(255, 78, 203, 0.2), rgba(0, 0, 0, 0.9), rgba(143, 91, 255, 0.2))'
                                                }}
                                            >
                                                {/* Poll overlay will render the question and options below */}
                                            </div>
                                        );
                                    }

                                    // Text-only story display (directly created, not shared) - keep original style with gradient/textStyle
                                    if (currentStory?.text) {
                                        // Get tagged users positions from story (not from textStyle)
                                        const taggedUsersPositions = currentStory?.taggedUsersPositions as Array<{ handle: string; x: number; y: number }> | undefined;
                                        
                                        return (
                                            <div
                                                className="w-full h-full flex items-center justify-center p-4 relative"
                                                style={{
                                                    background: currentStory?.textStyle?.background || '#1a1a1a'
                                                }}
                                            >
                                                <div className="w-full max-w-md relative">
                                                    <div
                                                        className="text-base leading-relaxed whitespace-pre-wrap font-normal px-6 py-8"
                                                        style={{
                                                            color: currentStory?.textStyle?.color || '#ffffff'
                                                        }}
                                                    >
                                                        {currentStory?.text}
                                                    </div>
                                                    {/* Tagged Users Display at their positions */}
                                                    {taggedUsersPositions && taggedUsersPositions.length > 0 && (
                                                        <>
                                                            {taggedUsersPositions.map((taggedUser) => (
                                                                <div
                                                                    key={taggedUser.id || taggedUser.handle}
                                                                    className="absolute"
                                                                    style={{
                                                                        left: `${taggedUser.x}%`,
                                                                        top: `${taggedUser.y}%`,
                                                                        transform: 'translate(-50%, -50%)',
                                                                        zIndex: 20,
                                                                        pointerEvents: 'auto'
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        setViewingStories(false);
                                                                        setTimeout(() => {
                                                                            navigate(`/user/${encodeURIComponent(taggedUser.handle)}`);
                                                                        }, 100);
                                                                    }}
                                                                >
                                                                    <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium hover:bg-white/30 transition-colors cursor-pointer"
                                                                        style={{
                                                                            color: currentStory?.textStyle?.color || '#ffffff',
                                                                            textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                                                                        }}
                                                                    >
                                                                        @{taggedUser.handle}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}
                                                    {/* Fallback: If no positions, show at bottom */}
                                                    {currentStory?.taggedUsers && currentStory.taggedUsers.length > 0 && !taggedUsersPositions && (
                                                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 px-6">
                                                            {currentStory.taggedUsers.map((handle) => (
                                                                <button
                                                                    key={handle}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        setViewingStories(false);
                                                                        setTimeout(() => {
                                                                            navigate(`/user/${encodeURIComponent(handle)}`);
                                                                        }, 100);
                                                                    }}
                                                                    className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium hover:bg-white/30 transition-colors cursor-pointer"
                                                                    style={{
                                                                        color: currentStory?.textStyle?.color || '#ffffff',
                                                                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                                                                    }}
                                                                >
                                                                    @{handle}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Fallback - should never reach here, but ensures something always renders
                                    return (
                                        <div
                                            className="w-full h-full flex items-center justify-center p-4"
                                            style={{
                                                background: '#1a1a1a'
                                            }}
                                        >
                                            <p className="text-white">Story</p>
                                        </div>
                                    );
                                })()}

                                {/* Sticker Overlays for all stories */}
                                {currentStory?.stickers && currentStory.stickers.length > 0 && (
                                    <>
                                        {currentStory.stickers.map((overlay) => {
                                            // Render text stickers (text and location)
                                            if (overlay.textContent) {
                                                const fontSize = overlay.fontSize === 'small' ? 'text-sm' :
                                                    overlay.fontSize === 'large' ? 'text-3xl' : 'text-xl';
                                                const scale = overlay.scale || 1;
                                                const isLocation = overlay.sticker.category === 'Location';
                                                return (
                                                    <div
                                                        key={overlay.id}
                                                        className="absolute pointer-events-none"
                                                        style={{
                                                            left: `${overlay.x}%`,
                                                            top: `${overlay.y}%`,
                                                            transform: `translate(-50%, -50%) scale(${scale}) rotate(${overlay.rotation}deg)`,
                                                            opacity: overlay.opacity,
                                                            zIndex: 20
                                                        }}
                                                    >
                                                        <div
                                                            className={`font-bold text-center ${fontSize} flex items-center gap-1.5 justify-center`}
                                                            style={{
                                                                color: overlay.textColor || '#FFFFFF',
                                                                textShadow: '2px 2px 8px rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9)',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            {isLocation && (
                                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                            {overlay.textContent}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            
                                            // Render emoji stickers
                                            if (overlay.sticker.emoji) {
                                                return (
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
                                                    <span className="text-4xl" style={{ fontSize: `${50 * overlay.scale}px` }}>
                                                        {overlay.sticker.emoji}
                                                    </span>
                                                    </div>
                                                );
                                            }
                                            
                                            // Render image/GIF stickers
                                            if (overlay.sticker.url) {
                                                return (
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
                                                    <img
                                                        src={overlay.sticker.url}
                                                        alt=""
                                                        className="max-w-[100px] max-h-[100px]"
                                                        style={{ pointerEvents: 'none' }}
                                                    />
                                            </div>
                                                );
                                            }
                                            
                                            return null;
                                        })}
                                    </>
                                )}

                                {/* Poll Overlay */}
                                {(() => {
                                    try {
                                        if (!currentStory?.poll) return null;
                                        if (!currentStory.poll.question || !currentStory.poll.option1 || !currentStory.poll.option2) {
                                            console.warn('Poll data incomplete:', currentStory.poll);
                                            return null;
                                        }
                                        console.log('Rendering poll:', {
                                            question: currentStory.poll.question,
                                            option1: currentStory.poll.option1,
                                            option2: currentStory.poll.option2,
                                            hasMedia: !!currentStory.mediaUrl
                                        });
                                        return (
                                    <div 
                                        data-poll-container
                                        className="absolute top-1/2 left-0 right-0 px-4 z-[80] pointer-events-auto transform -translate-y-1/2" 
                                        style={{ maxWidth: '100%' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                        }}
                                        onTouchStart={(e) => {
                                            e.stopPropagation();
                                            swipeStartedOnPollRef.current = true;
                                        }}
                                        onTouchEnd={(e) => {
                                            e.stopPropagation();
                                        }}
                                        onTouchMove={(e) => {
                                            e.stopPropagation();
                                        }}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            swipeStartedOnPollRef.current = true;
                                        }}
                                        onMouseUp={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                        }}
                                        onMouseMove={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                        }}
                                    >
                                        <div 
                                            className="rounded-2xl p-[2px] max-w-sm mx-auto"
                                            style={{
                                                background: 'linear-gradient(to right, rgba(255, 78, 203, 0.8), rgba(143, 91, 255, 0.8))'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                            }}
                                            onTouchStart={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                            }}
                                        >
                                            <div 
                                                className="backdrop-blur-md bg-white/95 rounded-2xl p-5 shadow-xl"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                }}
                                                onTouchStart={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                }}
                                            >
                                            {/* Poll Question */}
                                            <p className="text-gray-900 font-semibold text-base mb-4 text-center">
                                                {currentStory.poll.question || 'Poll Question'}
                                            </p>

                                            {/* Poll Options */}
                                            <div className="space-y-3">
                                                {/* Option 1 */}
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        e.nativeEvent?.stopImmediatePropagation();
                                                        if (!user?.id || currentStory.poll?.userVote === 'option1') return false;
                                                        
                                                        // IMMEDIATE visual feedback - turn blue right away
                                                        setOptimisticVote('option1');
                                                        
                                                        // Track when voting started to calculate remaining time
                                                        voteStartTimeRef.current = Date.now();
                                                        
                                                        // Immediately pause and prevent ALL navigation - set ref FIRST
                                                        // IMPORTANT: Don't reset elapsedTimeRef - we need to preserve it to calculate remaining time
                                                        isVotingRef.current = true;
                                                        pausedRef.current = true;
                                                        setPaused(true);
                                                        // Don't reset elapsedTimeRef or progress - preserve current progress
                                                        // Clear any pending nextStory calls
                                                        if (nextStoryTimeoutRef.current !== null) {
                                                            clearTimeout(nextStoryTimeoutRef.current);
                                                            nextStoryTimeoutRef.current = null;
                                                        }
                                                        // Reset swipe tracking to prevent navigation
                                                        swipeStartXRef.current = null;
                                                        swipeStartYRef.current = null;
                                                        swipeStartedOnPollRef.current = true;
                                                        
                                                        // Use requestAnimationFrame to ensure state is set before async call
                                                        requestAnimationFrame(async () => {
                                                            try {
                                                                // Preserve current position before refreshing
                                                                const currentUserId = currentGroup?.userId;
                                                                const currentStoryIdx = currentStoryIndex;
                                                                
                                                                await voteOnPoll(currentStory.id, user.id, 'option1');
                                                                
                                                                // Refresh story data but preserve current position
                                                                // Use the same function that loaded initial stories
                                                                const followedUserHandles = await getFollowedUsers(user.id);
                                                                let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);
                                                                
                                                                // Load avatars for refreshed groups
                                                                groups = await Promise.all(groups.map(async (group) => {
                                                                    if (group.userId === user.id && user.avatarUrl) {
                                                                        return { ...group, avatarUrl: user.avatarUrl };
                                                                    }
                                                                    let avatarUrl = getAvatarForHandle(group.userHandle);
                                                                    if (!avatarUrl) {
                                                                        try {
                                                                            const { fetchUserProfile } = await import('../api/client');
                                                                            const profile = await fetchUserProfile(group.userHandle, user.id);
                                                                            if (profile && (profile.avatar_url || profile.avatarUrl)) {
                                                                                avatarUrl = profile.avatar_url || profile.avatarUrl;
                                                                            }
                                                                        } catch (error) {
                                                                            console.warn(`Failed to fetch avatar for ${group.userHandle}:`, error);
                                                                        }
                                                                    }
                                                                    return { ...group, avatarUrl };
                                                                }));
                                                                
                                                                // Find the same user's group to maintain position
                                                                const sameUserGroupIndex = groups.findIndex(g => g.userId === currentUserId);
                                                                if (sameUserGroupIndex !== -1) {
                                                                    const sameUserGroup = groups[sameUserGroupIndex];
                                                                    // Make sure we don't go beyond the available stories
                                                                    const safeStoryIndex = Math.min(currentStoryIdx, sameUserGroup.stories.length - 1);
                                                                    
                                                                    // Update story groups
                                                                setStoryGroups(groups);
                                                                    // Restore position to same user and same story
                                                                    setCurrentGroupIndex(sameUserGroupIndex);
                                                                    setCurrentStoryIndex(safeStoryIndex);
                                                                } else {
                                                                    // If user not found, just update groups
                                                                    setStoryGroups(groups);
                                                                }
                                                                
                                                                // Clear optimistic vote after data is refreshed
                                                                setOptimisticVote(null);
                                                                
                                                                // Calculate remaining time based on when voting started
                                                                const STORY_DURATION = 15000; // 15 seconds
                                                                const timeVotingStarted = voteStartTimeRef.current || Date.now();
                                                                const timeSpentBeforeVoting = elapsedTimeRef.current;
                                                                const remainingTime = STORY_DURATION - timeSpentBeforeVoting;
                                                                
                                                                // Resume timer with remaining time - Instagram style
                                                                    isVotingRef.current = false;
                                                                // Reset swipe tracking to allow navigation
                                                                swipeStartXRef.current = null;
                                                                swipeStartYRef.current = null;
                                                                swipeStartedOnPollRef.current = false;
                                                                
                                                                // Resume the timer - it will continue from where it was
                                                                    setPaused(false);
                                                                    pausedRef.current = false;
                                                                // The progress timer will continue from elapsedTimeRef.current
                                                                voteStartTimeRef.current = null;
                                                            } catch (error) {
                                                                console.error('Error voting on poll:', error);
                                                                setOptimisticVote(null);
                                                                isVotingRef.current = false;
                                                                setPaused(false);
                                                                pausedRef.current = false;
                                                            }
                                                        });
                                                        
                                                        return false;
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                    }}
                                                    onTouchStart={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                    disabled={currentStory?.poll?.userVote !== undefined || optimisticVote !== null}
                                                    className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                                                        optimisticVote === 'option1' || currentStory?.poll?.userVote === 'option1'
                                                            ? 'bg-blue-500 text-white'
                                                            : optimisticVote === 'option2' || currentStory?.poll?.userVote === 'option2'
                                                            ? 'bg-gray-200 text-gray-600'
                                                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                                    } ${(currentStory?.poll?.userVote !== undefined || optimisticVote !== null) ? 'cursor-default' : 'cursor-pointer'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>{currentStory.poll.option1 || 'Option 1'}</span>
                                                        {currentStory.poll?.userVote !== undefined && (
                                                            <span className="text-xs font-medium">
                                                                {(() => {
                                                                    try {
                                                                        const votes1 = currentStory.poll?.votes1 || 0;
                                                                        const votes2 = currentStory.poll?.votes2 || 0;
                                                                        const totalVotes = votes1 + votes2;
                                                                        if (totalVotes === 0) return '0%';
                                                                        const percentage = Math.round((votes1 / totalVotes) * 100);
                                                                        return `${percentage}%`;
                                                                    } catch (e) {
                                                                        return '0%';
                                                                    }
                                                                })()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Progress bar */}
                                                    {currentStory.poll.userVote !== undefined && (
                                                        <div className="mt-2 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 transition-all"
                                                                style={{
                                                                    width: `${(() => {
                                                                        const totalVotes = (currentStory.poll?.votes1 || 0) + (currentStory.poll?.votes2 || 0);
                                                                        if (totalVotes === 0) return 0;
                                                                        return ((currentStory.poll?.votes1 || 0) / totalVotes) * 100;
                                                                    })()}%`
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </button>

                                                {/* Option 2 */}
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        e.nativeEvent?.stopImmediatePropagation();
                                                        if (!user?.id || currentStory.poll?.userVote === 'option2') return false;
                                                        
                                                        // IMMEDIATE visual feedback - turn blue right away
                                                        setOptimisticVote('option2');
                                                        
                                                        // Immediately pause and prevent ALL navigation - set ref FIRST
                                                        isVotingRef.current = true;
                                                        pausedRef.current = true;
                                                        setPaused(true);
                                                        elapsedTimeRef.current = 0;
                                                        setProgress(0);
                                                        // Clear any pending nextStory calls
                                                        if (nextStoryTimeoutRef.current !== null) {
                                                            clearTimeout(nextStoryTimeoutRef.current);
                                                            nextStoryTimeoutRef.current = null;
                                                        }
                                                        // Reset swipe tracking to prevent navigation
                                                        swipeStartXRef.current = null;
                                                        swipeStartYRef.current = null;
                                                        swipeStartedOnPollRef.current = true;
                                                        
                                                        // Use requestAnimationFrame to ensure state is set before async call
                                                        requestAnimationFrame(async () => {
                                                            try {
                                                                // Preserve current position before refreshing
                                                                const currentUserId = currentGroup?.userId;
                                                                const currentStoryIdx = currentStoryIndex;
                                                                
                                                                await voteOnPoll(currentStory.id, user.id, 'option2');
                                                                
                                                                // Refresh story data but preserve current position
                                                                // Use the same function that loaded initial stories
                                                                const followedUserHandles = await getFollowedUsers(user.id);
                                                                let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);
                                                                
                                                                // Load avatars for refreshed groups
                                                                groups = await Promise.all(groups.map(async (group) => {
                                                                    if (group.userId === user.id && user.avatarUrl) {
                                                                        return { ...group, avatarUrl: user.avatarUrl };
                                                                    }
                                                                    let avatarUrl = getAvatarForHandle(group.userHandle);
                                                                    if (!avatarUrl) {
                                                                        try {
                                                                            const { fetchUserProfile } = await import('../api/client');
                                                                            const profile = await fetchUserProfile(group.userHandle, user.id);
                                                                            if (profile && (profile.avatar_url || profile.avatarUrl)) {
                                                                                avatarUrl = profile.avatar_url || profile.avatarUrl;
                                                                            }
                                                                        } catch (error) {
                                                                            console.warn(`Failed to fetch avatar for ${group.userHandle}:`, error);
                                                                        }
                                                                    }
                                                                    return { ...group, avatarUrl };
                                                                }));
                                                                
                                                                // Find the same user's group to maintain position
                                                                const sameUserGroupIndex = groups.findIndex(g => g.userId === currentUserId);
                                                                if (sameUserGroupIndex !== -1) {
                                                                    const sameUserGroup = groups[sameUserGroupIndex];
                                                                    // Make sure we don't go beyond the available stories
                                                                    const safeStoryIndex = Math.min(currentStoryIdx, sameUserGroup.stories.length - 1);
                                                                    
                                                                    // Update story groups
                                                                setStoryGroups(groups);
                                                                    // Restore position to same user and same story
                                                                    setCurrentGroupIndex(sameUserGroupIndex);
                                                                    setCurrentStoryIndex(safeStoryIndex);
                                                                } else {
                                                                    // If user not found, just update groups
                                                                    setStoryGroups(groups);
                                                                }
                                                                
                                                                // Clear optimistic vote after data is refreshed
                                                                setOptimisticVote(null);
                                                                
                                                                // Calculate remaining time based on when voting started
                                                                const STORY_DURATION = 15000; // 15 seconds
                                                                const timeVotingStarted = voteStartTimeRef.current || Date.now();
                                                                const timeSpentBeforeVoting = elapsedTimeRef.current;
                                                                const remainingTime = STORY_DURATION - timeSpentBeforeVoting;
                                                                
                                                                // Resume timer with remaining time - Instagram style
                                                                    isVotingRef.current = false;
                                                                // Reset swipe tracking to allow navigation
                                                                swipeStartXRef.current = null;
                                                                swipeStartYRef.current = null;
                                                                swipeStartedOnPollRef.current = false;
                                                                
                                                                // Resume the timer - it will continue from where it was
                                                                    setPaused(false);
                                                                    pausedRef.current = false;
                                                                // The progress timer will continue from elapsedTimeRef.current
                                                                voteStartTimeRef.current = null;
                                                            } catch (error) {
                                                                console.error('Error voting on poll:', error);
                                                                setOptimisticVote(null);
                                                                isVotingRef.current = false;
                                                                setPaused(false);
                                                                pausedRef.current = false;
                                                            }
                                                        });
                                                        
                                                        return false;
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                    }}
                                                    onTouchStart={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                    disabled={currentStory?.poll?.userVote !== undefined || optimisticVote !== null}
                                                    className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                                                        optimisticVote === 'option2' || currentStory?.poll?.userVote === 'option2'
                                                            ? 'bg-blue-500 text-white'
                                                            : optimisticVote === 'option1' || currentStory?.poll?.userVote === 'option1'
                                                            ? 'bg-gray-200 text-gray-600'
                                                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                                    } ${(currentStory?.poll?.userVote !== undefined || optimisticVote !== null) ? 'cursor-default' : 'cursor-pointer'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className={currentStory?.poll?.userVote !== undefined ? 'text-white' : 'text-gray-900'}>{currentStory.poll.option2 || 'Option 2'}</span>
                                                        {currentStory.poll?.userVote !== undefined && (
                                                            <span className="text-[10px] text-white/80">
                                                                {(() => {
                                                                    try {
                                                                        const votes1 = currentStory.poll?.votes1 || 0;
                                                                        const votes2 = currentStory.poll?.votes2 || 0;
                                                                        const totalVotes = votes1 + votes2;
                                                                        if (totalVotes === 0) return '0%';
                                                                        const percentage = Math.round((votes2 / totalVotes) * 100);
                                                                        return `${percentage}%`;
                                                                    } catch (e) {
                                                                        return '0%';
                                                                    }
                                                                })()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Progress bar */}
                                                    {currentStory.poll.userVote !== undefined && (
                                                        <div className="mt-2 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 transition-all"
                                                                style={{
                                                                    width: `${(() => {
                                                                        const totalVotes = (currentStory.poll?.votes1 || 0) + (currentStory.poll?.votes2 || 0);
                                                                        if (totalVotes === 0) return 0;
                                                                        return ((currentStory.poll?.votes2 || 0) / totalVotes) * 100;
                                                                    })()}%`
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Vote count */}
                                            {currentStory.poll?.userVote !== undefined && (
                                                <p className="text-gray-600 text-xs text-center mt-3">
                                                    {(() => {
                                                        try {
                                                            const votes1 = currentStory.poll?.votes1 || 0;
                                                            const votes2 = currentStory.poll?.votes2 || 0;
                                                            return `${votes1 + votes2} votes`;
                                                        } catch (e) {
                                                            return '0 votes';
                                                        }
                                                    })()}
                                                </p>
                                            )}
                                            </div>
                                        </div>
                                    </div>
                                        );
                                    } catch (error) {
                                        console.error('Error rendering poll:', error);
                                        return null;
                                    }
                                })()}
                            </div>
                        </div>
                    </div>


                    {/* Header with user info - Instagram style */}
                    <div className="absolute top-3 left-0 right-0 px-4 z-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                    <Avatar
                                        src={currentGroup?.avatarUrl}
                                        name={currentGroup?.name || 'User'}
                                        size="sm"
                                    />
                                <div>
                                    <p className="text-white font-semibold text-sm">{currentGroup?.userHandle}</p>
                                    {currentStory?.createdAt && (
                                        <p className="text-white/70 text-xs">{getTimeAgo(currentStory.createdAt)}</p>
                                    )}
                                </div>
                            </div>
                                <button
                                    onClick={closeStories}
                                className="pointer-events-auto p-2"
                                >
                                <FiX className="w-6 h-6 text-white" />
                                </button>
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

                    {/* Bottom Action Bar - Instagram Style */}
                    <div className="absolute bottom-0 left-0 right-0 z-[60] px-4 pb-4">
                        <div className="flex items-center gap-3 max-w-md mx-auto">
                            {/* Send Message Input */}
                            <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onFocus={(e) => {
                                    e.stopPropagation();
                                    setShowReplyModal(true);
                                }}
                                placeholder="Send message"
                                className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-white placeholder-white/60 text-sm outline-none border-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowReplyModal(true);
                                }}
                                readOnly
                            />
                            
                            {/* Like Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleReaction('❤️');
                                }}
                                className="p-2 flex-shrink-0"
                            >
                                {currentStory?.userReaction ? (
                                    <AiFillHeart className="w-6 h-6 text-red-500" />
                                ) : (
                                    <FiHeart className="w-6 h-6 text-white" />
                                )}
                            </button>

                            {/* Share Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setShowStoryShareModal(true);
                                }}
                                className="p-2 flex-shrink-0"
                            >
                                <FiSend className="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Swipe navigation is handled on the main media container - no tap zones to avoid conflicts with polls */}
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

                {/* Story Share Sheet - for WhatsApp, Copy Link, etc. */}
                {showStoryShareModal && currentStory && (
                    <div
                        className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex items-end"
                        onClick={() => setShowStoryShareModal(false)}
                    >
                        <div
                            className="w-full bg-gray-900 text-white rounded-t-3xl p-4 pb-6 animate-in slide-in-from-bottom duration-300"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold">Share story</h3>
                                <button
                                    onClick={() => setShowStoryShareModal(false)}
                                    className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                                >
                                    <FiX className="w-5 h-5 text-gray-300" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {/* Copy Link */}
                                <button
                                    onClick={async () => {
                                        try {
                                            const url = getCurrentStoryShareUrl();
                                            await navigator.clipboard.writeText(url);
                                            showToast?.('Story link copied');
                                            setShowStoryShareModal(false);
                                        } catch (err) {
                                            console.error('Failed to copy story link:', err);
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                    <span className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-semibold">
                                        <FiLink className="w-4 h-4" />
                                    </span>
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-semibold">Copy link</div>
                                        <div className="text-xs text-gray-400">Share story link</div>
                                    </div>
                                </button>

                                {/* WhatsApp */}
                                <button
                                    onClick={() => {
                                        try {
                                            const url = encodeURIComponent(getCurrentStoryShareUrl());
                                            const text = encodeURIComponent(`Check out this story by @${currentGroup?.userHandle || ''}`);
                                            const shareUrl = `https://wa.me/?text=${text}%20${url}`;
                                            window.open(shareUrl, '_blank', 'width=600,height=400');
                                            setShowStoryShareModal(false);
                                        } catch (err) {
                                            console.error('Failed to open WhatsApp share:', err);
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                    <span className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold">
                                        W
                                    </span>
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-semibold">WhatsApp</div>
                                        <div className="text-xs text-gray-400">Share via WhatsApp</div>
                                    </div>
                                </button>

                                {/* Facebook */}
                                <button
                                    onClick={() => {
                                        try {
                                            const url = encodeURIComponent(getCurrentStoryShareUrl());
                                            const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                                            window.open(shareUrl, '_blank', 'width=600,height=400');
                                            setShowStoryShareModal(false);
                                        } catch (err) {
                                            console.error('Failed to open Facebook share:', err);
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                    <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                                        f
                                    </span>
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-semibold">Facebook</div>
                                        <div className="text-xs text-gray-400">Share to Facebook</div>
                                    </div>
                                </button>

                                {/* X (Twitter) */}
                                <button
                                    onClick={() => {
                                        try {
                                            const url = encodeURIComponent(getCurrentStoryShareUrl());
                                            const text = encodeURIComponent(`Check out this story by @${currentGroup?.userHandle || ''}`);
                                            const shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
                                            window.open(shareUrl, '_blank', 'width=600,height=400');
                                            setShowStoryShareModal(false);
                                        } catch (err) {
                                            console.error('Failed to open Twitter share:', err);
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                    <span className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-sm font-bold">
                                        X
                                    </span>
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-semibold">X (Twitter)</div>
                                        <div className="text-xs text-gray-400">Share to X</div>
                                    </div>
                                </button>

                                {/* Email */}
                                <button
                                    onClick={() => {
                                        try {
                                            const url = encodeURIComponent(getCurrentStoryShareUrl());
                                            const subject = encodeURIComponent('Check out this story');
                                            const body = encodeURIComponent(`Have a look at this story by @${currentGroup?.userHandle || ''}:\n\n${getCurrentStoryShareUrl()}`);
                                            const shareUrl = `mailto:?subject=${subject}&body=${body}`;
                                            window.location.href = shareUrl;
                                            setShowStoryShareModal(false);
                                        } catch (err) {
                                            console.error('Failed to open email share:', err);
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                    <span className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-sm font-bold">
                                        @
                                    </span>
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-semibold">Email</div>
                                        <div className="text-xs text-gray-400">Share via email</div>
                                    </div>
                                </button>
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
                        
                        // Profile Picture Component with error handling
                        const ProfilePicture = React.memo(({ group, locationColor }: { group: StoryGroup; locationColor: string }) => {
                            const [imageError, setImageError] = React.useState(false);
                            
                            return (
                                <div 
                                    className="relative w-16 h-16 rounded-full overflow-hidden border-4 shadow-lg"
                                    style={{
                                        borderColor: locationColor,
                                        boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)`
                                    }}
                                >
                                    {group.avatarUrl && !imageError ? (
                                        <img
                                            src={group.avatarUrl}
                                            alt={group.name}
                                            className="w-full h-full object-cover"
                                            onError={() => setImageError(true)}
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
                            );
                        });
                        ProfilePicture.displayName = 'ProfilePicture';
                        
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
                                            // Use a simple data URI as fallback instead of external service
                                            if (!target.src.startsWith('data:')) {
                                                // Create a simple gray placeholder using data URI
                                                const canvas = document.createElement('canvas');
                                                canvas.width = 400;
                                                canvas.height = 600;
                                                const ctx = canvas.getContext('2d');
                                                if (ctx) {
                                                    ctx.fillStyle = '#1a1a1a';
                                                    ctx.fillRect(0, 0, 400, 600);
                                                    ctx.fillStyle = '#ffffff';
                                                    ctx.font = '24px Arial';
                                                    ctx.textAlign = 'center';
                                                    ctx.textBaseline = 'middle';
                                                    ctx.fillText(displayName || 'Story', 200, 300);
                                                    target.src = canvas.toDataURL();
                                                } else {
                                                    // If canvas not available, just hide the image
                                                    target.style.display = 'none';
                                                }
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
                                        <ProfilePicture group={group} locationColor={locationColor} />
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

