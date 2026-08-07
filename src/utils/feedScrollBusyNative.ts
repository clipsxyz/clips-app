/** Feed list fling/drag — avoid React setState on the FlatList host (causes settle jumps). */

type Listener = (busy: boolean) => void;

let busy = false;
const listeners = new Set<Listener>();

export function setFeedScrollBusy(next: boolean): void {
    if (busy === next) return;
    busy = next;
    listeners.forEach((fn) => fn(busy));
}

export function getFeedScrollBusy(): boolean {
    return busy;
}

export function subscribeFeedScrollBusy(listener: Listener): () => void {
    listeners.add(listener);
    listener(busy);
    return () => {
        listeners.delete(listener);
    };
}
