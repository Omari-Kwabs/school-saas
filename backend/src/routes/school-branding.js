const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const { invalidate: invalidateSchoolCache } = require('../middleware/tenant');

const router = express.Router();

// 500 KB ceiling for logo data URIs
const MAX_LOGO_BYTES = 500 * 1024;

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT name, logo_url, motto, primary_color FROM schools WHERE id = $1',
      [req.user.school_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'School not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', requireRole('owner'), async (req, res) => {
  const { name, logo_url, motto, primary_color } = req.body;

  if (logo_url && Buffer.byteLength(logo_url, 'utf8') > MAX_LOGO_BYTES) {
    return res.status(413).json({ error: 'Logo must be under 500 KB' });
  }

  if (primary_color && !/^#[0-9a-fA-F]{3,6}$/.test(primary_color)) {
    return res.status(400).json({ error: 'primary_color must be a valid hex colour' });
  }

  if (name != null && !name.trim()) {
    return res.status(400).json({ error: 'School name cannot be empty' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE schools
         SET name          = COALESCE($1, name),
             logo_url      = COALESCE($2, logo_url),
             motto         = COALESCE($3, motto),
             primary_color = COALESCE($4, primary_color)
       WHERE id = $5
       RETURNING name, logo_url, motto, primary_color`,
      [
        name          ? name.trim()  : null,
        logo_url      !== undefined  ? logo_url      : null,
        motto         !== undefined  ? motto         : null,
        primary_color !== undefined  ? primary_color : null,
        req.user.school_id,
      ]
    );
    invalidateSchoolCache(req.user.school_id);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
