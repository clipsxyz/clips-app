import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLinkPreview } from '../hooks/useLinkPreview';
import PostLinkPreviewCard from './PostLinkPreviewCard';

type Props = {
    text: string;
};

export default function ComposerLinkPreview({ text }: Props) {
    const { preview, loading } = useLinkPreview(text);
    if (!preview && !loading) return null;
    if (loading && !preview) {
        return (
            <View style={{ marginTop: 10, paddingVertical: 8 }}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                <Text style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    Fetching link preview…
                </Text>
            </View>
        );
    }
    return preview ? <PostLinkPreviewCard preview={preview} compact /> : null;
}
