import raw from '../data/posts.json';
import type { Post, Comment, StickerOverlay } from '../types';

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
export let posts: Post[] = [];
let postsInitialized = false;

// Initialize posts only once
if (!postsInitialized) {
  console.log('Initializing posts array...');
  const now = Date.now();
  // Generate timestamps spread over the last 7 days for variety
  posts = (raw as Post[]).map((p, index) => {
    const location = getUserLocationFromHandle(p.userHandle);
    // Extract timestamp from ID if it exists, otherwise generate one
    const timestampMatch = p.id?.match(/\d{13}/);
    const createdAt = timestampMatch
      ? parseInt(timestampMatch[0], 10)
      : now - (index * 3600000); // Spread posts over hours (1 hour apart)

    return {
      ...p,
      id: `post-${p.id}-${index}-${createdAt}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt,
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
  const artaneNow = Date.now();
  const artanePosts: Post[] = [
    {
      id: `artane-post-1-${artaneNow}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Artane, Dublin',
      tags: ['Dublin', 'local', 'community'],
      text: 'Beautiful sunny day in Artane! The community here is amazing. Love living in this part of Dublin. The parks, the people, everything about this area makes it special. 📍',
      createdAt: artaneNow - 1800000, // 30 minutes ago
      stats: { likes: 23, views: 156, comments: 5, shares: 2, reclips: 1 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    } as Post,
    {
      id: `artane-post-2-${artaneNow - 3600000}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Artane, Dublin',
      tags: ['food', 'dublin', 'ireland'],
      text: 'Just had the most amazing brunch at the local cafe! The Irish breakfast is unbeatable. Highly recommend this spot if you ever find yourself in the area. Full of flavour and the service is top-notch! 🍳🥓',
      createdAt: artaneNow - 3600000, // 1 hour ago
      stats: { likes: 45, views: 312, comments: 12, shares: 8, reclips: 3 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    } as Post,
    {
      id: `artane-post-3-${artaneNow - 7200000}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Artane, Dublin',
      tags: ['travel', 'views', 'ireland'],
      mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'video',
      caption: 'Stunning views from Howth Hill looking back towards Dublin',
      createdAt: artaneNow - 7200000, // 2 hours ago
      stats: { likes: 67, views: 445, comments: 8, shares: 4, reclips: 2 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    },
    {
      id: `artane-post-4-${artaneNow - 86400000}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Dublin City Centre',
      tags: ['city', 'dublin', 'architecture'],
      mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      mediaType: 'video',
      caption: 'Walking through the vibrant streets of Dublin',
      createdAt: artaneNow - 86400000, // 1 day ago
      stats: { likes: 89, views: 678, comments: 15, shares: 7, reclips: 5 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    },
    {
      id: `artane-post-5-${artaneNow - 172800000}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Artane, Dublin',
      tags: ['thoughts', 'life', 'inspiration'],
      text: 'Life in Dublin is never boring. There\'s always something happening, someone to meet, a new place to discover. Grateful to call this city home. The energy here is infectious! 🌟',
      createdAt: artaneNow - 172800000, // 2 days ago
      stats: { likes: 34, views: 189, comments: 6, shares: 3, reclips: 1 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false,
      userLocal: 'Artane',
      userRegional: 'Dublin',
      userNational: 'Ireland'
    } as Post,
    {
      id: `artane-post-6-${artaneNow - 259200000}-${Math.random().toString(36).substr(2, 9)}`,
      userHandle: 'Sarah@Artane',
      locationLabel: 'Phoenix Park, Dublin',
      tags: ['nature', 'dublin', 'outdoors'],
      mediaUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      mediaType: 'image',
      caption: 'Perfect morning walk in Phoenix Park! The deer are out and about 🦌',
      createdAt: artaneNow - 259200000, // 3 days ago
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
  follows: Record<string, boolean>;
  reclips: Record<string, boolean>;
  lastViewed: Record<string, number>; // Post ID -> Epoch timestamp of last view
};

const userState: Record<string, UserState> = {};

function getState(userId: string): UserState {
  if (!userState[userId]) {
    userState[userId] = { likes: {}, bookmarks: {}, follows: {}, reclips: {}, lastViewed: {} };
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
export function decorateForUser(userId: string, p: Post): Post {
  const s = getState(userId);
  const decorated = {
    ...p,
    userLiked: !!s.likes[p.id],
    isBookmarked: !!s.bookmarks[p.id],
    isFollowing: !!s.follows[p.userHandle],
    userReclipped: !!s.reclips[p.id],
    // Explicitly preserve taggedUsers, textStyle, stickers, etc.
    taggedUsers: p.taggedUsers || undefined, // Preserve taggedUsers even if empty array
    textStyle: p.textStyle,
    stickers: p.stickers,
    mediaItems: p.mediaItems,
    templateId: p.templateId // Also preserve templateId
  };
  if (p.taggedUsers && p.taggedUsers.length > 0) {
    console.log('decorateForUser - preserving taggedUsers:', p.taggedUsers, 'for post:', p.id.substring(0, 30), 'templateId:', p.templateId);
  } else if (p.templateId && !p.taggedUsers) {
    console.log('decorateForUser - template post but NO taggedUsers:', { postId: p.id.substring(0, 30), templateId: p.templateId, originalTaggedUsers: p.taggedUsers });
  }
  return decorated;
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
        // Custom location search – map query to scope: national (country), regional (city), local (town)
        const query = t.trim().toLowerCase();
        console.log('=== CUSTOM LOCATION FILTER FOR:', query, '===');

        // Minimal lookups; can be expanded or sourced from backend later
        const countries = new Set([
          'ireland', 'uk', 'united kingdom', 'england', 'scotland', 'wales', 'france', 'spain', 'portugal', 'germany', 'netherlands', 'belgium', 'australia', 'usa', 'united states', 'canada'
        ]);
        const cities = new Set([
          'dublin', 'london', 'paris', 'madrid', 'rome', 'berlin', 'amsterdam', 'lisbon', 'vienna', 'prague', 'budapest', 'copenhagen', 'stockholm', 'oslo', 'helsinki', 'zurich', 'new york', 'toronto', 'vancouver', 'mexico city', 'tokyo', 'seoul', 'beijing', 'shanghai', 'hong kong', 'singapore', 'sydney', 'melbourne', 'auckland'
        ]);

        const normalize = (v?: string) => (v || '').trim().toLowerCase();
        const local = normalize(p.userLocal);
        const regional = normalize(p.userRegional);
        const national = normalize(p.userNational);

        let match = false;
        if (countries.has(query)) {
          // National match
          match = national === query || (query === 'uk' && (national === 'united kingdom' || national === 'uk')) || (query === 'usa' && (national === 'usa' || national === 'united states'));
        } else if (cities.has(query)) {
          // Regional (city) match
          match = regional === query;
        } else {
          // Treat as local (town) match
          match = local === query;
        }

        if (match) {
          console.log('Post MATCHING for custom filter', query, ':', {
            userHandle: p.userHandle,
            userLocal: p.userLocal,
            userRegional: p.userRegional,
            userNational: p.userNational
          });
        }

        return match;
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

      // Fallback - do not include any other posts for unknown tabs
      return false;
    });

    console.log('Filtered posts for', t, ':', filtered.length, 'posts');
    console.log('All posts with locations:', posts.map(p => ({
      userHandle: p.userHandle,
      userLocal: p.userLocal,
      userRegional: p.userRegional,
      userNational: p.userNational
    })));
    console.log('Filtered posts:', filtered.map(p => ({
      userHandle: p.userHandle,
      userLocal: p.userLocal,
      userRegional: p.userRegional,
      userNational: p.userNational
    })));

    // Sort by newest first using explicit createdAt epoch timestamps
    const sorted = filtered.slice().sort((a, b) => {
      // Use explicit createdAt timestamp (epoch in milliseconds)
      const tsA = a.createdAt || 0;
      const tsB = b.createdAt || 0;

      // Sort descending: newest first (larger timestamp = newer)
      return tsB - tsA;
    });

    // Debug: log the sorted order
    console.log('Sorted posts (first 3):', sorted.slice(0, 3).map((p, i) => ({
      index: i,
      id: p.id.substring(0, 60),
      createdAt: p.createdAt,
      timeAgo: new Date(p.createdAt).toISOString(),
      userHandle: p.userHandle
    })));

    const start = cursor ?? 0;
    const slice = sorted.slice(start, start + limit).map(p => {
      // Debug: Log ALL properties of post before decoration, especially for template posts
      if (p.templateId) {
        console.log('fetchPostsPage - template post BEFORE decorateForUser:', {
          postId: p.id.substring(0, 30),
          templateId: p.templateId,
          taggedUsers: p.taggedUsers,
          hasTaggedUsers: !!p.taggedUsers,
          taggedUsersType: typeof p.taggedUsers,
          taggedUsersIsArray: Array.isArray(p.taggedUsers),
          taggedUsersLength: p.taggedUsers?.length,
          allPostKeys: Object.keys(p)
        });
      }
      const decorated = decorateForUser(userId, p);
      // Debug: Log taggedUsers after decoration
      if (decorated.taggedUsers && decorated.taggedUsers.length > 0) {
        console.log('fetchPostsPage - post has taggedUsers AFTER decorateForUser:', { postId: decorated.id.substring(0, 30), taggedUsers: decorated.taggedUsers, templateId: decorated.templateId });
      } else if (p.templateId && !decorated.taggedUsers) {
        console.warn('fetchPostsPage - taggedUsers LOST during decoration:', {
          postId: p.id.substring(0, 30),
          templateId: p.templateId,
          originalTaggedUsers: p.taggedUsers,
          decoratedTaggedUsers: decorated.taggedUsers,
          originalHasTaggedUsers: !!p.taggedUsers,
          decoratedHasTaggedUsers: !!decorated.taggedUsers
        });
      }
      return decorated;
    });
    const next = start + slice.length < sorted.length ? start + slice.length : null;

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
      createdAt: Date.now(),
      stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
      isBookmarked: false,
      isFollowing: false,
      userLiked: false
    };
  }

  // Track when user last viewed this post (epoch timestamp)
  const s = getState(userId);
  const now = Date.now();

  // Check if post was viewed recently (within last 5 minutes)
  // This prevents double-counting if user scrolls back up
  const lastViewTime = s.lastViewed[id] || 0;
  const fiveMinutesAgo = now - (5 * 60 * 1000);

  // Only increment view count if not viewed recently
  if (lastViewTime < fiveMinutesAgo || !lastViewTime) {
    p.stats.views += 1;
  }

  // Always update the last viewed timestamp (epoch time)
  s.lastViewed[id] = now; // Store epoch timestamp of last view

  return decorateForUser(userId, p);
}

/**
 * Get the timestamp when a user last viewed a post
 * @param userId - User ID
 * @param postId - Post ID
 * @returns Epoch timestamp in milliseconds, or null if never viewed
 */
export function getLastViewedTime(userId: string, postId: string): number | null {
  const s = getState(userId);
  return s.lastViewed[postId] || null;
}

/**
 * Check if a post was viewed recently (within specified time window)
 * Useful for preventing showing the same post again immediately
 * @param userId - User ID
 * @param postId - Post ID
 * @param timeWindowMs - Time window in milliseconds (default: 5 minutes)
 * @returns true if viewed within time window, false otherwise
 */
export function wasViewedRecently(userId: string, postId: string, timeWindowMs: number = 5 * 60 * 1000): boolean {
  const lastViewTime = getLastViewedTime(userId, postId);
  if (!lastViewTime) return false;

  const now = Date.now();
  const timeSinceView = now - lastViewTime;
  return timeSinceView < timeWindowMs;
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

export async function reclipPost(userId: string, originalPostId: string, userHandle: string): Promise<{ originalPost: Post; reclippedPost: Post | null }> {
  await delay(200);
  const originalPost = posts.find(x => x.id === originalPostId);
  if (!originalPost) {
    console.error('Original post not found for reclipPost:', originalPostId);
    throw new Error(`Original post with id ${originalPostId} not found`);
  }

  // Prevent users from reclipping their own posts
  if (originalPost.userHandle === userHandle) {
    console.log('Cannot reclip your own post:', originalPostId);
    throw new Error('Cannot reclip your own post');
  }

  // Check if user has already reclipped this post
  const s = getState(userId);
  if (s.reclips[originalPostId]) {
    // User has already reclipped this post - return the original post decorated
    console.log('User has already reclipped this post:', originalPostId);
    return { originalPost: decorateForUser(userId, originalPost), reclippedPost: null };
  }

  // Track that user has reclipped this post
  s.reclips[originalPostId] = true;

  // Increment reclip count on original post
  originalPost.stats.reclips += 1;

  // Create a new reclipped post
  const reclippedPost: Post = {
    ...originalPost,
    id: `reclip-${userId}-${originalPostId}-${Date.now()}`,
    userHandle: userHandle, // Current user's handle (person who reclipped it)
    originalUserHandle: originalPost.userHandle, // Store original poster's handle
    isReclipped: true,
    originalPostId: originalPostId,
    reclippedBy: userId,
    isBookmarked: false,
    isFollowing: false,
    userLiked: false,
    userReclipped: false, // Reclipped post itself is not reclipped by the user
    stats: { ...originalPost.stats } // Copy stats but don't inherit user interactions
  };

  // Add to posts array
  posts.push(reclippedPost);

  // Return both the updated original post (decorated) and the new reclipped post
  return {
    originalPost: decorateForUser(userId, originalPost),
    reclippedPost: decorateForUser(userId, reclippedPost)
  };
}

// Comment API functions (without replies)
export async function getPostById(postId: string): Promise<Post | null> {
  await delay(100);
  const post = posts.find(p => p.id === postId);
  return post || null;
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  await delay(200);
  return comments.filter(c => c.postId === postId);
}

export async function fetchPostsByUser(userHandle: string, limit = 30): Promise<Post[]> {
  await delay(150);
  const handle = userHandle.trim().toLowerCase();
  const filtered = posts.filter(p => p.userHandle.toLowerCase() === handle);
  // newest first (ids include timestamp; also fallback to original order)
  const sorted = filtered.slice().reverse();
  return sorted.slice(0, limit);
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
  userNational?: string,
  stickers?: StickerOverlay[],
  templateId?: string,
  mediaItems?: Array<{ url: string; type: 'image' | 'video'; duration?: number }>, // Multiple media items for carousel
  bannerText?: string, // News ticker banner text
  textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string }, // Text style for text-only posts
  taggedUsers?: string[], // Array of user handles tagged in the post
  videoCaptionsEnabled?: boolean, // Whether video captions are enabled
  videoCaptionText?: string, // Caption text to display on video
  subtitlesEnabled?: boolean, // Whether video subtitles are enabled
  subtitleText?: string // Subtitle text to display on video
): Promise<Post> {
  await delay(500);

  // Debug: Log taggedUsers parameter
  console.log('createPost function - received taggedUsers parameter:', taggedUsers, 'type:', typeof taggedUsers, 'isArray:', Array.isArray(taggedUsers), 'length:', taggedUsers?.length);

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

  const postCreatedAt = Date.now(); // Epoch timestamp in milliseconds

  // If mediaItems provided, use that; otherwise fall back to single mediaUrl
  const finalMediaItems = mediaItems && mediaItems.length > 0
    ? mediaItems
    : imageUrl
      ? [{ url: imageUrl, type: mediaType || 'image' }]
      : undefined;

  const newPost: Post = {
    id: `${crypto.randomUUID()}-${postCreatedAt}`,
    userHandle,
    locationLabel: location || 'Unknown Location',
    tags: [],
    mediaUrl: imageUrl || '', // Keep for backward compatibility
    mediaType: mediaType || undefined, // Keep for backward compatibility
    mediaItems: finalMediaItems, // New: support multiple media items
    text: text || undefined, // Store the text content
    imageText: imageText || undefined, // Store the image text overlay
    caption: caption || undefined, // Store the caption for image/video posts
    createdAt: postCreatedAt, // Epoch timestamp in milliseconds
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
    stickers: stickers || undefined, // Store stickers
    templateId: templateId || undefined, // Store template ID
    bannerText: bannerText || undefined, // Store news ticker banner text
    textStyle: textStyle || undefined, // Store text style for text-only posts
    taggedUsers: taggedUsers || undefined, // Store tagged users
    videoCaptionsEnabled: videoCaptionsEnabled || undefined, // Store video captions enabled state
    videoCaptionText: videoCaptionText || undefined, // Store video caption text
    subtitlesEnabled: subtitlesEnabled || undefined, // Store video subtitles enabled state
    subtitleText: subtitleText || undefined, // Store video subtitle text
    ...locationData
  };

  // Add to posts array (at the beginning for newest first)
  posts.unshift(newPost);

  console.log('Post created and added to posts array. Total posts:', posts.length);
  console.log('New post:', newPost);
  console.log('New post taggedUsers:', newPost.taggedUsers);
  console.log('New post templateId:', newPost.templateId);

  // Verify the post in the array has taggedUsers
  const postInArray = posts[0];
  console.log('Post in array [0] taggedUsers:', postInArray?.taggedUsers);
  console.log('Post in array [0] templateId:', postInArray?.templateId);

  return decorateForUser(userId, newPost);
}

export type SearchResults = {
  locations: string[];
  users: string[];
};

export async function searchPostsAndUsers(query: string): Promise<SearchResults> {
  await delay(150);
  const q = query.trim().toLowerCase();
  if (!q) return { locations: [], users: [] };

  const locSet = new Set<string>();
  const userSet = new Set<string>();

  // Collect from posts
  posts.forEach(p => {
    if (p.locationLabel && p.locationLabel.toLowerCase().includes(q)) {
      locSet.add(p.locationLabel);
    }
    if (p.userHandle.toLowerCase().includes(q)) {
      userSet.add(p.userHandle);
    }
  });

  // Prefix-first sorting
  const sortPref = (a: string, b: string) => {
    const aPrefix = a.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.toLowerCase().startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.localeCompare(b);
  };

  const locations = Array.from(locSet).sort(sortPref).slice(0, 10);
  const users = Array.from(userSet).sort(sortPref).slice(0, 10);

  return { locations, users };
}