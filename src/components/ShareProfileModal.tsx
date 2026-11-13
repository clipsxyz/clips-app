import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiLink, FiMail, FiPlay, FiShare2 } from 'react-icons/fi';
import { SiWhatsapp, SiFacebook, SiX, SiLinkedin, SiInstagram } from 'react-icons/si';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';
import {
    buildProfileShareUrl,
    formatProfileDisplayHandle,
    getProfileShareMessage,
} from '../utils/profileShareUrl';

interface ShareProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    handle: string;
    name: string;
    avatarUrl?: string;
}

const SHEET_GRADIENT = 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)';

function IconCircle({
    children,
    background,
}: {
    children: React.ReactNode;
    background: string;
}) {
    return (
        <div
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.12]"
            style={{ background }}
        >
            {children}
        </div>
    );
}

const ShareProfileModal: React.FC<ShareProfileModalProps> = ({ isOpen, onClose, handle, name, avatarUrl }) => {
    const [copied, setCopied] = useState(false);
    const [statusHint, setStatusHint] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    const displayHandle = formatProfileDisplayHandle(handle);
    const profileUrl = buildProfileShareUrl(handle);
    const shareText = getProfileShareMessage(name);
    const resolvedAvatar = avatarUrl || getAvatarForHandle(handle);
    const urlPreview = profileUrl.replace(/^https?:\/\//, '');

    useEffect(() => {
        if (!isOpen) {
            setCopied(false);
            setStatusHint(null);
            setIsSharing(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const showHint = (message: string) => {
        setStatusHint(message);
        window.setTimeout(() => setStatusHint(null), 2200);
    };

    const copyLink = async (hint?: string) => {
        try {
            await navigator.clipboard.writeText(profileUrl);
            setCopied(true);
            showHint(hint || 'Profile link copied');
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            showHint('Could not copy link');
        }
    };

    const shareSystem = async () => {
        const payload = { title: shareText, text: `${shareText}\n${profileUrl}`, url: profileUrl };
        try {
            if (navigator.share) {
                await navigator.share(payload);
            } else {
                await copyLink('Profile link copied');
            }
        } catch {
            /* user cancelled */
        } finally {
            onClose();
        }
    };

    const shareExternal = (platform: string) => {
        const encodedUrl = encodeURIComponent(profileUrl);
        const encodedText = encodeURIComponent(shareText);
        let shareUrl = '';
        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
                break;
            case 'gmail':
                shareUrl = `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${profileUrl}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
                break;
            default:
                return;
        }
        if (platform === 'gmail') {
            window.location.href = shareUrl;
        } else {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
        }
        onClose();
    };

    const shareToStory = async () => {
        if (!user?.id) {
            showHint('Sign in to share to Stories');
            return;
        }
        setIsSharing(true);
        try {
            const bareHandle = String(handle || '').replace(/^@/, '').trim();
            const mediaUrl = resolvedAvatar;
            await createStory(
                user.id,
                user.handle || '',
                mediaUrl || undefined,
                mediaUrl ? 'image' : undefined,
                `Check out @${bareHandle}'s profile!`,
                undefined,
                undefined,
                undefined,
                bareHandle,
                undefined,
                mediaUrl
                    ? undefined
                    : {
                          color: '#FFFFFF',
                          size: 'large',
                          background: 'linear-gradient(135deg,#0b0711,#201138,#d91b5c)',
                      },
                undefined,
                [bareHandle],
            );
            onClose();
            navigate('/stories', { state: { openUserHandle: user.handle } });
        } catch (error) {
            console.error('Share profile to story failed:', error);
            showHint('Failed to share to Stories');
        } finally {
            setIsSharing(false);
        }
    };

    const shareOptions = [
        {
            id: 'story',
            label: isSharing ? 'Sharing…' : 'Stories',
            keepOpen: true,
            icon: (
                <IconCircle background="rgba(255,255,255,0.12)">
                    {isSharing ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                        <FiPlay className="h-[22px] w-[22px] text-white" />
                    )}
                </IconCircle>
            ),
            action: shareToStory,
        },
        {
            id: 'whatsapp',
            label: 'WhatsApp',
            icon: (
                <IconCircle background="#25D366">
                    <SiWhatsapp className="h-[26px] w-[26px] text-white" />
                </IconCircle>
            ),
            action: () => shareExternal('whatsapp'),
        },
        {
            id: 'x',
            label: 'X',
            icon: (
                <IconCircle background="#000000">
                    <SiX className="h-[22px] w-[22px] text-white" />
                </IconCircle>
            ),
            action: () => shareExternal('twitter'),
        },
        {
            id: 'facebook',
            label: 'Facebook',
            icon: (
                <IconCircle background="#1877F2">
                    <SiFacebook className="h-[26px] w-[26px] text-white" />
                </IconCircle>
            ),
            action: () => shareExternal('facebook'),
        },
        {
            id: 'instagram',
            label: copied ? 'Copied' : 'Instagram',
            keepOpen: true,
            icon: (
                <IconCircle background="linear-gradient(135deg, #833AB4 0%, #E1306C 50%, #F77737 100%)">
                    <SiInstagram className="h-6 w-6 text-white" />
                </IconCircle>
            ),
            action: () => copyLink('Link copied — paste in Instagram'),
        },
        {
            id: 'email',
            label: 'Email',
            icon: (
                <IconCircle background="#EA4335">
                    <FiMail className="h-[22px] w-[22px] text-white" />
                </IconCircle>
            ),
            action: () => shareExternal('gmail'),
        },
        {
            id: 'linkedin',
            label: 'LinkedIn',
            icon: (
                <IconCircle background="#0A66C2">
                    <SiLinkedin className="h-[22px] w-[22px] text-white" />
                </IconCircle>
            ),
            action: () => shareExternal('linkedin'),
        },
        {
            id: 'more',
            label: 'More',
            icon: (
                <IconCircle background="rgba(255,255,255,0.12)">
                    <FiShare2 className="h-[22px] w-[22px] text-white" />
                </IconCircle>
            ),
            action: shareSystem,
        },
        {
            id: 'copy',
            label: copied ? 'Copied!' : 'Copy link',
            keepOpen: true,
            icon: (
                <IconCircle background="rgba(255,255,255,0.12)">
                    <FiLink className="h-[22px] w-[22px] text-white" />
                </IconCircle>
            ),
            action: () => copyLink(),
        },
    ];

    return (
        <div
            className="fixed inset-0 z-[280] flex items-end justify-center bg-black/65"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[20px] border border-b-0 border-white/10"
                style={{ background: SHEET_GRADIENT }}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-labelledby="share-profile-title"
            >
                <div className="flex justify-center pb-1 pt-3">
                    <div className="h-1 w-10 rounded-full bg-white/[0.28]" />
                </div>
                <div className="flex items-start justify-between border-b border-white/10 px-4 pb-3">
                    <div className="min-w-0 flex-1 pr-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-white">Gazetteer</p>
                        <h2 id="share-profile-title" className="mt-0.5 text-lg font-semibold text-white">
                            Share profile
                        </h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-white" aria-label="Close">
                        <FiX className="h-[22px] w-[22px]" />
                    </button>
                </div>

                <div className="border-b border-white/10 px-4 pb-3 pt-3.5">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="rounded-full border-2 border-white/[0.28] p-0.5">
                            <Avatar src={resolvedAvatar} name={name} size="lg" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-bold text-white">{name}</p>
                            <p className="mt-0.5 truncate text-[13px] text-[#E2E8F0]">{displayHandle}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void copyLink()}
                        className="mt-2.5 flex w-full items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-3 text-left"
                    >
                        <FiLink className="h-[18px] w-[18px] shrink-0 text-[#D1D5DB]" />
                        <span className="truncate text-[13px] font-medium text-[#E5E7EB]">
                            {copied ? 'Link copied' : urlPreview}
                        </span>
                    </button>
                    {statusHint ? (
                        <p className="mt-2 text-center text-xs font-semibold text-white">{statusHint}</p>
                    ) : null}
                </div>

                <p className="mb-2.5 mt-3 px-4 text-[10px] font-bold uppercase tracking-[0.6px] text-[#94A3B8]">
                    Share to
                </p>
                <div className="overflow-x-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="flex min-w-max items-start gap-4 px-3 pb-2">
                        {shareOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                disabled={option.id === 'story' && isSharing}
                                onClick={() => {
                                    void option.action();
                                    if (!option.keepOpen && option.id !== 'more') onClose();
                                }}
                                className="flex w-16 flex-col items-center disabled:opacity-60"
                            >
                                {option.icon}
                                <span className="mt-2 max-w-[72px] truncate text-center text-[10px] text-[#E2E8F0]">
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareProfileModal;
