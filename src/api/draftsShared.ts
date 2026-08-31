import type { StickerOverlay } from '../types';
import type { InstantFilterName } from '../utils/instantFiltersNative';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { apiRequest } from './client';
import { isMockMode } from './apiMode';

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedDraftId(id: string | undefined | null): boolean {
  return !!id && UUID_RE.test(String(id));
}

export function canUseDraftsApi(): boolean {
  return !isMockMode() && isLaravelApiEnabled();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function draftTitle(draft: Partial<Draft>): string | null {
  const caption = String(draft.caption || '').trim();
  if (caption) return caption.slice(0, 255);
  const body = String(draft.textBody || '').trim();
  if (body) return body.slice(0, 255);
  if (draft.isTextOnly) return 'Text draft';
  return draft.mediaType === 'image' ? 'Photo draft' : 'Video draft';
}

export function draftToApiPayload(draft: Draft): {
  id?: string;
  title: string | null;
  media_url: string | null;
  metadata: Record<string, unknown>;
} {
  const { id, createdAt, updatedAt, videoUrl, ...rest } = draft;
  return {
    ...(isPersistedDraftId(id) ? { id } : {}),
    title: draftTitle(draft),
    media_url: videoUrl || null,
    metadata: {
      ...rest,
      videoUrl,
    },
  };
}

export function draftFromApi(row: unknown): Draft | null {
  const data = asRecord(row);
  const meta = asRecord(data.metadata);
  const id = String(data.id || '').trim();
  if (!id) return null;

  const videoUrl = String(meta.videoUrl ?? data.mediaUrl ?? data.media_url ?? '');
  const createdAt = Number(data.createdAt ?? meta.createdAt ?? 0) || Date.now();
  const updatedAt = Number(data.updatedAt ?? meta.updatedAt ?? createdAt) || createdAt;
  const videoDuration = Number(meta.videoDuration ?? 0) || 0;

  return {
    ...(meta as Partial<Draft>),
    id,
    videoUrl,
    videoDuration,
    createdAt,
    updatedAt,
  };
}

export async function fetchRemoteDrafts(): Promise<Draft[]> {
  const rows = await apiRequest('/drafts');
  const list = Array.isArray(rows) ? rows : [];
  return list.map(draftFromApi).filter((d): d is Draft => d != null);
}

export async function upsertRemoteDraft(draft: Draft): Promise<Draft> {
  const saved = await apiRequest('/drafts', {
    method: 'POST',
    body: JSON.stringify(draftToApiPayload(draft)),
    timeoutMs: 15000,
  });
  return draftFromApi(saved) ?? draft;
}

export async function deleteRemoteDraft(id: string): Promise<void> {
  if (!isPersistedDraftId(id)) return;
  await apiRequest(`/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function mergeDraftLists(remote: Draft[], local: Draft[]): Draft[] {
  const byId = new Map<string, Draft>();
  for (const draft of remote) {
    byId.set(draft.id, draft);
  }
  for (const draft of local) {
    if (!isPersistedDraftId(draft.id) && !byId.has(draft.id)) {
      byId.set(draft.id, draft);
    }
  }
  return Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function newLocalDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
