import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronLeft, FiBell, FiShare2, FiMessageSquare, FiMoreHorizontal, FiX } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchPostsPage, toggleFollowForPost } from '../api/posts';
import { userHasStoriesByHandle } from '../api/stories';
import type { Post } from '../types';

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

    React.useEffect(() => {
        const loadProfile = async () => {
            if (!handle) return;

            setLoading(true);
            try {
                // Fetch all posts from all tabs to find this user's posts
                // We fetch from all tabs because posts might be in different location feeds
                const allTabs = ['finglas', 'dublin', 'ireland', 'following'];
                let userPosts: Post[] = [];

                for (const tab of allTabs) {
                    const page = await fetchPostsPage(tab, null, 100, user?.id || 'me', user?.local || '', user?.regional || '', user?.national || '');
                    const postsForThisTab = page.items.filter(post => post.userHandle === handle);
                    userPosts = [...userPosts, ...postsForThisTab];
                }

                // Remove duplicates by post ID
                const uniquePosts = userPosts.filter((post, index, self) =>
                    index === self.findIndex(p => p.id === post.id)
                );



                // Try to get avatar from user object if viewing own profile, otherwise use placeholder
                let avatarUrl = handle === user?.handle ? user?.avatarUrl : undefined;

                // Mock profile picture for Sarah@Artane
                if (handle === 'Sarah@Artane') {
                    avatarUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop';
                }

                // Get bio and social links if viewing own profile
                let bio = handle === user?.handle ? user?.bio : undefined;
                let socialLinks = handle === user?.handle ? user?.socialLinks : undefined;

                // Mock data for test user Sarah@Artane
                if (handle === 'Sarah@Artane') {
                    bio = '📍 Living in Artane, Dublin! Love exploring Ireland, sharing local spots, and connecting with the community. Food enthusiast 🍳 Travel lover 🌍 Always up for an adventure!';
                    socialLinks = {
                        website: 'https://sarah-artane.com',
                        x: '@sarah_artane',
                        instagram: '@sarah.artane',
                        tiktok: '@sarah_artane_dublin'
                    };
                }

                // Calculate total likes and views from all posts
                const totalLikes = uniquePosts.reduce((sum, post) => sum + (post.stats?.likes || 0), 0);
                const totalViews = uniquePosts.reduce((sum, post) => sum + (post.stats?.views || 0), 0);

                const profileData = {
                    handle: handle,
                    name: handle.split('@')[0],
                    avatarUrl: avatarUrl,
                    bio: bio || undefined,
                    socialLinks: socialLinks || undefined,
                    stats: {
                        following: 71,
                        followers: 43900,
                        likes: totalLikes || 941800,
                        views: totalViews
                    }
                };

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
    }, [handle, user?.id]);

    // Check if user has stories
    React.useEffect(() => {
        async function checkStory() {
            if (!handle) return;
            try {
                const result = await userHasStoriesByHandle(handle);
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

    if (!profileUser) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-xl mb-4">User not found</p>
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

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="sticky top-0 bg-gray-950 z-10 border-b border-gray-800">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-900 rounded-full transition-colors"
                    >
                        <FiChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-3">
                        <button className="p-2 hover:bg-gray-900 rounded-full transition-colors">
                            <FiShare2 className="w-6 h-6" />
                        </button>
                        <button className="p-2 hover:bg-gray-900 rounded-full transition-colors">
                            <FiMoreHorizontal className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Profile Info */}
            <div className="px-4 py-6">
                {/* Profile Picture */}
                <div className={`flex justify-center mb-4 ${!hasStory ? 'pointer-events-none' : ''}`}>
                    <Avatar
                        src={profileUser.avatarUrl}
                        name={profileUser.name}
                        size="xl"
                        className="!w-24 !h-24"
                        hasStory={hasStory}
                        onClick={hasStory ? () => navigate('/stories', { state: { openUserHandle: handle } }) : undefined}
                    />
                </div>

                {/* Username and Handle */}
                <div className="text-center mb-4">
                    <h1 className="text-xl font-bold mb-1">{profileUser.name}</h1>
                    <p className="text-sm text-gray-400">{profileUser.handle}</p>
                </div>

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

                {/* Action Buttons */}
                <div className="flex gap-2 mb-4 relative z-10">
                    <button
                        onClick={async () => {
                            if (!user?.id || !handle) return;
                            try {
                                // Find a post by this user to toggle follow
                                const userPost = posts[0];
                                if (userPost) {
                                    await toggleFollowForPost(user.id, userPost.id);
                                }
                                setIsFollowing(!isFollowing);

                                // Dispatch event to update newsfeed
                                window.dispatchEvent(new CustomEvent('followToggled', {
                                    detail: { handle, isFollowing: !isFollowing }
                                }));
                            } catch (error) {
                                console.error('Error toggling follow:', error);
                            }
                        }}
                        className="flex-1 py-2 rounded-lg font-semibold transition-colors bg-brand-600 hover:bg-brand-700 text-white"
                    >
                        {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (handle) {
                                navigate(`/messages/${handle}`);
                            }
                        }}
                        className="flex-1 py-2 rounded-lg bg-gray-800 text-white font-semibold hover:bg-gray-700 transition-colors relative z-20"
                    >
                        Message
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
                                className="w-10 h-10 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                                title={profileUser.socialLinks.tiktok}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M16.6 5.82s.51.5 2.13.5V1.63h-2.81v6.94s1.62-.07 2.81-.07v2.81c-1.68 0-2.81.07-2.81.07v3.39c0 3.89-3.53 5.21-6.7 5.21s-6.7-1.32-6.7-5.21c0-3.89 3.53-5.21 6.7-5.21.7 0 1.36.05 1.93.11V9.94h-2.93v2.81c1.24.28 2.03 1.32 2.03 2.29s-.79 2.01-2.03 2.29c-1.24.28-2.03 1.32-2.03 2.29s-.79 2.01-2.03 2.29c-1.24.28-2.03 1.32-2.03 2.29s-.79 2.01-2.03 2.29c-1.24.28-2.03 1.32-2.03 2.29s.79 2.01 2.03 2.29c1.24.28 2.03 1.32 2.03 2.29s-.79 2.01-2.03 2.29c-1.24.28-2.03 1.32-2.03 2.29s.79 2.01 2.03 2.29c1.24.28 2.03 1.32 2.03 2.29s-.79 2.01-2.03 2.29z" />
                                </svg>
                            </a>
                        )}
                    </div>
                )}

                {/* Content Tabs */}
                <div className="border-b border-gray-800 mb-4">
                    <div className="flex justify-center">
                        <div className="flex items-center gap-1 text-sm text-gray-400">
                            <div className="w-1 h-1 bg-gray-400 rounded-full" />
                            <div className="w-1 h-1 bg-gray-400 rounded-full" />
                            <div className="w-1 h-1 bg-gray-400 rounded-full" />
                            <div className="w-1 h-1 bg-gray-400 rounded-full" />
                        </div>
                    </div>
                </div>
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
        </div>
    );
}

