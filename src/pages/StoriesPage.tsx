import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiChevronRight, FiChevronLeft, FiMessageCircle, FiHeart, FiVolume2, FiVolumeX, FiMaximize2, FiMapPin, FiSend, FiLink, FiCopy, FiPlus } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchStoryGroups, fetchUserStories, markStoryViewed, incrementStoryViews, addStoryReaction, addStoryReply, fetchFollowedUsersStoryGroups, fetchStoryGroupByHandle, voteOnPoll, addQuestionAnswer } from '../api/stories';
import { appendMessage } from '../api/messages';
import Swal from 'sweetalert2';
import { isProfilePrivate, canSendMessage, createFollowRequest } from '../api/privacy';
import { getFollowedUsers, getPostById, toggleFollowForPost, getState, setFollowState } from '../api/posts';
import { showToast } from '../utils/toast';
import ScenesModal from '../components/ScenesModal';
import { getFlagForHandle, getAvatarForHandle } from '../api/users';
import Flag from '../components/Flag';
import { timeAgo } from '../utils/timeAgo';
import { toggleFollow } from '../api/client';
import { FiUserPlus, FiUserCheck } from 'react-icons/fi';
import type { Story, StoryGroup, Post } from '../types';

// Special Gazetteer world highlights configuration (mock stories only for now)
const GAZETTEER_WORLD_USER_ID = 'gazetteer-world';
const GAZETTEER_WORLD_HANDLE = 'Gazetteer@world highlights';

function createGazetteerWorldStories(): Story[] {
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const expiresAt = now + twentyFourHours;

    return [
        {
            id: 'gazetteer-world-1',
            userId: GAZETTEER_WORLD_USER_ID,
            userHandle: GAZETTEER_WORLD_HANDLE,
            text: 'World highlights: top Clips24 stories from around the globe today.',
            textStyle: {
                background: 'linear-gradient(145deg, #0f172a, #1d4ed8, #22c55e)',
                color: '#ffffff',
                size: 'medium',
            },
            createdAt: now - 2 * 60 * 60 * 1000,
            expiresAt,
            views: 0,
            hasViewed: false,
            reactions: [],
            replies: [],
        },
        {
            id: 'gazetteer-world-2',
            userId: GAZETTEER_WORLD_USER_ID,
            userHandle: GAZETTEER_WORLD_HANDLE,
            text: 'Gazetteer editors pick today’s must-see stories and news.',
            textStyle: {
                background: 'linear-gradient(145deg, #581c87, #db2777)',
                color: '#ffffff',
                size: 'medium',
            },
            createdAt: now - 4 * 60 * 60 * 1000,
            expiresAt,
            views: 0,
            hasViewed: false,
            reactions: [],
            replies: [],
        },
    ];
}

function withGazetteerWorldGroup(groups: StoryGroup[]): StoryGroup[] {
    // If backend ever creates this user, avoid duplicating it
    if (groups.some(g => g.userId === GAZETTEER_WORLD_USER_ID || g.userHandle === GAZETTEER_WORLD_HANDLE)) {
        return groups;
    }

    const gazetteerStories = createGazetteerWorldStories();

    const gazetteerGroup: StoryGroup = {
        userId: GAZETTEER_WORLD_USER_ID,
        userHandle: GAZETTEER_WORLD_HANDLE,
        name: 'Gazetteer World Highlights',
        avatarUrl: '/gazetteer logo 1/gazetteer logo 1.jpg',
        stories: gazetteerStories,
    };

    return [gazetteerGroup, ...groups];
}

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
    const [hasVideo, setHasVideo] = React.useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const [showReplyModal, setShowReplyModal] = React.useState(false);
    const [replyText, setReplyText] = React.useState('');
    const [showStoryShareModal, setShowStoryShareModal] = React.useState(false);
    const [showControls, setShowControls] = React.useState(true);
    const [showScenesModal, setShowScenesModal] = React.useState(false);
    const [fullPost, setFullPost] = React.useState<Post | null>(null);
    const [originalPost, setOriginalPost] = React.useState<Post | null>(null);
    const [sharedPostFetchFailed, setSharedPostFetchFailed] = React.useState(false);
    const [showSharedPostModal, setShowSharedPostModal] = React.useState(false);
    const [isFollowingStoryUser, setIsFollowingStoryUser] = React.useState<boolean>(false);
    const [isFollowLoading, setIsFollowLoading] = React.useState<boolean>(false);
    const [optimisticVote, setOptimisticVote] = React.useState<'option1' | 'option2' | 'option3' | null>(null);
    const [showQuestionAnswerModal, setShowQuestionAnswerModal] = React.useState(false);
    const [questionAnswer, setQuestionAnswer] = React.useState('');
    const [selectedResponse, setSelectedResponse] = React.useState<{ id: string; userHandle: string; text: string; createdAt: number } | null>(null);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
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

            // Always inject Gazetteer world highlights as a mock story group (first position)
            setStoryGroups(withGazetteerWorldGroup(groupsWithAvatars));
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

    // Check if current user is following the story owner
    React.useEffect(() => {
        const checkFollowStatus = async () => {
            const currentGroup = storyGroups[currentGroupIndex];
            if (!user?.id || !currentGroup?.userHandle || currentGroup.userHandle === user.handle) {
                setIsFollowingStoryUser(false);
                return;
            }

            try {
                const followedUsers = await getFollowedUsers(user.id);
                setIsFollowingStoryUser(followedUsers.includes(currentGroup.userHandle));
            } catch (error) {
                console.error('Error checking follow status:', error);
                setIsFollowingStoryUser(false);
            }
        };

        if (viewingStories && storyGroups.length > 0 && currentGroupIndex >= 0) {
            checkFollowStatus();
        }
    }, [viewingStories, currentGroupIndex, storyGroups, user?.id, user?.handle]);

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
        if (!group || !user?.id) return;

        // Special handling for Gazetteer world highlights - use local mock stories only
        if (group.userId === GAZETTEER_WORLD_USER_ID || group.userHandle === GAZETTEER_WORLD_HANDLE) {
            const groupIndex = storyGroups.findIndex(
                g => g.userId === GAZETTEER_WORLD_USER_ID || g.userHandle === GAZETTEER_WORLD_HANDLE
            );
            if (groupIndex === -1) return;

            setCurrentGroupIndex(groupIndex);
            currentGroupIndexRef.current = groupIndex;
            setCurrentStoryIndex(0);
            currentStoryIndexRef.current = 0;
            setViewingStories(true);
            setProgress(0);
            setPaused(false);
            setIsMuted(true);
            elapsedTimeRef.current = 0;
            return;
        }

        const stories = await fetchUserStories(user.id, group.userId);
        if (!stories || stories.length === 0) return;

        // Find the group index in the original array, or add it if not found
        setStoryGroups(prev => {
            let groupIndex = prev.findIndex(g => g.userId === group.userId);
            
            if (groupIndex === -1) {
                // Group not found, add it to the array
                const updated = [...prev, { ...group, stories, avatarUrl: group.avatarUrl }];
                groupIndex = updated.length - 1;
                
                // Set the index after state update
                setTimeout(() => {
                    setCurrentGroupIndex(groupIndex);
                    currentGroupIndexRef.current = groupIndex;
                    setCurrentStoryIndex(0);
                    currentStoryIndexRef.current = 0;
                    setViewingStories(true);
                    setProgress(0);
                    setPaused(false);
                    setIsMuted(true);
                    elapsedTimeRef.current = 0;
                }, 0);
                
                return updated;
            } else {
                // Group found, update it
                const updated = [...prev];
                updated[groupIndex] = { ...group, stories, avatarUrl: group.avatarUrl };
                
                // Set the index immediately
                setCurrentGroupIndex(groupIndex);
                currentGroupIndexRef.current = groupIndex;
                setCurrentStoryIndex(0);
                currentStoryIndexRef.current = 0;
                setViewingStories(true);
                setProgress(0);
                setPaused(false);
                setIsMuted(true);
                elapsedTimeRef.current = 0;
                
                return updated;
            }
        });
    }

    // Close story viewer
    function closeStories() {
        setViewingStories(false);
        setProgress(0);
        setPaused(false);
        setIsMuted(true);
        elapsedTimeRef.current = 0;

        // Always navigate back to feed when stories finish
        // If we came from feed (via avatar click), use navigate(-1)
        // Otherwise, navigate to /feed
        if (openUserHandle) {
            // Dispatch event to refresh story indicators
            window.dispatchEvent(new CustomEvent('storiesViewed', {
                detail: { userHandle: openUserHandle }
            }));
            navigate(-1);
        } else {
            // Navigate to feed if we came from sharing a post or other source
            navigate('/feed');
        }
    }

    // Handle moving to next user's stories
    function handleNextUserStories(currentGroups: StoryGroup[], currentIdx: number) {
        console.log('handleNextUserStories called. Current group index:', currentIdx, 'Total groups:', currentGroups.length);
        console.log('All groups:', currentGroups.map((g, idx) => ({ index: idx, userHandle: g.userHandle, userId: g.userId, storiesCount: g.stories?.length || 0 })));
        
        const currentGroup = currentGroups[currentIdx];
        const isViewingOwnStories = currentGroup && (currentGroup.userId === user?.id || currentGroup.userHandle === user?.handle);
        
        // Find the next group
        let nextGroupIndex = -1;
        let nextGroup: StoryGroup | null = null;
        
        // Start searching from the next index
        for (let i = currentIdx + 1; i < currentGroups.length; i++) {
            const candidate = currentGroups[i];
            // When viewing own stories, skip looping back to own group. Otherwise allow any group.
            if (
                candidate &&
                (!isViewingOwnStories ||
                    (candidate.userId !== user?.id && candidate.userHandle !== user?.handle))
            ) {
                nextGroupIndex = i;
                nextGroup = candidate;
                break;
            }
        }
        
        // If no next group found after current index, search from the beginning
        if (nextGroupIndex === -1) {
            for (let i = 0; i < currentIdx; i++) {
                const candidate = currentGroups[i];
                if (
                    candidate &&
                    (!isViewingOwnStories ||
                        (candidate.userId !== user?.id && candidate.userHandle !== user?.handle))
                ) {
                    nextGroupIndex = i;
                    nextGroup = candidate;
                    break;
                }
            }
        }
        
        console.log('Next group search result:', {
            found: nextGroupIndex !== -1,
            index: nextGroupIndex,
            userHandle: nextGroup?.userHandle,
            userId: nextGroup?.userId,
            isViewingOwnStories
        });
        
        if (nextGroupIndex !== -1 && nextGroup) {
            // Always fetch stories for next user to ensure they're loaded
            if (user?.id && nextGroup.userId) {
                console.log('Fetching stories for next user:', nextGroup.userHandle);
                fetchUserStories(user.id, nextGroup.userId)
                    .then((stories) => {
                        console.log('Fetched stories for next user:', stories?.length || 0);
                        if (stories && stories.length > 0) {
                            // Update the group with fetched stories - find by userId to handle array updates
                            setStoryGroups(prev => {
                                const updated = [...prev];
                                const groupIndex = updated.findIndex(g => g.userId === nextGroup.userId);
                                if (groupIndex !== -1) {
                                    updated[groupIndex] = { ...nextGroup, stories, avatarUrl: nextGroup.avatarUrl };
                                } else {
                                    // If group not found, add it
                                    updated.push({ ...nextGroup, stories, avatarUrl: nextGroup.avatarUrl });
                                }
                                
                                // Find the actual index after update (in case array order changed)
                                const actualIndex = updated.findIndex(g => g.userId === nextGroup.userId);
                                if (actualIndex !== -1) {
                                    // Navigate to the next user's first story
                                    console.log('Navigating to next user stories at index:', actualIndex);
                                    setCurrentGroupIndex(actualIndex);
                                    currentGroupIndexRef.current = actualIndex;
                                    setCurrentStoryIndex(0);
                                    currentStoryIndexRef.current = 0;
                                    setProgress(0);
                                    setIsMuted(true);
                                    elapsedTimeRef.current = 0;
                                    setPaused(false);
                                    pausedRef.current = false;
                                }
                                
                                return updated;
                            });
                        } else {
                            console.warn('Next user group has no stories after fetching, trying next group or closing');
                            // Try to find next group with stories, or close
                            setStoryGroups(prev => {
                                // Find next group after nextGroupIndex (optionally skipping user's own group)
                                const nextGroupWithStories = prev.find((g, idx) =>
                                    idx > nextGroupIndex &&
                                    (!isViewingOwnStories ||
                                        (g.userId !== user?.id && g.userHandle !== user?.handle)) &&
                                    g.stories &&
                                    g.stories.length > 0
                                );
                                if (nextGroupWithStories) {
                                    const foundIndex = prev.findIndex(g => g.userId === nextGroupWithStories.userId);
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
                                return prev;
                            });
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
            // No next group found (excluding user's own group), close
            console.log('No more user stories to view. Current index:', currentIdx, 'Total groups:', currentGroups.length, 'Is viewing own stories:', isViewingOwnStories);
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
                console.log('Moving to next user. Current index:', currentIdx, 'Total groups:', currentGroups.length);
                console.log('Current group:', currentGroup.userHandle, 'Stories:', currentGroup.stories.length);
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

    // Handle reaction (like/emoji) without breaking the current viewer position
    async function handleReaction(emoji: string) {
        if (!currentStory || !user?.id || !user?.handle) return;
        try {
            // Preserve current position before refreshing
            const currentUserId = currentGroup?.userId;
            const currentUserHandle = currentGroup?.userHandle;
            const currentStoryIdx = currentStoryIndex;
            
            // Apply reaction to underlying data
            await addStoryReaction(currentStory.id, user.id, user.handle, emoji);
            setShowEmojiPicker(false);
            
            // Refresh story data but preserve current position
            // Use the same function that loaded initial stories (followed users)
            const followedUserHandles = await getFollowedUsers(user.id);
            let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);

            // If current user's group (e.g. Sarah when opened from feed) is not in the list,
            // fetch it separately by handle – same behaviour as initial load with openUserHandle
            if (currentUserHandle) {
                const existingIndex = groups.findIndex(g => g.userHandle === currentUserHandle);
                if (existingIndex === -1) {
                    try {
                        const extraGroup = await fetchStoryGroupByHandle(currentUserHandle);
                        if (extraGroup) {
                            groups.push(extraGroup);
                        }
                    } catch (error) {
                        console.warn('Failed to fetch extra story group after reaction for handle', currentUserHandle, error);
                    }
                }
            }
            
            // Load avatars for refreshed groups (same as loadStories)
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
            // Try by userId first, then by userHandle as fallback
            let sameUserGroupIndex = groups.findIndex(g => g.userId === currentUserId);
            if (sameUserGroupIndex === -1 && currentUserHandle) {
                sameUserGroupIndex = groups.findIndex(g => g.userHandle === currentUserHandle);
            }

            if (sameUserGroupIndex !== -1) {
                const sameUserGroup = groups[sameUserGroupIndex];
                // Make sure we don't go beyond the available stories
                const safeStoryIndex = Math.min(currentStoryIdx, sameUserGroup.stories.length - 1);
                
                // Update story groups and restore position
                setStoryGroups(groups);
                setCurrentGroupIndex(sameUserGroupIndex);
                currentGroupIndexRef.current = sameUserGroupIndex;
                setCurrentStoryIndex(safeStoryIndex);
                currentStoryIndexRef.current = safeStoryIndex;
            } else {
                // If user not found, try to keep current position if still valid
                if (currentGroupIndex < groups.length && groups[currentGroupIndex]?.stories?.length > 0) {
                    setStoryGroups(groups);
                    const safeStoryIndex = Math.min(currentStoryIdx, groups[currentGroupIndex].stories.length - 1);
                    setCurrentStoryIndex(safeStoryIndex);
                    currentStoryIndexRef.current = safeStoryIndex;
                } else {
                    // As a last resort, close the viewer instead of leaving it in a broken state
                    console.warn('User group not found after reaction, closing viewer');
                    setViewingStories(false);
                }
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
            setSharedPostFetchFailed(false);
            console.log('Fetching original post for shared story:', currentStory.sharedFromPost);
            let cancelled = false;
            const timeoutId = window.setTimeout(() => {
                if (!cancelled) {
                    console.warn('getPostById timeout for shared story');
                    setOriginalPost(null);
                    setSharedPostFetchFailed(true);
                }
            }, 8000);
            getPostById(currentStory.sharedFromPost)
                .then((post) => {
                    if (cancelled) return;
                    window.clearTimeout(timeoutId);
                    if (post) {
                        console.log('Original post fetched:', {
                            id: post.id,
                            hasText: !!post.text,
                            hasMediaUrl: !!post.mediaUrl,
                            mediaUrl: post.mediaUrl,
                            hasMediaItems: !!(post.mediaItems && post.mediaItems.length > 0)
                        });
                        setOriginalPost(post);
                    } else {
                        console.warn('Original post not found:', currentStory.sharedFromPost);
                        setOriginalPost(null);
                        setSharedPostFetchFailed(true);
                    }
                })
                .catch((error) => {
                    if (!cancelled) {
                        window.clearTimeout(timeoutId);
                        console.error('Failed to fetch original post:', error);
                        setOriginalPost(null);
                        setSharedPostFetchFailed(true);
                    }
                });
            return () => {
                cancelled = true;
                window.clearTimeout(timeoutId);
            };
        } else {
            setOriginalPost(null);
            setSharedPostFetchFailed(false);
        }
    }, [currentGroupIndex, currentStoryIndex, storyGroups]);

    // Track story view progress
    React.useEffect(() => {
        if (!viewingStories || !user?.id || showScenesModal || showSharedPostModal) return; // Don't run progress when modals are open

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

        // Mark story as viewed for real user stories only (skip Gazetteer mock stories)
        if (currentStory.userId !== GAZETTEER_WORLD_USER_ID) {
            markStoryViewed(currentStory.id, user.id).catch(console.error);
            incrementStoryViews(currentStory.id).catch(console.error);
        }

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
    }, [viewingStories, currentGroupIndex, currentStoryIndex, storyGroups, user?.id, showScenesModal, showSharedPostModal]);

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
                    Promise
                        .resolve(videoRef.current.pause())
                        .catch(() => { /* ignore */ });
                } else {
                    Promise
                        .resolve(videoRef.current.play())
                        .catch(() => { /* ignore */ });
                }
            }
        } catch (error) {
            console.error('Error controlling video:', error);
        }
    }, [paused, viewingStories, currentGroupIndex, currentStoryIndex, storyGroups]);

    // Sync video muted state with isMuted state (for both regular and shared post videos)
    React.useEffect(() => {
        if (!viewingStories || !videoRef.current) return;

        try {
            const currentGroup = storyGroups[currentGroupIndex];
            const currentStory = currentGroup?.stories?.[currentStoryIndex];
            
            // Check if current story is a video (regular or shared post)
            const isVideo = currentStory?.mediaType === 'video' || 
                           (currentStory?.sharedFromPost && originalPost && 
                            (originalPost.mediaType === 'video' || originalPost.mediaItems?.[0]?.type === 'video'));
            
            if (isVideo && videoRef.current) {
                const video = videoRef.current;
                const shouldBeMuted = isMuted;
                
                // Force update muted state immediately
                video.muted = shouldBeMuted;
                
                // If unmuting, ensure video is playing and audio is enabled
                if (!shouldBeMuted) {
                    // Aggressively set muted to false multiple times
                    video.muted = false;
                    
                    // Ensure video is playing
                    if (video.paused) {
                        video.play().then(() => {
                            // After play succeeds, ensure muted is still false
                            if (videoRef.current) {
                                videoRef.current.muted = false;
                            }
                        }).catch(console.error);
                    } else {
                        // Video is already playing, just ensure muted is false
                        video.muted = false;
                    }
                    
                    // Use multiple timeouts to ensure the muted state sticks
                    const timeout1 = setTimeout(() => {
                        if (videoRef.current && !shouldBeMuted) {
                            videoRef.current.muted = false;
                        }
                    }, 50);
                    
                    const timeout2 = setTimeout(() => {
                        if (videoRef.current && !shouldBeMuted) {
                            videoRef.current.muted = false;
                            if (videoRef.current.paused) {
                                videoRef.current.play().catch(console.error);
                            }
                        }
                    }, 150);
                    
                    return () => {
                        clearTimeout(timeout1);
                        clearTimeout(timeout2);
                    };
                }
            }
        } catch (error) {
            console.error('Error syncing video muted state:', error);
        }
    }, [isMuted, viewingStories, currentGroupIndex, currentStoryIndex, storyGroups, originalPost]);

    // Also sync when originalPost loads (for shared posts)
    React.useEffect(() => {
        if (!viewingStories || !videoRef.current || !originalPost) return;

        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories?.[currentStoryIndex];
        
        // Check if this is a shared post video
        if (currentStory?.sharedFromPost && 
            (originalPost.mediaType === 'video' || originalPost.mediaItems?.[0]?.type === 'video')) {
            // Sync muted state when originalPost loads
            if (videoRef.current) {
                const video = videoRef.current;
                const shouldBeMuted = isMuted;
                
                video.muted = shouldBeMuted;
                
                // If unmuting, ensure video is playing and audio is enabled
                if (!shouldBeMuted) {
                    // Double-check muted is false
                    video.muted = false;
                    
                    // Ensure video is playing
                    if (video.paused) {
                        video.play().catch(console.error);
                    }
                    
                    // Use a small delay to ensure the muted state is applied (capture current value)
                    const timeoutId = setTimeout(() => {
                        if (videoRef.current && videoRef.current.muted !== false) {
                            videoRef.current.muted = false;
                            if (videoRef.current.paused) {
                                videoRef.current.play().catch(console.error);
                            }
                        }
                    }, 100);
                    
                    return () => clearTimeout(timeoutId);
                }
            }
        }
    }, [originalPost, isMuted, viewingStories, currentGroupIndex, currentStoryIndex, storyGroups]);

    // Reset optimistic vote when story changes - MUST be before conditional returns
    React.useEffect(() => {
        setOptimisticVote(null);
    }, [currentStoryIndex, currentGroupIndex]);

    // Sort story groups: new (unviewed) stories first, then by latest (most recent) last
    const sortedGroups = React.useMemo(() => {
        return [...storyGroups].filter(group => group.stories && group.stories.length > 0).sort((a, b) => {
            // Check if groups have unviewed stories
            const aHasUnviewed = a.stories.some(s => !s.hasViewed);
            const bHasUnviewed = b.stories.some(s => !s.hasViewed);
            
            // Unviewed stories come first
            if (aHasUnviewed && !bHasUnviewed) return -1;
            if (!aHasUnviewed && bHasUnviewed) return 1;
            
            // Within same category (both unviewed or both viewed), sort by latest story
            // Most recent first for unviewed, most recent last for viewed
            const aLatest = a.stories.length > 0 ? Math.max(...a.stories.map(s => s.createdAt)) : 0;
            const bLatest = b.stories.length > 0 ? Math.max(...b.stories.map(s => s.createdAt)) : 0;
            
            if (aHasUnviewed && bHasUnviewed) {
                // Both unviewed: newest first
                return bLatest - aLatest;
            } else {
                // Both viewed: oldest first (newest last)
                return aLatest - bLatest;
            }
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
                                        // This block intentionally left for debugging
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
                                    
                                    if (currentStory?.sharedFromPost && !originalPost && !sharedPostFetchFailed) {
                                        // Loading state while fetching original post
                                        return (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                                            </div>
                                        );
                                    }
                                    
                                    // Fallback: shared post but fetch failed or post not found – show story's own media (video/image we stored when creating the story)
                                    if (currentStory?.sharedFromPost && !originalPost && sharedPostFetchFailed && currentStory.mediaUrl) {
                                        const isVideo = currentStory.mediaType === 'video';
                                        return (
                                            <div className="w-full h-full flex items-center justify-center bg-black">
                                                {isVideo ? (
                                                    <video
                                                        ref={videoRef}
                                                        src={currentStory.mediaUrl}
                                                        className="w-full h-full object-contain"
                                                        autoPlay
                                                        loop
                                                        muted={isMuted}
                                                        playsInline
                                                        onLoadedData={() => {
                                                            if (videoRef.current) {
                                                                videoRef.current.muted = isMuted;
                                                                if (!isMuted && videoRef.current.paused) {
                                                                    videoRef.current.play().catch(() => {});
                                                                }
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <img
                                                        src={currentStory.mediaUrl}
                                                        alt="Shared clip"
                                                        className="w-full h-full object-contain"
                                                    />
                                                )}
                                            </div>
                                        );
                                    }
                                    
                                    if (currentStory?.sharedFromPost && originalPost) {
                                        // This is a shared post - ALWAYS show the original post format, not the generated image
                                        // Check if it has media or is text-only
                                        const hasRealMedia = (originalPost.mediaUrl && originalPost.mediaUrl.trim() !== '' && !originalPost.mediaUrl.startsWith('data:image')) || (originalPost.mediaItems && originalPost.mediaItems.length > 0);
                                        
                                        if (hasRealMedia) {
                                            // Shared post with media - Instagram style: blurred background with centered card
                                            const mediaIsVideo = originalPost.mediaType === 'video' || originalPost.mediaItems?.[0]?.type === 'video';
                                            const mediaUrl = originalPost.mediaUrl || originalPost.mediaItems?.[0]?.url;
                                            
                                            return (
                                                <div
                                                    className="w-full h-full flex flex-col items-center justify-center relative p-6"
                                                    style={{
                                                        // Blurred background using the post image - this is the reclipper's story space
                                                        backgroundImage: `url(${mediaUrl})`,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                        backgroundRepeat: 'no-repeat'
                                                    }}
                                                >
                                                    {/* Blurred background overlay - creates the outer story frame */}
                                                    <div 
                                                        className="absolute inset-0"
                                                        style={{
                                                            backdropFilter: 'blur(25px)',
                                                            WebkitBackdropFilter: 'blur(25px)',
                                                            backgroundColor: 'rgba(0, 0, 0, 0.4)'
                                                        }}
                                                    />
                                                    
                                                    {/* Container for card and attribution - centered column */}
                                                    <div className="relative z-10 flex flex-col items-center">
                                                        {/* Nested story card - the original post embedded within (TikTok style) */}
                                                        <div 
                                                            className="relative w-full max-w-xs rounded-2xl overflow-hidden bg-white shadow-[0_8px_32px_rgba(0,0,0,0.4)] cursor-pointer transform transition-transform hover:scale-[1.02] active:scale-[0.98] border-2 border-white/20"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowSharedPostModal(true);
                                                            }}
                                                            style={{
                                                                maxHeight: '60vh',
                                                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                                                            }}
                                                        >
                                                            {mediaIsVideo ? (
                                                                <video
                                                                    ref={videoRef}
                                                                    src={mediaUrl}
                                                                    className="w-full h-auto object-cover"
                                                                    autoPlay
                                                                    loop
                                                                    muted={isMuted}
                                                                    playsInline
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setShowSharedPostModal(true);
                                                                    }}
                                                                    style={{
                                                                        display: 'block'
                                                                    }}
                                                                    onLoadedData={() => {
                                                                        if (videoRef.current) {
                                                                            const video = videoRef.current;
                                                                            video.muted = isMuted;
                                                                            if (!isMuted) {
                                                                                video.muted = false;
                                                                                if (video.paused) {
                                                                                    Promise
                                                                                        .resolve(video.play())
                                                                                        .catch(() => { /* ignore */ });
                                                                                }
                                                                            }
                                                                        }
                                                                    }}
                                                                    onCanPlay={() => {
                                                                        if (videoRef.current) {
                                                                            const video = videoRef.current;
                                                                            video.muted = isMuted;
                                                                            if (!isMuted) {
                                                                                video.muted = false;
                                                                                if (video.paused) {
                                                                                    video.play().catch(console.error);
                                                                                }
                                                                            }
                                                                        }
                                                                    }}
                                                                    onPlay={() => {
                                                                        if (videoRef.current && !isMuted) {
                                                                            videoRef.current.muted = false;
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <img
                                                                    src={mediaUrl}
                                                                    alt="Shared post"
                                                                    className="w-full h-auto object-cover"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setShowSharedPostModal(true);
                                                                    }}
                                                                    style={{
                                                                        display: 'block'
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                        
                                                        {/* Original creator attribution - centered directly below the card */}
                                                        <div 
                                                            className="mt-3 flex items-center justify-center"
                                                        >
                                                            <div 
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md cursor-pointer hover:bg-black/80 transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setViewingStories(false);
                                                                    setTimeout(() => {
                                                                        navigate(`/user/${encodeURIComponent(originalPost.userHandle)}`);
                                                                    }, 100);
                                                                }}
                                                            >
                                                                <span className="text-white text-sm font-semibold">
                                                                    @{originalPost.userHandle}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        } else if (originalPost.text) {
                                            // Display shared text-only post as a nested story card
                                            return (
                                                <div
                                                    className="w-full h-full flex flex-col items-center justify-center relative p-6"
                                                    style={{
                                                        backgroundColor: '#000000'
                                                    }}
                                                >
                                                    {/* Container for card and attribution - centered column */}
                                                    <div className="relative z-10 flex flex-col items-center">
                                                        {/* Nested story card - the original post embedded within (TikTok style) */}
                                                        <div 
                                                            className="relative w-full max-w-xs rounded-2xl overflow-hidden bg-white shadow-[0_8px_32px_rgba(0,0,0,0.4)] cursor-pointer transform transition-transform hover:scale-[1.02] active:scale-[0.98] border-2 border-white/20"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowSharedPostModal(true);
                                                            }}
                                                            style={{
                                                                maxHeight: '60vh',
                                                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
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

                                                        {/* Text Content */}
                                                        <div 
                                                            className="p-4 w-full overflow-hidden" 
                                                            style={{ 
                                                                maxWidth: '100%', 
                                                                boxSizing: 'border-box', 
                                                                backgroundColor: '#ffffff' 
                                                            }}
                                                        >
                                                            <div 
                                                                className="p-4 rounded-2xl bg-black overflow-hidden w-full" 
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
                                                        
                                                        {/* Original creator attribution - centered directly below the card */}
                                                        <div 
                                                            className="mt-3 flex items-center justify-center"
                                                        >
                                                            <div 
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md cursor-pointer hover:bg-black/80 transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setViewingStories(false);
                                                                    setTimeout(() => {
                                                                        navigate(`/user/${encodeURIComponent(originalPost.userHandle)}`);
                                                                    }, 100);
                                                                }}
                                                            >
                                                                <span className="text-white text-sm font-semibold">
                                                                    @{originalPost.userHandle}
                                                                </span>
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
                                                onLoadedData={() => {
                                                    // Ensure muted state is synced when video loads
                                                    if (videoRef.current) {
                                                        const video = videoRef.current;
                                                        video.muted = isMuted;
                                                        
                                                        // If unmuted, ensure video plays and audio is enabled
                                                        if (!isMuted) {
                                                            video.muted = false;
                                                            if (video.paused) {
                                                                video.play().catch(console.error);
                                                            }
                                                        }
                                                    }
                                                }}
                                                onCanPlay={() => {
                                                    // Sync muted state when video can play
                                                    if (videoRef.current) {
                                                        const video = videoRef.current;
                                                        video.muted = isMuted;
                                                        
                                                        // If unmuted, ensure video plays and audio is enabled
                                                        if (!isMuted) {
                                                            video.muted = false;
                                                            if (video.paused) {
                                                                video.play().catch(console.error);
                                                            }
                                                        }
                                                    }
                                                }}
                                                onPlay={() => {
                                                    // Ensure muted state is correct when video plays
                                                    if (videoRef.current && !isMuted) {
                                                        videoRef.current.muted = false;
                                                    }
                                                }}
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
                                                                    key={taggedUser.handle}
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

                                {/* Sticker Overlays for all stories (but never on re-shared posts from feed) */}
                                {currentStory?.stickers && currentStory.stickers.length > 0 && !currentStory?.sharedFromPost && (
                                    <>
                                        {currentStory.stickers.map((overlay) => {
                                            // Render question cards (special card style)
                                            if (overlay.isQuestionCard && overlay.textContent) {
                                                const lines = overlay.textContent.split('\n');
                                                const questionLine = lines.find(l => l.startsWith('Q:'));
                                                const answerLine = lines.find(l => l.startsWith('A:'));
                                                const question = questionLine?.replace('Q: ', '') || '';
                                                const answer = answerLine?.replace('A: ', '') || '';
                                                
                                                return (
                                                    <div
                                                        key={overlay.id}
                                                        className="absolute pointer-events-none"
                                                        style={{
                                                            left: `${overlay.x}%`,
                                                            top: `${overlay.y}%`,
                                                            transform: `translate(-50%, -50%) scale(${overlay.scale || 1}) rotate(${overlay.rotation}deg)`,
                                                            opacity: overlay.opacity,
                                                            zIndex: 20,
                                                            maxWidth: '85%'
                                                        }}
                                                    >
                                                        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border-2 border-purple-500">
                                                            <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Question:</p>
                                                            <p className="text-sm text-gray-900 mb-3 font-bold">{question}</p>
                                                            <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Answer:</p>
                                                            <p className="text-base text-gray-800 font-semibold">{answer}</p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            
                                            // Render link stickers (clickable)
                                            if (overlay.linkUrl && overlay.textContent) {
                                                const fontSize = overlay.fontSize === 'small' ? 'text-sm' :
                                                    overlay.fontSize === 'large' ? 'text-lg' : 'text-base';
                                                const scale = overlay.scale || 1;
                                                return (
                                                    <a
                                                        key={overlay.id}
                                                        href={overlay.linkUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="absolute pointer-events-auto cursor-pointer"
                                                        style={{
                                                            left: `${overlay.x}%`,
                                                            top: `${overlay.y}%`,
                                                            transform: `translate(-50%, -50%) scale(${scale}) rotate(${overlay.rotation}deg)`,
                                                            opacity: overlay.opacity,
                                                            zIndex: 20
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div
                                                            className={`font-bold text-center ${fontSize} px-3 py-2 rounded-lg bg-blue-500/90 backdrop-blur-sm border-2 border-white/50 hover:bg-blue-600 transition-colors flex items-center gap-1.5 justify-center shadow-lg`}
                                                            style={{
                                                                color: '#FFFFFF',
                                                                textShadow: '1px 1px 4px rgba(0,0,0,0.8)',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                                            </svg>
                                                            {overlay.textContent}
                                                        </div>
                                                    </a>
                                                );
                                            }
                                            
                                            // Render text stickers (text and location)
                                            if (overlay.textContent && !overlay.linkUrl) {
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

                                {/* Tagged Users Display for media stories */}
                                {currentStory?.taggedUsersPositions && currentStory.taggedUsersPositions.length > 0 && (
                                    <>
                                        {currentStory.taggedUsersPositions.map((taggedUser) => (
                                            <div
                                                key={taggedUser.handle}
                                                className="absolute"
                                                style={{
                                                    left: `${taggedUser.x}%`,
                                                    top: `${taggedUser.y}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    zIndex: 25,
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
                                                <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium hover:bg-white/30 transition-colors cursor-pointer border border-white/30"
                                                    style={{
                                                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                                                    }}
                                                >
                                                    @{taggedUser.handle}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Fallback: If no positions but taggedUsers array exists, show at bottom */}
                                {currentStory?.taggedUsers && currentStory.taggedUsers.length > 0 && (!currentStory.taggedUsersPositions || currentStory.taggedUsersPositions.length === 0) && (
                                    <div className="absolute bottom-20 left-0 right-0 flex flex-wrap items-center justify-center gap-2 px-6 z-20">
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
                                                className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium hover:bg-white/30 transition-colors border border-white/30"
                                                style={{
                                                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                                                }}
                                            >
                                                @{handle}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Poll Overlay */}
                                {(() => {
                                    try {
                                        if (!currentStory?.poll) return null;
                                        if (!currentStory.poll.question || !currentStory.poll.option1 || !currentStory.poll.option2 || (currentStory.poll.option3 && !currentStory.poll.option3.trim())) {
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
                                        className="absolute top-[60%] left-0 right-0 px-4 z-[80] pointer-events-auto transform -translate-y-1/2" 
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
                                            className="rounded-xl p-[1.5px] max-w-[14rem] mx-auto"
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
                                                className="backdrop-blur-md bg-white/95 rounded-xl p-3 shadow-xl"
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
                                            <p className="text-gray-900 font-semibold text-sm mb-2.5 text-center">
                                                {currentStory.poll.question || 'Poll Question'}
                                            </p>

                                            {/* Poll Options */}
                                            <div className="space-y-2">
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
                                                                const currentStoryId = currentStory?.id; // Preserve story ID to find it after refresh
                                                                
                                                                await voteOnPoll(currentStory.id, user.id, 'option1');
                                                                
                                                                // Refresh story data but preserve current position
                                                                // Use the same function that loaded initial stories
                                                                const followedUserHandles = await getFollowedUsers(user.id);
                                                                let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);
                                                                
                                                                // If current user's group is not in the list, fetch it separately (like initial load does)
                                                                const currentUserHandle = currentGroup?.userHandle;
                                                                if (currentUserHandle) {
                                                                    const currentUserGroupIndex = groups.findIndex(g => g.userHandle === currentUserHandle);
                                                                    if (currentUserGroupIndex === -1) {
                                                                        // Current user's group not found, fetch it separately
                                                                        const storyGroup = await fetchStoryGroupByHandle(currentUserHandle);
                                                                        if (storyGroup) {
                                                                            groups.push(storyGroup);
                                                                        }
                                                                    }
                                                                }
                                                                
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
                                                                // Try by userId first, then by userHandle as fallback
                                                                let sameUserGroupIndex = groups.findIndex(g => g.userId === currentUserId);
                                                                if (sameUserGroupIndex === -1 && currentUserHandle) {
                                                                    // Fallback: try finding by userHandle
                                                                    sameUserGroupIndex = groups.findIndex(g => g.userHandle === currentUserHandle);
                                                                }
                                                                
                                                                if (sameUserGroupIndex !== -1) {
                                                                    const sameUserGroup = groups[sameUserGroupIndex];
                                                                    
                                                                    // Preserve the original story order from current state
                                                                    setStoryGroups(prev => {
                                                                        const prevGroupIndex = prev.findIndex(g => g.userId === currentUserId || g.userHandle === currentUserHandle);
                                                                        if (prevGroupIndex !== -1) {
                                                                            const prevGroup = prev[prevGroupIndex];
                                                                            const prevStories = prevGroup.stories || [];
                                                                            
                                                                            // Create a map of refreshed stories by ID for quick lookup
                                                                            const refreshedStoriesMap = new Map(
                                                                                (sameUserGroup.stories || []).map(s => [s.id, s])
                                                                            );
                                                                            
                                                                            // Preserve original order, but update stories with refreshed data
                                                                            const preservedStories = prevStories.map(prevStory => {
                                                                                const refreshedStory = refreshedStoriesMap.get(prevStory.id);
                                                                                // Use refreshed story data if available, otherwise keep original
                                                                                return refreshedStory || prevStory;
                                                                            });
                                                                            
                                                                            // Add any new stories that weren't in the original (shouldn't happen, but just in case)
                                                                            const existingStoryIds = new Set(preservedStories.map(s => s.id));
                                                                            const newStories = (sameUserGroup.stories || []).filter(s => !existingStoryIds.has(s.id));
                                                                            
                                                                            // Find the current story index in preserved order
                                                                            let storyIndexToRestore = currentStoryIdx;
                                                                            if (currentStoryId) {
                                                                                const foundStoryIndex = preservedStories.findIndex(s => s.id === currentStoryId);
                                                                                if (foundStoryIndex !== -1) {
                                                                                    storyIndexToRestore = foundStoryIndex;
                                                                                }
                                                                            }
                                                                            
                                                                            // Update the group with preserved order but refreshed data
                                                                            // Use prev array to preserve group order, only update the specific group
                                                                            const updatedGroups = [...prev];
                                                                            if (prevGroupIndex !== -1) {
                                                                                updatedGroups[prevGroupIndex] = {
                                                                                    ...prevGroup,
                                                                                    ...sameUserGroup, // Keep refreshed group metadata
                                                                                    stories: [...preservedStories, ...newStories] // Preserve original story order
                                                                                };
                                                                            }
                                                                            
                                                                            // Restore position to same user and same story (by ID)
                                                                            setCurrentGroupIndex(prevGroupIndex !== -1 ? prevGroupIndex : sameUserGroupIndex);
                                                                            currentGroupIndexRef.current = prevGroupIndex !== -1 ? prevGroupIndex : sameUserGroupIndex;
                                                                            setCurrentStoryIndex(storyIndexToRestore);
                                                                            currentStoryIndexRef.current = storyIndexToRestore;
                                                                            
                                                                            return updatedGroups;
                                                                        }
                                                                        
                                                                        // Fallback: if prev group not found, use refreshed groups as-is
                                                                        return groups;
                                                                    });
                                                                } else {
                                                                    // If user not found, try to keep current position if still valid
                                                                    if (currentGroupIndex < groups.length && groups[currentGroupIndex]?.stories?.length > 0) {
                                                                        // Current index is still valid, keep it
                                                                        setStoryGroups(groups);
                                                                        const safeStoryIndex = Math.min(currentStoryIdx, groups[currentGroupIndex].stories.length - 1);
                                                                        setCurrentStoryIndex(safeStoryIndex);
                                                                        currentStoryIndexRef.current = safeStoryIndex;
                                                                    } else {
                                                                        // User's group not found and current position invalid - close viewer
                                                                        console.warn('User group not found after voting, closing viewer');
                                                                        setViewingStories(false);
                                                                        return;
                                                                    }
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
                                                    className={`w-full px-3 py-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                                                        optimisticVote === 'option1' || currentStory?.poll?.userVote === 'option1'
                                                            ? 'bg-blue-500 text-white border-blue-600'
                                                            : optimisticVote === 'option2' || currentStory?.poll?.userVote === 'option2'
                                                            ? 'bg-gray-200 text-gray-600'
                                                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                                    } ${(currentStory?.poll?.userVote !== undefined || optimisticVote !== null) ? 'cursor-default' : 'cursor-pointer'}`}
                                                    style={{
                                                        borderColor: optimisticVote === 'option1' || currentStory?.poll?.userVote === 'option1'
                                                            ? undefined
                                                            : 'black'
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs">{currentStory.poll.option1 || 'Option 1'}</span>
                                                        {currentStory.poll?.userVote !== undefined && (
                                                            <span className="text-[10px] font-medium">
                                                                {(() => {
                                                                    try {
                                                                        const votes1 = currentStory.poll?.votes1 || 0;
                                                                        const votes2 = currentStory.poll?.votes2 || 0;
                                                                        const votes3 = currentStory.poll?.votes3 || 0;
                                                                        const totalVotes = votes1 + votes2 + votes3;
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
                                                        <div className="mt-1.5 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 transition-all"
                                                                style={{
                                                                    width: `${(() => {
                                                                        const votes1 = currentStory.poll?.votes1 || 0;
                                                                        const votes2 = currentStory.poll?.votes2 || 0;
                                                                        const votes3 = currentStory.poll?.votes3 || 0;
                                                                        const totalVotes = votes1 + votes2 + votes3;
                                                                        if (totalVotes === 0) return 0;
                                                                        return ((votes1) / totalVotes) * 100;
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
                                                                const currentStoryId = currentStory?.id; // Preserve story ID to find it after refresh
                                                                
                                                                await voteOnPoll(currentStory.id, user.id, 'option2');
                                                                
                                                                // Refresh story data but preserve current position
                                                                // Use the same function that loaded initial stories
                                                                const followedUserHandles = await getFollowedUsers(user.id);
                                                                let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);
                                                                
                                                                // If current user's group is not in the list, fetch it separately (like initial load does)
                                                                const currentUserHandle = currentGroup?.userHandle;
                                                                if (currentUserHandle) {
                                                                    const currentUserGroupIndex = groups.findIndex(g => g.userHandle === currentUserHandle);
                                                                    if (currentUserGroupIndex === -1) {
                                                                        // Current user's group not found, fetch it separately
                                                                        const storyGroup = await fetchStoryGroupByHandle(currentUserHandle);
                                                                        if (storyGroup) {
                                                                            groups.push(storyGroup);
                                                                        }
                                                                    }
                                                                }
                                                                
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
                                                                // Try by userId first, then by userHandle as fallback
                                                                let sameUserGroupIndex = groups.findIndex(g => g.userId === currentUserId);
                                                                if (sameUserGroupIndex === -1 && currentUserHandle) {
                                                                    // Fallback: try finding by userHandle
                                                                    sameUserGroupIndex = groups.findIndex(g => g.userHandle === currentUserHandle);
                                                                }
                                                                
                                                                if (sameUserGroupIndex !== -1) {
                                                                    const sameUserGroup = groups[sameUserGroupIndex];
                                                                    
                                                                    // Preserve the original story order from current state
                                                                    setStoryGroups(prev => {
                                                                        const prevGroupIndex = prev.findIndex(g => g.userId === currentUserId || g.userHandle === currentUserHandle);
                                                                        if (prevGroupIndex !== -1) {
                                                                            const prevGroup = prev[prevGroupIndex];
                                                                            const prevStories = prevGroup.stories || [];
                                                                            
                                                                            // Create a map of refreshed stories by ID for quick lookup
                                                                            const refreshedStoriesMap = new Map(
                                                                                (sameUserGroup.stories || []).map(s => [s.id, s])
                                                                            );
                                                                            
                                                                            // Preserve original order, but update stories with refreshed data
                                                                            const preservedStories = prevStories.map(prevStory => {
                                                                                const refreshedStory = refreshedStoriesMap.get(prevStory.id);
                                                                                // Use refreshed story data if available, otherwise keep original
                                                                                return refreshedStory || prevStory;
                                                                            });
                                                                            
                                                                            // Add any new stories that weren't in the original (shouldn't happen, but just in case)
                                                                            const existingStoryIds = new Set(preservedStories.map(s => s.id));
                                                                            const newStories = (sameUserGroup.stories || []).filter(s => !existingStoryIds.has(s.id));
                                                                            
                                                                            // Find the current story index in preserved order
                                                                            let storyIndexToRestore = currentStoryIdx;
                                                                            if (currentStoryId) {
                                                                                const foundStoryIndex = preservedStories.findIndex(s => s.id === currentStoryId);
                                                                                if (foundStoryIndex !== -1) {
                                                                                    storyIndexToRestore = foundStoryIndex;
                                                                                }
                                                                            }
                                                                            
                                                                            // Update the group with preserved order but refreshed data
                                                                            // Use prev array to preserve group order, only update the specific group
                                                                            const updatedGroups = [...prev];
                                                                            if (prevGroupIndex !== -1) {
                                                                                updatedGroups[prevGroupIndex] = {
                                                                                    ...prevGroup,
                                                                                    ...sameUserGroup, // Keep refreshed group metadata
                                                                                    stories: [...preservedStories, ...newStories] // Preserve original story order
                                                                                };
                                                                            }
                                                                            
                                                                            // Restore position to same user and same story (by ID)
                                                                            setCurrentGroupIndex(prevGroupIndex !== -1 ? prevGroupIndex : sameUserGroupIndex);
                                                                            currentGroupIndexRef.current = prevGroupIndex !== -1 ? prevGroupIndex : sameUserGroupIndex;
                                                                            setCurrentStoryIndex(storyIndexToRestore);
                                                                            currentStoryIndexRef.current = storyIndexToRestore;
                                                                            
                                                                            return updatedGroups;
                                                                        }
                                                                        
                                                                        // Fallback: if prev group not found, use refreshed groups as-is
                                                                        return groups;
                                                                    });
                                                                } else {
                                                                    // If user not found, try to keep current position if still valid
                                                                    if (currentGroupIndex < groups.length && groups[currentGroupIndex]?.stories?.length > 0) {
                                                                        // Current index is still valid, keep it
                                                                        setStoryGroups(groups);
                                                                        const safeStoryIndex = Math.min(currentStoryIdx, groups[currentGroupIndex].stories.length - 1);
                                                                        setCurrentStoryIndex(safeStoryIndex);
                                                                        currentStoryIndexRef.current = safeStoryIndex;
                                                                    } else {
                                                                        // User's group not found and current position invalid - close viewer
                                                                        console.warn('User group not found after voting, closing viewer');
                                                                        setViewingStories(false);
                                                                        return;
                                                                    }
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
                                                    className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all border ${
                                                        optimisticVote === 'option2' || currentStory?.poll?.userVote === 'option2'
                                                            ? 'bg-blue-500 text-white border-blue-500'
                                                            : optimisticVote === 'option1' || currentStory?.poll?.userVote === 'option1'
                                                            ? 'bg-gray-200 text-gray-600 border-gray-300'
                                                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border-gray-300'
                                                    } ${(currentStory?.poll?.userVote !== undefined || optimisticVote !== null) ? 'cursor-default' : 'cursor-pointer'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                            <span className={`text-xs ${currentStory?.poll?.userVote !== undefined ? 'text-white' : 'text-gray-900'}`}>{currentStory.poll.option2 || 'Option 2'}</span>
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
                                                        <div className="mt-1.5 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 transition-all"
                                                                style={{
                                                                    width: `${(() => {
                                                                        const votes1 = currentStory.poll?.votes1 || 0;
                                                                        const votes2 = currentStory.poll?.votes2 || 0;
                                                                        const votes3 = currentStory.poll?.votes3 || 0;
                                                                        const totalVotes = votes1 + votes2 + votes3;
                                                                        if (totalVotes === 0) return 0;
                                                                        return ((votes2) / totalVotes) * 100;
                                                                    })()}%`
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </button>

                                                {/* Option 3 - Only show if it exists */}
                                                {currentStory.poll?.option3 && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            e.nativeEvent?.stopImmediatePropagation();
                                                            if (!user?.id || currentStory.poll?.userVote === 'option3') return false;
                                                            
                                                            setOptimisticVote('option3');
                                                            voteStartTimeRef.current = Date.now();
                                                            isVotingRef.current = true;
                                                            pausedRef.current = true;
                                                            setPaused(true);
                                                            if (nextStoryTimeoutRef.current !== null) {
                                                                clearTimeout(nextStoryTimeoutRef.current);
                                                                nextStoryTimeoutRef.current = null;
                                                            }
                                                            swipeStartXRef.current = null;
                                                            swipeStartYRef.current = null;
                                                            swipeStartedOnPollRef.current = true;
                                                            
                                                            requestAnimationFrame(async () => {
                                                                try {
                                                                    const currentUserId = currentGroup?.userId;
                                                                    const currentStoryIdx = currentStoryIndex;
                                                                    
                                                                    await voteOnPoll(currentStory.id, user.id, 'option3');
                                                                    
                                                                    const followedUserHandles = await getFollowedUsers(user.id);
                                                                    let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);
                                                                    
                                                                    const currentUserHandle = currentGroup?.userHandle;
                                                                    if (currentUserHandle) {
                                                                        const currentUserGroupIndex = groups.findIndex(g => g.userHandle === currentUserHandle);
                                                                        if (currentUserGroupIndex === -1) {
                                                                            const storyGroup = await fetchStoryGroupByHandle(currentUserHandle);
                                                                            if (storyGroup) {
                                                                                groups.push(storyGroup);
                                                                            }
                                                                        }
                                                                    }
                                                                    
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
                                                                    
                                                                    let sameUserGroupIndex = groups.findIndex(g => g.userId === currentUserId);
                                                                    if (sameUserGroupIndex === -1 && currentUserHandle) {
                                                                        sameUserGroupIndex = groups.findIndex(g => g.userHandle === currentUserHandle);
                                                                    }
                                                                    
                                                                    if (sameUserGroupIndex !== -1) {
                                                                        const sameUserGroup = groups[sameUserGroupIndex];
                                                                        const safeStoryIndex = Math.min(currentStoryIdx, sameUserGroup.stories.length - 1);
                                                                        setStoryGroups(groups);
                                                                        setCurrentGroupIndex(sameUserGroupIndex);
                                                                        currentGroupIndexRef.current = sameUserGroupIndex;
                                                                        setCurrentStoryIndex(safeStoryIndex);
                                                                        currentStoryIndexRef.current = safeStoryIndex;
                                                                    } else {
                                                                        if (currentGroupIndex < groups.length && groups[currentGroupIndex]?.stories?.length > 0) {
                                                                            setStoryGroups(groups);
                                                                            const safeStoryIndex = Math.min(currentStoryIdx, groups[currentGroupIndex].stories.length - 1);
                                                                            setCurrentStoryIndex(safeStoryIndex);
                                                                            currentStoryIndexRef.current = safeStoryIndex;
                                                                        } else {
                                                                            console.warn('User group not found after voting, closing viewer');
                                                                            setViewingStories(false);
                                                                            return;
                                                                        }
                                                                    }
                                                                    
                                                                    setOptimisticVote(null);
                                                                    isVotingRef.current = false;
                                                                    swipeStartXRef.current = null;
                                                                    swipeStartYRef.current = null;
                                                                    swipeStartedOnPollRef.current = false;
                                                                    setPaused(false);
                                                                    pausedRef.current = false;
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
                                                        className={`w-full px-3 py-2 rounded-lg font-semibold text-xs transition-all border-2 ${
                                                            optimisticVote === 'option3' || currentStory?.poll?.userVote === 'option3'
                                                                ? 'bg-blue-500 text-white border-blue-600'
                                                                : optimisticVote === 'option1' || currentStory?.poll?.userVote === 'option1' || optimisticVote === 'option2' || currentStory?.poll?.userVote === 'option2'
                                                                ? 'bg-gray-200 text-gray-600'
                                                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                                        } ${(currentStory?.poll?.userVote !== undefined || optimisticVote !== null) ? 'cursor-default' : 'cursor-pointer'}`}
                                                        style={{
                                                            borderColor: optimisticVote === 'option3' || currentStory?.poll?.userVote === 'option3'
                                                                ? undefined
                                                                : 'black'
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-xs ${currentStory?.poll?.userVote !== undefined ? 'text-white' : 'text-gray-900'}`}>{currentStory.poll.option3 || 'Option 3'}</span>
                                                            {currentStory.poll?.userVote !== undefined && (
                                                                <span className="text-[10px] text-white/80">
                                                                    {(() => {
                                                                        try {
                                                                            const votes1 = currentStory.poll?.votes1 || 0;
                                                                            const votes2 = currentStory.poll?.votes2 || 0;
                                                                            const votes3 = currentStory.poll?.votes3 || 0;
                                                                            const totalVotes = votes1 + votes2 + votes3;
                                                                            if (totalVotes === 0) return '0%';
                                                                            const percentage = Math.round((votes3 / totalVotes) * 100);
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
                                                                            const votes1 = currentStory.poll?.votes1 || 0;
                                                                            const votes2 = currentStory.poll?.votes2 || 0;
                                                                            const votes3 = currentStory.poll?.votes3 || 0;
                                                                            const totalVotes = votes1 + votes2 + votes3;
                                                                            if (totalVotes === 0) return 0;
                                                                            return ((currentStory.poll?.votes3 || 0) / totalVotes) * 100;
                                                                        })()}%`
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Vote count */}
                                            {currentStory.poll?.userVote !== undefined && (
                                                <p className="text-gray-600 text-[10px] text-center mt-2">
                                                    {(() => {
                                                        try {
                                                            const votes1 = currentStory.poll?.votes1 || 0;
                                                            const votes2 = currentStory.poll?.votes2 || 0;
                                                            const votes3 = currentStory.poll?.votes3 || 0;
                                                            return `${votes1 + votes2 + votes3} votes`;
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

                                {/* Question Overlay - Only show for viewers, never show responses publicly */}
                                {currentStory?.question && (
                                        <div 
                                            className="absolute top-[60%] left-0 right-0 px-4 z-[80] pointer-events-auto transform -translate-y-1/2"
                                            style={{ maxWidth: '100%' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                            }}
                                            onTouchStart={(e) => {
                                                e.stopPropagation();
                                            }}
                                        >
                                            <div 
                                                className="rounded-xl p-[1.5px] max-w-[14rem] mx-auto"
                                                style={{
                                                    background: 'linear-gradient(to right, rgba(255, 78, 203, 0.8), rgba(143, 91, 255, 0.8))'
                                                }}
                                            >
                                                <div className="backdrop-blur-md bg-white/95 rounded-xl p-3 shadow-xl">
                                                    {/* Question Prompt */}
                                                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-3 mb-3 text-center">
                                                        <p className="text-white font-semibold text-sm">{currentStory.question.prompt || 'Ask me anything'}</p>
                                                    </div>
                                                    
                                                    {/* Answer Button */}
                                                    <button
                                                        onClick={() => {
                                                            setShowQuestionAnswerModal(true);
                                                            setPaused(true);
                                                            pausedRef.current = true;
                                                        }}
                                                        className="w-full px-3 py-2 rounded-lg font-semibold text-xs transition-all border-2 bg-gray-100 text-gray-900 hover:bg-gray-200 cursor-pointer"
                                                        style={{
                                                            borderColor: 'black'
                                                        }}
                                                    >
                                                        Tap to answer
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                )}
                            </div>
                        </div>
                    </div>


                    {/* Header with user info - Instagram style */}
                    <div className="absolute top-3 left-0 right-0 px-4 z-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                                <div 
                                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (currentGroup?.userHandle) {
                                            setViewingStories(false);
                                            setTimeout(() => {
                                                navigate(`/user/${encodeURIComponent(currentGroup.userHandle)}`);
                                            }, 100);
                                        }
                                    }}
                                >
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
                                
                                {/* Follow/Following button */}
                                {currentGroup?.userHandle && user?.handle && currentGroup.userHandle !== user.handle && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!currentGroup?.userHandle || isFollowLoading || !user?.id) return;
                                            
                                            setIsFollowLoading(true);
                                            const handle = currentGroup.userHandle;
                                            
                                            try {
                                                const followedUsers = await getFollowedUsers(user.id);
                                                const isCurrentlyFollowing = followedUsers.includes(handle);
                                                const profilePrivate = isProfilePrivate(handle);
                                                
                                                // Private profile + trying to follow = request only, do not add to follow list
                                                if (profilePrivate && !isCurrentlyFollowing && user?.handle) {
                                                    createFollowRequest(user.handle, handle);
                                                    setFollowState(user.id, handle, false);
                                                    setIsFollowingStoryUser(false);
                                                    Swal.fire({
                                                        title: '',
                                                        html: '<p style="font-size: 12px; color: #6b7280; margin: 0 0 10px 0; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">Gazetteer says</p><p style="font-weight: 600; font-size: 1.1em; margin: 0 0 8px 0;">Follow Request Sent</p><p style="color:#262626;font-size:14px;">Your follow request has been sent. You will be notified when they accept.</p>',
                                                        confirmButtonText: 'OK',
                                                        confirmButtonColor: '#0095f6',
                                                        background: '#ffffff',
                                                        width: '360px'
                                                    });
                                                    return;
                                                }
                                                
                                                // Call API to toggle follow (handle encoding is done inside toggleFollow)
                                                console.log('Toggling follow for handle:', handle);
                                                const result = await toggleFollow(handle);
                                                console.log('Toggle follow result:', result);
                                                
                                                // Update state based on response
                                                if (result.status === 'unfollowed') {
                                                    setIsFollowingStoryUser(false);
                                                    showToast?.('Unfollowed');
                                                } else if (result.status === 'pending') {
                                                    setIsFollowingStoryUser(false);
                                                    Swal.fire({
                                                        title: 'Gazetteer says',
                                                        html: '<p style="font-weight: 600; font-size: 1.1em; margin: 0 0 8px 0;">Follow Request Sent</p><p style="margin: 0;">Your follow request has been sent.</p>',
                                                        icon: 'success',
                                                        timer: 2000,
                                                        showConfirmButton: false
                                                    });
                                                } else if (result.status === 'accepted' || result.following === true) {
                                                    setIsFollowingStoryUser(true);
                                                    showToast?.('Following');
                                                } else {
                                                    // Fallback: toggle based on current state if response is unclear
                                                    setIsFollowingStoryUser(!isCurrentlyFollowing);
                                                }
                                                
                                                // Refresh follow status to ensure accuracy
                                                setTimeout(async () => {
                                                    try {
                                                        const updatedFollowedUsers = await getFollowedUsers(user.id);
                                                        setIsFollowingStoryUser(updatedFollowedUsers.includes(handle));
                                                    } catch (refreshError) {
                                                        console.error('Error refreshing follow status:', refreshError);
                                                    }
                                                }, 500);
                                                
                                            } catch (error: any) {
                                                console.error('Error toggling follow:', error);
                                                
                                                // Check if it's a connection error
                                                const isConnectionError = 
                                                    error?.message === 'CONNECTION_REFUSED' ||
                                                    error?.name === 'ConnectionRefused' ||
                                                    error?.message?.includes('Failed to fetch') ||
                                                    error?.message?.includes('ERR_CONNECTION_REFUSED') ||
                                                    error?.message?.includes('NetworkError');
                                                
                                                if (isConnectionError) {
                                                    console.log('Backend not available, using local state fallback');
                                                    const userState = getState(user.id);
                                                    const wasFollowing = userState.follows[handle] === true;
                                                    const profilePrivate = isProfilePrivate(handle);
                                                    
                                                    // Private profile + trying to follow = request only, do not add to follow list
                                                    if (profilePrivate && !wasFollowing && user?.handle) {
                                                        createFollowRequest(user.handle, handle);
                                                        setFollowState(user.id, handle, false);
                                                        setIsFollowingStoryUser(false);
                                                        Swal.fire({
                                                            title: 'Gazetteer says',
                                                            html: '<p style="font-weight: 600; font-size: 1.1em; margin: 0 0 8px 0;">Follow Request Sent</p><p style="color:#262626;font-size:14px;">Your follow request has been sent. You will be notified when they accept.</p>',
                                                            confirmButtonText: 'OK',
                                                            confirmButtonColor: '#0095f6',
                                                            background: '#ffffff',
                                                            width: '360px'
                                                        });
                                                        return;
                                                    }
                                                    
                                                    try {
                                                        userState.follows[handle] = !wasFollowing;
                                                        const userPost = currentStory?.sharedFromPost ? originalPost : null;
                                                        if (userPost?.id) {
                                                            await toggleFollowForPost(user.id, userPost.id);
                                                        }
                                                        const newFollowingState = !wasFollowing;
                                                        setIsFollowingStoryUser(newFollowingState);
                                                        if (newFollowingState) {
                                                            showToast?.('Following');
                                                        } else {
                                                            showToast?.('Unfollowed');
                                                        }
                                                        window.dispatchEvent(new CustomEvent('followToggled', {
                                                            detail: { handle: handle, isFollowing: newFollowingState }
                                                        }));
                                                    } catch (fallbackError) {
                                                        console.error('Error in fallback follow toggle:', fallbackError);
                                                        showToast?.('Backend not available. Please start the backend server.');
                                                    }
                                                } else {
                                                    showToast?.('Failed to update follow status. Please try again.');
                                                }
                                            } finally {
                                                setIsFollowLoading(false);
                                            }
                                        }}
                                        disabled={isFollowLoading}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 ${
                                            isFollowingStoryUser
                                                ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30'
                                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                        }`}
                                    >
                                        {isFollowingStoryUser ? (
                                            <>
                                                <FiUserCheck className="w-3.5 h-3.5" />
                                                <span>Following</span>
                                            </>
                                        ) : (
                                            <>
                                                <FiUserPlus className="w-3.5 h-3.5" />
                                                <span>Follow</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                                <button
                                    onClick={closeStories}
                                className="pointer-events-auto p-2"
                                >
                                <FiX className="w-6 h-6 text-white" />
                                </button>
                        </div>
                    </div>

                    {/* Story Text - Only show for original stories (not feed re-shares),
                        and only if media is not a generated text image (data URL) */}
                    {currentStory?.text && !currentStory?.sharedFromPost && currentStory?.mediaUrl && !currentStory.mediaUrl.startsWith('data:image') && (
                        <div className="absolute bottom-32 left-0 right-0 px-4 z-[55] pointer-events-none">
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
                    <div className="absolute bottom-0 left-0 right-0 z-[60] px-2 pb-4">
                        <div className="flex items-center gap-1.5 max-w-md mx-auto" style={{ flexWrap: 'nowrap' }}>
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
                                className="flex-1 bg-white/10 rounded-full px-3 py-2 text-white placeholder-white/60 text-xs outline-none border-0 min-w-0"
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
                                className="p-1.5 flex-shrink-0"
                            >
                                {currentStory?.userReaction ? (
                                    <AiFillHeart className="w-5 h-5 text-red-500" />
                                ) : (
                                    <FiHeart className="w-5 h-5 text-white" />
                                )}
                            </button>

                            {/* Share Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setShowStoryShareModal(true);
                                }}
                                className="p-1.5 flex-shrink-0"
                            >
                                <FiSend className="w-5 h-5 text-white" />
                            </button>

                            {/* Mute/Unmute Button - ALWAYS VISIBLE */}
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    console.log('Mute button clicked, current isMuted:', isMuted);
                                    console.log('videoRef.current:', videoRef.current);
                                    
                                    // Find video element if ref is not set
                                    let video = videoRef.current;
                                    if (!video || video.tagName !== 'VIDEO') {
                                        // Try to find video in the DOM
                                        const videoElement = document.querySelector('video');
                                        if (videoElement) {
                                            video = videoElement as HTMLVideoElement;
                                            videoRef.current = video;
                                            setHasVideo(true);
                                        } else {
                                            console.log('No video element found');
                                            return;
                                        }
                                    }
                                    
                                    const newMuted = !isMuted;
                                    console.log('Setting muted to:', newMuted);
                                    
                                    // Update state first
                                    setIsMuted(newMuted);
                                    
                                    // Force update video muted state immediately
                                    video.muted = newMuted;
                                    console.log('Video muted property set to:', video.muted);
                                    
                                    // If unmuting, ensure video plays and audio is enabled
                                    if (!newMuted) {
                                        try {
                                            // Aggressively set muted to false multiple times
                                            video.muted = false;
                                            console.log('Force unmuted, video.muted is now:', video.muted);
                                            
                                            // Ensure video is playing
                                            if (video.paused) {
                                                console.log('Video was paused, playing now');
                                                await video.play();
                                            }
                                            
                                            // Triple-check muted state after play
                                            video.muted = false;
                                            console.log('After play, video.muted is:', video.muted);
                                            
                                            // Use multiple timeouts to ensure the muted state is applied
                                            setTimeout(() => {
                                                if (videoRef.current) {
                                                    videoRef.current.muted = false;
                                                    console.log('Timeout 1: video.muted set to false');
                                                }
                                            }, 50);
                                            
                                            setTimeout(() => {
                                                if (videoRef.current) {
                                                    videoRef.current.muted = false;
                                                    if (videoRef.current.paused) {
                                                        videoRef.current.play().catch(console.error);
                                                    }
                                                    console.log('Timeout 2: video.muted set to false');
                                                }
                                            }, 150);
                                        } catch (error) {
                                            console.error('Error unmuting video:', error);
                                        }
                                    }
                                }}
                                className="p-1.5 flex-shrink-0 bg-purple-600/80 rounded-full hover:bg-purple-600 transition-colors border border-white/50 shadow-lg"
                                style={{ 
                                    minWidth: '32px',
                                    minHeight: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                            >
                                {isMuted ? (
                                    <FiVolumeX className="w-5 h-5 text-white" />
                                ) : (
                                    <FiVolume2 className="w-5 h-5 text-white" />
                                )}
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

                {/* Response Detail Modal (for creator viewing responses) */}
                {selectedResponse && (
                    <div 
                        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => {
                            setSelectedResponse(null);
                            setPaused(false);
                            pausedRef.current = false;
                        }}
                    >
                        <div 
                            className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        name={selectedResponse.userHandle}
                                        src={getAvatarForHandle(selectedResponse.userHandle)}
                                        size="md"
                                    />
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                                            {selectedResponse.userHandle}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {timeAgo(selectedResponse.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedResponse(null);
                                        setPaused(false);
                                        pausedRef.current = false;
                                    }}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <FiX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </button>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                                <p className="text-gray-900 dark:text-gray-100">
                                    {selectedResponse.text}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    // Navigate to create story page with the response pre-filled
                                    setSelectedResponse(null);
                                    setPaused(false);
                                    pausedRef.current = false;
                                    navigate('/clip', {
                                        state: {
                                            replyToQuestion: {
                                                question: currentStory?.question?.prompt,
                                                response: selectedResponse.text,
                                                responderHandle: selectedResponse.userHandle
                                            }
                                        }
                                    });
                                }}
                                className="w-full py-3 rounded-xl bg-gradient-to-tr from-purple-500 via-pink-500 to-pink-600 text-white font-semibold hover:opacity-90 transition-opacity"
                            >
                                Reply in Story
                            </button>
                        </div>
                    </div>
                )}

                {/* Question Answer Modal */}
                {showQuestionAnswerModal && currentStory && currentStory.question && (
                    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => {
                        setShowQuestionAnswerModal(false);
                        setQuestionAnswer('');
                        setPaused(false);
                        pausedRef.current = false;
                    }}>
                        <div className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    {currentStory.question.prompt || 'Ask me anything'}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowQuestionAnswerModal(false);
                                        setQuestionAnswer('');
                                        setPaused(false);
                                        pausedRef.current = false;
                                    }}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <FiX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </button>
                            </div>
                            <textarea
                                value={questionAnswer}
                                onChange={(e) => setQuestionAnswer(e.target.value)}
                                placeholder="Type your answer..."
                                className="w-full h-24 p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                autoFocus
                                maxLength={200}
                            />
                            <div className="mt-4 flex items-center gap-3">
                                <button
                                    onClick={async () => {
                                        if (!questionAnswer.trim() || !user?.id || !user?.handle || !currentStory) return;
                                        
                                        try {
                                            await addQuestionAnswer(currentStory.id, user.id, user.handle, questionAnswer.trim());
                                            setShowQuestionAnswerModal(false);
                                            setQuestionAnswer('');
                                            setPaused(false);
                                            pausedRef.current = false;
                                            showToast('Answer sent!');
                                        } catch (error) {
                                            console.error('Error submitting answer:', error);
                                            showToast('Failed to send answer. Please try again.');
                                        }
                                    }}
                                    disabled={!questionAnswer.trim()}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                                >
                                    Send Answer
                                </button>
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
                            if (!fullPost || !user?.id || !user?.handle) return;
                            const handle = fullPost.userHandle;
                            const profilePrivate = isProfilePrivate(handle);
                            if (profilePrivate) {
                                createFollowRequest(user.handle, handle);
                                setFollowState(user.id, handle, false);
                                await Swal.fire({
                                    title: 'Gazetteer says',
                                    html: '<p style="font-weight: 600; font-size: 1.1em; margin: 0 0 8px 0;">Follow Request Sent</p><p style="color:#262626;font-size:14px;">Your follow request has been sent. You will be notified when they accept.</p>',
                                    confirmButtonText: 'OK',
                                    confirmButtonColor: '#0095f6',
                                    background: '#ffffff',
                                    width: '360px'
                                });
                                return false;
                            }
                            const userPost = fullPost.id ? await getPostById(fullPost.id) : null;
                            if (userPost) await toggleFollowForPost(user.id, fullPost.id);
                            return;
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

                {/* Shared Post Modal - Instagram style card popup */}
                {showSharedPostModal && originalPost && currentStory?.sharedFromPost && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => {
                            setShowSharedPostModal(false);
                        }}
                    >
                        <div
                            className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    View Original Post
                                </h3>
                                <button
                                    onClick={() => setShowSharedPostModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                >
                                    <FiX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </button>
                            </div>
                            
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    This story was shared from a post by <span className="font-semibold text-gray-900 dark:text-gray-100">{originalPost.userHandle}</span>
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowSharedPostModal(false);
                                        setFullPost(originalPost);
                                        setShowScenesModal(true);
                                    }}
                                    className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
                                >
                                    View Full Post
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSharedPostModal(false);
                                        setViewingStories(false);
                                        setTimeout(() => {
                                            navigate(`/user/${encodeURIComponent(originalPost.userHandle)}`);
                                        }, 100);
                                    }}
                                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    View Profile
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Story list UI
    return (
        <div className="min-h-screen bg-black text-white">
            {/* Sticky Header - pinned to top */}
            <div className="sticky top-0 z-40 bg-black pt-3 px-4 pb-3 border-b border-gray-800/50">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold text-white">Clips 24</h1>
                    <button
                        onClick={() => navigate('/feed')}
                        className="p-1.5 rounded-full hover:bg-gray-800 transition-colors"
                    >
                        <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Scrollable content area */}
            <div className="px-4 pt-8 pb-4">
            {loading ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
                        <div className="w-12 h-12 rounded-full bg-gray-950 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-white/30 rounded-full flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                        Loading clips...
                    </h3>
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-2">
                    {/* Gazetteer world highlights - always first for everyone */}
                    {(() => {
                        const gazetteerGroup = storyGroups.find(
                            g => g.userId === GAZETTEER_WORLD_USER_ID || g.userHandle === GAZETTEER_WORLD_HANDLE
                        );
                        if (!gazetteerGroup || !gazetteerGroup.stories || gazetteerGroup.stories.length === 0) return null;

                        const hasUnviewed = gazetteerGroup.stories.some(s => !s.hasViewed);

                        return (
                            <button
                                key="gazetteer-world-highlights"
                                onClick={() => startViewingStories(gazetteerGroup)}
                                className={`relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-900 group cursor-pointer border focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black ${
                                    hasUnviewed ? 'border-transparent' : 'border-gray-700'
                                }`}
                                style={
                                    hasUnviewed
                                        ? {
                                              background:
                                                  'linear-gradient(to right, rgb(16, 185, 129), rgb(59, 130, 246))',
                                              padding: '2px',
                                          }
                                        : {}
                                }
                            >
                                <div
                                    className={`relative w-full h-full rounded-lg overflow-hidden ${
                                        hasUnviewed ? 'bg-gray-900' : ''
                                    }`}
                                >
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/40 shadow-lg mb-3">
                                            <img
                                                src="/gazetteer logo 1/gazetteer logo 1.jpg"
                                                alt="Gazetteer World Highlights"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <p className="text-[11px] font-semibold text-white text-center px-2 leading-tight">
                                            Gazetteer@world highlights
                                        </p>
                                        <p className="mt-1 text-[9px] text-emerald-300 text-center px-3 leading-tight">
                                            World stories curated for everyone
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })()}

                    {/* Current user's card - always first after Gazetteer */}
                    {(() => {
                        // Always show user's card, even if not in sortedGroups
                        const currentUserGroup = sortedGroups.find(g => g.userId === user?.id || g.userHandle === user?.handle) 
                            || (user ? {
                                userId: user.id,
                                userHandle: user.handle || '',
                                name: user.name || user.handle || 'You',
                                avatarUrl: user.avatarUrl || null,
                                stories: []
                            } as StoryGroup : null);
                        const hasStories = currentUserGroup && currentUserGroup.stories && currentUserGroup.stories.length > 0;
                        
                        if (!user || !currentUserGroup) return null;
                        
                        // Extract location for current user
                        const userLocationMatch = user?.handle?.match(/@(.+)/);
                        const userLocation = userLocationMatch ? userLocationMatch[1] : '';
                        const userDisplayName = user?.handle?.split('@')[0] || '';
                        const getUserLocationColor = (loc: string): string => {
                            if (!loc) return 'rgb(140, 40, 255)';
                            let hash = 0;
                            for (let i = 0; i < loc.length; i++) {
                                hash = loc.charCodeAt(i) + ((hash << 5) - hash);
                            }
                            const hue = Math.abs(hash % 360);
                            const saturation = 65 + (Math.abs(hash) % 20);
                            const lightness = 50 + (Math.abs(hash) % 15);
                            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                        };
                        const userLocationColor = getUserLocationColor(userLocation || user?.handle || '');
                        
                        return (
                            <button
                                key="current-user-card"
                                onClick={() => {
                                    if (hasStories && currentUserGroup) {
                                        startViewingStories(currentUserGroup);
                                    } else {
                                        navigate('/clip');
                                    }
                                }}
                                className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-800 group cursor-pointer border border-gray-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
                            >
                                <div className="relative w-full h-full rounded-lg overflow-hidden bg-gray-800">
                                    {hasStories && currentUserGroup ? (
                                        <>
                                            {/* Show latest story thumbnail if user has stories */}
                                            <div className="absolute inset-0">
                                                {(() => {
                                                    const latestStory = currentUserGroup.stories.reduce((latest, current) =>
                                                        current.createdAt > latest.createdAt ? current : latest
                                                    );
                                                    // Use the same StoryThumbnail component logic
                                                    const thumbnailUrl = latestStory.mediaUrl;
                                                    if (thumbnailUrl) {
                                                        return latestStory.mediaType === 'video' ? (
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
                                                                alt="Your clip"
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        );
                                                    } else if (latestStory.text) {
                                                        return (
                                                            <div
                                                                className="w-full h-full flex items-center justify-center p-4"
                                                                style={{
                                                                    background: latestStory.textStyle?.background || '#1a1a1a'
                                                                }}
                                                            >
                                                                <div
                                                                    className="text-xs leading-relaxed whitespace-pre-wrap font-normal text-center line-clamp-4"
                                                                    style={{
                                                                        color: latestStory.textStyle?.color || '#ffffff'
                                                                    }}
                                                                >
                                                                    {latestStory.text}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            {/* Profile picture overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                                <div 
                                                    className="relative w-16 h-16 rounded-full overflow-hidden border-4 shadow-lg"
                                                    style={{
                                                        borderColor: userLocationColor,
                                                        boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)`
                                                    }}
                                                >
                                                    {user?.avatarUrl ? (
                                                        <img
                                                            src={user.avatarUrl}
                                                            alt={user.handle || 'You'}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div 
                                                            className="w-full h-full flex items-center justify-center"
                                                            style={{ backgroundColor: userLocationColor + '40' }}
                                                        >
                                                            <span className="text-xl text-white font-bold">
                                                                {userDisplayName.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Add card - no stories */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
                                                {/* Profile picture */}
                                                <div className="relative mb-3">
                                                    <div 
                                                        className="relative w-10 h-10 rounded-full overflow-hidden border-2 shadow-lg"
                                                        style={{
                                                            borderColor: userLocationColor,
                                                            boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)`
                                                        }}
                                                    >
                                                        {user?.avatarUrl ? (
                                                            <img
                                                                src={user.avatarUrl}
                                                                alt={user.handle || 'You'}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div 
                                                                className="w-full h-full flex items-center justify-center"
                                                                style={{ backgroundColor: userLocationColor + '40' }}
                                                            >
                                                                <span className="text-sm text-white font-bold">
                                                                    {userDisplayName.charAt(0).toUpperCase()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Plus icon in center */}
                                                <div className="relative w-10 h-10 rounded-full bg-green-500 border-2 border-gray-800 flex items-center justify-center shadow-lg">
                                                    <FiPlus className="w-5 h-5 text-white font-bold" />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    
                                    {/* Username at bottom */}
                                    <div className={`absolute bottom-0 left-0 right-0 rounded-b-lg z-20 ${
                                        hasStories 
                                            ? 'p-2 bg-gradient-to-t from-black/90 via-black/70 to-transparent' 
                                            : 'p-1.5 bg-gradient-to-t from-black/60 via-black/40 to-transparent'
                                    }`}>
                                        <p className="text-white text-[10px] font-medium text-center truncate leading-tight">
                                            {user?.handle || 'You'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })()}
                    
                    {/* Other users' story cards */}
                    {sortedGroups
                        .filter(
                            group =>
                                group.userId !== user?.id &&
                                group.userHandle !== user?.handle &&
                                group.userId !== GAZETTEER_WORLD_USER_ID &&
                                group.userHandle !== GAZETTEER_WORLD_HANDLE
                        )
                        .map((group) => {
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
                                    // Shared text-only post - show compact preview without header
                                    return (
                                        <div className="w-full h-full flex items-center justify-center p-2 bg-black">
                                            <div className="w-full max-w-full rounded-lg overflow-hidden bg-white border border-gray-200 shadow-lg">
                                                {/* Text Content - compact style without header */}
                                                <div className="p-2 bg-white">
                                                    <div className="p-2 rounded bg-black">
                                                        <div className="text-[9px] leading-tight text-white line-clamp-5 whitespace-pre-wrap break-words">
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
        </div>
    );
}

