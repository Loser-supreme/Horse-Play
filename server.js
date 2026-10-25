// server.js — Hostinger Node.js backend
// Express + MySQL. Reviews auto-expire after 24 hours.

const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// -------- Config --------
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'blessgod';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PORT = process.env.PORT || 3000;

// -------- Database pool --------
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 8,
  queueLimit: 0,
  charset: 'utf8mb4',
});

// -------- Helpers --------
async function cleanupExpired() {
  try {
    await pool.query('DELETE FROM reviews WHERE expiresAt <= ?', [Date.now()]);
  } catch (err) {
    console.error('cleanupExpired failed:', err.message);
  }
}

// -------- API: GET all live reviews --------
app.get('/api/reviews', async (req, res) => {
  try {
    await cleanupExpired();
    const [rows] = await pool.query(
      'SELECT id, name, service, text, rating, date, createdAt, expiresAt FROM reviews WHERE expiresAt > ? ORDER BY createdAt DESC LIMIT 100',
      [Date.now()]
    );
    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/reviews:', err.message);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

// -------- API: POST a new review --------
app.post('/api/reviews', async (req, res) => {
  const { name, service, text, rating } = req.body || {};
  if (!name || !service || !text || !rating) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const now = Date.now();
  const review = {
    id: crypto.randomUUID(),
    name: String(name).trim().slice(0, 50),
    service: String(service).trim().slice(0, 50),
    text: String(text).trim().slice(0, 500),
    rating: Math.min(5, Math.max(1, parseInt(rating, 10) || 5)),
    date: new Date(now).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    }),
    createdAt: now,
    expiresAt: now + TTL_MS,
  };

  try {
    await pool.query('INSERT INTO reviews SET ?', [review]);
    res.status(201).json(review);
  } catch (err) {
    console.error('POST /api/reviews:', err.message);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// -------- API: DELETE a review (admin only) --------
app.delete('/api/reviews', async (req, res) => {
  const providedSecret = req.headers['x-admin-secret'];
  if (providedSecret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing review ID' });

  try {
    const [result] = await pool.query('DELETE FROM reviews WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      // Not an error — the ID just didn't exist (also used for secret verification)
      return res.json({ success: true, deleted: id, existed: false });
    }
    res.json({ success: true, deleted: id, existed: true });
  } catch (err) {
    console.error('DELETE /api/reviews:', err.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// -------- Admin route --------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// -------- Static files --------
app.use(express.static(__dirname, { extensions: ['html'] }));

// -------- 404 for unmatched API routes --------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// -------- SPA fallback --------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -------- Start --------
app.listen(PORT, () => {
  console.log(`Elena Moore Massages running on port ${PORT}`);
});