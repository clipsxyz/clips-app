import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';

const ClipScreen: React.FC = ({ navigation }: any) => {
    const handleTakePhoto = () => {
        ImagePicker.launchCamera(
            {
                mediaType: 'photo',
                quality: 0.8,
            },
            (response) => {
                if (response.assets && response.assets[0]) {
                    navigation.navigate('Create', { mediaUrl: response.assets[0].uri, mediaType: 'image' });
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
                if (response.assets && response.assets[0]) {
                    navigation.navigate('Create', { videoUrl: response.assets[0].uri, mediaType: 'video' });
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
                    navigation.navigate('Create', {
                        mediaUrl: asset.uri,
                        videoUrl: asset.type?.startsWith('video') ? asset.uri : undefined,
                        mediaType: asset.type?.startsWith('video') ? 'video' : 'image',
                    });
                }
            }
        );
    };

    const handleGoLive = () => {
        navigation.navigate('Live');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                <Text style={styles.title}>Create Clip</Text>

                <View style={styles.optionsContainer}>
                    <TouchableOpacity onPress={handleTakePhoto} style={styles.optionButton}>
                        <Icon name="camera" size={32} color="#8B5CF6" />
                        <Text style={styles.optionText}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRecordVideo} style={styles.optionButton}>
                        <Icon name="videocam" size={32} color="#8B5CF6" />
                        <Text style={styles.optionText}>Record Video</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleChooseFromGallery} style={styles.optionButton}>
                        <Icon name="image" size={32} color="#8B5CF6" />
                        <Text style={styles.optionText}>Choose from Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleGoLive} style={styles.optionButton}>
                        <Icon name="radio" size={32} color="#8B5CF6" />
                        <Text style={styles.optionText}>Go Live</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
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
        backgroundColor: '#1F2937',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        margin: 8,
        borderWidth: 1,
        borderColor: '#374151',
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
