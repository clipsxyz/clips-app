import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { IoClose, IoLinkOutline, IoPeopleOutline, IoShieldCheckmarkOutline } from 'react-icons/io5';
import { COMMUNITY_GROUP_ONBOARDING } from '../constants/communityGroupOnboarding';

type Props = {
    visible: boolean;
    onCreateGroup: () => void;
    onDismiss: () => void;
};

const FEATURE_ICONS = {
    'link-outline': IoLinkOutline,
    'people-outline': IoPeopleOutline,
    'shield-checkmark-outline': IoShieldCheckmarkOutline,
} as const;

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
        <div className="mb-1 flex max-w-full items-start gap-2">
            <div
                className="mt-3.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: avatarColor }}
            >
                {initials}
            </div>
            <div className="min-w-0 shrink">
                <p className="mb-[3px] ml-1 text-[11px] font-semibold text-white/55">{name}</p>
                <div className="rounded-2xl rounded-bl-md border border-white/[0.12] bg-white/[0.08] px-3 py-2">
                    <p className="text-[13px] font-medium leading-[18px] text-[#F3F4F6]">{text}</p>
                </div>
                {reaction ? (
                    <div className="-mt-2 ml-2.5 inline-flex items-center gap-1 rounded-xl border border-white/15 bg-[rgba(17,24,39,0.92)] px-[7px] py-[3px]">
                        <span className="text-[11px]">{reaction}</span>
                        {reactionCount ? <span className="text-[10px] font-bold text-white/80">{reactionCount}</span> : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

/** Web twin of CommunityGroupOnboardingSheet.native. */
export default function CommunityGroupOnboardingSheet({ visible, onCreateGroup, onDismiss }: Props) {
    if (!visible) return null;

    const copy = COMMUNITY_GROUP_ONBOARDING;

    return createPortal(
        <div className="fixed inset-0 z-[320] flex items-end justify-center" role="presentation">
            <button type="button" aria-label="Dismiss" className="absolute inset-0 bg-black/72" onClick={onDismiss} />
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={copy.title}
                initial={{ y: 28 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="relative flex h-[85vh] w-[min(400px,calc(100%-24px))] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-white/[0.12]"
                style={{
                    backgroundColor: '#03091B',
                    backgroundImage: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)',
                }}
            >
                <button
                    type="button"
                    aria-label="Close community group introduction"
                    className="absolute right-3 top-2.5 z-[5] flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-white/[0.12] bg-white/10 text-white"
                    onClick={onDismiss}
                >
                    <IoClose size={22} />
                </button>
                <div className="flex justify-center px-5 pb-2 pt-1">
                    <div className="h-1 w-10 rounded-full bg-white" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-24">
                    <div className="relative mb-3.5 min-h-[188px] pb-2 pr-1 pt-1">
                        <span className="absolute left-0 top-7 z-[2] text-xl">🏃</span>
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
                            <div className="max-w-[70%] rounded-2xl rounded-br-md border border-white/20 bg-white/[0.12] px-3 py-2">
                                <p className="text-[13px] font-semibold leading-[18px] text-white">{copy.bubbles[1].text}</p>
                            </div>
                        </div>
                        <span className="absolute right-0.5 top-[78px] z-[2] text-xl">📚</span>
                    </div>

                    <div className="mb-3 flex items-center justify-center">
                        <div className="inline-flex items-center gap-1.5 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 py-1.5">
                            <span className="text-[13px]">✨</span>
                            <span className="text-[13px] font-bold text-white">{copy.badge}</span>
                        </div>
                    </div>
                    <h2 className="mb-1.5 text-center text-[22px] font-semibold text-white">{copy.title}</h2>
                    <p className="mb-5 px-2 text-center text-sm leading-5 text-[#E2E8F0]">{copy.subtitle}</p>

                    <div className="mb-2 flex flex-col gap-2.5">
                        {copy.features.map((feature) => {
                            const FeatureIcon = FEATURE_ICONS[feature.icon];
                            return (
                                <div
                                    key={feature.title}
                                    className="flex items-center gap-3 rounded-xl border border-white/[0.12] bg-white/[0.06] p-3"
                                >
                                    <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/[0.12] text-white">
                                        <FeatureIcon size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="mb-0.5 text-sm font-semibold text-white">{feature.title}</p>
                                        <p className="text-xs leading-[17px] text-[#E2E8F0]">{feature.body}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] px-5 pt-3"
                    style={{
                        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                        backgroundImage: 'linear-gradient(to bottom, rgba(3, 9, 27, 0), #03091B)',
                    }}
                >
                    <button
                        type="button"
                        className="pointer-events-auto w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#03091B]"
                        onClick={onCreateGroup}
                    >
                        {copy.cta}
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
