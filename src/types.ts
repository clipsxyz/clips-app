export type Post = {
  id: string;
  userHandle: string;
  locationLabel: string;
  tags: string[];
  mediaUrl: string;
  stats: { likes: number; views: number; comments: number };
  isBookmarked: boolean;
  isFollowing: boolean;
  userLiked: boolean;
};

