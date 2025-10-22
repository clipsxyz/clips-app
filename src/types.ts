export type Post = {
  id: string;
  userHandle: string;
  locationLabel: string;
  tags: string[];
  mediaUrl: string;
  mediaType?: 'image' | 'video'; // New field to distinguish media types
  text?: string; // Text content of the post
  imageText?: string; // Text overlay on images
  caption?: string; // Caption/description for image/video posts
  stats: { likes: number; views: number; comments: number; shares: number; reclips: number };
  isBookmarked: boolean;
  isFollowing: boolean;
  userLiked: boolean;
  // Reclip functionality
  isReclipped?: boolean;
  originalPostId?: string;
  reclippedBy?: string;
};

export type Comment = {
  id: string;
  postId: string;
  userHandle: string;
  text: string;
  createdAt: number;
  likes: number;
  userLiked: boolean;
  replies?: Comment[];
  parentId?: string; // For nested replies
  replyCount?: number; // Total number of replies
};