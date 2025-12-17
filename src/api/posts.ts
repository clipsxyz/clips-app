import raw from '../data/posts.json';
import type { Post, Comment, StickerOverlay } from '../types';
import * as apiClient from './client';
import { wasEverAStory } from './stories';

/**
 * MOCK API - TO SWAP WITH REAL BACKEND
 * 
 * BACKEND ENDPOINTS (Laravel):
 * - GET /api/posts?filter={filter}&cursor={cursor} - Fetch posts (filter: finglas, dublin, ireland, discover)
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
      tags: [],
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
      tags: [],
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
      tags: [],
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
      tags: [],
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
      tags: [],
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
      tags: [],
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

export function getState(userId: string): UserState {
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

// Transform Laravel API post response to frontend Post format
function transformLaravelPost(response: any): Post {
  const finalVideoUrl = response.final_video_url || response.finalVideoUrl;
  const originalMediaUrl = response.media_url || response.mediaUrl || '';
  
  return {
    id: response.id,
    userHandle: response.user_handle || response.userHandle,
    locationLabel: response.location_label || response.locationLabel || 'Unknown Location',
    tags: response.tags || [],
    // Use final_video_url if available (from completed render job), otherwise use original media_url
    mediaUrl: finalVideoUrl || originalMediaUrl,
    finalVideoUrl: finalVideoUrl || undefined, // Set as separate field for Media component
    mediaType: response.media_type || response.mediaType,
    mediaItems: response.media_items || response.mediaItems,
    text: response.text_content || response.text,
    imageText: response.image_text || response.imageText,
    caption: response.caption,
    createdAt: new Date(response.created_at || response.createdAt).getTime(),
    stats: {
      likes: response.likes_count || response.stats?.likes || 0,
      views: response.views_count || response.stats?.views || 0,
      comments: response.comments_count || response.stats?.comments || 0,
      shares: response.shares_count || response.stats?.shares || 0,
      reclips: response.reclips_count || response.stats?.reclips || 0,
    },
    isBookmarked: response.is_bookmarked || false,
    isFollowing: response.is_following || false,
    userLiked: response.user_liked || false,
    userReclipped: response.user_reclipped || false,
    stickers: response.stickers,
    templateId: response.template_id || response.templateId,
    bannerText: response.banner_text || response.bannerText,
    textStyle: response.text_style || response.textStyle,
    taggedUsers: response.taggedUsers || response.tagged_users,
    videoCaptionsEnabled: response.video_captions_enabled || response.videoCaptionsEnabled,
    videoCaptionText: response.video_caption_text || response.videoCaptionText,
    subtitlesEnabled: response.subtitles_enabled || response.subtitlesEnabled,
    subtitleText: response.subtitle_text || response.subtitleText,
    userLocal: response.user?.local || response.userLocal || '',
    userRegional: response.user?.regional || response.userRegional || '',
    userNational: response.user?.national || response.userNational || '',
    renderJobId: response.render_job_id || response.renderJobId,
  } as Post;
}

export async function fetchPostsPage(tab: string, cursor: number | null, limit = 5, userId = 'me', userLocal = '', userRegional = '', userNational = ''): Promise<Page> {
  // Try Laravel API first, fallback to mock if it fails
  const useLaravelAPI = import.meta.env.VITE_USE_LARAVEL_API !== 'false';
  
  if (useLaravelAPI) {
    try {
      const t = tab.toLowerCase();
      
      // Map frontend tab names to Laravel filter values
      let filter: string;
      if (t === 'discover') {
        filter = 'Following';
      } else if (t === 'finglas') {
        filter = 'Finglas';
      } else if (t === 'dublin') {
        filter = 'Dublin';
      } else if (t === 'ireland') {
        filter = 'Ireland';
      } else {
        // Custom location - use as-is (Laravel will handle it via byLocation scope)
        filter = tab.charAt(0).toUpperCase() + tab.slice(1).toLowerCase();
      }
      
      const apiCursor = cursor ?? 0;
      const response = await apiClient.fetchPostsPage(apiCursor, limit, filter, userId !== 'me' ? userId : undefined);
      
      // Transform Laravel response to frontend format
      const transformedItems = response.items.map((item: any) => transformLaravelPost(item));
      
      return {
        items: transformedItems,
        nextCursor: response.nextCursor
      };
    } catch (error: any) {
      // Only log if it's not a connection refused error (backend not running)
      if (error?.name !== 'ConnectionRefused' && !error?.message?.includes('CONNECTION_REFUSED')) {
        console.warn('Laravel API call failed, falling back to mock data:', error);
      }
      // Fall through to mock implementation
    }
  }
  
  // Mock implementation (fallback)
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
      if (t === 'discover') {
        const userState = getState(userId);
        const isFollowing = userState.follows[p.userHandle] === true;
        
        // Debug: Log what we're checking
        if (p.userHandle.includes('Sarah') || p.userHandle.includes('sarah')) {
          console.log('CHECKING SARAH POST:', {
            userId,
            userHandle: p.userHandle,
            isFollowing,
            allFollows: Object.keys(userState.follows).filter(h => userState.follows[h] === true),
            fullState: userState.follows
          });
        }
        
        return isFollowing;
      }

      if (t.toLowerCase() === 'clips') {
        // Clips tab: Show stories (posts that were originally stories) from people you follow
        const userState = getState(userId);
        const isFollowing = userState.follows[p.userHandle] === true;
        if (!isFollowing) return false;
        // Check if this post's media was from a story
        if (p.mediaUrl && wasEverAStory(p.mediaUrl)) {
          return true;
        }
        return false;
      }

      // Check if this is a custom location search (not one of the predefined tabs)
      const predefinedTabs = ['finglas', 'dublin', 'ireland', 'discover'];
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
      // Check if tab matches user's local, regional, or national (case-insensitive)
      const tabLower = t.toLowerCase();
      const userLocalLower = (p.userLocal || '').toLowerCase();
      const userRegionalLower = (p.userRegional || '').toLowerCase();
      const userNationalLower = (p.userNational || '').toLowerCase();
      
      // Match against local, regional, or national
      if (tabLower === userLocalLower || tabLower === userRegionalLower || tabLower === userNationalLower) {
        return true;
      }
      
      // Legacy hardcoded checks for backward compatibility
      if (t === 'finglas' && p.userLocal === 'Finglas') {
        return true;
      }
      if (t === 'dublin' && p.userRegional === 'Dublin') {
        return true;
      }
      if (t === 'ireland' && p.userNational === 'Ireland') {
        return true;
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
      } else if (p.taggedUsers && p.taggedUsers.length > 0 && !decorated.taggedUsers) {
        // Only warn if taggedUsers were present BEFORE decoration but missing AFTER
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
  // Try Laravel API first, fallback to mock if it fails
  const useLaravelAPI = import.meta.env.VITE_USE_LARAVEL_API !== 'false';
  
  if (useLaravelAPI) {
    try {
      const response = await apiClient.toggleLike(id);
      return transformLaravelPost(response);
    } catch (error: any) {
      // Only log if it's not a connection refused error (backend not running)
      if (error?.name !== 'ConnectionRefused' && !error?.message?.includes('CONNECTION_REFUSED')) {
        console.warn('Laravel API call failed, falling back to mock data:', error);
      }
      // Fall through to mock implementation
    }
  }
  
  // Mock implementation (fallback)
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
  if (!p) {
    throw new Error('Post not found');
  }
  const s = getState(userId);
  const wasFollowing = s.follows[p.userHandle] === true;
  // Set to true if not following, false if following
  s.follows[p.userHandle] = !wasFollowing;
  
  // Debug: Log the state after update
  console.log('FOLLOW STATE UPDATED:', {
    userId,
    userHandle: p.userHandle,
    nowFollowing: s.follows[p.userHandle],
    allFollows: Object.keys(s.follows).filter(h => s.follows[h] === true)
  });
  
  return decorateForUser(userId, p);
}

export async function incrementViews(userId: string, id: string): Promise<Post> {
  // Try Laravel API first, fallback to mock if it fails
  const useLaravelAPI = import.meta.env.VITE_USE_LARAVEL_API !== 'false';
  
  if (useLaravelAPI) {
    try {
      const response = await apiClient.incrementView(id);
      return transformLaravelPost(response);
    } catch (error: any) {
      // Only log if it's not a connection refused error (backend not running)
      if (error?.name !== 'ConnectionRefused' && !error?.message?.includes('CONNECTION_REFUSED')) {
        console.warn('Laravel API call failed, falling back to mock data:', error);
      }
      // Fall through to mock implementation
    }
  }
  
  // Mock implementation (fallback)
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
  // Try Laravel API first, fallback to mock if it fails
  const useLaravelAPI = import.meta.env.VITE_USE_LARAVEL_API !== 'false';
  
  if (useLaravelAPI) {
    try {
      const response = await apiClient.sharePost(id);
      return transformLaravelPost(response);
    } catch (error: any) {
      // Only log if it's not a connection refused error (backend not running)
      if (error?.name !== 'ConnectionRefused' && !error?.message?.includes('CONNECTION_REFUSED')) {
        console.warn('Laravel API call failed, falling back to mock data:', error);
      }
      // Fall through to mock implementation
    }
  }
  
  // Mock implementation (fallback)
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
  // Try Laravel API first, fallback to mock if it fails
  const useLaravelAPI = import.meta.env.VITE_USE_LARAVEL_API !== 'false';
  
  if (useLaravelAPI) {
    try {
      const response = await apiClient.reclipPost(id);
      return transformLaravelPost(response);
    } catch (error: any) {
      // Only log if it's not a connection refused error (backend not running)
      if (error?.name !== 'ConnectionRefused' && !error?.message?.includes('CONNECTION_REFUSED')) {
        console.warn('Laravel API call failed, falling back to mock data:', error);
      }
      // Fall through to mock implementation
    }
  }
  
  // Mock implementation (fallback)
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
  // Try Laravel API first, fallback to mock if it fails
  const useLaravelAPI = import.meta.env.VITE_USE_LARAVEL_API !== 'false';
  
  if (useLaravelAPI) {
    try {
      const response = await apiClient.addComment(postId, text);
      // Transform Laravel comment response to frontend format
      return {
        id: response.id,
        postId: response.post_id || response.postId || postId,
        userHandle: response.user_handle || response.userHandle || userHandle,
        text: response.text || response.text_content,
        createdAt: new Date(response.created_at || response.createdAt).getTime(),
        likes: response.likes_count || response.likes || 0
      };
    } catch (error: any) {
      // Only log if it's not a connection refused error (backend not running)
      if (error?.name !== 'ConnectionRefused' && !error?.message?.includes('CONNECTION_REFUSED')) {
        console.warn('Laravel API call failed, falling back to mock data:', error);
      }
      // Fall through to mock implementation
    }
  }
  
  // Mock implementation (fallback)
  await delay(300);
  console.log('addComment called:', { postId, userHandle, text, postsCount: posts.length });
  
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
  console.log('Post lookup result:', { 
    postId, 
    found: !!post, 
    postUserHandle: post?.userHandle, 
    commenterHandle: userHandle,
    isOwnPost: post?.userHandle === userHandle
  });
  
  if (post) {
    post.stats.comments += 1;
    
    // Send DM to post owner with comment notification (only if not commenting on own post)
    if (post.userHandle !== userHandle) {
      // Dynamically import to avoid circular dependency
      const { appendMessage } = await import('./messages');
      console.log('Sending comment notification DM:', { 
        from: userHandle, 
        to: post.userHandle, 
        postId, 
        commentText: text 
      });
      try {
        await appendMessage(userHandle, post.userHandle, {
          postId: postId,
          commentId: comment.id,
          commentText: text,
          isSystemMessage: false
        });
        console.log('Comment notification DM sent successfully');
      } catch (error) {
        console.error('Failed to send comment notification DM:', error);
      }
    } else {
      console.log('Skipping DM - user is commenting on their own post');
    }
  } else {
    console.warn('Post not found for comment:', postId, 'Available post IDs:', posts.map(p => p.id).slice(0, 5));
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
  mediaItems?: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; text?: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }>, // Multiple media items for carousel, including text-only clips
  bannerText?: string, // News ticker banner text
  textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string }, // Text style for text-only posts
  taggedUsers?: string[], // Array of user handles tagged in the post
  videoCaptionsEnabled?: boolean, // Whether video captions are enabled
  videoCaptionText?: string, // Caption text to display on video
  subtitlesEnabled?: boolean, // Whether video subtitles are enabled
  subtitleText?: string, // Subtitle text to display on video
  editTimeline?: any, // Edit timeline for hybrid editing pipeline (clips, trims, transitions, etc.)
  musicTrackId?: number // Library music track ID
): Promise<Post> {
  // Use real Laravel API
  const { createPost: createPostAPI } = await import('./client');
  
  try {
    const response = await createPostAPI({
      text: text || undefined,
      location: location || undefined,
      mediaUrl: imageUrl || undefined,
      mediaType: mediaType || undefined,
      caption: caption || undefined,
      imageText: imageText || undefined,
      bannerText: bannerText || undefined,
      stickers: stickers || undefined,
      templateId: templateId || undefined,
      mediaItems: mediaItems || undefined,
      textStyle: textStyle || undefined,
      taggedUsers: taggedUsers || undefined,
      videoCaptionsEnabled: videoCaptionsEnabled || undefined,
      videoCaptionText: videoCaptionText || undefined,
      subtitlesEnabled: subtitlesEnabled || undefined,
      subtitleText: subtitleText || undefined,
      editTimeline: editTimeline || undefined,
      musicTrackId: musicTrackId || undefined,
    });

    // Transform Laravel response to frontend Post format
    const finalVideoUrl = response.final_video_url || response.finalVideoUrl;
    const originalMediaUrl = response.media_url || response.mediaUrl || imageUrl || '';
    
    const transformedPost = {
      id: response.id,
      userHandle: response.user_handle || response.userHandle,
      locationLabel: response.location_label || response.locationLabel || location || 'Unknown Location',
      tags: response.tags || [],
      // Use final_video_url if available (from completed render job), otherwise use original media_url
      mediaUrl: finalVideoUrl || originalMediaUrl,
      finalVideoUrl: finalVideoUrl || undefined, // Set as separate field for Media component
      mediaType: response.media_type || response.mediaType || mediaType,
      mediaItems: response.media_items || response.mediaItems || (imageUrl ? [{ url: imageUrl, type: mediaType || 'image' }] : undefined),
      text: response.text_content || response.text || text || undefined,
      imageText: response.image_text || response.imageText || imageText || undefined,
      caption: response.caption || caption || undefined,
      createdAt: new Date(response.created_at || response.createdAt).getTime(),
      stats: {
        likes: response.likes_count || response.stats?.likes || 0,
        views: response.views_count || response.stats?.views || 0,
        comments: response.comments_count || response.stats?.comments || 0,
        shares: response.shares_count || response.stats?.shares || 0,
        reclips: response.reclips_count || response.stats?.reclips || 0,
      },
      isBookmarked: response.is_bookmarked || false,
      isFollowing: response.is_following || false,
      userLiked: response.user_liked || false,
      stickers: response.stickers || stickers || undefined,
      templateId: response.template_id || response.templateId || templateId || undefined,
      bannerText: response.banner_text || response.bannerText || bannerText || undefined,
      textStyle: response.text_style || response.textStyle || textStyle || undefined,
      taggedUsers: response.taggedUsers || taggedUsers || undefined,
      videoCaptionsEnabled: response.video_captions_enabled || response.videoCaptionsEnabled || undefined,
      videoCaptionText: response.video_caption_text || response.videoCaptionText || undefined,
      subtitlesEnabled: response.subtitles_enabled || response.subtitlesEnabled || undefined,
      subtitleText: response.subtitle_text || response.subtitleText || undefined,
      userLocal: userLocal,
      userRegional: userRegional,
      userNational: userNational,
      // Include renderJobId for PiP tracking
      renderJobId: response.render_job_id || response.renderJobId,
    } as Post & { renderJobId?: string };
    
    return transformedPost;
  } catch (error) {
    console.error('Error creating post via API:', error);
    // Fallback to mock for now if API fails
    await delay(500);
    
    // Helper function to convert blob URL to data URL for persistence
    async function convertBlobToDataUrl(blobUrl: string): Promise<string> {
      if (!blobUrl.startsWith('blob:')) {
        return blobUrl; // Not a blob URL, return as-is
      }
      
      try {
        console.log('Converting blob URL to data URL for persistence:', blobUrl.substring(0, 50));
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        console.log('Converted blob URL to data URL', {
          originalSize: blob.size,
          dataUrlSize: dataUrl.length,
          isDataUrl: dataUrl.startsWith('data:')
        });
        return dataUrl;
      } catch (error) {
        console.error('Failed to convert blob URL to data URL:', error);
        // Return a placeholder or the original URL
        return blobUrl; // Fallback to original (will fail later, but at least we tried)
      }
    }
    
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

  // Convert blob URLs to data URLs for persistence
  // Only convert if we have a valid blob URL (not empty/undefined)
  let persistentImageUrl = imageUrl;
  if (imageUrl && imageUrl.trim() !== '' && imageUrl.startsWith('blob:')) {
    try {
      persistentImageUrl = await convertBlobToDataUrl(imageUrl);
    } catch (error) {
      console.error('Failed to convert blob URL, using original:', error);
      persistentImageUrl = imageUrl; // Fallback to original
    }
  }

  // Convert blob URLs in mediaItems to data URLs
  let persistentMediaItems = mediaItems;
  if (mediaItems && mediaItems.length > 0) {
    persistentMediaItems = await Promise.all(
      mediaItems.map(async (item) => {
        if (item.url && item.url.trim() !== '' && item.url.startsWith('blob:')) {
          try {
            const dataUrl = await convertBlobToDataUrl(item.url);
            return { ...item, url: dataUrl };
          } catch (error) {
            console.error('Failed to convert blob URL in mediaItems, using original:', error);
            return item; // Fallback to original
          }
        }
        return item;
      })
    );
  }

  // If mediaItems provided, use that; otherwise fall back to single mediaUrl
  // Only create mediaItems if we have actual media (not for text-only posts)
  const finalMediaItems = persistentMediaItems && persistentMediaItems.length > 0
    ? persistentMediaItems
    : persistentImageUrl && persistentImageUrl.trim() !== ''
      ? [{ url: persistentImageUrl, type: mediaType || 'image' }]
      : undefined;

  const newPost: Post = {
    id: `${crypto.randomUUID()}-${postCreatedAt}`,
    userHandle,
    locationLabel: location || 'Unknown Location',
    tags: [],
    // Only set mediaUrl if we have actual media (not empty string for text-only posts)
    mediaUrl: persistentImageUrl && persistentImageUrl.trim() !== '' ? persistentImageUrl : undefined,
    finalVideoUrl: undefined, // Will be set when render job completes
    mediaType: mediaType || undefined, // Keep for backward compatibility
    mediaItems: finalMediaItems, // New: support multiple media items (with persistent URLs)
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

  console.log('📝 Post created and added to posts array. Total posts:', posts.length);
  console.log('📝 New post mediaUrl:', newPost.mediaUrl?.substring(0, 50) || 'undefined', 'isBlob:', newPost.mediaUrl?.startsWith('blob:'), 'isData:', newPost.mediaUrl?.startsWith('data:'));
  console.log('📝 New post mediaItems:', newPost.mediaItems?.map(item => ({
    type: item.type,
    urlType: item.url?.startsWith('blob:') ? 'blob' : item.url?.startsWith('data:') ? 'data' : 'http',
    urlPreview: item.url?.substring(0, 50)
  })));
  console.log('📝 New post:', {
    id: newPost.id.substring(0, 30),
    mediaType: newPost.mediaType,
    hasMediaUrl: !!newPost.mediaUrl,
    hasMediaItems: !!newPost.mediaItems && newPost.mediaItems.length > 0,
    taggedUsers: newPost.taggedUsers,
    templateId: newPost.templateId
  });

  // Verify the post in the array has taggedUsers
  const postInArray = posts[0];
  console.log('Post in array [0] taggedUsers:', postInArray?.taggedUsers);
  console.log('Post in array [0] templateId:', postInArray?.templateId);

  return decorateForUser(userId, newPost);
  }
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