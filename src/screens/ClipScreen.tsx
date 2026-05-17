import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import * as ImagePicker from 'react-native-image-picker';

const ClipScreen: React.FC = ({ navigation }: any) => {
    const openCapturedMedia = (uri: string | undefined, mediaType: 'image' | 'video') => {
        if (!uri) return;
        if (mediaType === 'video') {
            navigation.navigate('GalleryPreview', { mediaUrl: uri, mediaType: 'video' });
            return;
        }
        navigation.navigate('CreateComposer', { mediaUrl: uri, mediaType: 'image' });
    };

    const handleTakePhoto = () => {
        ImagePicker.launchCamera(
            {
                mediaType: 'photo',
                quality: 0.8,
            },
            (response) => {
                if (response.assets && response.assets[0]?.uri) {
                    openCapturedMedia(response.assets[0].uri, 'image');
                }
            }
        );
    };

    const handleRecordVideo = () => {
        ImagePicker.launchCamera(
            {
                mediaType: 'video',
                quality: 0.8,
            },
            (response) => {
                if (response.assets && response.assets[0]?.uri) {
                    openCapturedMedia(response.assets[0].uri, 'video');
                }
            }
        );
    };

    const handleChooseFromGallery = () => {
        ImagePicker.launchImageLibrary(
            {
                mediaType: 'mixed',
                quality: 0.8,
            },
            (response) => {
                if (response.assets && response.assets[0]) {
                    const asset = response.assets[0];
                    const isVideo = asset.type?.startsWith('video');
                    openCapturedMedia(asset.uri, isVideo ? 'video' : 'image');
                }
            }
        );
    };

    const handleGoLive = () => {
        navigation.navigate('Live');
    };

    const handleTextStory = () => {
        navigation.navigate('TextOnlyCreate');
    };

    return (
        <GazetteerScreenShell contentStyle={styles.content}>
            <View style={styles.inner}>
                <Text style={styles.title}>Create Clip</Text>

                <View style={styles.optionsContainer}>
                    <TouchableOpacity onPress={handleTakePhoto} style={styles.optionButton}>
                        <Icon name="camera" size={32} color="#f472b6" />
                        <Text style={styles.optionText}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRecordVideo} style={styles.optionButton}>
                        <Icon name="videocam" size={32} color="#f472b6" />
                        <Text style={styles.optionText}>Record Video</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleChooseFromGallery} style={styles.optionButton}>
                        <Icon name="image" size={32} color="#f472b6" />
                        <Text style={styles.optionText}>Choose from Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleGoLive} style={styles.optionButton}>
                        <Icon name="radio" size={32} color="#f472b6" />
                        <Text style={styles.optionText}>Go Live</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleTextStory} style={styles.optionButton}>
                        <Icon name="text" size={32} color="#f472b6" />
                        <Text style={styles.optionText}>Text Story</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </GazetteerScreenShell>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    inner: {
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 32,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
    },
    optionButton: {
        width: 140,
        height: 140,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        margin: 8,
        ...glassPanel,
    },
    optionText: {
        fontSize: 14,
        color: '#FFFFFF',
        marginTop: 8,
        textAlign: 'center',
        fontWeight: '500',
    },
});

export default ClipScreen;
