import React from 'react';
import { FiX, FiUsers, FiChevronRight } from 'react-icons/fi';
import { fetchMyChatGroups, inviteUserToChatGroup, type ChatGroupSummary } from '../api/chatGroups';
import { showToast } from '../utils/toast';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { useAuth } from '../context/Auth';

function normalizeHandle(h: string): string {
  return h.trim().replace(/^@/g, '').split(/\s+/)[0] || '';
}

/**
 * After “Invite to a group” from a feed card: pick which of your group chats to invite {@inviteHandle} into.
 */
export default function PickGroupToInviteFeedUserModal({
  isOpen,
  onClose,
  inviteeHandle,
}: {
  isOpen: boolean;
  onClose: () => void;
  inviteeHandle: string;
}) {
  const { user } = useAuth();
  const [groups, setGroups] = React.useState<ChatGroupSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [invitingId, setInvitingId] = React.useState<string | null>(null);

  const displayInvitee = inviteeHandle.trim() || 'this user';
  const normalizedInvitee = normalizeHandle(inviteeHandle);

  React.useEffect(() => {
    if (!isOpen || !user?.handle) return;
    let cancelled = false;
    setLoading(true);
    fetchMyChatGroups(user.handle)
      .then((items) => {
        if (!cancelled) setGroups(items ?? []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setGroups([]);
          showToast('Could not load your groups');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.handle]);

  const inviteToGroup = async (g: ChatGroupSummary) => {
    if (!normalizedInvitee) {
      showToast('Invalid username');
      return;
    }
    if (normalizeHandle(user?.handle || '') === normalizedInvitee) {
      showToast('You can’t invite yourself');
      return;
    }
    if (!isLaravelApiEnabled()) {
      showToast(
        'Invites are sent when the API is on. In offline mode, create groups locally—turn on the server to invite by username.',
      );
      return;
    }
    setInvitingId(g.id);
    try {
      await inviteUserToChatGroup(g.id, normalizedInvitee);
      showToast(`Invited @${normalizedInvitee} to “${g.name}”`);
      onClose();
    } catch (e: unknown) {
      console.error(e);
      showToast(e instanceof Error ? e.message : 'Could not send invite');
    } finally {
      setInvitingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" onClick={() => !invitingId && onClose()} />
      <div className="relative w-full max-w-md mx-3 sm:mx-4 rounded-t-2xl sm:rounded-2xl border border-white/15 bg-black shadow-2xl overflow-hidden max-h-[min(85vh,520px)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FiUsers className="w-5 h-5 text-white shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">Invite to a group</p>
              <p className="text-[11px] text-white/50 truncate">
                Choose a chat for <span className="text-white/80">{displayInvitee}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-2 rounded-full hover:bg-white/10 text-white/80 shrink-0"
            onClick={() => !invitingId && onClose()}
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" aria-hidden />
            </div>
          ) : groups.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-white/55 leading-relaxed">
              You don&apos;t have any group chats yet. Create one from your profile (New group), then you can invite people from
              the feed.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    disabled={!!invitingId}
                    onClick={() => void inviteToGroup(g)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left hover:bg-white/10 active:bg-white/15 disabled:opacity-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm truncate">{g.name}</p>
                      {g.member_count != null ? (
                        <p className="text-[11px] text-white/45">{g.member_count} members</p>
                      ) : null}
                    </div>
                    {invitingId === g.id ? (
                      <div className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin shrink-0" />
                    ) : (
                      <FiChevronRight className="w-5 h-5 text-white/35 shrink-0" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
