import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiInfo, FiPlay } from 'react-icons/fi';
import { GiGreekTemple } from 'react-icons/gi';
import Avatar from './Avatar';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas';
import { getAvatarForHandle } from '../api/users';
import { resolveMockFeedVideoUrl } from '../constants/mockFeedVideos';
import type { Post } from '../types';
import type { SuggestedFollowerSuggestion } from '../utils/suggestedFollowerFeed';

const STRIP_VIDEO_LOOP_SEC = 3;
const VIDEO_SRC_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

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

/** Suggested follow card — View Profile passport night-atlas canvas. */
export default function SuggestedFollowerFeedCard({
  suggestion,
  onFollow,
  onDismiss,
  onNotInterested,
}: Props) {
  const navigate = useNavigate();
  const [followBusy, setFollowBusy] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const avatar = suggestion.avatarUrl || getAvatarForHandle(suggestion.userHandle);

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
      className="relative mx-2.5 mb-3 overflow-hidden rounded-2xl border border-white/10 bg-[#060d16] shadow-lg"
      aria-label="Suggested account to follow"
    >
      <DiscoverAmbientCanvas fixed={false} variant="passport" />

      <div className="relative z-[2] min-h-[280px]">
      <button
        type="button"
        onClick={() => setInfoOpen((v) => !v)}
        className="absolute left-3 top-3 z-10 rounded-full p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
        aria-label="Why am I seeing this?"
      >
        <FiInfo className="h-4 w-4" />
      </button>

      {infoOpen ? (
        <div className="absolute left-3 right-3 top-12 z-20 rounded-xl border border-white/10 bg-[rgba(15,36,48,0.94)] px-3 py-2 text-[11px] text-white/75 leading-snug shadow-xl backdrop-blur-md">
          Gazetteer only suggests people who have posted in your area. Clips play muted in the feed, like other posts.
        </div>
      ) : null}

      <div className="flex flex-col items-center px-4 pt-10 pb-3">
        <button type="button" onClick={openProfile} className="flex flex-col items-center">
          <Avatar src={avatar} name={suggestion.displayName} size="xl" className="ring-2 ring-[#3d9b8f]/40" />
          <p className="mt-3 text-base font-semibold text-white">{suggestion.userHandle}</p>
          <p className="mt-1 text-xs text-white/55 text-center">{suggestion.contextLabel}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#3d9b8f]">
            <GiGreekTemple className="h-3 w-3" aria-hidden />
            Suggested by Gazetteer
          </p>
        </button>
      </div>

      <div className="flex gap-2 px-4 pb-4">
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
            className="relative flex-1 overflow-hidden rounded-lg border border-white/10 bg-black/30 aspect-[3/4] min-w-0 backdrop-blur-sm"
          >
            {videoSrc ? (
              <PreviewVideo
                src={videoSrc}
                poster={stillSrc}
                className="h-full w-full object-cover"
              />
            ) : (
              <img src={stillSrc || preview.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5">
              <FiPlay className="h-2.5 w-2.5 text-white" aria-hidden />
              <span className="text-[10px] font-semibold text-white">
                {preview.views >= 1000 ? `${(preview.views / 1000).toFixed(1)}k` : preview.views}
              </span>
            </div>
            {preview.gazetteerMusic ? (
              <div
                className="absolute top-1.5 right-1.5 rounded bg-[#3d9b8f]/90 px-1 py-0.5 text-[9px] font-semibold text-white"
                title="Licensed background audio"
              >
                ♪ Gazetteer
              </div>
            ) : null}
          </button>
          );
        })}
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={onNotInterested}
          className="flex-1 rounded-full border border-white/15 bg-[rgba(15,36,48,0.72)] py-2.5 text-sm font-semibold text-gray-200 backdrop-blur-md hover:bg-white/10"
        >
          Not interested
        </button>
        <button
          type="button"
          disabled={followBusy}
          onClick={onFollowClick}
          className="flex-1 rounded-full border border-white/10 bg-[#3d9b8f]/25 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-[#3d9b8f]/35 disabled:opacity-60"
        >
          {followBusy ? 'Saving…' : 'Follow'}
        </button>
      </div>
      </div>
    </article>
  );
}
