-- MySQL schema-only dump for clips-app Laravel backend
-- Generated from migrations. No data included.
-- Use: mysql -u user -p database_name < schema-mysql.sql

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET NAMES utf8mb4;

-- --------------------------------------------------------
-- users
-- --------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` char(36) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `handle` varchar(100) NOT NULL,
  `bio` text DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `social_links` json DEFAULT NULL,
  `location_local` varchar(100) DEFAULT NULL,
  `location_regional` varchar(100) DEFAULT NULL,
  `location_national` varchar(100) DEFAULT NULL,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `is_private` tinyint(1) NOT NULL DEFAULT 0,
  `followers_count` int NOT NULL DEFAULT 0,
  `following_count` int NOT NULL DEFAULT 0,
  `posts_count` int NOT NULL DEFAULT 0,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_handle_unique` (`handle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- fcm_tokens
-- --------------------------------------------------------
DROP TABLE IF EXISTS `fcm_tokens`;
CREATE TABLE `fcm_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `user_handle` varchar(255) NOT NULL,
  `token` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fcm_tokens_user_id_index` (`user_id`),
  KEY `fcm_tokens_user_handle_index` (`user_handle`),
  UNIQUE KEY `fcm_tokens_user_id_user_handle_unique` (`user_id`,`user_handle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- notification_preferences
-- --------------------------------------------------------
DROP TABLE IF EXISTS `notification_preferences`;
CREATE TABLE `notification_preferences` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `user_handle` varchar(255) NOT NULL,
  `preferences` json NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notification_preferences_user_id_index` (`user_id`),
  KEY `notification_preferences_user_handle_index` (`user_handle`),
  UNIQUE KEY `notification_preferences_user_id_user_handle_unique` (`user_id`,`user_handle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- posts
-- --------------------------------------------------------
DROP TABLE IF EXISTS `posts`;
CREATE TABLE `posts` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `user_handle` varchar(100) NOT NULL,
  `text_content` text DEFAULT NULL,
  `caption` text DEFAULT NULL,
  `image_text` text DEFAULT NULL,
  `media_url` varchar(500) DEFAULT NULL,
  `media_type` varchar(20) DEFAULT NULL,
  `location_label` varchar(200) DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `likes_count` int NOT NULL DEFAULT 0,
  `views_count` int NOT NULL DEFAULT 0,
  `comments_count` int NOT NULL DEFAULT 0,
  `shares_count` int NOT NULL DEFAULT 0,
  `reclips_count` int NOT NULL DEFAULT 0,
  `is_reclipped` tinyint(1) NOT NULL DEFAULT 0,
  `original_post_id` char(36) DEFAULT NULL,
  `original_user_handle` varchar(100) DEFAULT NULL,
  `reclipped_by` varchar(100) DEFAULT NULL,
  `banner_text` varchar(500) DEFAULT NULL,
  `stickers` json DEFAULT NULL,
  `template_id` varchar(100) DEFAULT NULL,
  `media_items` json DEFAULT NULL,
  `text_style` json DEFAULT NULL,
  `video_captions_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `video_caption_text` text DEFAULT NULL,
  `subtitles_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `subtitle_text` text DEFAULT NULL,
  `edit_timeline` json DEFAULT NULL,
  `render_job_id` char(36) DEFAULT NULL,
  `final_video_url` varchar(500) DEFAULT NULL,
  `music_track_id` bigint unsigned DEFAULT NULL,
  `music_attribution` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `posts_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `posts_location_label_index` (`location_label`),
  KEY `posts_created_at_index` (`created_at`),
  KEY `posts_original_user_handle_index` (`original_user_handle`),
  KEY `posts_original_post_id_foreign` (`original_post_id`),
  KEY `posts_render_job_id_index` (`render_job_id`),
  KEY `posts_music_track_id_index` (`music_track_id`),
  CONSTRAINT `posts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `posts_original_post_id_foreign` FOREIGN KEY (`original_post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- comments
-- --------------------------------------------------------
DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `user_handle` varchar(100) NOT NULL,
  `text_content` text NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `likes_count` int NOT NULL DEFAULT 0,
  `replies_count` int NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `comments_post_id_created_at_index` (`post_id`,`created_at`),
  KEY `comments_parent_id_index` (`parent_id`),
  KEY `comments_post_id_foreign` (`post_id`),
  KEY `comments_user_id_foreign` (`user_id`),
  KEY `comments_parent_id_foreign` (`parent_id`),
  CONSTRAINT `comments_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- post_likes
-- --------------------------------------------------------
DROP TABLE IF EXISTS `post_likes`;
CREATE TABLE `post_likes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_likes_user_id_post_id_unique` (`user_id`,`post_id`),
  KEY `post_likes_user_id_post_id_index` (`user_id`,`post_id`),
  KEY `post_likes_user_id_foreign` (`user_id`),
  KEY `post_likes_post_id_foreign` (`post_id`),
  CONSTRAINT `post_likes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_likes_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- comment_likes
-- --------------------------------------------------------
DROP TABLE IF EXISTS `comment_likes`;
CREATE TABLE `comment_likes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `comment_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `comment_likes_user_id_comment_id_unique` (`user_id`,`comment_id`),
  KEY `comment_likes_user_id_comment_id_index` (`user_id`,`comment_id`),
  KEY `comment_likes_user_id_foreign` (`user_id`),
  KEY `comment_likes_comment_id_foreign` (`comment_id`),
  CONSTRAINT `comment_likes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comment_likes_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- post_bookmarks
-- --------------------------------------------------------
DROP TABLE IF EXISTS `post_bookmarks`;
CREATE TABLE `post_bookmarks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_bookmarks_user_id_post_id_unique` (`user_id`,`post_id`),
  KEY `post_bookmarks_user_id_post_id_index` (`user_id`,`post_id`),
  KEY `post_bookmarks_user_id_foreign` (`user_id`),
  KEY `post_bookmarks_post_id_foreign` (`post_id`),
  CONSTRAINT `post_bookmarks_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_bookmarks_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- user_follows
-- --------------------------------------------------------
DROP TABLE IF EXISTS `user_follows`;
CREATE TABLE `user_follows` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `follower_id` char(36) NOT NULL,
  `following_id` char(36) NOT NULL,
  `status` enum('pending','accepted') NOT NULL DEFAULT 'accepted',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_follows_follower_id_following_id_unique` (`follower_id`,`following_id`),
  KEY `user_follows_follower_id_index` (`follower_id`),
  KEY `user_follows_following_id_index` (`following_id`),
  KEY `user_follows_following_id_status_index` (`following_id`,`status`),
  KEY `user_follows_follower_id_foreign` (`follower_id`),
  KEY `user_follows_following_id_foreign` (`following_id`),
  CONSTRAINT `user_follows_follower_id_foreign` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_follows_following_id_foreign` FOREIGN KEY (`following_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- post_shares
-- --------------------------------------------------------
DROP TABLE IF EXISTS `post_shares`;
CREATE TABLE `post_shares` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_shares_user_post_unique` (`user_id`,`post_id`),
  KEY `post_shares_user_id_post_id_index` (`user_id`,`post_id`),
  KEY `post_shares_user_id_foreign` (`user_id`),
  KEY `post_shares_post_id_foreign` (`post_id`),
  CONSTRAINT `post_shares_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_shares_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- post_views
-- --------------------------------------------------------
DROP TABLE IF EXISTS `post_views`;
CREATE TABLE `post_views` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_views_user_id_post_id_unique` (`user_id`,`post_id`),
  KEY `post_views_user_id_post_id_index` (`user_id`,`post_id`),
  KEY `post_views_user_id_foreign` (`user_id`),
  KEY `post_views_post_id_foreign` (`post_id`),
  CONSTRAINT `post_views_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_views_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- post_reclips
-- --------------------------------------------------------
DROP TABLE IF EXISTS `post_reclips`;
CREATE TABLE `post_reclips` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `user_handle` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_reclips_user_id_post_id_unique` (`user_id`,`post_id`),
  KEY `post_reclips_user_id_post_id_index` (`user_id`,`post_id`),
  KEY `post_reclips_user_id_foreign` (`user_id`),
  KEY `post_reclips_post_id_foreign` (`post_id`),
  CONSTRAINT `post_reclips_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_reclips_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- offline_queue
-- --------------------------------------------------------
DROP TABLE IF EXISTS `offline_queue`;
CREATE TABLE `offline_queue` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `post_id` char(36) DEFAULT NULL,
  `comment_id` char(36) DEFAULT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `text_content` text DEFAULT NULL,
  `user_handle` varchar(100) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `offline_queue_user_id_status_index` (`user_id`,`status`),
  KEY `offline_queue_user_id_foreign` (`user_id`),
  KEY `offline_queue_post_id_foreign` (`post_id`),
  KEY `offline_queue_comment_id_foreign` (`comment_id`),
  KEY `offline_queue_parent_id_foreign` (`parent_id`),
  CONSTRAINT `offline_queue_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `offline_queue_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `offline_queue_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `offline_queue_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- feed_cache
-- --------------------------------------------------------
DROP TABLE IF EXISTS `feed_cache`;
CREATE TABLE `feed_cache` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `filter_type` varchar(50) NOT NULL,
  `cached_data` json NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feed_cache_user_id_filter_type_unique` (`user_id`,`filter_type`),
  KEY `feed_cache_user_id_filter_type_index` (`user_id`,`filter_type`),
  KEY `feed_cache_user_id_foreign` (`user_id`),
  CONSTRAINT `feed_cache_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- notifications
-- --------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `type` varchar(50) NOT NULL,
  `from_handle` varchar(100) NOT NULL,
  `to_handle` varchar(100) NOT NULL,
  `message` text DEFAULT NULL,
  `post_id` char(36) DEFAULT NULL,
  `comment_id` char(36) DEFAULT NULL,
  `read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_read_index` (`user_id`,`read`),
  KEY `notifications_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `notifications_to_handle_read_index` (`to_handle`,`read`),
  KEY `notifications_user_id_foreign` (`user_id`),
  KEY `notifications_post_id_foreign` (`post_id`),
  KEY `notifications_comment_id_foreign` (`comment_id`),
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- messages
-- --------------------------------------------------------
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` char(36) NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `sender_handle` varchar(100) NOT NULL,
  `recipient_handle` varchar(100) NOT NULL,
  `text` text DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `is_system_message` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `messages_conversation_id_created_at_index` (`conversation_id`,`created_at`),
  KEY `messages_sender_handle_created_at_index` (`sender_handle`,`created_at`),
  KEY `messages_recipient_handle_created_at_index` (`recipient_handle`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- music (before posts FK to render_jobs)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `music`;
CREATE TABLE `music` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `artist` varchar(255) DEFAULT NULL,
  `genre` varchar(255) DEFAULT NULL,
  `mood` varchar(255) DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `url` varchar(255) NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `thumbnail_url` varchar(255) DEFAULT NULL,
  `usage_count` int NOT NULL DEFAULT 0,
  `is_ai_generated` tinyint(1) NOT NULL DEFAULT 0,
  `ai_service` varchar(255) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `license_type` varchar(255) DEFAULT NULL,
  `license_url` varchar(255) DEFAULT NULL,
  `license_requires_attribution` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `music_genre_index` (`genre`),
  KEY `music_mood_index` (`mood`),
  KEY `music_is_ai_generated_index` (`is_ai_generated`),
  KEY `music_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- render_jobs
-- --------------------------------------------------------
DROP TABLE IF EXISTS `render_jobs`;
CREATE TABLE `render_jobs` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'queued',
  `edit_timeline` json NOT NULL,
  `ai_music_config` json DEFAULT NULL,
  `video_source_url` varchar(255) NOT NULL,
  `music_url` varchar(255) DEFAULT NULL,
  `final_video_url` varchar(255) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `render_jobs_user_id_status_index` (`user_id`,`status`),
  KEY `render_jobs_post_id_index` (`post_id`),
  KEY `render_jobs_status_created_at_index` (`status`,`created_at`),
  KEY `render_jobs_user_id_foreign` (`user_id`),
  KEY `render_jobs_post_id_foreign` (`post_id`),
  CONSTRAINT `render_jobs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `render_jobs_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- stories
-- --------------------------------------------------------
DROP TABLE IF EXISTS `stories`;
CREATE TABLE `stories` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `user_handle` varchar(100) NOT NULL,
  `media_url` varchar(500) DEFAULT NULL,
  `media_type` varchar(20) DEFAULT NULL,
  `text` text DEFAULT NULL,
  `text_color` varchar(50) DEFAULT NULL,
  `text_size` varchar(20) DEFAULT NULL,
  `text_style` json DEFAULT NULL,
  `stickers` json DEFAULT NULL,
  `tagged_users` json DEFAULT NULL,
  `location` varchar(200) DEFAULT NULL,
  `views_count` int NOT NULL DEFAULT 0,
  `expires_at` timestamp NOT NULL,
  `shared_from_post_id` char(36) DEFAULT NULL,
  `shared_from_user_handle` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stories_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `stories_expires_at_index` (`expires_at`),
  KEY `stories_user_handle_created_at_index` (`user_handle`,`created_at`),
  KEY `stories_user_id_foreign` (`user_id`),
  KEY `stories_shared_from_post_id_foreign` (`shared_from_post_id`),
  CONSTRAINT `stories_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stories_shared_from_post_id_foreign` FOREIGN KEY (`shared_from_post_id`) REFERENCES `posts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- story_reactions
-- --------------------------------------------------------
DROP TABLE IF EXISTS `story_reactions`;
CREATE TABLE `story_reactions` (
  `id` char(36) NOT NULL,
  `story_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `user_handle` varchar(100) NOT NULL,
  `emoji` varchar(10) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `story_reactions_story_id_user_id_unique` (`story_id`,`user_id`),
  KEY `story_reactions_story_id_created_at_index` (`story_id`,`created_at`),
  KEY `story_reactions_story_id_foreign` (`story_id`),
  KEY `story_reactions_user_id_foreign` (`user_id`),
  CONSTRAINT `story_reactions_story_id_foreign` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `story_reactions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- story_replies
-- --------------------------------------------------------
DROP TABLE IF EXISTS `story_replies`;
CREATE TABLE `story_replies` (
  `id` char(36) NOT NULL,
  `story_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `user_handle` varchar(100) NOT NULL,
  `text` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `story_replies_story_id_created_at_index` (`story_id`,`created_at`),
  KEY `story_replies_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `story_replies_story_id_foreign` (`story_id`),
  KEY `story_replies_user_id_foreign` (`user_id`),
  CONSTRAINT `story_replies_story_id_foreign` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `story_replies_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- story_views
-- --------------------------------------------------------
DROP TABLE IF EXISTS `story_views`;
CREATE TABLE `story_views` (
  `id` char(36) NOT NULL,
  `story_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `story_views_story_id_user_id_unique` (`story_id`,`user_id`),
  KEY `story_views_story_id_created_at_index` (`story_id`,`created_at`),
  KEY `story_views_story_id_foreign` (`story_id`),
  KEY `story_views_user_id_foreign` (`user_id`),
  CONSTRAINT `story_views_story_id_foreign` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `story_views_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- collections
-- --------------------------------------------------------
DROP TABLE IF EXISTS `collections`;
CREATE TABLE `collections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_private` tinyint(1) NOT NULL DEFAULT 1,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `collections_user_id_index` (`user_id`),
  KEY `collections_is_private_index` (`is_private`),
  KEY `collections_created_at_index` (`created_at`),
  KEY `collections_user_id_foreign` (`user_id`),
  CONSTRAINT `collections_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- collection_posts
-- --------------------------------------------------------
DROP TABLE IF EXISTS `collection_posts`;
CREATE TABLE `collection_posts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `collection_id` bigint unsigned NOT NULL,
  `post_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `collection_posts_collection_id_post_id_unique` (`collection_id`,`post_id`),
  KEY `collection_posts_collection_id_index` (`collection_id`),
  KEY `collection_posts_post_id_index` (`post_id`),
  KEY `collection_posts_collection_id_foreign` (`collection_id`),
  KEY `collection_posts_post_id_foreign` (`post_id`),
  CONSTRAINT `collection_posts_collection_id_foreign` FOREIGN KEY (`collection_id`) REFERENCES `collections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `collection_posts_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- post_tagged_users
-- --------------------------------------------------------
DROP TABLE IF EXISTS `post_tagged_users`;
CREATE TABLE `post_tagged_users` (
  `id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `user_handle` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_tagged_users_post_id_user_id_unique` (`post_id`,`user_id`),
  KEY `post_tagged_users_post_id_index` (`post_id`),
  KEY `post_tagged_users_user_id_index` (`user_id`),
  KEY `post_tagged_users_user_handle_index` (`user_handle`),
  KEY `post_tagged_users_post_id_foreign` (`post_id`),
  KEY `post_tagged_users_user_id_foreign` (`user_id`),
  CONSTRAINT `post_tagged_users_post_id_foreign` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_tagged_users_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- migrations (Laravel)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `migrations`;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add FKs from posts to render_jobs and music (after those tables exist)
ALTER TABLE `posts` ADD CONSTRAINT `posts_render_job_id_foreign` FOREIGN KEY (`render_job_id`) REFERENCES `render_jobs` (`id`) ON DELETE SET NULL;
ALTER TABLE `posts` ADD CONSTRAINT `posts_music_track_id_foreign` FOREIGN KEY (`music_track_id`) REFERENCES `music` (`id`) ON DELETE SET NULL;

-- Optional: CHECK constraints (MySQL 8.0.16+)
-- ALTER TABLE posts ADD CONSTRAINT posts_non_negative_counters CHECK (likes_count >= 0 AND views_count >= 0 AND comments_count >= 0 AND shares_count >= 0 AND reclips_count >= 0);
-- ALTER TABLE comments ADD CONSTRAINT comments_non_negative_counters CHECK (likes_count >= 0 AND replies_count >= 0);

SET FOREIGN_KEY_CHECKS = 1;
