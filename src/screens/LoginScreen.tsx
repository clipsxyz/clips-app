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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistAuthToken } from '../utils/authTokenBridge';
import { useAuth } from '../context/Auth';
import { loginUser, registerUser, mapLaravelUserToAppFields } from '../api/client';
import Avatar from '../components/Avatar';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField.native';
import type { LocationSuggestion } from '../api/locations';
import { parsedPlaceFeedFromSuggestion, signupFeedTierRows } from '../utils/placeFeedLevels';
import { normalizeCountryFlagInput } from '../utils/countryFlag';
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
    const [forgotOpen, setForgotOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountType, setAccountType] = useState<'personal' | 'business' | ''>('');

    const [name, setName] = useState('');
    const [local, setLocal] = useState('');
    const [regional, setRegional] = useState('');
    const [national, setNational] = useState('');
    const [homeLocationQuery, setHomeLocationQuery] = useState('');
    const [birthMonth, setBirthMonth] = useState('');
    const [birthDay, setBirthDay] = useState('');
    const [birthYear, setBirthYear] = useState('');

    const [profilePicture, setProfilePicture] = useState<string | null>(null);

    const getFieldError = (key: string) => fieldErrors[key] || '';

    useEffect(() => {
        const nextMode = resolveAuthMode(route?.params?.mode);
        setMode(nextMode);
        if (nextMode === 'signup') setStep(1);
        setErrorText('');
        setFieldErrors({});
    }, [route?.params?.mode]);

    const goToFeed = () => {
        navigation.replace('MainTabs', { screen: 'Home' });
    };

    const switchMode = (next: AuthMode) => {
        setMode(next);
        setStep(1);
        setErrorText('');
        setFieldErrors({});
        navigation.setParams?.({ mode: next });
    };

    const signupStepTitle =
        step === 1 ? 'Create your account' : step === 2 ? 'About you' : 'Add a photo';

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
    const step2CanContinue = Boolean(name.trim() && homeLocationComplete && birthdateComplete);
    const handlePreview = regional ? `${name.trim().split(/\s+/)[0] || 'you'}@${regional}` : `${name.trim().split(/\s+/)[0] || 'you'}@yourregion`;

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

    const handleLoginSubmit = async () => {
        setErrorText('');
        setFieldErrors({});
        const nextErrors: Record<string, string> = {};
        if (!loginEmail || !loginPassword) {
            if (!loginEmail) nextErrors.loginEmail = 'Email is required.';
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
            const mapped = mapLaravelUserToAppFields(apiUser);
            const fallbackName = String(mapped.name || loginEmail.split('@')[0] || 'User');
            const mergedUser = {
                name: fallbackName,
                email: loginEmail.trim(),
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
            login(mergedUser);
            setBusy(false);
            goToFeed();
            return;
        } catch (err: any) {
            // Backend unavailable or login failed - fallback to local registration
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
        if (!name.trim()) nextErrors.name = 'Full name is required.';
        if (!local || !regional || !national) {
            nextErrors.homeLocation = 'Search and pick a place from the list.';
        }
        if (!birthMonth || !birthDay || !birthYear) {
            nextErrors.birthdate = 'Please enter your date of birth.';
        }
        const age = getAgeFromBirthday();
        if (age === null && birthMonth && birthDay && birthYear) {
            nextErrors.birthdate = 'Please enter a valid date of birth.';
        } else if (age !== null && age < MIN_AGE) {
            nextErrors.birthdate = `You must be at least ${MIN_AGE} years old.`;
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
        const handle = `${name.trim().split(/\s+/)[0] || name.trim()}@${regional}`;
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
                username: email.trim(),
                email: email.trim(),
                password,
                displayName: name.trim(),
                handle,
                locationLocal: local,
                locationRegional: regional,
                locationNational: national,
                accountType: accountType as 'personal' | 'business',
                isBusiness: accountType === 'business',
            });
            if (apiResponse?.token) {
                await persistAuthToken(apiResponse.token);
            }
        } catch {
            // keep local registration fallback
        }

        await saveLocalRegistration(email.trim(), password, userData);
        login(userData);
        setBusy(false);
        goToFeed();
    };

    const handleProfilePictureSelect = () => {
        ImagePicker.launchImageLibrary(
            {
                mediaType: 'photo',
                quality: 0.8,
            },
            (response) => {
                if (response.assets && response.assets[0]) {
                    setProfilePicture(response.assets[0].uri || null);
                }
            }
        );
    };

    return (
        <GazetteerScreenShell edges={['top', 'bottom']}>
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
                                placeholder="Email"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                            />
                            {!!getFieldError('loginEmail') && <Text style={styles.fieldErrorText}>{getFieldError('loginEmail')}</Text>}
                            <View style={styles.passwordField}>
                                <TextInput
                                    value={loginPassword}
                                    onChangeText={setLoginPassword}
                                    placeholder="Password (8+ characters)"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.input, styles.passwordInput]}
                                    secureTextEntry={!showLoginPassword}
                                    autoComplete="password"
                                />
                                <TouchableOpacity style={styles.eyeOverlay} onPress={() => setShowLoginPassword((v) => !v)}>
                                    <Icon name={showLoginPassword ? 'eye-off' : 'eye'} size={ox(18)} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('loginPassword') && <Text style={styles.fieldErrorText}>{getFieldError('loginPassword')}</Text>}
                            <TouchableOpacity onPress={() => setForgotOpen(true)}>
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
                            <View style={styles.accountTypeRow}>
                                <TouchableOpacity
                                    onPress={() => setAccountType('personal')}
                                    style={[styles.accountTypePill, accountType === 'personal' && styles.accountTypePillActive]}
                                >
                                    <Text style={[styles.accountTypeText, accountType === 'personal' && styles.accountTypeTextActive]}>Personal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setAccountType('business')}
                                    style={[styles.accountTypePill, accountType === 'business' && styles.accountTypePillActive]}
                                >
                                    <Text style={[styles.accountTypeText, accountType === 'business' && styles.accountTypeTextActive]}>Business</Text>
                                </TouchableOpacity>
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
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Full Name"
                                placeholderTextColor="#6B7280"
                                style={styles.input}
                                autoComplete="name"
                            />
                            {!!getFieldError('name') && <Text style={styles.fieldErrorText}>{getFieldError('name')}</Text>}

                            <Text style={styles.fieldLabel}>Date of birth</Text>
                            <View style={styles.birthdateRow}>
                                <View style={[styles.pickerContainer, { flex: 1.2 }]}>
                                    <Picker
                                        selectedValue={birthMonth}
                                        onValueChange={setBirthMonth}
                                        style={styles.picker}
                                        dropdownIconColor="#9CA3AF"
                                    >
                                        <Picker.Item label="Month" value="" color="#9CA3AF" />
                                        {MONTHS.map((m, i) => (
                                            <Picker.Item key={m} label={m} value={String(i + 1)} color="#F9FAFB" />
                                        ))}
                                    </Picker>
                                </View>
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

                            <Text style={styles.fieldLabel}>Home location — local, regional, and national feeds.</Text>
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
                                placeholder="Search city or neighborhood"
                            />
                            {!homeLocationComplete && homeLocationQuery.trim().length >= 2 ? (
                                <Text style={styles.warnText}>Select a suggestion from the list.</Text>
                            ) : null}
                            {!!getFieldError('homeLocation') && <Text style={styles.fieldErrorText}>{getFieldError('homeLocation')}</Text>}
                            {homeLocationComplete ? (
                                <View style={styles.locationOk}>
                                    <Icon name="checkmark-circle" size={ox(18)} color="#7A8AF0" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.locationOkTitle}>Home area set</Text>
                                        <Text style={styles.locationOkSub}>
                                            {signupFeedTierRows(local, regional, national).map((r) => r.value).join(' · ')}
                                        </Text>
                                        <TouchableOpacity onPress={clearHomeLocation}>
                                            <Text style={styles.linkText}>Change location</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    )}

                    {mode === 'signup' && step === 3 && (
                        <View style={[styles.stepContent, styles.step3Content]}>
                            <Text style={styles.step3Handle}>@{handlePreview}</Text>
                            <Text style={styles.step3Location} numberOfLines={2}>
                                {[local, regional, national].filter(Boolean).join(' · ')}
                            </Text>
                            <View style={styles.avatarContainer}>
                                <Avatar src={profilePicture || undefined} name={name || 'User'} size="xl" />
                            </View>
                            <View style={styles.photoActions}>
                                <TouchableOpacity onPress={handleProfilePictureSelect} style={styles.photoButton}>
                                    <Icon name="camera" size={ox(20)} color="#FFFFFF" />
                                    <Text style={styles.photoButtonText}>Choose photo</Text>
                                </TouchableOpacity>
                                {profilePicture ? (
                                    <TouchableOpacity onPress={() => setProfilePicture(null)} style={styles.removePhotoBtn}>
                                        <Text style={styles.removePhotoText}>Remove</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            <Text style={styles.photoHint}>Optional — initials are used if you skip.</Text>
                        </View>
                    )}
                    </View>
                </View>
            </ScrollView>

            {mode === 'signup' ? (
                <View style={styles.footer}>
                    {step === 1 ? (
                        <View style={styles.consentBox}>
                            <Text style={styles.consentTitle}>Required to continue</Text>
                            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedTerms((v) => !v)}>
                                <Icon name={acceptedTerms ? 'checkbox' : 'square-outline'} size={ox(20)} color={acceptedTerms ? '#7A8AF0' : '#9CA3AF'} />
                                <Text style={styles.checkLabel}>
                                    I accept{' '}
                                    <Text style={styles.linkText} onPress={() => navigation.navigate('Terms')}>
                                        Terms & Conditions
                                    </Text>
                                </Text>
                            </TouchableOpacity>
                            {!!getFieldError('terms') && <Text style={styles.fieldErrorText}>{getFieldError('terms')}</Text>}
                            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedGuidelines((v) => !v)}>
                                <Icon name={acceptedGuidelines ? 'checkbox' : 'square-outline'} size={ox(20)} color={acceptedGuidelines ? '#7A8AF0' : '#9CA3AF'} />
                                <Text style={styles.checkLabel}>
                                    I accept{' '}
                                    <Text style={styles.linkText} onPress={() => navigation.navigate('Terms')}>
                                        Community Guidelines
                                    </Text>
                                </Text>
                            </TouchableOpacity>
                            {!!getFieldError('guidelines') && <Text style={styles.fieldErrorText}>{getFieldError('guidelines')}</Text>}
                            {!step1CanContinue && (email || password) && (!acceptedTerms || !acceptedGuidelines) ? (
                                <Text style={styles.warnText}>Accept both above to enable Continue.</Text>
                            ) : null}
                        </View>
                    ) : null}
                    {step > 1 ? (
                        <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backLink} disabled={busy}>
                            <Text style={styles.backLinkText}>Back</Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        onPress={step === 1 ? handleStep1Submit : step === 2 ? handleStep2Submit : handleProfilePictureSubmit}
                        style={[styles.submitButton, (busy || (step === 1 && !step1CanContinue) || (step === 2 && !step2CanContinue)) && styles.submitButtonDisabled]}
                        disabled={busy || (step === 1 && !step1CanContinue) || (step === 2 && !step2CanContinue)}
                    >
                        <Text style={styles.submitButtonText}>
                            {busy ? 'Please wait...' : step < 3 ? 'Continue' : 'Create account'}
                        </Text>
                    </TouchableOpacity>
                    {step === 1 ? (
                        <>
                            <Text style={styles.termsText}>You must be at least 13 years old.</Text>
                            <Text style={styles.switchModeText}>
                                Already have an account?{' '}
                                <Text style={styles.linkText} onPress={() => switchMode('login')}>
                                    Log in
                                </Text>
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.termsText}>By signing up, you agree to our terms and community guidelines.</Text>
                    )}
                </View>
            ) : null}
            </View>
            <Modal visible={forgotOpen} transparent animationType="fade" onRequestClose={() => setForgotOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.forgotModalCard}>
                        <Text style={styles.forgotTitle}>Reset password</Text>
                        <TextInput
                            value={forgotEmail}
                            onChangeText={setForgotEmail}
                            placeholder="Enter your email"
                            placeholderTextColor="#9CA3AF"
                            style={styles.input}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <View style={styles.forgotActions}>
                            <TouchableOpacity style={styles.backButton} onPress={() => setForgotOpen(false)}>
                                <Text style={styles.backButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={() => {
                                    setForgotOpen(false);
                                    Alert.alert('Password reset', 'If an account exists, reset instructions were sent.');
                                }}
                            >
                                <Text style={styles.submitButtonText}>Send link</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    },
    birthInput: {
        flex: 1,
    },
    birthInputLarge: {
        flex: 1.4,
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
    consentBox: {
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: ox(12),
        gap: ox(10),
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
    forgotActions: {
        flexDirection: 'row',
        gap: ox(8),
    },
});









