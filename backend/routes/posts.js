import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param, query as queryValidator, validationResult } from 'express-validator';

const router = express.Router();

// Get posts with pagination and filtering
router.get('/', [
    queryValidator('cursor').optional().isInt({ min: 0 }),
    queryValidator('limit').optional().isInt({ min: 1, max: 50 }),
    queryValidator('filter').optional().isIn(['Finglas', 'Dublin', 'Ireland', 'Following']),
    queryValidator('userId').optional().isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { cursor = 0, limit = 10, filter = 'Dublin', userId } = req.query;
        const offset = parseInt(cursor) * parseInt(limit);

        let whereClause = '';
        let params = [offset, parseInt(limit)];

        if (filter === 'Following' && userId) {
            whereClause = `
        AND p.user_id IN (
          SELECT following_id FROM user_follows 
          WHERE follower_id = $3
        )
      `;
            params.push(userId);
        } else if (filter !== 'Following') {
            whereClause = `AND p.location_label ILIKE $3`;
            params.push(`%${filter}%`);
        }

        const postsQuery = `
      SELECT 
        p.*,
        u.handle as user_handle,
        u.display_name,
        u.avatar_url,
        CASE WHEN pl.user_id IS NOT NULL THEN true ELSE false END as user_liked,
        CASE WHEN pb.user_id IS NOT NULL THEN true ELSE false END as is_bookmarked,
        CASE WHEN uf.follower_id IS NOT NULL THEN true ELSE false END as is_following
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id AND pl.user_id = $${params.length + 1}
      LEFT JOIN post_bookmarks pb ON p.id = pb.post_id AND pb.user_id = $${params.length + 1}
      LEFT JOIN user_follows uf ON p.user_id = uf.following_id AND uf.follower_id = $${params.length + 1}
      WHERE p.is_reclipped = false
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $1
    `;

        if (userId) {
            params.push(userId);
        }

        const posts = await query(postsQuery, params);

        // Get next cursor
        const nextCursor = posts.length === parseInt(limit) ? parseInt(cursor) + 1 : null;

        res.json({
            items: posts,
            nextCursor,
            hasMore: nextCursor !== null
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Get single post
router.get('/:id', [
    param('id').isUUID(),
    queryValidator('userId').optional().isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { userId } = req.query;

        const postQuery = `
      SELECT 
        p.*,
        u.handle as user_handle,
        u.display_name,
        u.avatar_url,
        CASE WHEN pl.user_id IS NOT NULL THEN true ELSE false END as user_liked,
        CASE WHEN pb.user_id IS NOT NULL THEN true ELSE false END as is_bookmarked,
        CASE WHEN uf.follower_id IS NOT NULL THEN true ELSE false END as is_following
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id AND pl.user_id = $2
      LEFT JOIN post_bookmarks pb ON p.id = pb.post_id AND pb.user_id = $2
      LEFT JOIN user_follows uf ON p.user_id = uf.following_id AND uf.follower_id = $2
      WHERE p.id = $1
    `;

        const result = await query(postQuery, [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Failed to fetch post' });
    }
});

// Create new post
router.post('/', [
    authenticateToken,
    body('text').optional().isLength({ min: 1, max: 500 }),
    body('location').optional().isLength({ max: 200 }),
    body('mediaUrl').optional().isURL(),
    body('mediaType').optional().isIn(['image', 'video'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { text, location, mediaUrl, mediaType } = req.body;
        const userId = req.user.id;

        if (!text && !mediaUrl) {
            return res.status(400).json({ error: 'Post must have text or media' });
        }

        const result = await transaction(async (client) => {
            // Create post
            const postQuery = `
        INSERT INTO posts (user_id, user_handle, text_content, media_url, media_type, location_label)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

            const postResult = await client.query(postQuery, [
                userId,
                req.user.handle,
                text,
                mediaUrl,
                mediaType,
                location
            ]);

            // Update user posts count
            await client.query(
                'UPDATE users SET posts_count = posts_count + 1 WHERE id = $1',
                [userId]
            );

            return postResult.rows[0];
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Toggle like on post
router.post('/:id/like', [
    authenticateToken,
    param('id').isUUID()
], async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            // Check if already liked
            const existingLike = await client.query(
                'SELECT id FROM post_likes WHERE user_id = $1 AND post_id = $2',
                [userId, id]
            );

            if (existingLike.rows.length > 0) {
                // Unlike
                await client.query(
                    'DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2',
                    [userId, id]
                );
                await client.query(
                    'UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1',
                    [id]
                );
                return { liked: false };
            } else {
                // Like
                await client.query(
                    'INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2)',
                    [userId, id]
                );
                await client.query(
                    'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
                    [id]
                );
                return { liked: true };
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

// Increment view count
router.post('/:id/view', [
    authenticateToken,
    param('id').isUUID()
], async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await transaction(async (client) => {
            // Insert view (will be ignored if duplicate due to unique constraint)
            await client.query(
                'INSERT INTO post_views (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [userId, id]
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error incrementing view:', error);
        res.status(500).json({ error: 'Failed to increment view' });
    }
});

// Share post
router.post('/:id/share', [
    authenticateToken,
    param('id').isUUID()
], async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await transaction(async (client) => {
            await client.query(
                'INSERT INTO post_shares (user_id, post_id) VALUES ($1, $2)',
                [userId, id]
            );
            await client.query(
                'UPDATE posts SET shares_count = shares_count + 1 WHERE id = $1',
                [id]
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error sharing post:', error);
        res.status(500).json({ error: 'Failed to share post' });
    }
});

// Reclip post
router.post('/:id/reclip', [
    authenticateToken,
    param('id').isUUID()
], async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            // Check if already reclipped
            const existingReclip = await client.query(
                'SELECT id FROM post_reclips WHERE user_id = $1 AND post_id = $2',
                [userId, id]
            );

            if (existingReclip.rows.length > 0) {
                return res.status(400).json({ error: 'Post already reclipped' });
            }

            // Get original post
            const originalPost = await client.query(
                'SELECT * FROM posts WHERE id = $1',
                [id]
            );

            if (originalPost.rows.length === 0) {
                return res.status(404).json({ error: 'Post not found' });
            }

            const post = originalPost.rows[0];

            // Create reclipped post
            const reclipQuery = `
        INSERT INTO posts (user_id, user_handle, text_content, media_url, media_type, location_label, is_reclipped, original_post_id, reclipped_by)
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
        RETURNING *
      `;

            const reclipResult = await client.query(reclipQuery, [
                userId,
                req.user.handle,
                post.text_content,
                post.media_url,
                post.media_type,
                post.location_label,
                id,
                req.user.handle
            ]);

            // Add reclip record
            await client.query(
                'INSERT INTO post_reclips (user_id, post_id, user_handle) VALUES ($1, $2, $3)',
                [userId, id, req.user.handle]
            );

            // Update original post reclip count
            await client.query(
                'UPDATE posts SET reclips_count = reclips_count + 1 WHERE id = $1',
                [id]
            );

            return reclipResult.rows[0];
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error reclipping post:', error);
        res.status(500).json({ error: 'Failed to reclip post' });
    }
});

export default router;
