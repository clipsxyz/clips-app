export type User = {
  id: string;
  name: string;
  username?: string; // Backend field
  email: string;
  password: string;
  age?: number;
  interests?: string[];
  local: string;
  regional: string;
  national: string;
  handle: string;
  avatarUrl?: string; // Profile picture URL
  bio?: string; // Bio/description
  socialLinks?: {
    website?: string;
    x?: string; // Twitter/X
    instagram?: string;
    tiktok?: string;
  };
  is_verified?: boolean; // Backend field
  followers_count?: number; // Backend field
  following_count?: number; // Backend field
  posts_count?: number; // Backend field
};

export type Post = {
  id: string;
  user_id?: string; // Backend field
  userHandle: string;
  locationLabel: string;
  tags: string[];
  mediaUrl?: string; // Optional for text-only posts
  mediaType?: 'image' | 'video'; // New field to distinguish media types
  text?: string; // Text content of the post (maps to text_content in DB)
  text_content?: string; // Backend field
  imageText?: string; // Text overlay on images
  caption?: string; // Caption/description for image/video posts
  stats: { likes: number; views: number; comments: number; shares: number; reclips: number };
  isBookmarked: boolean;
  isFollowing: boolean;
  userLiked: boolean;
  // Backend stat fields
  likes_count?: number; // Backend field
  views_count?: number; // Backend field
  comments_count?: number; // Backend field
  shares_count?: number; // Backend field
  reclips_count?: number; // Backend field
  // Reclip functionality
  isReclipped?: boolean;
  originalPostId?: string;
  original_post_id?: string; // Backend field
  reclippedBy?: string;
  reclipped_by?: string; // Backend field
  is_reclipped?: boolean; // Backend field
  // User location data for filtering
  userLocal?: string;
  userRegional?: string;
  userNational?: string;
};

export type Comment = {
  id: string;
  post_id?: string; // Backend field
  postId: string;
  user_id?: string; // Backend field
  userHandle: string;
  text: string;
  text_content?: string; // Backend field
  createdAt: number;
  created_at?: string; // Backend field
  likes: number;
  likes_count?: number; // Backend field
  userLiked: boolean;
  replies?: Comment[];
  parent_id?: string; // Backend field
  parentId?: string; // For nested replies
  replyCount?: number; // Total number of replies
  replies_count?: number; // Backend field
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