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
    FiStar,
    FiRefreshCw,
    FiMaximize,
    FiTrash2,
    FiEdit3,
    FiArchive,
    FiBell,
    FiBellOff,
    FiInfo,
    FiZap,
    FiRepeat
} from 'react-icons/fi';
import SavePostModal from './SavePostModal';
import QRCodeModal from './QRCodeModal';

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
    isCurrentUser = false,
    isFollowing = false,
    isSaved = false,
    isMuted = false,
    isBlocked: _isBlocked = false, // Reserved for future use
    hasNotifications = false,
}: PostMenuModalProps) {
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const [showQRCodeModal, setShowQRCodeModal] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        setShowSaveModal(true);
    };

    const handleCopyLink = async () => {
        try {
            const url = `${window.location.origin}/post/${post.id}`;
            await navigator.clipboard.writeText(url);
            // Show toast or feedback
            onClose();
            onCopyLink?.();
        } catch (error) {
            console.error('Failed to copy link:', error);
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

    // Menu items based on whether it's current user's post or not
    type MenuItem = {
        icon: React.ComponentType<{ className?: string }>;
        label: string;
        action?: () => void | Promise<void>;
        danger?: boolean;
        highlight?: boolean;
    };

    const menuItems: MenuItem[] = isCurrentUser
        ? [
            // Own posts – only show Delete when handler is provided (user can delete own posts)
            ...(onDelete ? [{ icon: FiTrash2, label: 'Delete', action: onDelete, danger: true }] : []),
            { icon: FiEdit3, label: 'Edit', action: onEdit },
            { icon: FiCopy, label: 'Copy Link', action: handleCopyLink },
            { icon: FiArchive, label: 'Archive', action: onArchive },
            { icon: hasNotifications ? FiBellOff : FiBell, label: hasNotifications ? 'Turn off post notifications' : 'Turn on post notifications', action: hasNotifications ? onTurnOffNotifications : onTurnOnNotifications },
        ]
        : [
            // Other users' posts (removed Save, Share, QR code - already in top row)
            { icon: FiRepeat, label: 'Reclip', action: onReclip },
            { icon: FiCopy, label: 'Copy Link', action: handleCopyLink },
            { icon: FiFlag, label: 'Report post', action: onReport, danger: true },
            ...(isFollowing ? [{ icon: FiUserMinus, label: `Unfollow ${post.userHandle.split('@')[0]}`, action: onUnfollow }] : []),
            { icon: FiVolumeX, label: isMuted ? `Unmute ${post.userHandle.split('@')[0]}` : `Mute ${post.userHandle.split('@')[0]}`, action: onMute },
            { icon: FiUserX, label: `Block ${post.userHandle.split('@')[0]}`, action: onBlock, danger: true },
            { icon: FiEyeOff, label: 'Hide', action: onHide },
            { icon: FiInfo, label: 'Not interested', action: onNotInterested },
        ];

    // Build full list for Threads-style sheet: label left, icon right, full-width rows. Insert dividers by group.
    const renderRow = (item: MenuItem, index: number) => {
        const Icon = item.icon;
        const isDanger = item.danger;
        const isHighlight = item.highlight;
        const textClass = isDanger ? 'text-red-500' : isHighlight ? 'text-amber-400' : 'text-white';
        const iconClass = isDanger ? 'text-red-500' : isHighlight ? 'text-amber-400' : 'text-gray-300';
        return (
            <button
                key={index}
                onClick={() => item.action && handleAction(item.action)}
                disabled={isProcessing}
                className="flex w-full items-center justify-between py-3.5 px-4 active:bg-white/5 transition-colors disabled:opacity-50"
            >
                <span className={`text-[15px] font-medium ${textClass}`}>{item.label}</span>
                <Icon className={`w-5 h-5 flex-shrink-0 ${iconClass}`} />
            </button>
        );
    };

    return (
        <>
            <div className="fixed inset-0 z-[200] flex items-end">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/50"
                    onClick={onClose}
                />

                {/* Threads-style bottom sheet: handle, rounded top, dark, list rows */}
                <div className="relative w-full bg-[#262626] rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
                    {/* Drag handle */}
                    <div className="flex justify-center pt-2.5 pb-1">
                        <div className="w-10 h-0.5 bg-gray-500 rounded-full" />
                    </div>

                    <div className="flex-1 overflow-y-auto pb-6">
                        {/* Own post: Copy link, Save/Unsave, Share, Boost, then divider and rest */}
                        {isCurrentUser ? (
                            <>
                                <div className="py-1">
                                    {[
                                        { icon: FiCopy, label: 'Copy link', action: handleCopyLink },
                                        { icon: FiBookmark, label: isSaved ? 'Unsave' : 'Save', action: handleSave },
                                        { icon: FiShare2, label: 'Share', action: () => onShare && handleAction(onShare) },
                                        ...(onBoost ? [{ icon: FiZap, label: 'Boost', action: onBoost }] : []),
                                    ].map((row, i) => (
                                        <React.Fragment key={i}>
                                            {renderRow(row as MenuItem, i)}
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div className="mx-4 border-t border-gray-600/80" />
                                <div className="py-1">
                                    {menuItems.filter(m => m.label !== 'Copy Link').map((item, index) => renderRow(item, index))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="py-1">
                                    {[
                                        { icon: FiCopy, label: 'Copy link', action: handleCopyLink },
                                        { icon: FiBookmark, label: isSaved ? 'Unsave' : 'Save', action: handleSave },
                                        { icon: FiShare2, label: 'Share', action: () => onShare && handleAction(onShare) },
                                        ...(onBoost ? [{ icon: FiZap, label: 'Boost', action: onBoost }] : []),
                                        { icon: FiMaximize, label: 'QR code', action: () => setShowQRCodeModal(true) },
                                    ].map((row, i) => (
                                        <React.Fragment key={i}>
                                            {renderRow(row as MenuItem, i)}
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div className="mx-4 border-t border-gray-600/80" />
                                <div className="py-1">
                                    {(() => {
                                        const rest = menuItems.filter(m => m.label !== 'Copy Link');
                                        return rest.map((item, index) => (
                                            <React.Fragment key={`${item.label}-${index}`}>
                                                {index > 0 && !rest[index - 1].danger && item.danger ? (
                                                    <div className="mx-4 border-t border-gray-600/80" />
                                                ) : null}
                                                {renderRow(item, index)}
                                            </React.Fragment>
                                        ));
                                    })()}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Post Modal */}
            {showSaveModal && (
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

