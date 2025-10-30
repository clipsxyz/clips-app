import { Router } from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadGazetteer } from '../lib/gazetteer.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Gazetteer data is loaded via lib/gazetteer

router.get('/search', async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
    if (!q) return res.json([]);
    const data = await loadGazetteer();

    // Rank prefix matches first, then substring matches
    const scored = data
        .map(item => {
            const name = item.name.toLowerCase();
            const isPrefix = name.startsWith(q);
            const isIncludes = !isPrefix && name.includes(q);
            if (!isPrefix && !isIncludes) return null;
            return { item, score: isPrefix ? 0 : 1 };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score)
        .slice(0, limit)
        .map(x => x.item);

    res.json(scored);
});

export default router;


