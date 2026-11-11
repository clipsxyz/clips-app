import React from 'react';
import { Post } from '../types';
import {
    FiBookmark,
    FiCopy,
    FiShare2,
    FiFlag,
    FiUserMinus,
    FiVolumeX,
    FiUserX,
    FiEyeOff,
    FiMaximize,
    FiTrash2,
    FiEdit3,
    FiArchive,
    FiBell,
    FiBellOff,
    FiInfo,
    FiZap,
    FiRepeat,
    FiUsers,
    FiUserPlus,
    FiChevronRight,
} from 'react-icons/fi';
import SavePostModal from './SavePostModal';
import QRCodeModal from './QRCodeModal';
import { showToast } from '../utils/toast';

interface PostMenuModalProps {
    post: Post;
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onCopyLink?: () => void;
    onShare?: () => void;
    onReport?: () => void;
    onUnfollow?: () => Promise<void>;
    onMute?: () => Promise<void>;
    onBlock?: () => Promise<void>;
    onHide?: () => void;
    onNotInterested?: () => void;
    onDelete?: () => Promise<void>;
    onEdit?: () => void;
    onArchive?: () => Promise<void>;
    onBoost?: () => void;
    onReclip?: () => Promise<void>;
    onTurnOnNotifications?: () => void;
    onTurnOffNotifications?: () => void;
    /** When set, Save opens this (e.g. parent SavePostModal). Required so Save works after menu closes — internal state was lost on unmount. */
    onOpenSave?: () => void;
    /** Opens community group creation (Gazetteer chat groups). */
    onCreateGroup?: () => void;
    /** Open group picker to invite the post author into one of your group chats (other users’ posts only). */
    onInviteToGroup?: () => void;
    isCurrentUser?: boolean;
    isFollowing?: boolean;
    isSaved?: boolean;
    isMuted?: boolean;
    isBlocked?: boolean;
    hasNotifications?: boolean;
}

export default function PostMenuModal({
    post,
    userId,
    isOpen,
    onClose,
    onCopyLink,
    onShare,
    onReport,
    onUnfollow,
    onMute,
    onBlock,
    onHide,
    onNotInterested,
    onDelete,
    onEdit,
    onArchive,
    onBoost,
    onReclip,
    onTurnOnNotifications,
    onTurnOffNotifications,
    onOpenSave,
    onCreateGroup,
    onInviteToGroup,
    isCurrentUser = false,
    isFollowing = false,
    isSaved = false,
    isMuted: _isMuted = false,
    isBlocked: _isBlocked = false, // Reserved for future use
    hasNotifications = false,
}: PostMenuModalProps) {
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const [showQRCodeModal, setShowQRCodeModal] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        if (onOpenSave) {
            onOpenSave();
            onClose();
        } else {
            setShowSaveModal(true);
        }
    };

    const handleCopyLink = async () => {
        const url = `${window.location.origin}/post/${post.id}`;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const ta = document.createElement('textarea');
                ta.value = url;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            onClose();
            onCopyLink?.();
            showToast('Link copied');
        } catch (error) {
            console.error('Failed to copy link:', error);
            showToast('Could not copy link');
        }
    };

    const handleAction = async (action: () => void | Promise<void>) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await action();
            onClose();
        } catch (error) {
            console.error('Error performing action:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    type MenuItem = {
        icon: React.ComponentType<{ className?: string }>;
        label: string;
        action?: () => void | Promise<void>;
        danger?: boolean;
        disabled?: boolean;
        keepOpen?: boolean;
    };

    const firstName = post.userHandle.split('@')[0];
    const isReclip = !!post.originalUserHandle;
    const rows: MenuItem[] = isCurrentUser
        ? [
            ...(onCreateGroup ? [{ icon: FiUsers, label: 'Create group', action: onCreateGroup }] : []),
            { icon: FiCopy, label: 'Copy link', action: handleCopyLink },
            { icon: FiBookmark, label: isSaved ? 'Unsave' : 'Save', action: handleSave },
            { icon: FiShare2, label: 'Share', action: () => onShare && handleAction(onShare) },
            ...(!isReclip && onEdit ? [{ icon: FiEdit3, label: 'Edit', action: onEdit }] : []),
            ...(!isReclip && onBoost ? [{ icon: FiZap, label: 'Boost', action: onBoost }] : []),
            ...(!isReclip && onArchive ? [{ icon: FiArchive, label: 'Archive', action: onArchive }] : []),
            ...(!isReclip && (onTurnOnNotifications || onTurnOffNotifications)
                ? [{
                    icon: hasNotifications ? FiBellOff : FiBell,
                    label: hasNotifications ? 'Turn off post notifications' : 'Turn on post notifications',
                    action: hasNotifications ? onTurnOffNotifications : onTurnOnNotifications,
                }]
                : []),
            ...(!isReclip && onDelete ? [{ icon: FiTrash2, label: 'Delete post', action: onDelete, danger: true }] : []),
        ]
        : [
            { icon: FiCopy, label: 'Copy link', action: handleCopyLink },
            { icon: FiBookmark, label: isSaved ? 'Unsave' : 'Save', action: handleSave },
            { icon: FiShare2, label: 'Share', action: () => onShare && handleAction(onShare) },
            ...(onInviteToGroup ? [{ icon: FiUserPlus, label: 'Invite to a group', action: onInviteToGroup }] : []),
            { icon: FiMaximize, label: 'QR code', action: () => setShowQRCodeModal(true), keepOpen: true },
            ...(onReclip
                ? [{
                    icon: FiRepeat,
                    label: 'Reclip',
                    action: onReclip,
                    disabled: !!post.userReclipped,
                }]
                : []),
            ...(isFollowing ? [{ icon: FiUserMinus, label: `Unfollow ${firstName}`, action: onUnfollow }] : []),
            ...(onMute ? [{ icon: FiVolumeX, label: `Mute ${firstName}`, action: onMute }] : []),
            ...(onHide ? [{ icon: FiEyeOff, label: 'Hide', action: onHide }] : []),
            ...(onNotInterested ? [{ icon: FiInfo, label: 'Not interested', action: onNotInterested }] : []),
            ...(onReport ? [{ icon: FiFlag, label: 'Report', action: onReport }] : []),
            ...(onBlock ? [{ icon: FiUserX, label: 'Block user', action: onBlock, danger: true }] : []),
        ];

    const runRow = (item: MenuItem) => {
        if (!item.action || item.disabled) return;
        if (item.label === 'Save' || item.label === 'Unsave') {
            handleSave();
            return;
        }
        if (item.label === 'Create group') {
            onCreateGroup?.();
            onClose();
            return;
        }
        if (item.label === 'Invite to a group') {
            onInviteToGroup?.();
            onClose();
            return;
        }
        if (item.keepOpen) {
            item.action();
            return;
        }
        handleAction(item.action);
    };

    return (
        <>
            <div className="fixed inset-0 z-[280] flex items-end justify-center">
                <button
                    type="button"
                    aria-label="Dismiss"
                    className="absolute inset-0 bg-[rgba(3,9,27,0.72)]"
                    onClick={onClose}
                />
                <div
                    className="relative flex max-h-[72%] w-full max-w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-t-[20px] border border-b-0 border-white/15 pb-7"
                    style={{ background: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)' }}
                    role="dialog"
                    aria-label="Post options"
                >
                    <div className="mx-auto mt-2.5 mb-2 h-1 w-10 rounded-full bg-white/35" aria-hidden />
                    <h3 className="px-5 pb-2 text-base font-semibold text-white">Post options</h3>
                    <div className="overflow-y-auto px-2">
                        {rows.map((item) => {
                            const Icon = item.icon;
                            const color = item.danger ? '#F43F5E' : '#FFFFFF';
                            return (
                                <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => runRow(item)}
                                    disabled={isProcessing || item.disabled}
                                    className="flex w-full items-center gap-3 border-b border-white/10 px-3 py-3.5 text-left disabled:opacity-35"
                                >
                                    <Icon className="h-[22px] w-[22px] shrink-0" style={{ color }} />
                                    <span className="min-w-0 flex-1 text-base font-medium" style={{ color }}>{item.label}</span>
                                    <FiChevronRight className="h-[18px] w-[18px] shrink-0 text-white/55" />
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-3 w-full py-3.5 text-center text-base font-semibold text-white"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* Save Post Modal — only when parent does not supply onOpenSave */}
            {!onOpenSave && showSaveModal && (
                <SavePostModal
                    post={post}
                    userId={userId}
                    isOpen={showSaveModal}
                    onClose={() => {
                        setShowSaveModal(false);
                        onClose();
                    }}
                    onSaved={() => {
                        setShowSaveModal(false);
                        onClose();
                    }}
                />
            )}

            {/* QR Code Modal */}
            {showQRCodeModal && (
                <QRCodeModal
                    post={post}
                    isOpen={showQRCodeModal}
                    onClose={() => {
                        setShowQRCodeModal(false);
                        onClose();
                    }}
                />
            )}
        </>
    );
}

