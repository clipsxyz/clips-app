import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { hasAuthToken } from '../utils/authTokenBridge';
import * as client from './client';

export interface ChatGroupSummary {
  id: string;
  name: string;
  avatar_url?: string | null;
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
  if (!hasAuthToken()) return [];
  const res = (await client.fetchChatGroups()) as { items?: ChatGroupSummary[] };
  return res.items ?? [];
}

export async function createChatGroup(
  name: string,
  creatorHandle?: string | null,
  avatarUrl?: string | null,
): Promise<{ id: string; name: string; avatar_url?: string | null; conversation_id: string } | null> {
  if (!isLaravelApiEnabled()) {
    const h = creatorHandle?.trim();
    if (!h) return null;
    const { createMockChatGroup } = await import('./messages');
        return createMockChatGroup(name, h, avatarUrl);
  }
  if (!hasAuthToken()) return null;
  return client.createChatGroupApi(name, avatarUrl) as Promise<{ id: string; name: string; avatar_url?: string | null; conversation_id: string }>;
}

export async function inviteUserToChatGroup(groupId: string, inviteeHandle: string): Promise<unknown> {
  if (!isLaravelApiEnabled()) {
    const { mockInviteToChatGroup } = await import('./messages');
    let inviterHandle: string | undefined;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
      inviterHandle = raw ? JSON.parse(raw)?.handle : undefined;
    } catch {
      inviterHandle = undefined;
    }
    return mockInviteToChatGroup(groupId, inviteeHandle, inviterHandle);
  }
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
  if (!isLaravelApiEnabled() || !hasAuthToken()) return [];
  const res = (await client.fetchPendingChatGroupInvites()) as { items?: ChatGroupInviteRow[] };
  return res.items ?? [];
}
