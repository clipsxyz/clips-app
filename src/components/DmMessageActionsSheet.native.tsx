import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { GAZETTEER_SHEET_SLATE } from './GazetteerBottomSheetModal.native';
import { ox } from '../constants/nativeOpticalScale';

export type DmMessageAction = {
    key: string;
    label: string;
    icon?: string;
    emoji?: string;
    destructive?: boolean;
    onPress: () => void;
};

type Props = {
    visible: boolean;
    timestampLabel?: string;
    quickReactions?: string[];
    onReact?: (emoji: string) => void;
    actions: DmMessageAction[];
    onDismiss: () => void;
};

const DEFAULT_REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '😢'];

/**
 * Long-press message sheet — quick emoji reactions + actions (web MessagesPage parity).
 */
export default function DmMessageActionsSheet({
    visible,
    timestampLabel,
    quickReactions = DEFAULT_REACTIONS,
    onReact,
    actions,
    onDismiss,
}: Props) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const sheetLayout = useMemo(() => {
        const sheetWidth = Math.min(width - 32, 400);
        const marginHorizontal = Math.max(16, Math.floor((width - sheetWidth) / 2));
        return { sheetWidth, marginHorizontal };
    }, [width]);

    if (!visible) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />
                <View
                    style={[
                        styles.sheet,
                        GAZETTEER_SHEET_SLATE.background,
                        {
                            marginHorizontal: sheetLayout.marginHorizontal,
                            width: sheetLayout.sheetWidth,
                            alignSelf: 'center',
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    <View style={styles.handleWrap}>
                        <View style={[styles.handle, GAZETTEER_SHEET_SLATE.handle]} />
                    </View>

                    {timestampLabel ? <Text style={styles.timestamp}>{timestampLabel}</Text> : null}

                    {onReact ? (
                        <View style={styles.reactionRow}>
                            {quickReactions.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={styles.reactionBtn}
                                    onPress={() => {
                                        onDismiss();
                                        onReact(emoji);
                                    }}
                                    accessibilityLabel={`React ${emoji}`}
                                >
                                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}

                    <ScrollView style={styles.optionsScroll} bounces={false}>
                        {actions.map((action) => (
                            <TouchableOpacity
                                key={action.key}
                                style={styles.optionBtn}
                                onPress={() => {
                                    onDismiss();
                                    action.onPress();
                                }}
                            >
                                {action.emoji ? (
                                    <Text style={styles.optionEmoji}>{action.emoji}</Text>
                                ) : action.icon ? (
                                    <Icon
                                        name={action.icon}
                                        size={ox(20)}
                                        color={action.destructive ? '#EF4444' : '#F9FAFB'}
                                    />
                                ) : null}
                                <Text
                                    style={[
                                        styles.optionText,
                                        action.destructive ? styles.optionTextDanger : null,
                                    ]}
                                >
                                    {action.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 8,
        maxHeight: '78%',
    },
    handleWrap: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    timestamp: {
        color: '#9CA3AF',
        fontSize: ox(12),
        textAlign: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 4,
    },
    reactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 4,
    },
    reactionBtn: {
        width: ox(44),
        height: ox(44),
        borderRadius: ox(22),
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reactionEmoji: {
        fontSize: ox(22),
    },
    optionsScroll: {
        maxHeight: 320,
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 18,
        paddingVertical: 14,
    },
    optionEmoji: {
        fontSize: ox(18),
        width: ox(22),
        textAlign: 'center',
    },
    optionText: {
        color: '#F9FAFB',
        fontSize: ox(16),
        fontWeight: '500',
    },
    optionTextDanger: {
        color: '#EF4444',
    },
    cancelBtn: {
        marginTop: 4,
        marginHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
    },
    cancelText: {
        color: '#E5E7EB',
        fontSize: ox(16),
        fontWeight: '600',
    },
});
