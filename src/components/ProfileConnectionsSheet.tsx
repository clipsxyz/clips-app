import React, { useEffect, useState } from 'react';
import { FiLock, FiSearch, FiUserMinus, FiX } from 'react-icons/fi';
import Avatar from './Avatar';
import GazetteerAlertSheet from './GazetteerAlertSheet';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';

export type ProfileConnectionScope = 'mutual' | 'followers' | 'following' | 'suggested';

export type ProfileConnectionRow = {
  handleNoAt: string;
  displayName: string;
  avatarUrl?: string;
  isRequested?: boolean;
  isPrivate?: boolean;
  isFollowing?: boolean;
  suggestionReason?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  scope: ProfileConnectionScope;
  onScopeChange: (scope: ProfileConnectionScope) => void;
  search: string;
  onSearchChange: (value: string) => void;
  rows: ProfileConnectionRow[];
  loading: boolean;
  viewerHandle?: string;
  followMap: Record<string, boolean>;
  requestMap: Record<string, boolean>;
  actionLoadingMap: Record<string, boolean>;
  onToggleFollow: (handleNoAt: string, nextFollowing: boolean) => Promise<void> | void;
  onRemoveFollower?: (handleNoAt: string) => Promise<void> | void;
  onDismissSuggested?: (handleNoAt: string) => void;
  onUndoDismissSuggested?: (handleNoAt: string) => void;
  onOpenProfile: (handleNoAt: string) => void;
};

const TABS: { id: ProfileConnectionScope; label: string }[] = [
  { id: 'mutual', label: 'Mutual' },
  { id: 'followers', label: 'Followers' },
  { id: 'following', label: 'Following' },
  { id: 'suggested', label: 'Suggested' },
];

function scopeTitle(scope: ProfileConnectionScope): string {
  if (scope === 'mutual') return 'Mutual';
  if (scope === 'suggested') return 'Suggested';
  if (scope === 'followers') return 'Followers';
  return 'Following';
}

const SHEET_GRADIENT = 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)';

export default function ProfileConnectionsSheet({
  visible,
  onClose,
  scope,
  onScopeChange,
  search,
  onSearchChange,
  rows,
  loading,
  viewerHandle,
  followMap,
  requestMap,
  actionLoadingMap,
  onToggleFollow,
  onRemoveFollower,
  onDismissSuggested,
  onUndoDismissSuggested,
  onOpenProfile,
}: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [undoHandle, setUndoHandle] = useState<string | null>(null);
  const [removeHandle, setRemoveHandle] = useState<string | null>(null);
  const viewerKey = String(viewerHandle || '').replace(/^@/, '').trim().toLowerCase();
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.id === scope));

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
      setUndoHandle(null);
    }, undoHandle ? 4200 : 2200);
    return () => window.clearTimeout(timer);
  }, [toast, undoHandle]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[220] flex justify-center" style={{ background: SHEET_GRADIENT }}>
      <div className="flex h-full w-full max-w-md flex-col pt-[max(20px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-lg font-semibold text-white">{scopeTitle(scope)}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white"
            aria-label="Close connections"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-1 px-2">
          <div className="flex">
            {TABS.map((tab) => {
              const active = scope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onScopeChange(tab.id)}
                  className={`flex-1 pb-2.5 text-center font-semibold ${active ? 'text-base text-white' : 'text-sm text-[#E2E8F0]'}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex h-[3px]">
            {TABS.map((tab, index) => (
              <div key={`ind-${tab.id}`} className="flex flex-1 items-end justify-center">
                {index === activeIndex ? <span className="h-[3px] w-[70%] rounded-full bg-white" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-4 mb-2 mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
          <FiSearch className="h-4 w-4 text-white" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={`Search ${scope}`}
            className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-[#94A3B8]"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div
                  key={`sk-${idx}`}
                  className="flex animate-pulse items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-3"
                >
                  <div className="h-10 w-10 rounded-full bg-white/[0.12]" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-[55%] rounded bg-white/[0.12]" />
                    <div className="h-2.5 w-[40%] rounded bg-white/10" />
                  </div>
                  <div className="h-7 w-[84px] rounded-full bg-white/[0.12]" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="mt-16 text-center text-sm text-[#94A3B8]">
              {search.trim() ? 'No people match your search.' : `No ${scope} yet.`}
            </p>
          ) : (
            rows.map((row) => {
              const key = row.handleNoAt;
              const isOwnRow = !!viewerKey && key.replace(/^@/, '').trim().toLowerCase() === viewerKey;
              const following = followMap[key] === true || (followMap[key] == null && row.isFollowing === true);
              const requested = requestMap[key] === true || !!row.isRequested;
              const busy = !!actionLoadingMap[key];
              const followBack = scope === 'followers' && !following;
              const label = following ? 'Following' : requested ? 'Requested' : followBack ? 'Follow Back' : 'Follow';
              const filled = !following && !requested;
              const avatar = row.avatarUrl ? rewriteMediaUrlForClient(row.avatarUrl) : undefined;
              return (
                <div
                  key={key}
                  className="mb-2 flex items-center gap-2.5 rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => onOpenProfile(key)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar src={avatar} name={row.displayName || key} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white">{row.displayName || key}</span>
                      <span className="block truncate text-xs text-[#E2E8F0]">@{key.replace(/^@/, '')}</span>
                      {scope === 'suggested' && row.suggestionReason ? (
                        <span className="mt-0.5 block truncate text-[11px] text-[#94A3B8]">{row.suggestionReason}</span>
                      ) : null}
                      {requested && !following ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-[#E2E8F0]">
                          <FiLock className="h-2.5 w-2.5" />
                          Private account
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {!isOwnRow ? (
                    <span className="flex items-center gap-1.5">
                      {scope === 'suggested' && onDismissSuggested ? (
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/[0.08] text-[#E2E8F0]"
                          aria-label={`Hide @${key}`}
                          onClick={() => {
                            onDismissSuggested(key);
                            setUndoHandle(key);
                            setToast('Suggestion hidden');
                          }}
                        >
                          <FiX className="h-4 w-4" />
                        </button>
                      ) : null}
                      {scope === 'followers' && onRemoveFollower ? (
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/[0.08] text-[#E2E8F0]"
                          aria-label={`Remove @${key}`}
                          onClick={() => setRemoveHandle(key)}
                        >
                          <FiUserMinus className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void Promise.resolve(onToggleFollow(key, !(following || requested))).catch(() => {
                            setUndoHandle(null);
                            setToast('Couldn’t update follow');
                          });
                        }}
                        className={`min-w-[108px] rounded-full border px-3 py-1.5 text-xs font-bold ${
                          filled
                            ? 'border-white/90 bg-white text-[#03091B]'
                            : 'border-white/25 bg-white/[0.08] text-white'
                        } disabled:opacity-60`}
                      >
                        {label}
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {toast ? (
          <button
            type="button"
            className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full border border-white/16 bg-[rgba(15,23,42,0.92)] px-3.5 py-2 text-[13px] font-semibold text-white"
            onClick={() => {
              if (undoHandle && onUndoDismissSuggested) onUndoDismissSuggested(undoHandle);
              setUndoHandle(null);
              setToast(null);
            }}
          >
            {toast}
            {undoHandle ? '  Undo' : ''}
          </button>
        ) : null}
      </div>

      <GazetteerAlertSheet
        visible={removeHandle !== null}
        title="Remove follower?"
        message={removeHandle ? `Remove @${removeHandle.replace(/^@/, '')} from your followers?` : undefined}
        confirmButtonText="Remove"
        cancelButtonText="Cancel"
        showCancelButton
        onConfirm={() => {
          const handle = removeHandle;
          setRemoveHandle(null);
          if (!handle || !onRemoveFollower) return;
          void Promise.resolve(onRemoveFollower(handle)).catch(() => {
            setUndoHandle(null);
            setToast('Couldn’t remove follower');
          });
        }}
        onDismiss={() => setRemoveHandle(null)}
      />
    </div>
  );
}
