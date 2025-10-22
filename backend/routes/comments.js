import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

// Get comments for a post
router.get('/post/:postId', [
    param('postId').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { postId } = req.params;
        const { userId } = req.query;

        const commentsQuery = `
      SELECT 
        c.*,
        CASE WHEN cl.user_id IS NOT NULL THEN true ELSE false END as user_liked
      FROM comments c
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id AND cl.user_id = $2
      WHERE c.post_id = $1 AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
    `;

        const comments = await query(commentsQuery, [postId, userId]);

        // Get replies for each comment
        for (let comment of comments) {
            const repliesQuery = `
        SELECT 
          r.*,
          CASE WHEN cl.user_id IS NOT NULL THEN true ELSE false END as user_liked
        FROM comments r
        LEFT JOIN comment_likes cl ON r.id = cl.comment_id AND cl.user_id = $2
        WHERE r.parent_id = $1
        ORDER BY r.created_at ASC
      `;

            const replies = await query(repliesQuery, [comment.id, userId]);
            comment.replies = replies.rows;
        }

        res.json(comments.rows);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Add comment to post
router.post('/post/:postId', [
    authenticateToken,
    param('postId').isUUID(),
    body('text').isLength({ min: 1, max: 500 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { postId } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            // Create comment
            const commentQuery = `
        INSERT INTO comments (post_id, user_id, user_handle, text_content)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

            const commentResult = await client.query(commentQuery, [
                postId,
                userId,
                req.user.handle,
                text
            ]);

            // Update post comment count
            await client.query(
                'UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1',
                [postId]
            );

            return commentResult.rows[0];
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Add reply to comment
router.post('/reply/:parentId', [
    authenticateToken,
    param('parentId').isUUID(),
    body('text').isLength({ min: 1, max: 500 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { parentId } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            // Get parent comment to get post_id
            const parentComment = await client.query(
                'SELECT post_id FROM comments WHERE id = $1',
                [parentId]
            );

            if (parentComment.rows.length === 0) {
                throw new Error('Parent comment not found');
            }

            const postId = parentComment.rows[0].post_id;

            // Create reply
            const replyQuery = `
        INSERT INTO comments (post_id, user_id, user_handle, text_content, parent_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

            const replyResult = await client.query(replyQuery, [
                postId,
                userId,
                req.user.handle,
                text,
                parentId
            ]);

            // Update parent comment replies count
            await client.query(
                'UPDATE comments SET replies_count = replies_count + 1 WHERE id = $1',
                [parentId]
            );

            // Update post comment count
            await client.query(
                'UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1',
                [postId]
            );

            return replyResult.rows[0];
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error adding reply:', error);
        res.status(500).json({ error: 'Failed to add reply' });
    }
});

// Toggle like on comment
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
                'SELECT id FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
                [userId, id]
            );

            if (existingLike.rows.length > 0) {
                // Unlike
                await client.query(
                    'DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
                    [userId, id]
                );
                await client.query(
                    'UPDATE comments SET likes_count = likes_count - 1 WHERE id = $1',
                    [id]
                );
                return { liked: false };
            } else {
                // Like
                await client.query(
                    'INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)',
                    [userId, id]
                );
                await client.query(
                    'UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1',
                    [id]
                );
                return { liked: true };
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Error toggling comment like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

export default router;
