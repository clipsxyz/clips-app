import React from 'react';
import { FiExternalLink, FiLink } from 'react-icons/fi';
import Avatar from '../Avatar';
import { useLinkPreview } from '../../hooks/useLinkPreview';
import type { LinkPreview } from '../../types';
import {
    captionWithoutLinkUrl,
    extractFirstHttpUrl,
    fallbackLinkPreview,
    linkAttachmentHostLabel,
} from '../../utils/linkPreview';
import {
    storyLinkBrandForUrl,
    storyLinkFaviconUrl,
    storyLinkNewsName,
    storyLinkSlugHeadline,
} from '../../utils/storyLinkBrand';

const CARD_BASE = '#1E293B';

type CardProps = {
    preview: LinkPreview;
    loading?: boolean;
    authorAvatar?: string;
    authorName?: string;
};

function publisherName(siteName: string | undefined, source: string | undefined, host: string): string {
    const site = (siteName || '').trim();
    const src = (source || '').trim();
    const isHost = (value: string) => value.replace(/^www\./i, '').toLowerCase() === host.toLowerCase();
    if (site && !isHost(site)) return site;
    if (src && src.toLowerCase() !== 'link' && !isHost(src)) return src;
    return host;
}

function SiteLogo({ url, accent }: { url: string; accent: string }) {
    const [failed, setFailed] = React.useState(false);
    const src = storyLinkFaviconUrl(url);
    React.useEffect(() => {
        setFailed(false);
    }, [src]);
    return (
        <span
            className="mb-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border bg-[rgba(15,23,42,0.55)]"
            style={{ borderColor: accent }}
        >
            {src && !failed ? (
                <img
                    src={src}
                    alt=""
                    className="h-7 w-7 rounded-md object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <FiLink className="h-[22px] w-[22px]" style={{ color: accent }} aria-hidden />
            )}
        </span>
    );
}

/** Centered link card, matching the phone story. */
export function StoryLinkCard({
    preview,
    loading = false,
    authorAvatar,
    authorName,
}: CardProps) {
    const [imageFailed, setImageFailed] = React.useState(false);
    React.useEffect(() => {
        setImageFailed(false);
    }, [preview.imageUrl]);

    const host = linkAttachmentHostLabel(preview.url);
    const newsName = storyLinkNewsName(preview.url);
    const rawTitle = (preview.title || '').trim();
    const titleIsHost = !rawTitle || rawTitle.toLowerCase() === host.toLowerCase();
    const slugHeadline = titleIsHost ? storyLinkSlugHeadline(preview.url) : '';
    const title = !titleIsHost ? rawTitle : slugHeadline || newsName || host;
    const description = (preview.description || '').trim();
    const showDescription = Boolean(description) && description.toLowerCase() !== title.toLowerCase();
    const publisher = newsName || publisherName(preview.siteName, preview.source, host);
    const showPublisher = publisher.toLowerCase() !== title.toLowerCase();
    const showImage = Boolean(preview.imageUrl) && !imageFailed;
    const brand = storyLinkBrandForUrl(preview.url);
    const ctaLabel = newsName && !showImage ? 'Read Article' : brand.cta;
    const cardTop = brand.id === 'default' ? '#334155' : brand.accent;

    return (
        <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={titleIsHost ? `Open ${host}` : title}
            onClick={(event) => event.stopPropagation()}
            className="block w-full overflow-hidden rounded-[22px] border bg-[#1E293B] no-underline"
            style={{ borderColor: brand.accent }}
        >
            <span
                className={`flex w-full flex-col items-center pb-[18px] ${showImage ? '' : 'pt-[18px]'}`}
                style={{ background: `linear-gradient(180deg, ${cardTop} 0%, ${CARD_BASE} 100%)` }}
            >
                {showImage ? (
                    <img
                        src={preview.imageUrl}
                        alt=""
                        className="mb-4 h-[148px] w-full object-cover"
                        onError={() => setImageFailed(true)}
                    />
                ) : null}
                <SiteLogo url={preview.url} accent={brand.id === 'default' ? '#FFFFFF' : brand.accent} />
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white p-px">
                    <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#1E293B] p-[3px]">
                        <Avatar src={authorAvatar} name={authorName || 'User'} size={58} hideBorder />
                    </span>
                </span>
                {showPublisher && newsName ? (
                    <span className="mt-3 max-w-full truncate px-[18px] text-center text-[12px] font-extrabold tracking-[1.1px] text-white">
                        {newsName}
                    </span>
                ) : null}
                <span
                    className={`line-clamp-2 max-w-full px-[18px] text-center text-[17px] font-bold leading-[22px] text-white ${
                        showPublisher && newsName ? 'mt-1' : 'mt-3'
                    }`}
                >
                    {title}
                </span>
                {showDescription ? (
                    <span className="mt-1 line-clamp-2 max-w-full px-[18px] text-center text-[13px] font-medium leading-[18px] text-white/80">
                        {description}
                    </span>
                ) : null}
                {showPublisher && !newsName ? (
                    <span className="mt-1 max-w-full truncate px-[18px] text-center text-[13px] font-semibold text-white/70">
                        {publisher}
                    </span>
                ) : null}
                {loading ? (
                    <span className="mt-1.5 text-[12px] font-semibold text-white/60">Loading preview</span>
                ) : null}
                <span className="mt-3.5 inline-flex items-center rounded-full bg-white px-3.5 py-2 text-[14px] font-bold text-gray-900">
                    <FiExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
                    {ctaLabel}
                </span>
            </span>
        </a>
    );
}

/** Full-screen link story: site canvas, optional note, then the card. */
export function StoryLinkStory({
    text,
    authorAvatar,
    authorName,
    textColor = '#ffffff',
    fontSize = 17,
}: {
    text: string;
    authorAvatar?: string;
    authorName?: string;
    textColor?: string;
    fontSize?: number;
}) {
    const link = React.useMemo(() => extractFirstHttpUrl(text), [text]);
    const { preview: fetched, loading } = useLinkPreview(link || '', { debounceMs: 0 });
    if (!link) return null;
    const preview = fetched || fallbackLinkPreview(link);
    const caption = captionWithoutLinkUrl(text, link);
    const canvas = storyLinkBrandForUrl(link).canvas;

    return (
        <div
            className="pointer-events-auto relative flex h-full w-full items-center justify-center"
            style={{
                background: `linear-gradient(160deg, ${canvas[0]} 0%, ${canvas[1]} 48%, ${canvas[2]} 100%)`,
            }}
        >
            <div className="flex w-full max-w-[360px] flex-col justify-center px-7">
                {caption ? (
                    <p
                        className="mb-4 line-clamp-3 text-center font-bold"
                        style={{ color: textColor, fontSize }}
                    >
                        {caption}
                    </p>
                ) : null}
                <StoryLinkCard
                    preview={preview}
                    loading={loading && !fetched}
                    authorAvatar={authorAvatar}
                    authorName={authorName}
                />
            </div>
        </div>
    );
}
