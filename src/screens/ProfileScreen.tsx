import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { approveHiddenComment, deleteHiddenComment, fetchHiddenCommentsForOwner, fetchPostsByUser, type HiddenCommentReviewItem } from '../api/posts';
import { getUserCollections } from '../api/collections';
import { getDrafts, deleteDraft, type Draft } from '../api/drafts';
import { getUnreadTotal } from '../api/messages';
import { setProfilePrivacy } from '../api/privacy';
import { updateAuthProfile, sendPhoneVerificationCode, verifyPhoneVerificationCode } from '../api/client';
import type { Post, Collection } from '../types';
import Avatar from '../components/Avatar';
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
            setSecurityModalOpen(true);
            setSecurityStep('phone');
            setSecurityBusy(false);
            setPhoneCountryCode('+353');
            setPhoneInput('');
            setOtpInput('');
            setPendingPhoneNumber('');
        }, [])
    );

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
            <View style={styles.tabsContainer}>
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
    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    tab: {
        alignItems: 'center',
        position: 'relative',
        paddingHorizontal: 12,
    },
    tabLabel: {
        fontSize: 12,
        color: '#FFFFFF',
        marginTop: 4,
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
});

export default ProfileScreen;
