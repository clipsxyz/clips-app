import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken } from './auth.js';
import { param, body, validationResult } from 'express-validator';

const router = express.Router();

// Get user profile
router.get('/:handle', [
    param('handle').isLength({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { handle } = req.params;
        const { userId } = req.query; // Current user viewing the profile

        const userQuery = `
      SELECT 
        u.*,
        CASE WHEN uf.follower_id IS NOT NULL THEN true ELSE false END as is_following
      FROM users u
      LEFT JOIN user_follows uf ON u.id = uf.following_id AND uf.follower_id = $2
      WHERE u.handle = $1
    `;

        const userResult = await query(userQuery, [handle, userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Get user's posts
        const postsQuery = `
      SELECT 
        p.*,
        CASE WHEN pl.user_id IS NOT NULL THEN true ELSE false END as user_liked,
        CASE WHEN pb.user_id IS NOT NULL THEN true ELSE false END as is_bookmarked
      FROM posts p
      LEFT JOIN post_likes pl ON p.id = pl.post_id AND pl.user_id = $2
      LEFT JOIN post_bookmarks pb ON p.id = pb.post_id AND pb.user_id = $2
      WHERE p.user_id = $1 AND p.is_reclipped = false
      ORDER BY p.created_at DESC
      LIMIT 20
    `;

        const posts = await query(postsQuery, [user.id, userId]);

        res.json({
            ...user,
            posts: posts.rows
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Follow/Unfollow user
router.post('/:handle/follow', [
    authenticateToken,
    param('handle').isLength({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { handle } = req.params;
        const followerId = req.user.id;

        if (req.user.handle === handle) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }

        const result = await transaction(async (client) => {
            // Get user to follow
            const userResult = await client.query(
                'SELECT id FROM users WHERE handle = $1',
                [handle]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const followingId = userResult.rows[0].id;

            // Check if already following
            const existingFollow = await client.query(
                'SELECT id FROM user_follows WHERE follower_id = $1 AND following_id = $2',
                [followerId, followingId]
            );

            if (existingFollow.rows.length > 0) {
                // Unfollow
                await client.query(
                    'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
                    [followerId, followingId]
                );

                // Update counts
                await client.query(
                    'UPDATE users SET following_count = following_count - 1 WHERE id = $1',
                    [followerId]
                );
                await client.query(
                    'UPDATE users SET followers_count = followers_count - 1 WHERE id = $1',
                    [followingId]
                );

                return { following: false };
            } else {
                // Follow
                await client.query(
                    'INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)',
                    [followerId, followingId]
                );

                // Update counts
                await client.query(
                    'UPDATE users SET following_count = following_count + 1 WHERE id = $1',
                    [followerId]
                );
                await client.query(
                    'UPDATE users SET followers_count = followers_count + 1 WHERE id = $1',
                    [followingId]
                );

                return { following: true };
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Error toggling follow:', error);
        res.status(500).json({ error: 'Failed to toggle follow' });
    }
});

// Get user's followers
router.get('/:handle/followers', [
    param('handle').isLength({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const { handle } = req.params;
        const { cursor = 0, limit = 20 } = req.query;
        const offset = parseInt(cursor) * parseInt(limit);

        const followersQuery = `
      SELECT 
        u.id, u.username, u.display_name, u.handle, u.avatar_url, u.bio,
        uf.created_at as followed_at
      FROM user_follows uf
      JOIN users u ON uf.follower_id = u.id
      WHERE uf.following_id = (SELECT id FROM users WHERE handle = $1)
      ORDER BY uf.created_at DESC
      LIMIT $2 OFFSET $3
    `;

        const followers = await query(followersQuery, [handle, parseInt(limit), offset]);

        const nextCursor = followers.rows.length === parseInt(limit) ? parseInt(cursor) + 1 : null;

        res.json({
            items: followers.rows,
            nextCursor,
            hasMore: nextCursor !== null
        });
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ error: 'Failed to fetch followers' });
    }
});

// Get user's following
router.get('/:handle/following', [
    param('handle').isLength({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const { handle } = req.params;
        const { cursor = 0, limit = 20 } = req.query;
        const offset = parseInt(cursor) * parseInt(limit);

        const followingQuery = `
      SELECT 
        u.id, u.username, u.display_name, u.handle, u.avatar_url, u.bio,
        uf.created_at as followed_at
      FROM user_follows uf
      JOIN users u ON uf.following_id = u.id
      WHERE uf.follower_id = (SELECT id FROM users WHERE handle = $1)
      ORDER BY uf.created_at DESC
      LIMIT $2 OFFSET $3
    `;

        const following = await query(followingQuery, [handle, parseInt(limit), offset]);

        const nextCursor = following.rows.length === parseInt(limit) ? parseInt(cursor) + 1 : null;

        res.json({
            items: following.rows,
            nextCursor,
            hasMore: nextCursor !== null
        });
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ error: 'Failed to fetch following' });
    }
});

export default router;
