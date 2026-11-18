import React, { useEffect, useMemo, useState } from 'react';
import { gazetteerAlert } from '../../utils/gazetteerAlertNative';
import {
    ActivityIndicator,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Modal,
    Share,
    ScrollView,
    Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { buildStoryShareUrl } from '../../utils/storyShareUrl';
import { buildStoryDmText } from '../../utils/dmStoryShare';
import { useAuth } from '../../context/Auth';
import { appendMessage } from '../../api/messages';
import { getFollowedUsers } from '../../api/posts';
import * as apiClient from '../../api/client';
import { getAvatarForHandle, resolveAvatarForUser } from '../../api/users';
import { isLaravelApiEnabled } from '../../config/runtimeEnv';
import Avatar from '../Avatar.native';

type ShareContact = {
    handle: string;
    avatarUrl?: string;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    userHandle: string;
    storyId: string;
};

function ShareRow({
    icon,
    iconBg,
    title,
    subtitle,
    onPress,
}: {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>{icon}</View>
            <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.rowSubtitle}>{subtitle}</Text>
            </View>
        </TouchableOpacity>
    );
}

/** Story share sheet — RN Modal so it works inside the full-screen Stories viewer. */
export default function StoryShareSheet({ visible, onClose, userHandle, storyId }: Props) {
    const { user } = useAuth();
    const [copied, setCopied] = useState(false);
    const [dmOpen, setDmOpen] = useState(false);
    const [contacts, setContacts] = useState<ShareContact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedHandles, setSelectedHandles] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);
    const shareUrl = buildStoryShareUrl(userHandle, storyId);
    const bareHandle = userHandle.replace(/^@/, '');
    const shareText = `Check out this story by @${bareHandle}\n${shareUrl}`;

    useEffect(() => {
        if (visible) return;
        setDmOpen(false);
        setQuery('');
        setSelectedHandles([]);
        setNote('');
        setSending(false);
    }, [visible]);

    useEffect(() => {
        if (!visible || !dmOpen || !user?.id) return;
        let cancelled = false;
        setLoadingContacts(true);
        const apply = (next: ShareContact[]) => {
            if (cancelled) return;
            const mine = (user.handle || '').trim().toLowerCase();
            setContacts(next.filter((contact) => contact.handle.trim().toLowerCase() !== mine));
        };
        const fromLocal = () => {
            getFollowedUsers(String(user.id))
                .then((handles) => apply(handles.map((handle) => ({ handle, avatarUrl: getAvatarForHandle(handle) }))))
                .catch(() => apply([]))
                .finally(() => {
                    if (!cancelled) setLoadingContacts(false);
                });
        };
        if (isLaravelApiEnabled() && user.handle) {
            apiClient
                .fetchFollowing(user.handle, 0, 100)
                .then((res) => {
                    const apiUsers = (res?.items ?? []) as Array<{ handle?: string; user_handle?: string }>;
                    return getFollowedUsers(String(user.id)).then((localHandles) => {
                        const byHandle = new Map<string, ShareContact>();
                        for (const row of apiUsers) {
                            const handle = String(row?.handle ?? row?.user_handle ?? '').trim();
                            if (!handle) continue;
                            byHandle.set(handle.toLowerCase(), {
                                handle,
                                avatarUrl: resolveAvatarForUser(handle, row),
                            });
                        }
                        for (const handle of localHandles) {
                            const key = handle.toLowerCase();
                            if (byHandle.has(key)) continue;
                            byHandle.set(key, { handle, avatarUrl: getAvatarForHandle(handle) });
                        }
                        apply([...byHandle.values()]);
                    });
                })
                .catch(() => fromLocal())
                .finally(() => {
                    if (!cancelled) setLoadingContacts(false);
                });
        } else {
            fromLocal();
        }
        return () => {
            cancelled = true;
        };
    }, [visible, dmOpen, user?.id, user?.handle]);

    const filteredContacts = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return contacts;
        return contacts.filter((contact) => contact.handle.toLowerCase().includes(q));
    }, [contacts, query]);

    const toggleRecipient = (recipientHandle: string) => {
        if (sending) return;
        setSelectedHandles((prev) => (
            prev.includes(recipientHandle)
                ? prev.filter((item) => item !== recipientHandle)
                : [...prev, recipientHandle]
        ));
    };

    const sendStoryToDm = async () => {
        if (!user?.handle || sending || selectedHandles.length === 0) return;
        setSending(true);
        const text = buildStoryDmText(note, bareHandle, shareUrl);
        const recipients = [...selectedHandles];
        let sentCount = 0;
        try {
            for (const recipientHandle of recipients) {
                await appendMessage(user.handle, recipientHandle, { text });
                sentCount += 1;
            }
            const who = recipients[0].split('@')[0] || recipients[0];
            gazetteerAlert(
                'Sent',
                sentCount === 1 ? `Story sent to ${who}.` : `Story sent to ${sentCount} people.`,
            );
            onClose();
        } catch (err) {
            gazetteerAlert(
                'Could not send',
                sentCount > 0
                    ? `Sent to ${sentCount} of ${recipients.length}. Please try again for the rest.`
                    : err instanceof Error ? err.message : 'Please try again.',
            );
        } finally {
            setSending(false);
        }
    };

    const openDmPicker = () => {
        if (!user?.handle) {
            gazetteerAlert('Sign in', 'Sign in to send this story in a message.');
            return;
        }
        setDmOpen(true);
    };

    const shareSystem = async () => {
        try {
            await Share.share({
                message: shareText,
                url: shareUrl,
                title: 'Share story',
            });
        } catch {
            try {
                await Share.share({ message: shareText });
            } catch (err) {
                console.warn('Story share failed:', err);
            }
        } finally {
            onClose();
        }
    };

    const openWebFallback = async (webUrl: string) => {
        await Linking.openURL(webUrl);
        onClose();
    };

    /** Native app scheme first; https share-intent if the app is missing; system sheet last. */
    const openSocial = async (nativeScheme: string, webUrl: string) => {
        try {
            let canOpenNative = false;
            try {
                canOpenNative = await Linking.canOpenURL(nativeScheme);
            } catch {
                canOpenNative = false;
            }
            if (canOpenNative) {
                await Linking.openURL(nativeScheme);
                onClose();
                return;
            }
            await openWebFallback(webUrl);
        } catch {
            await shareSystem();
        }
    };

    const shareWhatsApp = () => {
        const native = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
        const web = `https://wa.me/?text=${encodeURIComponent(shareUrl)}`;
        void openSocial(native, web);
    };

    const shareFacebook = () => {
        const native = `fb://share?link=${encodeURIComponent(shareUrl)}`;
        const web = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        void openSocial(native, web);
    };

    const shareTwitter = () => {
        const native = `twitter://post?message=${encodeURIComponent(shareText)}`;
        const web = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`;
        void openSocial(native, web);
    };

    const shareEmail = async () => {
        const subject = encodeURIComponent('Check out this story');
        const body = encodeURIComponent(
            `Have a look at this story by @${bareHandle}:\n\n${shareUrl}`,
        );
        const mailto = `mailto:?subject=${subject}&body=${body}`;
        try {
            let canMail = false;
            try {
                canMail = await Linking.canOpenURL(mailto);
            } catch {
                canMail = false;
            }
            if (canMail) {
                await Linking.openURL(mailto);
                onClose();
                return;
            }
            await shareSystem();
        } catch {
            await shareSystem();
        }
    };

    const copyLink = async () => {
        try {
            Clipboard.setString(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            gazetteerAlert('Link copied', 'Story link copied to clipboard.');
            onClose();
        } catch {
            gazetteerAlert('Could not copy', 'Please try again.');
        }
    };

    if (!visible) return null;

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        {dmOpen ? (
                            <TouchableOpacity onPress={() => setDmOpen(false)} style={styles.closeBtn} hitSlop={8}>
                                <Icon name="chevron-back" size={22} color="#D1D5DB" />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.closeBtn} />
                        )}
                        <Text style={styles.title}>{dmOpen ? 'Send in a message' : 'Share story'}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                            <Icon name="close" size={22} color="#D1D5DB" />
                        </TouchableOpacity>
                    </View>

                    {dmOpen ? (
                        <View style={styles.dmPane}>
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Search people you follow"
                                placeholderTextColor="#9CA3AF"
                                style={styles.dmSearch}
                            />
                            {loadingContacts ? (
                                <ActivityIndicator color="#FFFFFF" style={styles.dmLoading} />
                            ) : (
                                <ScrollView keyboardShouldPersistTaps="handled" style={styles.dmList}>
                                    {filteredContacts.length === 0 ? (
                                        <Text style={styles.dmEmpty}>
                                            Follow someone to send this story in a message.
                                        </Text>
                                    ) : (
                                        filteredContacts.map((contact) => {
                                            const selected = selectedHandles.includes(contact.handle);
                                            return (
                                            <TouchableOpacity
                                                key={contact.handle}
                                                style={styles.dmRow}
                                                onPress={() => toggleRecipient(contact.handle)}
                                                disabled={sending}
                                            >
                                                <Avatar src={contact.avatarUrl} name={contact.handle.split('@')[0]} size={36} />
                                                <Text style={styles.dmName} numberOfLines={1}>
                                                    {contact.handle.split('@')[0] || contact.handle}
                                                </Text>
                                                <Icon
                                                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                                    size={20}
                                                    color={selected ? '#FFFFFF' : '#9CA3AF'}
                                                />
                                            </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </ScrollView>
                            )}
                            {selectedHandles.length > 0 ? (
                                <View style={styles.composer}>
                                    <Text style={styles.composerTo} numberOfLines={1}>
                                        To: {selectedHandles.map((item) => item.split('@')[0]).join(', ')}
                                    </Text>
                                    <View style={styles.composerRow}>
                                        <TextInput
                                            value={note}
                                            onChangeText={setNote}
                                            placeholder="Include message..."
                                            placeholderTextColor="#9CA3AF"
                                            style={styles.composerInput}
                                            multiline
                                            maxLength={1000}
                                        />
                                        <TouchableOpacity
                                            style={styles.composerSend}
                                            onPress={() => void sendStoryToDm()}
                                            disabled={sending}
                                        >
                                            {sending ? (
                                                <ActivityIndicator color="#111827" />
                                            ) : (
                                                <Text style={styles.composerSendText}>Send</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : (
                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <ShareRow
                            icon={<Icon name="chatbubble-ellipses-outline" size={16} color="#fff" />}
                            iconBg="#22C55E"
                            title="Direct message"
                            subtitle="Send this story in a chat"
                            onPress={openDmPicker}
                        />
                        <ShareRow
                            icon={<Icon name="share-social-outline" size={16} color="#fff" />}
                            iconBg="#06B6D4"
                            title="Share"
                            subtitle="Open system share sheet"
                            onPress={() => void shareSystem()}
                        />
                        <ShareRow
                            icon={<Icon name="link" size={16} color="#fff" />}
                            iconBg="#374151"
                            title={copied ? 'Copied' : 'Copy link'}
                            subtitle="Share story link"
                            onPress={() => void copyLink()}
                        />
                        <ShareRow
                            icon={<Text style={styles.brandLetter}>W</Text>}
                            iconBg="#22C55E"
                            title="WhatsApp"
                            subtitle="Share via WhatsApp"
                            onPress={shareWhatsApp}
                        />
                        <ShareRow
                            icon={<Text style={styles.brandLetter}>f</Text>}
                            iconBg="#2563EB"
                            title="Facebook"
                            subtitle="Share to Facebook"
                            onPress={shareFacebook}
                        />
                        <ShareRow
                            icon={<Text style={styles.brandLetter}>X</Text>}
                            iconBg="#000000"
                            title="X (Twitter)"
                            subtitle="Share to X"
                            onPress={shareTwitter}
                        />
                        <ShareRow
                            icon={<Text style={styles.brandLetter}>@</Text>}
                            iconBg="#EF4444"
                            title="Email"
                            subtitle="Share via email"
                            onPress={() => void shareEmail()}
                        />
                    </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '78%',
        paddingBottom: 24,
    },
    handle: {
        alignSelf: 'center',
        width: 48,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginTop: 10,
        marginBottom: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    title: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
    dmPane: { paddingHorizontal: 16, paddingBottom: 8 },
    dmSearch: {
        backgroundColor: '#1F2937',
        color: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
        fontSize: 15,
    },
    dmLoading: { marginVertical: 24 },
    dmEmpty: { color: '#9CA3AF', fontSize: 13, paddingVertical: 16, paddingHorizontal: 4 },
    composer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.12)',
        paddingTop: 10,
        marginTop: 4,
    },
    composerTo: { color: '#D1D5DB', fontSize: 12, marginBottom: 8 },
    composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    composerInput: {
        flex: 1,
        minHeight: 40,
        maxHeight: 96,
        borderRadius: 20,
        backgroundColor: '#1F2937',
        color: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
    },
    composerSend: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 16,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    composerSendText: { color: '#111827', fontSize: 14, fontWeight: '700' },
    dmRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
    },
    dmName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
    closeBtn: { padding: 8, borderRadius: 999 },
    dmList: { flexGrow: 0, maxHeight: 280 },
    scroll: { flexGrow: 0 },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: '#1F2937',
        marginBottom: 10,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandLetter: { color: '#fff', fontSize: 14, fontWeight: '800' },
    rowText: { flex: 1 },
    rowTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
    rowSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
});
