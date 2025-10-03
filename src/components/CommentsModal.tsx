import React, { useState, useEffect, useRef } from 'react';
import { FiHeart, FiMessageCircle, FiSend, FiX } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import { useAuth } from '../context/Auth';
import { getComments, addComment, likeComment, deleteComment } from '../api/posts';
import { cn } from '../utils/cn';
import type { Comment, Post } from '../types';

interface CommentsModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountUpdate?: (count: number) => void;
}

export default function CommentsModal({ 
  post, 
  isOpen, 
  onClose, 
  onCommentCountUpdate 
}: CommentsModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load comments when modal opens
  useEffect(() => {
    if (isOpen) {
      loadComments();
      // Focus input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const loadComments = async (pageNum = 1) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const newComments = await getComments(post.id, pageNum, 20);
      
      if (pageNum === 1) {
        setComments(newComments);
      } else {
        setComments(prev => [...prev, ...newComments]);
      }
      
      setHasMore(newComments.length === 20);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const comment = await addComment(post.id, newComment.trim());
      setComments(prev => [comment, ...prev]);
      setNewComment('');
      
      // Update comment count
      onCommentCountUpdate?.(comments.length + 1);
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const updatedComment = await likeComment(commentId);
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId ? updatedComment : comment
        )
      );
    } catch (error) {
      console.error('Failed to like comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      onCommentCountUpdate?.(comments.length - 1);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const loadMoreComments = () => {
    if (!isLoading && hasMore) {
      loadComments(page + 1);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md h-[80vh] md:h-[600px] rounded-t-2xl md:rounded-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Comments
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <FiX size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <FiMessageCircle size={48} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No comments yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Be the first to comment!</p>
            </div>
          ) : (
            <>
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {comment.userAvatar ? (
                      <img
                        src={comment.userAvatar}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      comment.userHandle.slice(0, 1).toUpperCase()
                    )}
                  </div>

                  {/* Comment Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {comment.userHandle}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(comment.createdAt)}
                      </span>
                    </div>
                    
                    <p className="text-gray-900 dark:text-gray-100 text-sm mb-2">
                      {comment.content}
                    </p>

                    {/* Comment Actions */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        className={cn(
                          "flex items-center gap-1 text-xs transition-colors",
                          comment.userLiked 
                            ? "text-red-500" 
                            : "text-gray-500 hover:text-red-500"
                        )}
                      >
                        {comment.userLiked ? (
                          <AiFillHeart size={12} />
                        ) : (
                          <FiHeart size={12} />
                        )}
                        {comment.likes > 0 && comment.likes}
                      </button>

                      {/* Delete button for own comments */}
                      {user?.id === comment.userId && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <button
                  onClick={loadMoreComments}
                  disabled={isLoading}
                  className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Load more comments'}
                </button>
              )}

              <div ref={commentsEndRef} />
            </>
          )}
        </div>

        {/* Comment Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className={cn(
                "p-2 rounded-full transition-colors",
                newComment.trim() && !isSubmitting
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400"
              )}
            >
              <FiSend size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
