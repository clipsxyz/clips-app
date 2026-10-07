import React from 'react';
import { useLinkPreview } from '../hooks/useLinkPreview';
import PostLinkPreviewCard from './PostLinkPreviewCard';

export default function ComposerLinkPreview({ text }: { text: string }) {
    const { preview, loading } = useLinkPreview(text);
    if (loading && !preview) {
        return <div className="mt-2 text-xs text-gray-500 dark:text-white/55">Fetching link preview…</div>;
    }
    if (!preview) return null;
    return <PostLinkPreviewCard preview={preview} compact />;
}
