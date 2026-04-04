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
  ...bubbleProps
}: {
  isFromMe: boolean;
  tailBgClassName: string;
  /** Solid tail fill (recommended for feed / dynamic hex) — JIT Tailwind cannot see `bg-[#…]` built at runtime. */
  tailBackgroundColor?: string;
  bubbleClassName: string;
  children: ReactNode;
  bubbleStyle?: CSSProperties;
  /** `feed`: bubble stays content-width (no flex-1 stretch). `dm`: received row can grow like Messages. */
  layout?: 'dm' | 'feed';
  /** When false, render a flat card (no speech tail) — e.g. feed “news card” text posts. */
  showTail?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const tailStickout = 9;
  const tailVert = 13;
  const tailBottomOffset = 10;

  const outerClass =
    layout === 'feed'
      ? 'relative min-w-0 w-fit max-w-[min(100%,30rem)]'
      : `relative min-w-0 w-fit max-w-[min(100%,30rem)]${isFromMe ? '' : ' flex-1'}`;

  return (
    <div className={outerClass} data-dm-imessage-bubble="">
      {showTail ? (
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
        className={`relative z-10 overflow-visible rounded-[1.2rem] shadow-[0_1px_2px_rgba(0,0,0,0.55)] ring-0 ${bubbleClassName}`}
        style={bubbleStyle}
        {...bubbleProps}
      >
        {children}
      </div>
    </div>
  );
}
