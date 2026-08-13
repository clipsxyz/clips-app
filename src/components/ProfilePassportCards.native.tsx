import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import Avatar from './Avatar.native';
import Flag from './Flag.native';
import PlaceAutocompleteField from './PlaceAutocompleteField.native';
import { fetchFollowers, mapLaravelUserToAppFields, updateAuthProfile } from '../api/client';
import { getFollowedUsers } from '../api/posts';
import { getAvatarForHandle } from '../api/users';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { fetchCitiesForRegion, fetchRegionsForCountry } from '../utils/googleMaps';
import { parsedPlaceFeedFromSuggestion } from '../utils/placeFeedLevels';
import type { LocationSuggestion } from '../api/locations';
import type { User } from '../types';
import {
    profilePassportCard,
    profilePassportEditHub,
    profilePassportQuickAction,
    profileCardIconSurface,
    profilePassportCardsInset,
    profilePassportCardGap,
    profilePassportScrollInset,
} from '../theme/gazetteerAmbientNative';

export type ProfileCardId =
    | 'bio'
    | 'social'
    | 'personal'
    | 'location'
    | 'interests'
    | 'flag'
    | 'followers'
    | 'following';

const PROFILE_CARD_IMAGES: Partial<Record<ProfileCardId, number>> = {
    followers: require('../assets/profile-cards/followers.png'),
    following: require('../assets/profile-cards/following.png'),
    bio: require('../assets/profile-cards/bio.png'),
    social: require('../assets/profile-cards/social-links.png'),
    personal: require('../assets/profile-cards/travel-info.png'),
    location: require('../assets/profile-cards/location.png'),
    interests: require('../assets/profile-cards/interests.png'),
};

type Props = {
    navigation: any;
    isPrivate?: boolean;
    onPressPhoto?: () => void;
    onPressCover?: () => void;
};

const FLAG_ISO_OPTIONS = ['IE', 'GB', 'FR', 'ES', 'IT', 'DE', 'PT', 'NL', 'US', 'CA', 'BR', 'MX', 'AU', 'NZ', 'JP', 'CN', 'IN', 'PK', 'ZA', 'KE', 'EG', 'TR', 'RU', 'UA'];

const NATIONAL_OPTIONS = [
    'Ireland', 'United Kingdom', 'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Portugal', 'Greece',
    'Poland', 'Sweden', 'Austria', 'Switzerland', 'Denmark', 'Finland', 'Norway', 'United States', 'Canada', 'Mexico',
    'Brazil', 'Argentina', 'Australia', 'New Zealand', 'Japan', 'China', 'India', 'South Africa', 'Kenya', 'Nigeria',
];

function normalizeHandle(handle: string) {
    return handle.replace(/^@/, '').trim();
}

function ProfileCardImage({ cardId, icon }: { cardId: ProfileCardId; icon: string }) {
    const imageSource = PROFILE_CARD_IMAGES[cardId];
    const [imageFailed, setImageFailed] = useState(false);
    const showImage = Boolean(imageSource) && !imageFailed;

    return (
        <View style={styles.cardIconWrap}>
            {showImage ? (
                <Image
                    source={imageSource}
                    style={styles.cardImage}
                    resizeMode="contain"
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <Icon name={icon} size={24} color="#4B5563" />
            )}
        </View>
    );
}

function ProfileCardButton({
    cardId,
    icon,
    title,
    subtitle,
    count,
    cardWidth,
    onPress,
}: {
    cardId: ProfileCardId;
    icon: string;
    title: string;
    subtitle?: string;
    count?: number;
    cardWidth: number;
    onPress: () => void;
}) {
    return (
        <Pressable style={{ width: cardWidth }} onPress={onPress}>
            {({ pressed }) => (
                <View style={[styles.card, pressed && styles.cardPressed]}>
                    <ProfileCardImage cardId={cardId} icon={icon} />
                    <Text style={styles.cardTitle}>{title}</Text>
                    {typeof count === 'number' ? (
                        <Text style={styles.cardCount}>{count}</Text>
                    ) : subtitle ? (
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
            )}
        </Pressable>
    );
}

function SelectRow({
    label,
    value,
    placeholder,
    options,
    loading,
    disabled,
    onSelect,
    allowManual,
    manualValue,
    onManualChange,
}: {
    label: string;
    value: string;
    placeholder: string;
    options: string[];
    loading?: boolean;
    disabled?: boolean;
    onSelect: (v: string) => void;
    allowManual?: boolean;
    manualValue?: string;
    onManualChange?: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.toLowerCase().includes(q));
    }, [filter, options]);

    return (
        <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TouchableOpacity
                style={[styles.selectTrigger, disabled && styles.selectTriggerDisabled]}
                onPress={() => !disabled && setOpen((v) => !v)}
                disabled={disabled}
            >
                <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
                    {value || placeholder}
                </Text>
                {loading ? (
                    <ActivityIndicator size="small" color="#9CA3AF" />
                ) : (
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
                )}
            </TouchableOpacity>
            {open && !disabled ? (
                <View style={styles.selectPanel}>
                    {options.length > 8 ? (
                        <TextInput
                            style={styles.selectFilter}
                            value={filter}
                            onChangeText={setFilter}
                            placeholder="Search…"
                            placeholderTextColor="#6B7280"
                        />
                    ) : null}
                    <ScrollView style={styles.selectList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filtered.map((opt) => (
                            <TouchableOpacity
                                key={opt}
                                style={[styles.selectOption, value === opt && styles.selectOptionActive]}
                                onPress={() => {
                                    onSelect(opt);
                                    setOpen(false);
                                    setFilter('');
                                }}
                            >
                                <Text style={styles.selectOptionText}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            ) : null}
            {allowManual && !loading && options.length === 0 ? (
                <TextInput
                    style={styles.wordInput}
                    value={manualValue ?? value}
                    onChangeText={onManualChange}
                    placeholder={placeholder}
                    placeholderTextColor="#6B7280"
                />
            ) : null}
        </View>
    );
}

/** Web ProfilePage card grid + bottom-sheet editors (Passport parity). */
export default function ProfilePassportCards({
    navigation,
    isPrivate,
    onPressPhoto,
    onPressCover,
}: Props) {
    const { user, login } = useAuth();
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = useMemo(() => {
        const cardsAreaWidth =
            screenWidth - (profilePassportScrollInset + profilePassportCardsInset) * 2;
        return (cardsAreaWidth - profilePassportCardGap) / 2;
    }, [screenWidth]);
    const [selectedCard, setSelectedCard] = useState<ProfileCardId | null>(null);

    const [bio, setBio] = useState(user?.bio || '');
    const [socialLinks, setSocialLinks] = useState({
        website: user?.socialLinks?.website || '',
        x: user?.socialLinks?.x || '',
        instagram: user?.socialLinks?.instagram || '',
        tiktok: user?.socialLinks?.tiktok || '',
        podcast: user?.socialLinks?.podcast || '',
    });
    const [countryFlag, setCountryFlag] = useState(user?.countryFlag || '');
    const [interestsDraft, setInterestsDraft] = useState(user?.interests?.join(', ') || '');

    const [national, setNational] = useState(user?.national || '');
    const [regional, setRegional] = useState(user?.regional || '');
    const [local, setLocal] = useState(user?.local || '');
    const [regionalOptions, setRegionalOptions] = useState<string[]>([]);
    const [localOptions, setLocalOptions] = useState<string[]>([]);
    const [loadingRegions, setLoadingRegions] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    const [preferredLocations, setPreferredLocations] = useState<string[]>(user?.placesTraveled ?? []);
    const [preferredLocationQuery, setPreferredLocationQuery] = useState('');
    const [accountType, setAccountType] = useState<'personal' | 'business'>(
        user?.accountType === 'business' ? 'business' : 'personal',
    );

    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [followersList, setFollowersList] = useState<string[]>([]);
    const [followingList, setFollowingList] = useState<string[]>([]);
    const [loadingFollowers, setLoadingFollowers] = useState(false);
    const [loadingFollowing, setLoadingFollowing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setBio(user?.bio || '');
        setSocialLinks({
            website: user?.socialLinks?.website || '',
            x: user?.socialLinks?.x || '',
            instagram: user?.socialLinks?.instagram || '',
            tiktok: user?.socialLinks?.tiktok || '',
            podcast: user?.socialLinks?.podcast || '',
        });
        setCountryFlag(user?.countryFlag || '');
        setInterestsDraft(user?.interests?.join(', ') || '');
        setNational(user?.national || '');
        setRegional(user?.regional || '');
        setLocal(user?.local || '');
        setPreferredLocations(user?.placesTraveled ?? []);
        setAccountType(user?.accountType === 'business' ? 'business' : 'personal');
    }, [user]);

    const profileCompletion = useMemo(() => {
        const checks = [
            Boolean(user?.avatarUrl),
            Boolean(user?.profileBackgroundUrl),
            Boolean((bio || '').trim()),
            Boolean(
                (socialLinks.website ||
                    socialLinks.instagram ||
                    socialLinks.tiktok ||
                    socialLinks.x ||
                    socialLinks.podcast ||
                    ''
                ).trim(),
            ),
            Boolean((national || regional || local || '').trim()),
        ];
        const completed = checks.filter(Boolean).length;
        return { completed, total: checks.length, percent: Math.round((completed / checks.length) * 100) };
    }, [
        user?.avatarUrl,
        user?.profileBackgroundUrl,
        bio,
        socialLinks.website,
        socialLinks.instagram,
        socialLinks.tiktok,
        socialLinks.x,
        socialLinks.podcast,
        national,
        regional,
        local,
    ]);

    const persistLaravelProfile = useCallback(
        async (patch: Parameters<typeof updateAuthProfile>[0]): Promise<boolean> => {
            if (!isLaravelApiEnabled() || !user) return false;
            try {
                const apiUser = await updateAuthProfile(patch);
                const fromApi = mapLaravelUserToAppFields(apiUser as Record<string, unknown>);
                const next: User = { ...user };
                for (const [key, val] of Object.entries(fromApi)) {
                    if (val === undefined || val === null) continue;
                    if (key === 'placesTraveled' && Array.isArray(val)) {
                        next.placesTraveled = val.length > 0 ? val : undefined;
                        continue;
                    }
                    (next as Record<string, unknown>)[key] = val;
                }
                login(next);
                return true;
            } catch (error) {
                console.warn('persistLaravelProfile failed:', error);
                return false;
            }
        },
        [login, user],
    );

    const refreshFollowing = useCallback(async () => {
        if (!user?.id) return;
        const handles = await getFollowedUsers(String(user.id));
        setFollowingList(handles);
        setFollowingCount(handles.length);
    }, [user?.id]);

    const refreshFollowers = useCallback(async () => {
        if (!user?.handle || !isLaravelApiEnabled()) {
            setFollowersCount(0);
            setFollowersList([]);
            return;
        }
        try {
            const res: any = await fetchFollowers(user.handle, 0, 200);
            const list = Array.isArray(res?.data) ? res.data : res?.followers ?? [];
            const handles = list
                .map((u: any) => u?.handle ?? u?.user_handle ?? String(u))
                .filter(Boolean);
            setFollowersList(handles);
            setFollowersCount(handles.length);
        } catch {
            setFollowersCount(0);
            setFollowersList([]);
        }
    }, [user?.handle]);

    useEffect(() => {
        void refreshFollowing();
        void refreshFollowers();
    }, [refreshFollowers, refreshFollowing]);

    useEffect(() => {
        if (selectedCard !== 'location') return;
        if (!national) {
            setRegionalOptions([]);
            setLocalOptions([]);
            return;
        }
        setLoadingRegions(true);
        setRegionalOptions([]);
        if (user?.national !== national) {
            setRegional('');
            setLocal('');
            setLocalOptions([]);
        }
        void fetchRegionsForCountry(national)
            .then((regions) => setRegionalOptions(regions.map((r) => r.name)))
            .catch(() => setRegionalOptions([]))
            .finally(() => setLoadingRegions(false));
    }, [national, selectedCard, user?.national]);

    useEffect(() => {
        if (selectedCard !== 'location') return;
        if (!regional || !national) {
            setLocalOptions([]);
            return;
        }
        setLoadingCities(true);
        setLocalOptions([]);
        if (user?.regional !== regional) setLocal('');
        void fetchCitiesForRegion(regional, national)
            .then((areas) => setLocalOptions(areas.map((c) => c.name)))
            .catch(() => setLocalOptions([]))
            .finally(() => setLoadingCities(false));
    }, [regional, national, selectedCard, user?.regional]);

    useEffect(() => {
        if (selectedCard === 'following') {
            setLoadingFollowing(true);
            void refreshFollowing().finally(() => setLoadingFollowing(false));
        }
        if (selectedCard === 'followers') {
            setLoadingFollowers(true);
            void refreshFollowers().finally(() => setLoadingFollowers(false));
        }
    }, [selectedCard, refreshFollowers, refreshFollowing]);

    const addPreferredLocation = (suggestion: LocationSuggestion) => {
        const parsed = parsedPlaceFeedFromSuggestion(suggestion);
        const label = parsed.displayName || parsed.local || suggestion.name.split(',')[0].trim();
        if (!label) return;
        setPreferredLocations((prev) => {
            if (prev.some((p) => p.toLowerCase() === label.toLowerCase())) return prev;
            if (prev.length >= 12) return prev;
            return [...prev, label];
        });
        setPreferredLocationQuery('');
    };

    const openProfile = (handle: string) => {
        setSelectedCard(null);
        navigation.navigate('ViewProfile', { handle: normalizeHandle(handle) });
    };

    const cardTitle = (id: ProfileCardId) => {
        switch (id) {
            case 'bio':
                return 'Edit Bio';
            case 'social':
                return 'Social Links';
            case 'personal':
                return 'Account & preferred locations';
            case 'location':
                return 'Location Settings';
            case 'interests':
                return 'Interests';
            case 'flag':
                return 'Country Flag';
            case 'followers':
                return 'Followers';
            case 'following':
                return 'Following';
            default:
                return '';
        }
    };

    const saveBio = async () => {
        if (!user) return;
        setSaving(true);
        const bioTrim = bio.trim();
        try {
            const ok = await persistLaravelProfile({ bio: bioTrim || null });
            if (!ok) login({ ...user, bio: bioTrim || undefined });
        } catch {
            login({ ...user, bio: bioTrim || undefined });
        } finally {
            setSaving(false);
            setSelectedCard(null);
        }
    };

    const saveSocial = async () => {
        if (!user) return;
        setSaving(true);
        const nextSocial = {
            website: socialLinks.website.trim() || undefined,
            x: socialLinks.x.trim() || undefined,
            instagram: socialLinks.instagram.trim() || undefined,
            tiktok: socialLinks.tiktok.trim() || undefined,
            podcast: socialLinks.podcast.trim() || undefined,
        };
        const hasAny = Object.values(nextSocial).some(Boolean);
        try {
            const ok = await persistLaravelProfile({ social_links: nextSocial });
            if (!ok) login({ ...user, socialLinks: hasAny ? nextSocial : undefined });
        } catch {
            login({ ...user, socialLinks: hasAny ? nextSocial : undefined });
        } finally {
            setSaving(false);
            setSelectedCard(null);
        }
    };

    const savePersonal = async () => {
        if (!user) return;
        setSaving(true);
        const places = preferredLocations.slice(0, 12);
        try {
            await persistLaravelProfile({
                places_traveled: places,
                account_type: accountType,
                is_business: accountType === 'business',
            });
            // Always refresh local session so Business/Personal badge updates immediately.
            login({
                ...user,
                placesTraveled: places.length ? places : undefined,
                accountType,
            });
        } catch {
            login({
                ...user,
                placesTraveled: places.length ? places : undefined,
                accountType,
            });
        } finally {
            setSaving(false);
            setSelectedCard(null);
        }
    };

    const saveLocation = async () => {
        if (!user) return;
        if (!national || !regional || !local) return;
        setSaving(true);
        try {
            const ok = await persistLaravelProfile({
                location_local: local,
                location_regional: regional,
                location_national: national,
            });
            if (!ok) login({ ...user, national, regional, local });
        } catch {
            login({ ...user, national, regional, local });
        } finally {
            setSaving(false);
            setSelectedCard(null);
        }
    };

    const saveInterests = () => {
        if (!user) return;
        const interests = interestsDraft
            .split(',')
            .map((i) => i.trim())
            .filter(Boolean);
        login({ ...user, interests: interests.length ? interests : undefined });
        setSelectedCard(null);
    };

    const saveFlag = () => {
        if (!user) return;
        login({ ...user, countryFlag: countryFlag.trim() || undefined });
        setSelectedCard(null);
    };

    const renderSheetBody = () => {
        if (!selectedCard) return null;

        if (selectedCard === 'followers') {
            return loadingFollowers ? (
                <ActivityIndicator color="#f472b6" style={styles.loader} />
            ) : followersList.length === 0 ? (
                <Text style={styles.emptyListText}>No followers yet</Text>
            ) : (
                followersList.map((handle) => (
                    <TouchableOpacity key={handle} style={styles.personRow} onPress={() => openProfile(handle)}>
                        <Avatar src={getAvatarForHandle(handle)} name={handle} size={36} />
                        <Text style={styles.personHandle}>{handle}</Text>
                    </TouchableOpacity>
                ))
            );
        }

        if (selectedCard === 'following') {
            return loadingFollowing ? (
                <ActivityIndicator color="#f472b6" style={styles.loader} />
            ) : followingList.length === 0 ? (
                <Text style={styles.emptyListText}>Not following anyone yet</Text>
            ) : (
                followingList.map((handle) => (
                    <TouchableOpacity key={handle} style={styles.personRow} onPress={() => openProfile(handle)}>
                        <Avatar src={getAvatarForHandle(handle)} name={handle} size={36} />
                        <Text style={styles.personHandle}>{handle}</Text>
                    </TouchableOpacity>
                ))
            );
        }

        if (selectedCard === 'bio') {
            return (
                <>
                    <Text style={styles.fieldLabel}>Bio</Text>
                    <TextInput
                        style={[styles.wordInput, styles.textArea]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell us about yourself..."
                        placeholderTextColor="#6B7280"
                        multiline
                        maxLength={220}
                    />
                    <Text style={styles.fieldHint}>This will be visible on your profile</Text>
                    {user?.email ? (
                        <>
                            <Text style={[styles.fieldLabel, styles.fieldSpaced]}>Email</Text>
                            <TextInput style={[styles.wordInput, styles.inputDisabled]} value={user.email} editable={false} />
                            <Text style={styles.fieldHint}>Email cannot be changed</Text>
                        </>
                    ) : null}
                    <TouchableOpacity style={styles.saveBtn} onPress={() => void saveBio()} disabled={saving}>
                        {saving ? <ActivityIndicator color="#111827" /> : <Text style={styles.saveBtnText}>Save Bio</Text>}
                    </TouchableOpacity>
                </>
            );
        }

        if (selectedCard === 'social') {
            const fields: Array<{ key: keyof typeof socialLinks; label: string; placeholder: string }> = [
                { key: 'website', label: 'Website', placeholder: 'https://example.com' },
                { key: 'x', label: 'X (Twitter)', placeholder: '@username' },
                { key: 'instagram', label: 'Instagram', placeholder: '@username' },
                { key: 'tiktok', label: 'TikTok', placeholder: '@username' },
                { key: 'podcast', label: 'Podcast', placeholder: 'https://open.spotify.com/show/...' },
            ];
            return (
                <>
                    {fields.map((f) => (
                        <View key={f.key} style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>{f.label}</Text>
                            <TextInput
                                style={styles.wordInput}
                                value={socialLinks[f.key]}
                                onChangeText={(v) => setSocialLinks((prev) => ({ ...prev, [f.key]: v }))}
                                placeholder={f.placeholder}
                                placeholderTextColor="#6B7280"
                                autoCapitalize="none"
                            />
                        </View>
                    ))}
                    <TouchableOpacity style={styles.saveBtn} onPress={() => void saveSocial()} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator color="#111827" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Social Links</Text>
                        )}
                    </TouchableOpacity>
                </>
            );
        }

        if (selectedCard === 'personal') {
            return (
                <>
                    <Text style={styles.fieldLabel}>Account Type</Text>
                    <View style={styles.accountTypeRow}>
                        {(['personal', 'business'] as const).map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.accountTypeBtn, accountType === type && styles.accountTypeBtnActive]}
                                onPress={() => setAccountType(type)}
                            >
                                <Text
                                    style={[
                                        styles.accountTypeBtnText,
                                        accountType === type && styles.accountTypeBtnTextActive,
                                    ]}
                                >
                                    {type === 'personal' ? 'Personal' : 'Business'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.fieldHint}>Business accounts are eligible for local business suggestion cards.</Text>

                    <Text style={[styles.fieldLabel, styles.fieldSpaced]}>Preferred locations for suggestions</Text>
                    <Text style={styles.fieldHint}>
                        Optional — places you like or have visited. Your main feed still follows your home location.
                    </Text>
                    <PlaceAutocompleteField
                        value={preferredLocationQuery}
                        onChange={setPreferredLocationQuery}
                        onSelectSuggestion={addPreferredLocation}
                        mode="location"
                        showIcon
                        placeholder="Search city or neighborhood"
                        inputStyle={styles.wordInput}
                    />
                    {preferredLocations.length > 0 ? (
                        <View style={styles.chipRow}>
                            {preferredLocations.map((place) => (
                                <View key={place} style={styles.chip}>
                                    <Text style={styles.chipText}>{place}</Text>
                                    <TouchableOpacity
                                        onPress={() => setPreferredLocations((prev) => prev.filter((p) => p !== place))}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Icon name="close" size={14} color="#9CA3AF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : null}
                    <Text style={styles.fieldHint}>{preferredLocations.length}/12 added. Pick from search suggestions.</Text>

                    <TouchableOpacity style={styles.saveBtn} onPress={() => void savePersonal()} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator color="#111827" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save preferences</Text>
                        )}
                    </TouchableOpacity>
                </>
            );
        }

        if (selectedCard === 'location') {
            return (
                <>
                    <SelectRow
                        label="Country"
                        value={national}
                        placeholder="Select a country"
                        options={NATIONAL_OPTIONS}
                        onSelect={setNational}
                    />
                    <SelectRow
                        label="Region / State"
                        value={regional}
                        placeholder="Select a region"
                        options={regionalOptions}
                        loading={loadingRegions}
                        disabled={!national}
                        onSelect={setRegional}
                        allowManual
                        manualValue={regional}
                        onManualChange={setRegional}
                    />
                    <SelectRow
                        label="Local area"
                        value={local}
                        placeholder="Select a local area"
                        options={localOptions}
                        loading={loadingCities}
                        disabled={!regional}
                        onSelect={setLocal}
                        allowManual
                        manualValue={local}
                        onManualChange={setLocal}
                    />
                    <TouchableOpacity
                        style={[styles.saveBtn, (!national || !regional || !local) && styles.saveBtnDisabled]}
                        onPress={() => void saveLocation()}
                        disabled={saving || !national || !regional || !local}
                    >
                        {saving ? (
                            <ActivityIndicator color="#111827" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Location</Text>
                        )}
                    </TouchableOpacity>
                </>
            );
        }

        if (selectedCard === 'interests') {
            return (
                <>
                    <Text style={styles.fieldLabel}>Interests (comma-separated)</Text>
                    <TextInput
                        style={styles.wordInput}
                        value={interestsDraft}
                        onChangeText={setInterestsDraft}
                        placeholder="e.g., Technology, Travel, Food"
                        placeholderTextColor="#6B7280"
                    />
                    <Text style={styles.fieldHint}>Separate multiple interests with commas</Text>
                    {user?.interests && user.interests.length > 0 ? (
                        <View style={styles.chipRow}>
                            {user.interests.map((interest, index) => (
                                <View key={`${interest}-${index}`} style={styles.interestChip}>
                                    <Text style={styles.interestChipText}>{interest}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                    <TouchableOpacity style={styles.saveBtn} onPress={saveInterests}>
                        <Text style={styles.saveBtnText}>Save Interests</Text>
                    </TouchableOpacity>
                </>
            );
        }

        if (selectedCard === 'flag') {
            return (
                <>
                    <Text style={styles.fieldLabel}>Pick a flag</Text>
                    <View style={styles.flagGrid}>
                        {FLAG_ISO_OPTIONS.map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.flagCell, countryFlag === f && styles.flagCellActive]}
                                onPress={() => {
                                    setCountryFlag(f);
                                    if (user) login({ ...user, countryFlag: f });
                                }}
                            >
                                <Flag value={f} size={24} />
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={[styles.fieldLabel, styles.fieldSpaced]}>Or paste your flag emoji</Text>
                    <TextInput
                        style={[styles.wordInput, styles.flagEmojiInput]}
                        value={countryFlag}
                        onChangeText={setCountryFlag}
                        maxLength={8}
                        placeholder="🇮🇪"
                        placeholderTextColor="#6B7280"
                    />
                    <Text style={styles.fieldHint}>This flag shows beside your handle on feed and profile.</Text>
                    <TouchableOpacity style={styles.saveBtn} onPress={saveFlag}>
                        <Text style={styles.saveBtnText}>Save Flag</Text>
                    </TouchableOpacity>
                </>
            );
        }

        return null;
    };

    if (!user) return null;

    return (
        <View style={styles.wrap}>
            {isPrivate ? (
                <View style={styles.privateNoteRow}>
                    <Icon name="lock-closed" size={12} color="#FBBF24" />
                    <Text style={styles.privateNote}>Your profile is private</Text>
                </View>
            ) : null}

            <View style={styles.editHubWrap}>
                <View style={styles.editHub}>
                <View style={styles.editHubHeader}>
                    <View style={styles.editHubTitles}>
                        <Text style={styles.editHubTitle}>Edit Profile</Text>
                        <Text style={styles.editHubSubtitle}>Quickly update your identity and profile presence.</Text>
                    </View>
                    <View style={styles.completionBadge}>
                        <Text style={styles.completionBadgeText}>{profileCompletion.percent}% complete</Text>
                    </View>
                </View>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${profileCompletion.percent}%` }]} />
                </View>
                <View style={styles.quickGrid}>
                    <TouchableOpacity style={styles.quickBtn} onPress={onPressPhoto}>
                        <Icon name="camera-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.quickBtnText}>Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickBtn} onPress={onPressCover}>
                        <Icon name="image-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.quickBtnText}>Cover</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => setSelectedCard('bio')}>
                        <Icon name="create-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.quickBtnText}>Bio</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => setSelectedCard('social')}>
                        <Icon name="link-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.quickBtnText}>Links</Text>
                    </TouchableOpacity>
                </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Audience</Text>
                <View style={styles.cardRow}>
                    <ProfileCardButton
                        cardId="followers"
                        icon="people-outline"
                        title="Followers"
                        count={followersCount}
                        cardWidth={cardWidth}
                        onPress={() => setSelectedCard('followers')}
                    />
                    <ProfileCardButton
                        cardId="following"
                        icon="person-add-outline"
                        title="Following"
                        count={followingCount}
                        cardWidth={cardWidth}
                        onPress={() => setSelectedCard('following')}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Identity</Text>
                <View style={styles.cardRow}>
                    <ProfileCardButton
                        cardId="bio"
                        icon="create-outline"
                        title="Bio"
                        subtitle={bio ? 'Edit bio' : 'Add bio'}
                        cardWidth={cardWidth}
                        onPress={() => setSelectedCard('bio')}
                    />
                    <ProfileCardButton
                        cardId="social"
                        icon="link-outline"
                        title="Social Links"
                        subtitle="Add links"
                        cardWidth={cardWidth}
                        onPress={() => setSelectedCard('social')}
                    />
                    <ProfileCardButton
                        cardId="location"
                        icon="location-outline"
                        title="Location"
                        subtitle="Set location"
                        cardWidth={cardWidth}
                        onPress={() => setSelectedCard('location')}
                    />
                    <ProfileCardButton
                        cardId="flag"
                        icon="globe-outline"
                        title="Country Flag"
                        subtitle="Select flag"
                        cardWidth={cardWidth}
                        onPress={() => setSelectedCard('flag')}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Preferences</Text>
                <View style={styles.cardRow}>
                    <ProfileCardButton
                        cardId="personal"
                        icon={accountType === 'business' ? 'storefront-outline' : 'person-outline'}
                        title="Preferences"
                        subtitle={accountType === 'business' ? 'Business account' : 'Personal account'}
                        cardWidth={cardWidth}
                        onPress={() => setSelectedCard('personal')}
                    />
                    <ProfileCardButton
                        cardId="interests"
                        icon="heart-outline"
                        title="Interests"
                        subtitle="Add interests"
                        cardWidth={cardWidth}
                        onPress={() => setSelectedCard('interests')}
                    />
                </View>
            </View>

            <Modal visible={selectedCard !== null} animationType="slide" transparent onRequestClose={() => setSelectedCard(null)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedCard(null)} />
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedCard ? cardTitle(selectedCard) : ''}</Text>
                            <TouchableOpacity onPress={() => setSelectedCard(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                            {renderSheetBody()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: profilePassportCardsInset,
        paddingTop: 16,
        paddingBottom: 8,
        backgroundColor: 'transparent',
    },
    editHubWrap: {
        marginBottom: 16,
    },
    privateNoteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 12,
    },
    privateNote: {
        textAlign: 'center',
        color: '#FBBF24',
        fontSize: 12,
    },
    editHub: {
        ...profilePassportEditHub,
        padding: 12,
    },
    editHubHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    editHubTitles: { flex: 1 },
    editHubTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    editHubSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    completionBadge: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    completionBadgeText: { color: '#E5E7EB', fontSize: 11, fontWeight: '600' },
    progressTrack: {
        height: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        marginTop: 12,
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
    },
    quickGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    quickBtn: {
        width: '48%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        ...profilePassportQuickAction,
    },
    quickBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    section: {
        marginBottom: 16,
        gap: 8,
    },
    sectionLabel: {
        color: '#6B7280',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.76,
        textTransform: 'uppercase',
        paddingHorizontal: 4,
    },
    cardRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: profilePassportCardGap,
    },
    cardPressed: {
        borderColor: 'rgba(255, 255, 255, 0.28)',
        backgroundColor: '#0a1226',
    },
    card: {
        ...profilePassportCard,
        padding: 16,
        alignItems: 'center',
        gap: 12,
        minHeight: 132,
    },
    cardIconWrap: {
        ...profileCardIconSurface,
    },
    cardImage: {
        width: 48,
        height: 48,
    },
    cardTitle: { color: '#F3F4F6', fontSize: 14, fontWeight: '600', textAlign: 'center' },
    cardSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2, textAlign: 'center' },
    cardCount: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 2, textAlign: 'center' },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    modalSheet: {
        backgroundColor: '#0b1220',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    modalHandle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginTop: 8,
        marginBottom: 4,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', flex: 1, paddingRight: 8 },
    modalBody: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28 },
    fieldBlock: { marginBottom: 14 },
    fieldLabel: { color: '#D1D5DB', fontSize: 13, fontWeight: '600', marginBottom: 6 },
    fieldSpaced: { marginTop: 8 },
    fieldHint: { color: '#6B7280', fontSize: 12, marginTop: 6, marginBottom: 4 },
    wordInput: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        padding: 12,
        color: '#FFFFFF',
        fontSize: 15,
    },
    textArea: { minHeight: 120, textAlignVertical: 'top' },
    inputDisabled: { opacity: 0.55 },
    saveBtn: {
        marginTop: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.45 },
    saveBtnText: { color: '#111827', fontSize: 15, fontWeight: '700' },
    loader: { marginVertical: 24 },
    emptyListText: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    personHandle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    accountTypeRow: { flexDirection: 'row', gap: 8 },
    accountTypeBtn: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    accountTypeBtnActive: {
        borderColor: '#f472b6',
        backgroundColor: 'rgba(244,114,182,0.12)',
    },
    accountTypeBtnText: { color: '#D1D5DB', fontWeight: '600', fontSize: 14 },
    accountTypeBtnTextActive: { color: '#FBCFE8' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    chipText: { color: '#E5E7EB', fontSize: 13 },
    interestChip: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#f472b6',
    },
    interestChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    selectTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    selectTriggerDisabled: { opacity: 0.45 },
    selectValue: { color: '#FFFFFF', fontSize: 15, flex: 1, paddingRight: 8 },
    selectPlaceholder: { color: '#6B7280', fontSize: 15, flex: 1, paddingRight: 8 },
    selectPanel: {
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.35)',
        maxHeight: 220,
        overflow: 'hidden',
    },
    selectFilter: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#FFFFFF',
    },
    selectList: { maxHeight: 180 },
    selectOption: { paddingHorizontal: 12, paddingVertical: 10 },
    selectOptionActive: { backgroundColor: 'rgba(244,114,182,0.15)' },
    selectOptionText: { color: '#E5E7EB', fontSize: 14 },
    flagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    flagCell: {
        width: 44,
        height: 44,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    flagCellActive: {
        borderWidth: 2,
        borderColor: '#f472b6',
        backgroundColor: 'rgba(244,114,182,0.12)',
    },
    flagEmojiInput: { fontSize: 24, textAlign: 'center' },
});
