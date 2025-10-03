import type { Post, Comment, Reclip } from '../types';
import { apiClient } from '../utils/api';

export type Page = { items: Post[]; nextCursor: number | null };

// Helper function to transform API response to Post type
function transformApiPost(apiPost: any): Post {
  return {
    id: apiPost.id.toString(),
    userHandle: apiPost.user?.username || apiPost.user?.name || 'unknown',
    locationLabel: apiPost.user?.location || apiPost.user?.regional_location || 'Unknown Location', // User's regional location
    storyLocation: apiPost.story_location || apiPost.location || 'Unknown Location', // Specific post location
    tags: apiPost.tags || [],
    mediaUrl: apiPost.media_url || apiPost.image_url || 'https://picsum.photos/400/400?random=' + Math.random(),
    stats: {
      likes: apiPost.likes_count || 0,
      views: apiPost.views_count || 0,
      comments: apiPost.comments_count || 0,
      reclips: apiPost.reclips_count || 0
    },
    isBookmarked: apiPost.is_bookmarked || false,
    isFollowing: apiPost.is_following || false,
    userLiked: apiPost.is_liked || false,
    userReclipped: apiPost.is_reclipped || false,
    isOwnPost: apiPost.is_own_post || false,
    originalPost: apiPost.original_post ? {
      id: apiPost.original_post.id.toString(),
      userHandle: apiPost.original_post.user?.username || apiPost.original_post.user?.name || 'unknown',
      content: apiPost.original_post.content || '',
      mediaUrl: apiPost.original_post.media_url || apiPost.original_post.image_url || ''
    } : undefined
  };
}

// Helper function to transform API response to Comment type
function transformApiComment(apiComment: any): Comment {
  return {
    id: apiComment.id.toString(),
    postId: apiComment.post_id?.toString() || apiComment.postId?.toString(),
    userId: apiComment.user_id?.toString() || apiComment.userId?.toString(),
    userHandle: apiComment.user?.username || apiComment.user?.name || 'unknown',
    userAvatar: apiComment.user?.avatar || apiComment.user?.profile_image,
    content: apiComment.content || apiComment.body,
    createdAt: apiComment.created_at || apiComment.createdAt,
    updatedAt: apiComment.updated_at || apiComment.updatedAt,
    likes: apiComment.likes_count || apiComment.likes || 0,
    userLiked: apiComment.is_liked || apiComment.userLiked || false,
    replies: apiComment.replies?.map(transformApiComment) || [],
    parentId: apiComment.parent_id?.toString() || apiComment.parentId?.toString()
  };
}

export async function addPost(postData: {
  userHandle: string;
  locationLabel: string;
  storyLocation: string;
  mediaUrl: string;
  tags: string[];
  userLiked: boolean;
  isBookmarked: boolean;
  isFollowing: boolean;
}): Promise<Post> {
  try {
    const response = await apiClient.request('/posts', {
      method: 'POST',
      body: JSON.stringify({
        user_handle: postData.userHandle,
        location_label: postData.locationLabel,
        story_location: postData.storyLocation,
        media_url: postData.mediaUrl,
        tags: postData.tags,
        user_liked: postData.userLiked,
        is_bookmarked: postData.isBookmarked,
        is_following: postData.isFollowing
      })
    });

    if (response.success && response.data) {
      return transformApiPost(response.data);
    }

    throw new Error(response.message || 'Failed to create post');
  } catch (error) {
    console.error('Failed to create post:', error);
    throw error;
  }
}

export async function fetchPostsPage(tab: string, cursor: number | null, limit = 5, userId = 'me'): Promise<Page> {
  try {
    const params: Record<string, any> = {
      limit: limit.toString(),
      ...(cursor && { cursor: cursor.toString() })
    };

    let response;
    
    // Handle different tab types
    if (tab.toLowerCase() === 'following') {
      response = await apiClient.getFollowingPosts(params);
    } else {
      // For location-based tabs, add location filter
      params.location = tab;
      response = await apiClient.getPosts(params);
    }
    
    if (response.success && response.posts) {
      const transformedPosts = response.posts.map(transformApiPost);
      
      return {
        items: transformedPosts,
        nextCursor: response.data?.next_cursor || response.data?.nextCursor || null
      };
    }
    
    // Fallback to empty result
    return { items: [], nextCursor: null };
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    // Return empty result on error
    return { items: [], nextCursor: null };
  }
}

export async function toggleLike(userId: string, id: string): Promise<Post> {
  try {
    const response = await apiClient.likePost(id);
    
    if (response.success && response.data) {
      return transformApiPost(response.data);
    }
    
    throw new Error(response.message || 'Failed to toggle like');
  } catch (error) {
    console.error('Failed to toggle like:', error);
    throw error;
  }
}

export async function toggleBookmark(userId: string, id: string): Promise<Post> {
  try {
    const response = await apiClient.bookmarkPost(id);
    
    if (response.success && response.data) {
      return transformApiPost(response.data);
    }
    
    throw new Error(response.message || 'Failed to toggle bookmark');
  } catch (error) {
    console.error('Failed to toggle bookmark:', error);
    throw error;
  }
}

export async function toggleFollowForPost(userId: string, id: string): Promise<Post> {
  try {
    // First get the post to find the user handle
    const postResponse = await apiClient.getPost(id);
    if (!postResponse.success || !postResponse.post) {
      throw new Error('Post not found');
    }
    
    const post = postResponse.post;
    const username = post.user?.username || post.user?.name;
    
    if (!username) {
      throw new Error('User not found');
    }
    
    // Toggle follow for the user
    const followResponse = await apiClient.request(`/users/${username}/follow`, {
      method: 'POST'
    });
    
    if (followResponse.success && followResponse.data) {
      return transformApiPost(followResponse.data);
    }
    
    throw new Error(followResponse.message || 'Failed to toggle follow');
  } catch (error) {
    console.error('Failed to toggle follow:', error);
    throw error;
  }
}

// Track a view for a post
export async function trackView(postId: string): Promise<void> {
  try {
    await apiClient.trackPostView(postId);
  } catch (error) {
    console.error('Failed to track view:', error);
    // Don't throw error - view tracking should be silent
  }
}

// Comment-related functions
export async function getComments(postId: string, page = 1, limit = 20): Promise<Comment[]> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    
    const response = await apiClient.request(`/posts/${postId}/comments?${params}`);
    
    if (response.success && response.data) {
      const comments = Array.isArray(response.data) ? response.data : response.data.comments || [];
      return comments.map(transformApiComment);
    }
    
    return [];
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return [];
  }
}

export async function addComment(postId: string, content: string, parentId?: string): Promise<Comment> {
  try {
    const commentData = {
      content,
      ...(parentId && { parent_id: parentId })
    };
    
    const response = await apiClient.request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData)
    });
    
    if (response.success && response.data) {
      return transformApiComment(response.data);
    }
    
    throw new Error(response.message || 'Failed to add comment');
  } catch (error) {
    console.error('Failed to add comment:', error);
    throw error;
  }
}

export async function likeComment(commentId: string): Promise<Comment> {
  try {
    const response = await apiClient.request(`/comments/${commentId}/like`, {
      method: 'POST'
    });
    
    if (response.success && response.data) {
      return transformApiComment(response.data);
    }
    
    throw new Error(response.message || 'Failed to like comment');
  } catch (error) {
    console.error('Failed to like comment:', error);
    throw error;
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  try {
    const response = await apiClient.request(`/comments/${commentId}`, {
      method: 'DELETE'
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete comment');
    }
  } catch (error) {
    console.error('Failed to delete comment:', error);
    throw error;
  }
}

// Reclip functions
export async function reclipPost(postId: string, comment?: string): Promise<Reclip> {
  try {
    const reclipData = {
      original_post_id: postId,
      comment: comment || ''
    };
    
    const response = await apiClient.request(`/posts/${postId}/reclip`, {
      method: 'POST',
      body: JSON.stringify(reclipData)
    });
    
    if (response.success && response.data) {
      return {
        id: response.data.id.toString(),
        originalPostId: response.data.original_post_id?.toString() || postId,
        reclipperId: response.data.reclipper_id?.toString() || '',
        reclipperHandle: response.data.reclipper?.username || response.data.reclipper?.name || '',
        createdAt: response.data.created_at || new Date().toISOString(),
        comment: response.data.comment
      };
    }
    
    throw new Error(response.message || 'Failed to reclip post');
  } catch (error) {
    console.error('Failed to reclip post:', error);
    throw error;
  }
}

export async function unreclipPost(postId: string): Promise<void> {
  try {
    const response = await apiClient.request(`/posts/${postId}/reclip`, {
      method: 'DELETE'
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to unreclip post');
    }
  } catch (error) {
    console.error('Failed to unreclip post:', error);
    throw error;
  }
}

export async function getReclips(postId: string): Promise<Reclip[]> {
  try {
    const response = await apiClient.request(`/posts/${postId}/reclips`);
    
    if (response.success && response.data) {
      const reclips = Array.isArray(response.data) ? response.data : response.data.reclips || [];
      return reclips.map((reclip: any) => ({
        id: reclip.id.toString(),
        originalPostId: reclip.original_post_id?.toString() || postId,
        reclipperId: reclip.reclipper_id?.toString() || '',
        reclipperHandle: reclip.reclipper?.username || reclip.reclipper?.name || '',
        createdAt: reclip.created_at || new Date().toISOString(),
        comment: reclip.comment
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Failed to fetch reclips:', error);
    return [];
  }
}

