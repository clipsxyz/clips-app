import React from 'react';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';

type VideoCTAOverlayProps = {
  onPress: () => void;
  label?: string;
  /** Post author handle — used for profile pic on the badge. */
  userHandle?: string;
  avatarSrc?: string;
  className?: string;
};

/**
 * Bottom-left CTA on feed video cards — opens Scenes on tap.
 * Uses transform-only CSS animation for smooth scroll performance.
 */
export default function VideoCTAOverlay({
  onPress,
  label = 'View in scenes',
  userHandle,
  avatarSrc: avatarSrcProp,
  className = '',
}: VideoCTAOverlayProps) {
  const avatarSrc = avatarSrcProp ?? (userHandle ? getAvatarForHandle(userHandle) : undefined);
  const avatarName = userHandle?.split('@')[0] || 'User';
  const handleActivate = React.useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation();
      try {
        e.preventDefault();
      } catch {
        /* passive listener edge cases */
      }
      onPress();
    },
    [onPress],
  );

  return (
    <div
      className={`absolute bottom-3 left-3 z-30 pointer-events-auto ${className}`.trim()}
      style={{ touchAction: 'manipulation' }}
    >
      <button
        type="button"
        onClick={handleActivate}
        onTouchEnd={handleActivate}
        className="group -m-1 p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 min-h-[32px] min-w-[32px] flex items-center justify-center"
        aria-label={label}
        title={label}
      >
        <span className="feed-scenes-cta-pulse flex items-center max-w-[min(52vw,180px)]">
          <span className="relative z-10 shrink-0 rounded-full ring-1 ring-white/30 shadow-sm">
            <Avatar src={avatarSrc} name={avatarName} size={22} />
          </span>
          <span className="-ml-1 flex min-w-0 items-center rounded-full bg-black/60 py-0.5 pl-1.5 pr-2 text-[10px] font-medium leading-none text-white shadow-md backdrop-blur-md ring-1 ring-white/10 transition-colors group-hover:bg-black/70 group-active:bg-black/75">
            <span className="truncate">{label}</span>
          </span>
        </span>
      </button>
    </div>
  );
}
