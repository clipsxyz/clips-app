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
  countryFlag?: string; // Emoji flag for national country
  avatarUrl?: string; // Profile picture URL
  bio?: string; // Bio/description
  socialLinks?: {
    website?: string;
    x?: string; // Twitter/X
    instagram?: string;
    tiktok?: string;
  };
  is_verified?: boolean; // Backend field
  is_private?: boolean; // Backend field - profile privacy setting
  followers_count?: number; // Backend field
  following_count?: number; // Backend field
  posts_count?: number; // Backend field
  can_view?: boolean; // Whether current user can view this profile
  has_pending_request?: boolean; // Whether current user has pending follow request
};

export type Post = {
  id: string;
  user_id?: string; // Backend field
  userHandle: string;
  locationLabel: string;
  tags: string[];
  mediaUrl?: string; // Optional for text-only posts (deprecated, use mediaItems for carousel)
  finalVideoUrl?: string; // Final rendered video URL from backend (after processing)
  mediaType?: 'image' | 'video'; // New field to distinguish media types (deprecated, use mediaItems for carousel)
  mediaItems?: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; effects?: Array<{ type: string; intensity?: number; duration?: number; startTime?: number; [key: string]: any }>; text?: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }>; // Multiple media items for carousel with effects/templates, including text-only clips
  text?: string; // Text content of the post (maps to text_content in DB)
  text_content?: string; // Backend field
  imageText?: string; // Text overlay on images
  caption?: string; // Caption/description for image/video posts
  createdAt: number; // Epoch timestamp in milliseconds (like Date.now())
  created_at?: string; // Backend field (ISO string)
  stats: { likes: number; views: number; comments: number; shares: number; reclips: number };
  isBookmarked: boolean;
  isFollowing: boolean;
  userLiked: boolean;
  userReclipped?: boolean;
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
  originalUserHandle?: string; // Original poster's handle (for reclipped posts)
  reclippedBy?: string;
  reclipped_by?: string; // Backend field
  is_reclipped?: boolean; // Backend field
  // User location data for filtering
  userLocal?: string;
  userRegional?: string;
  userNational?: string;
  // Boost data
  isBoosted?: boolean;
  boostExpiresAt?: number; // Epoch timestamp when boost expires
  boostFeedType?: 'local' | 'regional' | 'national';
  // Stickers and templates
  stickers?: StickerOverlay[]; // Stickers applied to the post
  templateId?: string; // Template used to create the post
  // News ticker banner
  bannerText?: string; // Scrolling news ticker banner text
  // Text-only post styling
  textStyle?: {
    color?: string; // Text color
    size?: 'small' | 'medium' | 'large'; // Text size
    background?: string; // Background gradient or color
  };
  // Tagged users
  taggedUsers?: string[]; // Array of user handles tagged in the post
  // Video captions
  videoCaptionsEnabled?: boolean; // Whether video captions are enabled
  videoCaptionText?: string; // Caption text to display on video
  // Video subtitles
  subtitlesEnabled?: boolean; // Whether video subtitles are enabled
  subtitleText?: string; // Subtitle text to display on video
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
  mediaUrl?: string; // Optional for text-only stories
  mediaType?: 'image' | 'video'; // Optional for text-only stories
  text?: string;
  textColor?: string;
  textSize?: 'small' | 'medium' | 'large';
  textStyle?: {
    color?: string;
    size?: 'small' | 'medium' | 'large';
    background?: string;
  };
  stickers?: StickerOverlay[]; // Stickers/GIFs applied to the story
  taggedUsers?: string[]; // Array of user handles tagged in the story
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

export type AdAccount = {
  id: string;
  name: string;
  timezone: string; // e.g., "America/New_York", "Europe/London", "Asia/Tokyo"
  dailyBudget: number; // Daily budget in currency units
  currency: string; // e.g., "USD", "EUR", "GBP"
  lastBudgetReset: number; // Epoch timestamp of last budget reset
  createdAt: number; // Epoch timestamp when account was created
};

export type Ad = {
  id: string;
  adAccountId: string;
  advertiserHandle: string; // e.g., "Brand@Dublin"
  title: string;
  description?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  callToAction?: string; // e.g., "Learn More", "Shop Now"
  linkUrl?: string; // URL to redirect on click
  // Scheduling (epoch timestamps)
  scheduledStart?: number; // Epoch timestamp - when ad should start showing
  scheduledEnd?: number; // Epoch timestamp - when ad should stop showing
  createdAt: number; // Epoch timestamp when ad was created
  // Budget tracking (epoch timestamps)
  dailyBudget: number;
  spentToday: number; // Amount spent today (resets at midnight in ad account timezone)
  lastBudgetReset: number; // Epoch timestamp of last budget reset
  // Stats (all tracked with epoch timestamps)
  stats: {
    impressions: number; // Total impressions
    clicks: number; // Total clicks
    conversions: number; // Total conversions
    spend: number; // Total spend
  };
  // Event timestamps (for attribution)
  events: {
    impressions: number[]; // Array of epoch timestamps when ad was shown
    clicks: number[]; // Array of epoch timestamps when ad was clicked
    conversions: number[]; // Array of epoch timestamps when conversions happened
  };
  // Targeting
  targetLocations?: string[]; // e.g., ["Dublin", "Ireland"]
  targetTags?: string[]; // e.g., ["food", "travel"]
  isActive: boolean;
};

export type Collection = {
  id: string;
  userId: string;
  name: string;
  isPrivate: boolean;
  thumbnailUrl?: string; // URL of first post's media as thumbnail
  postIds: string[]; // Array of post IDs in this collection
  createdAt: number; // Epoch timestamp when collection was created
  updatedAt: number; // Epoch timestamp when collection was last updated
};

export type TemplateClip = {
  id: string;
  duration: number; // Duration in milliseconds
  startTime?: number; // Start time in the audio track (ms)
  placeholderUrl?: string; // Placeholder video/image URL
  mediaType: 'image' | 'video';
  transition?: 'cut' | 'fade' | 'slide' | 'zoom';
  effects?: Array<{
    type: string;
    intensity?: number;
    duration?: number;
    startTime?: number;
    [key: string]: any;
  }>;
};

export type VideoTemplate = {
  id: string;
  name: string;
  category: string; // e.g., "For You", "Viral Song", "Meme", "AI", "Aesthetic"
  thumbnailUrl: string; // Preview thumbnail
  audioUrl?: string; // Audio track URL
  audioDuration?: number; // Total audio duration in ms
  clips: TemplateClip[]; // Array of clips with timing
  usageCount: number; // Number of videos created with this template
  createdAt: number; // When template was created
  isTrending?: boolean; // Whether template is currently trending
  description?: string; // Template description
};

export type Sticker = {
  id: string;
  name: string;
  category: string; // e.g., "Emoji", "Trending", "Reactions", "Decorative", "Text"
  url?: string; // Image URL for custom stickers
  emoji?: string; // Emoji character for emoji stickers
  isAnimated?: boolean; // Whether sticker is animated
  isTrending?: boolean; // Whether sticker is currently trending
  usageCount?: number; // Number of times sticker has been used
};

export type StickerOverlay = {
  id: string;
  stickerId: string;
  sticker: Sticker;
  x: number; // X position as percentage (0-100)
  y: number; // Y position as percentage (0-100)
  scale: number; // Scale factor (0.5 - 2.0)
  rotation: number; // Rotation in degrees (0-360)
  opacity: number; // Opacity (0-1)
  startTime?: number; // Start time in video (ms) - for video stickers
  endTime?: number; // End time in video (ms) - for video stickers
  textContent?: string; // For text stickers
  textColor?: string; // For text stickers
  fontSize?: 'small' | 'medium' | 'large'; // For text stickers
};

// Video editing types
export type MediaClip = {
  id: string;
  mediaUrl: string;
  type: 'image' | 'video';
  startTime: number; // Position in timeline (seconds)
  duration: number; // Duration in timeline (seconds)
  trimStart: number; // Trim from start (seconds)
  trimEnd: number; // Trim from end (seconds)
  speed: number; // 0.5x, 1x, 2x, etc.
  reverse: boolean;
  filter?: string; // Filter ID
  effects?: string[]; // Effect IDs
  originalDuration?: number; // Original media duration (for videos)
};

export type Transition = {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: 'fade' | 'slide' | 'zoom' | 'none';
  duration: number; // Transition duration in seconds
};

export type EditedMedia = {
  clips: MediaClip[];
  transitions: Transition[];
  totalDuration: number; // Total timeline duration in seconds
};