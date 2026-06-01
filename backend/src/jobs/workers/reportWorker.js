const { Worker } = require('bullmq');
const path = require('path');
const fs   = require('fs');
const pool = require('../../config/db');
const { connection } = require('../queue');

let Handlebars;
try {
  Handlebars = require('handlebars');
} catch {
  throw new Error('handlebars package is required. Run: npm install handlebars');
}

// Load and compile template once at worker startup (cached in memory)
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/reportCard.hbs');
const template = Handlebars.compile(fs.readFileSync(TEMPLATE_PATH, 'utf8'));

function classify(total, max) {
  if (!max || max <= 0) return null;
  const pct = (total / max) * 100;
  if (pct >= 75) return 'strong';
  if (pct >= 50) return 'average';
  return 'weak';
}

async function buildClassReportHtml(school_id, class_id, term_id) {
  const [termRes, studentsRes, allResultsRes] = await Promise.all([
    pool.query('SELECT id, name, start_date, end_date FROM terms WHERE school_id=$1 AND id=$2', [school_id, term_id]),
    pool.query(
      `SELECT s.*, c.name AS class_name FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.school_id=$1 AND s.class_id=$2 AND s.status='active' ORDER BY s.name`,
      [school_id, class_id]
    ),
    pool.query(
      `SELECT r.student_id, r.total_score, a.max_score,
              sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code
       FROM results r
       JOIN students st  ON st.id = r.student_id AND st.school_id = $1
       JOIN assessments a ON a.id = r.assessment_id
       JOIN subjects sub ON sub.id = a.subject_id
       WHERE st.class_id = $2 AND a.term_id = $3
       ORDER BY r.student_id, sub.name`,
      [school_id, class_id, term_id]
    ),
  ]);

  if (!termRes.rows.length) throw new Error('Term not found');
  const term = termRes.rows[0];

  // Group results by student
  const resultsByStudent = {};
  for (const row of allResultsRes.rows) {
    if (!resultsByStudent[row.student_id]) resultsByStudent[row.student_id] = [];
    resultsByStudent[row.student_id].push(row);
  }

  // Build template data — all display formatting happens here, not in the template
  const cards = studentsRes.rows.map(student => {
    const rows = resultsByStudent[student.id] || [];
    const subjectMap = {};
    for (const row of rows) {
      if (!subjectMap[row.subject_id]) {
        subjectMap[row.subject_id] = { name: row.subject_name, code: row.subject_code, total: 0, max: 0 };
      }
      subjectMap[row.subject_id].total += parseFloat(row.total_score);
      subjectMap[row.subject_id].max   += parseFloat(row.max_score);
    }

    const subjects = Object.values(subjectMap).map(sub => {
      const cls = classify(sub.total, sub.max);
      return {
        name:       sub.name,
        totalStr:   sub.total.toFixed(1),
        maxStr:     sub.max.toFixed(1),
        pctStr:     sub.max > 0 ? ((sub.total / sub.max) * 100).toFixed(1) + '%' : 'N/A',
        gradeClass: cls || '',
        gradeLabel: cls ? cls.toUpperCase() : '',
      };
    });

    const total = subjects.reduce((s, sub) => s + parseFloat(sub.totalStr), 0);
    const max   = subjects.reduce((s, sub) => s + parseFloat(sub.maxStr),   0);
    const cls   = classify(total, max);

    return {
      student,
      subjects,
      totalStr:   total.toFixed(1),
      maxStr:     max.toFixed(1),
      pctStr:     max > 0 ? ((total / max) * 100).toFixed(1) + '%' : 'N/A',
      gradeClass: cls || '',
      gradeLabel: cls ? cls.toUpperCase() : '',
    };
  });

  return template({ termName: term.name, cards });
}

const reportWorker = new Worker('reports', async (job) => {
  const { school_id, class_id, term_id, job_id } = job.data;

  await pool.query(
    'UPDATE generated_reports SET status=$1, started_at=NOW() WHERE id=$2',
    ['processing', job_id]
  );

  try {
    const html = await buildClassReportHtml(school_id, class_id, term_id);
    await pool.query(
      `UPDATE generated_reports SET status='completed', result_html=$1, completed_at=NOW() WHERE id=$2`,
      [html, job_id]
    );
  } catch (err) {
    await pool.query(
      `UPDATE generated_reports SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
      [err.message, job_id]
    );
    throw err;
  }
}, { connection });

reportWorker.on('failed', (job, err) => {
  console.error(`Report job ${job?.id} failed:`, err.message);
});

module.exports = reportWorker;
