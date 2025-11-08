-- Gazetteer Social Media App Database Schema
-- Complete table structure for all features implemented

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    handle VARCHAR(100) UNIQUE NOT NULL, -- e.g., "darraghdublin"
    bio TEXT,
    avatar_url VARCHAR(500),
    location_local VARCHAR(100), -- e.g., "Finglas"
    location_regional VARCHAR(100), -- e.g., "Dublin"
    location_national VARCHAR(100), -- e.g., "Ireland"
    is_verified BOOLEAN DEFAULT FALSE,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_handle VARCHAR(100) NOT NULL,
    text_content TEXT,
    caption TEXT, -- Caption for image/video posts
    image_text TEXT, -- Text overlay on images
    media_url VARCHAR(500),
    media_type VARCHAR(20) CHECK (media_type IN ('image', 'video')),
    media_items JSONB, -- Array of media items for carousel/templates
    location_label VARCHAR(200),
    tags TEXT[], -- Array of hashtags
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    reclips_count INTEGER DEFAULT 0,
    is_reclipped BOOLEAN DEFAULT FALSE,
    original_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    reclipped_by VARCHAR(100),
    banner_text VARCHAR(500), -- News ticker banner text
    stickers JSONB, -- Array of sticker overlays
    template_id VARCHAR(100), -- Template used to create the post
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_handle VARCHAR(100) NOT NULL,
    text_content TEXT NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For nested replies
    likes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User interactions tables
CREATE TABLE post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

CREATE TABLE comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, comment_id)
);

CREATE TABLE post_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

CREATE TABLE user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
);

CREATE TABLE post_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id) -- One view per user per post
);

CREATE TABLE post_reclips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_handle VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id) -- One reclip per user per post
);

-- Offline queue table (for offline functionality)
CREATE TABLE offline_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'like', 'follow', 'comment', 'view', 'share', 'reclip', 'commentLike', 'reply'
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For replies
    text_content TEXT, -- For comments/replies
    user_handle VARCHAR(100), -- For reclips
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed'))
);

-- Feed cache table (for offline feed caching)
CREATE TABLE feed_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filter_type VARCHAR(50) NOT NULL, -- 'Finglas', 'Dublin', 'Ireland', 'Following', or custom location
    cached_data JSONB NOT NULL, -- Serialized feed data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(user_id, filter_type)
);

-- Indexes for performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_location ON posts(location_label);
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

CREATE INDEX idx_post_likes_user_post ON post_likes(user_id, post_id);
CREATE INDEX idx_comment_likes_user_comment ON comment_likes(user_id, comment_id);
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);

CREATE INDEX idx_offline_queue_user_status ON offline_queue(user_id, status);
CREATE INDEX idx_feed_cache_user_filter ON feed_cache(user_id, filter_type);

-- Triggers to update counts automatically
CREATE OR REPLACE FUNCTION update_post_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'post_likes' THEN
            UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_TABLE_NAME = 'post_views' THEN
            UPDATE posts SET views_count = views_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_TABLE_NAME = 'comments' THEN
            UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_TABLE_NAME = 'post_shares' THEN
            UPDATE posts SET shares_count = shares_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_TABLE_NAME = 'post_reclips' THEN
            UPDATE posts SET reclips_count = reclips_count + 1 WHERE id = NEW.post_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'post_likes' THEN
            UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
        ELSIF TG_TABLE_NAME = 'post_views' THEN
            UPDATE posts SET views_count = views_count - 1 WHERE id = OLD.post_id;
        ELSIF TG_TABLE_NAME = 'comments' THEN
            UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
        ELSIF TG_TABLE_NAME = 'post_shares' THEN
            UPDATE posts SET shares_count = shares_count - 1 WHERE id = OLD.post_id;
        ELSIF TG_TABLE_NAME = 'post_reclips' THEN
            UPDATE posts SET reclips_count = reclips_count - 1 WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_post_likes_count
    AFTER INSERT OR DELETE ON post_likes
    FOR EACH ROW EXECUTE FUNCTION update_post_counts();

CREATE TRIGGER trigger_post_views_count
    AFTER INSERT OR DELETE ON post_views
    FOR EACH ROW EXECUTE FUNCTION update_post_counts();

CREATE TRIGGER trigger_post_comments_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_post_counts();

CREATE TRIGGER trigger_post_shares_count
    AFTER INSERT OR DELETE ON post_shares
    FOR EACH ROW EXECUTE FUNCTION update_post_counts();

CREATE TRIGGER trigger_post_reclips_count
    AFTER INSERT OR DELETE ON post_reclips
    FOR EACH ROW EXECUTE FUNCTION update_post_counts();

-- Function to update comment counts
CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'comment_likes' THEN
            UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
        ELSIF TG_TABLE_NAME = 'comments' AND NEW.parent_id IS NOT NULL THEN
            UPDATE comments SET replies_count = replies_count + 1 WHERE id = NEW.parent_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'comment_likes' THEN
            UPDATE comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
        ELSIF TG_TABLE_NAME = 'comments' AND OLD.parent_id IS NOT NULL THEN
            UPDATE comments SET replies_count = replies_count - 1 WHERE id = OLD.parent_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_likes_count
    AFTER INSERT OR DELETE ON comment_likes
    FOR EACH ROW EXECUTE FUNCTION update_comment_counts();

CREATE TRIGGER trigger_comment_replies_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_counts();

-- Sample data insertion
INSERT INTO users (username, email, password_hash, display_name, handle, location_local, location_regional, location_national) VALUES
('darraghdublin', 'darragh@example.com', 'hashed_password', 'Darragh', 'darraghdublin', 'Finglas', 'Dublin', 'Ireland'),
('alice_dublin', 'alice@example.com', 'hashed_password', 'Alice', 'alice@dublin', 'Dublin City', 'Dublin', 'Ireland'),
('bob_finglas', 'bob@example.com', 'hashed_password', 'Bob', 'bob@finglas', 'Finglas', 'Dublin', 'Ireland'),
('charlie_ireland', 'charlie@example.com', 'hashed_password', 'Charlie', 'charlie@ireland', 'Cork', 'Cork', 'Ireland');

-- Sample posts
INSERT INTO posts (user_id, user_handle, text_content, location_label, likes_count, views_count, comments_count) VALUES
((SELECT id FROM users WHERE handle = 'alice@dublin'), 'alice@dublin', 'Beautiful sunset at Phoenix Park today! 🌅', 'Phoenix Park, Dublin', 15, 120, 3),
((SELECT id FROM users WHERE handle = 'bob@finglas'), 'bob@finglas', 'Amazing brunch at The Fumbally! 🥞', 'The Fumbally, Dublin', 8, 85, 2),
((SELECT id FROM users WHERE handle = 'charlie@ireland'), 'charlie@ireland', 'Exploring the beautiful streets of Cork today', 'Cork City', 12, 95, 1);

-- Sample comments with replies
INSERT INTO comments (post_id, user_id, user_handle, text_content, likes_count, replies_count) VALUES
((SELECT id FROM posts WHERE text_content LIKE '%Phoenix Park%'), (SELECT id FROM users WHERE handle = 'alice@dublin'), 'alice@dublin', 'This looks amazing! Where is this taken?', 3, 2),
((SELECT id FROM posts WHERE text_content LIKE '%Phoenix Park%'), (SELECT id FROM users WHERE handle = 'bob@finglas'), 'bob@finglas', 'Great shot! 📸', 1, 0),
((SELECT id FROM posts WHERE text_content LIKE '%Fumbally%'), (SELECT id FROM users WHERE handle = 'charlie@ireland'), 'charlie@ireland', 'That brunch looks delicious! What cafe is this?', 0, 1);

-- Sample replies
INSERT INTO comments (post_id, user_id, user_handle, text_content, parent_id, likes_count) VALUES
((SELECT id FROM posts WHERE text_content LIKE '%Phoenix Park%'), (SELECT id FROM users WHERE handle = 'bob@finglas'), 'bob@finglas', 'It''s at Phoenix Park! Great spot for photos.', (SELECT id FROM comments WHERE text_content LIKE '%amazing%'), 1),
((SELECT id FROM posts WHERE text_content LIKE '%Phoenix Park%'), (SELECT id FROM users WHERE handle = 'charlie@ireland'), 'charlie@ireland', 'I was there last week, beautiful place!', (SELECT id FROM comments WHERE text_content LIKE '%amazing%'), 0),
((SELECT id FROM posts WHERE text_content LIKE '%Fumbally%'), (SELECT id FROM users WHERE handle = 'alice@dublin'), 'alice@dublin', 'It''s The Fumbally! Best brunch in Dublin.', (SELECT id FROM comments WHERE text_content LIKE '%delicious%'), 2);
