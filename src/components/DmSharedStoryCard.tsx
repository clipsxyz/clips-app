import React, { useEffect, useState } from 'react';
import { fetchDmSharedStory } from '../api/stories';
import { siblingJpegFromVideoUrl } from '../utils/postMedia';
import { getAvatarForHandle } from '../api/users';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import Avatar from './Avatar';
import { StoryLinkCard } from './stories/StoryLinkCard';
import { useLinkPreview } from '../hooks/useLinkPreview';
import { captionWithoutLinkUrl, extractFirstHttpUrl, fallbackLinkPreview } from '../utils/linkPreview';
import { storyLinkBrandForUrl } from '../utils/storyLinkBrand';
import type { Story } from '../types';

type Props = {
    handle: string;
    storyId: string;
    onOpen: () => void;
};

/** DM card for a Stories 24 share. Tap opens that story. */
export default function DmSharedStoryCard({ handle, storyId, onOpen }: Props) {
    const [story, setStory] = useState<Story | null | undefined>(undefined);
    const [expired, setExpired] = useState(false);
    const name = handle.replace(/^@/, '').split('@')[0] || handle;

    useEffect(() => {
        let cancelled = false;
        setStory(undefined);
        setExpired(false);
        void fetchDmSharedStory(handle, storyId).then((result) => {
            if (cancelled) return;
            setExpired(result.expired);
            setStory(result.story);
        });
        return () => {
            cancelled = true;
        };
    }, [handle, storyId]);

    const mediaUrl = story?.mediaUrl ? rewriteMediaUrlForClient(story.mediaUrl) : '';
    const isVideo = story?.mediaType === 'video' || /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(mediaUrl);
    const poster = rewriteMediaUrlForClient(story?.videoPosterUrl || '') || siblingJpegFromVideoUrl(mediaUrl) || '';
    const storyText = (story?.text || '').trim();
    const pastedLink = !mediaUrl ? extractFirstHttpUrl(storyText) : undefined;
    const { preview: fetchedPreview, loading: previewLoading } = useLinkPreview(pastedLink || '', { debounceMs: 0 });
    const linkPreview = pastedLink ? fetchedPreview || fallbackLinkPreview(pastedLink) : null;
    const avatar = getAvatarForHandle(story?.userHandle || handle);
    const canvas = pastedLink ? storyLinkBrandForUrl(pastedLink).canvas : null;
    const caption = pastedLink ? captionWithoutLinkUrl(storyText, pastedLink) : '';
    const frameBackground = canvas
        ? `linear-gradient(160deg, ${canvas[0]} 0%, ${canvas[1]} 48%, ${canvas[2]} 100%)`
        : 'linear-gradient(180deg, #1a1040 0%, #0b0618 100%)';

    return (
        <div className="w-full overflow-hidden rounded-2xl text-left" style={{ background: frameBackground }}>
            {expired ? (
                <div className="flex aspect-[4/5] w-full flex-col items-center justify-center px-4 text-center">
                    <p className="text-sm font-bold text-white">Story no longer available</p>
                </div>
            ) : linkPreview ? (
                <div className="px-2.5 pt-2.5">
                    {caption ? (
                        <p className="mb-2 line-clamp-3 text-center text-[13px] font-bold text-white">{caption}</p>
                    ) : null}
                    <StoryLinkCard
                        preview={linkPreview}
                        loading={previewLoading && !fetchedPreview}
                        authorAvatar={avatar}
                        authorName={name}
                    />
                </div>
            ) : (
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    if (!expired) onOpen();
                }}
                className="relative block aspect-[4/5] w-full overflow-hidden bg-black/40 text-left"
            >
                {mediaUrl && !isVideo ? (
                    <img src={mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : isVideo && (poster || mediaUrl) ? (
                    poster ? (
                        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                        <video
                            src={`${mediaUrl}#t=0.1`}
                            muted
                            playsInline
                            preload="metadata"
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    )
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <Avatar src={avatar} name={name} size={64} />
                    </div>
                )}
                {isVideo && (poster || mediaUrl) ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-lg text-white">▶</span>
                    </div>
                ) : null}
            </button>
            )}
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    if (!expired) onOpen();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
                <Avatar src={avatar} name={name} size={28} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{name}</div>
                    <div className="text-xs text-white/70">
                        {expired ? 'Story no longer available' : story === null ? 'Story unavailable' : 'Tap to view story'}
                    </div>
                </div>
            </button>
        </div>
    );
}
