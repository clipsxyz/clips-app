import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../config/database.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Register new user
router.post('/register', [
    body('username').isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('displayName').isLength({ min: 1, max: 100 }),
    body('handle').isLength({ min: 3, max: 100 }).matches(/^[a-zA-Z0-9@]+$/),
    body('locationLocal').optional().isLength({ max: 100 }),
    body('locationRegional').optional().isLength({ max: 100 }),
    body('locationNational').optional().isLength({ max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, displayName, handle, locationLocal, locationRegional, locationNational } = req.body;

        // Check if user already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE username = $1 OR email = $2 OR handle = $3',
            [username, email, handle]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await transaction(async (client) => {
            // Create user
            const userQuery = `
        INSERT INTO users (username, email, password_hash, display_name, handle, location_local, location_regional, location_national)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, username, email, display_name, handle, location_local, location_regional, location_national, created_at
      `;

            const userResult = await client.query(userQuery, [
                username,
                email,
                passwordHash,
                displayName,
                handle,
                locationLocal,
                locationRegional,
                locationNational
            ]);

            return userResult.rows[0];
        });

        // Generate JWT token
        const token = jwt.sign(
            {
                id: result.id,
                username: result.username,
                handle: result.handle
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            user: result,
            token
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login user
router.post('/login', [
    body('email').isEmail(),
    body('password').isLength({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const userResult = await query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                handle: user.handle
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Remove password from response
        const { password_hash, ...userWithoutPassword } = user;

        res.json({
            user: userWithoutPassword,
            token
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Get current user profile
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userResult = await query(
            'SELECT id, username, email, display_name, handle, bio, avatar_url, location_local, location_regional, location_national, is_verified, followers_count, following_count, posts_count, created_at FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(userResult.rows[0]);
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Verify JWT token middleware
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

export default router;
