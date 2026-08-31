import { useEffect, useState } from 'react';
import { fetchLinkPreview } from '../api/linkPreview';
import type { LinkPreview } from '../types';
import { extractFirstHttpUrl } from '../utils/linkPreview';

export function useLinkPreview(
    text: string,
    opts?: { debounceMs?: number },
): { preview: LinkPreview | null; loading: boolean } {
    const [preview, setPreview] = useState<LinkPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const debounceMs = opts?.debounceMs ?? 450;

    useEffect(() => {
        const url = extractFirstHttpUrl(text);
        if (!url) {
            setPreview(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(() => {
            void fetchLinkPreview(url).then((result) => {
                if (cancelled) return;
                setPreview(result);
                setLoading(false);
            });
        }, debounceMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [text, debounceMs]);

    return { preview, loading };
}
