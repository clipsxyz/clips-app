import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    FlatList,
    ActivityIndicator,
    Modal,
    ScrollView,
    TextInput,
    Share,
    Linking,
    Animated,
    Easing,
    Platform,
    DeviceEventEmitter,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import ProfileCoverHero from '../components/ProfileCoverHero.native';
import { navigateMainTab } from '../navigation/mainTabs';
import {
    chipActiveMagenta,
    chipActiveMagentaText,
    GAZETTEER_ABYSS,
    glassPanel,
    glassSearch,
    glassSurface,
    gazetteerHeader,
    profilePassportDivider,
    profilePassportChipBorder,
    profilePassportScrollInset,
} from '../theme/gazetteerAmbientNative';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, toggleLike, fetchComments, addComment, toggleCommentLike, toggleReplyLike, addReply, getFollowedUsers } from '../api/posts';
import {
    getCollectionThumbnailUrl,
    getUserCollections,
    savePostToDefaultCollection,
    unsavePost,
} from '../api/collections';
import { getDrafts, deleteDraft, type Draft } from '../api/drafts';
import { buildFilterInfo, type InstantFilterName } from '../utils/instantFiltersNative';
import { getUnreadTotal } from '../api/messages';
import { getInboxUnreadPollMs } from '../utils/backgroundPollMs';
import { setProfilePrivacy, getEffectiveProfilePrivate } from '../api/privacy';
import { updateAuthProfile, sendPhoneVerificationCode, verifyPhoneVerificationCode, linkFacebookAccount, fetchFacebookFriendsMatches, fetchFollowers, type FacebookMatchedFriend, matchContactPhones } from '../api/client';
import type { Post, Collection } from '../types';
import Avatar from '../components/Avatar';
import FeedPostMeta from '../components/FeedPostMeta';
import { FeedCard } from './FeedScreen';
import PostOverflowMenuModal from '../components/PostOverflowMenuModal';
import SavePostModal from '../components/SavePostModal.native';
import EditPostModal from '../components/EditPostModal.native';
import QRCodeModal from '../components/QRCodeModal.native';
import CreateGroupModal from '../components/CreateGroupModal.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import FeedShareModal from '../components/FeedShareModal';
import {
    incrementViews,
    deletePost,
    reclipPost,
} from '../api/posts';
import { getCollectionsForPost } from '../api/collections';
import { updatePost as apiUpdatePost } from '../api/client';
import {
    markFeedPostArchivedMobile,
    setPostNotificationsPrefMobile,
    hasPostNotificationsPrefMobile,
} from '../utils/feedEngagementPrefsMobile';
import { buildShareablePostUrl } from '../utils/shareUrls';
import ProfileGridThumb from '../components/ProfileGridThumb.native';
import ProfilePassportCards from '../components/ProfilePassportCards.native';
import ProfilePictureModal from '../components/ProfilePictureModal.native';
import CommentSafetyModal from '../components/CommentSafetyModal.native';
import {
    getNotificationPreferences,
    saveNotificationPreferences,
    resetNotificationPreferences,
    type NotificationPreferences,
} from '../services/notifications';
import { getRuntimeEnv, getReactNativeDefaultApiBaseUrl, isLaravelApiEnabled } from '../config/runtimeEnv';
import { timeAgo } from '../utils/timeAgo';
import { ox } from '../constants/nativeOpticalScale';

type ProfileAlertConfig = {
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
    confirmButtonText?: string;
    cancelButtonText?: string;
    showCancelButton?: boolean;
    onConfirm?: () => void;
    onDismiss?: () => void;
};

const ProfileScreen: React.FC = ({ navigation }: any) => {
    const { height: windowHeight } = useWindowDimensions();
    const { user, logout, login } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'collections'>('posts');
    const [collectionsOpen, setCollectionsOpen] = useState(false);
    const [brokenCollectionThumbs, setBrokenCollectionThumbs] = useState<Record<string, true>>({});
    const [draftsOpen, setDraftsOpen] = useState(false);
    const [commentSafetyOpen, setCommentSafetyOpen] = useState(false);
    const [inviteFriendsOpen, setInviteFriendsOpen] = useState(false);
    const [myFeedOpen, setMyFeedOpen] = useState(false);
    const [myFeedOverflowPost, setMyFeedOverflowPost] = useState<Post | null>(null);
    const [myFeedOverflowVisible, setMyFeedOverflowVisible] = useState(false);
    const [myFeedOverflowSaved, setMyFeedOverflowSaved] = useState(false);
    const [myFeedOverflowNotify, setMyFeedOverflowNotify] = useState(false);
    const [myFeedSavePost, setMyFeedSavePost] = useState<Post | null>(null);
    const [myFeedEditPost, setMyFeedEditPost] = useState<Post | null>(null);
    const [myFeedQrPost, setMyFeedQrPost] = useState<Post | null>(null);
    const [myFeedSharePost, setMyFeedSharePost] = useState<Post | null>(null);
    const [myFeedCreateGroupOpen, setMyFeedCreateGroupOpen] = useState(false);
    const [myFeedCommentsOpen, setMyFeedCommentsOpen] = useState(false);
    const [myFeedCommentsPost, setMyFeedCommentsPost] = useState<Post | null>(null);
    const [myFeedComments, setMyFeedComments] = useState<any[]>([]);
    const [myFeedCommentsLoading, setMyFeedCommentsLoading] = useState(false);
    const [myFeedCommentDraft, setMyFeedCommentDraft] = useState('');
    const [myFeedReplyingTo, setMyFeedReplyingTo] = useState<string | null>(null);
    const [myFeedReplyDraft, setMyFeedReplyDraft] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
    const [profileAlert, setProfileAlert] = useState<ProfileAlertConfig | null>(null);

    const showProfileAlert = React.useCallback((config: ProfileAlertConfig) => {
        setProfileAlert(config);
    }, []);

    const dismissProfileAlert = React.useCallback(() => {
        setProfileAlert((current) => {
            current?.onDismiss?.();
            return null;
        });
    }, []);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
    const [isPrivate, setIsPrivate] = useState(() =>
        getEffectiveProfilePrivate(user?.handle, user?.is_private)
    );
    const [audienceCounts, setAudienceCounts] = useState({ followers: 0, following: 0 });
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
    const tabsScrollRef = React.useRef<ScrollView | null>(null);
    const tabsAutoNudgingRef = React.useRef(false);
    const tabsHintNudgeDoneRef = React.useRef(false);
    const [tabsStripLayoutW, setTabsStripLayoutW] = useState(0);
    const [tabsStripContentW, setTabsStripContentW] = useState(0);
    const tabsStripOverflow = React.useMemo(
        () =>
            tabsStripLayoutW > 0 &&
            Math.round(tabsStripContentW) > Math.round(tabsStripLayoutW) + 2,
        [tabsStripLayoutW, tabsStripContentW]
    );
    const settingsModalScrollMaxHeight = useMemo(
        () => Math.max(240, Math.round(windowHeight * 0.8 - 64)),
        [windowHeight]
    );

    useEffect(() => {
        loadData();
    }, [user?.handle]);

    useEffect(() => {
        setIsPrivate(getEffectiveProfilePrivate(user?.handle, user?.is_private));
    }, [user?.handle, user?.is_private]);

    useFocusEffect(
        React.useCallback(() => {
            void loadData();
            // Do not auto-open security phone prompt when entering Passport.
            setSecurityModalOpen(false);
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
                    toValue: 5,
                    duration: 420,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(tabsHintAnim, {
                    toValue: 0,
                    duration: 420,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.delay(1100),
            ])
        );
        if (showTabsHint && tabsStripOverflow) loop.start();
        return () => loop.stop();
    }, [showTabsHint, tabsStripOverflow, tabsHintAnim]);

    /** One-time horizontal jog — matches web profile rail so users notice overflow */
    useEffect(() => {
        if (!showTabsHint || !tabsStripOverflow || tabsHintNudgeDoneRef.current) return;
        if (tabsStripLayoutW <= 0 || Math.round(tabsStripContentW) <= Math.round(tabsStripLayoutW) + 2)
            return;
        const t = setTimeout(() => {
            const el = tabsScrollRef.current;
            if (!el) return;
            tabsHintNudgeDoneRef.current = true;
            tabsAutoNudgingRef.current = true;
            el.scrollTo({ x: 28, animated: true });
            setTimeout(() => {
                el.scrollTo({ x: 0, animated: true });
                setTimeout(() => {
                    tabsAutoNudgingRef.current = false;
                }, 200);
            }, 340);
        }, 500);
        return () => clearTimeout(t);
    }, [showTabsHint, tabsStripOverflow, tabsStripLayoutW, tabsStripContentW]);

    const closeSecurityModal = React.useCallback(() => {
        setSecurityModalOpen(false);
        setSecurityStep('phone');
        setSecurityBusy(false);
        setPhoneCountryCode('+353');
        setPhoneInput('');
        setOtpInput('');
        setPendingPhoneNumber('');
    }, []);

    const loadData = async () => {
        if (!user?.handle) return;
        setLoading(true);
        try {
            const [userPosts, userCollections, userDrafts, followingHandles] = await Promise.all([
                fetchPostsByUser(user.handle, 50),
                getUserCollections(user.id || 'me'),
                getDrafts().catch(() => []),
                user?.id ? getFollowedUsers(String(user.id)).catch(() => []) : Promise.resolve([]),
            ]);
            setPosts(userPosts);
            setCollections(userCollections);
            setDrafts(userDrafts);

            let followers = user?.followers_count ?? 0;
            if (isLaravelApiEnabled()) {
                try {
                    const res: any = await fetchFollowers(user.handle, 0, 200);
                    const list = Array.isArray(res?.data) ? res.data : res?.followers ?? [];
                    followers = list.length;
                } catch {
                    followers = user?.followers_count ?? 0;
                }
            }
            setAudienceCounts({
                followers,
                following: followingHandles.length,
            });
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
            showProfileAlert({ title: 'Could not add comment', message: 'Please try again.', icon: 'alert' });
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
            showProfileAlert({ title: 'Could not add reply', message: 'Please try again.', icon: 'alert' });
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

    const handleOpenPostFromCommentSafety = React.useCallback(
        (postId: string) => {
            const post = posts.find((p) => String(p.id) === String(postId));
            if (!post) {
                showProfileAlert({ title: 'Post not found in your feed', icon: 'alert' });
                return;
            }
            setCommentSafetyOpen(false);
            navigation.navigate('PostDetail', { postId: post.id });
        },
        [navigation, posts, showProfileAlert]
    );

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
            const interval = setInterval(updateUnreadCount, getInboxUnreadPollMs());
            return () => clearInterval(interval);
        }
    }, [user?.handle]);

    const loadCollections = async () => {
        if (!user?.id) return;
        try {
            const userCollections = await getUserCollections(user.id);
            setCollections(userCollections);
        } catch (error) {
            console.error('Error loading collections:', error);
        }
    };

    useEffect(() => {
        if (collectionsOpen) setBrokenCollectionThumbs({});
    }, [collectionsOpen]);

    useEffect(() => {
        if (!user?.id) return undefined;
        const uid = String(user.id).trim();
        const sub = DeviceEventEmitter.addListener(
            'collectionsUpdated',
            (evt?: { userId?: string }) => {
                if (String(evt?.userId ?? '').trim() !== uid) return;
                void (async () => {
                    try {
                        const next = await getUserCollections(uid);
                        setCollections(next);
                    } catch (error) {
                        console.error('Error refreshing collections after save:', error);
                    }
                })();
            }
        );
        return () => sub.remove();
    }, [user?.id]);

    const handleDeleteDraft = async (draftId: string) => {
        try {
            await deleteDraft(draftId);
            await loadData();
        } catch (error) {
            console.error('Error deleting draft:', error);
            showProfileAlert({ title: 'Error', message: 'Failed to delete draft', icon: 'alert' });
        }
    };

    const handleLogout = () => {
        showProfileAlert({
            title: 'Logout',
            message: 'Are you sure you want to logout?',
            icon: 'alert',
            showCancelButton: true,
            confirmButtonText: 'Logout',
            cancelButtonText: 'Cancel',
            onConfirm: () => {
                setProfileAlert(null);
                logout();
                navigation.replace('Login');
            },
        });
    };

    const applyPrivacyState = (newPrivacyState: boolean) => {
        if (!user) return;

        const updatedUser = { ...user, is_private: newPrivacyState };
        setIsPrivate(newPrivacyState);
        login(updatedUser as any);

        try {
            if (user.handle) {
                setProfilePrivacy(user.handle, newPrivacyState);
            }
        } catch (error) {
            console.warn('Failed to save privacy locally:', error);
        }

        setProfileAlert({
            title: newPrivacyState ? 'Profile Set to Private' : 'Profile Set to Public',
            message: newPrivacyState
                ? 'Your profile is now private. Only approved followers can view your profile and send you messages.'
                : 'Your profile is now public. Anyone can view your profile and send you messages.',
            icon: 'success',
            confirmButtonText: 'Done',
        });

        if (isLaravelApiEnabled()) {
            void updateAuthProfile({ is_private: newPrivacyState } as any).catch((syncError) => {
                console.warn('Failed to sync privacy setting to backend, keeping local state:', syncError);
            });
        }
    };

    const handleTogglePrivacy = () => {
        if (isTogglingPrivacy || !user) return;

        const newPrivacyState = !isPrivate;

        if (!newPrivacyState) {
            setProfileAlert({
                title: 'Set Profile to Public?',
                message: 'Your posts and stories will still be public on locations news feed.',
                showCancelButton: true,
                confirmButtonText: 'Set to Public',
                cancelButtonText: 'Cancel',
                onConfirm: () => {
                    applyPrivacyState(false);
                    setIsTogglingPrivacy(false);
                },
            });
            return;
        }

        setIsTogglingPrivacy(true);
        applyPrivacyState(true);
        setIsTogglingPrivacy(false);
    };

    const handleSendSecurityCode = async () => {
        if (securityBusy) return;
        const digits = phoneInput.replace(/\D+/g, '');
        if (digits.length < 7 || digits.length > 15) {
            showProfileAlert({ title: 'Invalid number', message: 'Enter a valid phone number.', icon: 'alert' });
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
                showProfileAlert({ title: 'Demo code', message: `Use PIN ${res.debug_code}`, icon: 'info' });
            } else {
                showProfileAlert({
                    title: 'Code sent',
                    message: `A verification code was sent to ${fullPhone}.`,
                    icon: 'success',
                });
            }
        } catch (error: any) {
            showProfileAlert({
                title: 'Send failed',
                message: error?.message || 'Could not send verification code.',
                icon: 'alert',
            });
        } finally {
            setSecurityBusy(false);
        }
    };

    const handleVerifySecurityCode = async () => {
        if (securityBusy) return;
        const code = otpInput.replace(/\D+/g, '');
        if (code.length !== 6) {
            showProfileAlert({ title: 'Invalid code', message: 'Enter the 6-digit code.', icon: 'alert' });
            return;
        }
        setSecurityBusy(true);
        try {
            await verifyPhoneVerificationCode(pendingPhoneNumber, code);
            setSecurityModalOpen(false);
            showProfileAlert({ title: 'Verified', message: 'Phone verification complete.', icon: 'success' });
        } catch (error: any) {
            showProfileAlert({
                title: 'Verification failed',
                message: error?.message || 'Incorrect code. Try again.',
                icon: 'alert',
            });
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
                showProfileAlert({
                    title: 'Facebook login failed',
                    message: 'No access token returned.',
                    icon: 'alert',
                });
                setInviteSyncing(false);
                return;
            }

            await linkFacebookAccount(accessToken);
            const matches = await fetchFacebookFriendsMatches(accessToken);
            setInviteMatchedFriends(matches.matched || []);
            showProfileAlert({
                title: 'Facebook synced',
                message: matches.matched_count
                    ? `Found ${matches.matched_count} friend${matches.matched_count === 1 ? '' : 's'}.`
                    : (matches.message || 'No matched Facebook friends yet.'),
                icon: 'success',
            });
        } catch (error: any) {
            showProfileAlert({
                title: 'Sync failed',
                message: error?.message || 'Could not sync Facebook friends right now.',
                icon: 'alert',
            });
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
                showProfileAlert({
                    title: 'Permission needed',
                    message: 'Allow contacts permission to sync your contacts.',
                    icon: 'alert',
                });
                return;
            }

            const deviceContacts = await Contacts.getAll();
            const phones = deviceContacts
                .flatMap((c: any) => Array.isArray(c.phoneNumbers) ? c.phoneNumbers : [])
                .map((p: any) => String(p?.number || '').trim())
                .filter(Boolean);
            if (!phones.length) {
                showProfileAlert({
                    title: 'No contacts found',
                    message: 'No phone numbers were found on this device.',
                    icon: 'alert',
                });
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
            showProfileAlert({
                title: 'Contacts matched',
                message: result.matched_count
                    ? `Matched ${result.matched_count} contact${result.matched_count === 1 ? '' : 's'}.`
                    : 'No matched contacts yet.',
                icon: 'success',
            });
        } catch (error: any) {
            showProfileAlert({
                title: 'Match failed',
                message: error?.message || 'Could not match contacts right now.',
                icon: 'alert',
            });
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
        showProfileAlert({
            title: 'Invite link copied',
            message: 'Your profile link was copied to clipboard.',
            icon: 'success',
        });
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
            <GazetteerScreenShell ambientVariant="passport" contentStyle={styles.loadingShell}>
                <ActivityIndicator size="large" color="#f472b6" />
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell ambientVariant="passport" style={styles.passportShell}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => setShowProfilePictureModal(true)}
                    accessibilityLabel="Change profile picture"
                    style={styles.headerAvatarBtn}
                >
                    <Avatar
                        src={user?.avatarUrl}
                        name={user?.name || 'User'}
                        size={ox(32)}
                    />
                    <View style={styles.headerAvatarBadge}>
                        <Icon name="add" size={ox(14)} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>
                    {user?.name || 'Passport'}
                </Text>
                <TouchableOpacity
                    onPress={handleTogglePrivacy}
                    disabled={isTogglingPrivacy}
                    accessibilityLabel={isPrivate ? 'Make profile public' : 'Make profile private'}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={isTogglingPrivacy ? styles.headerPrivacyBtnDisabled : undefined}
                >
                    <Icon
                        name={isPrivate ? 'lock-closed' : 'lock-open'}
                        size={ox(24)}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>
            </View>

            <ProfilePictureModal
                visible={showProfilePictureModal}
                onClose={() => setShowProfilePictureModal(false)}
            />

            {/* Tabs: Messages, Drafts, Collections, Comment Safety, Settings */}
            <View style={styles.tabsWrap} collapsable={false}>
                {/*
                  Fixed cue column (flex sibling) — avoids Android drawing ScrollView above overlays.
                */}
                <View style={styles.tabsRailShell} collapsable={false}>
                    <ScrollView
                        ref={tabsScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        removeClippedSubviews={false}
                        style={styles.tabsScrollFlex}
                        contentContainerStyle={styles.tabsContentContainer}
                        fadingEdgeLength={Platform.OS === 'android' ? 32 : undefined}
                        onLayout={(e) => setTabsStripLayoutW(e.nativeEvent.layout.width)}
                        onContentSizeChange={(w) => setTabsStripContentW(w)}
                        onScroll={(e) => {
                            if (tabsAutoNudgingRef.current) return;
                            if (e.nativeEvent.contentOffset.x > 8) setShowTabsHint(false);
                        }}
                        scrollEventThrottle={16}
                    >
                <TouchableOpacity
                    style={[styles.tab, styles.tabInvite]}
                    onPress={() => setInviteFriendsOpen(true)}
                >
                    <Icon name="people-outline" size={ox(20)} color="#A5F3FC" />
                    <Text style={[styles.tabLabel, styles.tabLabelCyan]}>Invite Friends</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, styles.tabChip]}
                    onPress={() => setMyFeedOpen(true)}
                >
                    <Icon name="newspaper-outline" size={ox(20)} color="#F3F4F6" />
                    <Text style={styles.tabLabel}>My feed</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, styles.tabChip]}
                    onPress={() => navigation.navigate('ProfileCover')}
                >
                    <Icon name="image-outline" size={ox(20)} color="#F3F4F6" />
                    <Text style={styles.tabLabel}>Cover</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, styles.tabNewGroup]}
                    onPress={() => setCreateGroupOpen(true)}
                >
                    <Icon name="people" size={ox(20)} color="#A5F3FC" />
                    <Text style={[styles.tabLabel, styles.tabLabelCyan]}>New group</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, styles.tabChip]}
                    onPress={() => navigateMainTab(navigation, 'Inbox')}
                >
                    <Icon name="mail" size={ox(20)} color="#FFFFFF" />
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
                    style={[styles.tab, styles.tabChip]}
                    onPress={() => setDraftsOpen(true)}
                >
                    <Icon name="document-text" size={ox(20)} color="#FFFFFF" />
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
                    style={[styles.tab, styles.tabChip]}
                    onPress={() => {
                        loadCollections();
                        setCollectionsOpen(true);
                    }}
                >
                    <Icon name="bookmark" size={ox(20)} color="#FFFFFF" />
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
                    style={[styles.tab, styles.tabCommentSafety]}
                    onPress={() => {
                        setSettingsOpen(false);
                        setCommentSafetyOpen(true);
                    }}
                >
                    <Icon name="shield-checkmark" size={ox(20)} color="#FBBF24" />
                    <Text style={styles.tabLabel}>Comment Safety</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, styles.tabSecurity]}
                    onPress={() => {
                        setSettingsOpen(false);
                        setCommentSafetyOpen(false);
                        setSecurityStep('phone');
                        setSecurityModalOpen(true);
                    }}
                >
                    <Icon name="shield-checkmark-outline" size={ox(20)} color="#6EE7B7" />
                    <Text style={styles.tabLabelSecurity}>Security</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, styles.tabChip]}
                    onPress={() => {
                        setCommentSafetyOpen(false);
                        setSettingsOpen(true);
                    }}
                >
                    <Icon name="settings" size={ox(20)} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Settings</Text>
                </TouchableOpacity>
                    </ScrollView>

                    {tabsStripOverflow ? (
                        <View style={styles.tabsCueColumn} pointerEvents="box-none" collapsable={false}>
                            <LinearGradient
                                pointerEvents="none"
                                colors={['rgba(3,7,18,0)', '#030712']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />

                            {showTabsHint ? (
                                <Animated.View
                                    pointerEvents="none"
                                    style={[styles.tabsHintChipColumn, { transform: [{ translateY: tabsHintAnim }] }]}
                                    collapsable={false}
                                >
                                    <Text style={styles.tabsHintTextColumn}>Swipe</Text>
                                    <Text style={styles.tabsHintChevron}>›</Text>
                                </Animated.View>
                            ) : (
                                <View pointerEvents="none" style={styles.tabsMoreCue} collapsable={false}>
                                    <Text style={styles.tabsMoreCueGlyph}>›</Text>
                                </View>
                            )}
                        </View>
                    ) : null}
                </View>
            </View>

            <ScrollView
                style={styles.profileScroll}
                contentContainerStyle={styles.profileScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
            >
            <ProfileCoverHero
                coverUrl={user?.profileBackgroundUrl}
                avatarUrl={user?.avatarUrl}
                name={user?.name || user?.handle || 'User'}
                showChangeCover
                onPressChangeCover={() => navigation.navigate('ProfileCover')}
                onAvatarPress={() => setShowProfilePictureModal(true)}
            />

            <View style={styles.profileSection}>
                <View style={styles.profileInfo}>
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
                        <Text style={styles.statNumber}>{audienceCounts.followers}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{audienceCounts.following}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                </View>

                <ProfilePassportCards
                    navigation={navigation}
                    isPrivate={isPrivate}
                    onPressPhoto={() => setShowProfilePictureModal(true)}
                    onPressCover={() => navigation.navigate('ProfileCover')}
                />
            </View>

            <View style={styles.postsSection}>
                <View style={styles.postsHeader}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('posts')}
                        style={[styles.postsTab, activeTab === 'posts' && styles.postsTabActive]}
                    >
                        <Icon 
                            name="grid" 
                            size={ox(20)} 
                            color={activeTab === 'posts' ? "#f472b6" : "#6B7280"} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('collections')}
                        style={[styles.postsTab, activeTab === 'collections' && styles.postsTabActive]}
                    >
                        <Icon 
                            name="bookmark" 
                            size={ox(20)} 
                            color={activeTab === 'collections' ? "#f472b6" : "#6B7280"} 
                        />
                    </TouchableOpacity>
                </View>

                {activeTab === 'posts' ? (
                    posts.length === 0 ? (
                        <View style={styles.postsEmptyState}>
                            <Text style={styles.emptyText}>No posts yet</Text>
                        </View>
                    ) : (
                        <View style={styles.postsGrid}>
                            {posts.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                                    style={styles.postItem}
                                >
                                    <ProfileGridThumb post={item} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )
                ) : collections.length === 0 ? (
                    <View style={styles.postsEmptyState}>
                        <Text style={styles.emptyText}>No collections yet</Text>
                    </View>
                ) : (
                    <View style={styles.collectionsList}>
                        {collections.map((item) => {
                            const thumbSrc = getCollectionThumbnailUrl(item, posts);
                            const firstPost = item.postIds?.length
                                ? posts.find((p) => p.id === item.postIds[0])
                                : undefined;
                            const textFallback = firstPost?.text || firstPost?.caption || firstPost?.text_content;
                            const thumbBroken = !!brokenCollectionThumbs[item.id];
                            const postCount = item.postIds?.length || 0;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.collectionItem}
                                    onPress={() => navigation.navigate('CollectionFeed', {
                                        collectionId: item.id,
                                        collectionName: item.name,
                                    })}
                                >
                                    {firstPost ? (
                                        <View style={styles.collectionThumbnailWrap}>
                                            <ProfileGridThumb post={firstPost} />
                                        </View>
                                    ) : thumbSrc && !thumbBroken ? (
                                        <Image
                                            source={{ uri: thumbSrc }}
                                            style={styles.collectionThumbnail}
                                            onError={() =>
                                                setBrokenCollectionThumbs((prev) => ({ ...prev, [item.id]: true }))
                                            }
                                        />
                                    ) : postCount > 0 && textFallback ? (
                                        <View style={[styles.collectionThumbnail, styles.collectionThumbnailTextFallback]}>
                                            <Text style={styles.collectionThumbnailText} numberOfLines={4}>
                                                {textFallback.length > 80 ? `${textFallback.slice(0, 80)}…` : textFallback}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.collectionThumbnailPlaceholder}>
                                            <Icon name="bookmark" size={ox(24)} color="#6B7280" />
                                        </View>
                                    )}
                                    <View style={styles.collectionInfo}>
                                        <Text style={styles.collectionName}>{item.name}</Text>
                                        <Text style={styles.collectionCount}>
                                            {postCount} {postCount === 1 ? 'post' : 'posts'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>
            </ScrollView>

            <Modal
                visible={securityModalOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={closeSecurityModal}
            >
                <View style={styles.securityOverlay}>
                    <View style={styles.securityCard}>
                        <View style={styles.securityCardHeader}>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={closeSecurityModal} style={styles.securityCloseButton}>
                                <Icon name="close" size={ox(22)} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                        {securityStep === 'phone' ? (
                            <>
                                <Text style={styles.securityTitle}>Add phone</Text>
                                <View style={styles.securityWhatsAppBadge}>
                                    <Icon name="logo-whatsapp" size={ox(14)} color="#DCFCE7" />
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
                                <TouchableOpacity
                                    style={styles.securitySecondaryButton}
                                    onPress={closeSecurityModal}
                                    disabled={securityBusy}
                                >
                                    <Text style={styles.securitySecondaryButtonText}>Not now</Text>
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
                                <TouchableOpacity
                                    style={styles.securitySecondaryButton}
                                    onPress={closeSecurityModal}
                                    disabled={securityBusy}
                                >
                                    <Text style={styles.securitySecondaryButtonText}>Cancel</Text>
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
                                <Icon name="close" size={ox(18)} color="#D1D5DB" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.inviteOption}
                            onPress={handleSyncFacebookFriends}
                            disabled={inviteSyncing}
                        >
                            <View style={styles.inviteOptionRow}>
                                <Icon name="logo-facebook" size={ox(16)} color="#60A5FA" />
                                <Text style={styles.inviteOptionTitle}>{inviteSyncing ? 'Syncing Facebook...' : 'Find Facebook Friends'}</Text>
                            </View>
                            <Text style={styles.inviteOptionBody}>Sync friends who connected with your app.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.inviteOption}
                            onPress={handleShareInviteToWhatsApp}
                        >
                            <View style={styles.inviteOptionRow}>
                                <Icon name="logo-whatsapp" size={ox(16)} color="#86EFAC" />
                                <Text style={styles.inviteOptionTitle}>Share to WhatsApp</Text>
                            </View>
                            <Text style={styles.inviteOptionBody}>Share the Gazetteer app with friends.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.inviteOption}
                            onPress={handleShareInviteToMessenger}
                        >
                            <View style={styles.inviteOptionRow}>
                                <Icon name="chatbubble-ellipses" size={ox(16)} color="#60A5FA" />
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
                                <Icon name="qr-code-outline" size={ox(16)} color="#D1D5DB" />
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
                                                if (!user?.id || !user?.handle) {
                                                    showProfileAlert({
                                                        title: 'Sign in required',
                                                        message: 'Log in to follow people.',
                                                        icon: 'alert',
                                                    });
                                                    return;
                                                }
                                                try {
                                                    const { followOrRequest } = await import('../utils/followOrRequest');
                                                    const result = await followOrRequest({
                                                        userId: String(user.id),
                                                        targetHandle: friend.handle,
                                                        viewerHandle: user.handle,
                                                        nextFollowing: true,
                                                    });
                                                    showProfileAlert({
                                                        title: result.requested
                                                            ? 'Follow Request Sent'
                                                            : result.following
                                                              ? 'Followed'
                                                              : 'Updated',
                                                        message: friend.handle,
                                                        icon: 'success',
                                                    });
                                                } catch {
                                                    showProfileAlert({
                                                        title: 'Error',
                                                        message: 'Could not follow right now.',
                                                        icon: 'alert',
                                                    });
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
                                <Icon name="close" size={ox(24)} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {drafts.length > 0 ? (
                                drafts.map((draft) => (
                                    <View key={draft.id} style={styles.draftItem}>
                                        {(draft.videoPosterUrl || draft.videoUrl) && !draft.isTextOnly ? (
                                            <Image
                                                source={{ uri: draft.videoPosterUrl || draft.videoUrl }}
                                                style={styles.draftThumb}
                                            />
                                        ) : null}
                                        <TouchableOpacity
                                            style={styles.draftInfo}
                                            onPress={() => {
                                                setDraftsOpen(false);
                                                if (draft.isTextOnly) {
                                                    navigation.navigate('TextOnlyCreate', {
                                                        text: draft.textBody || draft.caption || '',
                                                        fromDraft: true,
                                                        location: draft.location || '',
                                                        venue: draft.venue || '',
                                                        landmark: draft.landmark || '',
                                                        taggedUsers: draft.taggedUsers || [],
                                                        textTemplateId: draft.textTemplateId || undefined,
                                                    });
                                                    return;
                                                }
                                                const resumeFilter =
                                                    !draft.filterBaked &&
                                                    draft.filterActive &&
                                                    draft.filterActive !== 'None'
                                                        ? buildFilterInfo(draft.filterActive as InstantFilterName)
                                                        : undefined;
                                                navigation.navigate('CreateComposer', {
                                                    mediaUrl: draft.videoUrl || undefined,
                                                    mediaType: draft.mediaType || (draft.videoUrl ? 'video' : undefined),
                                                    draftCaption: draft.caption || '',
                                                    draftTextBody: draft.textBody || '',
                                                    draftLocation: draft.location || '',
                                                    draftVenue: draft.venue || '',
                                                    draftLandmark: draft.landmark || '',
                                                    draftTaggedUsers: draft.taggedUsers || [],
                                                    videoDuration: draft.videoDuration ?? 0,
                                                    videoCoverTime: draft.videoCoverTime ?? 0,
                                                    filterInfo: resumeFilter,
                                                    filtered: !!resumeFilter,
                                                    draftFilterActive: draft.filterActive,
                                                    draftFilterBaked: draft.filterBaked,
                                                    draftStickers: draft.stickers || [],
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
                                            <Icon name="trash" size={ox(20)} color="#EF4444" />
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
                                <Icon name="close" size={ox(24)} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {collections.length > 0 ? (
                                collections.map((collection) => {
                                    const postCount = collection.postIds?.length || 0;
                                    const thumbSrc = getCollectionThumbnailUrl(collection, posts);
                                    const firstPost = collection.postIds?.length
                                        ? posts.find((p) => p.id === collection.postIds[0])
                                        : undefined;
                                    const textFallback = firstPost?.text || firstPost?.caption || firstPost?.text_content;
                                    const thumbBroken = !!brokenCollectionThumbs[collection.id];
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
                                            {thumbSrc && !thumbBroken ? (
                                                <Image
                                                    source={{ uri: thumbSrc }}
                                                    style={styles.collectionModalThumbnail}
                                                    onError={() =>
                                                        setBrokenCollectionThumbs((prev) => ({
                                                            ...prev,
                                                            [collection.id]: true,
                                                        }))
                                                    }
                                                />
                                            ) : postCount > 0 && textFallback ? (
                                                <View style={[styles.collectionModalThumbnail, styles.collectionThumbnailTextFallback]}>
                                                    <Text style={styles.collectionThumbnailText} numberOfLines={4}>
                                                        {textFallback.length > 80 ? `${textFallback.slice(0, 80)}…` : textFallback}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={styles.collectionModalThumbnailPlaceholder}>
                                                    <Icon name="bookmark" size={ox(24)} color="#6B7280" />
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
                            <Icon name="close" size={ox(22)} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={posts}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.myFeedListContent}
                        renderItem={({ item }) => (
                            <FeedCard
                                post={item}
                                isCurrentUser
                                viewerHandle={user?.handle}
                                viewerUserId={user?.id}
                                onLike={async () => {
                                    if (!user?.id) return;
                                    const updated = await toggleLike(user.id, item.id, item);
                                    setPosts((prev) => prev.map((p) => (p.id === item.id ? updated : p)));
                                }}
                                onView={async () => {
                                    if (!user?.id) return;
                                    await incrementViews(user.id, item.id);
                                }}
                                onComment={() => void openMyFeedComments(item)}
                                onShare={async () => {
                                    setMyFeedSharePost(item);
                                }}
                                onReclip={async () => {}}
                                onBookmark={async () => {
                                    setMyFeedSavePost(item);
                                }}
                                onOverflowPress={() => {
                                    setMyFeedOverflowPost(item);
                                    setMyFeedOverflowVisible(true);
                                    void getCollectionsForPost(user?.id || 'anon', item.id).then((cols) =>
                                        setMyFeedOverflowSaved(cols.length > 0),
                                    );
                                    void hasPostNotificationsPrefMobile(user?.id || 'anon', item.id).then(
                                        setMyFeedOverflowNotify,
                                    );
                                }}
                                onPostPress={() =>
                                    navigation.navigate('PostDetail', { postId: item.id })
                                }
                                onShareToStoriesSuccess={(postId) => {
                                    setPosts((prev) =>
                                        prev.map((p) =>
                                            p.id === postId
                                                ? {
                                                      ...p,
                                                      stats: {
                                                          ...p.stats,
                                                          shares: (p.stats?.shares ?? 0) + 1,
                                                      },
                                                  }
                                                : p,
                                        ),
                                    );
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

            <PostOverflowMenuModal
                visible={myFeedOverflowVisible}
                post={myFeedOverflowPost}
                viewerUserId={user?.id || 'anon'}
                viewerHandle={user?.handle}
                isSaved={myFeedOverflowSaved}
                hasNotifications={myFeedOverflowNotify}
                onClose={() => {
                    setMyFeedOverflowVisible(false);
                    setMyFeedOverflowPost(null);
                }}
                onOpenSave={() => myFeedOverflowPost && setMyFeedSavePost(myFeedOverflowPost)}
                onShare={async () => {
                    if (!myFeedOverflowPost) return;
                    setMyFeedSharePost(myFeedOverflowPost);
                }}
                onBoost={() => {
                    setMyFeedOverflowVisible(false);
                    navigation.navigate('Boost');
                }}
                onEdit={() => myFeedOverflowPost && setMyFeedEditPost(myFeedOverflowPost)}
                onCreateGroup={() => setMyFeedCreateGroupOpen(true)}
                onArchive={async () => {
                    if (!myFeedOverflowPost || !user?.id) return;
                    await markFeedPostArchivedMobile(user.id, myFeedOverflowPost.id);
                    setPosts((prev) => prev.filter((p) => p.id !== myFeedOverflowPost.id));
                }}
                onToggleNotifications={async () => {
                    if (!myFeedOverflowPost || !user?.id) return;
                    const next = !myFeedOverflowNotify;
                    await setPostNotificationsPrefMobile(user.id, myFeedOverflowPost.id, next);
                    setMyFeedOverflowNotify(next);
                }}
                onDelete={() =>
                    new Promise<void>((resolve) => {
                        if (!myFeedOverflowPost || !user?.handle) {
                            resolve();
                            return;
                        }
                        showProfileAlert({
                            title: 'Delete post?',
                            message: 'This cannot be undone.',
                            icon: 'alert',
                            showCancelButton: true,
                            confirmButtonText: 'Delete',
                            cancelButtonText: 'Cancel',
                            onConfirm: () => {
                                setProfileAlert(null);
                                void (async () => {
                                    try {
                                        await deletePost(user.id, myFeedOverflowPost.id, user.handle);
                                        setPosts((prev) =>
                                            prev.filter((p) => p.id !== myFeedOverflowPost.id),
                                        );
                                    } finally {
                                        resolve();
                                    }
                                })();
                            },
                            onDismiss: () => resolve(),
                        });
                    })
                }
            />

            {myFeedSavePost ? (
                <SavePostModal
                    post={myFeedSavePost}
                    userId={user?.id || 'anon'}
                    visible={!!myFeedSavePost}
                    onClose={() => setMyFeedSavePost(null)}
                    onSaved={async () => {
                        const cols = await getCollectionsForPost(user?.id || 'anon', myFeedSavePost.id);
                        const saved = cols.length > 0;
                        setPosts((prev) =>
                            prev.map((p) =>
                                p.id === myFeedSavePost.id ? { ...p, isBookmarked: saved } : p,
                            ),
                        );
                    }}
                />
            ) : null}

            {myFeedEditPost ? (
                <EditPostModal
                    post={myFeedEditPost}
                    visible={!!myFeedEditPost}
                    onClose={() => setMyFeedEditPost(null)}
                    onSave={async (text, location, venue, landmark) => {
                        await apiUpdatePost(myFeedEditPost.id, {
                            text,
                            location,
                            venue: venue || undefined,
                            landmark: landmark || undefined,
                        });
                        setPosts((prev) =>
                            prev.map((p) =>
                                p.id === myFeedEditPost.id
                                    ? {
                                          ...p,
                                          text,
                                          caption: text,
                                          locationLabel: location,
                                          venue,
                                          landmark,
                                      }
                                    : p,
                            ),
                        );
                    }}
                />
            ) : null}

            {myFeedQrPost ? (
                <QRCodeModal post={myFeedQrPost} visible={!!myFeedQrPost} onClose={() => setMyFeedQrPost(null)} />
            ) : null}

            <CreateGroupModal
                visible={createGroupOpen}
                onClose={() => setCreateGroupOpen(false)}
                onCreated={(g) => {
                    setCreateGroupOpen(false);
                    navigation.navigate('Messages', {
                        chatGroupId: g.id,
                        kind: 'group',
                        groupName: g.name,
                    });
                    setProfileAlert({
                        title: `You're in “${g.name}”`,
                        message:
                            'Tap + in the header to invite people, or use their profile → Invite to group.',
                        icon: 'success',
                        confirmButtonText: 'Done',
                    });
                }}
            />

            <CreateGroupModal
                visible={myFeedCreateGroupOpen}
                onClose={() => setMyFeedCreateGroupOpen(false)}
                onCreated={(g) => {
                    setMyFeedCreateGroupOpen(false);
                    navigation.navigate('Messages', { chatGroupId: g.id, kind: 'group' });
                }}
            />

            <FeedShareModal
                post={myFeedSharePost || ({} as Post)}
                isOpen={!!myFeedSharePost}
                onClose={() => setMyFeedSharePost(null)}
                onShareSuccess={(postId) => {
                    setPosts((prev) =>
                        prev.map((p) =>
                            p.id === postId
                                ? {
                                      ...p,
                                      stats: {
                                          ...p.stats,
                                          shares: (p.stats?.shares ?? 0) + 1,
                                      },
                                  }
                                : p,
                        ),
                    );
                }}
            />

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
                                <Icon name="close" size={ox(24)} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.myFeedCommentsModalBody}>
                            {myFeedCommentsLoading ? (
                                <ActivityIndicator size="small" color="#f472b6" />
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
                                <Icon name="close" size={ox(24)} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            style={[styles.settingsModalScroll, { maxHeight: settingsModalScrollMaxHeight }]}
                            contentContainerStyle={styles.settingsModalBody}
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                        >
                            <View style={styles.safetySection}>
                                <Text style={styles.safetySectionTitle}>Content preferences</Text>
                                <Text style={styles.toggleDescription}>Edit preferred locations for feed suggestions</Text>
                                <TouchableOpacity
                                    style={[styles.smallActionButton, { alignSelf: 'flex-start', marginTop: ox(10) }]}
                                    onPress={() => {
                                        setSettingsOpen(false);
                                        navigation.navigate('ContentPreferences');
                                    }}
                                >
                                    <Text style={styles.smallActionButtonText}>Open preferences</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.safetySection}>
                                <Text style={styles.safetySectionTitle}>Stories</Text>
                                <Text style={styles.toggleDescription}>
                                    Photo, video, text, and poll stories (Clip studio)
                                </Text>
                                <TouchableOpacity
                                    style={[styles.smallActionButton, { alignSelf: 'flex-start', marginTop: ox(10) }]}
                                    onPress={() => {
                                        setSettingsOpen(false);
                                        navigation.navigate('Clip');
                                    }}
                                >
                                    <Text style={styles.smallActionButtonText}>Create story</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.safetySection}>
                                <Text style={styles.safetySectionTitle}>Video playback</Text>
                                <Text style={styles.toggleDescription}>
                                    Feed autoplay and default mute for videos
                                </Text>
                                <TouchableOpacity
                                    style={[styles.smallActionButton, { alignSelf: 'flex-start', marginTop: ox(10) }]}
                                    onPress={() => {
                                        setSettingsOpen(false);
                                        navigation.navigate('VideoPlaybackSettings');
                                    }}
                                >
                                    <Text style={styles.smallActionButtonText}>Playback settings</Text>
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
                                        onPress={handleTogglePrivacy}
                                        disabled={isTogglingPrivacy}
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
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <CommentSafetyModal
                visible={commentSafetyOpen}
                onClose={() => setCommentSafetyOpen(false)}
                ownerHandle={user?.handle}
                onOpenPost={handleOpenPostFromCommentSafety}
                showAlert={showProfileAlert}
            />

            <GazetteerAlertSheet
                visible={profileAlert !== null}
                title={profileAlert?.title ?? ''}
                message={profileAlert?.message}
                icon={profileAlert?.icon}
                confirmButtonText={profileAlert?.confirmButtonText ?? 'OK'}
                cancelButtonText={profileAlert?.cancelButtonText ?? 'Cancel'}
                showCancelButton={profileAlert?.showCancelButton ?? false}
                onConfirm={() => {
                    if (profileAlert?.onConfirm) {
                        profileAlert.onConfirm();
                        return;
                    }
                    dismissProfileAlert();
                }}
                onDismiss={dismissProfileAlert}
            />
        </GazetteerScreenShell>
    );
};

const styles = StyleSheet.create({
    passportShell: {
        backgroundColor: 'transparent',
    },
    loadingShell: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        borderBottomWidth: 1,
        borderBottomColor: profilePassportDivider,
        backgroundColor: 'transparent',
        gap: ox(12),
    },
    headerAvatarBtn: {
        position: 'relative',
        width: ox(32),
        height: ox(32),
    },
    headerAvatarBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: ox(18),
        height: ox(18),
        borderRadius: ox(9),
        backgroundColor: '#f472b6',
        borderWidth: 2,
        borderColor: '#030712',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontSize: ox(20),
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    headerPrivacyBtnDisabled: {
        opacity: 0.45,
    },
    profileSection: {
        paddingHorizontal: profilePassportScrollInset,
        paddingVertical: ox(16),
    },
    profileInfo: {
        marginBottom: ox(16),
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        fontSize: ox(19),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    userHandle: {
        fontSize: ox(15),
        color: '#9CA3AF',
        marginTop: ox(2),
    },
    userBio: {
        fontSize: ox(13),
        color: '#D1D5DB',
        marginTop: ox(4),
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: ox(16),
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: ox(18),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: ox(14),
        color: '#9CA3AF',
        marginTop: ox(2),
    },
    editButton: {
        backgroundColor: '#1F2937',
        paddingVertical: ox(9),
        paddingHorizontal: ox(20),
        borderRadius: ox(9),
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    editButtonText: {
        fontSize: ox(15),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    profileScroll: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    profileScrollContent: {
        flexGrow: 1,
        paddingBottom: ox(24),
        backgroundColor: 'transparent',
    },
    postsSection: {
        backgroundColor: 'transparent',
    },
    postsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    collectionsList: {},
    postsEmptyState: {
        alignItems: 'center',
        paddingVertical: ox(32),
        paddingHorizontal: ox(16),
    },
    postsHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: ox(12),
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        gap: ox(32),
    },
    postsTab: {
        paddingHorizontal: ox(20),
        paddingVertical: ox(8),
    },
    postsTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#f472b6',
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
        padding: ox(16),
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    collectionName: {
        fontSize: ox(16),
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: ox(4),
    },
    collectionCount: {
        fontSize: ox(14),
        color: '#9CA3AF',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(40),
    },
    emptyText: {
        fontSize: ox(16),
        color: '#6B7280',
    },
    tabsWrap: {
        position: 'relative',
        overflow: 'visible',
        borderTopWidth: 1,
        borderTopColor: profilePassportDivider,
    },
    /** ScrollView + fixed cue column (Android-safe — no z-order fights with ScrollView) */
    tabsRailShell: {
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
        minHeight: ox(66),
    },
    tabsScrollFlex: {
        flex: 1,
        maxHeight: 66,
    },
    tabsContentContainer: {
        flexDirection: 'row',
        paddingVertical: ox(12),
        paddingHorizontal: ox(8),
        paddingRight: ox(10),
        columnGap: ox(8),
    },
    tabsCueColumn: {
        width: ox(48),
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        minHeight: ox(44),
        paddingHorizontal: ox(14),
        paddingVertical: ox(8),
        borderRadius: ox(12),
        gap: ox(8),
    },
    tabChip: {
        borderWidth: 1,
        borderColor: profilePassportChipBorder,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    tabInvite: {
        borderWidth: 1,
        borderColor: 'rgba(103, 232, 249, 0.4)',
        backgroundColor: 'rgba(22, 78, 99, 0.3)',
    },
    tabCommentSafety: {
        borderWidth: 1,
        borderColor: 'rgba(252, 211, 77, 0.4)',
        backgroundColor: 'rgba(120, 53, 15, 0.3)',
    },
    tabSecurity: {
        borderWidth: 1,
        borderColor: 'rgba(110, 231, 183, 0.4)',
        backgroundColor: 'rgba(6, 78, 59, 0.3)',
    },
    tabLabelSecurity: {
        fontSize: ox(12),
        color: '#D1FAE5',
        fontWeight: '600',
    },
    tabLabel: {
        fontSize: ox(12),
        color: '#F3F4F6',
        fontWeight: '600',
    },
    tabNewGroup: {
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.35)',
        backgroundColor: 'rgba(8, 51, 68, 0.4)',
    },
    tabLabelCyan: {
        color: '#A5F3FC',
        fontWeight: '600',
    },
    tabsHintChipColumn: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(2),
        paddingHorizontal: ox(8),
        paddingVertical: ox(8),
        borderRadius: ox(14),
        backgroundColor: 'rgba(15,23,42,0.96)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
    },
    tabsHintTextColumn: {
        color: '#F3F4F6',
        fontSize: ox(10),
        fontWeight: '800',
        letterSpacing: ox(0.3),
    },
    tabsHintChevron: {
        color: '#FFFFFF',
        fontSize: ox(18),
        fontWeight: '800',
        marginTop: ox(-2),
        includeFontPadding: false,
    },
    /** After user scrolls: always-visible “more” arrow (fixed column — never under ScrollView) */
    tabsMoreCue: {
        width: ox(36),
        height: ox(38),
        borderRadius: ox(19),
        backgroundColor: 'rgba(217, 27, 92, 0.35)',
        borderWidth: 1.5,
        borderColor: 'rgba(244, 114, 182, 0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabsMoreCueGlyph: {
        color: '#FFFFFF',
        fontSize: ox(26),
        fontWeight: '800',
        marginLeft: 3,
        marginTop: ox(-3),
        includeFontPadding: false,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: 0,
        backgroundColor: '#EF4444',
        borderRadius: ox(10),
        minWidth: ox(20),
        height: ox(20),
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: ox(4),
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: ox(10),
        fontWeight: 'bold',
    },
    collectionThumbnail: {
        width: ox(64),
        height: ox(64),
        borderRadius: ox(8),
        backgroundColor: '#111827',
    },
    collectionThumbnailWrap: {
        width: ox(64),
        height: ox(64),
        borderRadius: ox(8),
        backgroundColor: '#111827',
        overflow: 'hidden',
    },
    collectionThumbnailPlaceholder: {
        width: ox(64),
        height: ox(64),
        borderRadius: ox(8),
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionThumbnailTextFallback: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: ox(6),
        overflow: 'hidden',
    },
    collectionThumbnailText: {
        fontSize: ox(10),
        color: '#D1D5DB',
        textAlign: 'center',
    },
    collectionInfo: {
        flex: 1,
        marginLeft: 12,
    },
    myFeedScreen: {
        flex: 1,
        backgroundColor: GAZETTEER_ABYSS,
    },
    myFeedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(14),
        paddingVertical: ox(10),
        ...gazetteerHeader,
    },
    myFeedHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    myFeedLogo: {
        width: ox(32),
        height: ox(32),
        borderRadius: ox(8),
        marginRight: 8,
    },
    myFeedTitle: {
        fontSize: ox(22),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    myFeedCloseButton: {
        borderRadius: ox(999),
        padding: ox(8),
        ...glassSurface,
    },
    myFeedListContent: {
        padding: ox(12),
        rowGap: ox(12),
        paddingBottom: ox(28),
    },
    myFeedCard: {
        borderRadius: ox(16),
        overflow: 'hidden',
        ...glassPanel,
    },
    myFeedCardHeader: {
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        rowGap: ox(8),
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
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#0F172A',
        paddingHorizontal: ox(8),
        paddingVertical: ox(4),
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(4),
        maxWidth: '100%',
    },
    myFeedLocationText: {
        color: '#BFDBFE',
        fontSize: ox(11),
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
        marginTop: ox(8),
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    myFeedTextCard: {
        paddingHorizontal: ox(14),
        paddingVertical: ox(16),
        ...glassSurface,
    },
    myFeedTextCardText: {
        color: '#FFFFFF',
        fontSize: ox(15),
        lineHeight: ox(22),
    },
    myFeedCaptionWrap: {
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
    },
    myFeedCaptionText: {
        color: '#E5E7EB',
        fontSize: ox(13),
        lineHeight: ox(20),
    },
    myFeedStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        columnGap: ox(12),
    },
    myFeedStatPill: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(4),
    },
    myFeedStatText: {
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(11, 7, 17, 0.82)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        overflow: 'hidden',
        ...glassPanel,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: ox(16),
        ...gazetteerHeader,
    },
    modalTitle: {
        fontSize: ox(20),
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalBody: {
        paddingHorizontal: ox(14),
        paddingVertical: ox(12),
    },
    settingsModalScroll: {
        flexGrow: 0,
        flexShrink: 1,
    },
    settingsModalBody: {
        paddingHorizontal: ox(14),
        paddingTop: ox(12),
        paddingBottom: ox(28),
    },
    myFeedCommentsModalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        overflow: 'hidden',
        ...glassPanel,
    },
    myFeedCommentsModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: ox(16),
        ...gazetteerHeader,
    },
    myFeedCommentsModalBody: {
        paddingHorizontal: ox(14),
        paddingVertical: ox(12),
    },
    draftItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        padding: ox(12),
        borderRadius: ox(12),
        marginBottom: ox(12),
        ...glassSurface,
    },
    draftThumb: {
        width: ox(52),
        height: ox(52),
        borderRadius: ox(8),
        backgroundColor: '#111827',
    },
    draftInfo: {
        flex: 1,
    },
    draftDate: {
        fontSize: ox(12),
        color: '#9CA3AF',
        marginBottom: ox(4),
    },
    draftText: {
        fontSize: ox(14),
        color: '#FFFFFF',
    },
    deleteButton: {
        padding: ox(8),
    },
    collectionModalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: ox(16),
        borderRadius: ox(12),
        marginBottom: ox(12),
        ...glassSurface,
    },
    collectionModalThumbnail: {
        width: ox(64),
        height: ox(64),
        borderRadius: ox(8),
        backgroundColor: '#111827',
    },
    collectionModalThumbnailPlaceholder: {
        width: ox(64),
        height: ox(64),
        borderRadius: ox(8),
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionModalInfo: {
        flex: 1,
        marginLeft: 12,
    },
    collectionModalName: {
        fontSize: ox(16),
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: ox(4),
    },
    collectionModalCount: {
        fontSize: ox(14),
        color: '#9CA3AF',
    },
    logoutButton: {
        backgroundColor: '#EF4444',
        paddingVertical: ox(12),
        paddingHorizontal: ox(24),
        borderRadius: ox(8),
        alignItems: 'center',
    },
    logoutButtonText: {
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '600',
    },
    safetySection: {
        borderRadius: ox(10),
        padding: ox(11),
        marginBottom: ox(10),
        ...glassSurface,
    },
    safetySectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ox(10),
    },
    safetySectionTitle: {
        fontSize: ox(15),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    smallActionButton: {
        backgroundColor: '#374151',
        borderRadius: ox(8),
        paddingHorizontal: ox(10),
        paddingVertical: ox(6),
    },
    smallActionButtonText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ox(12),
    },
    toggleInfo: {
        flex: 1,
        paddingRight: ox(10),
    },
    toggleLabel: {
        fontSize: ox(14),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    toggleDescription: {
        marginTop: ox(2),
        fontSize: ox(12),
        color: '#9CA3AF',
    },
    toggleTrack: {
        width: ox(46),
        height: ox(26),
        borderRadius: ox(13),
        backgroundColor: '#374151',
        justifyContent: 'center',
        paddingHorizontal: ox(3),
    },
    toggleTrackActive: {
        backgroundColor: '#d91b5c',
    },
    toggleThumb: {
        width: ox(20),
        height: ox(20),
        borderRadius: ox(10),
        backgroundColor: '#FFFFFF',
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },
    inputLabel: {
        fontSize: ox(13),
        color: '#D1D5DB',
        marginBottom: ox(8),
    },
    wordInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(8),
    },
    myFeedCommentsList: {
        maxHeight: 260,
        marginBottom: ox(12),
    },
    myFeedCommentItem: {
        paddingVertical: ox(8),
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    myFeedEditedBadge: {
        alignSelf: 'flex-start',
        marginBottom: ox(4),
        paddingHorizontal: ox(6),
        paddingVertical: ox(2),
        borderRadius: ox(999),
        backgroundColor: '#1E3A8A',
        color: '#DBEAFE',
        fontSize: ox(10),
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    myFeedCommentAuthor: {
        color: '#FFFFFF',
        fontSize: ox(13),
        fontWeight: '700',
        marginBottom: ox(2),
    },
    myFeedCommentText: {
        color: '#D1D5DB',
        fontSize: ox(13),
        lineHeight: ox(18),
    },
    myFeedCommentTime: {
        marginTop: ox(3),
        color: '#9CA3AF',
        fontSize: ox(11),
    },
    myFeedCommentActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(14),
        marginTop: ox(6),
    },
    myFeedCommentActionText: {
        color: '#93C5FD',
        fontSize: ox(12),
        fontWeight: '600',
    },
    myFeedReplyList: {
        marginTop: ox(8),
        paddingLeft: ox(10),
        borderLeftWidth: 1,
        borderLeftColor: '#374151',
        rowGap: ox(6),
    },
    myFeedReplyItem: {},
    myFeedReplyAuthor: {
        color: '#E5E7EB',
        fontSize: ox(12),
        fontWeight: '700',
    },
    myFeedReplyText: {
        color: '#CBD5E1',
        fontSize: ox(12),
        lineHeight: ox(17),
    },
    myFeedReplyTime: {
        marginTop: ox(2),
        color: '#94A3B8',
        fontSize: ox(10),
    },
    myFeedReplyActionText: {
        marginTop: ox(3),
        color: '#93C5FD',
        fontSize: ox(11),
        fontWeight: '600',
    },
    myFeedCommentInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(8),
    },
    myFeedCommentInput: {
        flex: 1,
        borderRadius: ox(8),
        paddingHorizontal: ox(10),
        paddingVertical: ox(8),
        color: '#FFFFFF',
        fontSize: ox(13),
        ...glassSearch,
    },
    wordInput: {
        flex: 1,
        borderRadius: ox(8),
        paddingHorizontal: ox(10),
        paddingVertical: ox(8),
        color: '#FFFFFF',
        fontSize: ox(13),
        ...glassSearch,
    },
    addWordButton: {
        backgroundColor: '#d91b5c',
        borderRadius: ox(8),
        paddingHorizontal: ox(12),
        paddingVertical: ox(9),
    },
    addWordButtonText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '700',
    },
    sheetActionsRow: {
        marginTop: ox(14),
        flexDirection: 'row',
        justifyContent: 'flex-end',
        columnGap: ox(8),
    },
    wordChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: ox(6),
        rowGap: ox(6),
        marginTop: ox(10),
    },
    wordChip: {
        borderRadius: ox(999),
        paddingHorizontal: ox(10),
        paddingVertical: ox(5),
        ...glassSurface,
    },
    wordChipText: {
        fontSize: ox(11),
        color: '#E5E7EB',
    },
    queueCountText: {
        fontSize: ox(12),
        color: '#FBBF24',
        fontWeight: '600',
    },
    filterPillsRow: {
        flexDirection: 'row',
        columnGap: ox(8),
        marginBottom: ox(10),
    },
    filterPill: {
        borderRadius: ox(999),
        paddingHorizontal: ox(10),
        paddingVertical: ox(5),
        ...glassSurface,
    },
    filterPillActive: {
        ...chipActiveMagenta,
    },
    filterPillText: {
        fontSize: ox(11),
        color: '#9CA3AF',
        fontWeight: '600',
    },
    filterPillTextActive: {
        ...chipActiveMagentaText,
    },
    queueItem: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(8),
        borderRadius: ox(8),
        padding: ox(10),
        marginBottom: ox(8),
        ...glassSurface,
    },
    queueItemAuthor: {
        fontSize: ox(12),
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: ox(3),
    },
    queueItemText: {
        fontSize: ox(12),
        color: '#D1D5DB',
    },
    queueActions: {
        flexDirection: 'row',
        columnGap: ox(6),
    },
    queueActionBtn: {
        borderRadius: ox(6),
        paddingHorizontal: ox(8),
        paddingVertical: ox(6),
        ...glassSurface,
    },
    queueActionBtnDanger: {
        borderColor: '#7F1D1D',
        backgroundColor: '#450A0A',
    },
    queueActionText: {
        color: '#E5E7EB',
        fontSize: ox(11),
        fontWeight: '600',
    },
    queueActionTextDanger: {
        color: '#FCA5A5',
    },
    securityOverlay: {
        flex: 1,
        backgroundColor: 'rgba(11, 7, 17, 0.82)',
        justifyContent: 'center',
        paddingHorizontal: ox(18),
    },
    securityCard: {
        borderRadius: ox(16),
        padding: ox(16),
        ...glassPanel,
    },
    securityCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: ox(4),
    },
    securityCloseButton: {
        padding: ox(4),
    },
    securityTitle: {
        color: '#FFFFFF',
        fontSize: ox(28),
        fontWeight: '700',
        marginBottom: ox(10),
    },
    securityBody: {
        color: '#D1D5DB',
        fontSize: ox(14),
        lineHeight: ox(20),
        marginBottom: ox(12),
    },
    securityWhatsAppBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(8),
        backgroundColor: '#052E16',
        borderWidth: 1,
        borderColor: '#166534',
        borderRadius: ox(10),
        paddingHorizontal: ox(10),
        paddingVertical: ox(8),
        marginBottom: ox(10),
    },
    securityWhatsAppBadgeText: {
        color: '#BBF7D0',
        fontSize: ox(12),
        fontWeight: '600',
        flex: 1,
    },
    securityPhoneRow: {
        flexDirection: 'row',
        columnGap: ox(8),
        marginBottom: ox(12),
    },
    securityCountryInput: {
        width: ox(92),
        borderRadius: ox(10),
        color: '#FFFFFF',
        paddingHorizontal: ox(10),
        paddingVertical: ox(10),
        ...glassSearch,
    },
    securityPhoneInput: {
        flex: 1,
        borderRadius: ox(10),
        color: '#FFFFFF',
        paddingHorizontal: ox(10),
        paddingVertical: ox(10),
        ...glassSearch,
    },
    securityCodeInput: {
        borderRadius: ox(10),
        color: '#FFFFFF',
        paddingHorizontal: ox(12),
        paddingVertical: ox(12),
        fontSize: ox(18),
        letterSpacing: ox(6),
        textAlign: 'center',
        marginBottom: ox(12),
        ...glassSearch,
    },
    securityPrimaryButton: {
        backgroundColor: '#d91b5c',
        borderRadius: ox(999),
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: ox(12),
    },
    securityPrimaryButtonDisabled: {
        opacity: 0.6,
    },
    securityPrimaryButtonText: {
        color: '#FFFFFF',
        fontSize: ox(15),
        fontWeight: '700',
    },
    securitySecondaryButton: {
        marginTop: ox(10),
        borderRadius: ox(999),
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    securitySecondaryButtonText: {
        color: '#D1D5DB',
        fontSize: ox(15),
        fontWeight: '600',
    },
    inviteHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ox(8),
    },
    inviteCloseBtn: {
        width: ox(30),
        height: ox(30),
        borderRadius: ox(15),
        alignItems: 'center',
        justifyContent: 'center',
        ...glassSurface,
    },
    inviteOption: {
        borderRadius: ox(12),
        paddingHorizontal: ox(12),
        paddingVertical: ox(12),
        marginBottom: ox(10),
        ...glassSurface,
    },
    inviteOptionTitle: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
        marginBottom: ox(2),
    },
    inviteOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(8),
        marginBottom: ox(2),
    },
    inviteOptionBody: {
        color: '#9CA3AF',
        fontSize: ox(12),
    },
    inviteMatchesWrap: {
        marginTop: ox(4),
    },
    inviteMatchesLabel: {
        color: '#9CA3AF',
        fontSize: ox(11),
        fontWeight: '700',
        marginBottom: ox(8),
        textTransform: 'uppercase',
    },
    inviteMatchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: ox(10),
        borderRadius: ox(10),
        paddingHorizontal: ox(10),
        paddingVertical: ox(8),
        marginBottom: ox(8),
        ...glassSurface,
    },
    inviteMatchTitle: {
        color: '#FFFFFF',
        fontSize: ox(13),
        fontWeight: '700',
    },
    inviteMatchHandle: {
        color: '#9CA3AF',
        fontSize: ox(11),
        marginTop: ox(2),
    },
    inviteFollowBtn: {
        backgroundColor: '#d91b5c',
        borderRadius: ox(999),
        paddingHorizontal: ox(12),
        paddingVertical: ox(6),
    },
    inviteFollowBtnText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '700',
    },
});

export default ProfileScreen;
