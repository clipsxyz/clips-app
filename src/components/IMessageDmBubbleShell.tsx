import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

/**
 * iMessage-style DM bubble: bottom tail toward avatar, matches main feed TextCard geometry.
 * Solid fill only (Tailwind bg on tail + bubble).
 */
export function IMessageDmBubbleShell({
  isFromMe,
  tailBgClassName,
  tailBackgroundColor,
  bubbleClassName,
  children,
  bubbleStyle,
  layout = 'dm',
  showTail = true,
  gradientColors,
  ...bubbleProps
}: {
  isFromMe: boolean;
  tailBgClassName: string;
  /** Solid tail fill (recommended for feed / dynamic hex) — JIT Tailwind cannot see `bg-[#…]` built at runtime. */
  tailBackgroundColor?: string;
  bubbleClassName: string;
  children: ReactNode;
  bubbleStyle?: CSSProperties;
  /** `feed`: news-card tail. `dm`: Instagram thread bubble, content width, no tail. */
  layout?: 'dm' | 'feed';
  /** When false, render a flat card (no speech tail). DM layout never draws a tail. */
  showTail?: boolean;
  /** Sent-message wash. Ignored on the feed layout. */
  gradientColors?: readonly string[];
} & HTMLAttributes<HTMLDivElement>) {
  const tailStickout = 9;
  const tailVert = 13;
  const tailBottomOffset = 10;
  const isDm = layout !== 'feed';
  const drawTail = !isDm && showTail;
  const dmCorners: CSSProperties = isFromMe
    ? {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 4,
      }
    : {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
        borderBottomLeftRadius: 4,
      };

  const outerClass = isDm
    ? `relative min-w-0 w-fit max-w-full ${isFromMe ? 'self-end' : 'self-start'}`
    : 'relative min-w-0 w-fit max-w-[min(100%,30rem)]';

  return (
    <div className={outerClass} data-dm-imessage-bubble="">
      {drawTail ? (
        <div
          aria-hidden
          className={`absolute z-[5] pointer-events-none ${tailBackgroundColor ? '' : tailBgClassName}`}
          style={{
            ...(isFromMe
              ? {
                  right: 0,
                  left: 'auto',
                  bottom: tailBottomOffset,
                  transform: 'translateX(100%)',
                  clipPath: 'polygon(0% 0%, 0% 100%, 100% 50%)',
                }
              : {
                  left: 0,
                  bottom: tailBottomOffset,
                  transform: 'translateX(-100%)',
                  clipPath: 'polygon(100% 0%, 100% 100%, 0% 100%)',
                }),
            width: tailStickout,
            height: tailVert,
            ...(tailBackgroundColor ? { backgroundColor: tailBackgroundColor } : {}),
          }}
        />
      ) : null}
      <div
        className={`relative z-10 ${
          isDm
            ? 'overflow-hidden shadow-none'
            : 'overflow-visible rounded-[1.2rem] shadow-[0_1px_2px_rgba(0,0,0,0.55)] ring-0'
        } ${bubbleClassName}`}
        style={{
          ...(isDm ? dmCorners : {}),
          ...(isDm && gradientColors && gradientColors.length >= 2
            ? { background: `linear-gradient(135deg, ${gradientColors.join(', ')})` }
            : {}),
          ...bubbleStyle,
        }}
        {...bubbleProps}
      >
        {children}
      </div>
    </div>
  );
}
