import React, { useMemo } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { COMMUNITY_GROUP_ONBOARDING } from '../constants/communityGroupOnboarding';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import { ox } from '../constants/nativeOpticalScale';

type Props = {
    visible: boolean;
    onCreateGroup: () => void;
    onDismiss: () => void;
};

function IncomingBubble({
    name,
    initials,
    avatarColor,
    text,
    reaction,
    reactionCount,
}: {
    name: string;
    initials: string;
    avatarColor: string;
    text: string;
    reaction?: string;
    reactionCount?: number;
}) {
    return (
        <View style={styles.incomingRow}>
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <View style={styles.incomingCol}>
                <Text style={styles.bubbleName}>{name}</Text>
                <View style={styles.incomingBubble}>
                    <Text style={styles.incomingText}>{text}</Text>
                </View>
                {reaction ? (
                    <View style={styles.reaction}>
                        <Text style={styles.reactionEmoji}>{reaction}</Text>
                        {reactionCount ? <Text style={styles.reactionCount}>{reactionCount}</Text> : null}
                    </View>
                ) : null}
            </View>
        </View>
    );
}

export default function CommunityGroupOnboardingSheet({ visible, onCreateGroup, onDismiss }: Props) {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const sheetLayout = useMemo(() => {
        const sheetWidth = Math.min(width - 24, 400);
        const marginHorizontal = Math.max(12, Math.floor((width - sheetWidth) / 2));
        return { sheetWidth, marginHorizontal, maxHeight: Math.round(height * 0.92) };
    }, [width, height]);

    if (!visible) return null;

    const copy = COMMUNITY_GROUP_ONBOARDING;

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />
                <View
                    style={[
                        styles.sheet,
                        {
                            marginHorizontal: sheetLayout.marginHorizontal,
                            width: sheetLayout.sheetWidth,
                            maxHeight: sheetLayout.maxHeight,
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    <PassportSheetCanvas contentStyle={styles.sheetInner}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onDismiss}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Close community group introduction"
                        >
                            <Icon name="close" size={ox(22)} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.handleWrap}>
                            <View style={styles.handle} />
                        </View>

                        <ScrollView
                            bounces={false}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scroll}
                        >
                            <View style={styles.preview}>
                                <Text style={styles.floatLeft}>🏃</Text>
                                <View style={styles.leftStack}>
                                    <IncomingBubble
                                        name={copy.bubbles[0].name}
                                        initials={copy.bubbles[0].initials}
                                        avatarColor={copy.bubbles[0].avatarColor}
                                        text={copy.bubbles[0].text}
                                        reaction={copy.bubbles[0].reaction}
                                        reactionCount={copy.bubbles[0].reactionCount}
                                    />
                                    <View style={styles.stackOverlap}>
                                        <IncomingBubble
                                            name={copy.bubbles[2].name}
                                            initials={copy.bubbles[2].initials}
                                            avatarColor={copy.bubbles[2].avatarColor}
                                            text={copy.bubbles[2].text}
                                            reaction={copy.bubbles[2].reaction}
                                            reactionCount={copy.bubbles[2].reactionCount}
                                        />
                                    </View>
                                    <View style={styles.stackOverlap}>
                                        <IncomingBubble
                                            name={copy.bubbles[3].name}
                                            initials={copy.bubbles[3].initials}
                                            avatarColor={copy.bubbles[3].avatarColor}
                                            text={copy.bubbles[3].text}
                                            reaction={copy.bubbles[3].reaction}
                                            reactionCount={copy.bubbles[3].reactionCount}
                                        />
                                    </View>
                                </View>
                                <View style={styles.outgoingRow}>
                                    <View style={styles.outgoingBubble}>
                                        <Text style={styles.outgoingText}>{copy.bubbles[1].text}</Text>
                                    </View>
                                </View>
                                <Text style={styles.floatRight}>📚</Text>
                            </View>

                            <View style={styles.badgeRow}>
                                <Text style={styles.badgeSpark}>✨</Text>
                                <Text style={styles.badgeText}>{copy.badge}</Text>
                            </View>
                            <Text style={styles.title}>{copy.title}</Text>
                            <Text style={styles.subtitle}>{copy.subtitle}</Text>

                            <View style={styles.features}>
                                {copy.features.map((feature) => (
                                    <View key={feature.title} style={styles.featureRow}>
                                        <Icon name={feature.icon} size={ox(22)} color="#FFFFFF" />
                                        <View style={styles.featureCopy}>
                                            <Text style={styles.featureTitle}>{feature.title}</Text>
                                            <Text style={styles.featureBody}>{feature.body}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.cta} onPress={onCreateGroup} activeOpacity={0.88}>
                                <Text style={styles.ctaText}>{copy.cta}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </PassportSheetCanvas>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    sheet: {
        alignSelf: 'center',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        backgroundColor: PASSPORT_ABYSS,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sheetInner: {
        paddingHorizontal: 20,
        paddingTop: 4,
    },
    closeButton: {
        position: 'absolute',
        top: 10,
        right: 12,
        zIndex: 5,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    handleWrap: {
        alignItems: 'center',
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    scroll: {
        paddingBottom: 8,
    },
    preview: {
        position: 'relative',
        marginBottom: 14,
        paddingTop: 4,
        paddingRight: 4,
        paddingBottom: 8,
        minHeight: ox(188),
    },
    leftStack: {
        maxWidth: '88%',
    },
    stackOverlap: {
        marginTop: -10,
    },
    floatLeft: {
        position: 'absolute',
        left: 0,
        top: 28,
        fontSize: ox(20),
        zIndex: 2,
    },
    floatRight: {
        position: 'absolute',
        right: 2,
        top: 78,
        fontSize: ox(20),
        zIndex: 2,
    },
    incomingRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 4,
        maxWidth: '100%',
    },
    incomingCol: {
        flexShrink: 1,
        minWidth: 0,
    },
    avatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14,
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    bubbleName: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 3,
        marginLeft: 4,
    },
    incomingBubble: {
        backgroundColor: 'rgba(42,48,58,0.92)',
        borderRadius: 16,
        borderBottomLeftRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    incomingText: {
        color: '#F3F4F6',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '500',
    },
    reaction: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: -8,
        marginLeft: 10,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    reactionEmoji: {
        fontSize: 11,
    },
    reactionCount: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 10,
        fontWeight: '700',
    },
    outgoingRow: {
        position: 'absolute',
        right: 0,
        top: 52,
        alignItems: 'flex-end',
        zIndex: 3,
    },
    outgoingBubble: {
        maxWidth: '70%',
        backgroundColor: PASSPORT_PALETTE.wavePrimary,
        borderRadius: 16,
        borderBottomRightRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    outgoingText: {
        color: '#FFFFFF',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 8,
    },
    badgeSpark: {
        fontSize: 13,
    },
    badgeText: {
        color: PASSPORT_PALETTE.wavePrimary,
        fontSize: 13,
        fontWeight: '700',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        color: 'rgba(232,238,242,0.78)',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    features: {
        gap: 16,
        marginBottom: 22,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    featureCopy: {
        flex: 1,
        minWidth: 0,
    },
    featureTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    featureBody: {
        color: 'rgba(232,238,242,0.62)',
        fontSize: 12,
        lineHeight: 17,
    },
    cta: {
        borderRadius: 999,
        backgroundColor: PASSPORT_PALETTE.wavePrimary,
        paddingVertical: 14,
        alignItems: 'center',
    },
    ctaText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
