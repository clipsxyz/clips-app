import React, { useState } from 'react';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { incrementShares } from '../api/posts';
import { showToast } from '../utils/toast';
import { showUploadOverlay } from '../utils/uploadOverlay';
import ShareToStoriesFeedIcon from './ShareToStoriesFeedIcon';
import type { Post } from '../types';
import { buildSharePostToStoriesPayload } from '../utils/sharePostToStories';
import { generateShareTextImage } from '../utils/generateShareTextImage';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas';

interface ShareToStoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  /** Called when share succeeds so the feed can update the post's share count immediately */
  onShareSuccess?: (postId: string) => void;
}

const ShareToStoriesModal: React.FC<ShareToStoriesModalProps> = ({ isOpen, onClose, post, onShareSuccess }) => {
  const { user } = useAuth();
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!user) {
      alert('Please sign in to share clips.');
      return;
    }

    setIsSharing(true);

    // Optimistic: update share count on the card immediately so the number goes up right away
    window.dispatchEvent(new CustomEvent(`shareAdded-${post.id}`));
    onShareSuccess?.(post.id);

    try {
      let payload = buildSharePostToStoriesPayload(post);

      // Canvas fallback for posts with text but no media (non text-only bubble layout).
      if (!payload.mediaUrl && !payload.isTextOnlyShare) {
        const generated = await generateShareTextImage(payload.shareText || '');
        payload = { ...payload, mediaUrl: generated, mediaType: 'image' };
      }

      // Mirror create-page story UX: close immediately and continue upload in mini overlay.
      const overlay = showUploadOverlay({
        thumbUrl: payload.mediaUrl,
        thumbType: payload.mediaType === 'video' ? 'video' : 'image',
        initialMessage: 'Sharing to Stories 24...',
        uploadingTitle: 'Preparing story...',
        successTitle: 'Story shared!',
        errorTitle: 'Story share failed',
      });
      onClose();

      // Create the story (include venue and textStyle/template so shared text-only posts keep template on stories)
      await createStory(
        user.id,
        user.handle || '',
        payload.mediaUrl,
        payload.mediaType,
        payload.shareText,
        payload.locationLabel,
        undefined,
        undefined,
        payload.sharedFromPost,
        payload.sharedFromUser,
        payload.textStyle,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        payload.venue,
      );

      // Persist share count (mock storage / API) so it stays correct when user returns to feed
      try {
        await incrementShares(user.id, post.id);
      } catch (_) {
        // Ignore; UI already updated optimistically
      }

      // Notify feed/story rails to refresh immediately.
      window.dispatchEvent(new CustomEvent('storyCreated', {
        detail: { userHandle: user.handle }
      }));
      window.dispatchEvent(new CustomEvent('storiesUpdated'));

      overlay.success('Shared to Stories 24.');
      showToast?.('Successfully shared to Stories 24!');
    } catch (e) {
      console.error('Failed to share to clips:', e);
      showToast?.('Failed to share to Stories 24. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-sm w-full mx-4 overflow-hidden rounded-2xl border border-white/12 bg-[#060d16] p-6 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <DiscoverAmbientCanvas fixed={false} variant="passport" />
        <div className="relative z-10">
        {/* Icon — white on passport canvas (same glyph as feed) */}
        <div className="flex justify-center mb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
            <ShareToStoriesFeedIcon className="h-[52px] w-[52px] text-white" />
          </div>
        </div>

        <div className="flex justify-center mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#3d9b8f]">
            Gazetteer says
          </p>
        </div>

        <p className="text-center text-lg font-medium text-white mb-6">
          Share this post to your stories
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/35 bg-transparent px-4 py-3 font-medium text-white transition-colors hover:bg-white/10"
            disabled={isSharing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="flex-1 rounded-xl bg-white px-4 py-3 font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSharing ? 'Sharing...' : 'OK'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default ShareToStoriesModal;

