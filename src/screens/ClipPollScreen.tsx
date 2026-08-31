import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import * as ImagePicker from 'react-native-image-picker';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { publishPollStory24 } from '../utils/publishStoryNative';
import { hapticSuccess } from '../utils/hapticsNative';
import { ox } from '../constants/nativeOpticalScale';

const OPTION_MAX = 26;

export default function ClipPollScreen({ navigation }: any) {
    const { user } = useAuth();
    const [question, setQuestion] = useState('');
    const [option1, setOption1] = useState('Yes');
    const [option2, setOption2] = useState('No');
    const [option3, setOption3] = useState('');
    const [showOption3, setShowOption3] = useState(false);
    const [backgroundUri, setBackgroundUri] = useState<string | null>(null);
    const [location, setLocation] = useState('');
    const [isPosting, setIsPosting] = useState(false);

    const pickBackground = () => {
        ImagePicker.launchImageLibrary(
            { mediaType: 'photo', quality: 0.8 },
            (response) => {
                if (response.didCancel) return;
                const uri = response.assets?.[0]?.uri;
                if (uri) setBackgroundUri(uri);
            },
        );
    };

    const handlePost = async () => {
        if (!user) {
            Alert.alert('Sign in required', 'Please log in to post a poll story.');
            return;
        }
        if (!question.trim()) {
            Alert.alert('Question required', 'Enter a question for your poll.');
            return;
        }
        if (!option1.trim() || !option2.trim()) {
            Alert.alert('Options required', 'Enter at least two poll options.');
            return;
        }
        if (showOption3 && !option3.trim()) {
            Alert.alert('Option 3', 'Enter the third option or remove it.');
            return;
        }
        if (isPosting) return;

        setIsPosting(true);
        try {
            await publishPollStory24({
                userId: user.id,
                userHandle: user.handle,
                question: question.trim(),
                option1: option1.trim(),
                option2: option2.trim(),
                option3: showOption3 && option3.trim() ? option3.trim() : undefined,
                backgroundUri: backgroundUri || undefined,
                location: location.trim() || undefined,
            });
            hapticSuccess();
            navigation.navigate('Stories', { forceRefreshAt: Date.now() });
        } catch (err: any) {
            Alert.alert('Poll failed', err?.message || 'Could not post poll story.');
        } finally {
            setIsPosting(false);
        }
    };

    const gradientBg = (
        <LinearGradient
            colors={['#2a1038', '#0b0711', '#1a2840']}
            style={StyleSheet.absoluteFill}
        />
    );

    return (
        <GazetteerScreenShell contentStyle={styles.shell}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <Icon name="close" size={ox(26)} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Create Poll</Text>
                    <TouchableOpacity onPress={pickBackground} style={styles.headerBtn}>
                        <Icon name="image-outline" size={ox(24)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.previewWrap}>
                    {backgroundUri ? (
                        <ImageBackground source={{ uri: backgroundUri }} style={styles.previewBg} resizeMode="cover">
                            {gradientBg}
                            <PollCard
                                question={question}
                                option1={option1}
                                option2={option2}
                                option3={showOption3 ? option3 : undefined}
                                onQuestionChange={setQuestion}
                                onOption1Change={(v) => v.length <= OPTION_MAX && setOption1(v)}
                                onOption2Change={(v) => v.length <= OPTION_MAX && setOption2(v)}
                                onOption3Change={(v) => v.length <= OPTION_MAX && setOption3(v)}
                                showOption3={showOption3}
                                onAddOption3={() => setShowOption3(true)}
                            />
                        </ImageBackground>
                    ) : (
                        <View style={styles.previewBg}>
                            {gradientBg}
                            <PollCard
                                question={question}
                                option1={option1}
                                option2={option2}
                                option3={showOption3 ? option3 : undefined}
                                onQuestionChange={setQuestion}
                                onOption1Change={(v) => v.length <= OPTION_MAX && setOption1(v)}
                                onOption2Change={(v) => v.length <= OPTION_MAX && setOption2(v)}
                                onOption3Change={(v) => v.length <= OPTION_MAX && setOption3(v)}
                                showOption3={showOption3}
                                onAddOption3={() => setShowOption3(true)}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.footer}>
                    <TextInput
                        style={styles.locationInput}
                        value={location}
                        onChangeText={setLocation}
                        placeholder="Location (optional)"
                        placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity
                        style={[styles.postBtn, isPosting && styles.postBtnDisabled]}
                        onPress={handlePost}
                        disabled={isPosting}
                    >
                        {isPosting ? (
                            <ActivityIndicator color="#111827" />
                        ) : (
                            <Text style={styles.postBtnText}>Post Poll</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </GazetteerScreenShell>
    );
}

function PollCard({
    question,
    option1,
    option2,
    option3,
    onQuestionChange,
    onOption1Change,
    onOption2Change,
    onOption3Change,
    showOption3,
    onAddOption3,
}: {
    question: string;
    option1: string;
    option2: string;
    option3?: string;
    onQuestionChange: (v: string) => void;
    onOption1Change: (v: string) => void;
    onOption2Change: (v: string) => void;
    onOption3Change: (v: string) => void;
    showOption3: boolean;
    onAddOption3: () => void;
}) {
    return (
        <ScrollView
            contentContainerStyle={styles.cardScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.pollCard}>
                <TextInput
                    style={styles.questionInput}
                    value={question}
                    onChangeText={onQuestionChange}
                    placeholder="Ask a question..."
                    placeholderTextColor="#6B7280"
                    maxLength={200}
                />
                <PollOptionInput value={option1} onChangeText={onOption1Change} />
                <PollOptionInput value={option2} onChangeText={onOption2Change} />
                {showOption3 ? (
                    <PollOptionInput value={option3 || ''} onChangeText={onOption3Change} />
                ) : (
                    <TouchableOpacity style={styles.addOptionBtn} onPress={onAddOption3}>
                        <Icon name="add" size={ox(18)} color="#374151" />
                        <Text style={styles.addOptionText}>Add option</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );
}

function PollOptionInput({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
    return (
        <View style={styles.optionWrap}>
            <TextInput
                style={styles.optionInput}
                value={value}
                onChangeText={onChangeText}
                placeholder=""
                placeholderTextColor="#9CA3AF"
                maxLength={OPTION_MAX}
            />
            <Text style={styles.optionCount}>{value.length}/{OPTION_MAX}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    shell: { flex: 1 },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
    },
    headerBtn: { padding: ox(8) },
    headerTitle: { color: '#FFFFFF', fontSize: ox(17), fontWeight: '700' },
    previewWrap: { flex: 1, marginHorizontal: ox(12), borderRadius: ox(16), overflow: 'hidden' },
    previewBg: { flex: 1, justifyContent: 'center' },
    cardScroll: { flexGrow: 1, justifyContent: 'center', padding: ox(20) },
    pollCard: {
        ...glassPanel,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: ox(20),
        padding: ox(20),
    },
    questionInput: {
        fontSize: ox(17),
        fontWeight: '600',
        color: '#111827',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: ox(12),
        paddingHorizontal: ox(14),
        paddingVertical: ox(12),
        marginBottom: ox(16),
    },
    optionWrap: { marginBottom: ox(12) },
    optionInput: {
        fontSize: ox(16),
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: ox(12),
        paddingHorizontal: ox(14),
        paddingVertical: ox(14),
    },
    optionCount: { textAlign: 'center', color: '#6B7280', fontSize: ox(11), marginTop: ox(4) },
    addOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(6),
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#D1D5DB',
        borderRadius: ox(12),
        paddingVertical: ox(12),
    },
    addOptionText: { color: '#374151', fontWeight: '600' },
    footer: { padding: ox(16), gap: ox(10) },
    locationInput: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: ox(12),
        paddingHorizontal: ox(14),
        paddingVertical: ox(10),
        color: '#FFFFFF',
    },
    postBtn: {
        backgroundColor: '#FFFFFF',
        borderRadius: ox(999),
        paddingVertical: ox(14),
        alignItems: 'center',
    },
    postBtnDisabled: { opacity: 0.7 },
    postBtnText: { color: '#111827', fontWeight: '700', fontSize: ox(16) },
});
