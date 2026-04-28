import React from 'react';
import { FiX, FiUsers, FiChevronRight } from 'react-icons/fi';
import { fetchMyChatGroups, inviteUserToChatGroup, type ChatGroupSummary } from '../api/chatGroups';
import { showToast } from '../utils/toast';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { useAuth } from '../context/Auth';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';

export default function InviteToGroupModal({
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

  React.useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchMyChatGroups(user?.handle)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [isOpen, user?.handle]);

  if (!isOpen) return null;

  const invite = async (g: ChatGroupSummary) => {
    if (!isLaravelApiEnabled()) {
      showToast('Inviting by handle needs the API. Create the group here; share a link or add people when the server is on.');
      return;
    }
    setInvitingId(g.id);
    try {
      await inviteUserToChatGroup(g.id, inviteeHandle.replace(/^@/, ''));
      showToast(`Invited to “${g.name}”`);
      onClose();
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Could not send invite');
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md mx-3 sm:mx-4 rounded-t-2xl sm:rounded-2xl border border-white/15 bg-black shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar
              src={user?.avatarUrl || (user?.handle ? getAvatarForHandle(user.handle) : undefined)}
              name={user?.name || user?.handle || 'You'}
              size="sm"
              className="flex-shrink-0 border border-white/20"
            />
            <div className="flex items-center gap-2 text-white font-semibold text-sm min-w-0">
              <FiUsers className="w-5 h-5 text-white shrink-0" />
              <span className="truncate">Invite to group</span>
            </div>
          </div>
          <button type="button" className="p-2 rounded-full hover:bg-white/10 text-white/80 shrink-0" onClick={onClose} aria-label="Close">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="p-2 overflow-y-auto flex-1 bg-black">
          {loading ? (
            <div className="py-8 text-center text-white/50 text-sm">Loading your groups…</div>
          ) : groups.length === 0 ? (
            <div className="py-8 px-3 text-center text-white/55 text-sm leading-relaxed">
              You don&apos;t have any groups yet. Create one from <strong className="text-white/80">your profile → New group</strong>, or{' '}
              <strong className="text-white/80">⋯ on your own post → Create group</strong>. Then open the group and use{' '}
              <strong className="text-white/80">+</strong> in the header to invite by username.
            </div>
          ) : (
            <ul className="space-y-1">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    disabled={invitingId != null}
                    onClick={() => void invite(g)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{g.name}</div>
                      <div className="text-[11px] text-white/45">{g.member_count} members</div>
                    </div>
                    {invitingId === g.id ? (
                      <span className="text-xs text-white/70">…</span>
                    ) : (
                      <FiChevronRight className="w-5 h-5 text-white/35 shrink-0" />
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
