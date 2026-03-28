import React from 'react';
import { FiMapPin, FiChevronRight, FiX } from 'react-icons/fi';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import {
  reasonLabel,
  emitSuggestedPlacesAnalytics,
  type PlaceMatchedPost,
  type PlaceSuggestionReason,
} from '../utils/suggestedPlaces';

function postThumbUrl(p: PlaceMatchedPost['post']): string | undefined {
  const items = p.mediaItems;
  if (items && items.length > 0) {
    const first = items.find((m) => m.type === 'image' || m.type === 'video');
    if (first?.url) return first.url;
  }
  if (p.mediaUrl) return p.mediaUrl;
  return undefined;
}

function scrollToFeedPost(
  postId: string,
  analytics?: { matchedPlace: string; reason: PlaceSuggestionReason; bundleKey: string }
) {
  const id = String(postId);
  try {
    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(id)
        : id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const el = document.querySelector(`[data-feed-post-id="${esc}"]`) as HTMLElement | null;
    if (!el) return;
    if (analytics) {
      emitSuggestedPlacesAnalytics({
        action: 'jump_to_post',
        postId: id,
        matchedPlace: analytics.matchedPlace,
        reason: analytics.reason,
        bundleKey: analytics.bundleKey,
      });
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const highlight = [
      'ring-2',
      'ring-cyan-400/90',
      'ring-offset-2',
      'ring-offset-[#030712]',
      'shadow-[0_0_0_1px_rgba(34,211,238,0.35)]',
    ] as const;
    el.classList.add(...highlight);
    window.setTimeout(() => {
      el.classList.remove(...highlight);
    }, 2200);
  } catch {
    /* ignore */
  }
}

export type SuggestedPlacesFeedSectionProps = {
  bundleKey: string;
  suggestions: PlaceMatchedPost[];
  includePosterLocale: boolean;
  onToggleIncludePosterLocale: (enabled: boolean) => void;
  onDismissRow: () => void;
  onDismissAll: () => void;
};

export default function SuggestedPlacesFeedSection({
  bundleKey,
  suggestions,
  includePosterLocale,
  onToggleIncludePosterLocale,
  onDismissRow,
  onDismissAll,
}: SuggestedPlacesFeedSectionProps) {
  React.useEffect(() => {
    emitSuggestedPlacesAnalytics({
      action: 'strip_view',
      bundleKey,
      suggestionCount: suggestions.length,
      includePosterRegionalNational: includePosterLocale,
    });
  }, [bundleKey, suggestions.length, includePosterLocale]);

  if (!suggestions.length) return null;

  return (
    <section
      className="mx-3 mb-4 rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-[#0c1528] via-[#0f1c35] to-[#132744] p-3 shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
      aria-label="Suggested posts based on your places"
    >
      <div className="flex items-start gap-2 mb-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
          <FiMapPin className="w-4 h-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white tracking-tight">Suggested for your places</h3>
          <p className="text-xs text-slate-400 mt-0.5 leading-snug">
            From your location, travels, and bio — matched to post venues and places.
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDismissRow();
          }}
          className="shrink-0 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Hide this suggestion row"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-0.5 px-0.5">
        {suggestions.map(({ post, matchedPlace, reason }) => {
          const thumb = postThumbUrl(post);
          const avatar = getAvatarForHandle(post.userHandle);
          return (
            <button
              key={String(post.id)}
              type="button"
              onClick={() =>
                scrollToFeedPost(String(post.id), {
                  matchedPlace,
                  reason,
                  bundleKey,
                })
              }
              className="shrink-0 w-[132px] text-left rounded-xl border border-white/10 bg-black/25 overflow-hidden hover:border-cyan-400/40 hover:bg-black/35 transition-colors"
            >
              <div className="relative aspect-[4/5] bg-slate-900">
                {thumb ? (
                  <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 px-2 text-center">
                    {post.text?.slice(0, 80) || post.caption?.slice(0, 80) || 'Clip'}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-1.5 px-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar src={avatar} name={post.userHandle} size="sm" className="!w-[22px] !h-[22px] !text-[9px]" />
                    <span className="text-[11px] font-medium text-white truncate">{post.userHandle}</span>
                  </div>
                </div>
              </div>
              <div className="px-2 py-2 space-y-1">
                <p className="text-[10px] font-semibold text-cyan-200/95 truncate" title={matchedPlace}>
                  {matchedPlace}
                </p>
                <p className="text-[9px] text-slate-500 leading-tight">{reasonLabel(reason)}</p>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-cyan-300/90">
                  Jump to post
                  <FiChevronRight className="w-3 h-3" aria-hidden />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
        <button
          type="button"
          onClick={onDismissAll}
          className="text-xs text-slate-400 hover:text-cyan-200/90 underline underline-offset-2"
        >
          Hide all place suggestions this session
        </button>

        <div className="flex items-start gap-2.5 select-none">
          <button
            type="button"
            role="switch"
            aria-checked={includePosterLocale}
            aria-label="Broader matching: include poster region and country"
            onClick={() => onToggleIncludePosterLocale(!includePosterLocale)}
            className={`mt-0.5 relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
              includePosterLocale ? 'bg-cyan-500/80' : 'bg-slate-600/80'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                includePosterLocale ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
          <div className="text-[11px] text-slate-400 leading-snug">
            <span className="text-slate-300 font-medium">Broader matching</span>
            <span className="block mt-0.5">
              Also use each poster’s region and country (more results; may feel less specific).
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
