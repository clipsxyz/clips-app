import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/Auth';
import { fetchRegionsForCountry, fetchCitiesForRegion } from '../utils/googleMaps';
import { loginUser, registerUser, mapLaravelUserToAppFields } from '../api/client';
import Avatar from '../components/Avatar';

const nationalOptions = [
    'Ireland', 'UK', 'USA', 'Canada', 'Germany', 'France', 'Spain', 'Italy',
    'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Poland', 'Portugal',
    'Australia', 'New Zealand', 'Japan', 'South Korea', 'China', 'India',
];

const interestOptions = [
    'Food & Dining', 'Sports', 'Music', 'Art & Culture', 'Technology',
    'Travel', 'Fashion', 'Photography', 'Fitness', 'Gaming',
    'Books', 'Movies', 'Nature', 'Cooking', 'Dancing'
];

export default function LoginScreen({ navigation }: any) {
    const { login } = useAuth();
    const [mode, setMode] = useState<'signup' | 'login'>('signup');
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

    // Step 1: Location
    const [name, setName] = useState('');
    const [local, setLocal] = useState('');
    const [regional, setRegional] = useState('');
    const [national, setNational] = useState('');
    const [countryFlag, setCountryFlag] = useState('');

    const [regionalOptions, setRegionalOptions] = useState<string[]>([]);
    const [localOptions, setLocalOptions] = useState<string[]>([]);
    const [loadingRegions, setLoadingRegions] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    // Step 2: Account
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [birthMonth, setBirthMonth] = useState('');
    const [birthDay, setBirthDay] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [preferredLocationsInput, setPreferredLocationsInput] = useState('');
    const [accountType, setAccountType] = useState<'personal' | 'business' | ''>('');
    const [interests, setInterests] = useState<string[]>([]);

    // Step 3: Profile picture
    const [profilePicture, setProfilePicture] = useState<string | null>(null);

    const getFieldError = (key: string) => fieldErrors[key] || '';

    useEffect(() => {
        if (national) {
            setLoadingRegions(true);
            setRegionalOptions([]);
            setRegional('');
            setLocal('');
            setLocalOptions([]);
            
            fetchRegionsForCountry(national)
                .then(regions => {
                    setRegionalOptions(regions.map(r => r.name));
                    setLoadingRegions(false);
                })
                .catch(error => {
                    console.error('Error loading regions:', error);
                    setLoadingRegions(false);
                });
        } else {
            setRegionalOptions([]);
            setLocalOptions([]);
        }
    }, [national]);

    useEffect(() => {
        if (regional && national) {
            setLoadingCities(true);
            setLocalOptions([]);
            setLocal('');
            
            fetchCitiesForRegion(regional, national)
                .then(localAreas => {
                    setLocalOptions(localAreas.map(c => c.name));
                    setLoadingCities(false);
                })
                .catch(error => {
                    console.error('Error loading local areas:', error);
                    setLoadingCities(false);
                });
        } else {
            setLocalOptions([]);
        }
    }, [regional, national]);

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
                try {
                    await AsyncStorage.setItem('authToken', response.token);
                } catch {
                    // ignore
                }
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
            navigation.replace('Home');
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
            navigation.replace('Home');
        } finally {
            setBusy(false);
        }
    };

    const handleLocationSubmit = () => {
        setErrorText('');
        setFieldErrors({});
        const nextErrors: Record<string, string> = {};
        if (!name || !local || !regional || !national) {
            if (!name) nextErrors.name = 'Full name is required.';
            if (!national) nextErrors.national = 'National area is required.';
            if (!regional) nextErrors.regional = 'Regional area is required.';
            if (!local) nextErrors.local = 'Local area is required.';
        }
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            setErrorText('Please fix the highlighted fields.');
            return;
        }
        setStep(2);
    };

    const handleAccountSubmit = () => {
        setErrorText('');
        setFieldErrors({});
        const nextErrors: Record<string, string> = {};
        if (!email) nextErrors.email = 'Email is required.';
        if (!password) nextErrors.password = 'Password is required.';
        if (!confirmPassword) nextErrors.confirmPassword = 'Please confirm password.';
        if (password && confirmPassword && password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
        if (!accountType) nextErrors.accountType = 'Choose personal or business.';
        const m = parseInt(birthMonth, 10);
        const d = parseInt(birthDay, 10);
        const y = parseInt(birthYear, 10);
        if (!m || !d || !y) {
            nextErrors.birthdate = 'Date of birth is required.';
        }
        const dob = new Date(y, m - 1, d);
        if (!Number.isNaN(dob.getTime())) {
            const now = new Date();
            let computedAge = now.getFullYear() - dob.getFullYear();
            const monthDelta = now.getMonth() - dob.getMonth();
            if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) computedAge--;
            if (computedAge < 13) {
                nextErrors.birthdate = 'You must be at least 13 years old.';
            }
        }
        if (!acceptedTerms) nextErrors.terms = 'You must accept Terms.';
        if (!acceptedGuidelines) nextErrors.guidelines = 'You must accept Community Guidelines.';
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            setErrorText('Please fix the highlighted fields.');
            return;
        }
        setStep(3);
    };

    const handleProfilePictureSubmit = async () => {
        setBusy(true);
        setErrorText('');
        const preferredLocations = preferredLocationsInput
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .slice(0, 12);
        const handle = `${name.trim().split(/\s+/)[0] || name.trim()}@${regional}`;
        const userData = {
            name: name.trim(),
            email: email.trim(),
            password: password,
            age: undefined,
            interests: interests,
            local: local,
            regional: regional,
            national: national,
            handle,
            countryFlag: countryFlag.trim(),
            avatarUrl: profilePicture,
            placesTraveled: preferredLocations.length > 0 ? preferredLocations : undefined,
            accountType,
            termsAcceptedAt: new Date().toISOString(),
            guidelinesAcceptedAt: new Date().toISOString(),
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
                try {
                    await AsyncStorage.setItem('authToken', apiResponse.token);
                } catch {
                    // ignore
                }
            }
        } catch {
            // keep local registration fallback
        }

        await saveLocalRegistration(email.trim(), password, userData);
        login(userData);
        setBusy(false);
        navigation.replace('Home');
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

    const toggleInterest = (interest: string) => {
        setInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.form}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Gazetteer</Text>
                        <Text style={styles.subtitle}>
                            {mode === 'login'
                                ? 'Sign in to continue'
                                : step === 1
                                    ? 'GPS-focused news feeds powered by location'
                                    : step === 2
                                        ? 'Complete your account details'
                                        : 'Add a profile picture'}
                        </Text>

                        <View style={styles.modeRow}>
                            <TouchableOpacity
                                onPress={() => setMode('signup')}
                                style={[styles.modePill, mode === 'signup' && styles.modePillActive]}
                            >
                                <Text style={[styles.modePillText, mode === 'signup' && styles.modePillTextActive]}>Sign up</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setMode('login')}
                                style={[styles.modePill, mode === 'login' && styles.modePillActive]}
                            >
                                <Text style={[styles.modePillText, mode === 'login' && styles.modePillTextActive]}>Sign in</Text>
                            </TouchableOpacity>
                        </View>

                        {mode === 'signup' && (
                            <View style={styles.stepIndicators}>
                                <View style={[styles.stepIndicator, step >= 1 && styles.stepIndicatorActive, { width: step >= 1 ? 80 : 40 }]} />
                                <View style={[styles.stepIndicator, step >= 2 && styles.stepIndicatorActive, { width: step >= 2 ? 80 : 40 }]} />
                                <View style={[styles.stepIndicator, step >= 3 && styles.stepIndicatorActive, { width: step >= 3 ? 80 : 40 }]} />
                            </View>
                        )}
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
                            />
                            {!!getFieldError('loginEmail') && <Text style={styles.fieldErrorText}>{getFieldError('loginEmail')}</Text>}
                            <View style={styles.passwordRow}>
                                <TextInput
                                    value={loginPassword}
                                    onChangeText={setLoginPassword}
                                    placeholder="Password"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.input, { flex: 1 }]}
                                    secureTextEntry={!showLoginPassword}
                                />
                                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowLoginPassword((v) => !v)}>
                                    <Icon name={showLoginPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('loginPassword') && <Text style={styles.fieldErrorText}>{getFieldError('loginPassword')}</Text>}
                            <TouchableOpacity onPress={() => setForgotOpen(true)}>
                                <Text style={styles.forgotText}>Forgot password?</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleLoginSubmit}
                                style={styles.submitButton}
                                disabled={busy}
                            >
                                <Text style={styles.submitButtonText}>{busy ? 'Signing in...' : 'Sign in'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Step 1: Location */}
                    {mode === 'signup' && step === 1 && (
                        <View style={styles.stepContent}>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Full Name"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                            />
                            {!!getFieldError('name') && <Text style={styles.fieldErrorText}>{getFieldError('name')}</Text>}

                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={national}
                                    onValueChange={setNational}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="National Area" value="" />
                                    {nationalOptions.map(option => (
                                        <Picker.Item key={option} label={option} value={option} />
                                    ))}
                                </Picker>
                            </View>
                            {!!getFieldError('national') && <Text style={styles.fieldErrorText}>{getFieldError('national')}</Text>}

                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={regional}
                                    onValueChange={setRegional}
                                    enabled={!!national && !loadingRegions}
                                    style={styles.picker}
                                >
                                    <Picker.Item 
                                        label={loadingRegions ? 'Loading regions...' : national ? 'Regional Area' : 'Select national area first'} 
                                        value="" 
                                    />
                                    {regionalOptions.map(option => (
                                        <Picker.Item key={option} label={option} value={option} />
                                    ))}
                                </Picker>
                            </View>
                            {!!getFieldError('regional') && <Text style={styles.fieldErrorText}>{getFieldError('regional')}</Text>}

                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={local}
                                    onValueChange={setLocal}
                                    enabled={!!regional && !loadingCities}
                                    style={styles.picker}
                                >
                                    <Picker.Item 
                                        label={loadingCities ? 'Loading local areas...' : !regional ? 'Select regional area first' : localOptions.length === 0 ? 'No local areas found' : 'Local Area'} 
                                        value="" 
                                    />
                                    {localOptions.map(option => (
                                        <Picker.Item key={option} label={option} value={option} />
                                    ))}
                                </Picker>
                            </View>
                            {!!getFieldError('local') && <Text style={styles.fieldErrorText}>{getFieldError('local')}</Text>}

                            <TextInput
                                value={countryFlag}
                                onChangeText={setCountryFlag}
                                placeholder="Country Flag (emoji)"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                maxLength={8}
                            />
                        </View>
                    )}

                    {/* Step 2: Account */}
                    {mode === 'signup' && step === 2 && (
                        <View style={styles.stepContent}>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Email"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            {!!getFieldError('email') && <Text style={styles.fieldErrorText}>{getFieldError('email')}</Text>}

                            <View style={styles.passwordRow}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Password"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.input, { flex: 1 }]}
                                    secureTextEntry={!showSignupPassword}
                                />
                                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowSignupPassword((v) => !v)}>
                                    <Icon name={showSignupPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('password') && <Text style={styles.fieldErrorText}>{getFieldError('password')}</Text>}

                            <View style={styles.passwordRow}>
                                <TextInput
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Confirm Password"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.input, { flex: 1 }]}
                                    secureTextEntry={!showSignupConfirmPassword}
                                />
                                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowSignupConfirmPassword((v) => !v)}>
                                    <Icon name={showSignupConfirmPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('confirmPassword') && <Text style={styles.fieldErrorText}>{getFieldError('confirmPassword')}</Text>}

                            <View style={styles.birthdateRow}>
                                <TextInput
                                    value={birthMonth}
                                    onChangeText={setBirthMonth}
                                    placeholder="MM"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.input, styles.birthInput]}
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                                <TextInput
                                    value={birthDay}
                                    onChangeText={setBirthDay}
                                    placeholder="DD"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.input, styles.birthInput]}
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                                <TextInput
                                    value={birthYear}
                                    onChangeText={setBirthYear}
                                    placeholder="YYYY"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.input, styles.birthInputLarge]}
                                    keyboardType="numeric"
                                    maxLength={4}
                                />
                            </View>
                            {!!getFieldError('birthdate') && <Text style={styles.fieldErrorText}>{getFieldError('birthdate')}</Text>}

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
                            {!!getFieldError('accountType') && <Text style={styles.fieldErrorText}>{getFieldError('accountType')}</Text>}

                            <TextInput
                                value={preferredLocationsInput}
                                onChangeText={setPreferredLocationsInput}
                                placeholder="Preferred locations (comma separated)"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                            />

                            <View style={styles.interestsContainer}>
                                <Text style={styles.interestsLabel}>Select up to 5 interests</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue=""
                                        onValueChange={(value) => {
                                            if (value && !interests.includes(value) && interests.length < 5) {
                                                toggleInterest(value);
                                            }
                                        }}
                                        enabled={interests.length < 5}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Select an interest" value="" />
                                        {interestOptions
                                            .filter(interest => !interests.includes(interest))
                                            .map(interest => (
                                                <Picker.Item key={interest} label={interest} value={interest} />
                                            ))}
                                    </Picker>
                                </View>

                                {interests.length > 0 && (
                                    <View style={styles.interestsChips}>
                                        {interests.map(interest => (
                                            <TouchableOpacity
                                                key={interest}
                                                onPress={() => toggleInterest(interest)}
                                                style={styles.interestChip}
                                            >
                                                <Text style={styles.interestChipText}>{interest}</Text>
                                                <Icon name="close" size={12} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedTerms((v) => !v)}>
                                <Icon name={acceptedTerms ? 'checkbox' : 'square-outline'} size={18} color={acceptedTerms ? '#22C55E' : '#9CA3AF'} />
                                <Text style={styles.checkLabel}>I accept Terms & Conditions</Text>
                            </TouchableOpacity>
                            {!!getFieldError('terms') && <Text style={styles.fieldErrorText}>{getFieldError('terms')}</Text>}
                            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedGuidelines((v) => !v)}>
                                <Icon name={acceptedGuidelines ? 'checkbox' : 'square-outline'} size={18} color={acceptedGuidelines ? '#22C55E' : '#9CA3AF'} />
                                <Text style={styles.checkLabel}>I accept Community Guidelines</Text>
                            </TouchableOpacity>
                            {!!getFieldError('guidelines') && <Text style={styles.fieldErrorText}>{getFieldError('guidelines')}</Text>}
                        </View>
                    )}

                    {/* Step 3: Profile Picture */}
                    {mode === 'signup' && step === 3 && (
                        <View style={styles.stepContent}>
                            <View style={styles.avatarContainer}>
                                <Avatar
                                    src={profilePicture || undefined}
                                    name={name || 'User'}
                                    size="xl"
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleProfilePictureSelect}
                                style={styles.photoButton}
                            >
                                <Icon name="camera" size={20} color="#FFFFFF" />
                                <Text style={styles.photoButtonText}>Choose Photo</Text>
                            </TouchableOpacity>

                            {profilePicture && (
                                <TouchableOpacity
                                    onPress={() => setProfilePicture(null)}
                                    style={styles.removeButton}
                                >
                                    <Icon name="close" size={20} color="#111827" />
                                    <Text style={styles.removeButtonText}>Remove Photo</Text>
                                </TouchableOpacity>
                            )}

                            <Text style={styles.photoHint}>
                                Your initials will be used if no photo is selected
                            </Text>
                        </View>
                    )}

                    {/* Footer */}
                    {mode === 'signup' && (
                        <View style={styles.footer}>
                            <TouchableOpacity
                                onPress={step === 1 ? handleLocationSubmit : step === 2 ? handleAccountSubmit : handleProfilePictureSubmit}
                                style={styles.submitButton}
                                disabled={busy}
                            >
                                <Text style={styles.submitButtonText}>
                                    {busy ? 'Please wait...' : step === 1 ? 'Next' : step === 2 ? 'Next' : 'Create account'}
                                </Text>
                            </TouchableOpacity>

                            {(step === 2 || step === 3) && (
                                <TouchableOpacity
                                    onPress={() => setStep(step - 1)}
                                    style={styles.backButton}
                                >
                                    <Text style={styles.backButtonText}>Back</Text>
                                </TouchableOpacity>
                            )}

                            <Text style={styles.termsText}>
                                By signing up, you agree to terms and community guidelines.
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
    },
    form: {
        backgroundColor: '#000000',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        minHeight: 600,
    },
    header: {
        padding: 40,
        paddingBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '300',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 24,
        textAlign: 'center',
    },
    modeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    modePill: {
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: '#111827',
    },
    modePillActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    modePillText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
    modePillTextActive: {
        color: '#111827',
    },
    errorText: {
        color: '#FCA5A5',
        textAlign: 'center',
        fontSize: 12,
        marginBottom: 8,
        paddingHorizontal: 20,
    },
    fieldErrorText: {
        color: '#FCA5A5',
        fontSize: 11,
        marginTop: -6,
        marginBottom: 2,
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    eyeButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
        justifyContent: 'center',
    },
    forgotText: {
        color: '#93C5FD',
        fontSize: 12,
        textAlign: 'right',
        marginBottom: 8,
    },
    stepIndicators: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    stepIndicator: {
        height: 4,
        borderRadius: 2,
        backgroundColor: '#374151',
    },
    stepIndicatorActive: {
        backgroundColor: '#3B82F6',
    },
    stepContent: {
        flex: 1,
        padding: 40,
        gap: 12,
    },
    input: {
        width: '100%',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#111827',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#F9FAFB',
    },
    pickerContainer: {
        width: '100%',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#111827',
        overflow: 'hidden',
    },
    picker: {
        width: '100%',
        color: '#F9FAFB',
    },
    interestsContainer: {
        marginTop: 8,
    },
    birthdateRow: {
        flexDirection: 'row',
        gap: 8,
    },
    birthInput: {
        flex: 1,
    },
    birthInputLarge: {
        flex: 1.4,
    },
    accountTypeRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 2,
    },
    accountTypePill: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingVertical: 10,
        alignItems: 'center',
    },
    accountTypePillActive: {
        borderColor: '#FFFFFF',
        backgroundColor: '#1F2937',
    },
    accountTypeText: {
        color: '#D1D5DB',
        fontSize: 13,
        fontWeight: '600',
    },
    accountTypeTextActive: {
        color: '#FFFFFF',
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    checkLabel: {
        color: '#D1D5DB',
        fontSize: 12,
    },
    interestsLabel: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 12,
    },
    interestsChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    interestChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#3B82F6',
        borderRadius: 4,
    },
    interestChipText: {
        color: '#FFFFFF',
        fontSize: 12,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    photoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        paddingVertical: 10,
        backgroundColor: '#3B82F6',
        borderRadius: 4,
    },
    photoButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    removeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        paddingVertical: 10,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginTop: 12,
    },
    removeButtonText: {
        color: '#111827',
        fontSize: 14,
        fontWeight: '600',
    },
    photoHint: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
    },
    footer: {
        padding: 40,
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#FFFFFF',
        gap: 12,
    },
    submitButton: {
        width: '100%',
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#111827',
        fontSize: 14,
        fontWeight: '600',
    },
    backButton: {
        width: '100%',
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    backButtonText: {
        color: '#111827',
        fontSize: 14,
        fontWeight: '600',
    },
    termsText: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 16,
    },
    forgotModalCard: {
        margin: 24,
        marginTop: '40%',
        backgroundColor: '#030712',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#374151',
        padding: 16,
        gap: 12,
    },
    forgotTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    forgotActions: {
        flexDirection: 'row',
        gap: 8,
    },
});









