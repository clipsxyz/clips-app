import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LiveStreamInterface from '../components/LiveStreamInterface';
import { useLiveStreaming } from '../hooks/useLiveStreaming';

const LiveStreamScreen: React.FC = () => {
    const [isLiveStreaming, setIsLiveStreaming] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [streamTitle, setStreamTitle] = useState('');

    const { startStream, stopStream } = useLiveStreaming();

    const locations = [
        'Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford',
        'Kilkenny', 'Wexford', 'Sligo', 'Donegal', 'Mayo',
        'Clare', 'Kerry', 'Tipperary', 'Offaly', 'Westmeath',
        'Longford', 'Leitrim', 'Cavan', 'Monaghan', 'Louth',
        'Meath', 'Kildare', 'Wicklow', 'Carlow', 'Laois',
    ];

    const handleStartLive = async () => {
        if (!selectedLocation) {
            Alert.alert('Error', 'Please select a location');
            return;
        }

        if (!streamTitle.trim()) {
            Alert.alert('Error', 'Please enter a stream title');
            return;
        }

        try {
            await startStream({
                title: streamTitle.trim(),
                description: `Live from ${selectedLocation}`,
                category: 'General',
                tags: [selectedLocation.toLowerCase()],
                isPrivate: false,
                settings: {
                    allowComments: true,
                    allowReactions: true,
                    allowScreenShare: false,
                    recordStream: false,
                },
            });

            setIsLiveStreaming(true);
            setShowLocationModal(false);
        } catch (error) {
            console.error('Error starting live stream:', error);
            Alert.alert('Error', 'Failed to start live stream. Please check your camera and microphone permissions.');
        }
    };

    const handleEndLive = () => {
        Alert.alert(
            'End Live Stream',
            'Are you sure you want to end your live stream?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'End Stream',
                    style: 'destructive',
                    onPress: () => {
                        stopStream();
                        setIsLiveStreaming(false);
                        setSelectedLocation('');
                        setStreamTitle('');
                    },
                },
            ]
        );
    };

    const renderLocationItem = (location: string) => (
        <TouchableOpacity
            key={location}
            style={[
                styles.locationItem,
                selectedLocation === location && styles.selectedLocationItem,
            ]}
            onPress={() => setSelectedLocation(location)}
        >
            <Text
                style={[
                    styles.locationText,
                    selectedLocation === location && styles.selectedLocationText,
                ]}
            >
                {location}
            </Text>
            {selectedLocation === location && (
                <Icon name="checkmark" size={20} color="#8B5CF6" />
            )}
        </TouchableOpacity>
    );

    if (isLiveStreaming) {
        return (
            <LiveStreamInterface
                location={selectedLocation}
                onEndLive={handleEndLive}
                sessionId="current-stream"
            />
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Go Live</Text>
                    <Text style={styles.subtitle}>Share your moment with the world</Text>
                </View>

                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Stream Title</Text>
                        <TextInput
                            style={styles.textInput}
                            value={streamTitle}
                            onChangeText={setStreamTitle}
                            placeholder="What's happening?"
                            placeholderTextColor="#9CA3AF"
                            maxLength={100}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Location</Text>
                        <TouchableOpacity
                            style={styles.locationButton}
                            onPress={() => setShowLocationModal(true)}
                        >
                            <Text style={[styles.locationButtonText, selectedLocation && styles.locationButtonTextSelected]}>
                                {selectedLocation || 'Select Location'}
                            </Text>
                            <Icon name="chevron-down" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.featuresContainer}>
                        <Text style={styles.featuresTitle}>Live Stream Features</Text>
                        <View style={styles.featureItem}>
                            <Icon name="chatbubble" size={20} color="#8B5CF6" />
                            <Text style={styles.featureText}>Real-time comments</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Icon name="heart" size={20} color="#8B5CF6" />
                            <Text style={styles.featureText}>Live reactions</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Icon name="eye" size={20} color="#8B5CF6" />
                            <Text style={styles.featureText}>Viewer count</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.startButton, (!selectedLocation || !streamTitle.trim()) && styles.startButtonDisabled]}
                    onPress={handleStartLive}
                    disabled={!selectedLocation || !streamTitle.trim()}
                >
                    <Icon name="videocam" size={24} color="#FFFFFF" />
                    <Text style={styles.startButtonText}>Start Live Stream</Text>
                </TouchableOpacity>
            </View>

            {/* Location Selection Modal */}
            <Modal
                visible={showLocationModal}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Location</Text>
                        <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                            <Icon name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.locationsList}>
                        {locations.map(renderLocationItem)}
                    </View>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={[styles.confirmButton, !selectedLocation && styles.confirmButtonDisabled]}
                            onPress={() => setShowLocationModal(false)}
                            disabled={!selectedLocation}
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    formContainer: {
        flex: 1,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
    },
    locationButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    locationButtonText: {
        fontSize: 16,
        color: '#9CA3AF',
    },
    locationButtonTextSelected: {
        color: '#111827',
    },
    featuresContainer: {
        marginTop: 24,
    },
    featuresTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    featureText: {
        fontSize: 16,
        color: '#374151',
    },
    startButton: {
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 32,
    },
    startButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    startButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    locationsList: {
        flex: 1,
        paddingHorizontal: 16,
    },
    locationItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    selectedLocationItem: {
        backgroundColor: '#F3F4F6',
    },
    locationText: {
        fontSize: 16,
        color: '#111827',
    },
    selectedLocationText: {
        color: '#8B5CF6',
        fontWeight: '600',
    },
    modalFooter: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    confirmButton: {
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
});

export default LiveStreamScreen;
