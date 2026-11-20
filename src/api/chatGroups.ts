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

export function isChatGroupAdmin(
  group: Pick<ChatGroupSummary, 'is_admin' | 'role' | 'creator_id'> | null | undefined,
  viewerId?: string | null,
): boolean {
  if (!group) return false;
  if (group.is_admin === true || group.role === 'admin') return true;
  if (viewerId && group.creator_id && String(group.creator_id) === String(viewerId)) return true;
  return false;
}

export interface ChatGroupInviteRow {
  id: string;
  chat_group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  expires_at?: string | null;
  created_at?: string;
  chat_group?: {
    id: string;
    name: string;
    avatar_url?: string | null;
    creator_id: string;
    conversation_id?: string;
  };
  inviter?: { id: string; handle: string; display_name?: string; avatar_url?: string | null };
}

export function normalizePendingInvite(raw: unknown): ChatGroupInviteRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, any>;
  const chatGroup = row.chat_group || row.chatGroup;
  const inviter = row.inviter;
  const id = String(row.id || '').trim();
  if (!id) return null;
  return {
    id,
    chat_group_id: String(row.chat_group_id || row.chatGroupId || chatGroup?.id || ''),
    inviter_id: String(row.inviter_id || row.inviterId || inviter?.id || ''),
    invitee_id: String(row.invitee_id || row.inviteeId || ''),
    status: String(row.status || 'pending'),
    expires_at: row.expires_at || row.expiresAt || null,
    created_at: row.created_at || row.createdAt,
    chat_group: chatGroup
      ? {
          id: String(chatGroup.id || ''),
          name: String(chatGroup.name || 'Group'),
          avatar_url: chatGroup.avatar_url || chatGroup.avatarUrl || null,
          creator_id: String(chatGroup.creator_id || chatGroup.creatorId || ''),
          conversation_id: chatGroup.conversation_id || chatGroup.conversationId,
        }
      : undefined,
    inviter: inviter
      ? {
          id: String(inviter.id || ''),
          handle: String(inviter.handle || ''),
          display_name: inviter.display_name || inviter.displayName,
          avatar_url: inviter.avatar_url || inviter.avatarUrl || null,
        }
      : undefined,
  };
}

export function pendingInviteGroupName(row: ChatGroupInviteRow): string {
  return row.chat_group?.name?.trim() || 'Group';
}

export function pendingInviteInviterHandle(row: ChatGroupInviteRow): string {
  return row.inviter?.handle?.trim() || '';
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
    return mockInviteToChatGroup(groupId, inviteeHandle);
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

export interface ChatGroupMemberRow {
  user_id: string;
  handle: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role: string;
  is_creator: boolean;
}

export interface ChatGroupMembersPayload {
  name: string;
  creator_id: string;
  is_admin: boolean;
  items: ChatGroupMemberRow[];
}

function normalizeMember(raw: unknown): ChatGroupMemberRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const userId = String(row.user_id || row.userId || '').trim();
  if (!userId) return null;
  return {
    user_id: userId,
    handle: String(row.handle || '').trim(),
    display_name: (row.display_name || row.displayName || null) as string | null,
    avatar_url: (row.avatar_url || row.avatarUrl || null) as string | null,
    role: String(row.role || 'member'),
    is_creator: row.is_creator === true || row.isCreator === true,
  };
}

export function chatGroupApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { error?: string; message?: string } }).response;
    if (typeof response?.message === 'string' && response.message.trim()) return response.message;
    if (typeof response?.error === 'string' && response.error.trim()) return response.error;
  }
  if (error instanceof Error && error.message && error.message !== 'CONNECTION_REFUSED') return error.message;
  return fallback;
}

export async function fetchChatGroupMembers(groupId: string): Promise<ChatGroupMembersPayload> {
  if (!isLaravelApiEnabled() || !hasAuthToken()) {
    return { name: '', creator_id: '', is_admin: false, items: [] };
  }
  const res = (await client.fetchChatGroupMembers(groupId)) as {
    name?: string;
    creator_id?: string;
    is_admin?: boolean;
    items?: unknown[];
  };
  return {
    name: String(res?.name || ''),
    creator_id: String(res?.creator_id || ''),
    is_admin: res?.is_admin === true,
    items: (res?.items ?? []).map(normalizeMember).filter((row): row is ChatGroupMemberRow => !!row),
  };
}

export async function renameChatGroup(groupId: string, name: string): Promise<{ id: string; name: string }> {
  return client.renameChatGroup(groupId, name) as Promise<{ id: string; name: string }>;
}

export async function removeChatGroupMember(groupId: string, userId: string): Promise<unknown> {
  return client.removeChatGroupMember(groupId, userId);
}

export async function setChatGroupMemberRole(
  groupId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<unknown> {
  return client.setChatGroupMemberRole(groupId, userId, role);
}

export async function fetchPendingGroupInvites(): Promise<ChatGroupInviteRow[]> {
  if (!isLaravelApiEnabled() || !hasAuthToken()) return [];
  try {
    const res = (await client.fetchPendingChatGroupInvites()) as { items?: unknown[] };
    return (res.items ?? [])
      .map(normalizePendingInvite)
      .filter((row): row is ChatGroupInviteRow => !!row);
  } catch (error) {
    console.warn('Failed to fetch pending group invites:', error);
    return [];
  }
}
