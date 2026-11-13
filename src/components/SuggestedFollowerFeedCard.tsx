import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoBusinessOutline, IoInformationCircleOutline, IoPlay } from 'react-icons/io5';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import { resolveMockFeedVideoUrl } from '../constants/mockFeedVideos';
import type { Post } from '../types';
import type { SuggestedFollowerSuggestion } from '../utils/suggestedFollowerFeed';

const STRIP_VIDEO_LOOP_SEC = 1;
const VIDEO_SRC_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;
const PASSPORT_GRADIENT = 'linear-gradient(to bottom, #000000 0%, #23104F 100%)';

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function PreviewVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const onTimeUpdate = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const limit =
      el.duration > 0 && Number.isFinite(el.duration)
        ? Math.min(STRIP_VIDEO_LOOP_SEC, el.duration)
        : STRIP_VIDEO_LOOP_SEC;
    if (el.currentTime >= limit - 0.05) el.currentTime = 0;
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      muted
      playsInline
      autoPlay
      preload="metadata"
      onTimeUpdate={onTimeUpdate}
      onLoadedData={(e) => {
        void e.currentTarget.play().catch(() => {});
      }}
    />
  );
}

type Props = {
  suggestion: SuggestedFollowerSuggestion;
  onFollow: (post: Post) => void | Promise<void>;
  onDismiss: () => void;
  onNotInterested: () => void;
};

/** Suggested follow card — same passport gradient and chrome as the app. */
export default function SuggestedFollowerFeedCard({
  suggestion,
  onFollow,
  onDismiss: _onDismiss,
  onNotInterested,
}: Props) {
  const navigate = useNavigate();
  const [followBusy, setFollowBusy] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const avatar = suggestion.avatarUrl || getAvatarForHandle(suggestion.userHandle);
  const previewCount = suggestion.previews.length;

  const openProfile = () => navigate(`/user/${suggestion.userHandle}`);

  const onFollowClick = async () => {
    setFollowBusy(true);
    try {
      await onFollow(suggestion.representativePost);
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <article
      className="relative mx-2.5 mb-3 min-h-[300px] overflow-hidden rounded-2xl border border-white/15 bg-black"
      aria-label="Suggested account to follow"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: PASSPORT_GRADIENT }}
        aria-hidden
      />

      <div className="relative z-[2] min-h-[300px] px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={() => setInfoOpen((v) => !v)}
          className="absolute left-2 top-2 z-10 p-1.5 text-[rgba(232,238,242,0.62)]"
          aria-label="Info"
        >
          <IoInformationCircleOutline className="h-5 w-5" />
        </button>

        {infoOpen ? (
          <div className="mb-2 mt-9 rounded-xl border border-white/10 bg-black/55 px-2.5 py-2.5 text-[11px] leading-4 text-[rgba(232,238,242,0.78)]">
            Gazetteer only suggests people who have posted in your area. Clips play muted in the feed, like other
            posts.
          </div>
        ) : null}

        <button type="button" onClick={openProfile} className="mx-auto mt-8 mb-3 flex flex-col items-center">
          <Avatar src={avatar} name={suggestion.displayName} size="xl" hideBorder />
          <p className="mt-2.5 text-base font-semibold text-white">{suggestion.userHandle}</p>
          <p className="mt-1 text-center text-xs text-[rgba(232,238,242,0.62)]">{suggestion.contextLabel}</p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-white/70">
            <IoBusinessOutline className="h-3 w-3 text-white" aria-hidden />
            Suggested by Gazetteer
          </p>
        </button>

        <div className={`mb-3.5 flex gap-2 ${previewCount === 1 ? 'justify-center' : ''}`}>
          {suggestion.previews.map((preview) => {
            const videoSrc =
              preview.isVideo && preview.mediaUrl
                ? resolveMockFeedVideoUrl(preview.mediaUrl)
                : preview.isVideo && VIDEO_SRC_RE.test(preview.thumbnailUrl)
                  ? resolveMockFeedVideoUrl(preview.thumbnailUrl)
                  : undefined;
            const stillSrc =
              preview.thumbnailUrl && !VIDEO_SRC_RE.test(preview.thumbnailUrl)
                ? preview.thumbnailUrl
                : undefined;
            return (
              <button
                key={preview.postId}
                type="button"
                onClick={openProfile}
                className={`relative aspect-[3/4] overflow-hidden rounded-lg border border-white/10 bg-black/30 ${
                  previewCount === 1 ? 'w-[140px] max-w-full' : 'min-w-0 flex-1'
                }`}
              >
                {videoSrc ? (
                  <PreviewVideo src={videoSrc} poster={stillSrc} className="h-full w-full object-cover" />
                ) : stillSrc ? (
                  <img src={stillSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="block h-full w-full bg-[#121212]" />
                )}
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-[3px] rounded bg-black/45 px-1.5 py-0.5">
                  <IoPlay className="h-2.5 w-2.5 text-white" aria-hidden />
                  <span className="text-[10px] font-semibold text-white">{formatViews(preview.views)}</span>
                </span>
                {preview.gazetteerMusic ? (
                  <span
                    className="absolute right-1.5 top-1.5 rounded px-1 py-0.5 text-[8px] font-bold text-white"
                    style={{ backgroundColor: 'rgba(35, 16, 79, 0.92)' }}
                    title="Licensed background audio"
                  >
                    ♪ Gazetteer
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNotInterested}
            className="flex-1 rounded-full border border-white/15 bg-black/45 py-[11px] text-sm font-semibold text-[#E5E7EB]"
          >
            Not interested
          </button>
          <button
            type="button"
            disabled={followBusy}
            onClick={onFollowClick}
            className="relative flex-1 overflow-hidden rounded-full border border-white/10 py-[11px] text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: PASSPORT_GRADIENT }}
          >
            Follow
          </button>
        </div>
      </div>
    </article>
  );
}
