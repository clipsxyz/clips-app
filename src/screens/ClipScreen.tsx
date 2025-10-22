import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

const ClipScreen: React.FC = () => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Create Clip</Text>

                <View style={styles.optionsContainer}>
                    <TouchableOpacity style={styles.optionButton}>
                        <Icon name="camera" size={32} color="#8B5CF6" />
                        <Text style={styles.optionText}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.optionButton}>
                        <Icon name="videocam" size={32} color="#8B5CF6" />
                        <Text style={styles.optionText}>Record Video</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.optionButton}>
                        <Icon name="image" size={32} color="#8B5CF6" />
                        <Text style={styles.optionText}>Choose from Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.optionButton}>
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
        backgroundColor: '#FFFFFF',
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
        color: '#111827',
        marginBottom: 32,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
    },
    optionButton: {
        width: 120,
        height: 120,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        margin: 8,
    },
    optionText: {
        fontSize: 14,
        color: '#111827',
        marginTop: 8,
        textAlign: 'center',
    },
});

export default ClipScreen;
