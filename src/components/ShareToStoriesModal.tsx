import React, { useState } from 'react';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { incrementShares } from '../api/posts';
import { showToast } from '../utils/toast';
import { showUploadOverlay } from '../utils/uploadOverlay';
import ShareToStoriesFeedIcon from './ShareToStoriesFeedIcon';
import type { Post } from '../types';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';

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

  async function generateImageFromText(text: string): Promise<string> {
    const width = 1080;
    const height = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(0.5, '#8b5cf6');
    grad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Text styles
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const margin = 96;
    const maxWidth = width - margin * 2;
    let fontSize = 64;
    ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    // Wrap text into lines
    function wrapLines(t: string): string[] {
      const words = t.split(/\s+/);
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        const metrics = ctx.measureText(test);
        if (metrics.width > maxWidth) {
          if (line) lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    const safeText = (text || 'Shared from the feed').slice(0, TEXT_POST_BODY_MAX_LENGTH);
    let lines = wrapLines(safeText);
    // If too many lines, reduce font size
    while (lines.length > 10 && fontSize > 36) {
      fontSize -= 6;
      ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      lines = wrapLines(safeText);
    }

    const lineHeight = fontSize * 1.35;
    const totalHeight = lines.length * lineHeight;
    let y = height / 2 - totalHeight / 2;
    for (const ln of lines) {
      ctx.fillText(ln, width / 2, y);
      y += lineHeight;
    }

    return canvas.toDataURL('image/png');
  }

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
      const maxLength = TEXT_POST_BODY_MAX_LENGTH;
      const postText = post.text || post.text_content || post.caption || post.imageText || '';
      const truncatedText = postText && postText.length > maxLength
        ? postText.substring(0, maxLength) + '...'
        : postText;

      let mediaUrl = post.mediaUrl;
      let mediaType: 'image' | 'video' = (post.mediaType || 'image');
      const hasRealMediaItems = !!post.mediaItems?.some((m) => m.type === 'image' || m.type === 'video');
      const isTextOnlyShare = !mediaUrl && !hasRealMediaItems;
      const shareText = (truncatedText || 'Shared from feed').trim();

      // Keep text-only shares as text stories so their feed style/template can be preserved on Stories.
      // Only generate an image fallback when the post is not clearly text-only.
      if (!mediaUrl && !isTextOnlyShare) {
        mediaUrl = await generateImageFromText(truncatedText || '');
        mediaType = 'image';
      }

      // Mirror create-page story UX: close immediately and continue upload in mini overlay.
      const overlay = showUploadOverlay({
        thumbUrl: mediaUrl,
        thumbType: mediaType === 'video' ? 'video' : 'image',
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
        mediaUrl,
        isTextOnlyShare ? undefined : mediaType,
        shareText,
        post.locationLabel,
        undefined, // textColor
        undefined, // textSize
        isTextOnlyShare ? undefined : post.id, // sharedFromPost (text-only uses normal story path)
        post.userHandle, // sharedFromUser (always keep author credit, including text-only shares)
        post.textStyle ?? {
          color: '#ffffff',
          size: 'medium',
          background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 50%, #8b5cf6 100%)'
        }, // preserve text look for text-only shares
        undefined, // stickers
        undefined, // taggedUsers
        undefined, // poll
        undefined, // taggedUsersPositions
        undefined, // question
        post.venue // venue for story metadata carousel
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
        className="rounded-2xl border border-white/12 bg-black p-6 max-w-sm w-full mx-4 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon — white on black canvas (same glyph as feed) */}
        <div className="flex justify-center mb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
            <ShareToStoriesFeedIcon className="h-[52px] w-[52px] text-white" />
          </div>
        </div>

        <div className="flex justify-center mb-2">
          <p className="gazetteer-shimmer-chrome-gold text-xs font-semibold uppercase tracking-wider">
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
  );
};

export default ShareToStoriesModal;

