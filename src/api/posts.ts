import raw from '../data/posts.json';
import type { Post } from '../types';

let posts: Post[] = (raw as Post[]).map(p => ({ ...p }));

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

export async function fetchPostsPage(tab: string, cursor: number | null, limit = 5, userId = 'me'): Promise<Page> {
  await delay();
  const t = tab.toLowerCase();
  const filtered = posts.filter(p => 
    t === 'following' ? getState(userId).follows[p.userHandle] : p.userHandle.toLowerCase().includes(t)
  );
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
