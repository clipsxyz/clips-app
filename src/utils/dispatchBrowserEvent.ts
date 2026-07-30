/**
 * Dispatch a DOM CustomEvent on web only.
 * React Native / Hermes has no CustomEvent — calling it redboxes.
 */
export function dispatchBrowserEvent(name: string, detail?: Record<string, unknown>): void {
    try {
        if (typeof window === 'undefined') return;
        if (typeof window.dispatchEvent !== 'function') return;
        if (typeof (globalThis as any).CustomEvent !== 'function') return;
        window.dispatchEvent(new CustomEvent(name, detail != null ? { detail } : undefined));
    } catch {
        // no-op on native / unsupported runtimes
    }
}
