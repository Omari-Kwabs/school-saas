const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');

const router = express.Router();

router.get('/', requireRole('owner'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE school_id=$1 ORDER BY created_at DESC',
      [req.user.school_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});


module.exports = router;
