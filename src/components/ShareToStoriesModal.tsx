import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { incrementShares } from '../api/posts';
import { showToast } from '../utils/toast';
import type { Post } from '../types';

interface ShareToStoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  /** Called when share succeeds so the feed can update the post's share count immediately */
  onShareSuccess?: (postId: string) => void;
}

const ShareToStoriesModal: React.FC<ShareToStoriesModalProps> = ({ isOpen, onClose, post, onShareSuccess }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

    const safeText = (text || 'Shared from the feed').slice(0, 240);
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
      // Truncate text to 200 characters for stories
      const maxLength = 200;
      const truncatedText = post.text && post.text.length > maxLength
        ? post.text.substring(0, maxLength) + '...'
        : post.text;

      let mediaUrl = post.mediaUrl;
      let mediaType: 'image' | 'video' = (post.mediaType || 'image');

      // If no media on post, render a text image
      if (!mediaUrl) {
        mediaUrl = await generateImageFromText(truncatedText || '');
        mediaType = 'image';
      }

      // Create the story (include venue and textStyle/template so shared text-only posts keep template on stories)
      await createStory(
        user.id,
        user.handle || '',
        mediaUrl,
        mediaType,
        truncatedText,
        post.locationLabel,
        undefined, // textColor
        undefined, // textSize
        post.id, // sharedFromPost
        post.userHandle, // sharedFromUser
        post.textStyle ?? undefined, // textStyle so stories page can render shared text post with same style
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

      // Close the modal
      onClose();

      // Show success toast
      showToast?.('You shared this to Clips 24!');

      // Delay navigation so the feed's share-count update commits before we unmount
      setTimeout(() => {
        navigate('/stories', {
          state: {
            openUserHandle: user.handle // Open current user's clips
          }
        });
      }, 150);
    } catch (e) {
      console.error('Failed to share to clips:', e);
      alert('Failed to share to Clips 24. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-gray-800 dark:bg-gray-700"></div>
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="32"
                cy="32"
                r="30"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="4 4"
                fill="none"
              />
              <line
                x1="32"
                y1="20"
                x2="32"
                y2="44"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="20"
                y1="32"
                x2="44"
                y2="32"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Title: Gazetteer says – purple/baby blue shimmer (wrapper centres inline-block) */}
        <div className="flex justify-center mb-2">
          <p className="gazetteer-shimmer text-xs font-semibold uppercase tracking-wider">
            Gazetteer says
          </p>
        </div>
        {/* Text */}
        <p className="text-center text-gray-900 dark:text-gray-100 text-lg font-medium mb-6">
          Share this post to your stories
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            disabled={isSharing}
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSharing ? 'Sharing...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareToStoriesModal;

