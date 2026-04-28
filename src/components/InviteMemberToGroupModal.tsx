import React from 'react';
import { FiX, FiUserPlus } from 'react-icons/fi';
import { inviteUserToChatGroup } from '../api/chatGroups';
import { unifiedSearch } from '../api/search';
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
  const [suggestions, setSuggestions] = React.useState<Array<{ handle: string; display_name?: string; avatar_url?: string }>>([]);
  const [searching, setSearching] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setHandleInput('');
      setSuggestions([]);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || busy) return;
    const q = handleInput.trim().replace(/^@/g, '');
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await unifiedSearch({ q, types: 'users', usersLimit: 6 });
        if (cancelled) return;
        const users = Array.isArray(res?.sections?.users?.items) ? res.sections.users.items : [];
        const next = users
          .map((u: any) => ({
            handle: String(u?.handle || '').trim(),
            display_name: typeof u?.display_name === 'string' ? u.display_name : undefined,
            avatar_url: typeof u?.avatar_url === 'string' ? u.avatar_url : undefined,
          }))
          .filter((u: { handle: string }) => !!u.handle);
        setSuggestions(next);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handleInput, isOpen, busy]);

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
      showToast(`@${h} will see this in Notifications`);
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
              <FiUserPlus className="w-5 h-5 text-white shrink-0" />
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
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/40"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          {(searching || suggestions.length > 0) && (
            <div className="rounded-xl border border-white/10 bg-black/70 max-h-40 overflow-y-auto">
              {searching ? (
                <div className="px-3 py-2 text-xs text-white/50">Searching users...</div>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.handle}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-white/10 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setHandleInput(s.handle);
                      setSuggestions([]);
                    }}
                  >
                    <Avatar src={s.avatar_url || getAvatarForHandle(s.handle)} name={s.display_name || s.handle} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{s.display_name || s.handle}</p>
                      <p className="text-[11px] text-white/55 truncate">{s.handle}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
          <p className="text-[11px] text-white/45 leading-relaxed">
            They&apos;ll get a notification invite in their notifications tab when the app is connected to your server.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full py-3 rounded-xl bg-white hover:bg-white/90 disabled:opacity-50 text-black font-semibold text-sm"
          >
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
