import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiBookmark, FiImage, FiPlay, FiX } from 'react-icons/fi';
import { getCollection, getCollectionPosts } from '../api/collections';
import { resolvePostThumbnail } from '../api/collections';
import { upsertLocalPost } from '../api/posts';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import { siblingJpegFromVideoUrl } from '../utils/postMedia';
import { formatViewCount } from '../utils/feedPostNewsTicker';
import { getPostBodyText, getTextOnlyBackgroundColor, getTextOnlyTextColor, isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import { isTextCardStyleId, TEXT_CARD_STYLES } from '../utils/textCardStyles';
import type { Collection, Post } from '../types';

function collectionTileImage(post: Post): string | undefined {
  const still = resolvePostThumbnail(post);
  if (still) return rewriteMediaUrlForClient(still);
  const item = (post.mediaItems || []).find((entry) => entry?.type === 'image' || entry?.type === 'video');
  const jpeg = siblingJpegFromVideoUrl(item?.url || post.mediaUrl);
  return jpeg ? rewriteMediaUrlForClient(jpeg) : undefined;
}

function postViews(post: Post): number {
  const extra = post as Post & { views_count?: number; views?: number };
  return Math.max(0, Number(extra.views_count ?? post.stats?.views ?? extra.views ?? 0) || 0);
}

function CollectionGridTile({ post }: { post: Post }) {
  const imageUri = collectionTileImage(post);
  const bodyText = getPostBodyText(post);
  const videoPost = isVideoPost(post);
  const card = isTextCardStyleId(post.cardStyle) ? TEXT_CARD_STYLES[post.cardStyle] : null;
  const textColor = card?.textColor || getTextOnlyTextColor(post);
  const views = formatViewCount(postViews(post));
  return (
    <span className="relative flex h-full w-full overflow-hidden rounded-lg border border-white/10 bg-[#111827]">
      {imageUri ? (
        <img src={imageUri} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : videoPost ? (
        <span className="flex h-full w-full items-center justify-center">
          <FiPlay className="h-[22px] w-[22px] text-white" />
        </span>
      ) : isTextOnlyPost(post) || bodyText ? (
        <span
          className="flex h-full w-full items-start p-1.5 text-left text-[10px] font-semibold leading-[13px]"
          style={{
            color: textColor,
            background: card && card.colors.length >= 2
              ? `linear-gradient(180deg, ${card.colors.join(', ')})`
              : card?.colors[0] || getTextOnlyBackgroundColor(post),
          }}
        >
          <span className="line-clamp-4">{bodyText || 'Post'}</span>
        </span>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[#6B7280]">
          <FiImage className="h-[22px] w-[22px]" />
        </span>
      )}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-11"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.55))' }}
      />
      <span className="absolute bottom-2 left-2 z-[2] inline-flex items-center gap-1 rounded-lg bg-black/45 px-1.5 py-0.5 text-[11px] font-bold text-white">
        <FiPlay className="h-3 w-3" />
        {views}
      </span>
    </span>
  );
}

export default function CollectionFeedPage() {
  const { collectionId = '' } = useParams<{ collectionId: string }>();
  const nav = useNavigate();
  const location = useLocation();
  const routeState = location.state as { collectionName?: string; initialCollection?: Collection } | null;
  const [collection, setCollection] = React.useState<Collection | null>(routeState?.initialCollection ?? null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);

  const title = routeState?.collectionName || collection?.name || 'Collection';
  const count = posts.length || collection?.postIds?.length || 0;

  React.useEffect(() => {
    let cancelled = false;
    const lookupId = collectionId || String(routeState?.initialCollection?.id ?? '');
    const collectionName = routeState?.collectionName;
    if (!lookupId && !collectionName) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const coll = (await getCollection(lookupId, collectionName)) || routeState?.initialCollection || null;
        const collectionPosts = await getCollectionPosts(lookupId, collectionName);
        if (cancelled) return;
        setCollection(coll);
        setPosts(collectionPosts);
      } catch (error) {
        console.error('Error loading collection:', error);
        if (!cancelled) {
          setCollection(routeState?.initialCollection ?? null);
          setPosts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId, routeState?.collectionName, routeState?.initialCollection]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(180deg, #05050A 0%, #0B0F19 100%)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #05050A 0%, #0B0F19 100%)' }}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.12] bg-[rgba(15,23,42,0.85)] px-4 py-3.5">
        <button type="button" onClick={() => nav(-1)} aria-label="Back" className="text-white">
          <FiArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-lg font-bold text-white">{title}</h1>
        <button type="button" onClick={() => nav(-1)} aria-label="Close collection" className="text-white">
          <FiX className="h-6 w-6" />
        </button>
      </div>
      <div className="border-b border-white/[0.08] bg-[rgba(15,23,42,0.85)] px-4 py-3">
        <p className="text-sm font-medium text-[#94A3B8]">
          {count} {count === 1 ? 'post' : 'posts'}
        </p>
      </div>
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-10 py-16 text-center">
          <FiBookmark className="h-12 w-12 text-[#94A3B8]" />
          <p className="mt-3 text-base text-[#6B7280]">No posts in this collection yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => {
                upsertLocalPost(post);
                nav(`/post/${encodeURIComponent(post.id)}`, { state: { post } });
              }}
              className="aspect-[3/4] p-[1.5px]"
            >
              <CollectionGridTile post={post} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
