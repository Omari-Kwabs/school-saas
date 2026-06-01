const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const { uploadFile, isConfigured } = require('../lib/storage');
const { invalidate: invalidateSchoolCache } = require('../middleware/tenant');

const router = express.Router();

const LIMITS = {
  logo:      { maxBytes: 2 * 1024 * 1024,  allowed: ['image/jpeg', 'image/png', 'image/webp'] },
  signature: { maxBytes: 1 * 1024 * 1024,  allowed: ['image/jpeg', 'image/png', 'image/webp'] },
  portfolio: { maxBytes: 10 * 1024 * 1024, allowed: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard ceiling, per-type limits checked below
});

function hasMagicBytes(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  if (mimetype === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimetype === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  return false;
}

function storageCheck(req, res, next) {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'File storage not configured' });
  }
  next();
}

function mimeCheck(type) {
  return (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const { maxBytes, allowed } = LIMITS[type];
    if (req.file.size > maxBytes) {
      return res.status(413).json({ error: `File too large. Max ${maxBytes / 1024 / 1024} MB` });
    }
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(415).json({ error: `File type not allowed. Allowed: ${allowed.join(', ')}` });
    }
    if (!hasMagicBytes(req.file.buffer, req.file.mimetype)) {
      return res.status(415).json({ error: 'File content does not match declared type' });
    }
    next();
  };
}

// ── POST /api/uploads/logo — school logo (owner only) ─────────────────────────
router.post('/logo', storageCheck, requireRole('owner'), upload.single('file'), mimeCheck('logo'), async (req, res) => {
  try {
    const url = await uploadFile(req.file.buffer, 'logos', req.file.mimetype, req.file.originalname);
    await pool.query('UPDATE schools SET logo_url=$1 WHERE id=$2', [url, req.user.school_id]);
    invalidateSchoolCache(req.user.school_id);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── POST /api/uploads/signature — teacher/headmaster signature ────────────────
router.post('/signature', storageCheck, upload.single('file'), mimeCheck('signature'), async (req, res) => {
  try {
    const url = await uploadFile(req.file.buffer, 'signatures', req.file.mimetype, req.file.originalname);
    await pool.query('UPDATE users SET signature_data=$1 WHERE id=$2 AND school_id=$3', [url, req.user.id, req.user.school_id]);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── POST /api/uploads/portfolio/:item_id — student portfolio attachment ───────
router.post('/portfolio/:item_id', storageCheck, requirePrivilege('academic:write'), upload.single('file'), mimeCheck('portfolio'), async (req, res) => {
  try {
    const check = await pool.query(
      'SELECT id FROM portfolio_items WHERE id=$1 AND school_id=$2',
      [req.params.item_id, req.user.school_id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Portfolio item not found' });

    const url = await uploadFile(req.file.buffer, 'portfolios', req.file.mimetype, req.file.originalname);
    await pool.query('UPDATE portfolio_items SET file_url=$1 WHERE id=$2', [url, req.params.item_id]);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
