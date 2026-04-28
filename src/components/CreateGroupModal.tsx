import React from 'react';
import { FiX, FiUsers } from 'react-icons/fi';
import { createChatGroup } from '../api/chatGroups';
import { showToast } from '../utils/toast';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { useAuth } from '../context/Auth';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';

export default function CreateGroupModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (group: { id: string; name: string; avatar_url?: string | null; conversation_id: string }) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = React.useState('');
  const [avatarDataUrl, setAvatarDataUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setName('');
      setAvatarDataUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Enter a group name');
      return;
    }
    const creatorHandle = user?.handle?.trim();
    if (!isLaravelApiEnabled() && !creatorHandle) {
      showToast('Sign in to create a group in offline mode');
      return;
    }
    setBusy(true);
    try {
      const g = await createChatGroup(trimmed, creatorHandle ?? null, avatarDataUrl);
      if (g) {
        onCreated?.(g);
        onClose();
      } else {
        showToast(
          isLaravelApiEnabled()
            ? 'Could not create group (try signing in again)'
            : 'Could not create group',
        );
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Could not create group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md mx-3 sm:mx-4 rounded-t-2xl sm:rounded-2xl border border-white/15 bg-black shadow-2xl overflow-hidden mb-safe">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar
              src={user?.avatarUrl || (user?.handle ? getAvatarForHandle(user.handle) : undefined)}
              name={user?.name || user?.handle || 'You'}
              size="sm"
              className="flex-shrink-0 border border-white/20"
            />
            <div className="flex items-center gap-2 text-white font-semibold min-w-0">
              <FiUsers className="w-5 h-5 text-white shrink-0" />
              <span className="truncate">New group</span>
            </div>
          </div>
          <button type="button" className="p-2 rounded-full hover:bg-white/10 text-white/80 shrink-0" onClick={() => !busy && onClose()} aria-label="Close">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 bg-black">
          <p className="text-xs text-white/50 leading-relaxed">
            Next you&apos;ll open the group chat. Invite people with the <strong className="text-white/70">+</strong> button there, or
            open someone&apos;s profile → <strong className="text-white/70">Invite to group</strong>.
          </p>
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dublin photographers"
            maxLength={120}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/40"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          <div className="space-y-2">
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">Group photo (optional)</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                {avatarDataUrl ? 'Change photo' : 'Choose photo'}
              </button>
              {avatarDataUrl ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAvatarDataUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const result = typeof reader.result === 'string' ? reader.result : null;
                  if (!result) {
                    showToast('Could not read image file');
                    return;
                  }
                  setAvatarDataUrl(result);
                };
                reader.onerror = () => showToast('Could not read image file');
                reader.readAsDataURL(file);
              }}
            />
            {avatarDataUrl ? (
              <div className="w-16 h-16 rounded-full overflow-hidden border border-white/20">
                <img src={avatarDataUrl} alt="Group avatar preview" className="w-full h-full object-cover" />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full py-3 rounded-xl bg-white hover:bg-white/90 disabled:opacity-50 text-black font-semibold text-sm"
          >
            {busy ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </div>
    </div>
  );
}
