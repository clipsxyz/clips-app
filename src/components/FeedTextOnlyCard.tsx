import React from 'react';
import type { StickerOverlay } from '../types';
import StickerOverlayComponent from './StickerOverlay';
import { isTextCardStyleId, TEXT_CARD_STYLES, textCardStyleBackground } from '../utils/textCardStyles';
import { FEED_TEXT_CARD_FONT_WEB, feedTextCardType } from '../utils/textCardFeedType';

const DOUBLE_TAP_MS = 300;
const BODY_COLOR = '#F1F5F9';

type Props = {
  text: string;
  cardStyle?: string | null;
  stickers?: StickerOverlay[];
  onDoubleLike: () => Promise<void> | void;
  onHeartAnimation?: (clientX: number, clientY: number) => void;
};

/** Same body as the React Native newsfeed: plain copy, or a card-style fill when one was chosen. */
export default function FeedTextOnlyCard({
  text,
  cardStyle,
  stickers,
  onDoubleLike,
  onHeartAnimation,
}: Props) {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const lastTapRef = React.useRef(0);
  const [tapPosition, setTapPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [bodySize, setBodySize] = React.useState({ width: 0, height: 0 });
  const trimmed = text.trim();
  const card = isTextCardStyleId(cardStyle) ? TEXT_CARD_STYLES[cardStyle] : null;

  React.useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBodySize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [trimmed, cardStyle]);

  if (!trimmed) return null;

  function handleClick(e: React.MouseEvent) {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (rect) {
        setTapPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      onHeartAnimation?.(e.clientX, e.clientY);
      void Promise.resolve(onDoubleLike()).catch(() => {});
      window.setTimeout(() => setTapPosition(null), 500);
    }
    lastTapRef.current = now;
  }

  const type = feedTextCardType(trimmed);
  const body = (
    <div ref={bodyRef} className="relative flex w-full flex-1 items-center justify-center">
      <p
        className="m-0 w-full whitespace-pre-wrap break-words text-center font-semibold"
        style={{
          color: card?.textColor || BODY_COLOR,
          fontFamily: FEED_TEXT_CARD_FONT_WEB,
          fontSize: type.fontSize,
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
        }}
      >
        {trimmed}
      </p>
      {stickers && stickers.length > 0 && bodySize.width > 0
        ? stickers.map((overlay, index) => {
            const feedScale = 0.6;
            let adjustedX = overlay.x;
            let adjustedY = overlay.y;
            if (overlay.x >= 45 && overlay.x <= 55 && overlay.y >= 45 && overlay.y <= 55) {
              const angle = (index / stickers.length) * Math.PI * 2;
              adjustedX = Math.max(15, Math.min(85, 50 + Math.cos(angle) * 30));
              adjustedY = Math.max(15, Math.min(85, 50 + Math.sin(angle) * 30));
            }
            return (
              <StickerOverlayComponent
                key={overlay.id}
                overlay={{ ...overlay, scale: overlay.scale * feedScale, x: adjustedX, y: adjustedY }}
                onUpdate={() => {}}
                onRemove={() => {}}
                isSelected={false}
                onSelect={() => {}}
                containerWidth={bodySize.width}
                containerHeight={bodySize.height}
              />
            );
          })
        : null}
      {tapPosition ? (
        <span
          className="pointer-events-none absolute z-10 text-2xl"
          style={{ left: tapPosition.x, top: tapPosition.y, transform: 'translate(-50%, -50%)' }}
          aria-hidden
        >
          ♥
        </span>
      ) : null}
    </div>
  );

  return (
    <div
      className="w-full bg-transparent"
      role="button"
      tabIndex={0}
      aria-label="Double tap to like"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void Promise.resolve(onDoubleLike()).catch(() => {});
        }
      }}
    >
      <div
        className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden px-7 py-7"
        style={{
          background: card && isTextCardStyleId(cardStyle) ? textCardStyleBackground(cardStyle) : '#121721',
        }}
      >
        {body}
      </div>
    </div>
  );
}
