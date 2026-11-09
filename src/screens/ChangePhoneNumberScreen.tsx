import React, { useState } from 'react';
import { gazetteerAlert } from '../utils/gazetteerAlertNative';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { updateAccountPhone } from '../api/client';
import { ox } from '../constants/nativeOpticalScale';
import {
    applyFirebasePhoneUpdate,
    firebasePhoneErrorMessage,
    requestFirebasePhoneUpdate,
} from '../services/firebasePhoneAuth.native';
import { gazetteerHeader, glassPanel, glassSurface } from '../theme/gazetteerAmbientNative';

function toE164(countryCode: string, nationalNumber: string): string {
    const digits = nationalNumber.replace(/\D+/g, '');
    const rawCode = countryCode.trim();
    const code = rawCode.startsWith('+') ? rawCode : `+${rawCode.replace(/\D+/g, '')}`;
    return `${code}${digits}`;
}

export default function ChangePhoneNumberScreen({ navigation }: { navigation: { goBack: () => void } }) {
    const [step, setStep] = useState<'phone' | 'code'>('phone');
    const [countryCode, setCountryCode] = useState('+353');
    const [phoneInput, setPhoneInput] = useState('');
    const [otpInput, setOtpInput] = useState('');
    const [pendingPhone, setPendingPhone] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [busy, setBusy] = useState(false);

    const sendCode = async () => {
        if (busy) return;
        const phone = toE164(countryCode, phoneInput);
        if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
            gazetteerAlert('Invalid number', 'Enter a valid phone number, including the country code.');
            return;
        }
        setBusy(true);
        try {
            const sent = await requestFirebasePhoneUpdate(phone);
            setPendingPhone(phone);
            setVerificationId(sent.verificationId);
            setOtpInput(sent.code && /^\d{6}$/.test(sent.code) ? sent.code : '');
            setStep('code');
        } catch (error) {
            gazetteerAlert('Send failed', firebasePhoneErrorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const confirmCode = async () => {
        if (busy) return;
        const code = otpInput.replace(/\D+/g, '');
        if (code.length !== 6 || !verificationId) {
            gazetteerAlert('Invalid code', 'Enter the 6-digit code.');
            return;
        }
        setBusy(true);
        try {
            const idToken = await applyFirebasePhoneUpdate(verificationId, code);
            const saved = await updateAccountPhone(pendingPhone, idToken);
            const shown = saved.phone_number || pendingPhone;
            gazetteerAlert('Phone updated', `Your number is now ${shown}.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error) {
            gazetteerAlert('Update failed', firebasePhoneErrorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} disabled={busy}>
                    <Icon name="arrow-back" size={ox(18)} color="#FFFFFF" />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Change phone</Text>
                <View style={{ width: ox(50) }} />
            </View>

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.card}>
                    {step === 'phone' ? (
                        <>
                            <Text style={styles.title}>New phone number</Text>
                            <Text style={styles.body}>
                                We'll text a 6-digit code to this number. Your Gazetteer account stays signed in.
                            </Text>
                            <View style={styles.phoneRow}>
                                <TextInput
                                    value={countryCode}
                                    onChangeText={setCountryCode}
                                    placeholder="+353"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                    autoCorrect={false}
                                    style={styles.countryInput}
                                />
                                <TextInput
                                    value={phoneInput}
                                    onChangeText={setPhoneInput}
                                    placeholder="Phone number"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                    style={styles.phoneInput}
                                />
                            </View>
                            <TouchableOpacity
                                style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
                                onPress={() => void sendCode()}
                                disabled={busy}
                            >
                                {busy ? (
                                    <ActivityIndicator color="#0A194E" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Send code</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.title}>Enter 6-digit code</Text>
                            <Text style={styles.body}>Your code was sent to {pendingPhone}</Text>
                            <TextInput
                                value={otpInput}
                                onChangeText={setOtpInput}
                                placeholder="000000"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="number-pad"
                                maxLength={6}
                                style={styles.codeInput}
                            />
                            <TouchableOpacity
                                style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
                                onPress={() => void confirmCode()}
                                disabled={busy}
                            >
                                {busy ? (
                                    <ActivityIndicator color="#0A194E" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Update number</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => {
                                    setStep('phone');
                                    setOtpInput('');
                                    setVerificationId('');
                                }}
                                disabled={busy}
                            >
                                <Text style={styles.secondaryButtonText}>Use a different number</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        ...gazetteerHeader,
    },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: ox(6) },
    backText: { color: '#FFFFFF', fontSize: ox(14), fontWeight: '600' },
    headerTitle: { color: '#FFFFFF', fontSize: ox(16), fontWeight: '700' },
    card: {
        margin: ox(16),
        borderRadius: ox(16),
        padding: ox(16),
        ...glassPanel,
    },
    title: { color: '#FFFFFF', fontSize: ox(20), fontWeight: '700' },
    body: { marginTop: ox(8), color: '#D1D5DB', fontSize: ox(14), lineHeight: ox(20) },
    phoneRow: { flexDirection: 'row', marginTop: ox(16), gap: ox(8) },
    countryInput: {
        width: ox(84),
        borderRadius: ox(12),
        paddingHorizontal: ox(12),
        paddingVertical: ox(12),
        color: '#FFFFFF',
        fontSize: ox(16),
        ...glassSurface,
    },
    phoneInput: {
        flex: 1,
        borderRadius: ox(12),
        paddingHorizontal: ox(12),
        paddingVertical: ox(12),
        color: '#FFFFFF',
        fontSize: ox(16),
        ...glassSurface,
    },
    codeInput: {
        marginTop: ox(16),
        borderRadius: ox(12),
        paddingHorizontal: ox(12),
        paddingVertical: ox(14),
        color: '#FFFFFF',
        fontSize: ox(24),
        letterSpacing: ox(6),
        textAlign: 'center',
        ...glassSurface,
    },
    primaryButton: {
        marginTop: ox(16),
        borderRadius: ox(12),
        backgroundColor: '#6EE7B7',
        minHeight: ox(48),
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: '#0A194E', fontSize: ox(16), fontWeight: '700' },
    secondaryButton: { marginTop: ox(12), alignItems: 'center', paddingVertical: ox(10) },
    secondaryButtonText: { color: '#D1D5DB', fontSize: ox(14), fontWeight: '600' },
});
