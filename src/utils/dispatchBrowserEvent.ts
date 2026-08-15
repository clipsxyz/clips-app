/**
 * Dispatch a cross-platform app event.
 * Web: DOM CustomEvent. Native: DeviceEventEmitter (CustomEvent is unavailable / redboxes).
 */
export function dispatchBrowserEvent(name: string, detail?: Record<string, unknown>): void {
    try {
        if (
            typeof window !== 'undefined' &&
            typeof window.dispatchEvent === 'function' &&
            typeof (globalThis as { CustomEvent?: unknown }).CustomEvent === 'function'
        ) {
            window.dispatchEvent(new CustomEvent(name, detail != null ? { detail } : undefined));
        }
    } catch {
        // ignore web dispatch failures
    }

    try {
        // Lazy require so Vite web builds don't hard-fail on the RN module.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const rn = require('react-native') as {
            DeviceEventEmitter?: { emit?: (event: string, payload?: unknown) => void };
            Platform?: { OS?: string };
        };
        if (rn?.Platform?.OS === 'ios' || rn?.Platform?.OS === 'android') {
            rn.DeviceEventEmitter?.emit?.(name, detail ?? {});
        }
    } catch {
        // web / non-RN runtime
    }
}
