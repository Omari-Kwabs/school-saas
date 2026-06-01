const pool = require('../config/db');

// Roles that are scoped to their teaching assignments.
// Admin-level roles (owner, headmaster_*, accountant, bursar) are NOT listed
// here and receive unrestricted access to all classes/subjects.
const SCOPED_ROLES = new Set(['teacher', 'class_teacher', 'department_head']);

/**
 * Returns scoping information for a teacher/class_teacher user, or null for
 * admin roles (which have unrestricted access).
 *
 * @param {object} user  - req.user from JWT middleware
 * @param {string} [termId] - optional: narrow to this term (or null assignments)
 * @returns {Promise<null | { classIds: string[], assignments: {class_id, subject_id}[], isTeacherOf(classId, subjectId): bool }>}
 */
async function getTeacherScope(user, termId = null) {
  if (!SCOPED_ROLES.has(user.role)) return null;

  // For department_head: scope includes all teaching assignments of every teacher
  // in their department (including themselves), so they can view their dept's data.
  if (user.role === 'department_head') {
    const deptRes = await pool.query(
      'SELECT department_id FROM users WHERE id=$1 AND school_id=$2',
      [user.id, user.school_id]
    );
    const deptId = deptRes.rows[0]?.department_id;

    let taQuery, taParams;
    if (deptId) {
      taParams = [user.school_id, deptId];
      taQuery = `SELECT ta.class_id, ta.subject_id
                 FROM teaching_assignments ta
                 JOIN users u ON u.id = ta.teacher_id
                 WHERE ta.school_id = $1 AND u.department_id = $2`;
    } else {
      // No department assigned yet — fall back to own assignments only
      taParams = [user.school_id, user.id];
      taQuery = `SELECT class_id, subject_id FROM teaching_assignments
                 WHERE school_id = $1 AND teacher_id = $2`;
    }
    if (termId) {
      taParams.push(termId);
      taQuery += ` AND (ta.term_id = $${taParams.length} OR ta.term_id IS NULL)`;
    }
    const { rows } = await pool.query(taQuery, taParams);
    const classIds = [...new Set(rows.map(r => r.class_id))];
    return {
      assignments: rows,
      classIds,
      isTeacherOf(classId, subjectId) {
        return rows.some(r => r.class_id === classId && r.subject_id === subjectId);
      },
    };
  }

  const params = [user.school_id, user.id];
  let q = `SELECT class_id, subject_id FROM teaching_assignments
           WHERE school_id = $1 AND teacher_id = $2`;

  if (termId) {
    params.push(termId);
    q += ` AND (term_id = $${params.length} OR term_id IS NULL)`;
  }

  const { rows } = await pool.query(q, params);
  const classIds = [...new Set(rows.map(r => r.class_id))];

  return {
    assignments: rows,
    classIds,
    isTeacherOf(classId, subjectId) {
      return rows.some(r => r.class_id === classId && r.subject_id === subjectId);
    },
  };
}

/**
 * If the user is a class teacher (class_teacher role) AND is designated as
 * the class teacher for a given class (via classes.class_teacher_id), returns true.
 * Admin roles always return true.
 */
async function isDesignatedClassTeacher(user, classId) {
  if (!SCOPED_ROLES.has(user.role)) return true; // admins bypass

  const { rows } = await pool.query(
    'SELECT class_teacher_id FROM classes WHERE id = $1 AND school_id = $2',
    [classId, user.school_id]
  );
  return rows.length > 0 && rows[0].class_teacher_id === user.id;
}

module.exports = { getTeacherScope, isDesignatedClassTeacher, SCOPED_ROLES };
