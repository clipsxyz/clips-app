import Avatar from '../Avatar';
import { profileShareDisplayName } from '../../utils/profileShareStory';

type Props = {
    handle: string;
    avatarUrl?: string;
    onViewProfile: () => void;
};

/** Profile shared into Stories 24: portrait, name, and a way into the profile. */
export default function StoryProfileShareCard({ handle, avatarUrl, onViewProfile }: Props) {
    const name = profileShareDisplayName(handle);
    const handleLabel = handle.replace(/^@/, '');

    return (
        <div
            className="flex h-full w-full flex-col items-center justify-center px-8"
            style={{ background: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)' }}
        >
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.6px] text-white">Gazetteer says</p>
            <div
                className="rounded-full p-[3px]"
                style={{ background: 'linear-gradient(135deg, #22C55E, #FFD400, #FF4D9A)' }}
            >
                <div className="rounded-full bg-[#03091B] p-1">
                    <Avatar src={avatarUrl} name={name} size={120} hideBorder />
                </div>
            </div>
            <h2 className="mt-5 max-w-full truncate text-center text-[26px] font-bold text-white">{name}</h2>
            <p className="mt-1 max-w-full truncate text-center text-[15px] text-[#E2E8F0]">{handleLabel}</p>
            <button
                type="button"
                data-story-interactive
                className="pointer-events-auto mt-8 rounded-full bg-white px-8 py-3.5 text-[15px] font-bold text-[#03091B]"
                onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onViewProfile();
                }}
            >
                View profile
            </button>
        </div>
    );
}
