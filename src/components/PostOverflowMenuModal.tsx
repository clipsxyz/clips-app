import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import Clipboard from '@react-native-clipboard/clipboard';
import { buildShareablePostUrl } from '../utils/shareUrls';
import {
    UCL_CANVAS_NAVY,
    UCL_CYAN,
    UCL_MAGENTA,
    UCL_SHEET_BORDER,
    UCL_SHEET_GRADIENT,
    UCL_SHEET_GRADIENT_LOCATIONS,
    UCL_SHEET_ROW_BORDER,
    UCL_SHEET_SURFACE,
    UCL_SHEET_TEXT,
    UCL_SHEET_TEXT_MUTED,
} from '../theme/gazetteerAmbientNative';

export type PostOverflowMenuModalProps = {
    visible: boolean;
    post: Post | null;
    viewerUserId: string;
    viewerHandle?: string | null;
    isSaved: boolean;
    hasNotifications: boolean;
    onClose: () => void;
    /** Opens system/share sheet (parent may also increment share count). */
    onShare: () => void | Promise<void>;
    /** Opens collection picker (web SavePostModal parity). */
    onOpenSave?: () => void;
    /** Quick save / unsave via collections */
    onSaveToggle?: () => Promise<void>;
    onCreateGroup?: () => void;
    onInviteToGroup?: () => void;
    onShowQRCode?: () => void;
    onCopyLink?: () => Promise<void>;
    onReclip?: () => Promise<void>;
    onBoost?: () => void;
    onArchive?: () => Promise<void>;
    onToggleNotifications?: () => Promise<void>;
    onDelete?: () => Promise<void>;
    onEdit?: () => void;
    onUnfollow?: () => Promise<void>;
    onMute?: () => Promise<void>;
    onHide?: () => void;
    onNotInterested?: () => void;
    isFollowing?: boolean;
    onReport?: () => Promise<void>;
    onBlock?: () => Promise<void>;
};

export default function PostOverflowMenuModal({
    visible,
    post,
    viewerHandle,
    isSaved,
    hasNotifications,
    onClose,
    onShare,
    onOpenSave,
    onSaveToggle,
    onCreateGroup,
    onInviteToGroup,
    onShowQRCode,
    onCopyLink,
    onReclip,
    onBoost,
    onArchive,
    onToggleNotifications,
    onDelete,
    onEdit,
    onUnfollow,
    onMute,
    onHide,
    onNotInterested,
    isFollowing = false,
    onReport,
    onBlock,
}: PostOverflowMenuModalProps) {
    const [busy, setBusy] = React.useState(false);

    const isOwn =
        !!viewerHandle &&
        !!post?.userHandle &&
        post.userHandle.replace(/^@/, '').trim().toLowerCase() ===
            viewerHandle.replace(/^@/, '').trim().toLowerCase();
    const isReclip = !!post?.originalUserHandle;

    const run = async (fn?: () => void | Promise<void>) => {
        if (!fn || busy) return;
        setBusy(true);
        try {
            await fn();
        } finally {
            setBusy(false);
        }
    };

    const copyLink = async () => {
        if (!post) return;
        if (onCopyLink) {
            await onCopyLink();
            return;
        }
        try {
            await Clipboard.setString(buildShareablePostUrl(post));
            Alert.alert('Link copied', 'Post link copied to clipboard.');
        } catch {
            Alert.alert('Could not copy', 'Please try again.');
        }
    };

    if (!visible || !post) return null;

    const Row = ({
        icon,
        label,
        onPress,
        danger,
        disabled,
    }: {
        icon: string;
        label: string;
        onPress: () => void;
        danger?: boolean;
        disabled?: boolean;
    }) => (
        <TouchableOpacity
            style={[styles.row, disabled && styles.rowDisabled]}
            onPress={onPress}
            disabled={disabled || busy}
        >
            <Icon name={icon} size={22} color={danger ? UCL_MAGENTA : UCL_CYAN} />
            <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
            <Icon name="chevron-forward" size={18} color={UCL_SHEET_TEXT_MUTED} />
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <LinearGradient
                        colors={[...UCL_SHEET_GRADIENT]}
                        locations={[...UCL_SHEET_GRADIENT_LOCATIONS]}
                        start={{ x: 0.15, y: 0 }}
                        end={{ x: 0.9, y: 1 }}
                        style={styles.sheetCanvas}
                    >
                    <View style={styles.grabber} />
                    <Text style={styles.title}>Post options</Text>
                    {busy ? (
                        <ActivityIndicator color={UCL_CYAN} style={{ marginVertical: 12 }} />
                    ) : null}
                    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
                        {isOwn && onCreateGroup ? (
                            <Row
                                icon="people-outline"
                                label="Create group"
                                onPress={() => {
                                    onCreateGroup();
                                    onClose();
                                }}
                            />
                        ) : null}

                        <Row icon="link-outline" label="Copy link" onPress={() => run(async () => { await copyLink(); onClose(); })} />

                        <Row
                            icon={isSaved ? 'bookmark' : 'bookmark-outline'}
                            label={isSaved ? 'Unsave' : 'Save'}
                            onPress={() =>
                                run(async () => {
                                    if (onOpenSave) {
                                        onOpenSave();
                                        onClose();
                                    } else if (onSaveToggle) {
                                        await onSaveToggle();
                                        onClose();
                                    }
                                })
                            }
                        />

                        <Row
                            icon="share-social-outline"
                            label="Share"
                            onPress={() =>
                                run(async () => {
                                    await onShare();
                                    onClose();
                                })
                            }
                        />

                        {isOwn && !isReclip && onEdit ? (
                            <Row icon="create-outline" label="Edit" onPress={() => { onEdit(); onClose(); }} />
                        ) : null}

                        {isOwn && !isReclip && onBoost ? (
                            <Row icon="flash-outline" label="Boost" onPress={() => { onBoost(); onClose(); }} />
                        ) : null}

                        {isOwn && !isReclip && onArchive ? (
                            <Row
                                icon="archive-outline"
                                label="Archive"
                                onPress={() =>
                                    run(async () => {
                                        await onArchive();
                                        onClose();
                                    })
                                }
                            />
                        ) : null}

                        {isOwn && !isReclip && onToggleNotifications ? (
                            <Row
                                icon={hasNotifications ? 'notifications-off-outline' : 'notifications-outline'}
                                label={
                                    hasNotifications ? 'Turn off post notifications' : 'Turn on post notifications'
                                }
                                onPress={() =>
                                    run(async () => {
                                        await onToggleNotifications();
                                        onClose();
                                    })
                                }
                            />
                        ) : null}

                        {!isOwn && onInviteToGroup ? (
                            <Row
                                icon="person-add-outline"
                                label="Invite to a group"
                                onPress={() => {
                                    onInviteToGroup();
                                    onClose();
                                }}
                            />
                        ) : null}

                        {!isOwn && onShowQRCode ? (
                            <Row
                                icon="qr-code-outline"
                                label="QR code"
                                onPress={() => {
                                    onShowQRCode();
                                }}
                            />
                        ) : null}

                        {!isOwn && onReclip ? (
                            <Row
                                icon="repeat-outline"
                                label="Reclip"
                                onPress={() =>
                                    run(async () => {
                                        await onReclip();
                                        onClose();
                                    })
                                }
                                disabled={post.userHandle === viewerHandle || !!post.userReclipped}
                            />
                        ) : null}

                        {!isOwn && isFollowing && onUnfollow ? (
                            <Row
                                icon="person-remove-outline"
                                label={`Unfollow ${post.userHandle.split('@')[0]}`}
                                onPress={() =>
                                    run(async () => {
                                        await onUnfollow();
                                        onClose();
                                    })
                                }
                            />
                        ) : null}

                        {!isOwn && onMute ? (
                            <Row
                                icon="volume-mute-outline"
                                label={`Mute ${post.userHandle.split('@')[0]}`}
                                onPress={() =>
                                    run(async () => {
                                        await onMute();
                                        onClose();
                                    })
                                }
                            />
                        ) : null}

                        {!isOwn && onHide ? (
                            <Row
                                icon="eye-off-outline"
                                label="Hide"
                                onPress={() => {
                                    onHide();
                                    onClose();
                                }}
                            />
                        ) : null}

                        {!isOwn && onNotInterested ? (
                            <Row
                                icon="information-circle-outline"
                                label="Not interested"
                                onPress={() => {
                                    onNotInterested();
                                    onClose();
                                }}
                            />
                        ) : null}

                        {!isOwn && onReport ? (
                            <Row
                                icon="flag-outline"
                                label="Report"
                                danger
                                onPress={() =>
                                    run(async () => {
                                        await onReport();
                                        onClose();
                                    })
                                }
                            />
                        ) : null}

                        {!isOwn && onBlock ? (
                            <Row
                                icon="ban-outline"
                                label="Block user"
                                danger
                                onPress={() =>
                                    run(async () => {
                                        await onBlock();
                                        onClose();
                                    })
                                }
                            />
                        ) : null}

                        {isOwn && !isReclip && onDelete ? (
                            <Row
                                icon="trash-outline"
                                label="Delete post"
                                danger
                                onPress={() =>
                                    run(async () => {
                                        await onDelete();
                                        onClose();
                                    })
                                }
                            />
                        ) : null}

                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </ScrollView>
                    </LinearGradient>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(3, 9, 27, 0.72)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: UCL_CANVAS_NAVY,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 28,
        maxHeight: '72%',
        borderTopWidth: 1,
        borderColor: UCL_SHEET_BORDER,
        overflow: 'hidden',
    },
    sheetCanvas: {
        backgroundColor: UCL_CANVAS_NAVY,
        overflow: 'hidden',
    },
    grabber: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: UCL_CYAN,
        opacity: 0.7,
        marginTop: 10,
        marginBottom: 8,
    },
    title: {
        color: UCL_SHEET_TEXT,
        fontSize: 16,
        fontWeight: '700',
        paddingHorizontal: 20,
        paddingBottom: 8,
    },
    scroll: {
        paddingHorizontal: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: UCL_SHEET_ROW_BORDER,
        backgroundColor: UCL_SHEET_SURFACE,
    },
    rowDisabled: {
        opacity: 0.35,
    },
    rowLabel: {
        flex: 1,
        color: UCL_SHEET_TEXT,
        fontSize: 16,
        fontWeight: '600',
    },
    rowLabelDanger: {
        color: UCL_MAGENTA,
    },
    cancelBtn: {
        marginTop: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelText: {
        color: UCL_SHEET_TEXT_MUTED,
        fontSize: 16,
        fontWeight: '600',
    },
});
