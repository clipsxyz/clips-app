import { get, set } from 'idb-keyval';
import type { StickerOverlay } from '../types';
import type { InstantFilterName } from '../utils/instantFiltersNative';

export interface Draft {
  id: string;
  videoUrl: string;
  videoDuration: number;
  createdAt: number;
  updatedAt: number;
  caption?: string;
  location?: string;
  tags?: string[];
  trimStart?: number;
  trimEnd?: number;
  mediaType?: 'image' | 'video';
  videoPosterUrl?: string;
  videoCoverTime?: number;
  filterActive?: InstantFilterName;
  filterBaked?: boolean;
  stickers?: StickerOverlay[];
  mediaItems?: Array<{ url: string; type: 'image' | 'video'; duration?: number }>;
  isTextOnly?: boolean;
  textBody?: string;
  venue?: string;
  landmark?: string;
  taggedUsers?: string[];
  textTemplateId?: string;
}

const DRAFTS_KEY = 'user_drafts';

async function readDrafts(): Promise<Draft[]> {
  try {
    const drafts = await get<Draft[]>(DRAFTS_KEY);
    return drafts || [];
  } catch (error) {
    console.error('Error getting drafts:', error);
    return [];
  }
}

async function writeDrafts(drafts: Draft[]): Promise<void> {
  await set(DRAFTS_KEY, drafts);
}

export async function getDrafts(): Promise<Draft[]> {
  return readDrafts();
}

export async function saveDraft(draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<Draft> {
  const drafts = await readDrafts();
  const newDraft: Draft = {
    ...draft,
    id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  drafts.push(newDraft);
  await writeDrafts(drafts);
  return newDraft;
}

export async function deleteDraft(draftId: string): Promise<void> {
  const drafts = await readDrafts();
  await writeDrafts(drafts.filter((d) => d.id !== draftId));
}

export async function updateDraft(draftId: string, updates: Partial<Draft>): Promise<Draft | null> {
  const drafts = await readDrafts();
  const index = drafts.findIndex((d) => d.id === draftId);
  if (index === -1) return null;
  drafts[index] = { ...drafts[index], ...updates, updatedAt: Date.now() };
  await writeDrafts(drafts);
  return drafts[index];
}

export async function getDraft(draftId: string): Promise<Draft | null> {
  const drafts = await readDrafts();
  return drafts.find((d) => d.id === draftId) || null;
}
