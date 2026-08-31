import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiLink, FiMail, FiPlay } from 'react-icons/fi';
import { SiWhatsapp, SiFacebook, SiX, SiLinkedin, SiInstagram } from 'react-icons/si';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { showToast } from '../utils/toast';
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

const ShareProfileModal: React.FC<ShareProfileModalProps> = ({ isOpen, onClose, handle, name, avatarUrl }) => {
    const [copied, setCopied] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    if (!isOpen) return null;

    const displayHandle = formatProfileDisplayHandle(handle);
    const profileUrl = buildProfileShareUrl(handle);
    const shareText = getProfileShareMessage(name);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(profileUrl);
            setCopied(true);
            showToast?.('Profile link copied');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
            showToast?.('Could not copy link');
        }
    };

    const handleShare = (platform: string) => {
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
                shareUrl = `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedUrl}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
                break;
            default:
                return;
        }

        window.open(shareUrl, '_blank', 'width=600,height=400');
        onClose();
    };

    const handleShareToStory = async () => {
        if (!user) {
            showToast?.('Sign in to share to Stories');
            return;
        }

        setIsSharing(true);

        try {
            let mediaUrl = avatarUrl;
            let mediaType: 'image' | 'video' = 'image';

            if (!mediaUrl) {
                mediaUrl = await generateProfileImage(name, handle);
            }

            await createStory(
                user.id,
                user.handle || '',
                mediaUrl,
                mediaType,
                `Check out @${handle}'s profile!`,
                undefined,
                undefined,
                undefined,
                handle,
                undefined,
                undefined,
                undefined,
                [handle],
            );

            onClose();
            showToast?.('Profile shared to Stories');
            navigate('/stories', {
                state: {
                    openUserHandle: user.handle,
                },
            });
        } catch (e) {
            console.error('Failed to share profile to stories:', e);
            showToast?.('Failed to share to Stories');
        } finally {
            setIsSharing(false);
        }
    };

    async function generateProfileImage(profileName: string, _profileHandle: string): Promise<string> {
        const width = 1080;
        const height = 1920;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0b0711');
        gradient.addColorStop(0.45, '#201138');
        gradient.addColorStop(1, '#d91b5c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 72px Arial';
        const nameY = height / 2 - 100;
        ctx.fillText(profileName.toUpperCase(), width / 2, nameY);
        ctx.font = '48px Arial';
        ctx.fillText(displayHandle, width / 2, nameY + 100);
        ctx.font = '36px Arial';
        ctx.fillText('View on Gazetteer', width / 2, nameY + 200);

        return canvas.toDataURL('image/png');
    }

    const iconWrap = (children: React.ReactNode, bg: string, extra = '') => (
        <div
            className={`w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10 ${bg} ${extra}`}
        >
            {children}
        </div>
    );

    const shareOptions = [
        {
            id: 'story',
            label: isSharing ? 'Sharing…' : 'Stories',
            icon: iconWrap(
                isSharing ? (
                    <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <FiPlay className="w-5 h-5 text-white" aria-hidden />
                ),
                'bg-gradient-to-br from-[#d91b5c] to-[#201138]',
            ),
            action: handleShareToStory,
            keepOpen: true,
        },
        {
            id: 'whatsapp',
            label: 'WhatsApp',
            icon: iconWrap(<SiWhatsapp className="w-6 h-6 text-white" aria-hidden />, 'bg-[#25D366]'),
            action: () => handleShare('whatsapp'),
        },
        {
            id: 'x',
            label: 'X',
            icon: iconWrap(<SiX className="w-5 h-5 text-white" aria-hidden />, 'bg-black'),
            action: () => handleShare('twitter'),
        },
        {
            id: 'facebook',
            label: 'Facebook',
            icon: iconWrap(<SiFacebook className="w-6 h-6 text-white" aria-hidden />, 'bg-[#1877F2]'),
            action: () => handleShare('facebook'),
        },
        {
            id: 'instagram',
            label: copied ? 'Copied' : 'Instagram',
            icon: iconWrap(
                <SiInstagram className="w-6 h-6 text-white" aria-hidden />,
                'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]',
            ),
            action: async () => {
                await handleCopyLink();
                showToast?.('Link copied — paste in Instagram');
            },
            keepOpen: true,
        },
        {
            id: 'gmail',
            label: 'Email',
            icon: iconWrap(<FiMail className="w-5 h-5 text-white" aria-hidden />, 'bg-[#EA4335]'),
            action: () => handleShare('gmail'),
        },
        {
            id: 'linkedin',
            label: 'LinkedIn',
            icon: iconWrap(<SiLinkedin className="w-5 h-5 text-white" aria-hidden />, 'bg-[#0A66C2]'),
            action: () => handleShare('linkedin'),
        },
        {
            id: 'copy',
            label: copied ? 'Copied!' : 'Copy link',
            icon: iconWrap(<FiLink className="w-5 h-5 text-white" aria-hidden />, 'bg-white/10'),
            action: handleCopyLink,
            keepOpen: true,
        },
    ];

    return (
        <div
            className="fixed inset-0 z-[280] flex items-end justify-center bg-black/65 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="relative w-full max-w-md rounded-t-2xl border border-white/10 border-b-0 bg-[#1a1524] shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="share-profile-title"
            >
                <div className="flex justify-center pt-3 pb-1">
                    <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>

                <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-white/10">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#d91b5c]/90">
                            Gazetteer
                        </p>
                        <h2 id="share-profile-title" className="text-lg font-semibold text-white">
                            Share profile
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-4 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                        <Avatar src={avatarUrl} name={name} size="lg" className="ring-2 ring-[#d91b5c]/30" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-semibold text-white">{name}</p>
                            <p className="truncate text-sm text-gray-400">{displayHandle}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopyLink}
                        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] py-2.5 text-sm font-medium text-gray-200 hover:bg-white/10 transition-colors"
                    >
                        <FiLink className="w-4 h-4 shrink-0" />
                        <span className="truncate">{copied ? 'Link copied' : profileUrl.replace(/^https?:\/\//, '')}</span>
                    </button>
                </div>

                <div className="flex-shrink-0 bg-[#1a1524] pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <p className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Share to
                    </p>
                    <div className="overflow-x-auto overflow-y-hidden scrollbar-hide px-2 pb-4">
                        <div className="flex items-start gap-5 min-w-max px-2">
                            {shareOptions.map(({ id, label, icon, action, keepOpen }) => (
                                <button
                                    key={id}
                                    type="button"
                                    disabled={id === 'story' && isSharing}
                                    onClick={() => {
                                        void action();
                                        if (!keepOpen) onClose();
                                    }}
                                    className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[56px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d91b5c]/60 rounded-lg disabled:opacity-50"
                                >
                                    {icon}
                                    <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap max-w-[72px] text-center truncate">
                                        {label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareProfileModal;
