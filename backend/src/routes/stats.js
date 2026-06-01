const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { school_id, role, privileges } = req.user;
  const canFinance = Array.isArray(privileges)
    ? privileges.includes('finance:read')
    : ['owner','bursar','accountant','headmaster_admin'].includes(role);

  try {
    const queries = [
      pool.query(
        "SELECT COUNT(*) AS total FROM students WHERE school_id = $1 AND status = 'active'",
        [school_id]
      ),
    ];
    if (canFinance) {
      queries.push(
        pool.query(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE school_id = $1',
          [school_id]
        )
      );
    }

    const results = await Promise.all(queries);
    res.json({
      total_students:  parseInt(results[0].rows[0].total, 10),
      total_collected: canFinance ? parseFloat(results[1].rows[0].total) : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
