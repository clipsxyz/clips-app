import { useState, useEffect, useCallback } from 'react';
import { useWebSocket, WebSocketMessage } from './useWebSocket';
import { useAuth } from '../context/Auth';

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  coverImage?: string;
  createdBy: string;
  createdAt: number;
  memberCount: number;
  postCount: number;
  isPrivate: boolean;
  requiresApproval: boolean;
  category: string;
  tags: string[];
  rules?: string[];
  settings: {
    allowMemberPosts: boolean;
    allowMemberInvites: boolean;
    allowDiscussions: boolean;
    allowEvents: boolean;
    moderationLevel: 'low' | 'medium' | 'high';
  };
  userRole?: 'owner' | 'admin' | 'moderator' | 'member' | 'pending' | 'none';
  lastActivity?: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: number;
  lastActive?: number;
  isOnline: boolean;
}

export interface GroupPost {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'poll' | 'event' | 'discussion';
  attachments?: {
    type: 'image' | 'video' | 'file';
    url: string;
    name?: string;
    size?: number;
  }[];
  timestamp: number;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isPinned: boolean;
  tags?: string[];
  metadata?: {
    pollOptions?: { id: string; text: string; votes: number }[];
    eventDate?: number;
    eventLocation?: string;
    discussionTopic?: string;
  };
}

export interface GroupEvent {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  startDate: number;
  endDate?: number;
  location?: string;
  isVirtual: boolean;
  virtualLink?: string;
  createdBy: string;
  attendeeCount: number;
  maxAttendees?: number;
  isAttending: boolean;
  status: 'upcoming' | 'ongoing' | 'ended' | 'cancelled';
}

export const useGroups = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<{ [groupId: string]: GroupMember[] }>({});
  const [groupPosts, setGroupPosts] = useState<{ [groupId: string]: GroupPost[] }>({});
  const [groupEvents, setGroupEvents] = useState<{ [groupId: string]: GroupEvent[] }>({});
  const [searchResults, setSearchResults] = useState<Group[]>([]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
    switch (wsMessage.type) {
      case 'group_created':
        handleGroupCreated(wsMessage.data);
        break;
      case 'group_updated':
        handleGroupUpdated(wsMessage.data);
        break;
      case 'group_deleted':
        handleGroupDeleted(wsMessage.data);
        break;
      case 'group_member_joined':
        handleMemberJoined(wsMessage.data);
        break;
      case 'group_member_left':
        handleMemberLeft(wsMessage.data);
        break;
      case 'group_member_role_changed':
        handleMemberRoleChanged(wsMessage.data);
        break;
      case 'group_post_created':
        handleGroupPostCreated(wsMessage.data);
        break;
      case 'group_post_updated':
        handleGroupPostUpdated(wsMessage.data);
        break;
      case 'group_post_deleted':
        handleGroupPostDeleted(wsMessage.data);
        break;
      case 'group_event_created':
        handleGroupEventCreated(wsMessage.data);
        break;
      case 'group_event_updated':
        handleGroupEventUpdated(wsMessage.data);
        break;
      case 'group_search_results':
        handleGroupSearchResults(wsMessage.data);
        break;
    }
  }, []);

  const { isConnected, send } = useWebSocket({
    onMessage: handleWebSocketMessage
  });

  // Handle group events
  const handleGroupCreated = useCallback((group: Group) => {
    setGroups(prev => [group, ...prev]);
    if (group.createdBy === user?.id) {
      setMyGroups(prev => [group, ...prev]);
    }
  }, [user?.id]);

  const handleGroupUpdated = useCallback((updatedGroup: Group) => {
    setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    setMyGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    
    if (activeGroup?.id === updatedGroup.id) {
      setActiveGroup(updatedGroup);
    }
  }, [activeGroup]);

  const handleGroupDeleted = useCallback((data: { groupId: string }) => {
    setGroups(prev => prev.filter(g => g.id !== data.groupId));
    setMyGroups(prev => prev.filter(g => g.id !== data.groupId));
    
    if (activeGroup?.id === data.groupId) {
      setActiveGroup(null);
    }
  }, [activeGroup]);

  const handleMemberJoined = useCallback((data: { groupId: string; member: GroupMember }) => {
    setGroupMembers(prev => ({
      ...prev,
      [data.groupId]: [...(prev[data.groupId] || []), data.member]
    }));

    // Update group member count
    setGroups(prev => prev.map(g => 
      g.id === data.groupId ? { ...g, memberCount: g.memberCount + 1 } : g
    ));
  }, []);

  const handleMemberLeft = useCallback((data: { groupId: string; userId: string }) => {
    setGroupMembers(prev => ({
      ...prev,
      [data.groupId]: (prev[data.groupId] || []).filter(m => m.userId !== data.userId)
    }));

    // Update group member count
    setGroups(prev => prev.map(g => 
      g.id === data.groupId ? { ...g, memberCount: Math.max(0, g.memberCount - 1) } : g
    ));
  }, []);

  const handleMemberRoleChanged = useCallback((data: { groupId: string; userId: string; newRole: GroupMember['role'] }) => {
    setGroupMembers(prev => ({
      ...prev,
      [data.groupId]: (prev[data.groupId] || []).map(m => 
        m.userId === data.userId ? { ...m, role: data.newRole } : m
      )
    }));
  }, []);

  const handleGroupPostCreated = useCallback((post: GroupPost) => {
    setGroupPosts(prev => ({
      ...prev,
      [post.groupId]: [post, ...(prev[post.groupId] || [])]
    }));

    // Update group post count
    setGroups(prev => prev.map(g => 
      g.id === post.groupId ? { ...g, postCount: g.postCount + 1, lastActivity: post.timestamp } : g
    ));
  }, []);

  const handleGroupPostUpdated = useCallback((updatedPost: GroupPost) => {
    setGroupPosts(prev => ({
      ...prev,
      [updatedPost.groupId]: (prev[updatedPost.groupId] || []).map(p => 
        p.id === updatedPost.id ? updatedPost : p
      )
    }));
  }, []);

  const handleGroupPostDeleted = useCallback((data: { groupId: string; postId: string }) => {
    setGroupPosts(prev => ({
      ...prev,
      [data.groupId]: (prev[data.groupId] || []).filter(p => p.id !== data.postId)
    }));

    // Update group post count
    setGroups(prev => prev.map(g => 
      g.id === data.groupId ? { ...g, postCount: Math.max(0, g.postCount - 1) } : g
    ));
  }, []);

  const handleGroupEventCreated = useCallback((event: GroupEvent) => {
    setGroupEvents(prev => ({
      ...prev,
      [event.groupId]: [event, ...(prev[event.groupId] || [])]
    }));
  }, []);

  const handleGroupEventUpdated = useCallback((updatedEvent: GroupEvent) => {
    setGroupEvents(prev => ({
      ...prev,
      [updatedEvent.groupId]: (prev[updatedEvent.groupId] || []).map(e => 
        e.id === updatedEvent.id ? updatedEvent : e
      )
    }));
  }, []);

  const handleGroupSearchResults = useCallback((results: Group[]) => {
    setSearchResults(results);
  }, []);

  // Create group
  const createGroup = useCallback(async (groupData: {
    name: string;
    description?: string;
    category: string;
    tags?: string[];
    isPrivate?: boolean;
    requiresApproval?: boolean;
    rules?: string[];
    settings?: Partial<Group['settings']>;
  }) => {
    if (!user || !isConnected) return null;

    const group: Omit<Group, 'id' | 'memberCount' | 'postCount' | 'createdAt'> = {
      name: groupData.name,
      description: groupData.description,
      createdBy: user.id,
      isPrivate: groupData.isPrivate || false,
      requiresApproval: groupData.requiresApproval || false,
      category: groupData.category,
      tags: groupData.tags || [],
      rules: groupData.rules,
      settings: {
        allowMemberPosts: true,
        allowMemberInvites: true,
        allowDiscussions: true,
        allowEvents: true,
        moderationLevel: 'medium',
        ...groupData.settings
      },
      userRole: 'owner'
    };

    return send({
      type: 'create_group',
      data: group,
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Join group
  const joinGroup = useCallback((groupId: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'join_group',
      data: { groupId, userId: user.id },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Leave group
  const leaveGroup = useCallback((groupId: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'leave_group',
      data: { groupId, userId: user.id },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Create group post
  const createGroupPost = useCallback((groupId: string, postData: {
    content: string;
    type?: GroupPost['type'];
    attachments?: GroupPost['attachments'];
    tags?: string[];
    metadata?: GroupPost['metadata'];
  }) => {
    if (!user || !isConnected) return;

    const post: Omit<GroupPost, 'id' | 'timestamp' | 'likes' | 'comments' | 'shares' | 'isLiked' | 'isPinned'> = {
      groupId,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.profileImage,
      content: postData.content,
      type: postData.type || 'text',
      attachments: postData.attachments,
      tags: postData.tags,
      metadata: postData.metadata
    };

    send({
      type: 'create_group_post',
      data: post,
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Create group event
  const createGroupEvent = useCallback((groupId: string, eventData: {
    title: string;
    description?: string;
    startDate: number;
    endDate?: number;
    location?: string;
    isVirtual?: boolean;
    virtualLink?: string;
    maxAttendees?: number;
  }) => {
    if (!user || !isConnected) return;

    const event: Omit<GroupEvent, 'id' | 'attendeeCount' | 'isAttending' | 'status'> = {
      groupId,
      title: eventData.title,
      description: eventData.description,
      startDate: eventData.startDate,
      endDate: eventData.endDate,
      location: eventData.location,
      isVirtual: eventData.isVirtual || false,
      virtualLink: eventData.virtualLink,
      createdBy: user.id,
      maxAttendees: eventData.maxAttendees
    };

    send({
      type: 'create_group_event',
      data: event,
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Search groups
  const searchGroups = useCallback((query: string, filters?: {
    category?: string;
    tags?: string[];
    isPrivate?: boolean;
  }) => {
    if (!isConnected) return;

    send({
      type: 'search_groups',
      data: { query, filters },
      timestamp: Date.now()
    });
  }, [isConnected, send]);

  // Load group data
  const loadGroupData = useCallback((groupId: string) => {
    if (!isConnected) return;

    send({
      type: 'load_group_data',
      data: { groupId },
      timestamp: Date.now()
    });
  }, [isConnected, send]);

  // Update group role
  const updateMemberRole = useCallback((groupId: string, userId: string, newRole: GroupMember['role']) => {
    if (!user || !isConnected) return;

    send({
      type: 'update_member_role',
      data: { groupId, userId, newRole, updatedBy: user.id },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Remove member
  const removeMember = useCallback((groupId: string, userId: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'remove_member',
      data: { groupId, userId, removedBy: user.id },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Load initial data
  useEffect(() => {
    if (user && isConnected) {
      send({
        type: 'load_groups',
        data: { userId: user.id },
        timestamp: Date.now()
      });

      send({
        type: 'load_my_groups',
        data: { userId: user.id },
        timestamp: Date.now()
      });
    }
  }, [user, isConnected, send]);

  return {
    groups: groups.sort((a, b) => (b.lastActivity || b.createdAt) - (a.lastActivity || a.createdAt)),
    myGroups: myGroups.sort((a, b) => (b.lastActivity || b.createdAt) - (a.lastActivity || a.createdAt)),
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
    loadGroupData,
    updateMemberRole,
    removeMember
  };
};
