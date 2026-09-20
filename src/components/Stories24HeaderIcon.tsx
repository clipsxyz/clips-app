import { FiPlay } from 'react-icons/fi';
import {
    STORIES_24_AVATAR_RING_COLORS,
    STORIES_24_AVATAR_RING_SEEN,
} from '../constants/stories24Ring';

type Props = {
    size?: number;
    className?: string;
    hasUnviewedStory?: boolean;
};

/** Stories 24 header pill — same ring style/logic as feed profile pics. */
export default function Stories24HeaderIcon({
    size = 40,
    className = '',
    hasUnviewedStory = false,
}: Props) {
    const playSize = Math.round(size * 0.38);
    return (
        <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full p-[2px] ${
                hasUnviewedStory ? 'stories24-ring-pulse' : ''
            } ${className}`}
            style={{
                width: size,
                height: size,
                background: hasUnviewedStory
                    ? `linear-gradient(to top right, ${STORIES_24_AVATAR_RING_COLORS.join(', ')})`
                    : STORIES_24_AVATAR_RING_SEEN,
            }}
            aria-hidden
        >
            <span
                className="inline-flex h-full w-full items-center justify-center rounded-full border-2 border-white/85"
                style={{
                    background: 'linear-gradient(135deg, #0a0a0a 0%, #3d3d3d 48%, #f5f5f5 100%)',
                }}
            >
                <FiPlay className="ml-0.5 text-white" style={{ width: playSize, height: playSize }} />
            </span>
        </span>
    );
}
