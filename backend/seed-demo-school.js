const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/school_saas'
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove any existing demo school by code so the script is idempotent.
    await client.query('DELETE FROM schools WHERE code = $1', ['DEMO123']);

    const schoolRes = await client.query(
      `INSERT INTO schools (name, code, address, phone, email, plan, trial_end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        'Demo Academy',
        'DEMO123',
        '100 Learning Way, Test City',
        '555-0100',
        'info@demoacademy.edu',
        'trial',
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      ]
    );
    const schoolId = schoolRes.rows[0].id;

    const ownerHash = await bcrypt.hash('Password123!', 10);
    const teacherHash = await bcrypt.hash('Teacher123!', 10);
    const accountantHash = await bcrypt.hash('Finance123!', 10);

    const users = [
      ['Alice Johnson', 'alice@demoacademy.edu', ownerHash, 'owner'],
      ['Brian Smith', 'brian@demoacademy.edu', teacherHash, 'teacher'],
      ['Cara Patel', 'cara@demoacademy.edu', accountantHash, 'accountant']
    ];

    const userIds = [];
    for (const [name, email, hash, role] of users) {
      const res = await client.query(
        `INSERT INTO users (school_id, name, email, username, password_hash, role)
         VALUES ($1, $2, $3, $3, $4, $5)
         RETURNING id`,
        [schoolId, name, email, hash, role]
      );
      userIds.push(res.rows[0].id);
    }

    const termRes = await client.query(
      `INSERT INTO terms (school_id, name, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [schoolId, 'Term 1', '2026-01-10', '2026-04-30']
    );
    const termId = termRes.rows[0].id;

    const classes = ['Grade 1', 'Grade 2'];
    const classIds = [];
    for (const [index, name] of classes.entries()) {
      const res = await client.query(
        `INSERT INTO classes (school_id, name, order_num)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [schoolId, name, index + 1]
      );
      classIds.push(res.rows[0].id);
    }

    const subjects = ['Mathematics', 'English', 'Science', 'History'];
    const subjectIds = [];
    for (const name of subjects) {
      const res = await client.query(
        `INSERT INTO subjects (school_id, name)
         VALUES ($1, $2)
         RETURNING id`,
        [schoolId, name]
      );
      subjectIds.push(res.rows[0].id);
    }

    const students = [
      ['STU001', 'Emilia Carter', 'female', 'Grace Carter', '555-0101', classIds[0], 'FAM001'],
      ['STU002', 'Noah Rivera', 'male', 'Daniel Rivera', '555-0102', classIds[0], 'FAM002'],
      ['STU003', 'Mia Brooks', 'female', 'Laura Brooks', '555-0103', classIds[1], 'FAM003'],
      ['STU004', 'Liam Gomez', 'male', 'Carlos Gomez', '555-0104', classIds[1], 'FAM003']
    ];

    const studentIds = [];
    for (const [code, name, gender, parentName, parentPhone, classId, familyId] of students) {
      const res = await client.query(
        `INSERT INTO students (school_id, family_id, student_code, name, gender, parent_name, parent_phone, class_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [schoolId, familyId, code, name, gender, parentName, parentPhone, classId]
      );
      studentIds.push(res.rows[0].id);
    }

    for (const studentId of studentIds) {
      await client.query(
        `INSERT INTO enrollments (school_id, student_id, class_id, term_id)
         VALUES ($1, $2, $3, $4)`,
        [schoolId, studentId, studentIds.indexOf(studentId) < 2 ? classIds[0] : classIds[1], termId]
      );
    }

    const attendanceDates = ['2026-01-11', '2026-01-12', '2026-01-13'];
    for (const [i, studentId] of studentIds.entries()) {
      for (const date of attendanceDates) {
        const status = i % 3 === 0 && date === '2026-01-12' ? 'absent' : 'present';
        await client.query(
          `INSERT INTO attendance (school_id, student_id, class_id, date, status, recorded_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [schoolId, studentId, studentIds.indexOf(studentId) < 2 ? classIds[0] : classIds[1], date, status, userIds[1]]
        );
      }
    }

    const gradeValues = [
      [85, 88],
      [78, 82],
      [92, 94],
      [69, 74]
    ];
    for (const [i, studentId] of studentIds.entries()) {
      for (const [j, subjectId] of subjectIds.entries()) {
        const theory = 60 + (i * 5) + (j * 3);
        const practical = theory - 5;
        const total = theory + practical;
        const average = total / 2;
        const classification = average >= 85 ? 'strong' : average >= 70 ? 'average' : 'weak';
        await client.query(
          `INSERT INTO grades (school_id, student_id, subject_id, term_id, class_assignment, test_score, exam_score, recorded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [schoolId, studentId, subjectId, termId, theory * 0.1, theory, practical, userIds[1]]
        );
        await client.query(
          `INSERT INTO results (school_id, student_id, subject_id, term_id, score_theory, score_practical, total_score, average_score, classification, recorded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [schoolId, studentId, subjectId, termId, theory, practical, total, average, classification, userIds[1]]
        );
      }
    }

    const feeItems = ['Tuition', 'Books', 'Uniform'];
    const feeItemIds = [];
    for (const name of feeItems) {
      const res = await client.query(
        `INSERT INTO fee_items (school_id, name)
         VALUES ($1, $2)
         RETURNING id`,
        [schoolId, name]
      );
      feeItemIds.push(res.rows[0].id);
    }

    const feeStructureRes = await client.query(
      `INSERT INTO fee_structures (school_id, class_id, term_id, name, total_amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [schoolId, classIds[0], termId, 'Grade 1 Term 1 Fees', 1200.00]
    );
    const feeStructureId = feeStructureRes.rows[0].id;

    const itemAmounts = [800.00, 250.00, 150.00];
    for (const [idx, feeItemId] of feeItemIds.entries()) {
      await client.query(
        `INSERT INTO fee_structure_items (fee_structure_id, fee_item_id, amount)
         VALUES ($1, $2, $3)`,
        [feeStructureId, feeItemId, itemAmounts[idx]]
      );
    }

    await client.query(
      `INSERT INTO fee_payments (school_id, student_id, fee_type_id, amount_paid, payment_date, receipt_number, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [schoolId, studentIds[0], feeItemIds[0], 400.00, '2026-01-15', 'RCPT-1001', userIds[2]]
    );

    const planRes = await client.query(
      `INSERT INTO payment_plans (school_id, student_id, fee_structure_id, term_id, plan_type, total_amount, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [schoolId, studentIds[0], feeStructureId, termId, '50_50', 1200.00, '2026-01-15']
    );
    const planId = planRes.rows[0].id;

    for (let i = 1; i <= 2; i++) {
      await client.query(
        `INSERT INTO payment_schedules (plan_id, school_id, installment_num, due_date, amount_due)
         VALUES ($1, $2, $3, $4, $5)`,
        [planId, schoolId, i, `2026-0${i + 1}-15`, 600.00]
      );
    }

    await client.query(
      `INSERT INTO payments (school_id, plan_id, student_id, amount_paid, payment_date, receipt_number, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [schoolId, planId, studentIds[0], 600.00, '2026-01-15', 'PMT-1001', userIds[2]]
    );

    await client.query(
      `INSERT INTO feeding_rates (school_id, class_id, rate)
       VALUES ($1, $2, $3)`,
      [schoolId, classIds[0], 5.00]
    );

    await client.query(
      `INSERT INTO feeding_records (school_id, student_id, class_id, date, amount, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [schoolId, studentIds[0], classIds[0], '2026-01-11', 5.00, userIds[2]]
    );

    await client.query(
      `INSERT INTO feeding_payments (school_id, student_id, amount_paid, payment_date, receipt_number, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [schoolId, studentIds[0], 50.00, '2026-01-15', 'FP-1001', userIds[2]]
    );

    await client.query(
      `INSERT INTO discounts (school_id, name, type, value, applies_from_sibling)
       VALUES ($1, $2, $3, $4, $5)`,
      [schoolId, 'Sibling Discount', 'percent', 10.00, 2]
    );

    await client.query(
      `INSERT INTO performance_rules (school_id, condition_type, condition_value, diagnosis, action)
       VALUES ($1, $2, $3, $4, $5)`,
      [schoolId, 'average_score_below', 70.00, 'Student needs extra support', 'Assign tutoring sessions']
    );

    await client.query('COMMIT');
    console.log('Demo school seeded successfully. School code=DEMO123, owner login=alice@demoacademy.edu / Password123!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
