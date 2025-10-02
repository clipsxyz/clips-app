import React from 'react';
import { FiX, FiHeart, FiMessageCircle, FiShare2, FiBookmark, FiPlay } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import { BsBookmarkFill } from 'react-icons/bs';
import { useAuth } from '../context/Auth';

interface PostPreviewModalProps {
  post: {
    id: string;
    imageUrl: string;
    type: 'image' | 'video';
    caption?: string;
    likes: number;
    comments: number;
    isLiked: boolean;
    isBookmarked: boolean;
    timestamp: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onLike?: () => void;
  onBookmark?: () => void;
  onShare?: () => void;
}

export default function PostPreviewModal({ 
  post, 
  isOpen, 
  onClose, 
  onLike, 
  onBookmark, 
  onShare 
}: PostPreviewModalProps) {
  const { user } = useAuth();
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.slice(0, 1).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="font-semibold text-sm">{user?.username || user?.name || 'User'}</div>
              <div className="text-xs text-gray-500">{post.timestamp}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Media */}
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
          {post.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <button className="w-16 h-16 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full flex items-center justify-center transition-colors">
                <FiPlay size={24} className="text-white ml-1" />
              </button>
            </div>
          )}
          <img
            src={post.imageUrl}
            alt="Post content"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Actions */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <button
                onClick={onLike}
                className="flex items-center gap-1 hover:scale-110 transition-transform"
                aria-label={post.isLiked ? 'Unlike' : 'Like'}
              >
                {post.isLiked ? (
                  <AiFillHeart className="text-red-500" size={24} />
                ) : (
                  <FiHeart size={24} />
                )}
              </button>
              <button className="hover:scale-110 transition-transform" aria-label="Comment">
                <FiMessageCircle size={24} />
              </button>
              <button 
                onClick={onShare}
                className="hover:scale-110 transition-transform" 
                aria-label="Share"
              >
                <FiShare2 size={24} />
              </button>
            </div>
            <button
              onClick={onBookmark}
              className="hover:scale-110 transition-transform"
              aria-label={post.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              {post.isBookmarked ? (
                <BsBookmarkFill size={24} />
              ) : (
                <FiBookmark size={24} />
              )}
            </button>
          </div>

          {/* Stats */}
          <div className="text-sm font-semibold mb-2">
            {post.likes.toLocaleString()} likes
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="text-sm">
              <span className="font-semibold">{user?.username || user?.name || 'User'}</span>{' '}
              <span>{post.caption}</span>
            </div>
          )}

          {/* Comments link */}
          {post.comments > 0 && (
            <button className="text-sm text-gray-500 mt-2 hover:text-gray-700 dark:hover:text-gray-300">
              View all {post.comments} comments
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

