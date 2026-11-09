type MenuChoice = {
    label: string;
    onPress: () => void;
    destructive?: boolean;
};

export type GazetteerAlertButton = {
    text?: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
};

export type GazetteerAlertOptions = {
    cancelable?: boolean;
    onDismiss?: () => void;
};

type AlertRequest = {
    id: number;
    kind: 'alert';
    title: string;
    message?: string;
    icon: 'success' | 'alert' | 'info';
    confirmText: string;
    cancelText: string;
    showCancel: boolean;
    destructive: boolean;
    onConfirm?: () => void;
    onDismiss?: () => void;
};

type MenuRequest = {
    id: number;
    kind: 'menu';
    title: string;
    message?: string;
    cancelText: string;
    options: MenuChoice[];
    onDismiss?: () => void;
};

export type GazetteerAlertRequest = AlertRequest | MenuRequest;

let nextId = 1;
let current: GazetteerAlertRequest | null = null;
const queue: GazetteerAlertRequest[] = [];
let subscriber: ((request: GazetteerAlertRequest | null) => void) | null = null;

function inferIcon(title: string): 'success' | 'alert' | 'info' {
    if (/fail|error|cannot|can't|could not|invalid|required|needed|unable/i.test(title)) return 'alert';
    if (/copied|posted|updated|invited|reposted|reported|success|saved/i.test(title)) return 'success';
    return 'info';
}

function present(request: GazetteerAlertRequest) {
    if (current) {
        queue.push(request);
        return;
    }
    current = request;
    subscriber?.(current);
}

export function subscribeGazetteerAlerts(
    listener: (request: GazetteerAlertRequest | null) => void,
): () => void {
    subscriber = listener;
    listener(current);
    return () => {
        if (subscriber === listener) subscriber = null;
    };
}

export function finishGazetteerAlert(id: number) {
    if (!current || current.id !== id) return;
    current = queue.shift() ?? null;
    subscriber?.(current);
}

/** Same call shape as React Native's Alert.alert, rendered as a Gazetteer sheet. */
export function gazetteerAlert(
    title: string,
    message?: string,
    buttons?: GazetteerAlertButton[],
    options?: GazetteerAlertOptions,
) {
    const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    const cancels = list.filter((button) => button.style === 'cancel');
    const actions = list.filter((button) => button.style !== 'cancel');
    const dismiss = () => {
        cancels.forEach((button) => button.onPress?.());
        options?.onDismiss?.();
    };
    const body = message?.trim() ? message : undefined;

    if (actions.length <= 1) {
        const confirm = actions[0] ?? { text: 'OK' };
        const destructive = confirm.style === 'destructive';
        present({
            id: nextId++,
            kind: 'alert',
            title,
            message: body,
            icon: destructive ? 'alert' : inferIcon(title),
            confirmText: confirm.text || 'OK',
            cancelText: cancels[0]?.text || 'Cancel',
            showCancel: cancels.length > 0,
            destructive,
            onConfirm: () => confirm.onPress?.(),
            onDismiss: () => {
                if (cancels.length === 0) confirm.onPress?.();
                dismiss();
            },
        });
        return;
    }

    present({
        id: nextId++,
        kind: 'menu',
        title,
        message: body,
        cancelText: cancels[0]?.text || 'Cancel',
        options: actions.map((button) => ({
            label: button.text || 'OK',
            destructive: button.style === 'destructive',
            onPress: () => button.onPress?.(),
        })),
        onDismiss: dismiss,
    });
}
