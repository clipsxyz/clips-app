import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import type { Post } from '../types';
import { buildShareablePostUrl } from '../utils/shareUrls';

type Props = {
    post: Post | null;
    isOpen: boolean;
    onClose: () => void;
};

export default function FeedShareModal({ post, isOpen, onClose }: Props) {
    const handleShareSystem = async () => {
        if (!post) return;
        try {
            const url = buildShareablePostUrl(post);
            await Share.share({
                message: post.text ? `${post.text} by ${post.userHandle}\n${url}` : `Check out this post by ${post.userHandle}\n${url}`,
                url: post.mediaUrl || url,
            });
        } catch (err: unknown) {
            console.error('Error sharing:', err);
        } finally {
            onClose();
        }
    };

    const handleCopyLink = async () => {
        if (!post) return;
        try {
            await Clipboard.setString(buildShareablePostUrl(post));
            Alert.alert('Link copied', 'Post link copied to clipboard.');
        } catch (err) {
            console.error('Clipboard failed:', err);
            Alert.alert('Could not copy', 'Please try again.');
        } finally {
            onClose();
        }
    };

    if (!isOpen || !post) return null;

    return (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.shareModalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Share</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleShareSystem} style={styles.shareOption}>
                        <Icon name="share-social" size={24} color="#FFFFFF" />
                        <Text style={styles.shareOptionText}>Share via…</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCopyLink} style={styles.shareOption}>
                        <Icon name="link" size={24} color="#FFFFFF" />
                        <Text style={styles.shareOptionText}>Copy link</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    shareModalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    shareOptionText: {
        fontSize: 16,
        color: '#FFFFFF',
    },
});
