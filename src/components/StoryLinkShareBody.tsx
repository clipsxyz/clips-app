import React from 'react';
import PostLinkPreviewCard from './PostLinkPreviewCard';
import { useLinkPreview } from '../hooks/useLinkPreview';
import {
    captionWithoutLinkUrl,
    extractFirstHttpUrl,
    fallbackLinkPreview,
} from '../utils/linkPreview';
import type { LinkPreview } from '../types';

type Props = {
    text: string;
    className?: string;
    style?: React.CSSProperties;
    storedPreview?: LinkPreview;
};

/** Text-only story body: leftover caption plus the OG share card when a URL is present. */
export default function StoryLinkShareBody({ text, className, style, storedPreview }: Props) {
    const linkUrl = extractFirstHttpUrl(text);
    const { preview: fetched } = useLinkPreview(text, { debounceMs: 0 });
    const preview = storedPreview || fetched || (linkUrl ? fallbackLinkPreview(linkUrl) : null);
    const leftover = preview ? captionWithoutLinkUrl(text, preview.url) : text;
    const showText = leftover.length > 0;

    return (
        <>
            {showText ? (
                <div className={className} style={style}>
                    {leftover}
                </div>
            ) : null}
            {preview ? (
                <div className="w-full px-4 pb-2">
                    <PostLinkPreviewCard preview={preview} compact />
                </div>
            ) : !showText ? (
                <div className={className} style={style}>
                    {text}
                </div>
            ) : null}
        </>
    );
}
