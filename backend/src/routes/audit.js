const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');

const router = express.Router();

router.get('/', requireRole('owner'), async (req, res) => {
  const { school_id } = req.user;
  const { entity, user_id, limit = '100', offset = '0' } = req.query;
  const lim = Math.min(parseInt(limit) || 100, 500);
  const off = Math.max(parseInt(offset) || 0, 0);

  const filterParams = [school_id];
  let where = 'WHERE al.school_id = $1';
  if (entity)  { filterParams.push(entity);  where += ` AND al.entity  = $${filterParams.length}`; }
  if (user_id) { filterParams.push(user_id); where += ` AND al.user_id = $${filterParams.length}`; }

  try {
    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT al.*, u.name AS user_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
        [...filterParams, lim, off]
      ),
      pool.query(
        `SELECT COUNT(*) FROM audit_logs al ${where}`,
        filterParams
      ),
    ]);
    res.json({ logs: dataRes.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
