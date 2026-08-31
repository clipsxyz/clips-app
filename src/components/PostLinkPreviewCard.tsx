import React from 'react';
import Swal from 'sweetalert2';
import type { LinkPreview } from '../types';
import {
    instagramSharePrompt,
    linkAttachmentHostLabel,
    linkPreviewNeedsInstagramPlaceholder,
    linkPreviewPlaybackUri,
} from '../utils/linkPreview';
import { bottomSheet } from '../utils/swalBottomSheet';

type Props = {
    preview: LinkPreview;
    compact?: boolean;
};

function openPreview(url: string) {
    if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

async function confirmAndOpen(url: string) {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const result = await Swal.fire(
        bottomSheet({
            title: 'Visit link?',
            message: 'You are about to open this link in a new tab.',
            icon: 'alert',
            showCancelButton: true,
            confirmButtonText: 'Visit link',
            cancelButtonText: 'Cancel',
        }),
    );
    if (result.isConfirmed) {
        openPreview(withProtocol);
    }
}

function InstagramIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="4.2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.7" />
            <circle cx="17.4" cy="6.6" r="1.1" fill="rgba(255,255,255,0.9)" />
        </svg>
    );
}

function Cover({ preview, compact }: { preview: LinkPreview; compact: boolean }) {
    const height = compact ? 112 : 200;
    const playbackUri = linkPreviewPlaybackUri(preview);
    if (playbackUri) {
        return (
            <video
                src={playbackUri}
                muted
                loop
                autoPlay
                playsInline
                className="w-full bg-black/40 object-cover"
                style={{ height, objectFit: 'cover', pointerEvents: 'none' }}
            />
        );
    }
    if (preview.imageUrl) {
        return (
            <img
                src={preview.imageUrl}
                alt=""
                className="w-full bg-black/40 object-cover"
                style={{ height, objectFit: 'cover' }}
            />
        );
    }
    return <div className="w-full bg-black/40" style={{ height }} />;
}

export default function PostLinkPreviewCard({ preview, compact = false }: Props) {
    const showAttachmentChip = linkPreviewNeedsInstagramPlaceholder(preview);
    const hostLabel = linkAttachmentHostLabel(preview.url);
    const instagramLine = instagramSharePrompt(preview.url);
    const cardTitle = instagramLine || preview.title?.trim() || hostLabel;
    const description = preview.description?.trim();
    const descriptionText = description ?? '';
    const showDescription =
        Boolean(descriptionText) &&
        descriptionText !== cardTitle &&
        descriptionText.toLowerCase() !== 'view on instagram';

    if (showAttachmentChip) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void confirmAndOpen(preview.url);
                }}
                className="flex w-full items-center overflow-hidden border border-white/12 bg-[rgba(8,12,18,0.88)] text-left"
                style={{
                    width: '100%',
                    height: 52,
                    borderRadius: 12,
                    marginTop: 8,
                    marginBottom: 8,
                    paddingLeft: 10,
                    paddingRight: 10,
                }}
            >
                <span className="mr-2.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <InstagramIcon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-[18px] text-white">{cardTitle}</span>
                    <span className="block truncate text-xs font-medium leading-4 text-white/55">{hostLabel}</span>
                </span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void confirmAndOpen(preview.url);
            }}
            className="w-full overflow-hidden border border-white/12 bg-[#0B141C] text-left"
            style={{
                width: '100%',
                borderRadius: 16,
                marginTop: compact ? 8 : 10,
                marginBottom: compact ? 8 : 10,
            }}
        >
            <Cover preview={preview} compact={compact} />
            <div className="bg-[#0B141C] px-3.5 py-3">
                {cardTitle ? (
                    <div className="text-[15px] font-bold leading-5 text-white line-clamp-2">{cardTitle}</div>
                ) : null}
                {showDescription ? (
                    <div className="mt-1 text-[13px] leading-[18px] text-white/60 line-clamp-2">
                        {descriptionText}
                    </div>
                ) : null}
                <span className="mt-2.5 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/85">
                    {preview.source}
                </span>
            </div>
        </button>
    );
}
