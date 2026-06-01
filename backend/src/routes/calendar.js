const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const requirePrivilege = require('../middleware/privilege');

// GET /api/calendar?year=2026&month=5
// Returns all events for the school (optionally filtered by year/month window)
router.get('/', async (req, res) => {
  try {
    const { year, month } = req.query;
    let query = `
      SELECT e.*, u.name AS created_by_name
      FROM school_events e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.school_id = $1
    `;
    const params = [req.user.school_id];

    if (year && month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      // fetch window: previous month through next month so multi-day events at boundaries show
      query += ` AND (
        e.start_date <= ($${params.length + 1}::date + INTERVAL '1 month' + INTERVAL '6 days')
        AND COALESCE(e.end_date, e.start_date) >= ($${params.length + 1}::date - INTERVAL '6 days')
      )`;
      params.push(start);
    }

    query += ' ORDER BY e.start_date, e.id';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to load calendar events' });
  }
});

// POST /api/calendar
router.post('/', requirePrivilege('calendar:manage'), async (req, res) => {
  try {
    const { title, description, event_type, start_date, end_date } = req.body;
    if (!title || !event_type || !start_date) {
      return res.status(400).json({ error: 'title, event_type and start_date are required' });
    }
    const valid = ['term_start', 'term_end', 'holiday', 'event', 'exam'];
    if (!valid.includes(event_type)) {
      return res.status(400).json({ error: 'Invalid event_type' });
    }
    if (end_date && end_date < start_date) {
      return res.status(400).json({ error: 'end_date cannot be before start_date' });
    }
    const result = await pool.query(
      `INSERT INTO school_events
         (school_id, title, description, event_type, start_date, end_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.school_id, title.trim(), description || null, event_type,
       start_date, end_date || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/calendar/:id
router.put('/:id', requirePrivilege('calendar:manage'), async (req, res) => {
  try {
    const { title, description, event_type, start_date, end_date } = req.body;
    if (!title || !event_type || !start_date) {
      return res.status(400).json({ error: 'title, event_type and start_date are required' });
    }
    const valid = ['term_start', 'term_end', 'holiday', 'event', 'exam'];
    if (!valid.includes(event_type)) {
      return res.status(400).json({ error: 'Invalid event_type' });
    }
    if (end_date && end_date < start_date) {
      return res.status(400).json({ error: 'end_date cannot be before start_date' });
    }
    const result = await pool.query(
      `UPDATE school_events
       SET title=$1, description=$2, event_type=$3, start_date=$4, end_date=$5, updated_at=NOW()
       WHERE id=$6 AND school_id=$7 RETURNING *`,
      [title.trim(), description || null, event_type, start_date, end_date || null,
       req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', requirePrivilege('calendar:manage'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM school_events WHERE id=$1 AND school_id=$2 RETURNING id`,
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
