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

export default function CreateScreen({ navigation, route }: any) {
    const { user } = useAuth();
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
            Alert.alert('Success', 'Post created successfully!', [
                {
                    text: 'OK',
                    onPress: () =>
                        navigation.navigate('Feed', {
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Post</Text>
                <TouchableOpacity
                    onPress={handlePost}
                    disabled={isUploading}
                    style={styles.postButton}
                >
                    {isUploading ? (
                        <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (
                        <Text style={styles.postButtonText}>Post</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
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

                {/* Text Input */}
                <View style={styles.inputContainer}>
                    <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder="Write a caption..."
                        placeholderTextColor="#6B7280"
                        style={styles.textInput}
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
    postButtonText: {
        color: '#3B82F6',
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flex: 1,
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












