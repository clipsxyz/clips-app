import raw from '../data/posts.json';
import type { Post, Comment } from '../types';

/**
 * MOCK API - TO SWAP WITH REAL BACKEND
 * 
 * BACKEND ENDPOINTS (Laravel):
 * - GET /api/posts?filter={filter}&cursor={cursor} - Fetch posts (filter: finglas, dublin, ireland, following)
 * - POST /api/posts - Create new post
 * - PUT /api/posts/{id}/like - Toggle like
 * - PUT /api/posts/{id}/follow - Toggle follow author
 * - POST /api/posts/{id}/comments - Add comment
 * - POST /api/posts/{id}/views - Increment views
 * - POST /api/posts/{id}/shares - Increment shares
 * - POST /api/posts/{id}/reclips - Add reclip
 * - GET /api/users/{handle} - Get user profile
 * 
 * FRONTEND -> BACKEND FIELD MAPPING:
 * - userHandle -> user_handle (in posts table)
 * - text -> text_content (in posts table)
 * - stats.likes -> likes_count
 * - stats.views -> views_count
 * - stats.comments -> comments_count
 * - stats.shares -> shares_count
 * - stats.reclips -> reclips_count
 * - mediaUrl -> media_url
 * - mediaType -> media_type
 * - locationLabel -> location_label
 * - userLocal/userRegional/userNational -> stored in User model, not in posts
 */

// Helper function to get user location data from handle
function getUserLocationFromHandle(userHandle: string): { local: string; regional: string; national: string } {
  const handleLower = userHandle.toLowerCase();

  // Extract location from handle
  if (handleLower.includes('finglas')) {
    return { local: 'Finglas', regional: 'Dublin', national: 'Ireland' };
  } else if (handleLower.includes('artane')) {
    return { local: 'Artane', regional: 'Dublin', national: 'Ireland' };
  } else if (handleLower.includes('dublin')) {
    return { local: 'Dublin', regional: 'Dublin', national: 'Ireland' };
  } else if (handleLower.includes('ireland')) {
    return { local: 'Various', regional: 'Various', national: 'Ireland' };
  } else if (handleLower.includes('ballymun')) {
    return { local: 'Ballymun', regional: 'Dublin', national: 'Ireland' };
  } else if (handleLower.includes('newyork') || handleLower.includes('new york')) {
    return { local: 'New York', regional: 'New York', national: 'USA' };
  } else if (handleLower.includes('london')) {
    return { local: 'London', regional: 'London', national: 'UK' };
  } else if (handleLower.includes('paris')) {
    return { local: 'Paris', regional: 'Paris', national: 'France' };
  } else if (handleLower.includes('tokyo')) {
    return { local: 'Tokyo', regional: 'Tokyo', national: 'Japan' };
  } else if (handleLower.includes('sydney')) {
    return { local: 'Sydney', regional: 'NSW', national: 'Australia' };
  }

  // Default - return empty locations
  return { local: '', regional: '', national: '' };
}

// Create a persistent posts array that won't be reset
let posts: Post[] = [];
let postsInitialized = false;

// Initialize posts only once
if (!postsInitialized) {
  console.log('Initializing posts array...');
  posts = (raw as Post[]).map((p, index) => {
    const location = getUserLocationFromHandle(p.userHandle);
    return {
      ...p,
      id: `post-${p.id}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Make IDs truly unique
      ...location
    };
  });
  postsInitialized = true;

  // Debug: Log initial posts
  console.log('Initial posts loaded:', posts.length);
  console.log('Initial post IDs:', posts.map(p => p.id));
  console.log('Posts array created at:', new Date().toISOString());
  console.log('Posts array reference ID:', Math.random().toString(36).substr(2, 9));

  // Check for duplicates
  const duplicateIds = posts.filter((p, i) => posts.findIndex(other => other.id === p.id) !== i);
  if (duplicateIds.length > 0) {
    console.error('DUPLICATE IDs FOUND:', duplicateIds.map(p => p.id));
  } else {
    console.log('No duplicate IDs found in initial posts');
  }

  // Add mock posts for test user from Artane
  const artanePosts: Post[] = [
    {
      id: `artane-post-1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Artane, Dublin',
      tags: ['Dublin', 'local', 'community'],
      text: 'Beautiful sunny day in Artane! The community here is amazing. Love living in this part of Dublin. The parks, the people, everything about this area makes it special. 📍',
      stats: { likes: 23, views: 156, comments: 5, shares: 2, reclips: 1 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    } as Post,
    {
      id: `artane-post-2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Artane, Dublin',
      tags: ['food', 'dublin', 'ireland'],
      text: 'Just had the most amazing brunch at the local cafe! The Irish breakfast is unbeatable. Highly recommend this spot if you ever find yourself in the area. Full of flavour and the service is top-notch! 🍳🥓',
      stats: { likes: 45, views: 312, comments: 12, shares: 8, reclips: 3 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    } as Post,
    {
      id: `artane-post-3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Artane, Dublin',
      tags: ['travel', 'views', 'ireland'],
      mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'video',
      caption: 'Stunning views from Howth Hill looking back towards Dublin',
      stats: { likes: 67, views: 445, comments: 8, shares: 4, reclips: 2 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    },
    {
      id: `artane-post-4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Dublin City Centre',
      tags: ['city', 'dublin', 'architecture'],
      mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      mediaType: 'video',
      caption: 'Walking through the vibrant streets of Dublin',
      stats: { likes: 89, views: 678, comments: 15, shares: 7, reclips: 5 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    },
    {
      id: `artane-post-5-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Artane, Dublin',
      tags: ['thoughts', 'life', 'inspiration'],
      text: 'Life in Dublin is never boring. There\'s always something happening, someone to meet, a new place to discover. Grateful to call this city home. The energy here is infectious! 🌟',
      stats: { likes: 34, views: 189, comments: 6, shares: 3, reclips: 1 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    } as Post,
    {
      id: `artane-post-6-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Phoenix Park, Dublin',
      tags: ['nature', 'dublin', 'outdoors'],
      mediaUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      mediaType: 'image',
      caption: 'Perfect morning walk in Phoenix Park! The deer are out and about 🦌',
      stats: { likes: 42, views: 287, comments: 7, shares: 4, reclips: 2 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    }
  ];

  posts = [...posts, ...artanePosts];
} else {
  console.log('Posts array already initialized, length:', posts.length);
}

// Mock comment data storage (without replies)
let comments: Comment[] = [
  {
    id: 'comment-1',
    postId: '1',
    userHandle: 'Alice@Dublin',
    text: 'This looks amazing! Where is this taken?',
    createdAt: Date.now() - 3600000, // 1 hour ago
    likes: 3,
    userLiked: false,
    replies: [
      {
        id: 'reply-1',
        postId: '1',
        userHandle: 'Bob@Finglas',
        text: 'It\'s at Phoenix Park! Great spot for photos.',
        createdAt: Date.now() - 3000000, // 50 minutes ago
        likes: 1,
        userLiked: false,
        parentId: 'comment-1'
      },
      {
        id: 'reply-2',
        postId: '1',
        userHandle: 'Charlie@Ireland',
        text: 'I was there last week, beautiful place!',
        createdAt: Date.now() - 2400000, // 40 minutes ago
        likes: 0,
        userLiked: false,
        parentId: 'comment-1'
      }
    ],
    replyCount: 2,
  },
  {
    id: 'comment-2',
    postId: '1',
    userHandle: 'Bob@Finglas',
    text: 'Great shot! 📸',
    createdAt: Date.now() - 1800000, // 30 minutes ago
    likes: 1,
    userLiked: false,
    replies: [],
    replyCount: 0,
  },
  {
    id: 'comment-3',
    postId: '2',
    userHandle: 'Charlie@Ireland',
    text: 'That brunch looks delicious! What cafe is this?',
    createdAt: Date.now() - 7200000, // 2 hours ago
    likes: 0,
    userLiked: false,
    replies: [
      {
        id: 'reply-3',
        postId: '2',
        userHandle: 'Alice@Dublin',
        text: 'It\'s The Fumbally! Best brunch in Dublin.',
        createdAt: Date.now() - 6000000, // 1 hour 40 minutes ago
        likes: 2,
        userLiked: false,
        parentId: 'comment-3'
      }
    ],
    replyCount: 1,
  }
];

type UserState = {
  likes: Record<string, boolean>;
  bookmarks: Record<string, boolean>;
  follows: Record<string, boolean>
};

const userState: Record<string, UserState> = {};

function getState(userId: string): UserState {
  if (!userState[userId]) {
    userState[userId] = { likes: {}, bookmarks: {}, follows: {} };
  }
  return userState[userId];
}

const delay = (ms = 250) => new Promise(r => setTimeout(r, ms));

export type Page = { items: Post[]; nextCursor: number | null };

// Get list of user handles that the current user follows
export async function getFollowedUsers(userId: string): Promise<string[]> {
  await delay();
  const s = getState(userId);
  return Object.keys(s.follows).filter(handle => s.follows[handle] === true);
}

// compute view for a user
function decorateForUser(userId: string, p: Post): Post {
  const s = getState(userId);
  return {
    ...p,
    userLiked: !!s.likes[p.id],
    isBookmarked: !!s.bookmarks[p.id],
    isFollowing: !!s.follows[p.userHandle]
  };
}

export async function fetchPostsPage(tab: string, cursor: number | null, limit = 5, userId = 'me', userLocal = '', userRegional = '', userNational = ''): Promise<Page> {
  try {
    await delay();
    const t = tab.toLowerCase();

    // Debug: Log posts array state
    console.log('fetchPostsPage called with posts array length:', posts.length);
    console.log('Current posts IDs:', posts.map(p => p.id));

    console.log('Fetching posts for tab:', t, 'with user data:', {
      userId,
      userLocal,
      userRegional,
      userNational,
      totalPosts: posts.length
    });

    const filtered = posts.filter(p => {
      if (t === 'following') {
        const userState = getState(userId);
        const isFollowing = userState.follows[p.userHandle];
        // Only show posts from users you actually follow
        return isFollowing === true;
      }

      // Check if this is a custom location search (not one of the predefined tabs)
      const predefinedTabs = ['finglas', 'dublin', 'ireland', 'following'];
      if (!predefinedTabs.includes(t)) {
        // Custom location search - match user's location fields (case-insensitive)
        const searchLocation = t;
        const userLocalMatch = p.userLocal?.toLowerCase().includes(searchLocation);
        const userRegionalMatch = p.userRegional?.toLowerCase().includes(searchLocation);
        const userNationalMatch = p.userNational?.toLowerCase().includes(searchLocation);

        return userLocalMatch || userRegionalMatch || userNationalMatch;
      }

      // Predefined tab filtering - show only posts from users in that location
      if (t === 'finglas') {
        // Show posts from users who selected Finglas as their local location
        return p.userLocal === 'Finglas';
      }
      if (t === 'dublin') {
        // Show posts from users who selected Dublin as their regional location
        return p.userRegional === 'Dublin';
      }
      if (t === 'ireland') {
        // Show posts from users who selected Ireland as their national location
        return p.userNational === 'Ireland';
      }

      // Fallback - check location fields
      return p.userLocal?.toLowerCase().includes(t) ||
        p.userRegional?.toLowerCase().includes(t) ||
        p.userNational?.toLowerCase().includes(t);
    });

    console.log('Filtered posts for', t, ':', filtered.length, 'posts');
    console.log('All posts:', posts.map(p => ({ userHandle: p.userHandle, text: p.text, mediaUrl: p.mediaUrl })));
    console.log('Filtered posts:', filtered.map(p => ({ userHandle: p.userHandle, text: p.text, mediaUrl: p.mediaUrl })));

    const start = cursor ?? 0;
    const slice = filtered.slice(start, start + limit).map(p => decorateForUser(userId, p));
    const next = start + slice.length < filtered.length ? start + slice.length : null;

    console.log('Returning page with:', { itemsCount: slice.length, nextCursor: next });
    return { items: slice, nextCursor: next };
  } catch (error) {
    console.error('Error in fetchPostsPage:', error);
    throw error;
  }
}

export async function toggleLike(userId: string, id: string): Promise<Post> {
  await delay(150);
  const s = getState(userId);
  const p = posts.find(x => x.id === id)!;
  const was = !!s.likes[id];
  s.likes[id] = !was;
  p.stats.likes += was ? -1 : 1;
  return decorateForUser(userId, p);
}

export async function toggleBookmark(userId: string, id: string): Promise<Post> {
  await delay(150);
  const s = getState(userId);
  s.bookmarks[id] = !s.bookmarks[id];
  const p = posts.find(x => x.id === id)!;
  return decorateForUser(userId, p);
}

export async function toggleFollowForPost(userId: string, id: string): Promise<Post> {
  await delay(150);
  const p = posts.find(x => x.id === id)!;
  const s = getState(userId);
  s.follows[p.userHandle] = !s.follows[p.userHandle];
  return decorateForUser(userId, p);
}

export async function incrementViews(userId: string, id: string): Promise<Post> {
  await delay(100);
  const p = posts.find(x => x.id === id);
  if (!p) {
    console.error('Post not found for incrementViews:', id);
    console.log('Available post IDs:', posts.map(post => post.id));
    // Don't throw error, just return a dummy post to prevent crashes
    return {
      id,
      userHandle: 'Unknown',
      locationLabel: 'Unknown Location',
      tags: [],
      mediaUrl: '',
      stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false
    };
  }
  p.stats.views += 1;
  return decorateForUser(userId, p);
}

export async function incrementShares(userId: string, id: string): Promise<Post> {
  await delay(100);
  const p = posts.find(x => x.id === id);
  if (!p) {
    console.error('Post not found for incrementShares:', id);
    throw new Error(`Post with id ${id} not found`);
  }
  p.stats.shares += 1;
  return decorateForUser(userId, p);
}

export async function incrementReclips(userId: string, id: string): Promise<Post> {
  await delay(100);
  const p = posts.find(x => x.id === id);
  if (!p) {
    console.error('Post not found for incrementReclips:', id);
    throw new Error(`Post with id ${id} not found`);
  }
  p.stats.reclips += 1;
  return decorateForUser(userId, p);
}

export async function reclipPost(userId: string, originalPostId: string, userHandle: string): Promise<Post> {
  await delay(200);
  const originalPost = posts.find(x => x.id === originalPostId);
  if (!originalPost) {
    console.error('Original post not found for reclipPost:', originalPostId);
    throw new Error(`Original post with id ${originalPostId} not found`);
  }

  // Increment reclip count on original post
  originalPost.stats.reclips += 1;

  // Create a new reclipped post
  const reclippedPost: Post = {
    ...originalPost,
    id: `reclip-${userId}-${originalPostId}-${Date.now()}`,
    userHandle: userHandle, // Current user's handle
    isReclipped: true,
    originalPostId: originalPostId,
    reclippedBy: userId,
    isBookmarked: false,
    isFollowing: false,
    userLiked: false,
    stats: { ...originalPost.stats } // Copy stats but don't inherit user interactions
  };

  // Add to posts array
  posts.push(reclippedPost);

  return decorateForUser(userId, reclippedPost);
}

// Comment API functions (without replies)
export async function fetchComments(postId: string): Promise<Comment[]> {
  await delay(200);
  return comments.filter(c => c.postId === postId);
}

export async function addComment(postId: string, userHandle: string, text: string): Promise<Comment> {
  await delay(300);
  const comment: Comment = {
    id: crypto.randomUUID(),
    postId,
    userHandle,
    text,
    createdAt: Date.now(),
    likes: 0,
    userLiked: false,
  };
  comments.push(comment);

  // Update post comment count
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.stats.comments += 1;
  }

  return comment;
}

export async function toggleCommentLike(commentId: string): Promise<Comment> {
  await delay(100);
  const comment = comments.find(c => c.id === commentId);
  if (!comment) {
    throw new Error('Comment not found');
  }

  // Toggle the like state
  comment.userLiked = !comment.userLiked;
  comment.likes += comment.userLiked ? 1 : -1;

  return comment;
}

export async function toggleReplyLike(parentCommentId: string, replyId: string): Promise<Comment> {
  await delay(100);
  const parentComment = comments.find(c => c.id === parentCommentId);
  if (!parentComment || !parentComment.replies) {
    throw new Error('Parent comment or replies not found');
  }

  const reply = parentComment.replies.find(r => r.id === replyId);
  if (!reply) {
    throw new Error('Reply not found');
  }

  // Toggle the like state
  reply.userLiked = !reply.userLiked;
  reply.likes += reply.userLiked ? 1 : -1;

  return parentComment;
}

export async function addReply(postId: string, parentId: string, userHandle: string, text: string): Promise<Comment> {
  await delay(300);
  const reply: Comment = {
    id: crypto.randomUUID(),
    postId,
    userHandle,
    text,
    createdAt: Date.now(),
    likes: 0,
    userLiked: false,
    parentId,
  };

  // Add reply to the parent comment
  const parentComment = comments.find(c => c.id === parentId);
  if (parentComment) {
    if (!parentComment.replies) {
      parentComment.replies = [];
    }
    parentComment.replies.push(reply);
    parentComment.replyCount = (parentComment.replyCount || 0) + 1;
  }

  return reply;
}

export async function createPost(
  userId: string,
  userHandle: string,
  text: string,
  location: string,
  imageUrl?: string,
  mediaType?: 'image' | 'video',
  imageText?: string,
  caption?: string,
  userLocal?: string,
  userRegional?: string,
  userNational?: string
): Promise<Post> {
  await delay(500);

  console.log('Creating post with:', {
    userId,
    userHandle,
    text,
    location,
    imageUrl,
    mediaType,
    imageText,
    caption,
    userLocal,
    userRegional,
    userNational
  });

  // Get location from user data if provided, otherwise infer from handle
  const locationData = userLocal && userRegional && userNational
    ? { userLocal, userRegional, userNational }
    : getUserLocationFromHandle(userHandle);

  const newPost: Post = {
    id: `${crypto.randomUUID()}-${Date.now()}`,
    userHandle,
    locationLabel: location || 'Unknown Location',
    tags: [], // Could extract hashtags from text later
    mediaUrl: imageUrl || '', // Empty string for text-only posts
    mediaType: mediaType || undefined, // No media type for text-only posts
    text: text || undefined, // Store the text content
    imageText: imageText || undefined, // Store the image text overlay
    caption: caption || undefined, // Store the caption for image/video posts
    stats: {
      likes: 0,
      views: 0,
      comments: 0,
      shares: 0,
      reclips: 0
    },
    isBookmarked: false,
    isFollowing: false,
    userLiked: false,
    ...locationData
  };

  // Add to posts array (at the beginning for newest first)
  posts.unshift(newPost);

  console.log('Post created and added to posts array. Total posts:', posts.length);
  console.log('New post:', newPost);
  console.log('All post IDs:', posts.map(p => p.id));
  console.log('Posts array length before createPost:', posts.length);
  console.log('Posts array length after createPost:', posts.length);

  return decorateForUser(userId, newPost);
}