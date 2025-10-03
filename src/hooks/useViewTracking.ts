import { useCallback, useRef, useEffect } from 'react';
import { trackView } from '../api/posts';
import { useOfflineMode } from './useOfflineMode';
import { useAuth } from '../context/Auth';

// Hook for tracking post views with Intersection Observer and debouncing
export function useViewTracking() {
  const viewedPosts = useRef<Set<string>>(new Set());
  const viewTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const { queueAction, isOnline } = useOfflineMode();
  const { user } = useAuth();

  const trackPostView = useCallback(async (postId: string) => {
    // Don't track if already viewed in this session
    if (viewedPosts.current.has(postId)) {
      return;
    }

    // Clear any existing timeout for this post
    const existingTimeout = viewTimeouts.current.get(postId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set a timeout to track the view after 2 seconds (user has actually viewed the post)
    const timeout = setTimeout(async () => {
      viewedPosts.current.add(postId);
      
      if (!isOnline) {
        // Queue view for when back online
        await queueAction({ 
          type: 'view', 
          data: { postId }, 
          userId: user?.id || 'anonymous'
        });
      } else {
        // Track view immediately
        await trackView(postId);
      }
      
      viewTimeouts.current.delete(postId);
    }, 2000);

    viewTimeouts.current.set(postId, timeout);
  }, [isOnline, queueAction, user?.id]);

  const markPostAsViewed = useCallback((postId: string) => {
    // Immediately mark as viewed and clear any pending timeout
    viewedPosts.current.add(postId);
    
    const timeout = viewTimeouts.current.get(postId);
    if (timeout) {
      clearTimeout(timeout);
      viewTimeouts.current.delete(postId);
    }
  }, []);

  const clearViewedPosts = useCallback(() => {
    // Clear all viewed posts (useful for testing or session reset)
    viewedPosts.current.clear();
    
    // Clear all pending timeouts
    viewTimeouts.current.forEach(timeout => clearTimeout(timeout));
    viewTimeouts.current.clear();
  }, []);

  // Set up Intersection Observer for automatic view tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-post-id');
            if (postId) {
              trackPostView(postId);
            }
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of the post is visible
        rootMargin: '0px 0px -100px 0px' // Start tracking when post is 100px from bottom
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [trackPostView]);

  const observePost = useCallback((element: HTMLElement, postId: string) => {
    if (observerRef.current) {
      element.setAttribute('data-post-id', postId);
      observerRef.current.observe(element);
    }
  }, []);

  const unobservePost = useCallback((element: HTMLElement) => {
    if (observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);

  return {
    trackPostView,
    markPostAsViewed,
    clearViewedPosts,
    hasViewedPost: (postId: string) => viewedPosts.current.has(postId),
    observePost,
    unobservePost,
    getViewedCount: () => viewedPosts.current.size
  };
}