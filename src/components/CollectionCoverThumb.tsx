import React from 'react';
import { FiBookmark } from 'react-icons/fi';
import type { Collection } from '../types';
import { getCollectionThumbnailUrl } from '../api/collections';

type Props = {
    collection: Collection;
    className?: string;
    iconClassName?: string;
};

export default function CollectionCoverThumb({
    collection,
    className = 'h-full w-full rounded-xl object-cover',
    iconClassName = 'w-7 h-7 text-white/45',
}: Props) {
    const src = getCollectionThumbnailUrl(collection);
    const [failed, setFailed] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    const empty = (collection.postIds?.length || 0) === 0 && !collection.latestPost;

    React.useEffect(() => {
        setFailed(false);
        setLoaded(false);
    }, [src, collection.id]);

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
