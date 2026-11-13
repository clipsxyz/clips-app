import React from 'react';
import { FiBookmark } from 'react-icons/fi';
import type { Collection, Post } from '../types';
import { collectionCoverPost, getCollectionThumbnailUrl } from '../api/collections';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import { getPostBodyText, getTextOnlyBackgroundColor, getTextOnlyTextColor, isTextOnlyPost } from '../utils/effectiveTextPostStyleNative';
import { isTextCardStyleId, TEXT_CARD_STYLES } from '../utils/textCardStyles';

type Props = {
    collection: Collection;
    posts?: Post[];
    className?: string;
    iconClassName?: string;
};

export default function CollectionCoverThumb({
    collection,
    posts,
    className = 'h-full w-full rounded-xl object-cover',
    iconClassName = 'w-7 h-7 text-white/45',
}: Props) {
    const rawSrc = getCollectionThumbnailUrl(collection, posts);
    const src = rawSrc ? rewriteMediaUrlForClient(rawSrc) : '';
    const coverPost = collectionCoverPost(collection, posts);
    const bodyText = getPostBodyText(coverPost);
    const textCard = coverPost && isTextCardStyleId(coverPost.cardStyle) ? TEXT_CARD_STYLES[coverPost.cardStyle] : null;
    const showText = Boolean(coverPost && isTextOnlyPost(coverPost));
    const [failed, setFailed] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    const empty = (collection.postIds?.length || 0) === 0 && !collection.latestPost && !bodyText;

    React.useEffect(() => {
        setFailed(false);
        setLoaded(false);
    }, [src, collection.id]);

    if (showText && (!src || failed || empty)) {
        const textColor = textCard?.textColor || (coverPost ? getTextOnlyTextColor(coverPost) : '#FFFFFF');
        const background = textCard && textCard.colors.length >= 2
            ? `linear-gradient(180deg, ${textCard.colors.join(', ')})`
            : textCard?.colors[0] || (coverPost ? getTextOnlyBackgroundColor(coverPost) : '#151D28');
        return (
            <div
                className={`flex h-full w-full items-start overflow-hidden p-1.5 text-left text-[10px] font-semibold leading-[13px] ${className}`}
                style={{ color: textColor, background }}
            >
                <span className="line-clamp-4">{bodyText}</span>
            </div>
        );
    }

    if (!src || failed || empty) {
        return (
            <div className={`flex items-center justify-center bg-[#071330] ${className}`}>
                <FiBookmark className={iconClassName} />
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden bg-[#071330] ${className}`}>
            {!loaded ? <div className="absolute inset-0 animate-pulse bg-white/10" /> : null}
            <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
            />
        </div>
    );
}
