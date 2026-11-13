import React from 'react';
import { FiX, FiUsers, FiImage, FiCamera, FiTrash2 } from 'react-icons/fi';
import { createChatGroup } from '../api/chatGroups';
import { uploadFile } from '../api/client';
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
  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setName('');
      setAvatarPreviewUrl(null);
      setAvatarFile(null);
      setFormError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter a group name');
      return;
    }
    const creatorHandle = user?.handle?.trim();
    if (!isLaravelApiEnabled() && !creatorHandle) {
      setFormError('Sign in to create a group in offline mode');
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        if (isLaravelApiEnabled()) {
          const upload = await uploadFile(avatarFile);
          avatarUrl = upload?.fileUrl || upload?.url || null;
          if (!avatarUrl) {
            throw new Error('Could not upload group photo');
          }
        } else if (avatarPreviewUrl) {
          avatarUrl = avatarPreviewUrl;
        }
      }
      const g = await createChatGroup(trimmed, creatorHandle ?? null, avatarUrl);
      if (g) {
        onCreated?.(g);
        onClose();
      } else {
        setFormError(
          isLaravelApiEnabled()
            ? 'Could not create group (try signing in again)'
            : 'Could not create group',
        );
      }
    } catch (e: any) {
      console.error(e);
      setFormError(e?.message || 'Could not create group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[295] flex items-end justify-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/72"
        onClick={() => !busy && onClose()}
      />
      <div
        className="relative z-[2] max-h-[88%] w-[min(400px,calc(100%-24px))] overflow-hidden rounded-t-3xl border border-b-0 border-white/[0.08]"
        style={{
          backgroundColor: '#03091B',
          backgroundImage: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-h-[88vh] overflow-y-auto px-4 pt-1">
          <div className="flex justify-center pb-2">
            <div className="h-1 w-10 rounded-full bg-white/[0.28]" />
          </div>
          <div className="mb-2 flex items-center gap-2.5 border-b border-white/[0.12] pb-3">
            <Avatar
              src={user?.avatarUrl || (user?.handle ? getAvatarForHandle(user.handle) : undefined)}
              name={user?.name || user?.handle || 'You'}
              size={36}
            />
            <div className="flex min-w-0 flex-1 items-center gap-2 text-white">
              <FiUsers className="h-5 w-5 shrink-0" />
              <span className="truncate text-[17px] font-semibold">New group</span>
            </div>
            <button
              type="button"
              className="shrink-0 p-1 text-white disabled:opacity-50"
              onClick={() => !busy && onClose()}
              aria-label="Close"
              disabled={busy}
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
          <p className="mb-3 text-xs leading-[18px] text-[#94A3B8]">
            Next you&apos;ll open the group chat. Invite people with the + button there, or open someone&apos;s profile → Invite to group.
          </p>
          <label className="mb-1.5 mt-2 block text-[11px] font-bold uppercase text-[#E2E8F0]">Group name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="e.g. Dublin photographers"
            maxLength={120}
            className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-3 text-white placeholder:text-[#94A3B8] focus:outline-none"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          {formError ? <p className="mt-2 text-[13px] text-[#F87171]">{formError}</p> : null}
          <label className="mb-1.5 mt-2 block text-[11px] font-bold uppercase text-[#E2E8F0]">Group photo (optional)</label>
          <div className="mt-2 flex items-center gap-3.5 rounded-xl border border-white/[0.12] bg-white/[0.05] p-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04]">
              {avatarPreviewUrl ? (
                <img src={avatarPreviewUrl} alt="Group avatar preview" className="h-full w-full object-cover" />
              ) : (
                <FiImage className="h-[22px] w-[22px] text-white/55" aria-hidden />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-[9px] text-xs font-semibold text-white disabled:opacity-50"
              >
                <FiCamera className="h-[15px] w-[15px]" />
                {avatarPreviewUrl ? 'Change photo' : 'Choose photo'}
              </button>
              {avatarPreviewUrl ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAvatarPreviewUrl(null);
                    setAvatarFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-[9px] text-xs font-semibold text-white/80 disabled:opacity-50"
                >
                  <FiTrash2 className="h-[15px] w-[15px]" />
                  Remove
                </button>
              ) : null}
            </div>
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
                  setFormError('Could not read image file');
                  return;
                }
                setAvatarFile(file);
                setAvatarPreviewUrl(result);
              };
              reader.onerror = () => setFormError('Could not read image file');
              reader.readAsDataURL(file);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="mb-2 mt-5 w-full rounded-xl bg-white py-3.5 text-[15px] font-bold text-black disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </div>
    </div>
  );
}
