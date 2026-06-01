const express        = require('express');
const router         = express.Router();
const pool           = require('../config/db');
const requirePrivilege = require('../middleware/privilege');

// ── Tier/Role helpers ──────────────────────────────────────────────────────────
const CLASS_TEACHER_ROLES = ['teacher', 'class_teacher'];
const HEADMASTER_ROLES    = ['headmaster_academics', 'headmaster_admin', 'owner'];

function tierForRole(role) {
  if (CLASS_TEACHER_ROLES.includes(role)) return 'class_teacher';
  if (HEADMASTER_ROLES.includes(role))    return 'headmaster';
  return null;
}

function canApproveTier(role, tier) {
  if (tier === 'class_teacher') return CLASS_TEACHER_ROLES.includes(role);
  if (tier === 'headmaster')    return HEADMASTER_ROLES.includes(role);
  return false;
}

// ── POST /approvals/request-class ─────────────────────────────────────────────
// Body: { class_id, term_id, document_type = 'report_card' }
// Creates 2 approval records per active student (class_teacher + headmaster tiers)
router.post(
  '/request-class',
  requirePrivilege('academic:write'),
  async (req, res) => {
    const { class_id, term_id, document_type = 'report_card' } = req.body;
    const schoolId = req.user.school_id;

    if (!class_id || !term_id) {
      return res.status(400).json({ error: 'class_id and term_id are required' });
    }

    try {
      // Fetch class name
      const classRes = await pool.query(
        'SELECT name FROM classes WHERE id = $1 AND school_id = $2',
        [class_id, schoolId]
      );
      if (!classRes.rows.length) {
        return res.status(404).json({ error: 'Class not found' });
      }
      const className = classRes.rows[0].name;

      // Fetch term name
      const termRes = await pool.query(
        'SELECT name FROM terms WHERE id = $1 AND school_id = $2',
        [term_id, schoolId]
      );
      if (!termRes.rows.length) {
        return res.status(404).json({ error: 'Term not found' });
      }
      const termName = termRes.rows[0].name;

      // Fetch active students in this class
      const studRes = await pool.query(
        `SELECT id, name FROM students
         WHERE class_id = $1 AND school_id = $2 AND status = 'active'
         ORDER BY name`,
        [class_id, schoolId]
      );
      const students = studRes.rows;

      if (!students.length) {
        return res.json({ created: 0, skipped: 0, message: 'No active students in this class' });
      }

      const tiers = ['class_teacher', 'headmaster'];

      // Build a single multi-row INSERT for all students × tiers
      const valuePlaceholders = [];
      const valueParams = [];
      let p = 1;
      for (const student of students) {
        for (const tier of tiers) {
          valuePlaceholders.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4},$${p+5},$${p+6},$${p+7},$${p+8},$${p+9},$${p+10},'pending')`);
          valueParams.push(
            schoolId, document_type, student.id, student.name,
            class_id, className, term_id, termName,
            tier, req.user.id, req.user.name
          );
          p += 11;
        }
      }

      const insertRes = await pool.query(
        `INSERT INTO document_approvals
           (school_id, document_type, student_id, student_name,
            class_id, class_name, term_id, term_name,
            approval_tier, requested_by, requested_by_name, status)
         VALUES ${valuePlaceholders.join(',')}
         ON CONFLICT (school_id, document_type, student_id, term_id, approval_tier)
         DO NOTHING`,
        valueParams
      );

      const created = insertRes.rowCount;
      const skipped = students.length * tiers.length - created;

      res.json({ created, skipped });
    } catch (err) {
      console.error('request-class error:', err.message);
      res.status(500).json({ error: 'Failed to create approval requests' });
    }
  }
);

// ── GET /approvals/pending ─────────────────────────────────────────────────────
// Returns pending approvals for current user's tier
router.get('/pending', async (req, res) => {
  const schoolId = req.user.school_id;
  const role     = req.user.role;
  const tier     = tierForRole(role);

  if (!tier) {
    return res.json([]); // role has no approval tier
  }

  try {
    const result = await pool.query(
      `SELECT id, school_id, document_type, student_id, student_name,
              class_id, class_name, term_id, term_name,
              approval_tier, requested_by, requested_by_name,
              requested_at, approver_name, approver_role, status, approved_at
       FROM document_approvals
       WHERE school_id = $1
         AND approval_tier = $2
         AND status = 'pending'
       ORDER BY requested_at DESC`,
      [schoolId, tier]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('pending approvals error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// ── GET /approvals/pending/count ───────────────────────────────────────────────
router.get('/pending/count', async (req, res) => {
  const schoolId = req.user.school_id;
  const role     = req.user.role;
  const tier     = tierForRole(role);

  if (!tier) {
    return res.json({ count: 0 });
  }

  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM document_approvals
       WHERE school_id = $1
         AND approval_tier = $2
         AND status = 'pending'`,
      [schoolId, tier]
    );
    res.json({ count: result.rows[0].count });
  } catch (err) {
    console.error('pending count error:', err.message);
    res.status(500).json({ error: 'Failed to count pending approvals' });
  }
});

// ── GET /approvals/status ──────────────────────────────────────────────────────
// Query: student_id, term_id
router.get('/status', async (req, res) => {
  const { student_id, term_id } = req.query;
  const schoolId = req.user.school_id;

  if (!student_id || !term_id) {
    return res.status(400).json({ error: 'student_id and term_id are required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, document_type, student_id, student_name,
              class_id, class_name, term_id, term_name,
              approval_tier, requested_by, requested_by_name,
              requested_at, approver_id, approver_name, approver_role,
              status, approved_at
       FROM document_approvals
       WHERE school_id = $1
         AND student_id = $2
         AND term_id = $3
       ORDER BY approval_tier`,
      [schoolId, student_id, term_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch approval status' });
  }
});

// ── POST /approvals/:id/approve ────────────────────────────────────────────────
router.post('/:id/approve', async (req, res) => {
  const { id }   = req.params;
  const schoolId = req.user.school_id;
  const role     = req.user.role;

  try {
    // Fetch the approval record
    const apprRes = await pool.query(
      'SELECT * FROM document_approvals WHERE id = $1 AND school_id = $2',
      [id, schoolId]
    );
    if (!apprRes.rows.length) {
      return res.status(404).json({ error: 'Approval record not found' });
    }
    const approval = apprRes.rows[0];

    if (!canApproveTier(role, approval.approval_tier)) {
      return res.status(403).json({ error: 'Your role cannot approve this tier' });
    }

    // Fetch approver signature
    const userRes = await pool.query(
      'SELECT name, signature_data FROM users WHERE id = $1',
      [req.user.id]
    );
    const approver = userRes.rows[0];

    if (!approver?.signature_data) {
      return res.status(400).json({
        error: 'You must set your digital signature in Profile before approving',
      });
    }

    await pool.query(
      `UPDATE document_approvals
       SET approver_id    = $1,
           approver_name  = $2,
           approver_role  = $3,
           signature_data = $4,
           status         = 'approved',
           approved_at    = NOW()
       WHERE id = $5 AND school_id = $6`,
      [req.user.id, approver.name, role, approver.signature_data, id, schoolId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('approve error:', err.message);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// ── POST /approvals/bulk-approve ───────────────────────────────────────────────
// Body: { ids: [id1, id2, ...] }
router.post('/bulk-approve', async (req, res) => {
  const { ids } = req.body;
  const schoolId = req.user.school_id;
  const role     = req.user.role;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  const client = await pool.connect();
  try {
    // Fetch approver signature once
    const userRes = await client.query(
      'SELECT name, signature_data FROM users WHERE id = $1',
      [req.user.id]
    );
    const approver = userRes.rows[0];

    if (!approver?.signature_data) {
      return res.status(400).json({
        error: 'You must set your digital signature in Profile before approving',
      });
    }

    await client.query('BEGIN');

    // Fetch all requested pending approvals in one query
    const apprRes = await client.query(
      `SELECT id, approval_tier FROM document_approvals
       WHERE id = ANY($1) AND school_id = $2 AND status = 'pending'`,
      [ids, schoolId]
    );

    const approvableIds = apprRes.rows
      .filter(r => canApproveTier(role, r.approval_tier))
      .map(r => r.id);

    const skipped = ids.length - approvableIds.length;

    if (approvableIds.length > 0) {
      await client.query(
        `UPDATE document_approvals
         SET approver_id    = $1,
             approver_name  = $2,
             approver_role  = $3,
             signature_data = $4,
             status         = 'approved',
             approved_at    = NOW()
         WHERE id = ANY($5) AND school_id = $6`,
        [req.user.id, approver.name, role, approver.signature_data, approvableIds, schoolId]
      );
    }

    await client.query('COMMIT');
    res.json({ approved: approvableIds.length, skipped });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('bulk-approve error:', err.message);
    res.status(500).json({ error: 'Failed to bulk-approve' });
  } finally {
    client.release();
  }
});

// ── DELETE /approvals/:id ──────────────────────────────────────────────────────
// Owner only — revoke/reset an approval to allow re-request
router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owners can delete approval records' });
  }

  const { id }   = req.params;
  const schoolId = req.user.school_id;

  try {
    const result = await pool.query(
      'DELETE FROM document_approvals WHERE id = $1 AND school_id = $2',
      [id, schoolId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Approval record not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('delete approval error:', err.message);
    res.status(500).json({ error: 'Failed to delete approval' });
  }
});

module.exports = router;
