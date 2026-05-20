import { FiPlay } from 'react-icons/fi';

type Props = {
    size?: number;
    className?: string;
};

/** Black & white Stories play icon with pop pulse — used while Stories 24 opens. */
export default function StoriesPopIcon({ size = 72, className = '' }: Props) {
    const playSize = Math.round(size * 0.38);
    return (
        <div
            className={`stories-pop-icon inline-flex items-center justify-center rounded-full ${className}`}
            style={{
                width: size,
                height: size,
                background: 'linear-gradient(135deg, #0a0a0a 0%, #3d3d3d 48%, #f5f5f5 100%)',
                border: '3px solid #ffffff',
            }}
            aria-hidden
        >
            <FiPlay className="text-white ml-0.5 drop-shadow-sm" style={{ width: playSize, height: playSize }} />
        </div>
    );
}
