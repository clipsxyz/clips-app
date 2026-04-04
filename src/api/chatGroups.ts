import { isLaravelApiEnabled } from '../config/runtimeEnv';
import * as client from './client';

function hasToken(): boolean {
  return typeof localStorage !== 'undefined' && !!localStorage.getItem('authToken');
}

export interface ChatGroupSummary {
  id: string;
  name: string;
  conversation_id: string;
  creator_id: string;
  is_admin: boolean;
  role: string;
  member_count: number;
  created_at?: string;
}

export interface ChatGroupInviteRow {
  id: string;
  chat_group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  expires_at?: string | null;
  created_at?: string;
  chat_group?: { id: string; name: string; creator_id: string; conversation_id?: string };
  inviter?: { id: string; handle: string; display_name?: string; avatar_url?: string | null };
}

export async function fetchMyChatGroups(viewerHandle?: string | null): Promise<ChatGroupSummary[]> {
  if (!isLaravelApiEnabled()) {
    const h = viewerHandle?.trim();
    if (!h) return [];
    const { listMockChatGroupsAsSummaries } = await import('./messages');
    return listMockChatGroupsAsSummaries(h) as ChatGroupSummary[];
  }
  if (!hasToken()) return [];
  const res = (await client.fetchChatGroups()) as { items?: ChatGroupSummary[] };
  return res.items ?? [];
}

export async function createChatGroup(
  name: string,
  creatorHandle?: string | null,
): Promise<{ id: string; name: string; conversation_id: string } | null> {
  if (!isLaravelApiEnabled()) {
    const h = creatorHandle?.trim();
    if (!h) return null;
    const { createMockChatGroup } = await import('./messages');
    return createMockChatGroup(name, h);
  }
  if (!hasToken()) return null;
  return client.createChatGroupApi(name) as Promise<{ id: string; name: string; conversation_id: string }>;
}

export async function inviteUserToChatGroup(groupId: string, inviteeHandle: string): Promise<unknown> {
  return client.inviteToChatGroup(groupId, inviteeHandle);
}

export async function acceptChatGroupInvite(inviteId: string): Promise<unknown> {
  return client.acceptChatGroupInvite(inviteId);
}

export async function declineChatGroupInvite(inviteId: string): Promise<unknown> {
  return client.declineChatGroupInvite(inviteId);
}

export async function leaveChatGroup(groupId: string): Promise<unknown> {
  return client.leaveChatGroup(groupId);
}

export async function deleteChatGroup(groupId: string): Promise<unknown> {
  return client.deleteChatGroup(groupId);
}

export async function fetchPendingGroupInvites(): Promise<ChatGroupInviteRow[]> {
  if (!isLaravelApiEnabled() || !hasToken()) return [];
  const res = (await client.fetchPendingChatGroupInvites()) as { items?: ChatGroupInviteRow[] };
  return res.items ?? [];
}
