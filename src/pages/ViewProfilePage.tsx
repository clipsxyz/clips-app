import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronLeft, FiBell, FiShare2, FiMessageSquare, FiMoreHorizontal, FiX, FiLock, FiMapPin, FiEye, FiUserPlus, FiMaximize, FiPlay } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { getFlagForHandle } from '../api/users';
import Flag from '../components/Flag';
import { useAuth } from '../context/Auth';
import { fetchPostsPage, toggleFollowForPost, getFollowedUsers, setFollowState, posts as allPosts } from '../api/posts';
import { userHasStoriesByHandle, userHasUnviewedStoriesByHandle } from '../api/stories';
import { fetchUserProfile, toggleFollow } from '../api/client';
import type { Post } from '../types';
import { 
  isProfilePrivate, 
  canViewProfile, 
  canSendMessage, 
  hasPendingFollowRequest,
  createFollowRequest,
  removeFollowRequest
} from '../api/privacy';
import Swal from 'sweetalert2';
import ShareProfileModal from '../components/ShareProfileModal';
import { getStableUserId } from '../utils/userId';
import { followRequestSentBottomSheet, accountIsPrivateBottomSheet, bottomSheet } from '../utils/swalBottomSheet';

/** Parse place names from bio text. Splits on comma, semicolon, newline, "and", " - ", ":", ". " */
function parsePlacesFromBio(bio: string): string[] {
    if (!bio || typeof bio !== 'string') return [];
    const parts = bio
        .split(/[,;\n.]|\s+and\s+|\s*[-–—]\s*|:\s*/i)
        .map((p) => p.trim())
        .filter((p) => p.length >= 2);
    if (parts.length === 0 && bio.trim().length >= 2) return [bio.trim()];
    return [...new Set(parts)];
}

/** Resolve places for the location icon. Uses Travel Info lists first, then parses BOTH profile and auth bios so "places in my bio" always counts. */
function getEffectivePlacesTraveled(profileUser: any, authUser: any): string[] {
    const fromProfileList = Array.isArray(profileUser?.placesTraveled) && profileUser.placesTraveled.length > 0
        ? profileUser.placesTraveled
        : [];
    if (fromProfileList.length > 0) return fromProfileList;

    const fromAuthList = Array.isArray(authUser?.placesTraveled) && authUser.placesTraveled.length > 0
        ? authUser.placesTraveled
        : [];
    if (fromAuthList.length > 0) return fromAuthList;

    // Always parse BOTH bios so we never miss "places in my bio" (Auth user or profile)
    const profileBio = typeof profileUser?.bio === 'string' ? profileUser.bio : '';
    const authBio = typeof authUser?.bio === 'string' ? authUser.bio : '';
    const fromProfileBio = parsePlacesFromBio(profileBio);
    const fromAuthBio = parsePlacesFromBio(authBio);
    const merged = [...fromProfileBio, ...fromAuthBio];
    const deduped = [...new Set(merged)];
    return deduped;
}

/** Get effective places with localStorage fallback so we never miss bio or Travel Info saved in Profile. */
function getEffectivePlacesWithStorageFallback(profileUser: any, authUser: any): string[] {
    let places = getEffectivePlacesTraveled(profileUser, authUser);
    if (places.length > 0) return places;
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return [];
        const u = JSON.parse(raw);
        const storedList = Array.isArray(u?.placesTraveled) && u.placesTraveled.length > 0 ? u.placesTraveled : [];
        if (storedList.length > 0) return storedList;
        const bio = typeof u?.bio === 'string' ? (u.bio as string).trim() : '';
        if (bio) {
            const fromBio = parsePlacesFromBio(bio);
            if (fromBio.length > 0) return fromBio;
            const commaSplit = bio.split(',').map((s: string) => s.trim()).filter(Boolean);
            if (commaSplit.length > 0) return commaSplit;
        }
    } catch (_) {}
    return [];
}

export default function ViewProfilePage() {
    const navigate = useNavigate();
    const { handle } = useParams<{ handle: string }>();
    const { user } = useAuth();
    const [profileUser, setProfileUser] = React.useState<any>(null);
    const [posts, setPosts] = React.useState<Post[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [stats, setStats] = React.useState({ following: 0, followers: 0, likes: 0, views: 0 });
    const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);
    const [hasStory, setHasStory] = React.useState(false);
    const [canViewProfileState, setCanViewProfileState] = React.useState(true);
    const [hasPendingRequest, setHasPendingRequest] = React.useState(false);
    const [profileIsPrivate, setProfileIsPrivate] = React.useState(false);
    const [showTraveledModal, setShowTraveledModal] = React.useState(false);
    const [placesForTravelModal, setPlacesForTravelModal] = React.useState<string[]>([]);
    const [showProfileMenu, setShowProfileMenu] = React.useState(false);
    const [showQRCodeModal, setShowQRCodeModal] = React.useState(false);
    const [showShareProfileModal, setShowShareProfileModal] = React.useState(false);

    const handleFollow = async () => {
        if (!user?.id || !handle) {
            console.error('Missing required data for follow:', { userId: user?.id, handle });
            Swal.fire(bottomSheet({ title: 'Error', message: 'Unable to follow user. Please try again.', icon: 'alert' }));
            return;
        }
        if (!user?.handle && isProfilePrivate(decodeURIComponent(handle))) {
            Swal.fire(bottomSheet({ title: 'Error', message: 'Unable to send follow request. Please sign in with a full profile.', icon: 'alert' }));
            return;
        }
        
        // Decode the handle from URL (in case it was encoded).
        // Use canonical handle from profile when available so API and follow state stay in sync (e.g. Bob@Cork vs bob@cork).
        const decodedHandle = decodeURIComponent(handle);
        const handleToUse = profileUser?.handle || decodedHandle;

        // Capture state at click time so mock path doesn't flip action after optimistic update
        const wasFollowingBeforeClick = isFollowing;
        const profilePrivate = isProfilePrivate(decodedHandle);

        // Use same key as Stories/Scenes (user.id) so follow state is shared; fallback to getStableUserId when id missing
        const followUserId = user?.id != null ? String(user.id) : getStableUserId(user);
        const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';

        // Mock-only: update state immediately and return (no API, no await) – same pattern as Stories so Follow always works
        if (!useLaravelApi) {
            const newFollowing = !wasFollowingBeforeClick;
            if (profilePrivate && newFollowing && user?.handle) {
                createFollowRequest(user.handle, handleToUse);
                setHasPendingRequest(true);
                setIsFollowing(false);
                setFollowState(followUserId, handleToUse, false);
                try {
                    const { createNotification } = await import('../api/notifications');
                    await createNotification({ type: 'follow_request', fromHandle: user.handle, toHandle: decodedHandle, message: `${user.handle} wants to follow you` });
                } catch (_) {}
                Swal.fire(followRequestSentBottomSheet());
            } else {
                setFollowState(followUserId, handleToUse, newFollowing);
                setIsFollowing(newFollowing);
                setHasPendingRequest(false);
                if (!newFollowing) {
                    setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
                    if (profileUser) setProfileUser((prev: any) => ({ ...prev, stats: { ...prev.stats, followers: Math.max(0, (prev.stats?.followers || 0) - 1) } }));
                } else {
                    setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
                    if (profileUser) setProfileUser((prev: any) => ({ ...prev, stats: { ...prev.stats, followers: (prev.stats?.followers || 0) + 1 } }));
                }
                if (profilePrivate) setCanViewProfileState(newFollowing);
            }
            window.dispatchEvent(new CustomEvent('followToggled', { detail: { handle: handleToUse, isFollowing: profilePrivate && newFollowing ? false : newFollowing } }));
            return;
        }

        // Optimistic update when using Laravel API
        if (!wasFollowingBeforeClick && !profilePrivate) {
            setIsFollowing(true);
            setFollowState(followUserId, handleToUse, true);
            setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
            if (profileUser) {
                setProfileUser((prev: any) => ({
                    ...prev,
                    stats: {
                        ...prev.stats,
                        followers: (prev.stats?.followers || 0) + 1
                    }
                }));
            }
        }

        try {
            const followedUsers = await getFollowedUsers(followUserId);
            const isCurrentlyFollowing = followedUsers.some(h => h.toLowerCase() === handleToUse.toLowerCase());
            const hasPending = hasPendingFollowRequest(user?.handle || '', decodedHandle);

            let result;
            let useMockFallback = false;
            try {
                console.log('Calling toggleFollow with decoded handle:', decodedHandle);
                result = await toggleFollow(decodedHandle);
                console.log('Toggle follow result:', result);
            } catch (apiError: any) {
                // Check if it's a connection error (backend not running)
                const isConnectionError = 
                    apiError?.message === 'CONNECTION_REFUSED' ||
                    apiError?.name === 'ConnectionRefused' ||
                    apiError?.message?.includes('Failed to fetch') ||
                    apiError?.message?.includes('ERR_CONNECTION_REFUSED') ||
                    apiError?.message?.includes('NetworkError');
                
                if (isConnectionError) {
                    console.log('Backend not available, using mock fallback');
                    useMockFallback = true;
                    
                    const newFollowingState = !isCurrentlyFollowing;
                    
                    // Private profile + trying to follow = send request only. Do NOT add to follow list.
                    // User only becomes "following" after Sarah accepts.
                    if (profilePrivate && newFollowingState && !isCurrentlyFollowing && user?.handle) {
                        createFollowRequest(user.handle, handleToUse);
                        setHasPendingRequest(true);
                        setIsFollowing(false);
                        setFollowState(followUserId, handleToUse, false); // never add to follow list until accepted
                        
                        try {
                            const { createNotification } = await import('../api/notifications');
                            await createNotification({
                                type: 'follow_request',
                                fromHandle: user.handle,
                                toHandle: decodedHandle,
                                message: `${user.handle} wants to follow you`
                            });
                        } catch (error) {
                            console.warn('Failed to create follow request notification:', error);
                        }
                        
                        Swal.fire(followRequestSentBottomSheet());
                        return;
                    }
                    
                    // Normal follow/unfollow (public, or unfollow): update post state and shared follow state
                    if (posts[0]?.id) {
                        await toggleFollowForPost(followUserId, posts[0].id);
                    } else {
                        const userPost = allPosts.find(p => p.userHandle?.toLowerCase() === handleToUse.toLowerCase());
                        if (userPost) {
                            await toggleFollowForPost(followUserId, userPost.id);
                        }
                    }
                    setFollowState(followUserId, handleToUse, newFollowingState);
                    
                    setIsFollowing(newFollowingState);
                    setHasPendingRequest(false);
                    
                    if (newFollowingState) {
                        setCanViewProfileState(true);
                    } else if (profilePrivate) {
                        setCanViewProfileState(false);
                    }
                    
                    // Dispatch event to update newsfeed
                    window.dispatchEvent(new CustomEvent('followToggled', {
                        detail: { handle: handleToUse, isFollowing: newFollowingState }
                    }));
                    
                    // Update stats optimistically when using mock fallback
                    // Increment/decrement followers count based on follow state
                    if (newFollowingState) {
                        // User just followed - increment Bob's follower count
                        setStats(prev => ({
                            ...prev,
                            followers: prev.followers + 1
                        }));
                        if (profileUser) {
                            setProfileUser((prev: any) => ({
                                ...prev,
                                stats: {
                                    ...prev.stats,
                                    followers: (prev.stats?.followers || 0) + 1
                                }
                            }));
                        }
                    } else {
                        // User just unfollowed - decrement Bob's follower count
                        setStats(prev => ({
                            ...prev,
                            followers: Math.max(0, prev.followers - 1)
                        }));
                        if (profileUser) {
                            setProfileUser((prev: any) => ({
                                ...prev,
                                stats: {
                                    ...prev.stats,
                                    followers: Math.max(0, (prev.stats?.followers || 0) - 1)
                                }
                            }));
                        }
                    }
                    
                    return; // Exit early since we handled it with mock
                } else {
                    // Re-throw if it's a different error
                    throw apiError;
                }
            }
            
            // Continue with API result handling if we got here
            
            // Use the API response to determine the new state.
            // Backend is expected to return a status of 'unfollowed', 'pending', or 'accepted',
            // but we also handle a generic "following: true/false" shape.
            if (result.status === 'unfollowed') {
                // Unfollow
                // Also update local state for consistency
                if (posts[0]?.id) {
                    await toggleFollowForPost(followUserId, posts[0].id);
                }
                setIsFollowing(false);
                setFollowState(followUserId, handleToUse, false);
                setHasPendingRequest(false);
                removeFollowRequest(user.handle, handleToUse);
                
                // If profile was private, user can no longer view
                if (profilePrivate) {
                    setCanViewProfileState(false);
                }
            } else if (result.status === 'pending') {
                // Private profile - follow request sent (only if not already pending)
                if (!hasPending && user?.handle) {
                    createFollowRequest(user.handle, handleToUse);
                    setHasPendingRequest(true);
                setIsFollowing(false);
                    
                    // Create notification for the recipient
                    try {
                        const { createNotification } = await import('../api/notifications');
                        await createNotification({
                            type: 'follow_request',
                            fromHandle: user.handle,
                            toHandle: handleToUse,
                            message: `${user.handle} wants to follow you`
                        });
                    } catch (error) {
                        console.warn('Failed to create follow request notification:', error);
                    }
                    
                    Swal.fire(followRequestSentBottomSheet());
                }
            } else if (result.status === 'accepted' || result.following === true) {
                // Public profile - follow immediately
                // Also update local state for consistency
                if (posts[0]?.id) {
                    await toggleFollowForPost(followUserId, posts[0].id);
                }
                setIsFollowing(true);
                setFollowState(followUserId, decodedHandle, true);
                setHasPendingRequest(false);
                setCanViewProfileState(true);
            } else {
                // Fallback: if backend returned an unexpected shape,
                // optimistically toggle follow state so the UI still updates.
                console.warn('toggleFollow: unexpected response shape, applying optimistic toggle', result);
                const newFollowingState = !isCurrentlyFollowing;
                setIsFollowing(newFollowingState);
                setHasPendingRequest(false);
                setFollowState(followUserId, decodedHandle, newFollowingState);
                if (newFollowingState && profilePrivate) {
                    setCanViewProfileState(true);
                } else if (!newFollowingState && profilePrivate) {
                    setCanViewProfileState(false);
                }
            }

            // Dispatch event to update newsfeed
            window.dispatchEvent(new CustomEvent('followToggled', {
                detail: { handle: handleToUse, isFollowing: !isCurrentlyFollowing }
            }));

            // Refresh profile counts in background (don't block UI)
            fetchUserProfile(handleToUse, user?.id).then((userProfileData) => {
                const followingCount = userProfileData.following_count || 0;
                const followersCount = userProfileData.followers_count || 0;
                setStats(prev => ({ ...prev, following: followingCount, followers: followersCount }));
                if (profileUser) {
                    setProfileUser((prev: any) => ({
                        ...prev,
                        stats: { ...prev.stats, following: followingCount, followers: followersCount }
                    }));
                }
            }).catch((error) => {
                console.error('Error refreshing profile counts:', error);
            });
        } catch (error: any) {
            console.error('Error toggling follow:', error);

            // Revert optimistic update only when we had set "Following" and the API then failed
            if (!profilePrivate && isFollowing) {
                setIsFollowing(false);
                setFollowState(followUserId, handleToUse, false);
                setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
                if (profileUser) {
                    setProfileUser((prev: any) => ({
                        ...prev,
                        stats: { ...prev.stats, followers: Math.max(0, (prev.stats?.followers || 0) - 1) }
                    }));
                }
            }
            
            // Check if it's a connection error (backend not running)
            const isConnectionError = 
                error?.message === 'CONNECTION_REFUSED' ||
                error?.name === 'ConnectionRefused' ||
                error?.message?.includes('Failed to fetch') ||
                error?.message?.includes('ERR_CONNECTION_REFUSED') ||
                error?.message?.includes('NetworkError');
            
            if (isConnectionError) {
                Swal.fire(bottomSheet({
                    title: 'Backend Server Not Running',
                    html: `<p class="swal-bottom-sheet-message">The Laravel backend server is not running. To enable the follow feature: Open a terminal, navigate to <code>laravel-backend</code>, and run <code>php artisan serve</code>.</p>`,
                    icon: 'alert',
                    confirmButtonText: 'OK',
                }));
            } else {
                Swal.fire(bottomSheet({ title: 'Error', message: error?.message || 'Failed to follow user. Please try again.', icon: 'alert' }));
            }
        }
    };

    React.useEffect(() => {
        const loadProfile = async () => {
            if (!handle) return;

            // Decode the handle from URL (in case it was encoded)
            const decodedHandle = decodeURIComponent(handle);
            setLoading(true);
            try {
                // Check privacy using localStorage
                const profilePrivate = isProfilePrivate(decodedHandle);
                setProfileIsPrivate(profilePrivate);
                
                if (user?.id && user?.handle) {
                    const followUserId = user.id != null ? String(user.id) : getStableUserId(user);
                    const followedUsers = await getFollowedUsers(followUserId);
                    const canView = canViewProfile(user?.handle || '', decodedHandle, followedUsers);
                    const isFollowingUser = followedUsers.some(h => h.toLowerCase() === decodedHandle.toLowerCase());
                    const hasPending = hasPendingFollowRequest(user?.handle || '', decodedHandle);
                    
                    // Base values from follow list
                    let effectiveCanView = canView;
                    let effectiveIsFollowing = isFollowingUser;

                    // If profile is private and there is a pending request but not actually following,
                    // treat this as "request sent, waiting" – user cannot view yet and is not following.
                    if (profilePrivate && hasPending && !isFollowingUser) {
                        effectiveCanView = false;
                        effectiveIsFollowing = false;
                    }

                    setCanViewProfileState(effectiveCanView);
                    setIsFollowing(effectiveIsFollowing);
                    setHasPendingRequest(hasPending);
                    
                    // Show SweetAlert if profile is private and user can't view (same bottom-sheet style as Follow Request Sent)
                    if (!canView && profilePrivate && decodedHandle !== user.handle) {
                        Swal.fire(accountIsPrivateBottomSheet()).then(async (result) => {
                            // Only create follow request if user explicitly clicked "Follow"
                            // If they clicked "Cancel" (result.isDismissed or !result.isConfirmed), do nothing
                            if (result.isConfirmed && user?.id) {
                                try {
                                    await handleFollow();
                                } catch (error) {
                                    console.error('Error following user:', error);
                                }
                            } else {
                                // User clicked Cancel - ensure no follow request is created
                                // If there's a stale pending request, we should NOT remove it here
                                // because the user might have created it from a different place (like the + icon)
                                // We'll just log it for debugging
                                const hasPending = hasPendingFollowRequest(user?.handle || '', decodedHandle);
                                if (hasPending) {
                                    console.log('Note: There is a pending follow request from a previous interaction. User clicked Cancel, so no new request was created. The existing pending request remains.');
                                } else {
                                    console.log('User cancelled follow request - no action taken, no pending request exists');
                                }
                            }
                        });
                        
                        setLoading(false);
                        return;
                    }
                }

                // Fetch posts by userHandle - check posts array first (instant, no API calls)
                // This is much faster than fetching from multiple tabs
                let userPosts: Post[] = [];
                
                // First, check the exported posts array directly (instant, no delays)
                if (allPosts && allPosts.length > 0) {
                    userPosts = allPosts.filter(post => post.userHandle === decodedHandle);
                }
                
                // If we found posts, we're done. Otherwise, try fetching from tabs as fallback
                // (This should rarely be needed since posts array should have all posts)
                if (userPosts.length === 0) {
                    const allTabs = ['finglas', 'dublin', 'ireland'];
                    // Fetch from tabs in parallel for better performance
                    const tabPromises = allTabs.map(async (tab) => {
                        try {
                            const page = await fetchPostsPage(tab, null, 100, user?.id || 'me', user?.local || '', user?.regional || '', user?.national || '');
                            return page.items.filter(post => post.userHandle === decodedHandle);
                        } catch (error) {
                            return [];
                        }
                    });
                    
                    const tabResults = await Promise.all(tabPromises);
                    userPosts = tabResults.flat();
                }

                // Remove duplicates by post ID
                const uniquePosts = userPosts.filter((post, index, self) =>
                    index === self.findIndex(p => p.id === post.id)
                );

                // Try to get avatar from user object if viewing own profile, otherwise use placeholder
                let avatarUrl = decodedHandle === user?.handle ? user?.avatarUrl : undefined;

                // Try to get avatar from avatar mapping
                if (!avatarUrl) {
                    const { getAvatarForHandle } = await import('../api/users');
                    avatarUrl = getAvatarForHandle(decodedHandle);
                }

                // Mock profile picture for Sarah@Artane
                if (decodedHandle === 'Sarah@Artane') {
                    avatarUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop';
                }

                // Get bio, social links, and placesTraveled if viewing own profile
                let bio = decodedHandle === user?.handle ? user?.bio : undefined;
                let socialLinks = decodedHandle === user?.handle ? user?.socialLinks : undefined;
                let placesTraveled = decodedHandle === user?.handle ? user?.placesTraveled : undefined;
                
                // Debug: Log placesTraveled from user
                if (decodedHandle === user?.handle) {
                    console.log('Viewing own profile - user handle:', user?.handle, 'decodedHandle:', decodedHandle);
                    console.log('Viewing own profile, placesTraveled from user:', user?.placesTraveled);
                    console.log('Is array?', Array.isArray(user?.placesTraveled));
                    console.log('Length:', Array.isArray(user?.placesTraveled) ? user.placesTraveled.length : 'N/A');
                }

                // Mock data for test user Sarah@Artane
                if (decodedHandle === 'Sarah@Artane') {
                    bio = '📍 Living in Artane, Dublin! Love exploring Ireland, sharing local spots, and connecting with the community. Food enthusiast 🍳 Travel lover 🌍 Always up for an adventure!';
                    socialLinks = {
                        website: 'https://sarah-artane.com',
                        x: '@sarah_artane',
                        instagram: '@sarah.artane',
                        tiktok: '@sarah_artane_dublin'
                    };
                    placesTraveled = ['Dublin', 'Iceland', 'Japan', 'Egypt', 'Morocco', 'Spain', 'Italy', 'Greece', 'Thailand'];
                }

                // Mock data for test user Bob@Ireland
                if (decodedHandle === 'Bob@Ireland') {
                    bio = 'Based in Ireland. Love hiking and photography. Traveled to Cork, Galway, Belfast, London, Paris.';
                    placesTraveled = ['Cork', 'Galway', 'Belfast', 'London', 'Paris'];
                }

                // Calculate total likes and views from all posts
                const totalLikes = uniquePosts.reduce((sum, post) => sum + (post.stats?.likes || 0), 0);
                const totalViews = uniquePosts.reduce((sum, post) => sum + (post.stats?.views || 0), 0);

                // Fetch user profile data from API only when Laravel is enabled (avoids long timeouts when backend is off)
                let followingCount = 0;
                let followersCount = 0;
                const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';
                if (useLaravelApi) {
                    try {
                        const userProfileData = await fetchUserProfile(decodedHandle, user?.id);
                        followingCount = userProfileData.following_count || 0;
                        followersCount = userProfileData.followers_count || 0;

                        if (userProfileData.avatar_url && !avatarUrl) avatarUrl = userProfileData.avatar_url;
                        if (userProfileData.bio && !bio) bio = userProfileData.bio;
                        if (userProfileData.social_links && !socialLinks) socialLinks = userProfileData.social_links;
                        if (decodedHandle !== user?.handle && (userProfileData as any).places_traveled) {
                            placesTraveled = (userProfileData as any).places_traveled;
                        }
                    } catch (error: any) {
                        const isConnectionError =
                            error?.message === 'CONNECTION_REFUSED' ||
                            error?.name === 'ConnectionRefused' ||
                            error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
                            error?.message?.includes('NetworkError');
                        if (!isConnectionError) console.error('Error fetching user profile data:', error);
                    }
                }

                // When API failed or mock: if current user follows this profile, show at least 1 follower
                if (user?.id && decodedHandle !== user?.handle) {
                    try {
                        const followedList = await getFollowedUsers(user?.id != null ? String(user.id) : getStableUserId(user));
                        const followsThisProfile = followedList.some(h => h.toLowerCase() === decodedHandle.toLowerCase());
                        if (followsThisProfile && followersCount < 1) followersCount = 1;
                    } catch (_) {}
                }

                // When viewing own profile, ensure following count is at least the frontend follow list size
                // (e.g. user followed Ava from feed but backend count wasn't updated or API failed)
                const isOwnProfile = decodedHandle === user?.handle;
                if (isOwnProfile && user?.id) {
                    try {
                        const followedList = await getFollowedUsers(user?.id != null ? String(user.id) : getStableUserId(user));
                        if (followedList.length > followingCount) {
                            followingCount = followedList.length;
                        }
                    } catch (_) {}
                }

                // If no dedicated "Places traveled" list, derive places from bio (e.g. "Paris, London, Tokyo" or "I've been to Dublin and Cork")
                if ((!placesTraveled || placesTraveled.length === 0) && bio) {
                    const fromBio = parsePlacesFromBio(bio);
                    if (fromBio.length > 0) placesTraveled = fromBio;
                }

                // Always create profile data, even if no posts found
                // This ensures the profile page shows even for users with no posts
                const profileData = {
                    handle: decodedHandle,
                    name: decodedHandle.split('@')[0],
                    avatarUrl: avatarUrl,
                    bio: bio || undefined,
                    socialLinks: socialLinks || undefined,
                    placesTraveled: placesTraveled || undefined,
                    stats: {
                        following: followingCount,
                        followers: followersCount,
                        likes: totalLikes || 0,
                        views: totalViews || 0
                    }
                };

                // Debug: Log profileData before setting
                console.log('Setting profileData with placesTraveled:', profileData.placesTraveled);
                console.log('Full profileData:', profileData);
                
                setProfileUser(profileData);
                setStats({
                    following: profileData.stats.following,
                    followers: profileData.stats.followers,
                    likes: profileData.stats.likes,
                    views: profileData.stats.views
                });

                setPosts(uniquePosts);

            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [handle, user?.id, user?.placesTraveled, user?.bio]);

    // Check if user has stories (unviewed for others, any for current user)
    React.useEffect(() => {
        async function checkStory() {
            if (!handle) return;
            try {
                const isCurrentUser = handle === user?.handle;
                let result;
                if (isCurrentUser) {
                    // For current user, check if they have any stories
                    result = await userHasStoriesByHandle(handle);
                } else {
                    // For other users, check if current user has unviewed stories
                    result = await userHasUnviewedStoriesByHandle(handle);
                }
                setHasStory(result);
            } catch (error) {
                console.error('Error checking story:', error);
            }
        }
        checkStory();

        // Re-check periodically to update when stories expire after 24 hours
        const intervalId = setInterval(() => {
            checkStory();
        }, 60000); // Check every minute

        // Listen for storiesViewed event to remove border when stories are viewed
        const handleStoriesViewed = (event: CustomEvent) => {
            const viewedHandle = event.detail?.userHandle;
            if (handle === viewedHandle) {
                setHasStory(false);
            }
        };

        window.addEventListener('storiesViewed', handleStoriesViewed as EventListener);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('storiesViewed', handleStoriesViewed as EventListener);
        };
    }, [handle]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    if (!profileUser && !loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Show private profile message if can't view
    if (!canViewProfileState && profileIsPrivate && !loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white">
                <div className="sticky top-0 bg-gray-950 z-10 border-b border-gray-800">
                    <div className="flex items-center justify-between px-4 py-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-900 rounded-full transition-colors"
                        >
                            <FiChevronLeft className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center justify-center min-h-[80vh]">
                    <div className="text-center px-4">
                        <FiLock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold mb-2">This Account is Private</h2>
                        <p className="text-gray-400 mb-6">To view this user's profile you must be following them.</p>
                        {!hasPendingRequest && (
                            <button
                                onClick={handleFollow}
                                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-semibold transition-colors"
                            >
                                Follow
                            </button>
                        )}
                        {hasPendingRequest && (
                            <p className="text-gray-500">Follow request sent</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Passport Title - Instagram Style */}
            <div className="w-full text-center pt-4 pb-6">
                <h1 
                    className="text-4xl font-normal tracking-tight"
                    style={{ 
                        fontFamily: '"Brush Script MT", "Lucida Handwriting", "Comic Sans MS", cursive',
                        color: '#ffffff',
                        fontWeight: 400,
                        letterSpacing: '0.5px'
                    }}
                >
                    Passport
                </h1>
            </div>

            {/* Profile Info with World Map Background */}
            <div className="relative w-full overflow-hidden">
                {/* World Map Background */}
                <div className="relative w-full h-64 bg-gray-100 dark:bg-gray-800">
                    <img
                        src="/placeholders/world-map.jpg"
                        alt="World Map"
                        className="w-full h-full object-cover opacity-30 dark:opacity-20"
                        style={{ 
                            filter: 'grayscale(100%) brightness(1.2)',
                        }}
                        onError={(e) => {
                            // Fallback to Wikimedia map
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg';
                        }}
                    />
                    {/* Overlay gradient for better text visibility */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950/50 dark:to-gray-950/70"></div>
                    
                    {/* Profile Picture and Name Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                        {/* Profile Picture */}
                        <div className="mb-4">
                            <Avatar
                                src={profileUser.avatarUrl}
                                name={profileUser.name}
                                size="xl"
                                className="!w-32 !h-32 border-4 border-white dark:border-gray-800 shadow-2xl cursor-pointer"
                                hasStory={hasStory}
                                onClick={() => setShowProfileMenu(true)}
                            />
                        </div>

                        {/* Username */}
                        <div className="text-center">
                            <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white uppercase tracking-wide drop-shadow-lg">
                                {profileUser.name}
                            </h1>
                            <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1">
                                <span>{profileUser.handle}</span>
                                <Flag
                                    value={profileUser.handle === user?.handle ? (user?.countryFlag || '') : (getFlagForHandle(profileUser.handle) || '')}
                                    size={16}
                                />
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Info Section (below world map) */}
            <div className="px-4 py-6">

                {/* Statistics */}
                <div className="flex justify-around mb-6">
                    <div className="text-center">
                        <div className="text-lg font-bold">{stats.following}</div>
                        <div className="text-xs text-gray-400">Following</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold">{stats.followers > 1000 ? `${(stats.followers / 1000).toFixed(1)}K` : stats.followers}</div>
                        <div className="text-xs text-gray-400">Followers</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold">{stats.views > 1000 ? `${(stats.views / 1000).toFixed(1)}K` : stats.views}</div>
                        <div className="text-xs text-gray-400">Views</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold">{stats.likes > 1000 ? `${(stats.likes / 1000).toFixed(1)}K` : stats.likes}</div>
                        <div className="text-xs text-gray-400">Likes</div>
                    </div>
                </div>

                {/* Action Buttons - hide Follow/Message when viewing own profile (show when no user.handle so button isn't hidden) */}
                <div className="flex gap-2 mb-4 relative z-10">
                    {handle && (!user?.handle || decodeURIComponent(handle) !== user.handle) && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleFollow();
                        }}
                        className="flex-1 py-2 rounded-lg font-semibold transition-colors bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!user?.id || !handle}
                    >
                        {hasPendingRequest ? 'Requested' : isFollowing ? 'Following' : 'Follow'}
                    </button>
                    )}
                    {handle && (!user?.handle || decodeURIComponent(handle) !== user.handle) && (
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (handle && user?.handle && user?.id) {
                                // Decode the handle from URL
                                const decodedHandle = decodeURIComponent(handle);
                                // Check if user can message (privacy check)
                                const followedUsers = await getFollowedUsers(user?.id != null ? String(user.id) : getStableUserId(user));
                                if (!canSendMessage(user?.handle || '', decodedHandle, followedUsers)) {
                                    Swal.fire(bottomSheet({ title: 'Cannot Send Message', message: 'You must follow this user to send them a message.', icon: 'alert' }));
                                    return;
                                }
                                navigate(`/messages/${decodedHandle}`);
                            }
                        }}
                        className="flex-1 py-2 rounded-lg bg-gray-800 text-white font-semibold hover:bg-gray-700 transition-colors relative z-20"
                    >
                        Message
                    </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            // Use helper that includes localStorage fallback so bio / Travel Info from Profile always count
                            const effectivePlaces = getEffectivePlacesWithStorageFallback(profileUser, user);
                            if (!effectivePlaces || effectivePlaces.length === 0) {
                                const decodedHandle = handle ? decodeURIComponent(handle) : 'This user';
                                Swal.fire(bottomSheet({
                                    title: 'No Places Traveled',
                                    message: `${decodedHandle} hasn't added any places they've traveled to their profile yet.`,
                                    icon: 'alert',
                                }));
                            } else {
                                setPlacesForTravelModal(effectivePlaces);
                                setShowTraveledModal(true);
                            }
                        }}
                        className="px-4 py-2 rounded-lg bg-gray-800 text-white font-semibold hover:bg-gray-700 transition-colors relative z-20 flex items-center justify-center gap-2"
                        title="Places Traveled"
                    >
                        <FiMapPin className="w-5 h-5" />
                    </button>
                </div>

                {/* Bio */}
                {profileUser.bio ? (
                    <div className="mb-4 text-sm">
                        <p className="text-gray-300">{profileUser.bio}</p>
                    </div>
                ) : (
                    <div className="mb-4 text-sm text-gray-500">
                        <p>No bio yet</p>
                    </div>
                )}

                {/* Social Links */}
                {profileUser.socialLinks && (profileUser.socialLinks.website || profileUser.socialLinks.x || profileUser.socialLinks.instagram || profileUser.socialLinks.tiktok) && (
                    <div className="mb-6 flex flex-wrap gap-3">
                        {profileUser.socialLinks.website && (
                            <a
                                href={profileUser.socialLinks.website.startsWith('http') ? profileUser.socialLinks.website : `https://${profileUser.socialLinks.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Website
                            </a>
                        )}
                        {profileUser.socialLinks.x && (
                            <a
                                href={`https://twitter.com/${profileUser.socialLinks.x.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                                title={profileUser.socialLinks.x}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                        )}
                        {profileUser.socialLinks.instagram && (
                            <a
                                href={`https://instagram.com/${profileUser.socialLinks.instagram.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                                title={profileUser.socialLinks.instagram}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.419-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.074-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
                                </svg>
                            </a>
                        )}
                        {profileUser.socialLinks.tiktok && (
                            <a
                                href={`https://tiktok.com/@${profileUser.socialLinks.tiktok.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                                title={profileUser.socialLinks.tiktok}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.65 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                                </svg>
                            </a>
                        )}
                    </div>
                )}

            </div>

            {/* Posts Grid */}
            <div className="px-2">
                <div className="grid grid-cols-3 gap-1">
                    {posts.length > 0 ? (
                        posts.map((post) => (
                            <div
                                key={post.id}
                                className="aspect-square relative group cursor-pointer bg-gray-900"
                                onClick={() => setSelectedPost(post)}
                            >
                                {post.mediaUrl ? (
                                    post.mediaType === 'video' ? (
                                        <div className="w-full h-full relative bg-gray-900">
                                            {/* Video element to show first frame */}
                                            <video
                                                src={post.mediaUrl}
                                                className="w-full h-full object-cover"
                                                muted
                                                playsInline
                                                preload="metadata"
                                            />
                                            {/* Play button overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-16 h-16 bg-black bg-opacity-60 rounded-full flex items-center justify-center hover:bg-opacity-80 transition-opacity">
                                                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            {/* Video indicator badge */}
                                            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black bg-opacity-70 rounded flex items-center gap-1">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M6.5 4.5a.5.5 0 01.09.09L11 7.5a.5.5 0 110 .92l-4.41 2.91a.5.5 0 11-.59-.81l4.41-2.91L6.91 4.5A.5.5 0 016.5 4.5zm3 0a.5.5 0 01.09.09l5 5a.5.5 0 110 .92l-5 5a.5.5 0 11-.59-.81L13.5 10l-4.41-2.91A.5.5 0 019.5 4.5zm-6 0a.5.5 0 01.09.09l5 5a.5.5 0 11-.59.81L3 5.5l4.41 2.91a.5.5 0 11-.59-.81l-5-5A.5.5 0 010 4.5z" />
                                                </svg>
                                                <span className="text-xs text-white font-medium">Video</span>
                                            </div>
                                            {/* Location badge */}
                                            {post.locationLabel && (
                                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black bg-opacity-70 rounded flex items-center gap-1">
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span className="text-xs text-white font-medium">{post.locationLabel}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <img
                                                src={post.mediaUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Location badge for images */}
                                            {post.locationLabel && (
                                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black bg-opacity-70 rounded flex items-center gap-1">
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span className="text-xs text-white font-medium">{post.locationLabel}</span>
                                                </div>
                                            )}
                                        </>
                                    )
                                ) : (
                                    // Text-only post with gradient background
                                    <div className="w-full h-full relative flex items-center justify-center p-3" style={{
                                        background: (() => {
                                            const backgrounds = [
                                                '#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb',
                                                '#3b82f6', '#1e293b', '#0f172a', '#1a202c'
                                            ];
                                            return backgrounds[post.text ? post.text.length % backgrounds.length : 0];
                                        })()
                                    }}>
                                        <p className="text-white text-xs font-semibold text-center line-clamp-6">
                                            {post.text || 'No preview'}
                                        </p>
                                        {/* Location badge for text-only posts */}
                                        {post.locationLabel && (
                                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black bg-opacity-70 rounded flex items-center gap-1">
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span className="text-xs text-white font-medium">{post.locationLabel}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
                            </div>
                        ))
                    ) : (
                        <div className="col-span-3 text-center py-12 text-gray-500">
                            <p className="text-lg mb-2">No posts yet</p>
                            <p className="text-sm">When this user posts, you'll see them here.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Traveled Modal - compute places at render time with localStorage fallback so bio / Travel Info always show */}
            {showTraveledModal && (() => {
                const placesToShow = getEffectivePlacesWithStorageFallback(profileUser, user);
                return (
                <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={() => setShowTraveledModal(false)}>
                    <div className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Places Traveled</h2>
                            <button
                                onClick={() => setShowTraveledModal(false)}
                                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                            >
                                <FiX className="w-6 h-6 text-white" />
                            </button>
                        </div>
                        
                        {/* Places List */}
                        <div className="p-6">
                            {placesToShow.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {placesToShow.map((place: string, index: number) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                                            onClick={() => {
                                                // Navigate to feed with this location
                                                navigate(`/feed?location=${encodeURIComponent(place)}`);
                                                setShowTraveledModal(false);
                                            }}
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                <FiMapPin className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-medium">{place}</p>
                                            </div>
                                            <button
                                                className="p-2 hover:bg-gray-600 rounded-full transition-colors flex-shrink-0"
                                                title="View"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Navigate to feed with this location
                                                    navigate(`/feed?location=${encodeURIComponent(place)}`);
                                                    setShowTraveledModal(false);
                                                }}
                                            >
                                                <FiEye className="w-5 h-5 text-gray-400 hover:text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FiMapPin className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                                    <p className="text-gray-400">No places traveled yet</p>
                                    <p className="text-sm text-gray-500 mt-2">Add places you've traveled to in your profile settings</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Post Viewer Modal */}
            {selectedPost && (
                <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={() => setSelectedPost(null)}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPost(null);
                        }}
                        className="absolute top-4 left-4 w-10 h-10 bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full flex items-center justify-center transition-colors z-10"
                    >
                        <FiX className="w-6 h-6 text-white" />
                    </button>
                    <div className="relative max-w-4xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        {!selectedPost.mediaUrl ? (
                            // Text-only post
                            <div className="w-full max-w-2xl p-8" style={{
                                background: (() => {
                                    const backgrounds = [
                                        '#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb',
                                        '#3b82f6', '#1e293b', '#0f172a', '#1a202c'
                                    ];
                                    return backgrounds[selectedPost.text ? selectedPost.text.length % backgrounds.length : 0];
                                })()
                            }}>
                                <p className="text-white text-xl font-bold leading-relaxed whitespace-pre-wrap">
                                    {selectedPost.text}
                                </p>
                            </div>
                        ) : selectedPost.mediaType === 'video' ? (
                            <video
                                src={selectedPost.mediaUrl}
                                className="max-h-[90vh] w-auto"
                                controls
                                autoPlay
                            />
                        ) : (
                            <img
                                src={selectedPost.mediaUrl}
                                alt=""
                                className="max-h-[90vh] w-auto object-contain"
                            />
                        )}
                        {selectedPost.text && selectedPost.mediaUrl && (
                            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 rounded-lg p-4">
                                <p className="text-white text-sm">{selectedPost.text}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Menu Modal */}
            {showProfileMenu && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowProfileMenu(false)}
                    />

                    {/* Menu - stopPropagation so backdrop doesn't steal click */}
                    <div className="relative bg-[#262626] dark:bg-[#1a1a1a] rounded-3xl p-4 sm:p-6 shadow-2xl mx-4 max-w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-row flex-wrap gap-3 sm:gap-6 items-center justify-center">
                            {/* View Stories - only show if user has stories */}
                            {hasStory && (
                                <button
                                    onClick={() => {
                                        setShowProfileMenu(false);
                                        navigate('/stories', { state: { openUserHandle: handle } });
                                    }}
                                    className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                                >
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                        <FiPlay className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                    </div>
                                    <span className="text-[10px] sm:text-xs text-white font-medium text-center">View Stories</span>
                                </button>
                            )}

                            {/* Follow - only show when viewing someone else's profile */}
                            {handle && user?.handle && decodeURIComponent(handle) !== user.handle && (
                            <button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    await handleFollow();
                                    setShowProfileMenu(false);
                                }}
                                className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                            >
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                    <FiUserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                </div>
                                <span className="text-[10px] sm:text-xs text-white font-medium text-center">{isFollowing ? 'Unfollow' : 'Follow'}</span>
                            </button>
                            )}

                            {/* Share Profile */}
                            <button
                                onClick={() => {
                                    setShowProfileMenu(false);
                                    setShowShareProfileModal(true);
                                }}
                                className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                            >
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                    <FiShare2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                </div>
                                <span className="text-[10px] sm:text-xs text-white font-medium text-center">Share profile</span>
                            </button>

                            {/* QR Code */}
                            <button
                                onClick={() => {
                                    setShowProfileMenu(false);
                                    setShowQRCodeModal(true);
                                }}
                                className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                            >
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                    <FiMaximize className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                </div>
                                <span className="text-[10px] sm:text-xs text-white font-medium text-center">QR code</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal for Profile */}
            {showQRCodeModal && profileUser && (
                <ProfileQRCodeModal
                    isOpen={showQRCodeModal}
                    onClose={() => setShowQRCodeModal(false)}
                    handle={handle || ''}
                    name={profileUser.name || handle || ''}
                />
            )}

            {/* Share Profile Modal */}
            {showShareProfileModal && profileUser && (
                <ShareProfileModal
                    isOpen={showShareProfileModal}
                    onClose={() => setShowShareProfileModal(false)}
                    handle={handle || ''}
                    name={profileUser.name || handle || ''}
                    avatarUrl={profileUser.avatarUrl}
                />
            )}
        </div>
    );
}

// Profile QR Code Modal Component
function ProfileQRCodeModal({ isOpen, onClose, handle, name }: { isOpen: boolean; onClose: () => void; handle: string; name: string }) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string>('');
    const [isGenerating, setIsGenerating] = React.useState(false);

    React.useEffect(() => {
        if (isOpen && handle) {
            setQrCodeDataUrl('');
            setIsGenerating(true);
            generateQRCode();
        } else if (!isOpen) {
            setQrCodeDataUrl('');
            setIsGenerating(false);
        }
    }, [isOpen, handle]);

    async function generateQRCode() {
        if (!handle) {
            setIsGenerating(false);
            return;
        }

        setIsGenerating(true);
        try {
            const QRCode = (await import('qrcode')).default;
            const profileUrl = `${window.location.origin}/user/${encodeURIComponent(handle)}`;
            const qrDataUrl = await QRCode.toDataURL(profileUrl, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            setQrCodeDataUrl(qrDataUrl);
            setIsGenerating(false);
        } catch (error) {
            console.error('Error generating QR code:', error);
            setIsGenerating(false);
        }
    }

    if (!isOpen) return null;

    const displayName = name.split('@')[0]?.toUpperCase() || 'PROFILE';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm mx-4 bg-[#262626] dark:bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                    aria-label="Close"
                >
                    <FiX className="w-5 h-5 text-white" />
                </button>

                {/* Content */}
                <div className="p-6">
                    {/* QR Code */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            {qrCodeDataUrl ? (
                                <img
                                    src={qrCodeDataUrl}
                                    alt="QR Code"
                                    className="w-64 h-64 rounded-2xl"
                                />
                            ) : (
                                <div className="w-64 h-64 rounded-2xl bg-white flex flex-col items-center justify-center gap-2">
                                    {isGenerating ? (
                                        <>
                                            <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs text-gray-500">Generating QR code...</p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-500">Failed to generate QR code</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Profile Info */}
                    <div className="text-center mb-4">
                        <div
                            className="text-sm font-medium mb-4"
                            style={{
                                background: 'linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #7c3aed 100%)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                            }}
                        >
                            @{displayName}
                        </div>
                        <p className="text-white text-sm text-gray-300 px-4">
                            People can scan this QR code with their smartphone's camera to view this profile.
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-3 mt-6">
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

