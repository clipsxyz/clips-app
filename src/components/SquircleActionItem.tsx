import React from 'react';

export function formatRailCount(n: number | undefined): string {
    const v = Math.max(0, Number(n) || 0);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
    return String(v);
}

type SquircleActionItemProps = {
    label: string;
    accessibilityLabel: string;
    onPress: () => void;
    children: React.ReactNode;
    /** Warm pastel fill for the primary like badge. */
    highlight?: boolean;
    disabled?: boolean;
    buttonRef?: React.Ref<HTMLButtonElement>;
};

/** Full-screen video action badge. Scales to 0.86 while pressed. */
export default function SquircleActionItem({
    label,
    accessibilityLabel,
    onPress,
    children,
    highlight = false,
    disabled = false,
    buttonRef,
}: SquircleActionItemProps) {
    return (
        <div className="flex flex-col items-center">
            <button
                ref={buttonRef}
                type="button"
                aria-label={accessibilityLabel}
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onPress();
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-[13px] shadow-[0_3px_6px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.86] disabled:cursor-not-allowed disabled:opacity-40 ${
                    highlight ? 'bg-[#FFF5B8]' : 'bg-white'
                }`}
            >
                {children}
            </button>
            <span
                className="mt-[5px] text-center text-[12px] font-bold leading-none text-white"
                style={{ textShadow: '0 1px 4px rgba(0, 0, 0, 0.85)' }}
            >
                {label}
            </span>
        </div>
    );
}
