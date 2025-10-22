import raw from '../data/posts.json';
import type { Post, Comment } from '../types';

// Create a persistent posts array that won't be reset
let posts: Post[] = [];
let postsInitialized = false;

// Initialize posts only once
if (!postsInitialized) {
  console.log('Initializing posts array...');
  posts = (raw as Post[]).map((p, index) => ({
    ...p,
    id: `post-${p.id}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Make IDs truly unique
  }));
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
      // Custom location search - match any part of userHandle
      return p.userHandle.toLowerCase().includes(t);
    }

    // Predefined tab filtering based on user's signup location choices
    if (t === 'finglas') {
      return p.userHandle.toLowerCase().includes('finglas') ||
        (userLocal === 'Finglas' && p.userHandle.toLowerCase().includes('finglas'));
    }
    if (t === 'dublin') {
      // Show posts from users whose handle contains 'dublin' OR from users who selected Dublin as regional
      const handleContainsDublin = p.userHandle.toLowerCase().includes('dublin');
      const userRegionalDublin = userRegional === 'Dublin';
      const shouldShow = handleContainsDublin || userRegionalDublin;

      // Debug logging
      if (shouldShow) {
        console.log('Dublin post found:', {
          userHandle: p.userHandle,
          handleContainsDublin,
          userRegionalDublin,
          text: p.text,
          mediaUrl: p.mediaUrl
        });
      }

      return shouldShow;
    }
    if (t === 'ireland') {
      return p.userHandle.toLowerCase().includes('ireland') ||
        (userNational === 'Ireland' && p.userHandle.toLowerCase().includes('ireland'));
    }

    // Fallback
    return p.userHandle.toLowerCase().includes(t);
  });

  console.log('Filtered posts for', t, ':', filtered.length, 'posts');
  console.log('All posts:', posts.map(p => ({ userHandle: p.userHandle, text: p.text, mediaUrl: p.mediaUrl })));

  const start = cursor ?? 0;
  const slice = filtered.slice(start, start + limit).map(p => decorateForUser(userId, p));
  const next = start + slice.length < filtered.length ? start + slice.length : null;
  return { items: slice, nextCursor: next };
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
  caption?: string
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
    caption
  });

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
    userLiked: false
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