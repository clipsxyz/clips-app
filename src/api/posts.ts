import raw from '../data/posts.json';
import type { Post, Comment } from '../types';

let posts: Post[] = (raw as Post[]).map(p => ({ ...p }));

// Mock comment data storage (without replies)
let comments: Comment[] = [
  {
    id: 'comment-1',
    postId: '1',
    userHandle: 'Alice@Dublin',
    text: 'This looks amazing! Where is this taken?',
    createdAt: Date.now() - 3600000, // 1 hour ago
  },
  {
    id: 'comment-2',
    postId: '1',
    userHandle: 'Bob@Finglas',
    text: 'Great shot! 📸',
    createdAt: Date.now() - 1800000, // 30 minutes ago
  },
  {
    id: 'comment-3',
    postId: '2',
    userHandle: 'Charlie@Ireland',
    text: 'That brunch looks delicious! What cafe is this?',
    createdAt: Date.now() - 7200000, // 2 hours ago
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
      return p.userHandle.toLowerCase().includes('dublin') ||
        (userRegional === 'Dublin' && p.userHandle.toLowerCase().includes('dublin'));
    }
    if (t === 'ireland') {
      return p.userHandle.toLowerCase().includes('ireland') ||
        (userNational === 'Ireland' && p.userHandle.toLowerCase().includes('ireland'));
    }

    // Fallback
    return p.userHandle.toLowerCase().includes(t);
  });
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
  const p = posts.find(x => x.id === id)!;
  p.stats.views += 1;
  return decorateForUser(userId, p);
}

export async function incrementShares(userId: string, id: string): Promise<Post> {
  await delay(100);
  const p = posts.find(x => x.id === id)!;
  p.stats.shares += 1;
  return decorateForUser(userId, p);
}

export async function incrementReclips(userId: string, id: string): Promise<Post> {
  await delay(100);
  const p = posts.find(x => x.id === id)!;
  p.stats.reclips += 1;
  return decorateForUser(userId, p);
}

export async function reclipPost(userId: string, originalPostId: string, userHandle: string): Promise<Post> {
  await delay(200);
  const originalPost = posts.find(x => x.id === originalPostId)!;

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
  };
  comments.push(comment);

  // Update post comment count
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.stats.comments += 1;
  }

  return comment;
}