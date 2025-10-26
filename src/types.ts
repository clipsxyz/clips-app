export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  age: number;
  interests: string[];
  local: string;
  regional: string;
  national: string;
  handle: string;
  avatarUrl?: string; // Profile picture URL
};

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
  // User location data for filtering
  userLocal?: string;
  userRegional?: string;
  userNational?: string;
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

export type StoryReaction = {
  id: string;
  userId: string;
  userHandle: string;
  emoji: string;
  createdAt: number;
};

export type StoryReply = {
  id: string;
  userId: string;
  userHandle: string;
  text: string;
  createdAt: number;
};

export type Story = {
  id: string;
  userId: string;
  userHandle: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  text?: string;
  textColor?: string;
  textSize?: 'small' | 'medium' | 'large';
  createdAt: number;
  expiresAt: number; // Timestamp when story expires (24 hours from creation)
  location?: string;
  views: number;
  hasViewed: boolean;
  reactions: StoryReaction[];
  replies: StoryReply[];
  userReaction?: string; // Current user's reaction emoji
  sharedFromPost?: string; // Original post ID if this story is shared from a post
  sharedFromUser?: string; // Original post author if this story is shared from a post
};

export type StoryGroup = {
  userId: string;
  userHandle: string;
  avatarUrl?: string;
  name: string;
  stories: Story[];
};