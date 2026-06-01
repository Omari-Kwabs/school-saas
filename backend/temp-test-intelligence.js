const pool = require('./src/config/db');
const school_id = '0d81bf76-3c4a-4bd4-8fdf-35430bc86cbc';
const student_id = 'aaef941d-2bea-4e4a-9d8f-26efcaeb5fff';
const term_id = 'e4a8b9cb-6764-4507-8a41-4e5e03d75e31';
const termStart = '2024-01-01';
const termEnd = '2024-03-31';

const queries = [
  {
    sql: 'SELECT id, name FROM students WHERE school_id = $1 AND id = $2',
    params: [school_id, student_id],
  },
  {
    sql: 'SELECT id, start_date, end_date FROM terms WHERE school_id = $1 AND id = $2',
    params: [school_id, term_id],
  },
  {
    sql: 'SELECT r.total_score, a.subject_id, s.name AS subject_name, a.title, r.created_at FROM results r JOIN assessments a ON r.assessment_id = a.id JOIN subjects s ON a.subject_id = s.id WHERE r.school_id = $1 AND r.student_id = $2 AND a.term_id = $3 ORDER BY r.created_at ASC',
    params: [school_id, student_id, term_id],
  },
  {
    sql: 'SELECT status, COUNT(*) as count FROM attendance WHERE school_id = $1 AND student_id = $2 AND date >= $3 AND date <= $4 GROUP BY status',
    params: [school_id, student_id, termStart, termEnd],
  },
  {
    sql: 'SELECT dr.level, c.name AS competency_name, s.name AS subject_name FROM diagnostic_results dr JOIN competency_benchmarks c ON dr.competency_id = c.id LEFT JOIN subjects s ON c.subject_id = s.id WHERE dr.school_id = $1 AND dr.student_id = $2',
    params: [school_id, student_id],
  },
  {
    sql: 'SELECT status, COUNT(*) as count FROM remediation_flags WHERE school_id = $1 AND student_id = $2 GROUP BY status',
    params: [school_id, student_id],
  },
];

(async () => {
  try {
    for (const q of queries) {
      try {
        const result = await pool.query(q.sql, q.params);
        console.log('OK', q.sql.slice(0, 80).replace(/\s+/g, ' ').trim(), result.rows.length);
      } catch (e) {
        console.error('ERR', q.sql.slice(0, 80).replace(/\s+/g, ' ').trim(), e.stack);
        break;
      }
    }
  } finally {
    await pool.end();
  }
})();
