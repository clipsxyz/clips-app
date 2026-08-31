export type DraftSaveSheetState = {
    title: string;
    message: string;
    icon: 'success' | 'alert';
    confirmButtonText?: string;
    onConfirm?: () => void;
};

export function savedToDraftsSheet(onConfirm?: () => void): DraftSaveSheetState {
    return {
        title: 'Saved to Drafts!',
        message: 'You can find it in your profile. Tap a draft to continue and post.',
        icon: 'success',
        confirmButtonText: 'Done',
        onConfirm,
    };
}

export function failedToSaveSheet(message?: string): DraftSaveSheetState {
    return {
        title: 'Failed to Save',
        message: message || 'Could not save draft. Please try again.',
        icon: 'alert',
        confirmButtonText: 'OK',
    };
}

export function nothingToSaveSheet(message: string): DraftSaveSheetState {
    return {
        title: 'Nothing to Save',
        message,
        icon: 'alert',
        confirmButtonText: 'OK',
    };
}
