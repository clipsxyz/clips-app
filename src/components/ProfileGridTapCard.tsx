import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiMaximize2, FiShare2, FiVolume2, FiVolumeX } from 'react-icons/fi';
import type { Post } from '../types';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import { resolvePostThumbnail } from '../api/collections';
import { postHasVideoMedia, resolvePostPlaybackUri, siblingJpegFromVideoUrl } from '../utils/postMedia';
import {
  getPostBodyText,
  getTextOnlyBackgroundColor,
  getTextOnlyTextColor,
  isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { isTextCardStyleId, TEXT_CARD_STYLES } from '../utils/textCardStyles';
import { formatProfileDisplayHandle } from '../utils/profileShareUrl';

export type ProfileGridTapOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const ACTION_ROW = 52;
const STACK_GAP = 12;
const ACTION_BORDER = 2;

export type ProfileGridTapAction = {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
};

export function profileGridCardFrame(width: number, height: number, actionCount = 3): ProfileGridTapOrigin {
  const actionsHeight = ACTION_ROW * Math.max(1, actionCount) + ACTION_BORDER * 2;
  const cardW = Math.round(Math.min(width * 0.78, 340));
  const available = height - actionsHeight - STACK_GAP - 72;
  const cardH = Math.max(220, Math.min(Math.round(cardW * (16 / 9)), available));
  const stackH = cardH + STACK_GAP + actionsHeight;
  const top = Math.max(24, Math.round((height - stackH) / 2));
  const left = Math.round((width - cardW) / 2);
  return { top, left, width: cardW, height: cardH };
}

function stillUrl(post: Post): string {
  const thumb = resolvePostThumbnail(post);
  if (thumb && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(thumb)) return rewriteMediaUrlForClient(thumb);
  const item = (post.mediaItems || []).find((entry) => entry?.url);
  const jpeg = siblingJpegFromVideoUrl(item?.url || post.mediaUrl);
  const raw = jpeg || post.videoPosterUrl || '';
  return raw ? rewriteMediaUrlForClient(raw) : '';
}

type Props = {
  post: Post;
  origin: ProfileGridTapOrigin;
  profileHandle: string;
  onClose: () => void;
  onAddToStory?: () => void;
  onShare?: () => void;
  onViewFullscreen?: (frame: ProfileGridTapOrigin) => void;
  /** Replaces Add to Story, Share, and View in fullscreen. */
  actions?: ProfileGridTapAction[];
};

export default function ProfileGridTapCard({
  post,
  origin,
  profileHandle,
  onClose,
  onAddToStory,
  onShare,
  onViewFullscreen,
  actions,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [textFull, setTextFull] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoEl = useRef<HTMLVideoElement>(null);
  const actionCount = actions?.length || 3;
  const frame = useMemo(
    () => profileGridCardFrame(window.innerWidth, window.innerHeight, actionCount),
    [post.id, actionCount],
  );
  const video = isVideoPost(post) || postHasVideoMedia(post);
  const playbackRaw = video ? resolvePostPlaybackUri(post) : undefined;
  const playback = playbackRaw ? rewriteMediaUrlForClient(playbackRaw) : '';
  const poster = stillUrl(post);
  const imageUrl = !video ? poster || (post.mediaUrl ? rewriteMediaUrlForClient(post.mediaUrl) : '') : '';
  const caption = getPostBodyText(post);
  const handleLabel = formatProfileDisplayHandle(profileHandle || post.userHandle);
  const card = isTextCardStyleId(post.cardStyle) ? TEXT_CARD_STYLES[post.cardStyle] : null;

  useEffect(() => {
    setMuted(true);
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setExpanded(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [post.id]);

  useEffect(() => {
    const node = videoEl.current;
    if (!node) return;
    node.muted = muted;
    node.disableRemotePlayback = true;
  }, [muted, playback]);

  const requestClose = () => {
    if (textFull) {
      setTextFull(false);
      return;
    }
    setClosing(true);
    setExpanded(false);
    window.setTimeout(onClose, 280);
  };

  const shown = textFull
    ? { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
    : expanded && !closing
      ? frame
      : origin;
  const actionsOn = expanded && !closing && !textFull;

  const shell = (
    <div className="fixed inset-0 z-[240]" role="dialog" aria-label="Post">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 transition-opacity duration-300"
        style={{ opacity: expanded && !closing ? 1 : 0 }}
        aria-label="Close"
        onClick={requestClose}
      />
      <div
        className="absolute overflow-hidden bg-black transition-[top,left,width,height,border-radius] duration-300 ease-out"
        style={{
          top: shown.top,
          left: shown.left,
          width: shown.width,
          height: shown.height,
          borderRadius: textFull ? 0 : expanded && !closing ? 18 : 8,
        }}
      >
        {video && playback ? (
          <video
            ref={videoEl}
            src={playback}
            poster={poster || undefined}
            className="h-full w-full object-cover"
            autoPlay
            muted={muted}
            loop
            playsInline
            disableRemotePlayback
            controlsList="nodownload nofullscreen noremoteplayback"
          />
        ) : imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-6 text-center text-[22px] font-bold leading-7"
            style={{
              color: card?.textColor || getTextOnlyTextColor(post),
              background:
                card && card.colors.length >= 2
                  ? `linear-gradient(180deg, ${card.colors.join(', ')})`
                  : card?.colors[0] || getTextOnlyBackgroundColor(post),
            }}
          >
            {caption || 'Post'}
          </div>
        )}
        {textFull ? (
          <button
            type="button"
            onClick={requestClose}
            className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-2 text-sm font-semibold text-white"
          >
            Close
          </button>
        ) : (
          <div
            className="absolute bottom-0 left-0 right-0 bg-[rgba(88,82,76,0.88)] px-3.5 py-3 text-[16px] font-bold text-white transition-opacity duration-200"
            style={{ opacity: actionsOn ? 1 : 0 }}
          >
            {handleLabel}
          </div>
        )}
        {video && playback && !textFull ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              setMuted((current) => !current);
            }}
            className="absolute bottom-14 right-3 z-30 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/55 bg-black/70 text-white"
            style={{ opacity: actionsOn ? 1 : 0, pointerEvents: actionsOn ? 'auto' : 'none' }}
            aria-label={muted ? 'Unmute video' : 'Mute video'}
          >
            {muted ? <FiVolumeX size={13} /> : <FiVolume2 size={13} />}
          </button>
        ) : null}
      </div>
      <div
        className="absolute rounded-2xl p-0.5"
        style={{
          top: frame.top + frame.height + STACK_GAP,
          left: frame.left,
          width: frame.width,
          background: 'linear-gradient(135deg, #22C55E, #FFD400, #FF4D9A)',
          opacity: actionsOn ? 1 : 0,
          pointerEvents: actionsOn ? 'auto' : 'none',
        }}
      >
        <div className="overflow-hidden rounded-[14px] bg-black text-white">
        {actions
          ? actions.map((action, index) => (
              <React.Fragment key={action.label}>
                {index > 0 ? <div className="ml-4 h-px bg-white/15" /> : null}
                <button
                  type="button"
                  className="flex min-h-[52px] w-full items-center justify-between px-4 text-left text-[16px] font-semibold"
                  onClick={action.onPress}
                >
                  {action.label}
                  {action.icon}
                </button>
              </React.Fragment>
            ))
          : (
            <>
              <button
                type="button"
                className="flex min-h-[52px] w-full items-center justify-between px-4 text-left text-[16px] font-semibold"
                onClick={onAddToStory}
              >
                Add to Story
                <span aria-hidden className="text-[18px] leading-none">✦</span>
              </button>
              <div className="ml-4 h-px bg-white/15" />
              <button
                type="button"
                className="flex min-h-[52px] w-full items-center justify-between px-4 text-left text-[16px] font-semibold"
                onClick={onShare}
              >
                Share
                <FiShare2 className="h-5 w-5" />
              </button>
              <div className="ml-4 h-px bg-white/15" />
              <button
                type="button"
                className="flex min-h-[52px] w-full items-center justify-between px-4 text-left text-[16px] font-semibold"
                onClick={() => {
                  if (!video && !imageUrl) {
                    setTextFull(true);
                    return;
                  }
                  onViewFullscreen?.(frame);
                }}
              >
                View in fullscreen
                <FiMaximize2 className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(shell, document.body);
}
