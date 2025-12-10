import { get, set, del, keys } from 'idb-keyval';
import type { Post } from '../types';

export interface Draft {
  id: string;
  videoUrl: string;
  videoDuration: number;
  createdAt: number;
  updatedAt: number;
  caption?: string;
  location?: string;
  tags?: string[];
}

const DRAFTS_KEY = 'user_drafts';

/**
 * Get all drafts for the current user
 */
export async function getDrafts(): Promise<Draft[]> {
  try {
    const drafts = await get<Draft[]>(DRAFTS_KEY);
    return drafts || [];
  } catch (error) {
    console.error('Error getting drafts:', error);
    return [];
  }
}

/**
 * Save a draft
 */
export async function saveDraft(draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<Draft> {
  try {
    const drafts = await getDrafts();
    const newDraft: Draft = {
      ...draft,
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    drafts.push(newDraft);
    await set(DRAFTS_KEY, drafts);
    return newDraft;
  } catch (error) {
    console.error('Error saving draft:', error);
    throw error;
  }
}

/**
 * Delete a draft
 */
export async function deleteDraft(draftId: string): Promise<void> {
  try {
    const drafts = await getDrafts();
    const filtered = drafts.filter(d => d.id !== draftId);
    await set(DRAFTS_KEY, filtered);
  } catch (error) {
    console.error('Error deleting draft:', error);
    throw error;
  }
}

/**
 * Update a draft
 */
export async function updateDraft(draftId: string, updates: Partial<Draft>): Promise<Draft | null> {
  try {
    const drafts = await getDrafts();
    const index = drafts.findIndex(d => d.id === draftId);
    if (index === -1) return null;
    
    drafts[index] = {
      ...drafts[index],
      ...updates,
      updatedAt: Date.now(),
    };
    await set(DRAFTS_KEY, drafts);
    return drafts[index];
  } catch (error) {
    console.error('Error updating draft:', error);
    throw error;
  }
}

/**
 * Get a single draft by ID
 */
export async function getDraft(draftId: string): Promise<Draft | null> {
  try {
    const drafts = await getDrafts();
    return drafts.find(d => d.id === draftId) || null;
  } catch (error) {
    console.error('Error getting draft:', error);
    return null;
  }
}



