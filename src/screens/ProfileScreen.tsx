import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import ProfileCoverHero from '../components/ProfileCoverHero.native';
import { useStoryRingState } from '../hooks/useHasActiveStories';
import AccountTypeBadge from '../components/AccountTypeBadge.native';
import { navigateMainTab } from '../navigation/mainTabs';
import {
    chipActiveMagenta,
    chipActiveMagentaText,
    glassPanel,
    glassSearch,
    glassSurface,
    gazetteerHeader,
    profilePassportDivider,
    profilePassportChipBorder,
    profilePassportScrollInset,
    UCL_CANVAS_NAVY,
    UCL_SHEET_GRADIENT,
    UCL_SHEET_GRADIENT_LOCATIONS,
    UEFA_PASSPORT_GRADIENT,
    UEFA_PASSPORT_GRADIENT_LOCATIONS,
    UEFA_GLASS_BG,
    UEFA_GLASS_BORDER,
    UEFA_CYAN,
    UEFA_ROYAL_BLUE_END,
} from '../theme/gazetteerAmbientNative';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { setActiveFeedVideoPostId } from '../utils/feedActiveVideoNative';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, getFollowedUsers, reclipPost } from '../api/posts';
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
import { updateAuthProfile, sendPhoneVerificationCode, verifyPhoneVerificationCode, linkFacebookAccount, fetchFacebookFriendsMatches, getCurrentUser, mapLaravelUserToAppFields, type FacebookMatchedFriend, matchContactPhones } from '../api/client';
import type { Post, Collection } from '../types';
import Avatar from '../components/Avatar';
import CreateGroupModal from '../components/CreateGroupModal.native';
import MyFeedModal from '../components/MyFeedModal.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import { buildShareablePostUrl } from '../utils/shareUrls';
import ProfileGridThumb from '../components/ProfileGridThumb.native';
import ProfilePassportCards, { type ProfileCardId } from '../components/ProfilePassportCards.native';
import ProfilePictureModal from '../components/ProfilePictureModal.native';
import CommentSafetyModal from '../components/CommentSafetyModal.native';
import {
    getNotificationPreferences,
    loadNotificationPreferences,
    saveNotificationPreferences,
    saveNotificationPreferencesAsync,
    resetNotificationPreferences,
    type NotificationPreferences,
} from '../services/notifications';
import { getRuntimeEnv, getReactNativeDefaultApiBaseUrl, isLaravelApiEnabled } from '../config/runtimeEnv';
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
    const ownRing = useStoryRingState(user?.handle || '', {
        viewerId: user?.id != null ? String(user.id) : undefined,
        isCurrentUser: true,
    });
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
    const closeMyFeed = useCallback(() => setMyFeedOpen(false), []);
    const handleMyFeedPostUpdated = useCallback((updated: Post) => {
        setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }, []);
    const handleMyFeedPostRemoved = useCallback((postId: string) => {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
    }, []);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);
    const [openPassportCardRequest, setOpenPassportCardRequest] = useState<ProfileCardId | null>(null);
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

    /** The mount effect above already runs the first load; the focus effect skips its
     *  first pass and refreshes silently afterwards, so a focus never double-fetches or
     *  flips the loading skeleton over an already-rendered profile. */
    const profileFirstFocusRef = React.useRef(true);

    // Hydrate Push Notification toggles from AsyncStorage (survive restarts in mock mode).
    useEffect(() => {
        let cancelled = false;
        void loadNotificationPreferences().then((prefs) => {
            if (!cancelled) setNotificationPrefs(prefs);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Repair sessions created before Auth.login persisted accountType.
    useEffect(() => {
        if (!user?.email || user.accountType === 'business' || user.accountType === 'personal') return;
        let cancelled = false;
        void (async () => {
            try {
                const raw = await AsyncStorage.getItem('gazetteer_local_registrations_rn');
                if (!raw || cancelled) return;
                const reg = JSON.parse(raw) as Record<string, { userData?: { accountType?: string } }>;
                const rec = reg[String(user.email).trim().toLowerCase()];
                const t = rec?.userData?.accountType;
                if (t !== 'business' && t !== 'personal') return;
                if (cancelled) return;
                login({ ...user, accountType: t });
            } catch {
                // ignore repair failures
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.email, user?.accountType, login, user]);

    useEffect(() => {
        setIsPrivate(getEffectiveProfilePrivate(user?.handle, user?.is_private));
    }, [user?.handle, user?.is_private]);

    useFocusEffect(
        React.useCallback(() => {
            // Grid tiles are stills only — kill leftover feed ExoPlayer audio so Passport
            // does not sound like the tiles themselves are playing.
            setActiveFeedVideoPostId(null);
            // Refresh silently on return. A synchronous setLoading(true) here wiped the
            // already-rendered profile and blocked the native transition; the mount effect
            // above already covered the first load, so skip this pass.
            if (!profileFirstFocusRef.current) {
                void loadData({ silent: true });
            }
            profileFirstFocusRef.current = false;
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

    const loadData = async (opts?: { silent?: boolean }) => {
        if (!user?.handle && !user?.id) return;
        // Silent refresh (focus returns) must not blank out the rendered profile.
        if (!opts?.silent) {
            setLoading(true);
        }
        try {
            const identifier = String(user.handle || user.id);
            const userPosts = await fetchPostsByUser(identifier, 50, user.id, 'all');
            setPosts(userPosts);
        } catch (error) {
            console.error('Error loading profile posts:', error);
        } finally {
            setLoading(false);
        }

        try {
            const [userCollections, userDrafts, followingHandles] = await Promise.all([
                getUserCollections(user.id || 'me').catch((err) => {
                    console.error('Error loading collections:', err);
                    return [] as Collection[];
                }),
                getDrafts().catch((err) => {
                    console.error('Error loading drafts:', err);
                    return [];
                }),
                user?.id
                    ? getFollowedUsers(String(user.id)).catch((err) => {
                          console.error('Error loading following list:', err);
                          return [] as string[];
                      })
                    : Promise.resolve([] as string[]),
            ]);
            setCollections(userCollections);
            setDrafts(userDrafts);

            let followers = typeof user?.followers_count === 'number' ? user.followers_count : 0;
            let following = typeof user?.following_count === 'number' ? user.following_count : 0;
            if (isLaravelApiEnabled() && user?.handle) {
                try {
                    // Single authoritative source: live counts from /auth/me (backend recomputes
                    // from the follow graph). This keeps the header and the Audience card in sync.
                    const me = await getCurrentUser();
                    const counts = mapLaravelUserToAppFields(me as Record<string, unknown>);
                    if (typeof counts.followers_count === 'number') followers = counts.followers_count;
                    if (typeof counts.following_count === 'number') following = counts.following_count;
                } catch (err) {
                    console.error('Error loading audience counts:', err);
                    if (followingHandles.length > 0) following = followingHandles.length;
                }
            } else if (followingHandles.length > 0) {
                following = followingHandles.length;
            }
            setAudienceCounts({
                followers,
                following,
            });
        } catch (error) {
            console.error('Error loading profile extras:', error);
        }
    };

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

    const renderProfileGridItem = useCallback(
        ({ item }: { item: Post }) => (
            <TouchableOpacity
                style={styles.postItem}
                activeOpacity={0.85}
                onPress={() =>
                    navigation.navigate('PostDetail', {
                        postId: item.id,
                        initialPost: item,
                    })
                }
            >
                <ProfileGridThumb post={item} />
            </TouchableOpacity>
        ),
        [navigation],
    );

    const profileGridKeyExtractor = useCallback((item: Post) => String(item.id), []);

    if (loading) {
        return (
            <GazetteerScreenShell ambient={false} style={styles.passportShell}>
                <LinearGradient
                    colors={[...UEFA_PASSPORT_GRADIENT]}
                    locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.passportCanvas, styles.loadingShell]}
                >
                    <ActivityIndicator size="large" color={UEFA_CYAN} />
                </LinearGradient>
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell ambient={false} style={styles.passportShell}>
            {/* Page canvas only — UEFA Champions League vibrant royal blue gradient. */}
            <LinearGradient
                colors={[...UEFA_PASSPORT_GRADIENT]}
                locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.passportCanvas}
            >
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
            <TouchableOpacity
                onPress={() => setOpenPassportCardRequest('name')}
                accessibilityLabel="Edit display name"
                style={styles.headerNameBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={styles.title} numberOfLines={1}>
                    {user?.name || 'Passport'}
                </Text>
                <Icon name="create-outline" size={ox(16)} color={UEFA_CYAN} />
            </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleTogglePrivacy}
                    disabled={isTogglingPrivacy}
                    accessibilityLabel={isPrivate ? 'Make profile public' : 'Make profile private'}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={[isTogglingPrivacy ? styles.headerPrivacyBtnDisabled : undefined, styles.headerGlassBtn]}
                >
                    <Icon
                        name={isPrivate ? 'lock-closed' : 'lock-open'}
                        size={ox(22)}
                        color={UEFA_CYAN}
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

            <FlatList
                data={activeTab === 'posts' ? posts : []}
                keyExtractor={profileGridKeyExtractor}
                numColumns={3}
                style={styles.profileScroll}
                contentContainerStyle={styles.profileScrollContent}
                keyboardShouldPersistTaps="handled"
                extraData={activeTab}
                initialNumToRender={12}
                maxToRenderPerBatch={6}
                windowSize={5}
                renderItem={renderProfileGridItem}
                ListHeaderComponent={
                    <>
            <ProfileCoverHero
                coverUrl={user?.profileBackgroundUrl}
                avatarUrl={user?.avatarUrl}
                name={user?.name || user?.handle || 'User'}
                hasStory={ownRing.hasStory}
                storyRingState={ownRing.state}
                showChangeCover
                onPressChangeCover={() => navigation.navigate('ProfileCover')}
                onAvatarPress={() => setShowProfilePictureModal(true)}
            />

            <View style={styles.profileSection}>
                <View style={styles.profileInfoCentered}>
                    <View style={styles.userInfoCentered}>
                        <Text style={styles.userName}>{user?.name || user?.handle}</Text>
                        <Text style={styles.userHandle}>{user?.handle}</Text>
                        {user?.accountType === 'business' ? (
                            <View style={styles.accountBadgeWrapCentered}>
                                <AccountTypeBadge accountType="business" compact />
                            </View>
                        ) : null}
                        {user?.bio && (
                            <Text style={styles.userBioCentered}>{user.bio}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statItemGlass}>
                        <Text style={styles.statNumber}>{posts.length}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statItemGlass}>
                        <Text style={styles.statNumber}>{audienceCounts.followers}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statItemGlass}>
                        <Text style={styles.statNumber}>{audienceCounts.following}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                </View>

                <ProfilePassportCards
                    navigation={navigation}
                    isPrivate={isPrivate}
                    onPressPhoto={() => setShowProfilePictureModal(true)}
                    onPressCover={() => navigation.navigate('ProfileCover')}
                    openCardRequest={openPassportCardRequest}
                    onOpenCardRequestHandled={() => setOpenPassportCardRequest(null)}
                    followersCount={audienceCounts.followers}
                    followingCount={audienceCounts.following}
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
                            color={activeTab === 'posts' ? UEFA_CYAN : "#94A3B8"} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('collections')}
                        style={[styles.postsTab, activeTab === 'collections' && styles.postsTabActive]}
                    >
                        <Icon 
                            name="bookmark" 
                            size={ox(20)} 
                            color={activeTab === 'collections' ? UEFA_CYAN : "#94A3B8"} 
                        />
                    </TouchableOpacity>
                </View>

                {activeTab === 'collections' ? (
                    collections.length === 0 ? (
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
                    )
                ) : null}
            </View>
                    </>
                }
                ListEmptyComponent={
                    activeTab === 'posts' ? (
                        <View style={styles.postsEmptyState}>
                            <Text style={styles.emptyText}>No posts yet</Text>
                        </View>
                    ) : null
                }
            />

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

            <MyFeedModal
                visible={myFeedOpen}
                onClose={closeMyFeed}
                posts={posts}
                navigation={navigation}
                onPostUpdated={handleMyFeedPostUpdated}
                onPostRemoved={handleMyFeedPostRemoved}
            />

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
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            style={styles.smallActionButton}
                                            onPress={() => {
                                                void (async () => {
                                                    try {
                                                        const { seedInboxTestNotifications } = await import(
                                                            '../utils/testNotifications'
                                                        );
                                                        const n = await seedInboxTestNotifications();
                                                        const prefs = getNotificationPreferences();
                                                        setNotificationPrefs(prefs);
                                                        showProfileAlert({
                                                            title: 'Inbox badge test',
                                                            message: `Added ${n} unread notifications. Check the footer Inbox icon.`,
                                                            icon: 'success',
                                                            confirmButtonText: 'OK',
                                                        });
                                                    } catch (err) {
                                                        showProfileAlert({
                                                            title: 'Could not seed notifications',
                                                            message:
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : 'Try again after signing in.',
                                                            icon: 'alert',
                                                            confirmButtonText: 'OK',
                                                        });
                                                    }
                                                })();
                                            }}
                                        >
                                            <Text style={styles.smallActionButtonText}>Test badge</Text>
                                        </TouchableOpacity>
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
                                            void saveNotificationPreferencesAsync(next);
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
                                                        void saveNotificationPreferencesAsync(next);
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
            </LinearGradient>
        </GazetteerScreenShell>
    );
};

    const styles = StyleSheet.create({
        passportShell: {
            backgroundColor: UEFA_ROYAL_BLUE_END,
        },
        passportCanvas: {
            flex: 1,
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
        borderBottomColor: UEFA_GLASS_BORDER,
        backgroundColor: 'transparent',
        gap: ox(12),
    },
    headerGlassBtn: {
        width: ox(38),
        height: ox(38),
        borderRadius: ox(19),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: UEFA_GLASS_BG,
        borderWidth: 1,
        borderColor: UEFA_GLASS_BORDER,
    },
    headerAvatarBtn: {
        position: 'relative',
        width: ox(32),
        height: ox(32),
        shadowColor: UEFA_CYAN,
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    headerAvatarBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: ox(18),
        height: ox(18),
        borderRadius: ox(9),
        backgroundColor: UEFA_CYAN,
        borderWidth: 2,
        borderColor: '#020B26',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flexShrink: 1,
        fontSize: ox(20),
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    headerNameBtn: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(6),
        paddingHorizontal: ox(4),
    },
    headerPrivacyBtnDisabled: {
        opacity: 0.45,
    },
    profileSection: {
        paddingHorizontal: profilePassportScrollInset,
        paddingVertical: ox(16),
    },
    profileInfoCentered: {
        marginBottom: ox(16),
        alignItems: 'center',
    },
    userInfoCentered: {
        alignItems: 'center',
    },
    userName: {
        fontSize: ox(20),
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    userHandle: {
        fontSize: ox(15),
        color: '#D1E4FF',
        marginTop: ox(2),
        textAlign: 'center',
    },
    accountBadgeWrapCentered: {
        marginTop: ox(8),
    },
    userBioCentered: {
        fontSize: ox(13),
        color: '#FFFFFF',
        marginTop: ox(6),
        textAlign: 'center',
        opacity: 0.9,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: ox(10),
        marginBottom: ox(16),
    },
    statItemGlass: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: ox(12),
        borderRadius: ox(14),
        backgroundColor: UEFA_GLASS_BG,
        borderWidth: 1,
        borderColor: UEFA_GLASS_BORDER,
    },
    statNumber: {
        fontSize: ox(18),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: ox(13),
        color: '#D1E4FF',
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
        borderTopColor: UEFA_GLASS_BORDER,
        gap: ox(32),
    },
    postsTab: {
        paddingHorizontal: ox(20),
        paddingVertical: ox(8),
    },
    postsTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: UEFA_CYAN,
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
