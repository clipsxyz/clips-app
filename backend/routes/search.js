import { Router } from 'express';
import { validationResult, query as vq } from 'express-validator';
import { query as dbQuery } from '../config/database.js';
import { loadGazetteer } from '../lib/gazetteer.js';

const router = Router();

// GET /api/search?q=&types=users,locations,posts&usersCursor=&locationsCursor=&postsCursor=&usersLimit=&locationsLimit=&postsLimit=
router.get('/', [
    vq('q').isString().isLength({ min: 1, max: 200 }),
    vq('types').optional().isString(),
    vq('usersCursor').optional().isInt({ min: 0 }),
    vq('locationsCursor').optional().isInt({ min: 0 }),
    vq('postsCursor').optional().isInt({ min: 0 }),
    vq('usersLimit').optional().isInt({ min: 1, max: 50 }),
    vq('locationsLimit').optional().isInt({ min: 1, max: 50 }),
    vq('postsLimit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const qRaw = String(req.query.q || '').trim();
        const q = qRaw.toLowerCase();
        const typesStr = String(req.query.types || 'users,locations,posts');
        const types = new Set(typesStr.split(',').map(s => s.trim()).filter(Boolean));

        const usersCursor = parseInt(String(req.query.usersCursor || '0'), 10) || 0;
        const locationsCursor = parseInt(String(req.query.locationsCursor || '0'), 10) || 0;
        const postsCursor = parseInt(String(req.query.postsCursor || '0'), 10) || 0;

        const usersLimit = Math.min(parseInt(String(req.query.usersLimit || '10'), 10) || 10, 50);
        const locationsLimit = Math.min(parseInt(String(req.query.locationsLimit || '10'), 10) || 10, 50);
        const postsLimit = Math.min(parseInt(String(req.query.postsLimit || '10'), 10) || 10, 50);

        const sections = {};

        // Locations section (from gazetteer)
        if (types.has('locations')) {
            const data = await loadGazetteer();
            const scored = data
                .map(item => {
                    const name = (item.name || '').toLowerCase();
                    const country = (item.country || '').toLowerCase();
                    const joined = `${name} ${country}`.trim();
                    const isPrefix = name.startsWith(q) || country.startsWith(q) || joined.startsWith(q);
                    const isIncludes = !isPrefix && (name.includes(q) || country.includes(q));
                    if (!isPrefix && !isIncludes) return null;
                    return { item, score: isPrefix ? 0 : 1 };
                })
                .filter(Boolean)
                .sort((a, b) => a.score - b.score)
                .map(x => x.item);

            const start = locationsCursor * locationsLimit;
            const slice = scored.slice(start, start + locationsLimit);
            const nextCursor = start + slice.length < scored.length ? locationsCursor + 1 : null;

            sections.locations = {
                items: slice,
                nextCursor
            };
        }

        // Users section (from DB)
        if (types.has('users')) {
            // Prefix-first ranking via UNION ALL with discriminator
            const offset = usersCursor * usersLimit;
            const sql = `
        (
          SELECT u.id, u.username, u.display_name, u.handle, u.avatar_url, 0 AS rank
          FROM users u
          WHERE LOWER(u.handle) LIKE $1 || '%'
             OR LOWER(u.display_name) LIKE $1 || '%'
        )
        UNION ALL
        (
          SELECT u.id, u.username, u.display_name, u.handle, u.avatar_url, 1 AS rank
          FROM users u
          WHERE (LOWER(u.handle) LIKE '%' || $1 || '%' OR LOWER(u.display_name) LIKE '%' || $1 || '%')
            AND NOT (LOWER(u.handle) LIKE $1 || '%' OR LOWER(u.display_name) LIKE $1 || '%')
        )
        ORDER BY rank ASC
        LIMIT $2 OFFSET $3
      `;

            let users = [];
            try {
                const r = await dbQuery(sql, [q, usersLimit, offset]);
                users = r.rows || [];
            } catch (e) {
                // If DB unavailable, degrade gracefully
                users = [];
            }
            const nextCursor = users.length === usersLimit ? usersCursor + 1 : null;
            sections.users = { items: users, nextCursor };
        }

        // Posts section (from DB)
        if (types.has('posts')) {
            const offset = postsCursor * postsLimit;
            const sql = `
        SELECT p.id, p.user_id, p.user_handle, p.text_content, p.media_url, p.media_type, p.location_label, p.created_at
        FROM posts p
        WHERE LOWER(COALESCE(p.text_content, '')) LIKE '%' || $1 || '%'
           OR LOWER(COALESCE(p.location_label, '')) LIKE '%' || $1 || '%'
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
      `;
            let posts = [];
            try {
                const r = await dbQuery(sql, [q, postsLimit, offset]);
                posts = r.rows || [];
            } catch (e) {
                posts = [];
            }
            const nextCursor = posts.length === postsLimit ? postsCursor + 1 : null;
            sections.posts = { items: posts, nextCursor };
        }

        res.json({ q: qRaw, sections });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Failed to perform search' });
    }
});

export default router;


