import { FiLink, FiShield, FiUsers } from 'react-icons/fi';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas';
import { COMMUNITY_GROUP_ONBOARDING } from '../constants/communityGroupOnboarding';

const FEATURE_ICONS = [FiLink, FiUsers, FiShield];

function IncomingBubble({
    name,
    initials,
    avatarColor,
    text,
    reaction,
    reactionCount,
}: {
    name: string;
    initials: string;
    avatarColor: string;
    text: string;
    reaction?: string;
    reactionCount?: number;
}) {
    return (
        <div className="mb-2 flex max-w-[86%] items-start gap-2">
            <div
                className="mt-3 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: avatarColor }}
            >
                {initials}
            </div>
            <div className="min-w-0">
                <div className="mb-0.5 ml-1 text-[11px] font-semibold text-white/55">{name}</div>
                <div className="rounded-2xl rounded-bl-md bg-[rgba(42,48,58,0.92)] px-3 py-2 text-[13px] font-medium leading-[18px] text-gray-100">
                    {text}
                </div>
                {reaction ? (
                    <div className="-mt-2 ml-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-white/80">
                        <span className="text-[11px]">{reaction}</span>
                        {reactionCount ? <span>{reactionCount}</span> : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function CommunityGroupOnboardingSheet({
    isOpen,
    onCreateGroup,
    onClose,
}: {
    isOpen: boolean;
    onCreateGroup: () => void;
    onClose: () => void;
}) {
    if (!isOpen) return null;
    const copy = COMMUNITY_GROUP_ONBOARDING;

    return (
        <div className="fixed inset-0 z-[300] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative mb-safe w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-[#060d16] shadow-2xl mx-3 sm:mx-4">
                <DiscoverAmbientCanvas fixed={false} variant="passport" />
                <div className="relative z-[2] max-h-[92vh] overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close community group introduction"
                        className="absolute right-3 top-2 z-[3] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white transition-colors hover:bg-white/20"
                    >
                        ×
                    </button>
                    <div className="mb-3 flex justify-center">
                        <div className="h-1 w-10 rounded-full bg-white/30" />
                    </div>

                    <div className="relative mb-4 min-h-[188px] pt-1 pr-1">
                        <span className="absolute left-0 top-7 z-[2] text-[20px]">🏃</span>
                        <div className="max-w-[88%]">
                            <IncomingBubble
                                name={copy.bubbles[0].name}
                                initials={copy.bubbles[0].initials}
                                avatarColor={copy.bubbles[0].avatarColor}
                                text={copy.bubbles[0].text}
                                reaction={copy.bubbles[0].reaction}
                                reactionCount={copy.bubbles[0].reactionCount}
                            />
                            <div className="-mt-2.5">
                                <IncomingBubble
                                    name={copy.bubbles[2].name}
                                    initials={copy.bubbles[2].initials}
                                    avatarColor={copy.bubbles[2].avatarColor}
                                    text={copy.bubbles[2].text}
                                    reaction={copy.bubbles[2].reaction}
                                    reactionCount={copy.bubbles[2].reactionCount}
                                />
                            </div>
                            <div className="-mt-2.5">
                                <IncomingBubble
                                    name={copy.bubbles[3].name}
                                    initials={copy.bubbles[3].initials}
                                    avatarColor={copy.bubbles[3].avatarColor}
                                    text={copy.bubbles[3].text}
                                    reaction={copy.bubbles[3].reaction}
                                    reactionCount={copy.bubbles[3].reactionCount}
                                />
                            </div>
                        </div>
                        <div className="absolute right-0 top-[52px] z-[3] flex justify-end">
                            <div className="max-w-[70%] rounded-2xl rounded-br-md bg-[#3d9b8f] px-3 py-2 text-[13px] font-semibold leading-[18px] text-white">
                                {copy.bubbles[1].text}
                            </div>
                        </div>
                        <span className="absolute right-1 top-[78px] z-[2] text-[20px]">📚</span>
                    </div>

                    <div className="mb-2 flex items-center justify-center gap-1.5">
                        <span className="text-[13px]">✨</span>
                        <span className="text-[13px] font-bold text-[#3d9b8f]">{copy.badge}</span>
                    </div>
                    <h3 className="mb-1.5 text-center text-[22px] font-extrabold text-white">{copy.title}</h3>
                    <p className="mb-5 px-2 text-center text-sm leading-5 text-white/75">{copy.subtitle}</p>

                    <div className="mb-5 space-y-4">
                        {copy.features.map((feature, i) => {
                            const Icon = FEATURE_ICONS[i];
                            return (
                                <div key={feature.title} className="flex items-start gap-3.5">
                                    <Icon className="mt-0.5 h-[22px] w-[22px] shrink-0 text-white" />
                                    <div className="min-w-0">
                                        <div className="mb-0.5 text-sm font-bold text-white">{feature.title}</div>
                                        <div className="text-xs leading-[17px] text-white/60">{feature.body}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={onCreateGroup}
                        className="w-full rounded-full bg-[#3d9b8f] py-3.5 text-[15px] font-bold text-white"
                    >
                        {copy.cta}
                    </button>
                </div>
            </div>
        </div>
    );
}
