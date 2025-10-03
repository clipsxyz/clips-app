import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiSearch, FiUsers, FiCalendar, FiMessageSquare, FiMoreVertical, FiSettings, FiUserPlus, FiHeart, FiShare2 } from 'react-icons/fi';
import { useGroups, Group, GroupPost } from '../hooks/useGroups';
import { useAuth } from '../context/Auth';
import TouchFeedback from './TouchFeedback';

export default function GroupsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    groups,
    myGroups,
    activeGroup,
    groupMembers,
    groupPosts,
    groupEvents,
    searchResults,
    isConnected,
    setActiveGroup,
    createGroup,
    joinGroup,
    leaveGroup,
    createGroupPost,
    createGroupEvent,
    searchGroups,
    loadGroupData
  } = useGroups();

  const [activeTab, setActiveTab] = useState<'discover' | 'my-groups' | 'search'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postContent, setPostContent] = useState('');
  
  // Group creation form
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupCategory, setGroupCategory] = useState('');
  const [groupTags, setGroupTags] = useState('');
  const [isPrivateGroup, setIsPrivateGroup] = useState(false);

  // Load group data when groupId changes
  useEffect(() => {
    if (groupId) {
      const group = [...groups, ...myGroups].find(g => g.id === groupId);
      if (group) {
        setActiveGroup(group);
        loadGroupData(groupId);
      }
    } else {
      setActiveGroup(null);
    }
  }, [groupId, groups, myGroups, setActiveGroup, loadGroupData]);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchGroups(query.trim());
      setActiveTab('search');
    }
  };

  // Handle group creation
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      await createGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        category: groupCategory || 'general',
        tags: groupTags.split(',').map(tag => tag.trim()).filter(Boolean),
        isPrivate: isPrivateGroup
      });
      
      setShowCreateForm(false);
      setGroupName('');
      setGroupDescription('');
      setGroupCategory('');
      setGroupTags('');
      setIsPrivateGroup(false);
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  // Handle post creation
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() || !activeGroup) return;

    createGroupPost(activeGroup.id, {
      content: postContent.trim(),
      type: 'text'
    });
    
    setPostContent('');
    setShowPostForm(false);
  };

  // Format member count
  const formatMemberCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  // Format time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Show individual group
  if (activeGroup) {
    const members = groupMembers[activeGroup.id] || [];
    const posts = groupPosts[activeGroup.id] || [];
    const events = groupEvents[activeGroup.id] || [];
    const userMember = members.find(m => m.userId === user?.id);
    const canPost = userMember && activeGroup.settings.allowMemberPosts;

    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Header */}
        <div className="relative">
          {/* Cover image */}
          <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600">
            {activeGroup.coverImage && (
              <img
                src={activeGroup.coverImage}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>
          
          {/* Header controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <TouchFeedback onTap={() => navigate('/groups')}>
              <div className="p-2 bg-black/30 rounded-full">
                <FiArrowLeft size={20} className="text-white" />
              </div>
            </TouchFeedback>
            
            <div className="flex items-center gap-2">
              <TouchFeedback onTap={() => {}}>
                <div className="p-2 bg-black/30 rounded-full">
                  <FiShare2 size={20} className="text-white" />
                </div>
              </TouchFeedback>
              <TouchFeedback onTap={() => {}}>
                <div className="p-2 bg-black/30 rounded-full">
                  <FiMoreVertical size={20} className="text-white" />
                </div>
              </TouchFeedback>
            </div>
          </div>
        </div>

        {/* Group info */}
        <div className="px-4 pb-4">
          <div className="flex items-start gap-4 -mt-8">
            <div className="w-16 h-16 rounded-xl bg-white dark:bg-gray-900 p-1 shadow-lg">
              <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                {activeGroup.avatar ? (
                  <img
                    src={activeGroup.avatar}
                    alt=""
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  activeGroup.name.slice(0, 1).toUpperCase()
                )}
              </div>
            </div>
            
            <div className="flex-1 mt-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {activeGroup.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <FiUsers size={14} />
                  {formatMemberCount(activeGroup.memberCount)} members
                </span>
                <span>•</span>
                <span>{activeGroup.category}</span>
                {activeGroup.isPrivate && (
                  <>
                    <span>•</span>
                    <span>Private</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {activeGroup.description && (
            <p className="text-gray-700 dark:text-gray-300 mt-4 text-sm">
              {activeGroup.description}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            {userMember ? (
              <>
                <TouchFeedback onTap={() => leaveGroup(activeGroup.id)}>
                  <div className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-center font-medium">
                    Leave Group
                  </div>
                </TouchFeedback>
                {canPost && (
                  <TouchFeedback onTap={() => setShowPostForm(true)}>
                    <div className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium">
                      Post
                    </div>
                  </TouchFeedback>
                )}
              </>
            ) : (
              <TouchFeedback onTap={() => joinGroup(activeGroup.id)}>
                <div className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg text-center font-medium">
                  Join Group
                </div>
              </TouchFeedback>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <div className="flex">
            {['Posts', 'Members', 'Events'].map((tab) => (
              <TouchFeedback key={tab} onTap={() => {}}>
                <div className="flex-1 py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400 border-b-2 border-transparent">
                  {tab}
                </div>
              </TouchFeedback>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div className="flex-1 overflow-y-auto">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <FiMessageSquare size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Be the first to share something with the group!
              </p>
              {canPost && (
                <TouchFeedback onTap={() => setShowPostForm(true)}>
                  <div className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium">
                    Create Post
                  </div>
                </TouchFeedback>
              )}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {posts.map((post) => (
                <div key={post.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {post.authorAvatar ? (
                        <img
                          src={post.authorAvatar}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        post.authorName.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {post.authorName}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(post.timestamp)}
                          </p>
                        </div>
                        
                        <TouchFeedback onTap={() => {}}>
                          <div className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                            <FiMoreVertical size={16} />
                          </div>
                        </TouchFeedback>
                      </div>
                      
                      <p className="text-gray-700 dark:text-gray-300 mb-3">
                        {post.content}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <TouchFeedback onTap={() => {}}>
                          <div className="flex items-center gap-1 hover:text-red-500">
                            <FiHeart size={16} />
                            <span>{post.likes}</span>
                          </div>
                        </TouchFeedback>
                        
                        <TouchFeedback onTap={() => {}}>
                          <div className="flex items-center gap-1 hover:text-blue-500">
                            <FiMessageSquare size={16} />
                            <span>{post.comments}</span>
                          </div>
                        </TouchFeedback>
                        
                        <TouchFeedback onTap={() => {}}>
                          <div className="flex items-center gap-1 hover:text-green-500">
                            <FiShare2 size={16} />
                            <span>{post.shares}</span>
                          </div>
                        </TouchFeedback>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Post creation modal */}
        {showPostForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center sm:justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Create Post</h3>
                  <TouchFeedback onTap={() => setShowPostForm(false)}>
                    <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                      <FiArrowLeft size={20} className="rotate-45" />
                    </div>
                  </TouchFeedback>
                </div>
              </div>
              
              <form onSubmit={handleCreatePost} className="p-4">
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full h-32 p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                
                <div className="flex gap-3 mt-4">
                  <TouchFeedback onTap={() => setShowPostForm(false)}>
                    <div className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-700 rounded-lg text-center font-medium">
                      Cancel
                    </div>
                  </TouchFeedback>
                  
                  <TouchFeedback onTap={handleCreatePost}>
                    <div className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg text-center font-medium">
                      Post
                    </div>
                  </TouchFeedback>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show groups list
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <TouchFeedback onTap={() => navigate(-1)}>
            <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
              <FiArrowLeft size={20} />
            </div>
          </TouchFeedback>
          <h1 className="text-xl font-bold">Groups</h1>
        </div>
        
        <TouchFeedback onTap={() => setShowCreateForm(true)}>
          <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <FiPlus size={20} />
          </div>
        </TouchFeedback>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full border-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex">
          {[
            { key: 'discover', label: 'Discover' },
            { key: 'my-groups', label: 'My Groups' },
            ...(searchQuery ? [{ key: 'search', label: 'Search Results' }] : [])
          ].map((tab) => (
            <TouchFeedback key={tab.key} onTap={() => setActiveTab(tab.key as any)}>
              <div className={`flex-1 py-3 text-center text-sm font-medium border-b-2 ${
                activeTab === tab.key
                  ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 border-transparent'
              }`}>
                {tab.label}
              </div>
            </TouchFeedback>
          ))}
        </div>
      </div>

      {/* Connection status */}
      {!isConnected && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
            Connecting to groups...
          </p>
        </div>
      )}

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto p-4">
        {(() => {
          const currentGroups = 
            activeTab === 'my-groups' ? myGroups :
            activeTab === 'search' ? searchResults :
            groups;

          if (currentGroups.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <FiUsers size={24} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {activeTab === 'my-groups' ? 'No groups joined yet' : 
                   activeTab === 'search' ? 'No groups found' : 
                   'No groups available'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {activeTab === 'my-groups' ? 'Join or create a group to get started!' :
                   activeTab === 'search' ? 'Try a different search term' :
                   'Be the first to create a group!'}
                </p>
                <TouchFeedback onTap={() => setShowCreateForm(true)}>
                  <div className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium">
                    Create Group
                  </div>
                </TouchFeedback>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {currentGroups.map((group) => (
                <TouchFeedback
                  key={group.id}
                  onTap={() => navigate(`/groups/${group.id}`)}
                  className="block"
                >
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {group.avatar ? (
                          <img
                            src={group.avatar}
                            alt=""
                            className="w-full h-full rounded-lg object-cover"
                          />
                        ) : (
                          group.name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {group.name}
                          </h3>
                          {group.isPrivate && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                              Private
                            </span>
                          )}
                        </div>
                        
                        {group.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                            {group.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <FiUsers size={12} />
                            {formatMemberCount(group.memberCount)}
                          </span>
                          <span>•</span>
                          <span>{group.category}</span>
                          {group.lastActivity && (
                            <>
                              <span>•</span>
                              <span>Active {formatTime(group.lastActivity)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TouchFeedback>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Create group modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center sm:justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Create Group</h3>
                <TouchFeedback onTap={() => setShowCreateForm(false)}>
                  <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                    <FiArrowLeft size={20} className="rotate-45" />
                  </div>
                </TouchFeedback>
              </div>
            </div>
            
            <form onSubmit={handleCreateGroup} className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What's this group about?"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={groupCategory}
                  onChange={(e) => setGroupCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  <option value="general">General</option>
                  <option value="technology">Technology</option>
                  <option value="gaming">Gaming</option>
                  <option value="music">Music</option>
                  <option value="art">Art & Design</option>
                  <option value="sports">Sports</option>
                  <option value="education">Education</option>
                  <option value="business">Business</option>
                  <option value="lifestyle">Lifestyle</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={groupTags}
                  onChange={(e) => setGroupTags(e.target.value)}
                  placeholder="tech, coding, community (comma separated)"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="private"
                  checked={isPrivateGroup}
                  onChange={(e) => setIsPrivateGroup(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="private" className="text-sm text-gray-700 dark:text-gray-300">
                  Private group (members need approval to join)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <TouchFeedback onTap={() => setShowCreateForm(false)}>
                  <div className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-700 rounded-lg text-center font-medium">
                    Cancel
                  </div>
                </TouchFeedback>
                
                <TouchFeedback onTap={handleCreateGroup}>
                  <div className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg text-center font-medium">
                    Create Group
                  </div>
                </TouchFeedback>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



