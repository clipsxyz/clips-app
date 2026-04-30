import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal, ScrollView, Alert, TextInput, Share, Linking, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { approveHiddenComment, deleteHiddenComment, fetchHiddenCommentsForOwner, fetchPostsByUser, toggleLike, fetchComments, addComment, toggleCommentLike, toggleReplyLike, addReply, type HiddenCommentReviewItem } from '../api/posts';
import { getUserCollections } from '../api/collections';
import { getDrafts, deleteDraft, type Draft } from '../api/drafts';
import { getUnreadTotal } from '../api/messages';
import { setProfilePrivacy } from '../api/privacy';
import { updateAuthProfile, sendPhoneVerificationCode, verifyPhoneVerificationCode, linkFacebookAccount, fetchFacebookFriendsMatches, toggleFollow, type FacebookMatchedFriend, matchContactPhones } from '../api/client';
import type { Post, Collection } from '../types';
import Avatar from '../components/Avatar';
import FeedPostMeta from '../components/FeedPostMeta';
import MyFeedPostCard from '../components/MyFeedPostCard';
import {
    getNotificationPreferences,
    saveNotificationPreferences,
    resetNotificationPreferences,
    type NotificationPreferences,
} from '../services/notifications';
import {
    getCommentModerationPreferences,
    setCommentModerationPreferences,
    type CommentModerationPreferences,
} from '../utils/commentModeration';
import { getRuntimeEnv, getReactNativeDefaultApiBaseUrl } from '../config/runtimeEnv';
import { timeAgo } from '../utils/timeAgo';

const ProfileScreen: React.FC = ({ navigation }: any) => {
    const { user, logout, login } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'collections'>('posts');
    const [collectionsOpen, setCollectionsOpen] = useState(false);
    const [draftsOpen, setDraftsOpen] = useState(false);
    const [commentSafetyOpen, setCommentSafetyOpen] = useState(false);
    const [inviteFriendsOpen, setInviteFriendsOpen] = useState(false);
    const [myFeedOpen, setMyFeedOpen] = useState(false);
    const [myFeedCommentsOpen, setMyFeedCommentsOpen] = useState(false);
    const [myFeedCommentsPost, setMyFeedCommentsPost] = useState<Post | null>(null);
    const [myFeedComments, setMyFeedComments] = useState<any[]>([]);
    const [myFeedCommentsLoading, setMyFeedCommentsLoading] = useState(false);
    const [myFeedCommentDraft, setMyFeedCommentDraft] = useState('');
    const [myFeedReplyingTo, setMyFeedReplyingTo] = useState<string | null>(null);
    const [myFeedReplyDraft, setMyFeedReplyDraft] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [commentModerationPrefs, setCommentModerationPrefs] = useState<CommentModerationPreferences>(getCommentModerationPreferences());
    const [commentWordDraft, setCommentWordDraft] = useState('');
    const [hiddenCommentQueue, setHiddenCommentQueue] = useState<HiddenCommentReviewItem[]>([]);
    const [loadingHiddenCommentQueue, setLoadingHiddenCommentQueue] = useState(false);
    const [hiddenQueueFilter, setHiddenQueueFilter] = useState<'all' | 'comments' | 'replies'>('all');
    const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
    const [isPrivate, setIsPrivate] = useState(!!user?.is_private);
    const [editProfileOpen, setEditProfileOpen] = useState(false);
    const [profileNameDraft, setProfileNameDraft] = useState(user?.name || '');
    const [profileBioDraft, setProfileBioDraft] = useState(user?.bio || '');
    const [profileWebsiteDraft, setProfileWebsiteDraft] = useState((user as any)?.socialLinks?.website || (user as any)?.website || '');
    const [profilePodcastDraft, setProfilePodcastDraft] = useState((user as any)?.socialLinks?.podcast || '');
    const [securityModalOpen, setSecurityModalOpen] = useState(false);
    const [securityStep, setSecurityStep] = useState<'phone' | 'code'>('phone');
    const [securityBusy, setSecurityBusy] = useState(false);
    const [phoneCountryCode, setPhoneCountryCode] = useState('+353');
    const [phoneInput, setPhoneInput] = useState('');
    const [otpInput, setOtpInput] = useState('');
    const [pendingPhoneNumber, setPendingPhoneNumber] = useState('');
    const [inviteSyncing, setInviteSyncing] = useState(false);
    const [inviteMatchedFriends, setInviteMatchedFriends] = useState<FacebookMatchedFriend[]>([]);
    const [contactsSyncing, setContactsSyncing] = useState(false);
    const [showTabsHint, setShowTabsHint] = useState(true);
    const tabsHintAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadData();
    }, [user?.handle]);

    useEffect(() => {
        setIsPrivate(!!user?.is_private);
    }, [user?.is_private]);

    useEffect(() => {
        setProfileNameDraft(user?.name || '');
        setProfileBioDraft(user?.bio || '');
        setProfileWebsiteDraft((user as any)?.socialLinks?.website || (user as any)?.website || '');
        setProfilePodcastDraft((user as any)?.socialLinks?.podcast || '');
    }, [user?.name, user?.bio, (user as any)?.website, (user as any)?.socialLinks?.website, (user as any)?.socialLinks?.podcast]);

    useFocusEffect(
        React.useCallback(() => {
            void loadData();
            setSecurityModalOpen(true);
            setSecurityStep('phone');
            setSecurityBusy(false);
            setPhoneCountryCode('+353');
            setPhoneInput('');
            setOtpInput('');
            setPendingPhoneNumber('');
        }, [])
    );

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(tabsHintAnim, {
                    toValue: 6,
                    duration: 450,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(tabsHintAnim, {
                    toValue: 0,
                    duration: 450,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.delay(1200),
            ])
        );
        if (showTabsHint) loop.start();
        return () => loop.stop();
    }, [showTabsHint, tabsHintAnim]);

    const loadData = async () => {
        if (!user?.handle) return;
        setLoading(true);
        try {
            const [userPosts, userCollections, userDrafts] = await Promise.all([
                fetchPostsByUser(user.handle, 50),
                getUserCollections(user.id || 'me'),
                getDrafts().catch(() => []),
            ]);
            setPosts(userPosts);
            setCollections(userCollections);
            setDrafts(userDrafts);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const openMyFeedComments = React.useCallback(async (post: Post) => {
        setMyFeedCommentsPost(post);
        setMyFeedCommentsOpen(true);
        setMyFeedCommentDraft('');
        setMyFeedReplyingTo(null);
        setMyFeedReplyDraft('');
        setMyFeedCommentsLoading(true);
        try {
            const rows = await fetchComments(post.id);
            setMyFeedComments(Array.isArray(rows) ? rows : []);
        } catch (error) {
            console.error('Error loading My feed comments:', error);
            setMyFeedComments([]);
        } finally {
            setMyFeedCommentsLoading(false);
        }
    }, []);

    const handleAddMyFeedComment = React.useCallback(async () => {
        if (!user?.handle || !myFeedCommentsPost?.id) return;
        const text = myFeedCommentDraft.trim();
        if (!text) return;
        try {
            const created = await addComment(myFeedCommentsPost.id, user.handle, text);
            setMyFeedComments((prev) => [...prev, created]);
            setMyFeedCommentDraft('');
            setPosts((prev) =>
                prev.map((p) =>
                    p.id === myFeedCommentsPost.id
                        ? {
                              ...p,
                              stats: { ...p.stats, comments: (p.stats?.comments ?? 0) + 1 },
                          }
                        : p
                )
            );
        } catch (error) {
            console.error('Error adding My feed comment:', error);
            Alert.alert('Could not add comment', 'Please try again.');
        }
    }, [myFeedCommentDraft, myFeedCommentsPost?.id, user?.handle]);

    const handleToggleMyFeedCommentLike = React.useCallback(async (commentId: string) => {
        try {
            const updated = await toggleCommentLike(commentId);
            setMyFeedComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
        } catch (error) {
            console.error('Error toggling comment like in My feed:', error);
        }
    }, []);

    const handleAddMyFeedReply = React.useCallback(async () => {
        if (!myFeedCommentsPost?.id || !myFeedReplyingTo || !user?.handle) return;
        const text = myFeedReplyDraft.trim();
        if (!text) return;
        try {
            const reply = await addReply(myFeedCommentsPost.id, myFeedReplyingTo, user.handle, text);
            setMyFeedComments((prev) =>
                prev.map((c) =>
                    c.id === myFeedReplyingTo
                        ? {
                              ...c,
                              replies: [...(c.replies || []), reply],
                              replyCount: (c.replyCount || 0) + 1,
                          }
                        : c
                )
            );
            setMyFeedReplyDraft('');
            setMyFeedReplyingTo(null);
        } catch (error) {
            console.error('Error adding reply in My feed:', error);
            Alert.alert('Could not add reply', 'Please try again.');
        }
    }, [myFeedCommentsPost?.id, myFeedReplyingTo, myFeedReplyDraft, user?.handle]);

    const handleToggleMyFeedReplyLike = React.useCallback(async (parentId: string, replyId: string) => {
        try {
            const updatedParent = await toggleReplyLike(parentId, replyId);
            setMyFeedComments((prev) => prev.map((c) => (c.id === parentId ? updatedParent : c)));
        } catch (error) {
            console.error('Error toggling reply like in My feed:', error);
        }
    }, []);

    const filteredHiddenQueue = React.useMemo(() => {
        if (hiddenQueueFilter === 'comments') return hiddenCommentQueue.filter((item) => !item.isReply);
        if (hiddenQueueFilter === 'replies') return hiddenCommentQueue.filter((item) => !!item.isReply);
        return hiddenCommentQueue;
    }, [hiddenCommentQueue, hiddenQueueFilter]);

    useEffect(() => {
        if (user?.handle) {
            const updateUnreadCount = async () => {
                try {
                    const count = await getUnreadTotal(user.handle!);
                    setUnreadCount(count);
                } catch (error) {
                    console.error('Error fetching unread count:', error);
                }
            };
            updateUnreadCount();
            const interval = setInterval(updateUnreadCount, 10000);
            return () => clearInterval(interval);
        }
    }, [user?.handle]);

    useEffect(() => {
        if (!commentSafetyOpen || !user?.handle) return;
        let cancelled = false;
        (async () => {
            setLoadingHiddenCommentQueue(true);
            try {
                const items = await fetchHiddenCommentsForOwner(user.handle);
                if (!cancelled) setHiddenCommentQueue(items);
            } catch (error) {
                console.error('Error loading hidden comments queue:', error);
                if (!cancelled) setHiddenCommentQueue([]);
            } finally {
                if (!cancelled) setLoadingHiddenCommentQueue(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [commentSafetyOpen, user?.handle]);

    const loadCollections = async () => {
        if (!user?.id) return;
        try {
            const userCollections = await getUserCollections(user.id);
            setCollections(userCollections);
        } catch (error) {
            console.error('Error loading collections:', error);
        }
    };

    const handleDeleteDraft = async (draftId: string) => {
        try {
            await deleteDraft(draftId);
            await loadData();
        } catch (error) {
            console.error('Error deleting draft:', error);
            Alert.alert('Error', 'Failed to delete draft');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => {
                        logout();
                        navigation.replace('Login');
                    },
                },
            ]
        );
    };

    const handleTogglePrivate = async () => {
        if (!user?.handle) return;
        const next = !isPrivate;
        setIsPrivate(next);
        try {
            setProfilePrivacy(user.handle, next);
            await updateAuthProfile({ is_private: next } as any);
        } catch (error) {
            console.error('Failed to update privacy:', error);
        }
    };

    const handleSaveProfileEdits = async () => {
        if (!user?.handle) return;
        try {
            const payload: any = {
                display_name: profileNameDraft.trim() || undefined,
                bio: profileBioDraft.trim() || undefined,
                website: profileWebsiteDraft.trim() || undefined,
                social_links: {
                    ...((user as any)?.socialLinks || {}),
                    website: profileWebsiteDraft.trim() || undefined,
                    podcast: profilePodcastDraft.trim() || undefined,
                },
            };
            await updateAuthProfile(payload);
            login({
                ...user,
                name: profileNameDraft.trim() || user.name,
                bio: profileBioDraft.trim() || undefined,
                website: profileWebsiteDraft.trim() || undefined,
                socialLinks: {
                    ...((user as any)?.socialLinks || {}),
                    website: profileWebsiteDraft.trim() || undefined,
                    podcast: profilePodcastDraft.trim() || undefined,
                },
            } as any);
            setEditProfileOpen(false);
            Alert.alert('Saved', 'Your profile has been updated.');
        } catch (error) {
            console.error('Failed to save profile edits:', error);
            Alert.alert('Save failed', 'Could not update profile right now.');
        }
    };

    const handleSendSecurityCode = async () => {
        if (securityBusy) return;
        const digits = phoneInput.replace(/\D+/g, '');
        if (digits.length < 7 || digits.length > 15) {
            Alert.alert('Invalid number', 'Enter a valid phone number.');
            return;
        }
        const fullPhone = `${phoneCountryCode}${digits}`;
        setSecurityBusy(true);
        try {
            const res = await sendPhoneVerificationCode(fullPhone);
            setPendingPhoneNumber(fullPhone);
            setSecurityStep('code');
            setOtpInput('');
            if (res.delivery === 'mock' && res.debug_code) {
                Alert.alert('Demo code', `Use PIN ${res.debug_code}`);
            } else {
                Alert.alert('Code sent', `A verification code was sent to ${fullPhone}.`);
            }
        } catch (error: any) {
            Alert.alert('Send failed', error?.message || 'Could not send verification code.');
        } finally {
            setSecurityBusy(false);
        }
    };

    const handleVerifySecurityCode = async () => {
        if (securityBusy) return;
        const code = otpInput.replace(/\D+/g, '');
        if (code.length !== 6) {
            Alert.alert('Invalid code', 'Enter the 6-digit code.');
            return;
        }
        setSecurityBusy(true);
        try {
            await verifyPhoneVerificationCode(pendingPhoneNumber, code);
            setSecurityModalOpen(false);
            Alert.alert('Verified', 'Phone verification complete.');
        } catch (error: any) {
            Alert.alert('Verification failed', error?.message || 'Incorrect code. Try again.');
        } finally {
            setSecurityBusy(false);
        }
    };

    const handleSyncFacebookFriends = async () => {
        if (inviteSyncing) return;
        setInviteSyncing(true);
        try {
            const fb = await import('react-native-fbsdk-next');
            const result = await fb.LoginManager.logInWithPermissions(['public_profile', 'user_friends']);
            if (result.isCancelled) {
                setInviteSyncing(false);
                return;
            }

            const tokenData = await fb.AccessToken.getCurrentAccessToken();
            const accessToken = tokenData?.accessToken?.toString();
            if (!accessToken) {
                Alert.alert('Facebook login failed', 'No access token returned.');
                setInviteSyncing(false);
                return;
            }

            await linkFacebookAccount(accessToken);
            const matches = await fetchFacebookFriendsMatches(accessToken);
            setInviteMatchedFriends(matches.matched || []);
            Alert.alert('Facebook synced', matches.matched_count
                ? `Found ${matches.matched_count} friend${matches.matched_count === 1 ? '' : 's'}.`
                : (matches.message || 'No matched Facebook friends yet.'));
        } catch (error: any) {
            Alert.alert('Sync failed', error?.message || 'Could not sync Facebook friends right now.');
        } finally {
            setInviteSyncing(false);
        }
    };

    const handleMatchContacts = async () => {
        setContactsSyncing(true);
        try {
            const ContactsModule = await import('react-native-contacts');
            const Contacts = ContactsModule.default;
            let permission = await Contacts.checkPermission();
            if (permission === 'undefined') {
                permission = await Contacts.requestPermission();
            }
            if (permission !== 'authorized') {
                Alert.alert('Permission needed', 'Allow contacts permission to sync your contacts.');
                return;
            }

            const deviceContacts = await Contacts.getAll();
            const phones = deviceContacts
                .flatMap((c: any) => Array.isArray(c.phoneNumbers) ? c.phoneNumbers : [])
                .map((p: any) => String(p?.number || '').trim())
                .filter(Boolean);
            if (!phones.length) {
                Alert.alert('No contacts found', 'No phone numbers were found on this device.');
                return;
            }

            const result = await matchContactPhones(phones);
            const asFriends: FacebookMatchedFriend[] = (result.matched || []).map((m) => ({
                id: m.id,
                handle: m.handle,
                display_name: m.display_name,
                avatar_url: m.avatar_url,
                facebook_id: null,
            }));
            setInviteMatchedFriends(asFriends);
            Alert.alert('Contacts matched', result.matched_count
                ? `Matched ${result.matched_count} contact${result.matched_count === 1 ? '' : 's'}.`
                : 'No matched contacts yet.');
        } catch (error: any) {
            Alert.alert('Match failed', error?.message || 'Could not match contacts right now.');
        } finally {
            setContactsSyncing(false);
        }
    };

    const handleInviteByQrOrLink = async () => {
        const apiBase = getRuntimeEnv('VITE_API_URL') || getReactNativeDefaultApiBaseUrl() || 'http://localhost:8000/api';
        const apiOrigin = apiBase.replace(/\/api\/?$/, '');
        const profileUrl = `${apiOrigin}/invite/${encodeURIComponent(String(user?.handle || '').replace(/^@/, ''))}`;
        try {
            await Share.share({
                message: `Join me on Clips: ${profileUrl}`,
                url: profileUrl,
                title: 'Invite by link',
            });
        } catch {
            // ignore share cancel
        }
        Clipboard.setString(profileUrl);
        Alert.alert('Invite link copied', 'Your profile link was copied to clipboard.');
    };

    const handleShareInviteToWhatsApp = async () => {
        const apiBase = getRuntimeEnv('VITE_API_URL') || getReactNativeDefaultApiBaseUrl() || 'http://localhost:8000/api';
        const apiOrigin = apiBase.replace(/\/api\/?$/, '');
        const inviteUrl = `${apiOrigin}/invite/${encodeURIComponent(String(user?.handle || '').replace(/^@/, ''))}`;
        const text = `${user?.handle || 'A friend'} invited you to join Gazetteer\n\n${inviteUrl}`;
        const link = `whatsapp://send?text=${encodeURIComponent(text)}`;
        const can = await Linking.canOpenURL(link);
        if (can) {
            await Linking.openURL(link);
        } else {
            await Share.share({ message: text, url: inviteUrl, title: 'Share invite' });
        }
    };

    const handleShareInviteToMessenger = async () => {
        const apiBase = getRuntimeEnv('VITE_API_URL') || getReactNativeDefaultApiBaseUrl() || 'http://localhost:8000/api';
        const apiOrigin = apiBase.replace(/\/api\/?$/, '');
        const inviteUrl = `${apiOrigin}/invite/${encodeURIComponent(String(user?.handle || '').replace(/^@/, ''))}`;
        const appId = getRuntimeEnv('VITE_FACEBOOK_APP_ID') || '';
        const messengerLink = `fb-messenger://share/?link=${encodeURIComponent(inviteUrl)}${appId ? `&app_id=${encodeURIComponent(appId)}` : ''}`;
        const can = await Linking.canOpenURL(messengerLink);
        if (can) {
            await Linking.openURL(messengerLink);
        } else {
            await Share.share({ message: `${user?.handle || 'A friend'} invited you to join Gazetteer ${inviteUrl}`, url: inviteUrl, title: 'Share invite' });
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Avatar
                    src={user?.avatarUrl}
                    name={user?.name || 'User'}
                    size={32}
                />
                <Text style={styles.title}>Passport</Text>
                <TouchableOpacity onPress={() => setSettingsOpen(true)}>
                    <Icon name="lock-closed" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Tabs: Messages, Drafts, Collections, Comment Safety, Settings */}
            <View style={styles.tabsWrap}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsContainer}
                contentContainerStyle={styles.tabsContentContainer}
                onScroll={(e) => {
                    if (e.nativeEvent.contentOffset.x > 8) setShowTabsHint(false);
                }}
                scrollEventThrottle={16}
            >
                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setInviteFriendsOpen(true)}
                >
                    <Icon name="people-outline" size={20} color="#67E8F9" />
                    <Text style={styles.tabLabel}>Invite Friends</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setMyFeedOpen(true)}
                >
                    <Icon name="newspaper-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>My feed</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => navigation.navigate('Inbox')}
                >
                    <Icon name="mail" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Messages</Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setDraftsOpen(true)}
                >
                    <Icon name="document-text" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Drafts</Text>
                    {drafts.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {drafts.length > 9 ? '9+' : drafts.length}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => {
                        loadCollections();
                        setCollectionsOpen(true);
                    }}
                >
                    <Icon name="bookmark" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Collections</Text>
                    {collections.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {collections.length > 9 ? '9+' : collections.length}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setCommentSafetyOpen(true)}
                >
                    <Icon name="shield-checkmark" size={20} color="#FBBF24" />
                    <Text style={styles.tabLabel}>Comment Safety</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setSettingsOpen(true)}
                >
                    <Icon name="settings" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Settings</Text>
                </TouchableOpacity>
            </ScrollView>
            {showTabsHint && (
                <>
                    <View pointerEvents="none" style={styles.tabsHintFade} />
                    <Animated.View pointerEvents="none" style={[styles.tabsHintChip, { transform: [{ translateX: tabsHintAnim }] }]}>
                        <Text style={styles.tabsHintText}>Swipe</Text>
                        <Text style={styles.tabsHintText}>›</Text>
                    </Animated.View>
                </>
            )}
            </View>

            <View style={styles.profileSection}>
                <View style={styles.profileInfo}>
                    <Avatar
                        src={user?.avatarUrl}
                        name={user?.name || user?.handle || 'User'}
                        size={80}
                    />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user?.name || user?.handle}</Text>
                        <Text style={styles.userHandle}>{user?.handle}</Text>
                        {user?.bio && (
                            <Text style={styles.userBio}>{user.bio}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{posts.length}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user?.followers_count || 0}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user?.following_count || 0}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => {
                        setEditProfileOpen(true);
                    }}
                >
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.postsSection}>
                <View style={styles.postsHeader}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('posts')}
                        style={[styles.postsTab, activeTab === 'posts' && styles.postsTabActive]}
                    >
                        <Icon 
                            name="grid" 
                            size={20} 
                            color={activeTab === 'posts' ? "#8B5CF6" : "#6B7280"} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('collections')}
                        style={[styles.postsTab, activeTab === 'collections' && styles.postsTabActive]}
                    >
                        <Icon 
                            name="bookmark" 
                            size={20} 
                            color={activeTab === 'collections' ? "#8B5CF6" : "#6B7280"} 
                        />
                    </TouchableOpacity>
                </View>

                {activeTab === 'posts' ? (
                    <FlatList
                        data={posts}
                        numColumns={3}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                                style={styles.postItem}
                            >
                                {item.mediaUrl ? (
                                    <Image source={{ uri: item.mediaUrl }} style={styles.postImage} />
                                ) : (
                                    <View style={styles.postPlaceholder}>
                                        <Icon name="text" size={24} color="#6B7280" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No posts yet</Text>
                            </View>
                        }
                    />
                ) : (
                    <FlatList
                        data={collections}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.collectionItem}
                                onPress={() => navigation.navigate('CollectionFeed', {
                                    collectionId: item.id,
                                    collectionName: item.name,
                                })}
                            >
                                {item.thumbnailUrl ? (
                                    <Image source={{ uri: item.thumbnailUrl }} style={styles.collectionThumbnail} />
                                ) : (
                                    <View style={styles.collectionThumbnailPlaceholder}>
                                        <Icon name="bookmark" size={24} color="#6B7280" />
                                    </View>
                                )}
                                <View style={styles.collectionInfo}>
                                    <Text style={styles.collectionName}>{item.name}</Text>
                                    <Text style={styles.collectionCount}>
                                        {item.postIds?.length || 0} {item.postIds?.length === 1 ? 'post' : 'posts'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No collections yet</Text>
                            </View>
                        }
                    />
                )}
            </View>

            <Modal
                visible={securityModalOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => {}}
            >
                <View style={styles.securityOverlay}>
                    <View style={styles.securityCard}>
                        {securityStep === 'phone' ? (
                            <>
                                <Text style={styles.securityTitle}>Add phone</Text>
                                <View style={styles.securityWhatsAppBadge}>
                                    <Icon name="logo-whatsapp" size={14} color="#DCFCE7" />
                                    <Text style={styles.securityWhatsAppBadgeText}>We will text your verification code on WhatsApp</Text>
                                </View>
                                <Text style={styles.securityBody}>
                                    Add your phone number for extra security and easier account recovery.
                                </Text>
                                <View style={styles.securityPhoneRow}>
                                    <TextInput
                                        value={phoneCountryCode}
                                        onChangeText={setPhoneCountryCode}
                                        placeholder="+353"
                                        placeholderTextColor="#9CA3AF"
                                        style={styles.securityCountryInput}
                                    />
                                    <TextInput
                                        value={phoneInput}
                                        onChangeText={setPhoneInput}
                                        placeholder="Phone number"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="phone-pad"
                                        style={styles.securityPhoneInput}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={[styles.securityPrimaryButton, securityBusy && styles.securityPrimaryButtonDisabled]}
                                    onPress={handleSendSecurityCode}
                                    disabled={securityBusy}
                                >
                                    <Text style={styles.securityPrimaryButtonText}>{securityBusy ? 'Sending...' : 'Continue'}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.securityTitle}>Enter 6-digit code</Text>
                                <Text style={styles.securityBody}>Your WhatsApp code was sent to {pendingPhoneNumber}</Text>
                                <TextInput
                                    value={otpInput}
                                    onChangeText={setOtpInput}
                                    placeholder="000000"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    style={styles.securityCodeInput}
                                />
                                <TouchableOpacity
                                    style={[styles.securityPrimaryButton, securityBusy && styles.securityPrimaryButtonDisabled]}
                                    onPress={handleVerifySecurityCode}
                                    disabled={securityBusy}
                                >
                                    <Text style={styles.securityPrimaryButtonText}>{securityBusy ? 'Verifying...' : 'Verify'}</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal
                visible={inviteFriendsOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setInviteFriendsOpen(false)}
            >
                <View style={styles.securityOverlay}>
                    <View style={styles.securityCard}>
                        <View style={styles.inviteHeaderRow}>
                            <Text style={styles.securityTitle}>Invite Friends</Text>
                            <TouchableOpacity onPress={() => setInviteFriendsOpen(false)} style={styles.inviteCloseBtn}>
                                <Icon name="close" size={18} color="#D1D5DB" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.inviteOption}
                            onPress={handleSyncFacebookFriends}
                            disabled={inviteSyncing}
                        >
                            <View style={styles.inviteOptionRow}>
                                <Icon name="logo-facebook" size={16} color="#60A5FA" />
                                <Text style={styles.inviteOptionTitle}>{inviteSyncing ? 'Syncing Facebook...' : 'Find Facebook Friends'}</Text>
                            </View>
                            <Text style={styles.inviteOptionBody}>Sync friends who connected with your app.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.inviteOption}
                            onPress={handleShareInviteToWhatsApp}
                        >
                            <View style={styles.inviteOptionRow}>
                                <Icon name="logo-whatsapp" size={16} color="#86EFAC" />
                                <Text style={styles.inviteOptionTitle}>Share to WhatsApp</Text>
                            </View>
                            <Text style={styles.inviteOptionBody}>Share the Gazetteer app with friends.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.inviteOption}
                            onPress={handleShareInviteToMessenger}
                        >
                            <View style={styles.inviteOptionRow}>
                                <Icon name="chatbubble-ellipses" size={16} color="#60A5FA" />
                                <Text style={styles.inviteOptionTitle}>Share to Messenger</Text>
                            </View>
                            <Text style={styles.inviteOptionBody}>Share the Gazetteer app with friends.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.inviteOption}
                            onPress={handleMatchContacts}
                            disabled={contactsSyncing}
                        >
                            <Text style={styles.inviteOptionTitle}>Find contacts</Text>
                            <Text style={styles.inviteOptionBody}>{contactsSyncing ? 'Syncing your phone contacts...' : 'Sync your phone contacts to discover friends.'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.inviteOption}
                            onPress={handleInviteByQrOrLink}
                        >
                            <View style={styles.inviteOptionRow}>
                                <Icon name="qr-code-outline" size={16} color="#D1D5DB" />
                                <Text style={styles.inviteOptionTitle}>Invite by link or QR</Text>
                            </View>
                            <Text style={styles.inviteOptionBody}>Share your profile and connect faster.</Text>
                        </TouchableOpacity>
                        {inviteMatchedFriends.length > 0 && (
                            <View style={styles.inviteMatchesWrap}>
                                <Text style={styles.inviteMatchesLabel}>Facebook matches ({inviteMatchedFriends.length})</Text>
                                {inviteMatchedFriends.map((friend) => (
                                    <View key={friend.id} style={styles.inviteMatchRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inviteMatchTitle} numberOfLines={1}>
                                                {friend.display_name || friend.handle || friend.facebook_name || 'User'}
                                            </Text>
                                            <Text style={styles.inviteMatchHandle} numberOfLines={1}>{friend.handle}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.inviteFollowBtn}
                                            onPress={async () => {
                                                try {
                                                    await toggleFollow(friend.handle);
                                                    Alert.alert('Followed', friend.handle);
                                                } catch {
                                                    Alert.alert('Error', 'Could not follow right now.');
                                                }
                                            }}
                                        >
                                            <Text style={styles.inviteFollowBtnText}>Follow</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Drafts Modal */}
            <Modal
                visible={draftsOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDraftsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Drafts</Text>
                            <TouchableOpacity onPress={() => setDraftsOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {drafts.length > 0 ? (
                                drafts.map((draft) => (
                                    <View key={draft.id} style={styles.draftItem}>
                                        <TouchableOpacity
                                            style={styles.draftInfo}
                                            onPress={() => {
                                                setDraftsOpen(false);
                                                navigation.navigate('CreateComposer', {
                                                    mediaUrl: draft.videoUrl || undefined,
                                                    mediaType: draft.mediaType || (draft.videoUrl ? 'video' : undefined),
                                                    draftCaption: draft.caption || '',
                                                    draftTextBody: draft.textBody || '',
                                                    draftLocation: draft.location || '',
                                                    draftVenue: draft.venue || '',
                                                    draftLandmark: draft.landmark || '',
                                                    draftTaggedUsers: draft.taggedUsers || [],
                                                    trimStart: draft.trimStart ?? 0,
                                                    trimEnd: draft.trimEnd ?? 0,
                                                });
                                            }}
                                        >
                                            <Text style={styles.draftDate}>
                                                {new Date(draft.createdAt).toLocaleDateString()}
                                            </Text>
                                            <Text style={styles.draftText} numberOfLines={2}>
                                                {draft.caption || draft.textBody || 'No text'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteDraft(draft.id)}
                                            style={styles.deleteButton}
                                        >
                                            <Icon name="trash" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>No drafts yet</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Edit Profile Modal */}
            <Modal
                visible={editProfileOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditProfileOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setEditProfileOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Display name</Text>
                            <TextInput
                                style={styles.wordInput}
                                value={profileNameDraft}
                                onChangeText={setProfileNameDraft}
                                placeholder="Enter display name"
                                placeholderTextColor="#6B7280"
                            />

                            <Text style={styles.inputLabel}>Bio</Text>
                            <TextInput
                                style={[styles.wordInput, { minHeight: 84, textAlignVertical: 'top' }]}
                                value={profileBioDraft}
                                onChangeText={setProfileBioDraft}
                                placeholder="Tell people about yourself"
                                placeholderTextColor="#6B7280"
                                multiline
                                maxLength={220}
                            />

                            <Text style={styles.inputLabel}>Website</Text>
                            <TextInput
                                style={styles.wordInput}
                                value={profileWebsiteDraft}
                                onChangeText={setProfileWebsiteDraft}
                                placeholder="https://"
                                placeholderTextColor="#6B7280"
                                autoCapitalize="none"
                            />

                            <Text style={styles.inputLabel}>Podcast</Text>
                            <TextInput
                                style={styles.wordInput}
                                value={profilePodcastDraft}
                                onChangeText={setProfilePodcastDraft}
                                placeholder="https://open.spotify.com/show/..."
                                placeholderTextColor="#6B7280"
                                autoCapitalize="none"
                            />

                            <View style={styles.sheetActionsRow}>
                                <TouchableOpacity
                                    style={styles.smallActionButton}
                                    onPress={() => setEditProfileOpen(false)}
                                >
                                    <Text style={styles.smallActionButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.addWordButton}
                                    onPress={() => { void handleSaveProfileEdits(); }}
                                >
                                    <Text style={styles.addWordButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Collections Modal */}
            <Modal
                visible={collectionsOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCollectionsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Collections</Text>
                            <TouchableOpacity onPress={() => setCollectionsOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {collections.length > 0 ? (
                                collections.map((collection) => {
                                    const postCount = collection.postIds?.length || 0;
                                    return (
                                        <TouchableOpacity
                                            key={collection.id}
                                            style={styles.collectionModalItem}
                                            onPress={() => {
                                                setCollectionsOpen(false);
                                                navigation.navigate('CollectionFeed', {
                                                    collectionId: collection.id,
                                                    collectionName: collection.name,
                                                });
                                            }}
                                        >
                                            {collection.thumbnailUrl ? (
                                                <Image source={{ uri: collection.thumbnailUrl }} style={styles.collectionModalThumbnail} />
                                            ) : (
                                                <View style={styles.collectionModalThumbnailPlaceholder}>
                                                    <Icon name="bookmark" size={24} color="#6B7280" />
                                                </View>
                                            )}
                                            <View style={styles.collectionModalInfo}>
                                                <Text style={styles.collectionModalName}>{collection.name}</Text>
                                                <Text style={styles.collectionModalCount}>
                                                    {postCount} {postCount === 1 ? 'post' : 'posts'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyText}>No collections yet</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* My Feed Modal */}
            <Modal
                visible={myFeedOpen}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setMyFeedOpen(false)}
            >
                <SafeAreaView style={styles.myFeedScreen}>
                    <View style={styles.myFeedHeader}>
                        <View style={styles.myFeedHeaderLeft}>
                            <Image source={require('../assets/gazetteer-splash-logo.png')} style={styles.myFeedLogo} />
                            <Text style={styles.myFeedTitle}>My feed</Text>
                        </View>
                        <TouchableOpacity onPress={() => setMyFeedOpen(false)} style={styles.myFeedCloseButton}>
                            <Icon name="close" size={22} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={posts}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.myFeedListContent}
                        renderItem={({ item }) => (
                            <MyFeedPostCard
                                post={item}
                                user={user}
                                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                                onCommentPress={() => {
                                    void openMyFeedComments(item);
                                }}
                                onLikePress={() => {
                                    if (!user?.id) return;
                                    void (async () => {
                                        try {
                                            const updated = await toggleLike(user.id, item.id, item);
                                            setPosts((prev) => prev.map((p) => (p.id === item.id ? updated : p)));
                                        } catch (error) {
                                            console.error('Failed to toggle like in My feed:', error);
                                        }
                                    })();
                                }}
                            />
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>You have not posted anything yet.</Text>
                            </View>
                        }
                    />
                </SafeAreaView>
            </Modal>

            {/* My Feed Comments Modal */}
            <Modal
                visible={myFeedCommentsOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setMyFeedCommentsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.myFeedCommentsModalContent}>
                        <View style={styles.myFeedCommentsModalHeader}>
                            <Text style={styles.modalTitle}>
                                {myFeedComments.length} {myFeedComments.length === 1 ? 'comment' : 'comments'}
                            </Text>
                            <TouchableOpacity onPress={() => setMyFeedCommentsOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.myFeedCommentsModalBody}>
                            {myFeedCommentsLoading ? (
                                <ActivityIndicator size="small" color="#8B5CF6" />
                            ) : (
                                <ScrollView style={styles.myFeedCommentsList}>
                                    {myFeedComments.length === 0 ? (
                                        <Text style={styles.emptyText}>No comments yet.</Text>
                                    ) : (
                                        myFeedComments.map((comment) => (
                                            <View key={comment.id} style={styles.myFeedCommentItem}>
                                                {(((comment as any).updatedAt && (comment as any).updatedAt !== comment.createdAt) ||
                                                    ((comment as any).updated_at && (comment as any).updated_at !== (comment as any).created_at) ||
                                                    (comment as any).editedAt) ? (
                                                    <Text style={styles.myFeedEditedBadge}>edited</Text>
                                                ) : null}
                                                <Text style={styles.myFeedCommentAuthor}>{comment.userHandle || 'User'}</Text>
                                                <Text style={styles.myFeedCommentText}>{comment.text || ''}</Text>
                                                <Text style={styles.myFeedCommentTime}>
                                                    {comment.createdAt ? timeAgo(comment.createdAt) : 'just now'}
                                                </Text>
                                                <View style={styles.myFeedCommentActionsRow}>
                                                    <TouchableOpacity onPress={() => { void handleToggleMyFeedCommentLike(comment.id); }}>
                                                        <Text style={styles.myFeedCommentActionText}>
                                                            {(comment.userLiked ? 'Unlike' : 'Like')} ({comment.likes ?? 0})
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => setMyFeedReplyingTo(comment.id)}>
                                                        <Text style={styles.myFeedCommentActionText}>Reply ({comment.replyCount ?? 0})</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {Array.isArray(comment.replies) && comment.replies.length > 0 ? (
                                                    <View style={styles.myFeedReplyList}>
                                                        {comment.replies.map((reply: any) => (
                                                            <View key={reply.id} style={styles.myFeedReplyItem}>
                                                                {(((reply as any).updatedAt && (reply as any).updatedAt !== reply.createdAt) ||
                                                                    ((reply as any).updated_at && (reply as any).updated_at !== (reply as any).created_at) ||
                                                                    (reply as any).editedAt) ? (
                                                                    <Text style={styles.myFeedEditedBadge}>edited</Text>
                                                                ) : null}
                                                                <Text style={styles.myFeedReplyAuthor}>{reply.userHandle || 'User'}</Text>
                                                                <Text style={styles.myFeedReplyText}>{reply.text || ''}</Text>
                                                                <Text style={styles.myFeedReplyTime}>
                                                                    {reply.createdAt ? timeAgo(reply.createdAt) : 'just now'}
                                                                </Text>
                                                                <TouchableOpacity onPress={() => { void handleToggleMyFeedReplyLike(comment.id, reply.id); }}>
                                                                    <Text style={styles.myFeedReplyActionText}>
                                                                        {(reply.userLiked ? 'Unlike' : 'Like')} ({reply.likes ?? 0})
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        ))}
                                                    </View>
                                                ) : null}
                                            </View>
                                        ))
                                    )}
                                </ScrollView>
                            )}
                            {myFeedReplyingTo ? (
                                <View style={styles.myFeedCommentInputRow}>
                                    <TextInput
                                        style={styles.myFeedCommentInput}
                                        value={myFeedReplyDraft}
                                        onChangeText={setMyFeedReplyDraft}
                                        placeholder="Write a reply..."
                                        placeholderTextColor="#6B7280"
                                    />
                                    <TouchableOpacity style={styles.smallActionButton} onPress={() => setMyFeedReplyingTo(null)}>
                                        <Text style={styles.smallActionButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.addWordButton} onPress={() => { void handleAddMyFeedReply(); }}>
                                        <Text style={styles.addWordButtonText}>Reply</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                            <View style={styles.myFeedCommentInputRow}>
                                <TextInput
                                    style={styles.myFeedCommentInput}
                                    value={myFeedCommentDraft}
                                    onChangeText={setMyFeedCommentDraft}
                                    placeholder="Add a comment..."
                                    placeholderTextColor="#6B7280"
                                />
                                <TouchableOpacity style={styles.addWordButton} onPress={() => { void handleAddMyFeedComment(); }}>
                                    <Text style={styles.addWordButtonText}>Post</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Settings Modal */}
            <Modal
                visible={settingsOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSettingsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Settings</Text>
                            <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <View style={styles.safetySection}>
                                <Text style={styles.safetySectionTitle}>Content preferences</Text>
                                <Text style={styles.toggleDescription}>Edit preferred locations for feed suggestions</Text>
                                <TouchableOpacity
                                    style={[styles.smallActionButton, { alignSelf: 'flex-start', marginTop: 10 }]}
                                    onPress={() => {
                                        setSettingsOpen(false);
                                        navigation.navigate('ContentPreferences');
                                    }}
                                >
                                    <Text style={styles.smallActionButtonText}>Open preferences</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.safetySection}>
                                <Text style={styles.safetySectionTitle}>Privacy</Text>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Text style={styles.toggleLabel}>Private account</Text>
                                        <Text style={styles.toggleDescription}>Only approved followers can view your profile</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.toggleTrack, isPrivate && styles.toggleTrackActive]}
                                        onPress={handleTogglePrivate}
                                    >
                                        <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbActive]} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.safetySection}>
                                <View style={styles.safetySectionHeader}>
                                    <Text style={styles.safetySectionTitle}>Push Notifications</Text>
                                    <TouchableOpacity
                                        style={styles.smallActionButton}
                                        onPress={() => {
                                            const reset = resetNotificationPreferences();
                                            setNotificationPrefs(reset);
                                        }}
                                    >
                                        <Text style={styles.smallActionButtonText}>Reset</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Text style={styles.toggleLabel}>Enable notifications</Text>
                                        <Text style={styles.toggleDescription}>Master switch for alerts on this device</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.toggleTrack, notificationPrefs.enabled && styles.toggleTrackActive]}
                                        onPress={() => {
                                            const next = { ...notificationPrefs, enabled: !notificationPrefs.enabled };
                                            setNotificationPrefs(next);
                                            saveNotificationPreferences(next);
                                        }}
                                    >
                                        <View style={[styles.toggleThumb, notificationPrefs.enabled && styles.toggleThumbActive]} />
                                    </TouchableOpacity>
                                </View>

                                {notificationPrefs.enabled && (
                                    <View>
                                        {[
                                            ['directMessages', 'Direct Messages'],
                                            ['groupChats', 'Group Chat'],
                                            ['likes', 'Likes'],
                                            ['comments', 'Comments'],
                                            ['replies', 'Replies'],
                                            ['follows', 'Follows'],
                                            ['followRequests', 'Follow Requests'],
                                            ['storyInsights', 'Story Insights'],
                                            ['questions', 'Questions'],
                                            ['shares', 'Shares'],
                                            ['reclips', 'Reclips'],
                                        ].map(([key, label]) => (
                                            <View key={key} style={styles.toggleRow}>
                                                <Text style={styles.toggleLabel}>{label}</Text>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.toggleTrack,
                                                        (notificationPrefs as any)[key] && styles.toggleTrackActive,
                                                    ]}
                                                    onPress={() => {
                                                        const next = {
                                                            ...notificationPrefs,
                                                            [key]: !(notificationPrefs as any)[key],
                                                        } as NotificationPreferences;
                                                        setNotificationPrefs(next);
                                                        saveNotificationPreferences(next);
                                                    }}
                                                >
                                                    <View
                                                        style={[
                                                            styles.toggleThumb,
                                                            (notificationPrefs as any)[key] && styles.toggleThumbActive,
                                                        ]}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                style={styles.logoutButton}
                                onPress={handleLogout}
                            >
                                <Text style={styles.logoutButtonText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Comment Safety Modal */}
            <Modal
                visible={commentSafetyOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCommentSafetyOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Comment Safety</Text>
                            <TouchableOpacity onPress={() => setCommentSafetyOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.safetySection}>
                                <View style={styles.safetySectionHeader}>
                                    <Text style={styles.safetySectionTitle}>Filters</Text>
                                    <TouchableOpacity
                                        style={styles.smallActionButton}
                                        onPress={() => {
                                            const resetPrefs = { strictMode: false, customHiddenWords: [] };
                                            setCommentModerationPrefs(resetPrefs);
                                            setCommentModerationPreferences(resetPrefs);
                                            setCommentWordDraft('');
                                        }}
                                    >
                                        <Text style={styles.smallActionButtonText}>Reset</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Text style={styles.toggleLabel}>Strict filtering</Text>
                                        <Text style={styles.toggleDescription}>Auto-hide warning-level negative comments</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.toggleTrack, commentModerationPrefs.strictMode && styles.toggleTrackActive]}
                                        onPress={() => {
                                            const next = { ...commentModerationPrefs, strictMode: !commentModerationPrefs.strictMode };
                                            setCommentModerationPrefs(next);
                                            setCommentModerationPreferences(next);
                                        }}
                                    >
                                        <View style={[styles.toggleThumb, commentModerationPrefs.strictMode && styles.toggleThumbActive]} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.inputLabel}>Hidden words and phrases</Text>
                                <View style={styles.wordInputRow}>
                                    <TextInput
                                        style={styles.wordInput}
                                        value={commentWordDraft}
                                        onChangeText={setCommentWordDraft}
                                        placeholder="Add hidden word or phrase"
                                        placeholderTextColor="#6B7280"
                                    />
                                    <TouchableOpacity
                                        style={styles.addWordButton}
                                        onPress={() => {
                                            const incoming = String(commentWordDraft || '').trim().toLowerCase();
                                            if (!incoming) return;
                                            const next = {
                                                ...commentModerationPrefs,
                                                customHiddenWords: Array.from(new Set([...(commentModerationPrefs.customHiddenWords || []), incoming])),
                                            };
                                            setCommentModerationPrefs(next);
                                            setCommentModerationPreferences(next);
                                            setCommentWordDraft('');
                                        }}
                                    >
                                        <Text style={styles.addWordButtonText}>Add</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.wordChipWrap}>
                                    {(commentModerationPrefs.customHiddenWords || []).map((word) => (
                                        <TouchableOpacity
                                            key={word}
                                            style={styles.wordChip}
                                            onPress={() => {
                                                const next = {
                                                    ...commentModerationPrefs,
                                                    customHiddenWords: (commentModerationPrefs.customHiddenWords || []).filter((w) => w !== word),
                                                };
                                                setCommentModerationPrefs(next);
                                                setCommentModerationPreferences(next);
                                            }}
                                        >
                                            <Text style={styles.wordChipText}>{word} ×</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.safetySection}>
                                <View style={styles.safetySectionHeader}>
                                    <Text style={styles.safetySectionTitle}>Hidden comments review</Text>
                                    <Text style={styles.queueCountText}>{hiddenCommentQueue.length} pending</Text>
                                </View>
                                <View style={styles.filterPillsRow}>
                                    {(['all', 'comments', 'replies'] as const).map((filterKey) => (
                                        <TouchableOpacity
                                            key={filterKey}
                                            style={[
                                                styles.filterPill,
                                                hiddenQueueFilter === filterKey && styles.filterPillActive,
                                            ]}
                                            onPress={() => setHiddenQueueFilter(filterKey)}
                                        >
                                            <Text
                                                style={[
                                                    styles.filterPillText,
                                                    hiddenQueueFilter === filterKey && styles.filterPillTextActive,
                                                ]}
                                            >
                                                {filterKey === 'all' ? 'All' : filterKey === 'comments' ? 'Comments' : 'Replies'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {loadingHiddenCommentQueue ? (
                                    <ActivityIndicator size="small" color="#8B5CF6" style={{ marginTop: 12 }} />
                                ) : filteredHiddenQueue.length === 0 ? (
                                    <Text style={styles.emptyText}>No hidden comments to review.</Text>
                                ) : (
                                    filteredHiddenQueue.map((item) => (
                                        <View key={item.id} style={styles.queueItem}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.queueItemAuthor}>
                                                    {item.userHandle} {item.isReply ? 'replied' : 'commented'}
                                                </Text>
                                                <Text style={styles.queueItemText} numberOfLines={2}>{item.text}</Text>
                                            </View>
                                            <View style={styles.queueActions}>
                                                <TouchableOpacity
                                                    style={styles.queueActionBtn}
                                                    onPress={async () => {
                                                        const ok = await approveHiddenComment(item.id);
                                                        if (!ok) return;
                                                        setHiddenCommentQueue((prev) => prev.filter((row) => row.id !== item.id));
                                                    }}
                                                >
                                                    <Text style={styles.queueActionText}>Approve</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.queueActionBtn, styles.queueActionBtnDanger]}
                                                    onPress={async () => {
                                                        const ok = await deleteHiddenComment(item.id);
                                                        if (!ok) return;
                                                        setHiddenCommentQueue((prev) => prev.filter((row) => row.id !== item.id));
                                                    }}
                                                >
                                                    <Text style={[styles.queueActionText, styles.queueActionTextDanger]}>Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    profileSection: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    profileInfo: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 14,
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 19,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    userHandle: {
        fontSize: 15,
        color: '#9CA3AF',
        marginTop: 2,
    },
    userBio: {
        fontSize: 13,
        color: '#D1D5DB',
        marginTop: 4,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 2,
    },
    editButton: {
        backgroundColor: '#1F2937',
        paddingVertical: 9,
        paddingHorizontal: 20,
        borderRadius: 9,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    editButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    postsSection: {
        flex: 1,
    },
    postsHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        gap: 32,
    },
    postsTab: {
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    postsTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#8B5CF6',
    },
    postItem: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    postImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    postPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    collectionName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    collectionCount: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
    },
    tabsWrap: {
        position: 'relative',
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    tabsContainer: {
        maxHeight: 66,
    },
    tabsContentContainer: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        columnGap: 8,
    },
    tab: {
        alignItems: 'center',
        position: 'relative',
        paddingHorizontal: 12,
        minWidth: 84,
    },
    tabLabel: {
        fontSize: 12,
        color: '#FFFFFF',
        marginTop: 4,
    },
    tabsHintFade: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 42,
        backgroundColor: 'rgba(3,7,18,0.75)',
    },
    tabsHintChip: {
        position: 'absolute',
        right: 8,
        top: 46,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 2,
    },
    tabsHintText: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: 0,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    collectionThumbnail: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#111827',
    },
    collectionThumbnailPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionInfo: {
        flex: 1,
        marginLeft: 12,
    },
    myFeedScreen: {
        flex: 1,
        backgroundColor: '#020617',
    },
    myFeedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    myFeedHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    myFeedLogo: {
        width: 32,
        height: 32,
        borderRadius: 8,
        marginRight: 8,
    },
    myFeedTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    myFeedCloseButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
        padding: 8,
    },
    myFeedListContent: {
        padding: 12,
        rowGap: 12,
        paddingBottom: 28,
    },
    myFeedCard: {
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1F2937',
        borderRadius: 16,
        overflow: 'hidden',
    },
    myFeedCardHeader: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        rowGap: 8,
    },
    myFeedAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    myFeedAuthorMeta: {
        marginLeft: 10,
        flex: 1,
    },
    myFeedLocationPill: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#0F172A',
        paddingHorizontal: 8,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
        maxWidth: '100%',
    },
    myFeedLocationText: {
        color: '#BFDBFE',
        fontSize: 11,
        fontWeight: '600',
        maxWidth: 260,
    },
    myFeedMedia: {
        width: '100%',
        height: 320,
        backgroundColor: '#000000',
    },
    myFeedVideoPreviewWrap: {
        position: 'relative',
    },
    myFeedVideoOverlay: {
        position: 'absolute',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    myFeedVideoPlaceholder: {
        width: '100%',
        height: 320,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#030712',
    },
    myFeedVideoPlaceholderText: {
        marginTop: 8,
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
    myFeedTextCard: {
        paddingHorizontal: 14,
        paddingVertical: 16,
        backgroundColor: '#1F2937',
    },
    myFeedTextCardText: {
        color: '#FFFFFF',
        fontSize: 15,
        lineHeight: 22,
    },
    myFeedCaptionWrap: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    myFeedCaptionText: {
        color: '#E5E7EB',
        fontSize: 13,
        lineHeight: 20,
    },
    myFeedStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        columnGap: 12,
    },
    myFeedStatPill: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
    },
    myFeedStatText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalBody: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    myFeedCommentsModalContent: {
        backgroundColor: '#000000',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    myFeedCommentsModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 2,
        borderBottomColor: '#FFFFFF',
        backgroundColor: '#000000',
    },
    myFeedCommentsModalBody: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#000000',
    },
    draftItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#111827',
        borderRadius: 8,
        marginBottom: 12,
    },
    draftInfo: {
        flex: 1,
    },
    draftDate: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 4,
    },
    draftText: {
        fontSize: 14,
        color: '#FFFFFF',
    },
    deleteButton: {
        padding: 8,
    },
    collectionModalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#111827',
        borderRadius: 8,
        marginBottom: 12,
    },
    collectionModalThumbnail: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#111827',
    },
    collectionModalThumbnailPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionModalInfo: {
        flex: 1,
        marginLeft: 12,
    },
    collectionModalName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    collectionModalCount: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    logoutButton: {
        backgroundColor: '#EF4444',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
    },
    logoutButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    safetySection: {
        backgroundColor: '#111827',
        borderRadius: 10,
        padding: 11,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1F2937',
    },
    safetySectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    safetySectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    smallActionButton: {
        backgroundColor: '#374151',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    smallActionButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    toggleInfo: {
        flex: 1,
        paddingRight: 10,
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    toggleDescription: {
        marginTop: 2,
        fontSize: 12,
        color: '#9CA3AF',
    },
    toggleTrack: {
        width: 46,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#374151',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    toggleTrackActive: {
        backgroundColor: '#8B5CF6',
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },
    inputLabel: {
        fontSize: 13,
        color: '#D1D5DB',
        marginBottom: 8,
    },
    wordInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
    },
    myFeedCommentsList: {
        maxHeight: 260,
        marginBottom: 12,
    },
    myFeedCommentItem: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    myFeedEditedBadge: {
        alignSelf: 'flex-start',
        marginBottom: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: '#1E3A8A',
        color: '#DBEAFE',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    myFeedCommentAuthor: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    myFeedCommentText: {
        color: '#D1D5DB',
        fontSize: 13,
        lineHeight: 18,
    },
    myFeedCommentTime: {
        marginTop: 3,
        color: '#9CA3AF',
        fontSize: 11,
    },
    myFeedCommentActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 14,
        marginTop: 6,
    },
    myFeedCommentActionText: {
        color: '#93C5FD',
        fontSize: 12,
        fontWeight: '600',
    },
    myFeedReplyList: {
        marginTop: 8,
        paddingLeft: 10,
        borderLeftWidth: 1,
        borderLeftColor: '#374151',
        rowGap: 6,
    },
    myFeedReplyItem: {},
    myFeedReplyAuthor: {
        color: '#E5E7EB',
        fontSize: 12,
        fontWeight: '700',
    },
    myFeedReplyText: {
        color: '#CBD5E1',
        fontSize: 12,
        lineHeight: 17,
    },
    myFeedReplyTime: {
        marginTop: 2,
        color: '#94A3B8',
        fontSize: 10,
    },
    myFeedReplyActionText: {
        marginTop: 3,
        color: '#93C5FD',
        fontSize: 11,
        fontWeight: '600',
    },
    myFeedCommentInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
    },
    myFeedCommentInput: {
        flex: 1,
        backgroundColor: '#030712',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: '#FFFFFF',
        fontSize: 13,
    },
    wordInput: {
        flex: 1,
        backgroundColor: '#030712',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: '#FFFFFF',
        fontSize: 13,
    },
    addWordButton: {
        backgroundColor: '#8B5CF6',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    addWordButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    sheetActionsRow: {
        marginTop: 14,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        columnGap: 8,
    },
    wordChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 6,
        rowGap: 6,
        marginTop: 10,
    },
    wordChip: {
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    wordChipText: {
        fontSize: 11,
        color: '#E5E7EB',
    },
    queueCountText: {
        fontSize: 12,
        color: '#FBBF24',
        fontWeight: '600',
    },
    filterPillsRow: {
        flexDirection: 'row',
        columnGap: 8,
        marginBottom: 10,
    },
    filterPill: {
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#030712',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    filterPillActive: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    filterPillText: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    filterPillTextActive: {
        color: '#FFFFFF',
    },
    queueItem: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
        backgroundColor: '#030712',
        borderWidth: 1,
        borderColor: '#1F2937',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
    },
    queueItemAuthor: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 3,
    },
    queueItemText: {
        fontSize: 12,
        color: '#D1D5DB',
    },
    queueActions: {
        flexDirection: 'row',
        columnGap: 6,
    },
    queueActionBtn: {
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    queueActionBtnDanger: {
        borderColor: '#7F1D1D',
        backgroundColor: '#450A0A',
    },
    queueActionText: {
        color: '#E5E7EB',
        fontSize: 11,
        fontWeight: '600',
    },
    queueActionTextDanger: {
        color: '#FCA5A5',
    },
    securityOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        paddingHorizontal: 18,
    },
    securityCard: {
        backgroundColor: '#111827',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1F2937',
        padding: 16,
    },
    securityTitle: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 10,
    },
    securityBody: {
        color: '#D1D5DB',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    securityWhatsAppBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
        backgroundColor: '#052E16',
        borderWidth: 1,
        borderColor: '#166534',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 10,
    },
    securityWhatsAppBadgeText: {
        color: '#BBF7D0',
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    securityPhoneRow: {
        flexDirection: 'row',
        columnGap: 8,
        marginBottom: 12,
    },
    securityCountryInput: {
        width: 92,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#1F2937',
        color: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    securityPhoneInput: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#1F2937',
        color: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    securityCodeInput: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#1F2937',
        color: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 18,
        letterSpacing: 6,
        textAlign: 'center',
        marginBottom: 12,
    },
    securityPrimaryButton: {
        backgroundColor: '#9F1239',
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    securityPrimaryButtonDisabled: {
        opacity: 0.6,
    },
    securityPrimaryButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    inviteHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    inviteCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1F2937',
    },
    inviteOption: {
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#030712',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 10,
    },
    inviteOptionTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    inviteOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
        marginBottom: 2,
    },
    inviteOptionBody: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    inviteMatchesWrap: {
        marginTop: 4,
    },
    inviteMatchesLabel: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    inviteMatchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#030712',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 8,
    },
    inviteMatchTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    inviteMatchHandle: {
        color: '#9CA3AF',
        fontSize: 11,
        marginTop: 2,
    },
    inviteFollowBtn: {
        backgroundColor: '#9F1239',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    inviteFollowBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
});

export default ProfileScreen;
