import React from 'react';
import { FiX, FiUserPlus } from 'react-icons/fi';
import { inviteUserToChatGroup } from '../api/chatGroups';
import { showToast } from '../utils/toast';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { useAuth } from '../context/Auth';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';

/**
 * Invite someone by @handle into the group you’re currently in (from group chat header).
 */
export default function InviteMemberToGroupModal({
  isOpen,
  onClose,
  groupId,
  groupName,
}: {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}) {
  const { user } = useAuth();
  const [handleInput, setHandleInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) setHandleInput('');
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async () => {
    const h = handleInput.trim().replace(/^@/g, '').split(/\s+/)[0];
    if (!h) {
      showToast('Enter their username (handle)');
      return;
    }
    if (!isLaravelApiEnabled()) {
      showToast(
        'Invites are sent when the API is on. In offline mode you can still chat here yourself—turn on the server to invite by username.',
      );
      return;
    }
    setBusy(true);
    try {
      await inviteUserToChatGroup(groupId, h);
      showToast(`Invited @${h} to “${groupName}”`);
      onClose();
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Could not send invite');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md mx-3 sm:mx-4 rounded-t-2xl sm:rounded-2xl border border-white/15 bg-black shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar
              src={user?.avatarUrl || (user?.handle ? getAvatarForHandle(user.handle) : undefined)}
              name={user?.name || user?.handle || 'You'}
              size="sm"
              className="flex-shrink-0 border border-white/20"
            />
            <div className="flex items-center gap-2 text-white font-semibold text-sm min-w-0">
              <FiUserPlus className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="truncate">Invite to “{groupName}”</span>
            </div>
          </div>
          <button
            type="button"
            className="p-2 rounded-full hover:bg-white/10 text-white/80 shrink-0"
            onClick={() => !busy && onClose()}
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 bg-black">
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">Their username</label>
          <input
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            placeholder="e.g. jane or @jane"
            autoCapitalize="off"
            autoCorrect="off"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          <p className="text-[11px] text-white/45 leading-relaxed">
            They’ll get a notification when the app is connected to your server. You can also open their profile → menu → Invite to
            group.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm"
          >
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
