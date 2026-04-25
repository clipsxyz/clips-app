import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import ImageCropPicker from 'react-native-image-crop-picker';
import { useAuth } from '../context/Auth';
import { createPost } from '../api/posts';
import { prepareMediaForPostNative } from '../utils/prepareMediaForPostNative';
import { saveDraft } from '../api/drafts';

export default function CreateScreen({ navigation, route }: any) {
    const { user } = useAuth();
    const isAddYoursFlow = !!route.params?.addYours;
    const isStory24Flow = !!route.params?.story24;
    const passedMedia = route.params?.videoUrl || route.params?.mediaUrl;
    const passedMediaType: 'image' | 'video' | null = route.params?.videoUrl
        ? 'video'
        : route.params?.mediaUrl
            ? (route.params?.mediaType === 'video' ? 'video' : 'image')
            : null;

    const normalizeMediaUri = (uri?: string | null): string | null => {
        if (!uri) return null;
        const trimmed = uri.trim();
        if (!trimmed) return null;
        if (
            trimmed.startsWith('file://') ||
            trimmed.startsWith('content://') ||
            trimmed.startsWith('ph://') ||
            trimmed.startsWith('http://') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('data:')
        ) {
            return trimmed;
        }
        return `file://${trimmed}`;
    };
    
    const [selectedMedia, setSelectedMedia] = useState<string | null>(normalizeMediaUri(passedMedia));
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(passedMediaType);
    const [text, setText] = useState('');
    const [location, setLocation] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [trimStart, setTrimStart] = useState<number>(Number(route.params?.trimStart || 0));
    const [trimEnd, setTrimEnd] = useState<number>(Number(route.params?.trimEnd || 0));
    const [videoCoverTime, setVideoCoverTime] = useState<number>(Number(route.params?.videoCoverTime || 0));
    const [storyAudience, setStoryAudience] = useState<'public' | 'close_friends' | 'only_me'>('public');
    const storyTextPresets = React.useMemo(
        () => [
            { id: 'none', label: 'Default', bg: '#1F2937' },
            { id: 'midnight', label: 'Midnight', bg: '#111827' },
            { id: 'violet', label: 'Violet', bg: '#312E81' },
            { id: 'sunset', label: 'Sunset', bg: '#7C2D12' },
        ],
        []
    );
    const [storyTextPresetId, setStoryTextPresetId] = useState<string>('none');
    const activeStoryPreset = storyTextPresets.find((preset) => preset.id === storyTextPresetId) || storyTextPresets[0];

    React.useEffect(() => {
        if (!isAddYoursFlow) return;
        setText((prev) => (prev && prev.trim().length > 0 ? prev : 'Add Yours: '));
    }, [isAddYoursFlow]);

    const handleSelectMedia = () => {
        Alert.alert('Choose media type', 'How would you like to add media?', [
            {
                text: 'Photo',
                onPress: async () => {
                    try {
                        const image = await ImageCropPicker.openPicker({
                            mediaType: 'photo',
                            cropping: true,
                            width: 1080,
                            height: 1350,
                            cropperToolbarTitle: 'Adjust photo',
                            cropperChooseText: 'Use Photo',
                            cropperCancelText: 'Cancel',
                            compressImageQuality: 0.9,
                        });
                        setSelectedMedia(normalizeMediaUri(image.path || null));
                        setMediaType('image');
                    } catch (err: any) {
                        if (err?.code !== 'E_PICKER_CANCELLED') {
                            console.error('Photo picker error:', err);
                        }
                    }
                },
            },
            {
                text: 'Video',
                onPress: () => {
                    ImagePicker.launchImageLibrary(
                        {
                            mediaType: 'video',
                            quality: 0.8,
                        },
                        (response) => {
                            if (response.assets && response.assets[0]) {
                                const asset = response.assets[0];
                                setSelectedMedia(normalizeMediaUri(asset.uri || null));
                                setMediaType('video');
                            }
                        }
                    );
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleTakePhoto = async () => {
        try {
            const image = await ImageCropPicker.openCamera({
                mediaType: 'photo',
                cropping: true,
                width: 1080,
                height: 1350,
                cropperToolbarTitle: 'Adjust photo',
                cropperChooseText: 'Use Photo',
                cropperCancelText: 'Cancel',
                compressImageQuality: 0.9,
            });
            setSelectedMedia(normalizeMediaUri(image.path || null));
            setMediaType('image');
        } catch (err: any) {
            if (err?.code !== 'E_PICKER_CANCELLED') {
                console.error('Camera picker error:', err);
            }
        }
    };

    const handlePost = async () => {
        if (!selectedMedia && !text.trim()) {
            Alert.alert('Error', 'Please add media or text to your post');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'Please log in to post');
            return;
        }

        setIsUploading(true);
        try {
            const preparedMedia = await prepareMediaForPostNative({
                mediaUrl: selectedMedia,
                mediaType,
            });

            await createPost(
                user.id,
                user.handle,
                text.trim(),
                location.trim() || user.regional || 'Unknown',
                preparedMedia.mediaUrl,
                preparedMedia.mediaType,
                undefined,
                preparedMedia.mediaUrl ? text.trim() || undefined : undefined,
                user.local,
                user.regional,
                user.national,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                preparedMedia.videoPosterUrl,
            );
            const storyAudienceLabel =
                storyAudience === 'close_friends' ? 'Close Friends' : storyAudience === 'only_me' ? 'Only Me' : 'Public';
            Alert.alert(
                'Success',
                isStory24Flow ? `Story 24 published (${storyAudienceLabel}).` : 'Post created successfully!',
                [
                {
                    text: 'OK',
                    onPress: () =>
                        navigation.navigate(isStory24Flow ? 'Stories' : 'Home', {
                            forceRefreshAt: Date.now(),
                        }),
                },
            ]);
        } catch (error: any) {
            console.error('Error creating post:', error);
            Alert.alert('Error', error?.message || 'Failed to create post');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!selectedMedia && !text.trim()) {
            Alert.alert('Nothing to save', 'Add media or text before saving a draft.');
            return;
        }
        if (isSavingDraft) return;
        setIsSavingDraft(true);
        try {
            await saveDraft({
                videoUrl: selectedMedia || '',
                videoDuration: mediaType === 'video' ? Math.max(trimEnd - trimStart, 0) : 0,
                caption: text.trim() || undefined,
                location: location.trim() || undefined,
                mediaType: mediaType || undefined,
                trimStart: mediaType === 'video' ? trimStart : undefined,
                trimEnd: mediaType === 'video' ? trimEnd : undefined,
            });
            Alert.alert('Saved', 'Draft saved to your profile drafts.');
        } catch (err: any) {
            Alert.alert('Draft failed', err?.message || 'Could not save draft.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isStory24Flow ? 'Create Story 24' : 'Create Post'}</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleSaveDraft} disabled={isSavingDraft || isUploading} style={styles.draftButton}>
                        {isSavingDraft ? (
                            <ActivityIndicator size="small" color="#9CA3AF" />
                        ) : (
                            <Text style={styles.draftButtonText}>Draft</Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handlePost}
                        disabled={isUploading}
                        style={styles.postButton}
                    >
                        {isUploading ? (
                            <ActivityIndicator size="small" color="#3B82F6" />
                        ) : (
                            <Text style={styles.postButtonText}>{isStory24Flow ? 'Share' : 'Post'}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {isAddYoursFlow && (
                    <View style={styles.addYoursBanner}>
                        <Icon name="sparkles" size={16} color="#111827" />
                        <Text style={styles.addYoursBannerText}>Add Yours mode</Text>
                    </View>
                )}
                {isStory24Flow && (
                    <View style={styles.addYoursBanner}>
                        <Icon name="location" size={16} color="#111827" />
                        <Text style={styles.addYoursBannerText}>Stories 24 mode</Text>
                    </View>
                )}
                {isStory24Flow && (
                    <View style={styles.storyControlsCard}>
                        <Text style={styles.storyControlsTitle}>Story audience</Text>
                        <View style={styles.storyAudienceRow}>
                            {[
                                { key: 'public', label: 'Public' },
                                { key: 'close_friends', label: 'Close Friends' },
                                { key: 'only_me', label: 'Only Me' },
                            ].map((item) => {
                                const selected = storyAudience === item.key;
                                return (
                                    <TouchableOpacity
                                        key={item.key}
                                        onPress={() => setStoryAudience(item.key as 'public' | 'close_friends' | 'only_me')}
                                        style={[styles.storyAudienceChip, selected && styles.storyAudienceChipActive]}
                                    >
                                        <Text style={[styles.storyAudienceChipText, selected && styles.storyAudienceChipTextActive]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={styles.storyControlsTitle}>Text style</Text>
                        <View style={styles.storyAudienceRow}>
                            {storyTextPresets.map((preset) => {
                                const selected = storyTextPresetId === preset.id;
                                return (
                                    <TouchableOpacity
                                        key={preset.id}
                                        onPress={() => setStoryTextPresetId(preset.id)}
                                        style={[
                                            styles.storyStyleChip,
                                            { backgroundColor: preset.bg },
                                            selected && styles.storyStyleChipActive,
                                        ]}
                                    >
                                        <Text style={styles.storyStyleChipText}>{preset.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
                {/* Media Selection */}
                {!selectedMedia && (
                    <View style={styles.mediaSelection}>
                        <TouchableOpacity
                            onPress={handleSelectMedia}
                            style={styles.mediaButton}
                        >
                            <Icon name="images" size={32} color="#8B5CF6" />
                            <Text style={styles.mediaButtonText}>Choose from Library</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleTakePhoto}
                            style={styles.mediaButton}
                        >
                            <Icon name="camera" size={32} color="#8B5CF6" />
                            <Text style={styles.mediaButtonText}>Take Photo</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Media Preview */}
                {selectedMedia && (
                    <View style={styles.mediaPreview}>
                        <Image
                            source={{ uri: selectedMedia }}
                            style={styles.previewImage}
                            resizeMode="contain"
                        />
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedMedia(null);
                                setMediaType(null);
                            }}
                            style={styles.removeMediaButton}
                        >
                            <Icon name="close-circle" size={32} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                )}
                {mediaType === 'video' && (
                    <View style={styles.videoMetaCard}>
                        <Text style={styles.videoMetaText}>
                            Trim: {Math.max(0, trimStart).toFixed(1)}s - {Math.max(trimEnd, trimStart).toFixed(1)}s
                        </Text>
                        <Text style={styles.videoMetaText}>Cover frame: {Math.max(0, videoCoverTime).toFixed(1)}s</Text>
                        <TouchableOpacity
                            style={styles.videoMetaReset}
                            onPress={() => {
                                setTrimStart(0);
                                setTrimEnd(0);
                                setVideoCoverTime(0);
                            }}
                        >
                            <Text style={styles.videoMetaResetText}>Reset preview edits</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Text Input */}
                <View style={styles.inputContainer}>
                    <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder="Write a caption..."
                        placeholderTextColor="#6B7280"
                        style={[styles.textInput, isStory24Flow && { backgroundColor: activeStoryPreset.bg }]}
                        multiline
                        numberOfLines={6}
                    />
                </View>

                {/* Location Input */}
                <View style={styles.inputContainer}>
                    <View style={styles.locationInputContainer}>
                        <Icon name="location" size={20} color="#8B5CF6" />
                        <TextInput
                            value={location}
                            onChangeText={setLocation}
                            placeholder="Add location"
                            placeholderTextColor="#6B7280"
                            style={styles.locationInput}
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    postButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    draftButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    draftButtonText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '700',
    },
    postButtonText: {
        color: '#3B82F6',
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    addYoursBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        borderRadius: 999,
        backgroundColor: '#FBBF24',
        paddingHorizontal: 10,
        paddingVertical: 6,
        margin: 16,
        marginBottom: 8,
    },
    addYoursBannerText: {
        color: '#111827',
        fontSize: 12,
        fontWeight: '700',
    },
    mediaSelection: {
        padding: 16,
        gap: 16,
    },
    mediaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 20,
        backgroundColor: '#1F2937',
        borderRadius: 12,
    },
    mediaButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
    storyControlsCard: {
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        padding: 12,
        gap: 10,
    },
    storyControlsTitle: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '700',
    },
    storyAudienceRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    storyAudienceChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#1F2937',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    storyAudienceChipActive: {
        borderColor: '#F8D26A',
        backgroundColor: '#3F2B07',
    },
    storyAudienceChipText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
    storyAudienceChipTextActive: {
        color: '#F8D26A',
    },
    storyStyleChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#4B5563',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    storyStyleChipActive: {
        borderColor: '#F8D26A',
    },
    storyStyleChipText: {
        color: '#F9FAFB',
        fontSize: 12,
        fontWeight: '600',
    },
    mediaPreview: {
        width: '100%',
        height: 400,
        backgroundColor: '#111827',
        position: 'relative',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    removeMediaButton: {
        position: 'absolute',
        top: 16,
        right: 16,
    },
    videoMetaCard: {
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        padding: 12,
        gap: 6,
    },
    videoMetaText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
    videoMetaReset: {
        marginTop: 4,
        alignSelf: 'flex-start',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#4B5563',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    videoMetaResetText: {
        color: '#F9FAFB',
        fontSize: 12,
        fontWeight: '700',
    },
    inputContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    textInput: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    locationInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 16,
    },
    locationInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
    },
});












