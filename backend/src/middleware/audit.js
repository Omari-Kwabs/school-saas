const pool = require('../config/db');

// Fire-and-forget audit logger. Never throws; never blocks the caller.
// Usage: audit(req, 'CREATE', 'student', newStudent.id, { name: newStudent.name })
module.exports = function audit(req, action, entity, entity_id, meta) {
  pool.query(
    `INSERT INTO audit_logs (school_id, user_id, action, entity, entity_id, meta, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.user?.school_id ?? null,
      req.user?.id        ?? null,
      action,
      entity,
      entity_id ?? null,
      meta      ?? null,
      req.ip    ?? null
    ]
  ).catch(() => {});
};
