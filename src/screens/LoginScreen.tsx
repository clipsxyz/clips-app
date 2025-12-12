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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'react-native-image-picker';
import { useAuth } from '../context/Auth';
import { fetchRegionsForCountry, fetchCitiesForRegion } from '../utils/googleMaps';
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
    const [step, setStep] = useState(1);

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
    const [age, setAge] = useState('');
    const [interests, setInterests] = useState<string[]>([]);

    // Step 3: Profile picture
    const [profilePicture, setProfilePicture] = useState<string | null>(null);

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

    const handleLocationSubmit = () => {
        if (!name || !local || !regional || !national) {
            Alert.alert('Error', 'Please fill in all location fields');
            return;
        }
        setStep(2);
    };

    const handleAccountSubmit = () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all required account fields');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        if (age && parseInt(age) < 13) {
            Alert.alert('Error', 'You must be at least 13 years old');
            return;
        }
        setStep(3);
    };

    const handleProfilePictureSubmit = () => {
        const userData = {
            name: name.trim(),
            email: email.trim(),
            password: password,
            age: age ? parseInt(age) : undefined,
            interests: interests,
            local: local,
            regional: regional,
            national: national,
            handle: `${name.trim()}@${local}`,
            countryFlag: countryFlag.trim(),
            avatarUrl: profilePicture
        };

        login(userData);
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
                            {step === 1 ? 'GPS-focused news feeds powered by location' : 
                             step === 2 ? 'Complete your profile' : 
                             'Add a profile picture'}
                        </Text>
                        
                        {/* Step Indicators */}
                        <View style={styles.stepIndicators}>
                            <View style={[styles.stepIndicator, step >= 1 && styles.stepIndicatorActive, { width: step >= 1 ? 80 : 40 }]} />
                            <View style={[styles.stepIndicator, step >= 2 && styles.stepIndicatorActive, { width: step >= 2 ? 80 : 40 }]} />
                            <View style={[styles.stepIndicator, step >= 3 && styles.stepIndicatorActive, { width: step >= 3 ? 80 : 40 }]} />
                        </View>
                    </View>

                    {/* Step 1: Location */}
                    {step === 1 && (
                        <View style={styles.stepContent}>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Full Name"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                            />

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
                    {step === 2 && (
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

                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Password"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                secureTextEntry
                            />

                            <TextInput
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirm Password"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                secureTextEntry
                            />

                            <TextInput
                                value={age}
                                onChangeText={setAge}
                                placeholder="Age (optional)"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                keyboardType="numeric"
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
                        </View>
                    )}

                    {/* Step 3: Profile Picture */}
                    {step === 3 && (
                        <View style={styles.stepContent}>
                            <View style={styles.avatarContainer}>
                                <Avatar
                                    src={profilePicture || undefined}
                                    name={name || 'User'}
                                    size={80}
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
                    <View style={styles.footer}>
                        <TouchableOpacity
                            onPress={step === 1 ? handleLocationSubmit : step === 2 ? handleAccountSubmit : handleProfilePictureSubmit}
                            style={styles.submitButton}
                        >
                            <Text style={styles.submitButtonText}>
                                {step === 1 ? 'Next' : step === 2 ? 'Next' : 'Sign Up'}
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
                            {step === 1 
                                ? 'By signing up, you agree to the terms and conditions and community guidelines'
                                : 'By signing up, you agree to connect with your local community'
                            }
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
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
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#F9FAFB',
    },
    pickerContainer: {
        width: '100%',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#374151',
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
        borderTopColor: '#374151',
        gap: 12,
    },
    submitButton: {
        width: '100%',
        paddingVertical: 10,
        backgroundColor: '#3B82F6',
        borderRadius: 4,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    backButton: {
        width: '100%',
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
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
});




