export type Post = {
  id: string;
  userHandle: string;
  locationLabel: string;
  tags: string[];
  mediaUrl: string;
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
};