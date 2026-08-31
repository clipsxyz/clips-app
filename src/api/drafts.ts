import { get, set } from 'idb-keyval';
import {
  canUseDraftsApi,
  deleteRemoteDraft,
  fetchRemoteDrafts,
  isPersistedDraftId,
  mergeDraftLists,
  newLocalDraftId,
  upsertRemoteDraft,
  type Draft,
} from './draftsShared';

export type { Draft } from './draftsShared';

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
  const local = await readDrafts();
  if (!canUseDraftsApi()) return local;
  try {
    const remote = await fetchRemoteDrafts();
    const merged = mergeDraftLists(remote, local);
    await writeDrafts(merged);
    return merged;
  } catch (error) {
    console.warn('Failed to load drafts from backend, using cache:', error);
    return local;
  }
}

export async function saveDraft(draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<Draft> {
  const now = Date.now();
  const local: Draft = {
    ...draft,
    id: newLocalDraftId(),
    createdAt: now,
    updatedAt: now,
  };
  const drafts = await readDrafts();
  drafts.unshift(local);
  await writeDrafts(drafts);

  if (!canUseDraftsApi()) return local;
  try {
    const saved = await upsertRemoteDraft(local);
    const current = await readDrafts();
    const withoutTemp = current.filter((row) => row.id !== local.id);
    if (!withoutTemp.some((row) => row.id === saved.id)) {
      withoutTemp.unshift(saved);
    }
    await writeDrafts(withoutTemp);
    return saved;
  } catch (error) {
    console.warn('Failed to sync draft to backend, kept locally:', error);
    return local;
  }
}

export async function deleteDraft(draftId: string): Promise<void> {
  const drafts = await readDrafts();
  await writeDrafts(drafts.filter((d) => d.id !== draftId));
  if (!canUseDraftsApi() || !isPersistedDraftId(draftId)) return;
  try {
    await deleteRemoteDraft(draftId);
  } catch (error) {
    console.warn('Failed to delete draft on backend:', error);
    throw error;
  }
}

export async function updateDraft(draftId: string, updates: Partial<Draft>): Promise<Draft | null> {
  const drafts = await readDrafts();
  const index = drafts.findIndex((d) => d.id === draftId);
  if (index === -1) return null;
  const next: Draft = { ...drafts[index], ...updates, id: draftId, updatedAt: Date.now() };
  drafts[index] = next;
  await writeDrafts(drafts);

  if (!canUseDraftsApi()) return next;
  try {
    const saved = await upsertRemoteDraft(next);
    const latest = await readDrafts();
    const i = latest.findIndex((d) => d.id === draftId || d.id === saved.id);
    if (i >= 0) latest[i] = saved;
    await writeDrafts(latest);
    return saved;
  } catch (error) {
    console.warn('Failed to update draft on backend, kept locally:', error);
    return next;
  }
}

export async function getDraft(draftId: string): Promise<Draft | null> {
  const drafts = await getDrafts();
  return drafts.find((d) => d.id === draftId) || null;
}
