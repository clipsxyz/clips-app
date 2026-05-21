import { FiPlay } from 'react-icons/fi';

type Props = {
    size?: number;
    className?: string;
};

/** Dual-ring play control for Stories 24 entry (feed header). */
export default function Stories24HeaderIcon({ size = 40, className = '' }: Props) {
    const inner = Math.round(size * 0.72);
    const playSize = Math.round(size * 0.28);
    return (
        <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white ${className}`}
            style={{ width: size, height: size }}
            aria-hidden
        >
            <span
                className="inline-flex items-center justify-center rounded-full border-2 border-white/85"
                style={{
                    width: inner,
                    height: inner,
                    background: 'linear-gradient(135deg, #0a0a0a 0%, #3d3d3d 48%, #f5f5f5 100%)',
                }}
            >
                <FiPlay className="ml-0.5 text-white" style={{ width: playSize, height: playSize }} />
            </span>
        </span>
    );
}
