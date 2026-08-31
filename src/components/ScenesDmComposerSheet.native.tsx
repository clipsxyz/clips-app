import React, { useCallback } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Image,
} from 'react-native';
import {
    BottomSheetFooter,
    BottomSheetTextInput,
    BottomSheetView,
    type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Post } from '../types';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import { getPostDisplayCaption, getReclipDisplay } from '../utils/feedPostMeta';
import { getScenesMediaSlides, resolveScenesVideoUrl } from '../utils/scenesMediaNative';
import { postHasVideoMedia } from '../utils/postMedia';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_LIGHT } from './GazetteerBottomSheetModal.native';

type Props = {
    visible: boolean;
    post: Post;
    viewerHandle?: string;
    message: string;
    onChangeMessage: (text: string) => void;
    onClose: () => void;
    onSend: () => void;
    onOpenFullChat: () => void;
};

/**
 * DM composer with attached post preview card (messages shared-post style).
 * Web Scenes opens full Messages; this sheet matches the “share card” UX on native before send.
 */
export default function ScenesDmComposerSheet({
    visible,
    post,
    viewerHandle,
    message,
    onChangeMessage,
    onClose,
    onSend,
    onOpenFullChat,
}: Props) {
    const insets = useSafeAreaInsets();
    const { displayHandle } = getReclipDisplay(post, viewerHandle);
    const caption = getPostDisplayCaption(post);
    const slides = getScenesMediaSlides(post);
    const thumbSlide = slides.find((s) => s.type === 'image' || s.type === 'video') ?? slides[0];
    const thumbUri =
        thumbSlide?.type === 'video'
            ? post.videoPosterUrl || resolveScenesVideoUrl(thumbSlide.url)
            : thumbSlide?.url || post.mediaUrl;
    const isVideo = thumbSlide?.type === 'video' || postHasVideoMedia(post);

    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props} bottomInset={Math.max(insets.bottom, 12)}>
                <View style={styles.footerInner}>
                    <View style={styles.composerRow}>
                        <BottomSheetTextInput
                            value={message}
                            onChangeText={onChangeMessage}
                            placeholder="Write a message..."
                            placeholderTextColor="#6B7280"
                            style={styles.input}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
                            disabled={!message.trim()}
                            onPress={onSend}
                        >
                            <Icon name="send" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.openChatLink} onPress={onOpenFullChat}>
                        <Text style={styles.openChatText}>Open full chat</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetFooter>
        ),
        [insets.bottom, message, onChangeMessage, onSend, onOpenFullChat],
    );

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            enableDynamicSizing
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_LIGHT.background}
            handleIndicatorStyle={GAZETTEER_SHEET_LIGHT.handle}
            backdropOpacity={0.55}
            footerComponent={renderFooter}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
        >
            <BottomSheetView style={styles.scroll}>
                    <Text style={styles.title}>Message {displayHandle}</Text>

                    <View style={styles.previewCard}>
                        <View style={styles.previewHeader}>
                            <Avatar
                                src={getAvatarForHandle(post.userHandle)}
                                name={displayHandle.split('@')[0]}
                                size="sm"
                            />
                            <Text style={styles.previewHandle} numberOfLines={1}>
                                {displayHandle}
                            </Text>
                        </View>
                        {thumbUri ? (
                            <View style={styles.thumbWrap}>
                                <Image
                                    source={{ uri: thumbUri }}
                                    style={styles.thumb}
                                    resizeMode="cover"
                                />
                                {isVideo ? (
                                    <View style={styles.playBadge}>
                                        <Icon name="play" size={18} color="#FFFFFF" />
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                        {caption ? (
                            <Text style={styles.previewCaption} numberOfLines={3}>
                                {caption}
                            </Text>
                        ) : null}
                    </View>
            </BottomSheetView>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    scroll: {
        paddingHorizontal: 16,
        paddingTop: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    previewCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        overflow: 'hidden',
        marginBottom: 8,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
    },
    previewHandle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    thumbWrap: {
        width: '100%',
        height: 140,
        backgroundColor: '#111827',
    },
    thumb: { width: '100%', height: '100%' },
    playBadge: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginLeft: -16,
        marginTop: -16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewCaption: {
        padding: 12,
        fontSize: 13,
        color: '#374151',
        lineHeight: 18,
    },
    footerInner: {
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
    },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: '#111827',
        backgroundColor: '#FFFFFF',
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#155bd6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.45 },
    openChatLink: {
        alignSelf: 'center',
        marginTop: 10,
        paddingVertical: 8,
        paddingBottom: 4,
    },
    openChatText: {
        color: '#155bd6',
        fontSize: 14,
        fontWeight: '600',
    },
});
