import { db } from './db';
import type { Post } from '../types';

const key = (userId: string, tab: string) => `feed:${userId}:${tab}`;

export async function saveFeed(userId: string, tab: string, pages: Post[][]) {
  await db.set(key(userId, tab), pages);
}

export async function loadFeed(userId: string, tab: string): Promise<Post[][]> {
  return (await db.get(key(userId, tab))) ?? [];
}

export async function clearFeed(userId: string, tab: string) {
  await db.del(key(userId, tab));
}

