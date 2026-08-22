import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Modal,
    Keyboard,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import * as ImagePicker from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/Auth';
import { loginUser, registerUser, mapLaravelUserToAppFields, requestPasswordResetCode, resetPasswordWithCode } from '../api/client';
import { persistAuthToken } from '../utils/authTokenBridge';
import { resetRootToScreen, rootNavigationRef } from '../navigation/rootNavigationRef';
import { buildGazetteerHandle } from '../utils/gazetteerHandle';
import { clearLaravelUnreachable } from '../config/runtimeEnv';
import Avatar from '../components/Avatar';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField.native';
import GazetteerMenuSheet from '../components/GazetteerMenuSheet.native';
import type { LocationSuggestion } from '../api/locations';
import { parsedPlaceFeedFromSuggestion, signupFeedTierRows } from '../utils/placeFeedLevels';
import { normalizeCountryFlagInput } from '../utils/countryFlag';
import {
    ensureCameraPermission,
    ensureGalleryMediaPermission,
} from '../utils/galleryMediaPermissionsNative';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import { ox } from '../constants/nativeOpticalScale';

type AuthMode = 'signup' | 'login';

function resolveAuthMode(raw: unknown): AuthMode {
    return raw === 'login' ? 'login' : 'signup';
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const MIN_AGE = 13;

export default function LoginScreen({ navigation, route }: any) {
    const { login } = useAuth();
    const [mode, setMode] = useState<AuthMode>(() => resolveAuthMode(route?.params?.mode));
    const [step, setStep] = useState(1);
    const [busy, setBusy] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedGuidelines, setAcceptedGuidelines] = useState(false);
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);
    const [forgotStep, setForgotStep] = useState<1 | 2>(1);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotCode, setForgotCode] = useState('');
    const [forgotDebugCode, setForgotDebugCode] = useState('');
    const [forgotPassword, setForgotPassword] = useState('');
    const [forgotConfirm, setForgotConfirm] = useState('');
    const [forgotBusy, setForgotBusy] = useState(false);
    const [forgotError, setForgotError] = useState('');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountType, setAccountType] = useState<'personal' | 'business' | ''>('personal');

    const [name, setName] = useState('');
    const [local, setLocal] = useState('');
    const [regional, setRegional] = useState('');
    const [national, setNational] = useState('');
    const [homeLocationQuery, setHomeLocationQuery] = useState('');
    const [locationEntryMode, setLocationEntryMode] = useState<'search' | 'manual'>('search');
    const [birthMonth, setBirthMonth] = useState('');
    const [birthDay, setBirthDay] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [monthMenuOpen, setMonthMenuOpen] = useState(false);

    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [photoSourceMenuOpen, setPhotoSourceMenuOpen] = useState(false);

    const getFieldError = (key: string) => fieldErrors[key] || '';

    useEffect(() => {
        // A prior feed/upload failure can mark Laravel unreachable for the JS session.
        clearLaravelUnreachable();
    }, []);

    useEffect(() => {
        const nextMode = resolveAuthMode(route?.params?.mode);
        setMode(nextMode);
        if (nextMode === 'signup') setStep(1);
        setErrorText('');
        setFieldErrors({});
    }, [route?.params?.mode]);

    // Hide sticky Terms block while keyboard is open so it doesn't cover signup fields.
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const goToFeed = () => {
        if (rootNavigationRef.isReady()) {
            resetRootToScreen('MainTabs');
            return;
        }
        navigation.replace('MainTabs', { screen: 'Home' });
    };

    const enterLiveSession = async (nextUser: any) => {
        try {
            login(nextUser);
        } catch (sessionErr: any) {
            setErrorText(String(sessionErr?.message || 'Could not start session. Try login again.'));
            setBusy(false);
            return;
        }
        try {
            const { isMockMode } = await import('../api/apiMode');
            if (!isMockMode()) {
                void import('../api/postsStorage.native')
                    .then((m) => m.clearCorruptPostsStorageNative())
                    .catch(() => {});
            }
        } catch {
            /* ignore */
        }
        setBusy(false);
        goToFeed();
    };

    const switchMode = (next: AuthMode) => {
        setMode(next);
        setStep(1);
        setErrorText('');
        setFieldErrors({});
        navigation.setParams?.({ mode: next });
    };

    const isBusinessAccount = accountType === 'business';
    const nameFieldLabel = isBusinessAccount ? 'Business name' : 'Full name';
    const signupStepTitle =
        step === 1
            ? 'Create your account'
            : step === 2
              ? isBusinessAccount
                  ? 'About your business'
                  : 'About you'
              : 'Add a photo';

    function getAgeFromBirthday(): number | null {
        const m = parseInt(birthMonth, 10);
        const d = parseInt(birthDay, 10);
        const y = parseInt(birthYear, 10);
        if (!m || !d || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) return null;
        const today = new Date();
        const birth = new Date(y, m - 1, d);
        if (birth > today) return null;
        let age = today.getFullYear() - birth.getFullYear();
        const mDiff = today.getMonth() - birth.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    }

    const homeLocationComplete = Boolean(local && regional && national);
    const birthdateComplete = (() => {
        const age = getAgeFromBirthday();
        return age !== null && age >= MIN_AGE;
    })();
    const step1CanContinue = Boolean(
        accountType && email.trim() && password.length >= 8 && password === confirmPassword && acceptedTerms && acceptedGuidelines
    );
    const step1MissingHints = (() => {
        const missing: string[] = [];
        if (!accountType) missing.push('account type');
        if (!email.trim()) missing.push('email');
        if (password.length < 8) missing.push('password (8+)');
        if (!confirmPassword || password !== confirmPassword) missing.push('matching confirm password');
        if (!acceptedTerms) missing.push('Terms');
        if (!acceptedGuidelines) missing.push('Guidelines');
        return missing;
    })();
    const step2CanContinue = Boolean(name.trim() && homeLocationComplete && birthdateComplete);
    const step2MissingHints = (() => {
        const missing: string[] = [];
        if (!name.trim()) missing.push(isBusinessAccount ? 'business name' : 'full name');
        if (!homeLocationComplete) missing.push(isBusinessAccount ? 'business location' : 'home location');
        if (!birthdateComplete) {
            missing.push(isBusinessAccount ? 'owner date of birth (13+)' : 'date of birth (13+)');
        }
        return missing;
    })();
    const handlePreview = regional
        ? buildGazetteerHandle(
            name.trim() || (isBusinessAccount ? 'business' : 'you'),
            regional,
          )
        : buildGazetteerHandle(
            name.trim() || (isBusinessAccount ? 'business' : 'you'),
            'yourregion',
          );

    function applyHomeLocation(suggestion: LocationSuggestion) {
        const parsed = parsedPlaceFeedFromSuggestion(suggestion);
        setLocal(parsed.local);
        setRegional(parsed.regional);
        setNational(parsed.national);
        setHomeLocationQuery(parsed.fullName || suggestion.name);
    }

    function clearHomeLocation() {
        setLocal('');
        setRegional('');
        setNational('');
        setHomeLocationQuery('');
    }

    function switchLocationEntryMode(next: 'search' | 'manual') {
        setLocationEntryMode(next);
        setFieldErrors((prev) => {
            if (!prev.homeLocation) return prev;
            const { homeLocation: _removed, ...rest } = prev;
            return rest;
        });
    }

    const LOCAL_REGISTRATIONS_KEY = 'gazetteer_local_registrations_rn';

    const getLocalRegistrations = async (): Promise<Record<string, { password: string; userData: any }>> => {
        try {
            const raw = await AsyncStorage.getItem(LOCAL_REGISTRATIONS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    };

    const saveLocalRegistration = async (emailValue: string, passwordValue: string, userData: any) => {
        const next = await getLocalRegistrations();
        next[String(emailValue || '').trim().toLowerCase()] = { password: passwordValue, userData };
        await AsyncStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify(next));
    };

    const sessionUserFromApi = (apiUser: Record<string, unknown>, fallbackEmail: string) => {
        const mapped = mapLaravelUserToAppFields(apiUser);
        const fallbackName = String(mapped.name || fallbackEmail.split('@')[0] || 'User');
        return {
            name: fallbackName,
            email: String(mapped.email || fallbackEmail).trim(),
            password: '',
            local: String(mapped.local || ''),
            regional: String(mapped.regional || ''),
            national: String(mapped.national || ''),
            handle: String(mapped.handle || `${fallbackName}@Unknown`),
            countryFlag: String(mapped.countryFlag || ''),
            id: mapped.id,
            avatarUrl: mapped.avatarUrl,
            bio: mapped.bio,
            socialLinks: mapped.socialLinks,
            placesTraveled: mapped.placesTraveled,
            accountType: mapped.accountType,
            is_private: mapped.is_private,
        };
    };

    const handleForgotSendCode = async () => {
        setForgotError('');
        const identifier = forgotEmail.trim();
        if (!identifier) {
            setForgotError('Enter your email or handle.');
            return;
        }
        setForgotBusy(true);
        try {
            const res = await requestPasswordResetCode(identifier);
            setForgotDebugCode(String(res.debug_code || ''));
            if (res.debug_code) {
                setForgotCode(String(res.debug_code));
            }
            setForgotStep(2);
        } catch (err: any) {
            const msg = String(err?.message || 'Could not send code');
            const isConnection =
                err?.name === 'ConnectionRefused' || msg.includes('CONNECTION_REFUSED');
            setForgotError(
                isConnection
                    ? 'Cannot reach the server. Check Laravel is running.'
                    : msg,
            );
        } finally {
            setForgotBusy(false);
        }
    };

    const handleForgotSubmit = async () => {
        setForgotError('');
        const identifier = forgotEmail.trim();
        const code = forgotCode.replace(/\D/g, '');
        if (!identifier) {
            setForgotError('Enter your email or handle.');
            return;
        }
        if (code.length !== 6) {
            setForgotError('Enter the 6-digit code.');
            return;
        }
        if (forgotPassword.length < 8) {
            setForgotError('New password must be at least 8 characters.');
            return;
        }
        if (forgotPassword !== forgotConfirm) {
            setForgotError('Passwords do not match.');
            return;
        }
        setForgotBusy(true);
        try {
            const response = await resetPasswordWithCode(identifier, code, forgotPassword);
            if (response?.token) {
                await persistAuthToken(response.token);
            }
            await saveLocalRegistration(
                String(response.user?.email || identifier),
                forgotPassword,
                sessionUserFromApi(response.user || {}, identifier),
            );
            setForgotOpen(false);
            setLoginEmail(identifier);
            setLoginPassword(forgotPassword);
            await enterLiveSession(sessionUserFromApi(response.user || {}, identifier));
        } catch (err: any) {
            const msg = String(err?.message || 'Could not reset password');
            const isConnection =
                err?.name === 'ConnectionRefused' || msg.includes('CONNECTION_REFUSED');
            setForgotError(
                isConnection
                    ? 'Cannot reach the server. Check Laravel is running.'
                    : msg,
            );
        } finally {
            setForgotBusy(false);
        }
    };

    const handleLoginSubmit = async () => {
        setErrorText('');
        setFieldErrors({});
        const nextErrors: Record<string, string> = {};
        if (!loginEmail || !loginPassword) {
            if (!loginEmail) nextErrors.loginEmail = 'Email or handle is required.';
            if (!loginPassword) nextErrors.loginPassword = 'Password is required.';
        }
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            setErrorText('Please fix the highlighted fields.');
            return;
        }
        setBusy(true);
        try {
            const response = await loginUser(loginEmail.trim(), loginPassword);
            if (response?.token) {
                await persistAuthToken(response.token);
            }
            const apiUser = response?.user || {};
            await enterLiveSession(sessionUserFromApi(apiUser, loginEmail.trim()));
            return;
        } catch (err: any) {
            // Live Laravel mode: do not silently log in without a Sanctum token (create/upload → 401).
            const { isMockMode } = await import('../api/apiMode');
            if (!isMockMode()) {
                clearLaravelUnreachable();
                const msg = String(err?.message || 'Login failed');
                const isConnection =
                    err?.name === 'ConnectionRefused' || msg.includes('CONNECTION_REFUSED');
                if (isConnection) {
                    setErrorText('Cannot reach the server. Check Laravel is running and try again.');
                    setBusy(false);
                    return;
                }
                if (err?.status === 401 || msg.toLowerCase().includes('invalid')) {
                    setErrorText(
                        'Invalid email or password. Use the Gazetteer password you created (not Gmail), or your handle like Name@Place.',
                    );
                    setBusy(false);
                    return;
                }

                // Migrate a prior local-only account onto Laravel (fresh DB / first live login).
                try {
                    const reg = await getLocalRegistrations();
                    const key = loginEmail.trim().toLowerCase();
                    const localRecord = reg[key];
                    if (localRecord && localRecord.password === loginPassword) {
                        const u = localRecord.userData || {};
                        const apiResponse = await registerUser({
                            username: String(loginEmail.trim().split('@')[0] || 'user').replace(
                                /[^a-zA-Z0-9_]/g,
                                '_',
                            ),
                            email: loginEmail.trim(),
                            password: loginPassword,
                            displayName: String(u.name || loginEmail.split('@')[0] || 'User'),
                            handle: String(
                                u.handle ||
                                    buildGazetteerHandle(
                                        String(u.name || 'User'),
                                        String(u.regional || u.local || 'Unknown'),
                                    ),
                            ),
                            locationLocal: String(u.local || ''),
                            locationRegional: String(u.regional || ''),
                            locationNational: String(u.national || ''),
                            accountType:
                                u.accountType === 'business' || u.accountType === 'personal'
                                    ? u.accountType
                                    : 'personal',
                            isBusiness: u.accountType === 'business',
                        });
                        if (apiResponse?.token) {
                            await persistAuthToken(apiResponse.token);
                        }
                        const mapped = mapLaravelUserToAppFields(apiResponse?.user || {});
                        const fallbackName = String(mapped.name || u.name || loginEmail.split('@')[0] || 'User');
                        await enterLiveSession({
                            name: fallbackName,
                            email: loginEmail.trim(),
                            password: '',
                            local: String(mapped.local || u.local || ''),
                            regional: String(mapped.regional || u.regional || ''),
                            national: String(mapped.national || u.national || ''),
                            handle: String(mapped.handle || u.handle || `${fallbackName}@Unknown`),
                            countryFlag: String(mapped.countryFlag || u.countryFlag || ''),
                            id: mapped.id || u.id,
                            avatarUrl: mapped.avatarUrl || u.avatarUrl,
                            bio: mapped.bio || u.bio,
                            socialLinks: mapped.socialLinks || u.socialLinks,
                            placesTraveled: mapped.placesTraveled || u.placesTraveled,
                            accountType: mapped.accountType || u.accountType,
                            is_private: mapped.is_private ?? u.is_private,
                        });
                        return;
                    }
                } catch (migrateErr: any) {
                    const migrateMsg = String(migrateErr?.message || '');
                    // Email already on server with different password, or validation failed.
                    if (migrateMsg.toLowerCase().includes('email') || migrateMsg.includes('unique')) {
                        setErrorText(
                            'That email is already on the server. Use the password you registered with, or create a new account.',
                        );
                        setBusy(false);
                        return;
                    }
                }

                setErrorText(
                    msg.includes('Invalid')
                        ? 'Invalid email or password. Use the Gazetteer password you created (not Gmail), or your handle like Name@Place.'
                        : msg,
                );
                setBusy(false);
                return;
            }
            // Mock mode: fall through to local registration store
        }

        try {
            const reg = await getLocalRegistrations();
            const key = loginEmail.trim().toLowerCase();
            const localRecord = reg[key];
            if (!localRecord || localRecord.password !== loginPassword) {
                setErrorText('Invalid email or password.');
                return;
            }
            login(localRecord.userData);
            goToFeed();
        } finally {
            setBusy(false);
        }
    };

    const handleStep1Submit = () => {
        setErrorText('');
        setFieldErrors({});
        const nextErrors: Record<string, string> = {};
        if (!email) nextErrors.email = 'Email is required.';
        if (!password) nextErrors.password = 'Password is required.';
        if (!confirmPassword) nextErrors.confirmPassword = 'Please confirm password.';
        if (password && password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
        if (password && confirmPassword && password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
        if (!accountType) nextErrors.accountType = 'Choose personal or business.';
        if (!acceptedTerms) nextErrors.terms = 'You must accept Terms.';
        if (!acceptedGuidelines) nextErrors.guidelines = 'You must accept Community Guidelines.';
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            setErrorText('Please fix the highlighted fields.');
            return;
        }
        setStep(2);
    };

    const handleStep2Submit = () => {
        setErrorText('');
        setFieldErrors({});
        const nextErrors: Record<string, string> = {};
        if (!name.trim()) {
            nextErrors.name = isBusinessAccount ? 'Business name is required.' : 'Full name is required.';
        }
        if (!local || !regional || !national) {
            nextErrors.homeLocation =
                locationEntryMode === 'manual'
                    ? isBusinessAccount
                        ? 'Enter your business local area, region/city, and country.'
                        : 'Enter your local area, region/city, and country.'
                    : isBusinessAccount
                      ? 'Search your business town or area and pick a suggestion, or enter location manually.'
                      : 'Search your town or local area and pick a suggestion, or enter location manually.';
        }
        if (!birthMonth || !birthDay || !birthYear) {
            nextErrors.birthdate = isBusinessAccount
                ? 'Please enter the account owner’s date of birth.'
                : 'Please enter your date of birth.';
        }
        const age = getAgeFromBirthday();
        if (age === null && birthMonth && birthDay && birthYear) {
            nextErrors.birthdate = 'Please enter a valid date of birth.';
        } else if (age !== null && age < MIN_AGE) {
            nextErrors.birthdate = isBusinessAccount
                ? `The account owner must be at least ${MIN_AGE} years old.`
                : `You must be at least ${MIN_AGE} years old.`;
        }
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            setErrorText('Please complete all required profile fields.');
            return;
        }
        setStep(3);
    };

    const handleProfilePictureSubmit = async () => {
        setBusy(true);
        setErrorText('');
        const age = getAgeFromBirthday();
        const consentTimestamp = new Date().toISOString();
        const handle = buildGazetteerHandle(name.trim() || 'user', regional);
        const userData = {
            name: name.trim(),
            email: email.trim(),
            password: password,
            age: age ?? undefined,
            interests: [],
            local: local,
            regional: regional,
            national: national,
            handle,
            countryFlag: normalizeCountryFlagInput('', national),
            avatarUrl: profilePicture || undefined,
            accountType: accountType || 'personal',
            termsAcceptedAt: consentTimestamp,
            guidelinesAcceptedAt: consentTimestamp,
        };

        try {
            const apiResponse = await registerUser({
                username: email.trim().split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_'),
                email: email.trim(),
                password,
                displayName: name.trim(),
                handle,
                locationLocal: String(local || '').trim(),
                locationRegional: String(regional || '').trim(),
                locationNational: String(national || '').trim(),
                accountType: accountType as 'personal' | 'business',
                isBusiness: accountType === 'business',
            });
            if (apiResponse?.token) {
                await persistAuthToken(apiResponse.token);
            }
            const mapped = mapLaravelUserToAppFields(apiResponse?.user || {});
            const photoUri = profilePicture;
            let hostedAvatar = mapped.avatarUrl as string | undefined;
            if (photoUri) {
                const { persistLocalAvatarToLaravel } = await import('../utils/syncHostedAvatar');
                hostedAvatar =
                    (await Promise.race([
                        persistLocalAvatarToLaravel(handle, photoUri),
                        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 12000)),
                    ])) || hostedAvatar;
            }
            const mergedUser = {
                ...userData,
                password: '',
                id: mapped.id ?? userData.handle,
                handle: String(mapped.handle || userData.handle),
                name: String(mapped.name || userData.name),
                // Prefer server-persisted passport tiers (drives Local / Regional / National feeds).
                local: String(mapped.local || userData.local || '').trim(),
                regional: String(mapped.regional || userData.regional || '').trim(),
                national: String(mapped.national || userData.national || '').trim(),
                avatarUrl: hostedAvatar || userData.avatarUrl,
                accountType: (mapped.accountType as 'personal' | 'business') || userData.accountType,
                is_private: mapped.is_private,
            };
            await saveLocalRegistration(email.trim(), password, mergedUser);
            await enterLiveSession(mergedUser);
            if (photoUri && !hostedAvatar) {
                void import('../utils/syncHostedAvatar').then(({ persistLocalAvatarToLaravel }) =>
                    persistLocalAvatarToLaravel(handle, photoUri).then((url) => {
                        if (url) login({ ...mergedUser, avatarUrl: url });
                    }),
                );
            }
            return;
        } catch (err: any) {
            const { isMockMode } = await import('../api/apiMode');
            if (!isMockMode()) {
                const msg = String(err?.message || 'Registration failed');
                const isConnection =
                    err?.name === 'ConnectionRefused' || msg.includes('CONNECTION_REFUSED');
                setErrorText(
                    isConnection
                        ? 'Cannot reach the server. Check Laravel is running and try again.'
                        : msg,
                );
                setBusy(false);
                return;
            }
            // Mock mode: keep local registration fallback
        }

        await saveLocalRegistration(email.trim(), password, userData);
        login(userData);
        setBusy(false);
        goToFeed();
    };

    const applyProfileAsset = (response: ImagePicker.ImagePickerResponse, sourceLabel: string) => {
        if (response.didCancel) return;
        if (response.errorCode) {
            Alert.alert(
                `${sourceLabel} error`,
                response.errorMessage || `Could not open ${sourceLabel.toLowerCase()}.`,
            );
            return;
        }
        const uri = response.assets?.[0]?.uri;
        if (!uri) {
            Alert.alert('No photo', 'Please choose or take a photo and try again.');
            return;
        }
        setProfilePicture(uri);
    };

    const pickProfileFromLibrary = async () => {
        const allowed = await ensureGalleryMediaPermission();
        if (!allowed) {
            Alert.alert(
                'Photo library access needed',
                'Allow photo access in Settings so you can choose a profile picture.',
            );
            return;
        }
        ImagePicker.launchImageLibrary(
            {
                mediaType: 'photo',
                quality: 0.9,
                selectionLimit: 1,
                includeBase64: false,
            },
            (response) => applyProfileAsset(response, 'Photo library'),
        );
    };

    const pickProfileFromCamera = async () => {
        const allowed = await ensureCameraPermission();
        if (!allowed) {
            Alert.alert(
                'Camera access needed',
                'Allow camera access in Settings so you can take a profile picture.',
            );
            return;
        }
        ImagePicker.launchCamera(
            {
                mediaType: 'photo',
                quality: 0.9,
                saveToPhotos: true,
                cameraType: 'front',
                includeBase64: false,
            },
            (response) => applyProfileAsset(response, 'Camera'),
        );
    };

    const handleProfilePictureSelect = () => {
        setPhotoSourceMenuOpen(true);
    };

    return (
        <GazetteerScreenShell edges={['top', 'bottom']} ambientVariant="passport">
            <View style={styles.screen}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                <View style={[styles.form, mode === 'login' && styles.loginFormShell]}>
                    <View style={mode === 'login' ? styles.loginFormInner : undefined}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.tagline}>No algorithms just places</Text>
                        <Text style={styles.title}>Gazetteer</Text>
                        <Text style={styles.subtitle}>
                            {mode === 'login' ? 'Log in to your account' : signupStepTitle}
                        </Text>

                        {mode === 'signup' ? (
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
                            </View>
                        ) : null}
                    </View>

                    {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

                    {mode === 'login' && (
                        <View style={styles.stepContent}>
                            <TextInput
                                value={loginEmail}
                                onChangeText={setLoginEmail}
                                placeholder="Email or handle"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="off"
                                textContentType="username"
                            />
                            {!!getFieldError('loginEmail') && <Text style={styles.fieldErrorText}>{getFieldError('loginEmail')}</Text>}
                            <View style={styles.passwordField}>
                                <TextInput
                                    value={loginPassword}
                                    onChangeText={setLoginPassword}
                                    placeholder="Gazetteer password"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.input, styles.passwordInput]}
                                    secureTextEntry={!showLoginPassword}
                                    autoComplete="off"
                                    textContentType="password"
                                    autoCorrect={false}
                                />
                                <TouchableOpacity style={styles.eyeOverlay} onPress={() => setShowLoginPassword((v) => !v)}>
                                    <Icon name={showLoginPassword ? 'eye-off' : 'eye'} size={ox(18)} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('loginPassword') && <Text style={styles.fieldErrorText}>{getFieldError('loginPassword')}</Text>}
                            <TouchableOpacity
                                onPress={() => {
                                    setForgotEmail(loginEmail.trim());
                                    setForgotStep(1);
                                    setForgotCode('');
                                    setForgotDebugCode('');
                                    setForgotPassword('');
                                    setForgotConfirm('');
                                    setForgotError('');
                                    setForgotOpen(true);
                                }}
                            >
                                <Text style={styles.forgotText}>Forgot password?</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleLoginSubmit}
                                style={[styles.submitButton, styles.loginSubmitButton]}
                                disabled={busy}
                            >
                                <Text style={[styles.submitButtonText, styles.loginSubmitButtonText]}>
                                    {busy ? 'Logging in…' : 'Log in'}
                                </Text>
                            </TouchableOpacity>
                            <Text style={styles.switchModeText}>
                                Don&apos;t have an account?{' '}
                                <Text style={styles.linkText} onPress={() => switchMode('signup')}>
                                    Sign up
                                </Text>
                            </Text>
                        </View>
                    )}

                    {mode === 'signup' && step === 1 && (
                        <View style={styles.stepContent}>
                            <Text style={styles.fieldLabel}>Account type</Text>
                            <View style={styles.profileTabsWrap}>
                                <View style={styles.profileTabsRow}>
                                    <TouchableOpacity
                                        onPress={() => setAccountType('personal')}
                                        style={[
                                            styles.profileTabButton,
                                            accountType === 'personal' && styles.profileTabButtonActive,
                                        ]}
                                        activeOpacity={0.9}
                                    >
                                        <Text
                                            style={[
                                                styles.profileTabText,
                                                accountType === 'personal' && styles.profileTabTextActive,
                                            ]}
                                        >
                                            Personal
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setAccountType('business')}
                                        style={[
                                            styles.profileTabButton,
                                            accountType === 'business' && styles.profileTabButtonActive,
                                        ]}
                                        activeOpacity={0.9}
                                    >
                                        <Text
                                            style={[
                                                styles.profileTabText,
                                                accountType === 'business' && styles.profileTabTextActive,
                                            ]}
                                        >
                                            Business
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {accountType === 'business' ? (
                                <Text style={styles.hintText}>Eligible for local business suggestion cards.</Text>
                            ) : null}
                            {!!getFieldError('accountType') && <Text style={styles.fieldErrorText}>{getFieldError('accountType')}</Text>}

                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Email"
                                placeholderTextColor="#6B7280"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            {!!getFieldError('email') && <Text style={styles.fieldErrorText}>{getFieldError('email')}</Text>}

                            <View style={styles.passwordRow}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Password (8+ characters)"
                                    placeholderTextColor="#6B7280"
                                    style={[styles.input, { flex: 1 }]}
                                    secureTextEntry={!showSignupPassword}
                                />
                                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowSignupPassword((v) => !v)}>
                                    <Icon name={showSignupPassword ? 'eye-off' : 'eye'} size={ox(18)} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('password') && <Text style={styles.fieldErrorText}>{getFieldError('password')}</Text>}

                            <View style={styles.passwordRow}>
                                <TextInput
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Confirm Password"
                                    placeholderTextColor="#6B7280"
                                    style={[styles.input, { flex: 1 }]}
                                    secureTextEntry={!showSignupConfirmPassword}
                                />
                                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowSignupConfirmPassword((v) => !v)}>
                                    <Icon name={showSignupConfirmPassword ? 'eye-off' : 'eye'} size={ox(18)} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('confirmPassword') && <Text style={styles.fieldErrorText}>{getFieldError('confirmPassword')}</Text>}
                        </View>
                    )}

                    {mode === 'signup' && step === 2 && (
                        <View style={styles.stepContent}>
                            <View style={styles.accountTypeBadgeRow}>
                                <View
                                    style={[
                                        styles.accountTypeBadge,
                                        isBusinessAccount && styles.accountTypeBadgeBusiness,
                                    ]}
                                >
                                    <Icon
                                        name={isBusinessAccount ? 'storefront-outline' : 'person-outline'}
                                        size={ox(14)}
                                        color={isBusinessAccount ? '#FBBF24' : PASSPORT_PALETTE.wavePrimary}
                                    />
                                    <Text
                                        style={[
                                            styles.accountTypeBadgeText,
                                            isBusinessAccount && styles.accountTypeBadgeTextBusiness,
                                        ]}
                                    >
                                        {isBusinessAccount ? 'Business account' : 'Personal account'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.fieldLabel}>{nameFieldLabel}</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder={isBusinessAccount ? 'Business name' : 'Full name'}
                                placeholderTextColor="#6B7280"
                                style={styles.input}
                                autoComplete="name"
                                autoCapitalize="words"
                            />
                            {!!getFieldError('name') && <Text style={styles.fieldErrorText}>{getFieldError('name')}</Text>}

                            <Text style={styles.fieldLabel}>
                                {isBusinessAccount
                                    ? 'Account owner’s date of birth'
                                    : 'Date of birth'}
                            </Text>
                            {isBusinessAccount ? (
                                <Text style={styles.hintText}>
                                    Your personal DOB for age verification (13+) — not your business founding date.
                                </Text>
                            ) : null}
                            <View style={styles.birthdateRow}>
                                <TouchableOpacity
                                    style={[styles.input, styles.birthMonthBtn]}
                                    onPress={() => setMonthMenuOpen(true)}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={
                                            birthMonth
                                                ? styles.birthMonthValue
                                                : styles.birthMonthPlaceholder
                                        }
                                        numberOfLines={1}
                                    >
                                        {birthMonth
                                            ? MONTHS[Math.max(0, parseInt(birthMonth, 10) - 1)] || 'Month'
                                            : 'Month'}
                                    </Text>
                                    <Icon name="chevron-down" size={ox(16)} color="#9CA3AF" />
                                </TouchableOpacity>
                                <TextInput
                                    value={birthDay}
                                    onChangeText={(v) => setBirthDay(v.replace(/\D/g, '').slice(0, 2))}
                                    placeholder="Day"
                                    placeholderTextColor="#6B7280"
                                    style={[styles.input, styles.birthInput]}
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                                <TextInput
                                    value={birthYear}
                                    onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
                                    placeholder="Year"
                                    placeholderTextColor="#6B7280"
                                    style={[styles.input, styles.birthInputLarge]}
                                    keyboardType="numeric"
                                    maxLength={4}
                                />
                            </View>
                            {!!getFieldError('birthdate') && <Text style={styles.fieldErrorText}>{getFieldError('birthdate')}</Text>}

                            <Text style={styles.fieldLabel}>
                                {isBusinessAccount
                                    ? 'Business location — used for local, regional, and national feeds.'
                                    : 'Home location — used for local, regional, and national feeds.'}
                            </Text>
                            <View style={styles.locationModeTabs}>
                                <TouchableOpacity
                                    style={[
                                        styles.locationModeTab,
                                        locationEntryMode === 'search' && styles.locationModeTabActive,
                                    ]}
                                    onPress={() => switchLocationEntryMode('search')}
                                >
                                    <Text
                                        style={[
                                            styles.locationModeTabText,
                                            locationEntryMode === 'search' && styles.locationModeTabTextActive,
                                        ]}
                                    >
                                        Search
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.locationModeTab,
                                        locationEntryMode === 'manual' && styles.locationModeTabActive,
                                    ]}
                                    onPress={() => switchLocationEntryMode('manual')}
                                >
                                    <Text
                                        style={[
                                            styles.locationModeTabText,
                                            locationEntryMode === 'manual' && styles.locationModeTabTextActive,
                                        ]}
                                    >
                                        Enter manually
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            {locationEntryMode === 'search' ? (
                                <>
                                    <PlaceAutocompleteField
                                        value={homeLocationQuery}
                                        onChange={(v) => {
                                            setHomeLocationQuery(v);
                                            if (local || regional || national) {
                                                setLocal('');
                                                setRegional('');
                                                setNational('');
                                            }
                                        }}
                                        onSelectSuggestion={applyHomeLocation}
                                        showFeedLevels
                                        placeholder={
                                            isBusinessAccount
                                                ? 'Start with your business town or area'
                                                : 'Start with your town or local area'
                                        }
                                    />
                                    {!homeLocationComplete && homeLocationQuery.trim().length >= 2 ? (
                                        <Text style={styles.warnText}>Select a suggestion from the list.</Text>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <TextInput
                                        value={local}
                                        onChangeText={setLocal}
                                        placeholder={
                                            isBusinessAccount
                                                ? 'Local area (business town / neighborhood)'
                                                : 'Local area (town / neighborhood)'
                                        }
                                        placeholderTextColor="#6B7280"
                                        style={styles.input}
                                        autoCapitalize="words"
                                    />
                                    <TextInput
                                        value={regional}
                                        onChangeText={setRegional}
                                        placeholder="Regional (city / county / region)"
                                        placeholderTextColor="#6B7280"
                                        style={styles.input}
                                        autoCapitalize="words"
                                    />
                                    <TextInput
                                        value={national}
                                        onChangeText={setNational}
                                        placeholder="National (country)"
                                        placeholderTextColor="#6B7280"
                                        style={styles.input}
                                        autoCapitalize="words"
                                    />
                                </>
                            )}
                            {!!getFieldError('homeLocation') && <Text style={styles.fieldErrorText}>{getFieldError('homeLocation')}</Text>}
                            {homeLocationComplete && locationEntryMode === 'search' ? (
                                <View style={styles.locationOk}>
                                    <Icon name="checkmark-circle" size={ox(18)} color="#7A8AF0" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.locationOkTitle}>
                                            {isBusinessAccount ? 'Business area set' : 'Home area set'}
                                        </Text>
                                        <Text style={styles.locationOkSub}>
                                            {signupFeedTierRows(local, regional, national).map((r) => r.value).join(' · ')}
                                        </Text>
                                        <TouchableOpacity onPress={clearHomeLocation}>
                                            <Text style={styles.linkText}>Change location</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                            {homeLocationComplete && locationEntryMode === 'manual' ? (
                                <View style={styles.locationOk}>
                                    <Icon name="checkmark-circle" size={ox(18)} color="#7A8AF0" />
                                    <Text style={[styles.locationOkTitle, { flex: 1 }]}>
                                        {isBusinessAccount ? 'Business area ready' : 'Home area ready'}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    )}

                    {mode === 'signup' && step === 3 && (
                        <View style={[styles.stepContent, styles.step3Content]}>
                            <Text style={styles.step3Handle}>{handlePreview}</Text>
                            <Text style={styles.step3Location} numberOfLines={2}>
                                {[local, regional, national].filter(Boolean).join(' · ')}
                            </Text>
                            <View style={styles.avatarContainer}>
                                <Avatar src={profilePicture || undefined} name={name || 'User'} size="xl" />
                            </View>
                            <View style={styles.photoActions}>
                                <TouchableOpacity onPress={handleProfilePictureSelect} style={styles.photoButton}>
                                    <Icon name="images-outline" size={ox(20)} color="#FFFFFF" />
                                    <Text style={styles.photoButtonText}>
                                        {profilePicture ? 'Change photo' : 'Add photo'}
                                    </Text>
                                </TouchableOpacity>
                                {profilePicture ? (
                                    <TouchableOpacity onPress={() => setProfilePicture(null)} style={styles.removePhotoBtn}>
                                        <Text style={styles.removePhotoText}>Remove</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            <Text style={styles.photoHint}>Optional — photo library or camera. Initials if you skip.</Text>
                        </View>
                    )}
                    </View>
                </View>
            </ScrollView>

            {mode === 'signup' ? (
                step === 1 && !keyboardOpen ? (
                    <View style={styles.swalFooter}>
                        <View style={styles.swalHandleWrap}>
                            <View style={styles.swalHandle} />
                        </View>
                        <Text style={styles.swalEyebrow}>Gazetteer says</Text>
                        <Text style={styles.swalTitle}>Required to continue</Text>

                        <TouchableOpacity style={styles.swalCheckRow} onPress={() => setAcceptedTerms((v) => !v)}>
                            <Icon
                                name={acceptedTerms ? 'checkbox' : 'square-outline'}
                                size={ox(20)}
                                color={acceptedTerms ? PASSPORT_PALETTE.wavePrimary : '#9CA3AF'}
                            />
                            <Text style={styles.swalCheckLabel}>
                                I accept{' '}
                                <Text style={styles.linkText} onPress={() => navigation.navigate('Terms')}>
                                    Terms & Conditions
                                </Text>
                            </Text>
                        </TouchableOpacity>
                        {!!getFieldError('terms') && <Text style={styles.fieldErrorText}>{getFieldError('terms')}</Text>}

                        <TouchableOpacity
                            style={styles.swalCheckRow}
                            onPress={() => setAcceptedGuidelines((v) => !v)}
                        >
                            <Icon
                                name={acceptedGuidelines ? 'checkbox' : 'square-outline'}
                                size={ox(20)}
                                color={acceptedGuidelines ? PASSPORT_PALETTE.wavePrimary : '#9CA3AF'}
                            />
                            <Text style={styles.swalCheckLabel}>
                                I accept{' '}
                                <Text style={styles.linkText} onPress={() => navigation.navigate('Terms')}>
                                    Community Guidelines
                                </Text>
                            </Text>
                        </TouchableOpacity>
                        {!!getFieldError('guidelines') && (
                            <Text style={styles.fieldErrorText}>{getFieldError('guidelines')}</Text>
                        )}

                        <TouchableOpacity
                            onPress={handleStep1Submit}
                            style={[
                                styles.swalConfirmBtn,
                                (busy || !step1CanContinue) && styles.submitButtonDisabled,
                            ]}
                            disabled={busy || !step1CanContinue}
                        >
                            <Text style={styles.swalConfirmBtnText}>
                                {busy ? 'Please wait...' : 'Continue'}
                            </Text>
                        </TouchableOpacity>
                        {!step1CanContinue && step1MissingHints.length > 0 ? (
                            <Text style={styles.consentCompactHint}>
                                Still needed: {step1MissingHints.join(', ')}
                            </Text>
                        ) : null}

                        <Text style={styles.swalMeta}>
                            13+ required · Already have an account?{' '}
                            <Text style={styles.linkText} onPress={() => switchMode('login')}>
                                Log in
                            </Text>
                        </Text>
                    </View>
                ) : step > 1 ? (
                    <View style={styles.swalFooter}>
                        <View style={styles.swalHandleWrap}>
                            <View style={styles.swalHandle} />
                        </View>
                        <Text style={styles.swalEyebrow}>Gazetteer says</Text>
                        <Text style={styles.swalTitle}>{signupStepTitle}</Text>
                        <View style={styles.swalActionsRow}>
                            <TouchableOpacity
                                onPress={() => setStep(step - 1)}
                                style={styles.profileTabButton}
                                disabled={busy}
                                activeOpacity={0.9}
                            >
                                <Text style={styles.profileTabText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={step === 2 ? handleStep2Submit : handleProfilePictureSubmit}
                                style={[
                                    styles.profileTabButton,
                                    styles.profileTabButtonActive,
                                    styles.swalPrimaryFlex,
                                    (busy || (step === 2 && !step2CanContinue)) && styles.submitButtonDisabled,
                                ]}
                                disabled={busy || (step === 2 && !step2CanContinue)}
                                activeOpacity={0.9}
                            >
                                <Text style={styles.profileTabTextActive}>
                                    {busy ? 'Please wait...' : step < 3 ? 'Continue' : 'Create account'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {step === 2 && !step2CanContinue && step2MissingHints.length > 0 ? (
                            <Text style={styles.consentCompactHint}>
                                Still needed: {step2MissingHints.join(', ')}
                            </Text>
                        ) : null}
                    </View>
                ) : (
                    <View style={styles.swalFooter}>
                        <View style={styles.swalHandleWrap}>
                            <View style={styles.swalHandle} />
                        </View>
                        <View style={styles.consentCompact}>
                            <TouchableOpacity
                                style={styles.swalCheckRowCompact}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setAcceptedTerms((v) => !v);
                                }}
                                hitSlop={8}
                            >
                                <Icon
                                    name={acceptedTerms ? 'checkbox' : 'square-outline'}
                                    size={ox(18)}
                                    color={acceptedTerms ? PASSPORT_PALETTE.wavePrimary : '#9CA3AF'}
                                />
                                <Text style={styles.swalCheckLabelCompact}>Terms</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.swalCheckRowCompact}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setAcceptedGuidelines((v) => !v);
                                }}
                                hitSlop={8}
                            >
                                <Icon
                                    name={acceptedGuidelines ? 'checkbox' : 'square-outline'}
                                    size={ox(18)}
                                    color={acceptedGuidelines ? PASSPORT_PALETTE.wavePrimary : '#9CA3AF'}
                                />
                                <Text style={styles.swalCheckLabelCompact}>Guidelines</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={handleStep1Submit}
                            style={[
                                styles.swalConfirmBtn,
                                (busy || !step1CanContinue) && styles.submitButtonDisabled,
                            ]}
                            disabled={busy || !step1CanContinue}
                        >
                            <Text style={styles.swalConfirmBtnText}>
                                {busy ? 'Please wait...' : 'Continue'}
                            </Text>
                        </TouchableOpacity>
                        {!step1CanContinue && step1MissingHints.length > 0 ? (
                            <Text style={styles.consentCompactHint}>
                                Still needed: {step1MissingHints.join(', ')}
                            </Text>
                        ) : null}
                    </View>
                )
            ) : null}
            </View>
            <Modal visible={forgotOpen} transparent animationType="fade" onRequestClose={() => setForgotOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.forgotModalCard}>
                        <Text style={styles.forgotTitle}>
                            {forgotStep === 1 ? 'Forgot password' : 'Enter code'}
                        </Text>
                        <Text style={styles.forgotHint}>
                            {forgotStep === 1
                                ? 'We’ll send a 6-digit code. Without Mailgun it shows on this screen.'
                                : forgotDebugCode
                                  ? `No email yet — your code is ${forgotDebugCode}`
                                  : 'Enter the 6-digit code, then choose a new password.'}
                        </Text>
                        {forgotStep === 1 ? (
                            <TextInput
                                value={forgotEmail}
                                onChangeText={setForgotEmail}
                                placeholder="Email or handle"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        ) : (
                            <>
                                <TextInput
                                    value={forgotCode}
                                    onChangeText={setForgotCode}
                                    placeholder="6-digit code"
                                    placeholderTextColor="#9CA3AF"
                                    style={styles.input}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoCorrect={false}
                                />
                                <TextInput
                                    value={forgotPassword}
                                    onChangeText={setForgotPassword}
                                    placeholder="New password (8+ characters)"
                                    placeholderTextColor="#9CA3AF"
                                    style={styles.input}
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                                <TextInput
                                    value={forgotConfirm}
                                    onChangeText={setForgotConfirm}
                                    placeholder="Confirm new password"
                                    placeholderTextColor="#9CA3AF"
                                    style={styles.input}
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                            </>
                        )}
                        {!!forgotError && <Text style={styles.errorText}>{forgotError}</Text>}
                        <View style={styles.forgotActions}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => {
                                    if (forgotStep === 2) {
                                        setForgotStep(1);
                                        setForgotError('');
                                        return;
                                    }
                                    setForgotOpen(false);
                                }}
                            >
                                <Text style={styles.backButtonText}>{forgotStep === 2 ? 'Back' : 'Cancel'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={() => {
                                    void (forgotStep === 1 ? handleForgotSendCode() : handleForgotSubmit());
                                }}
                                disabled={forgotBusy}
                            >
                                <Text style={styles.submitButtonText}>
                                    {forgotBusy
                                        ? 'Please wait…'
                                        : forgotStep === 1
                                          ? 'Send code'
                                          : 'Save and log in'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <GazetteerMenuSheet
                visible={photoSourceMenuOpen}
                title="Profile photo"
                subtitle="Choose a source"
                onDismiss={() => setPhotoSourceMenuOpen(false)}
                options={[
                    {
                        label: 'Photo library',
                        icon: 'images-outline',
                        onPress: () => {
                            setPhotoSourceMenuOpen(false);
                            void pickProfileFromLibrary();
                        },
                    },
                    {
                        label: 'Camera',
                        icon: 'camera-outline',
                        onPress: () => {
                            setPhotoSourceMenuOpen(false);
                            void pickProfileFromCamera();
                        },
                    },
                ]}
            />
            <GazetteerMenuSheet
                visible={monthMenuOpen}
                title="Birth month"
                subtitle="Select your birth month"
                onDismiss={() => setMonthMenuOpen(false)}
                options={MONTHS.map((month, index) => ({
                    label: month,
                    onPress: () => setBirthMonth(String(index + 1)),
                }))}
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
    },
    screen: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: ox(16),
        paddingBottom: ox(8),
    },
    form: {
        ...glassPanel,
        borderRadius: ox(20),
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    loginFormShell: {
        borderRadius: ox(16),
        padding: ox(2),
        backgroundColor: '#d4af37',
        borderWidth: 0,
    },
    loginFormInner: {
        borderRadius: ox(14),
        backgroundColor: '#000000',
        overflow: 'hidden',
    },
    tagline: {
        fontSize: ox(12),
        color: '#6B7280',
        marginBottom: ox(8),
        textAlign: 'center',
    },
    progressTrack: {
        marginTop: ox(16),
        height: 2,
        width: 200,
        maxWidth: '80%',
        borderRadius: ox(999),
        backgroundColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        alignSelf: 'center',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#7A8AF0',
        borderRadius: ox(999),
    },
    header: {
        padding: ox(40),
        paddingBottom: ox(24),
        alignItems: 'center',
    },
    title: {
        fontSize: ox(28),
        fontWeight: '300',
        color: '#FFFFFF',
        marginBottom: ox(8),
    },
    subtitle: {
        fontSize: ox(14),
        color: '#9CA3AF',
        marginBottom: ox(24),
        textAlign: 'center',
    },
    modeRow: {
        flexDirection: 'row',
        gap: ox(8),
        marginBottom: ox(16),
    },
    modePill: {
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: ox(999),
        paddingHorizontal: ox(14),
        paddingVertical: ox(6),
        backgroundColor: '#111827',
    },
    modePillActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    modePillText: {
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    modePillTextActive: {
        color: '#111827',
    },
    errorText: {
        color: '#FCA5A5',
        textAlign: 'center',
        fontSize: ox(12),
        marginBottom: ox(8),
        paddingHorizontal: ox(20),
    },
    fieldErrorText: {
        color: '#FCA5A5',
        fontSize: ox(11),
        marginTop: ox(-6),
        marginBottom: ox(2),
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
    },
    passwordField: {
        position: 'relative',
        width: '100%',
    },
    passwordInput: {
        paddingRight: ox(44),
    },
    eyeOverlay: {
        position: 'absolute',
        right: 8,
        top: 0,
        bottom: 0,
        width: ox(36),
        alignItems: 'center',
        justifyContent: 'center',
    },
    eyeButton: {
        width: ox(36),
        height: ox(36),
        borderRadius: ox(10),
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
        justifyContent: 'center',
    },
    forgotText: {
        color: '#7A8AF0',
        fontSize: ox(12),
        textAlign: 'right',
        marginBottom: ox(8),
    },
    switchModeText: {
        color: '#9CA3AF',
        fontSize: ox(12),
        textAlign: 'center',
        marginTop: ox(4),
    },
    stepContent: {
        paddingHorizontal: ox(20),
        paddingBottom: ox(16),
        gap: ox(12),
    },
    step3Content: {
        alignItems: 'center',
    },
    step3Handle: {
        color: '#FFFFFF',
        fontSize: ox(15),
        fontWeight: '600',
    },
    step3Location: {
        color: '#6B7280',
        fontSize: ox(12),
        textAlign: 'center',
        marginBottom: ox(8),
    },
    fieldLabel: {
        fontSize: ox(12),
        color: '#9CA3AF',
        marginBottom: ox(4),
    },
    hintText: {
        fontSize: ox(12),
        color: '#6B7280',
    },
    warnText: {
        fontSize: ox(12),
        color: '#FCD34D',
    },
    linkText: {
        color: '#7A8AF0',
        fontSize: ox(12),
    },
    locationOk: {
        flexDirection: 'row',
        gap: ox(8),
        marginTop: ox(4),
    },
    locationOkTitle: {
        color: '#FFFFFF',
        fontSize: ox(14),
    },
    locationOkSub: {
        color: '#9CA3AF',
        fontSize: ox(12),
        marginTop: ox(2),
    },
    locationModeLink: {
        alignSelf: 'flex-start',
        paddingVertical: ox(4),
    },
    locationModeTabs: {
        flexDirection: 'row',
        gap: ox(8),
        width: '100%',
    },
    locationModeTab: {
        flex: 1,
        paddingVertical: ox(10),
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
    },
    locationModeTabActive: {
        borderColor: '#7A8AF0',
        backgroundColor: 'rgba(122,138,240,0.18)',
    },
    locationModeTabText: {
        fontSize: ox(13),
        fontWeight: '600',
        color: '#9CA3AF',
    },
    locationModeTabTextActive: {
        color: '#FFFFFF',
    },
    input: {
        width: '100%',
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: ox(12),
        paddingVertical: ox(12),
        fontSize: ox(14),
        color: '#F9FAFB',
    },
    pickerContainer: {
        width: '100%',
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    picker: {
        width: '100%',
        color: '#F9FAFB',
    },
    interestsContainer: {
        marginTop: ox(8),
    },
    birthdateRow: {
        flexDirection: 'row',
        gap: ox(8),
        alignItems: 'center',
    },
    birthMonthBtn: {
        flex: 1.35,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ox(6),
    },
    birthMonthValue: {
        flexShrink: 1,
        color: '#F9FAFB',
        fontSize: ox(14),
        fontWeight: '500',
    },
    birthMonthPlaceholder: {
        flexShrink: 1,
        color: '#6B7280',
        fontSize: ox(14),
    },
    birthInput: {
        flex: 1,
    },
    birthInputLarge: {
        flex: 1.25,
    },
    accountTypeRow: {
        flexDirection: 'row',
        gap: ox(8),
        marginTop: ox(2),
    },
    accountTypePill: {
        flex: 1,
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingVertical: ox(10),
        alignItems: 'center',
    },
    accountTypePillActive: {
        backgroundColor: 'rgba(122,138,240,0.2)',
    },
    accountTypeText: {
        color: '#D1D5DB',
        fontSize: ox(13),
        fontWeight: '600',
    },
    accountTypeTextActive: {
        color: '#FFFFFF',
    },
    accountTypeBadgeRow: {
        alignItems: 'flex-start',
    },
    accountTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        paddingVertical: ox(6),
        paddingHorizontal: ox(10),
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(61,155,143,0.45)',
        backgroundColor: 'rgba(61,155,143,0.12)',
    },
    accountTypeBadgeBusiness: {
        borderColor: 'rgba(251,191,36,0.45)',
        backgroundColor: 'rgba(251,191,36,0.12)',
    },
    accountTypeBadgeText: {
        fontSize: ox(12),
        fontWeight: '700',
        color: PASSPORT_PALETTE.wavePrimary,
    },
    accountTypeBadgeTextBusiness: {
        color: '#FBBF24',
    },
    profileTabsWrap: {
        marginTop: ox(2),
        paddingHorizontal: ox(6),
        paddingVertical: ox(6),
        borderRadius: ox(10),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.92)',
    },
    profileTabsRow: {
        flexDirection: 'row',
        gap: ox(6),
    },
    profileTabButton: {
        flex: 1,
        minHeight: ox(40),
        borderRadius: ox(8),
        paddingVertical: ox(10),
        paddingHorizontal: ox(12),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    profileTabButtonActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    profileTabText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '700',
    },
    profileTabTextActive: {
        color: '#000000',
        fontSize: ox(12),
        fontWeight: '700',
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        marginTop: ox(8),
    },
    checkLabel: {
        color: '#D1D5DB',
        fontSize: ox(12),
    },
    interestsLabel: {
        fontSize: ox(12),
        color: '#9CA3AF',
        marginBottom: ox(12),
    },
    interestsChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(8),
        marginTop: ox(12),
    },
    interestChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        paddingHorizontal: ox(12),
        paddingVertical: ox(6),
        backgroundColor: '#3B82F6',
        borderRadius: ox(4),
    },
    interestChipText: {
        color: '#FFFFFF',
        fontSize: ox(12),
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: ox(24),
    },
    photoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(8),
        width: '100%',
        paddingVertical: ox(10),
        backgroundColor: '#3B82F6',
        borderRadius: ox(4),
    },
    photoButtonText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
    removeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(8),
        width: '100%',
        paddingVertical: ox(10),
        backgroundColor: '#E5E7EB',
        borderRadius: ox(4),
        marginTop: ox(12),
    },
    removeButtonText: {
        color: '#111827',
        fontSize: ox(14),
        fontWeight: '600',
    },
    photoHint: {
        fontSize: ox(12),
        color: '#6B7280',
        textAlign: 'center',
        marginTop: ox(8),
    },
    footer: {
        paddingHorizontal: ox(20),
        paddingTop: ox(12),
        paddingBottom: ox(16),
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        gap: ox(10),
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
        backgroundColor: '#000',
    },
    swalFooter: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        borderTopLeftRadius: ox(20),
        borderTopRightRadius: ox(20),
        paddingHorizontal: ox(16),
        paddingTop: ox(6),
        paddingBottom: ox(10),
        gap: ox(6),
        backgroundColor: '#0f2430',
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.14)',
    },
    swalHandleWrap: {
        alignItems: 'center',
        paddingBottom: 0,
    },
    swalHandle: {
        width: ox(36),
        height: ox(3),
        borderRadius: ox(2),
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    swalEyebrow: {
        fontSize: ox(11),
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: PASSPORT_PALETTE.wavePrimary,
        textAlign: 'center',
    },
    swalTitle: {
        fontSize: ox(15),
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: -ox(2),
    },
    swalMessage: {
        fontSize: ox(13),
        color: 'rgba(232,238,242,0.85)',
        textAlign: 'center',
        lineHeight: ox(18),
    },
    swalCheckRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        paddingVertical: ox(8),
        paddingHorizontal: ox(10),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: '#163540',
    },
    swalCheckLabel: {
        flex: 1,
        fontSize: ox(13),
        color: '#F3F4F6',
        lineHeight: ox(18),
    },
    swalConfirmBtn: {
        marginTop: ox(2),
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        paddingVertical: ox(11),
        alignItems: 'center',
    },
    swalConfirmBtnText: {
        fontSize: ox(14),
        fontWeight: '700',
        color: '#111827',
    },
    swalActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        width: '100%',
        marginTop: ox(2),
    },
    swalPrimaryFlex: {
        flex: 1.35,
    },
    swalMeta: {
        fontSize: ox(11),
        color: 'rgba(232,238,242,0.7)',
        textAlign: 'center',
        marginTop: ox(2),
    },
    consentBox: {
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: ox(12),
        gap: ox(10),
    },
    consentCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ox(6),
        width: '100%',
    },
    swalCheckRowCompact: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        paddingVertical: ox(8),
        paddingHorizontal: ox(10),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: '#163540',
    },
    swalCheckLabelCompact: {
        flexShrink: 1,
        fontSize: ox(13),
        fontWeight: '600',
        color: '#F3F4F6',
    },
    checkRowCompact: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        paddingVertical: ox(6),
        paddingHorizontal: ox(8),
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    checkLabelCompact: {
        flexShrink: 1,
        fontSize: ox(13),
        fontWeight: '600',
        color: '#E5E7EB',
    },
    consentCompactHint: {
        fontSize: ox(11),
        color: '#FBBF24',
        textAlign: 'center',
        marginTop: -ox(4),
    },
    consentTitle: {
        fontSize: ox(12),
        fontWeight: '600',
        color: '#D1D5DB',
    },
    photoActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: ox(8),
    },
    removePhotoBtn: {
        paddingVertical: ox(10),
        paddingHorizontal: ox(16),
    },
    removePhotoText: {
        color: '#9CA3AF',
        fontSize: ox(14),
    },
    submitButton: {
        width: '100%',
        paddingVertical: ox(12),
        backgroundColor: '#FFFFFF',
        borderRadius: ox(12),
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.45,
    },
    submitButtonText: {
        color: '#111827',
        fontSize: ox(14),
        fontWeight: '600',
    },
    footerActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        width: '100%',
    },
    footerBackButton: {
        flexShrink: 0,
        paddingVertical: ox(12),
        paddingHorizontal: ox(18),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerBackButtonText: {
        color: '#E5E7EB',
        fontSize: ox(14),
        fontWeight: '600',
    },
    footerPrimaryButton: {
        flex: 1,
        paddingVertical: ox(12),
        backgroundColor: '#FFFFFF',
        borderRadius: ox(12),
        alignItems: 'center',
    },
    loginSubmitButton: {
        marginTop: ox(8),
    },
    loginSubmitButtonText: {
        fontWeight: '700',
    },
    backButton: {
        flex: 1,
        paddingVertical: ox(10),
        backgroundColor: '#FFFFFF',
        borderRadius: ox(12),
        alignItems: 'center',
    },
    backButtonText: {
        color: '#111827',
        fontSize: ox(14),
        fontWeight: '600',
    },
    backLink: {
        alignItems: 'center',
        paddingVertical: ox(4),
    },
    backLinkText: {
        color: '#9CA3AF',
        fontSize: ox(14),
    },
    termsText: {
        fontSize: ox(12),
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: ox(16),
    },
    forgotModalCard: {
        margin: ox(24),
        marginTop: '40%',
        backgroundColor: '#030712',
        borderRadius: ox(16),
        borderWidth: 1,
        borderColor: '#374151',
        padding: ox(16),
        gap: ox(12),
    },
    forgotTitle: {
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '700',
    },
    forgotHint: {
        color: '#9CA3AF',
        fontSize: ox(12),
        lineHeight: ox(16),
        marginBottom: ox(4),
    },
    forgotActions: {
        flexDirection: 'row',
        gap: ox(8),
    },
});









