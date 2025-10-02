import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMoreHorizontal, FiCheck, FiGrid, FiUser, FiShare2, FiMessageCircle, FiEdit3, FiPlay, FiLayers } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import ProfilePictureUpload from '../components/ProfilePictureUpload';
import StoryHighlights from '../components/StoryHighlights';
import PostPreviewModal from '../components/PostPreviewModal';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const nav = useNavigate();
  const [activeTab, setActiveTab] = React.useState<'posts' | 'tagged'>('posts');
  const [selectedPost, setSelectedPost] = React.useState<any>(null);
  const [isOnline, setIsOnline] = React.useState(true);
  const [lastSeen, setLastSeen] = React.useState('2 minutes ago');

  if (!user) {
    return (
      <div className="p-6">
        <p className="mb-3">You're signed out.</p>
        <button 
          onClick={() => nav('/login')} 
          className="px-3 py-2 rounded bg-brand-600 text-white"
        >
          Sign in
        </button>
      </div>
    );
  }

  // Mock user stats - in a real app, these would come from an API
  const userStats = {
    posts: 1162,
    following: 43,
    followers: 33
  };

  // Mock posts grid - in a real app, these would be user's actual posts
  const mockPosts = Array.from({ length: 12 }, (_, i) => ({
    id: (i + 1).toString(),
    imageUrl: `https://picsum.photos/300/300?random=${i + 1}`,
    type: (i % 4 === 0 ? 'video' : 'image') as 'image' | 'video',
    caption: i === 0 ? 'Beautiful sunset from Dublin today! 🌅' : undefined,
    likes: Math.floor(Math.random() * 1000) + 50,
    comments: Math.floor(Math.random() * 50) + 5,
    isLiked: Math.random() > 0.5,
    isBookmarked: Math.random() > 0.7,
    timestamp: `${Math.floor(Math.random() * 24)}h ago`
  }));

  // Mock story highlights
  const storyHighlights = [
    { id: '1', title: 'Travel', thumbnail: 'https://picsum.photos/100/100?random=travel', count: 5 },
    { id: '2', title: 'Work', thumbnail: 'https://picsum.photos/100/100?random=work', count: 3 },
    { id: '3', title: 'Food', thumbnail: 'https://picsum.photos/100/100?random=food', count: 8 },
    { id: '4', title: 'Events', thumbnail: 'https://picsum.photos/100/100?random=events', count: 2 }
  ];

  // Check if this is the user's own profile
  const isOwnProfile = true; // In a real app, you'd compare user IDs

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/profile`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${user.name}'s Profile`,
          text: `Check out ${user.name}'s profile on Gossapp`,
          url: profileUrl
        });
      } catch (err) {
        // User cancelled or error occurred
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(profileUrl);
        // You could show a toast here
      } catch (err) {
        console.error('Failed to copy to clipboard');
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <button 
          onClick={() => nav(-1)}
          className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
          aria-label="Go back"
        >
          <FiArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Profile</h1>
        <button 
          className="p-2 -mr-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
          aria-label="More options"
        >
          <FiMoreHorizontal size={24} />
        </button>
      </div>

      {/* Profile Info */}
      <div className="p-4">
        {/* Avatar and Basic Info */}
        <div className="flex items-start gap-4 mb-4">
          {isOwnProfile ? (
            <ProfilePictureUpload
              currentImage={user.profileImage || ''}
              onImageChange={(imageUrl) => {
                // Update user context immediately when profile image changes
                updateUser({ profileImage: imageUrl });
              }}
              userName={user.name}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">{user.name}</h2>
              <FiCheck className="w-5 h-5 text-blue-500" />
              {isOnline && (
                <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-950" />
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">@{user.username || user.id}</p>
            <p className="text-gray-800 dark:text-gray-200 text-sm mb-2">
              {user.bio || 'Sharing updates, insights, and moments from the world of Gossapp.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user.location && `📍 ${user.location}`}
              {user.location && user.website && ' • '}
              {user.website && `🌐 ${user.website}`}
            </p>
            {!isOnline && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Active {lastSeen}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-around py-4 border-b border-gray-200 dark:border-gray-800 mb-4">
          <button 
            className="text-center hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg p-2 transition-colors"
            onClick={() => nav('/profile/posts')}
          >
            <div className="text-2xl font-bold">{userStats.posts.toLocaleString()}</div>
            <div className="text-gray-600 dark:text-gray-400 text-sm">Posts</div>
          </button>
          <button 
            className="text-center hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg p-2 transition-colors"
            onClick={() => nav('/profile/following')}
          >
            <div className="text-2xl font-bold">{userStats.following}</div>
            <div className="text-gray-600 dark:text-gray-400 text-sm">Following</div>
          </button>
          <button 
            className="text-center hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg p-2 transition-colors"
            onClick={() => nav('/profile/followers')}
          >
            <div className="text-2xl font-bold">{userStats.followers}</div>
            <div className="text-gray-600 dark:text-gray-400 text-sm">Followers</div>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-4">
          {isOwnProfile ? (
            <>
              <button 
                onClick={() => nav('/profile/edit')}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <FiEdit3 size={16} />
                Edit Profile
              </button>
              <button 
                onClick={handleShare}
                className="flex-1 border border-gray-300 dark:border-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Share Profile
              </button>
            </>
          ) : (
            <>
              <button className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors">
                Follow
              </button>
              <button className="flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <FiMessageCircle size={18} />
              </button>
              <button 
                onClick={handleShare}
                className="flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <FiShare2 size={18} />
              </button>
            </>
          )}
        </div>

        {/* Mutual Connections (for other profiles) */}
        {!isOwnProfile && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Followed by <span className="font-semibold">john_doe</span>, <span className="font-semibold">sarah_wilson</span> and <span className="font-semibold">12 others</span> you follow
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'posts'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-600 dark:text-gray-400'
              }`}
            >
              <FiGrid size={16} />
              Posts
            </button>
            <button
              onClick={() => setActiveTab('tagged')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tagged'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-600 dark:text-gray-400'
              }`}
            >
              <FiUser size={16} />
              Tagged
            </button>
          </div>
          <div className="flex gap-1">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded transition-colors">
              <FiGrid size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Story Highlights */}
      <StoryHighlights
        highlights={storyHighlights}
        onAddHighlight={() => console.log('Add highlight')}
        onHighlightClick={(highlight) => console.log('View highlight:', highlight)}
        isOwnProfile={isOwnProfile}
      />

      {/* Posts Grid */}
      <div className="px-4 pb-20">
        {activeTab === 'posts' ? (
          <div className="grid grid-cols-3 gap-1">
            {mockPosts.map((post) => (
              <div
                key={post.id}
                className="relative aspect-square bg-gray-200 dark:bg-gray-800 rounded-sm overflow-hidden cursor-pointer hover:opacity-80 transition-all hover:scale-[1.02] group"
                onClick={() => setSelectedPost(post)}
              >
                <img
                  src={post.imageUrl}
                  alt={`Post ${post.id}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {/* Post type indicator */}
                {post.type === 'video' && (
                  <div className="absolute top-2 right-2">
                    <FiPlay className="text-white drop-shadow-lg" size={16} />
                  </div>
                )}
                
                {/* Multi-image indicator (for some posts) */}
                {parseInt(post.id) % 5 === 0 && (
                  <div className="absolute top-2 right-2">
                    <FiLayers className="text-white drop-shadow-lg" size={16} />
                  </div>
                )}
                
                {/* Hover overlay with stats */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1 text-white font-semibold">
                    <FiUser size={16} />
                    {post.likes}
                  </div>
                  <div className="flex items-center gap-1 text-white font-semibold">
                    <FiMessageCircle size={16} />
                    {post.comments}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FiUser size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No tagged posts yet</p>
          </div>
        )}
      </div>

      {/* Post Preview Modal */}
      {selectedPost && (
        <PostPreviewModal
          post={selectedPost}
          isOpen={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          onLike={() => {
            setSelectedPost(prev => prev ? { ...prev, isLiked: !prev.isLiked, likes: prev.isLiked ? prev.likes - 1 : prev.likes + 1 } : null);
          }}
          onBookmark={() => {
            setSelectedPost(prev => prev ? { ...prev, isBookmarked: !prev.isBookmarked } : null);
          }}
          onShare={handleShare}
        />
      )}

      {/* Hidden Sign Out Button (for development/testing) */}
      {isOwnProfile && (
        <div className="fixed bottom-20 right-4">
          <button
            onClick={() => { logout(); nav('/login', { replace: true }); }}
            className="bg-red-500 text-white px-3 py-1 rounded text-xs opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

