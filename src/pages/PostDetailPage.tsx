import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { FeedCard } from '../App';
import CommentsModal from '../components/CommentsModal';
import ShareModal from '../components/ShareModal';
import { useAuth } from '../context/Auth';
import {
  deletePost,
  getPostById,
  incrementViews,
  reclipPost,
  setReclipState,
  toggleFollowForPost,
  toggleLike,
  upsertLocalPost,
} from '../api/posts';
import { getPostFromCollectionPreviews } from '../api/collections';
import type { Post } from '../types';
import { getStableUserId } from '../utils/userId';

type LocationState = { post?: Post };

export default function PostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userId = getStableUserId(user);
  const snapshot = (location.state as LocationState | null)?.post;
  const [post, setPost] = React.useState<Post | null>(
    snapshot && String(snapshot.id) === String(id) ? snapshot : null,
  );
  const [loading, setLoading] = React.useState(!post);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const postId = String(id || '');
    if (!postId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        let loaded: Post | null =
          snapshot && String(snapshot.id) === postId ? snapshot : null;
        if (!loaded) loaded = await getPostById(postId, userId);
        if (!loaded) loaded = await getPostFromCollectionPreviews(postId, userId);
        if (loaded) {
          upsertLocalPost(loaded);
          const fresh = await getPostById(postId, userId);
          if (fresh) {
            loaded = {
              ...fresh,
              mediaUrl: fresh.mediaUrl || loaded.mediaUrl,
              mediaType: fresh.mediaType || loaded.mediaType,
              mediaItems:
                fresh.mediaItems && fresh.mediaItems.length > 0 ? fresh.mediaItems : loaded.mediaItems,
              finalVideoUrl: fresh.finalVideoUrl || loaded.finalVideoUrl,
              videoPosterUrl: fresh.videoPosterUrl || loaded.videoPosterUrl,
            };
          }
        }
        if (!cancelled) setPost(loaded);
      } catch (err) {
        console.error('Error loading post:', err);
        if (!cancelled && !(snapshot && String(snapshot.id) === postId)) setPost(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  React.useEffect(() => {
    if (!post?.id || post.id.startsWith('mock-scenes-')) return;
    let cancelled = false;
    void incrementViews(userId, post.id)
      .then((updated) => {
        if (cancelled || !updated?.stats) return;
        setPost((current) =>
          current
            ? { ...current, stats: { ...current.stats, views: updated.stats.views ?? current.stats.views } }
            : current,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [post?.id, userId]);

  const handleLike = async () => {
    if (!post) return;
    const previous = post;
    const nextLiked = !post.userLiked;
    const nextLikes = Math.max(0, (post.stats?.likes ?? 0) + (nextLiked ? 1 : -1));
    setPost({ ...post, userLiked: nextLiked, stats: { ...post.stats, likes: nextLikes } });
    try {
      const updated = await toggleLike(userId, post.id, post);
      setPost(updated);
    } catch {
      setPost(previous);
    }
  };

  const handleReclip = async () => {
    if (!post || post.userHandle === user?.handle || post.userReclipped) return;
    const nextReclips = (post.stats?.reclips ?? 0) + 1;
    setPost({ ...post, userReclipped: true, stats: { ...post.stats, reclips: nextReclips } });
    setReclipState(userId, post.id, true);
    try {
      const result = await reclipPost(userId, post.id, user?.handle || '');
      if (result?.originalPost) setPost(result.originalPost);
    } catch {
      setPost(post);
      setReclipState(userId, post.id, false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center bg-black text-white">Loading post…</div>;
  }

  if (!post) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p className="text-base text-[#EF4444]">Post not found</p>
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-white/80">
          Go back
        </button>
      </div>
    );
  }

  const views = post.stats?.views ?? post.views_count ?? 0;
  const reclips = post.stats?.reclips ?? 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-[30] flex items-center justify-between border-b border-white/[0.12] bg-black px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center text-white"
          aria-label="Go back"
        >
          <FiArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold text-white">Post</h1>
        <span className="h-8 w-8" />
      </div>

      <div className="pt-2">
        <FeedCard
          post={post}
          onLike={handleLike}
          onFollow={async () => {
            const updated = await toggleFollowForPost(userId, post.id, post.userHandle, user?.handle);
            if (updated) setPost((current) => (current ? { ...current, isFollowing: updated.isFollowing } : current));
          }}
          onShare={async () => setShareOpen(true)}
          onOpenComments={() => setCommentsOpen(true)}
          onView={async () => {}}
          onReclip={handleReclip}
          onOpenScenes={() => {}}
          onDelete={async () => {
            if (!user?.handle) return;
            await deletePost(userId, post.id, user.handle);
            navigate(-1);
          }}
          onShareSuccess={() => {
            setPost((current) =>
              current ? { ...current, stats: { ...current.stats, shares: (current.stats?.shares ?? 0) + 1 } } : current,
            );
          }}
        />
        <div className="mx-4 -mt-2 flex items-center justify-between rounded-b-[20px] border border-t-0 border-white/15 bg-black px-4 pb-3 pt-1">
          <span className="text-[13px] font-semibold text-[#94A3B8]">{views} views</span>
          <span className="text-[13px] font-semibold text-[#94A3B8]">{reclips} reclips</span>
        </div>
      </div>

      <CommentsModal
        postId={post.id}
        post={post}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />
      <ShareModal
        isOpen={shareOpen}
        post={post}
        onClose={() => setShareOpen(false)}
        onShareSuccess={() => {
          setPost((current) =>
            current ? { ...current, stats: { ...current.stats, shares: (current.stats?.shares ?? 0) + 1 } } : current,
          );
        }}
      />
    </div>
  );
}
