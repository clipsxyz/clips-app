export type Post = {
  id: string;
  userHandle: string;
  locationLabel: string; // User's regional location (from signup)
  storyLocation: string; // Specific location for this post (from Clip+ page)
  tags: string[];
  mediaUrl: string;
  stats: { likes: number; views: number; comments: number; reclips: number };
  isBookmarked: boolean;
  isFollowing: boolean;
  userLiked: boolean;
  userReclipped: boolean;
  isOwnPost: boolean;
  originalPost?: {
    id: string;
    userHandle: string;
    content: string;
    mediaUrl: string;
  };
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  userHandle: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  likes: number;
  userLiked: boolean;
  replies?: Comment[];
  parentId?: string;
};

export type Reclip = {
  id: string;
  originalPostId: string;
  reclipperId: string;
  reclipperHandle: string;
  createdAt: string;
  comment?: string;
};

