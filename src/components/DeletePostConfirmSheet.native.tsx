import React from 'react';
import GazetteerAlertSheet from './GazetteerAlertSheet.native';

type Props = {
    visible: boolean;
    onConfirm: () => void;
    onDismiss: () => void;
};

/** Gazetteer confirm before a post is permanently deleted. */
export default function DeletePostConfirmSheet({ visible, onConfirm, onDismiss }: Props) {
    return (
        <GazetteerAlertSheet
            visible={visible}
            title="Delete post?"
            message="This cannot be undone."
            icon="alert"
            confirmButtonText="Delete"
            cancelButtonText="Cancel"
            showCancelButton
            confirmDestructive
            onConfirm={onConfirm}
            onDismiss={onDismiss}
        />
    );
}
