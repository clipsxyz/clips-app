import { db } from './db';

type Mutation = { 
  id: string; 
  at: number; 
  type: 'like'|'bookmark'|'follow'; 
  postId: string; 
  userId: string 
};

const QKEY = 'mutations';

export async function enqueue(m: Omit<Mutation,'id'|'at'>) {
  const item: Mutation = { ...m, id: crypto.randomUUID(), at: Date.now() };
  await db.update(QKEY, (arr: Mutation[] = []) => [...arr, item]);
}

export async function drain(handler: (m: Mutation) => Promise<void>) {
  let arr: Mutation[] = (await db.get(QKEY)) ?? [];
  for (const m of arr) {
    try { 
      await handler(m); 
      arr = arr.filter(x => x.id !== m.id); 
      await db.set(QKEY, arr); 
    } catch { 
      break; 
    }
  }
}

export async function all(): Promise<Mutation[]> { 
  return (await db.get(QKEY)) ?? []; 
}

