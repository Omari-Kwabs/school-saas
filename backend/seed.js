/**
 * seed.js — Full reset + repopulate demonstrating the results → grades flow.
 *
 * Run from the backend directory:   node seed.js
 * Password for every account:       School@1234
 *
 * Grade weights (20 / 20 / 60):
 *   Classwork + Homework → avg % × 20   (max 20)
 *   Class Tests          → avg % × 20   (max 20)
 *   Class Score          = CW+HW + Tests (max 40)
 *   Exam                 → %   × 60     (max 60)
 *   Total                = Class + Exam  (max 100)
 */

require('dotenv').config();
const pool    = require('./src/config/db');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const seedRoles = require('./src/utils/seedRoles');

const uid  = () => crypto.randomUUID();
function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }
function r2(n)          { return Math.round(n * 100) / 100; }
function avgPct(pcts)   { return pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : 0; }

// School-days between two ISO date strings
function schoolDays(from, to) {
  const days = [];
  const cur  = new Date(from + 'T12:00:00Z');
  const end  = new Date(to   + 'T12:00:00Z');
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// Classwork/homework types (for grade compute)
const CW_TYPES = new Set(['classwork', 'homework', 'AfL', 'AaL', 'AoL']);

// Compute & upsert grades for a set of students from already-inserted results
async function computeAndStoreGrades(client, { sId, studentIds, assessments, teacherId, teacherName, subjectId, termId }) {
  const asmIds = assessments.map(a => a.id);
  const { rows: allRes } = await client.query(
    `SELECT student_id, assessment_id, total_score FROM results
     WHERE school_id=$1 AND assessment_id = ANY($2)`,
    [sId, asmIds]
  );
  for (const studentId of studentIds) {
    const sRows = allRes.filter(r => r.student_id === studentId);

    const cwPcts = assessments
      .filter(a => CW_TYPES.has(a.type))
      .flatMap(a => { const r = sRows.find(x => x.assessment_id === a.id); return r ? [+r.total_score / a.max] : []; });
    const classworkScore = r2(avgPct(cwPcts) * 20);

    const ctPcts = assessments
      .filter(a => a.type === 'class_test')
      .flatMap(a => { const r = sRows.find(x => x.assessment_id === a.id); return r ? [+r.total_score / a.max] : []; });
    const classTestScore = r2(avgPct(ctPcts) * 20);

    const classScore = r2(classworkScore + classTestScore);

    const examAsm = assessments.find(a => a.type === 'exam');
    const examRow = examAsm ? sRows.find(x => x.assessment_id === examAsm.id) : null;
    const examScore = examRow ? r2((+examRow.total_score / examAsm.max) * 60) : null;

    await client.query(
      `INSERT INTO grades
         (school_id, student_id, subject_id, term_id,
          classwork_score, class_test_score, class_score, exam_score,
          teacher_name, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (school_id, student_id, subject_id, term_id)
       DO UPDATE SET
         classwork_score=EXCLUDED.classwork_score, class_test_score=EXCLUDED.class_test_score,
         class_score=EXCLUDED.class_score, exam_score=EXCLUDED.exam_score,
         teacher_name=EXCLUDED.teacher_name, recorded_by=EXCLUDED.recorded_by`,
      [sId, studentId, subjectId, termId,
       classworkScore, classTestScore, classScore, examScore, teacherName, teacherId]
    );
  }
}

// Insert assessments and return objects with {id, type, max}
async function mkAssessments(client, { sId, subjectId, classId, termId, specs }) {
  const out = [];
  for (const [title, type, max] of specs) {
    const { rows: [row] } = await client.query(
      `INSERT INTO assessments (school_id, subject_id, class_id, term_id, title, type, max_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [sId, subjectId, classId, termId, title, type, max]
    );
    out.push({ id: row.id, type, max });
  }
  return out;
}

// Insert results. scores[studentIdx][asmIdx] = raw mark
async function mkResults(client, { sId, studentIds, assessments, scores, teacherId }) {
  for (let si = 0; si < studentIds.length; si++) {
    for (let ai = 0; ai < assessments.length; ai++) {
      const score = scores[si][ai];
      if (score == null) continue;
      // Distribute theory/practical: 60/40 split
      const theory    = Math.round(score * 0.6);
      const practical = Math.round(score * 0.4);
      await client.query(
        `INSERT INTO results
           (school_id, student_id, assessment_id,
            score_theory, score_practical, total_score, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (school_id, student_id, assessment_id) DO NOTHING`,
        [sId, studentIds[si], assessments[ai].id,
         theory, practical, score, teacherId]
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  const hash = await bcrypt.hash('School@1234', 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Wipe all tenant data ───────────────────────────────────────────────
    console.log('Clearing all existing data…');
    // Delete FK-constrained children before parent tables that cascade from schools
    await client.query('DELETE FROM fee_structure_items');
    await client.query('DELETE FROM schools');

    // ── 2. School ─────────────────────────────────────────────────────────────
    console.log('Creating Prestige Academy…');
    const sId = uid();
    await client.query(
      `INSERT INTO schools (id, name, code, address, phone, email, plan)
       VALUES ($1,'Prestige Academy','PRST-001',
               '14 Education Crescent, Kumasi, Ghana',
               '+233 20 000 0001','admin@prestige.edu','premium')`,
      [sId]
    );
    await seedRoles(client, sId);
    await client.query(
      `INSERT INTO subscriptions (school_id, plan, status, expiry_date)
       VALUES ($1,'premium','active','2026-12-31')`, [sId]
    );

    // ── 3. Users ──────────────────────────────────────────────────────────────
    console.log('Creating users…');
    const owId  = uid();
    const haId  = uid();
    const t1Id  = uid(); // Maths + Science, designated class teacher of JHS 1
    const t2Id  = uid(); // English + Social Studies
    const t3Id  = uid(); // French + ICT, class teacher Primary 3
    const t4Id  = uid(); // Primary teacher (Primary 1 & 2)
    const acId  = uid();

    for (const [id, role, name, email] of [
      [owId, 'owner',               'Dr. Emmanuel Frimpong',  'director@prestige.edu'      ],
      [haId, 'headmaster_academics','Mrs. Abena Boateng',     'academics@prestige.edu'     ],
      [t1Id, 'class_teacher',       'Mr. Kwame Asante',       'kwame.asante@prestige.edu'  ],
      [t2Id, 'teacher',             'Mrs. Ama Boateng',       'ama.boateng@prestige.edu'   ],
      [t3Id, 'class_teacher',       'Mr. Kofi Mensah',        'kofi.mensah@prestige.edu'   ],
      [t4Id, 'teacher',             'Ms. Akosua Darko',       'akosua.darko@prestige.edu'  ],
      [acId, 'accountant',          'Mr. Bright Appiah',      'accounts@prestige.edu'      ],
    ]) {
      const username = email.split('@')[0];
      await client.query(
        `INSERT INTO users (id,school_id,name,email,username,password_hash,role,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        [id, sId, name, email, username, hash, role]
      );
    }

    // ── 4. Classifications ────────────────────────────────────────────────────
    const clsfLP = uid(), clsfUP = uid();
    await client.query(
      `INSERT INTO classifications (id,school_id,name) VALUES
       ($1,$3,'Lower Primary'), ($2,$3,'Upper Primary & JHS')`,
      [clsfLP, clsfUP, sId]
    );

    // ── 5. Departments ────────────────────────────────────────────────────────
    const dMath = uid(), dLang = uid(), dSoc = uid();
    await client.query(
      `INSERT INTO departments (id,school_id,name,head_id) VALUES
       ($1,$4,'Mathematics & Science',$5),
       ($2,$4,'Languages',$6),
       ($3,$4,'Social Studies & ICT',$7)`,
      [dMath, dLang, dSoc, sId, t1Id, t2Id, t3Id]
    );

    // ── 6. Classes ────────────────────────────────────────────────────────────
    console.log('Creating classes…');
    const classRows = [];
    for (const [name, level, orderNum, clsfId] of [
      ['Primary 1', 'Primary', 1, clsfLP],
      ['Primary 2', 'Primary', 2, clsfLP],
      ['Primary 3', 'Primary', 3, clsfLP],
      ['JHS 1',     'JHS',     4, clsfUP],
    ]) {
      const { rows: [row] } = await client.query(
        `INSERT INTO classes (id,school_id,name,level,order_num,classification_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (school_id,name) DO UPDATE
           SET level=EXCLUDED.level, order_num=EXCLUDED.order_num,
               classification_id=EXCLUDED.classification_id
         RETURNING id`,
        [uid(), sId, name, level, orderNum, clsfId]
      );
      classRows.push(row.id);
    }
    const [clsP1, clsP2, clsP3, clsJHS1] = classRows;
    const allClasses = classRows;

    // ── 7. Subjects ───────────────────────────────────────────────────────────
    console.log('Creating subjects…');
    const [sbMath, sbEng, sbSci, sbSoc, sbFr, sbICT] = Array.from({ length: 6 }, uid);
    await client.query(
      `INSERT INTO subjects (id,school_id,name,code) VALUES
       ($1,$7,'Mathematics','MATH'), ($2,$7,'English Language','ENG'),
       ($3,$7,'Integrated Science','SCI'), ($4,$7,'Social Studies','SOC'),
       ($5,$7,'French','FRE'), ($6,$7,'Computing / ICT','ICT')`,
      [sbMath, sbEng, sbSci, sbSoc, sbFr, sbICT, sId]
    );
    const allSubjects = [sbMath, sbEng, sbSci, sbSoc, sbFr, sbICT];

    // ── 8. Competency benchmarks ──────────────────────────────────────────────
    const competencies = {};
    for (const [subId, comps] of [
      [sbMath, [['Number & Operations','strong'],['Algebra & Patterns','strong'],['Data & Measurement','average']]],
      [sbEng,  [['Reading Comprehension','strong'],['Writing & Composition','strong'],['Oral Communication','average']]],
      [sbSci,  [['Scientific Inquiry','strong'],['Life & Environment','average'],['Physical World','average']]],
      [sbSoc,  [['History & Geography','average'],['Civics & Governance','average'],['Environmental Studies','average']]],
      [sbFr,   [['Listening & Speaking','strong'],['Reading & Writing','average'],['Grammar & Vocabulary','average']]],
      [sbICT,  [['Digital Literacy','strong'],['Programming Basics','average'],['Information & Research','average']]],
    ]) {
      competencies[subId] = [];
      for (const [name, level] of comps) {
        const cId = uid();
        await client.query(
          `INSERT INTO competency_benchmarks (id,school_id,subject_id,name,expected_level)
           VALUES ($1,$2,$3,$4,$5)`,
          [cId, sId, subId, name, level]
        );
        competencies[subId].push(cId);
      }
    }

    // ── 9. Skills ─────────────────────────────────────────────────────────────
    const skillIds = [];
    for (const name of ['Critical Thinking','Collaboration','Communication','Creativity','Leadership','Digital Skills']) {
      const skId = uid();
      skillIds.push(skId);
      await client.query(`INSERT INTO skills (id,school_id,name) VALUES ($1,$2,$3)`, [skId, sId, name]);
    }

    // ── 10. Terms ─────────────────────────────────────────────────────────────
    console.log('Creating terms…');
    const [trm1, trm2, trm3] = [uid(), uid(), uid()];
    await client.query(
      `INSERT INTO terms (id,school_id,name,start_date,end_date,is_current) VALUES
       ($1,$4,'2024/2025 Term 1','2024-09-09','2024-12-13',false),
       ($2,$4,'2024/2025 Term 2','2025-01-13','2025-04-11',false),
       ($3,$4,'2024/2025 Term 3','2025-05-05','2025-07-25',true)`,
      [trm1, trm2, trm3, sId]
    );
    const currentTerm = trm3;

    // ── 11. Teaching assignments (Term 3, current) ────────────────────────────
    console.log('Creating teaching assignments…');
    // teacher → [[class, subject], ...]
    const teacherAssignments = {
      [t1Id]: [[clsJHS1, sbMath], [clsJHS1, sbSci], [clsP3, sbMath], [clsP3, sbSci]],
      [t2Id]: [[clsJHS1, sbEng], [clsJHS1, sbSoc], [clsP3, sbEng], [clsP3, sbSoc]],
      [t3Id]: [[clsJHS1, sbFr], [clsJHS1, sbICT], [clsP3, sbFr], [clsP3, sbICT]],
      [t4Id]: [[clsP1, sbMath], [clsP1, sbEng], [clsP1, sbSci],
               [clsP2, sbMath], [clsP2, sbEng], [clsP2, sbSci],
               [clsP1, sbSoc],  [clsP2, sbSoc]],
    };
    for (const [tchId, pairs] of Object.entries(teacherAssignments)) {
      for (const [cId, subId] of pairs) {
        await client.query(
          `INSERT INTO teaching_assignments (id,school_id,teacher_id,class_id,subject_id,term_id)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [uid(), sId, tchId, cId, subId, currentTerm]
        );
      }
    }

    // ── 12. Families + Students ───────────────────────────────────────────────
    console.log('Creating students…');
    // profile: 'strong' | 'average' | 'struggling'
    const studentData = [
      //  name                  gender   dob           parent              phone            class    profile
      ['Kweku Appiah',        'male',  '2014-05-10','Mr. Peter Appiah',   '+233201111001', clsJHS1, 'strong'    ],
      ['Adwoa Sarpong',       'female','2014-08-22','Mrs. Mary Sarpong',  '+233201111002', clsJHS1, 'strong'    ],
      ['Kwabena Asante',      'male',  '2015-01-07','Mr. Joseph Asante',  '+233201111003', clsJHS1, 'strong'    ],
      ['Abena Mensah',        'female','2014-11-30','Mrs. Grace Mensah',  '+233201111004', clsJHS1, 'average'   ],
      ['Kofi Boateng',        'male',  '2015-03-14','Mr. Samuel Boateng', '+233201111005', clsJHS1, 'average'   ],
      ['Akua Darko',          'female','2015-06-02','Mrs. Ruth Darko',    '+233201111006', clsJHS1, 'average'   ],
      ['Yaw Adjei',           'male',  '2014-09-18','Mr. Frank Adjei',    '+233201111007', clsJHS1, 'struggling'],
      ['Ama Owusu',           'female','2015-02-25','Mrs. Alice Owusu',   '+233201111008', clsJHS1, 'average'   ],
      ['Kojo Frimpong',       'male',  '2015-07-11','Mr. Eric Frimpong',  '+233201111009', clsP3,   'strong'    ],
      ['Akosua Amponsah',     'female','2015-04-28','Mrs. Dora Amponsah', '+233201111010', clsP3,   'average'   ],
      ['Fiifi Amoako',        'male',  '2016-01-16','Mr. Victor Amoako',  '+233201111011', clsP3,   'struggling'],
      ['Maame Bonsu',         'female','2015-10-09','Mrs. Janet Bonsu',   '+233201111012', clsP3,   'average'   ],
      ['Kwame Donkor',        'male',  '2017-03-20','Mr. Alex Donkor',    '+233201111013', clsP2,   'strong'    ],
      ['Efua Asare',          'female','2017-08-14','Mrs. Linda Asare',   '+233201111014', clsP2,   'average'   ],
      ['Nana Baah',           'male',  '2017-11-03','Mr. Thomas Baah',    '+233201111015', clsP2,   'average'   ],
      ['Esi Asiedu',          'female','2017-05-27','Mrs. Clara Asiedu',  '+233201111016', clsP2,   'struggling'],
      ['Abena Antwi',         'female','2018-02-12','Mrs. Rose Antwi',    '+233201111017', clsP1,   'strong'    ],
      ['Yaw Acheampong',      'male',  '2018-06-08','Mr. Paul Acheampong','+233201111018', clsP1,   'average'   ],
      ['Akwesi Baah',         'male',  '2018-09-17','Mr. Kojo Baah',      '+233201111019', clsP1,   'average'   ],
      ['Ama Mensah',          'female','2018-12-04','Mr. Kofi Mensah',    '+233201111020', clsP1,   'struggling'],
    ];

    const studentIds = [];
    const studentMeta = {};

    for (let i = 0; i < studentData.length; i++) {
      const [name, gender, dob, parentName, phone, classId, profile] = studentData[i];
      const famId = uid();
      await client.query(
        `INSERT INTO families (id,school_id,guardian_name,phone) VALUES ($1,$2,$3,$4)`,
        [famId, sId, parentName, phone]
      );
      const stId = uid();
      const code = `PRST-${String(i + 1).padStart(3, '0')}-25`;
      await client.query(
        `INSERT INTO students (id,school_id,family_id,class_id,student_code,name,dob,gender,
                               parent_name,parent_phone,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')`,
        [stId, sId, famId, classId, code, name, dob, gender, parentName, phone]
      );
      // Learner profile
      const isSEN    = profile === 'struggling' && Math.random() > 0.4;
      const isGifted = profile === 'strong'     && Math.random() > 0.3;
      await client.query(
        `INSERT INTO learner_profiles (id,student_id,sen_flag,gifted_flag,learning_style)
         VALUES ($1,$2,$3,$4,$5)`,
        [uid(), stId, isSEN, isGifted, pick(['visual','auditory','kinesthetic','reading/writing'])]
      );
      // Skills
      const numSkills = profile === 'strong' ? 3 : profile === 'average' ? 2 : 1;
      const shuffled = [...skillIds].sort(() => Math.random() - 0.5).slice(0, numSkills);
      for (const skId of shuffled) {
        const lvl = profile === 'strong' ? pick(['excellent','proficient']) : profile === 'average' ? 'proficient' : 'developing';
        await client.query(
          `INSERT INTO student_skills (id,school_id,student_id,skill_id,level,evidence_source)
           VALUES ($1,$2,$3,$4,$5,'Classroom observation')`,
          [uid(), sId, stId, skId, lvl]
        );
      }
      studentIds.push(stId);
      studentMeta[stId] = { profile, classId, name };
    }
    // Group by class for easy access
    const byClass = {};
    for (const stId of studentIds) {
      const { classId } = studentMeta[stId];
      (byClass[classId] = byClass[classId] || []).push(stId);
    }
    console.log(`Students ✓  (${studentIds.length} total)`);

    // ── 13. Assessments (current term, with new types) ────────────────────────
    // Structure per subject per class:
    //   classwork ×2 (out of 10)  → 20% component with homework
    //   homework  ×1 (out of 10)  → 20% component with classwork
    //   class_test×2 (out of 50)  → 20% component
    //   exam      ×1 (out of 100) → 60% component
    console.log('Creating assessments (new types: classwork, homework, class_test, exam)…');

    // assessMap[classId][subjectId] = [{id, type, max}, ...]
    const assessMap = {};
    for (const cls of allClasses) {
      assessMap[cls] = {};
      for (const sub of allSubjects) assessMap[cls][sub] = [];
    }

    // Subject-teacher map for recording results
    const subTeacher = {
      [sbMath]: t1Id, [sbSci]: t1Id,
      [sbEng]:  t2Id, [sbSoc]: t2Id,
      [sbFr]:   t3Id, [sbICT]: t3Id,
    };
    // Primary classes taught entirely by t4Id
    const primarySubTeacher = {
      [sbMath]: t4Id, [sbEng]: t4Id, [sbSci]: t4Id, [sbSoc]: t4Id, [sbFr]: t4Id, [sbICT]: t4Id,
    };

    for (const cls of allClasses) {
      const isPrimary = [clsP1, clsP2].includes(cls);
      for (const sub of allSubjects) {
        const asms = await mkAssessments(client, {
          sId, subjectId: sub, classId: cls, termId: currentTerm,
          specs: [
            ['Classwork 1',     'classwork',  10],
            ['Classwork 2',     'classwork',  10],
            ['Homework 1',      'homework',   10],
            ['Class Test 1',    'class_test', 50],
            ['Class Test 2',    'class_test', 50],
            ['End of Term Exam','exam',      100],
          ],
        });
        assessMap[cls][sub] = asms;
        // Map first 2 competencies to the first assessment
        for (const cId of (competencies[sub] || []).slice(0, 2)) {
          await client.query(
            `INSERT INTO assessment_competency_map (id,assessment_id,competency_id)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [uid(), asms[0].id, cId]
          );
        }
      }
    }
    console.log('Assessments ✓');

    // ── 14. Results — teachers record for their assigned subjects ─────────────
    // Raw marks by student profile per assessment slot:
    // [CW1/10, CW2/10, HW1/10, CT1/50, CT2/50, Exam/100]
    function scoreRow(profile) {
      if (profile === 'strong')     return [pick([8,9]),pick([8,9]),pick([8,9]),pick([41,45]),pick([42,46]),pick([78,88])];
      if (profile === 'average')    return [pick([6,7]),pick([6,7]),pick([6,7]),pick([30,38]),pick([30,38]),pick([60,74])];
      /* struggling */               return [pick([3,5]),pick([3,5]),pick([4,6]),pick([18,26]),pick([18,26]),pick([36,50])];
    }

    console.log('Inserting results (by teacher assignment)…');
    for (const cls of allClasses) {
      const isPrimary = [clsP1, clsP2].includes(cls);
      const tchMap    = isPrimary ? primarySubTeacher : subTeacher;
      const stIds     = byClass[cls] || [];
      if (!stIds.length) continue;

      for (const sub of allSubjects) {
        const asms    = assessMap[cls][sub];
        const tchId   = tchMap[sub];
        const scores  = stIds.map(stId => scoreRow(studentMeta[stId].profile));
        await mkResults(client, { sId, studentIds: stIds, assessments: asms, scores, teacherId: tchId });
      }
    }
    console.log('Results ✓');

    // ── 15. Compute grades from results ───────────────────────────────────────
    console.log('Computing grades from results (20% CW+HW | 20% Tests | 60% Exam)…');
    const teacherNames = {
      [t1Id]: 'Mr. Kwame Asante', [t2Id]: 'Mrs. Ama Boateng',
      [t3Id]: 'Mr. Kofi Mensah',  [t4Id]: 'Ms. Akosua Darko',
    };

    for (const cls of allClasses) {
      const isPrimary = [clsP1, clsP2].includes(cls);
      const tchMap    = isPrimary ? primarySubTeacher : subTeacher;
      const stIds     = byClass[cls] || [];
      if (!stIds.length) continue;

      for (const sub of allSubjects) {
        const tchId = tchMap[sub];
        await computeAndStoreGrades(client, {
          sId, studentIds: stIds, assessments: assessMap[cls][sub],
          teacherId: tchId, teacherName: teacherNames[tchId],
          subjectId: sub, termId: currentTerm,
        });
      }
    }
    console.log('Grades ✓');

    // ── 16. Diagnostic results ────────────────────────────────────────────────
    for (const stId of studentIds) {
      const { profile, classId } = studentMeta[stId];
      for (const sub of allSubjects) {
        const [cId] = competencies[sub] || [];
        if (!cId) continue;
        const refAsm = assessMap[classId][sub][0];
        const level  = profile === 'strong' ? pick(['high','medium']) : profile === 'average' ? pick(['medium','low']) : 'low';
        await client.query(
          `INSERT INTO diagnostic_results (id,school_id,student_id,assessment_id,competency_id,level)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [uid(), sId, stId, refAsm.id, cId, level]
        );
      }
    }

    // ── 17. Remediation flags for struggling students ─────────────────────────
    for (const stId of studentIds) {
      if (studentMeta[stId].profile !== 'struggling') continue;
      const allComps = Object.values(competencies).flat();
      const picked = [...allComps].sort(() => Math.random() - 0.5).slice(0, 3);
      for (const cId of picked) {
        await client.query(
          `INSERT INTO remediation_flags (id,school_id,student_id,competency_id,reason,status)
           VALUES ($1,$2,$3,$4,'Consistent difficulty flagged from assessment data','pending')`,
          [uid(), sId, stId, cId]
        );
      }
    }

    // ── 18. Feedback ─────────────────────────────────────────────────────────
    const fbTexts = [
      'Shows excellent improvement in problem solving this term.',
      'Needs to practice more consistently at home.',
      'Very active in class discussions — keep it up!',
      'Struggles with reading comprehension. Extra reading recommended.',
      'Outstanding performance in group work and projects.',
      'Good effort but needs to focus more during lessons.',
      'Demonstrates strong analytical skills across subjects.',
      'Requires additional support with written assignments.',
    ];
    for (const stId of studentIds.slice(0, 15)) {
      const { classId } = studentMeta[stId];
      const aId = assessMap[classId][sbEng][5].id; // exam assessment
      await client.query(
        `INSERT INTO feedback (id,school_id,student_id,assessment_id,comment,recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uid(), sId, stId, aId, pick(fbTexts), t2Id]
      );
    }

    // ── 19. Self-assessments ──────────────────────────────────────────────────
    const reflections = [
      'I understand most topics but need more practice with exam questions.',
      'I find some parts difficult but I am working harder.',
      'I am confident in this subject and enjoy the challenges.',
      'I need help understanding the concepts from this term.',
    ];
    for (const stId of studentIds.slice(0, 12)) {
      await client.query(
        `INSERT INTO self_assessments (id,school_id,student_id,subject_id,reflection,confidence_level)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uid(), sId, stId, sbMath, pick(reflections), pick(['high','medium','medium','low'])]
      );
    }

    // ── 20. Terminal remarks for JHS 1 (written by Mr. Kwame — class teacher) ─
    const jhs1Ids = byClass[clsJHS1] || [];
    const remarkByProfile = {
      strong: {
        interest: 'Mathematics and Natural Sciences',
        conduct:  'Excellent',
        attitude: 'Highly Motivated',
        class_teacher_remark: 'An outstanding student who leads by example. Participates actively and supports peers.',
        academic_remark: 'Excellent results across all subjects. Continue to push higher.',
      },
      average: {
        interest: 'English Language and Arts',
        conduct:  'Good',
        attitude: 'Positive',
        class_teacher_remark: 'A diligent student who is steadily improving. Encouraged to be more consistent.',
        academic_remark: 'Commendable performance. Focus on strengthening weaker subjects.',
      },
      struggling: {
        interest: 'Physical Education and Sports',
        conduct:  'Fair',
        attitude: 'Needs Encouragement',
        class_teacher_remark: 'Needs to put in considerably more effort. Parents are urged to provide support at home.',
        academic_remark: 'Significant improvement required. Extra tuition strongly recommended.',
      },
    };
    for (const stId of jhs1Ids) {
      const { profile } = studentMeta[stId];
      const r = remarkByProfile[profile];
      await client.query(
        `INSERT INTO student_terminal_remarks
           (school_id, student_id, term_id, interest, conduct, attitude,
            class_teacher_remark, academic_remark, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (school_id, student_id, term_id) DO NOTHING`,
        [sId, stId, currentTerm,
         r.interest, r.conduct, r.attitude,
         r.class_teacher_remark, r.academic_remark, t1Id]
      );
    }

    // ── 21. Attendance — Term 3 (current, first 3 weeks) ─────────────────────
    console.log('Inserting attendance…');
    const t3Days = schoolDays('2025-05-05', '2025-05-23').slice(0, 15);
    const classTeacherMap = {
      [clsP1]: t4Id, [clsP2]: t4Id, [clsP3]: t3Id, [clsJHS1]: t1Id,
    };
    for (const stId of studentIds) {
      const { profile, classId } = studentMeta[stId];
      const tchId = classTeacherMap[classId] || t1Id;
      for (const date of t3Days) {
        let status;
        const r = Math.random();
        if      (profile === 'strong')     status = r < 0.97 ? 'present' : 'absent';
        else if (profile === 'average')    status = r < 0.88 ? 'present' : r < 0.94 ? 'late' : 'absent';
        else                               status = r < 0.70 ? 'present' : r < 0.85 ? 'absent' : 'late';
        await client.query(
          `INSERT INTO attendance (id,school_id,student_id,class_id,date,status,recorded_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [uid(), sId, stId, classId, date, status, tchId]
        );
      }
    }
    console.log('Attendance ✓');

    // ── 22. Fee items, structures & payments (Term 3) ─────────────────────────
    console.log('Creating fees & payments…');
    const feeItemMap = {};
    for (const [name, amount] of [
      ['Tuition Fee', 750], ['PTA Levy', 50], ['Sports Fee', 30],
      ['Examination Fee', 45], ['Library Fee', 20],
    ]) {
      const fiId = uid();
      feeItemMap[name] = { id: fiId, amount };
      await client.query(`INSERT INTO fee_items (id,school_id,name) VALUES ($1,$2,$3)`, [fiId, sId, name]);
    }
    const totalFee = Object.values(feeItemMap).reduce((s, x) => s + x.amount, 0);

    const fsMap = {};
    for (const cls of allClasses) {
      const fsId = uid();
      fsMap[cls] = fsId;
      await client.query(
        `INSERT INTO fee_structures (id,school_id,class_id,term_id,name,total_amount,academic_year)
         VALUES ($1,$2,$3,$4,'Term 3 Fees',$5,'2024/25')`,
        [fsId, sId, cls, currentTerm, totalFee]
      );
      for (const { id: fiId, amount } of Object.values(feeItemMap)) {
        await client.query(
          `INSERT INTO fee_structure_items (id,fee_structure_id,fee_item_id,amount)
           VALUES ($1,$2,$3,$4)`,
          [uid(), fsId, fiId, amount]
        );
      }
    }

    for (let i = 0; i < studentIds.length; i++) {
      const stId     = studentIds[i];
      const { classId } = studentMeta[stId];
      const ppId     = uid();
      const planType = i % 3 === 0 ? 'full' : '50_50';
      await client.query(
        `INSERT INTO payment_plans (id,school_id,student_id,fee_structure_id,term_id,
                                    plan_type,total_amount,start_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'2025-05-05')`,
        [ppId, sId, stId, fsMap[classId], currentTerm, planType, totalFee]
      );
      if (planType === 'full') {
        const paid = i < 12;
        await client.query(
          `INSERT INTO payment_schedules (id,plan_id,school_id,student_id,
                                          installment_num,due_date,amount_due,status)
           VALUES ($1,$2,$3,$4,1,'2025-05-09',$5,$6)`,
          [uid(), ppId, sId, stId, totalFee, paid ? 'paid' : 'overdue']
        );
        if (paid) {
          await client.query(
            `INSERT INTO payments (id,school_id,student_id,plan_id,amount,payment_date,
                                   method,reference,recorded_by)
             VALUES ($1,$2,$3,$4,$5,'2025-05-07','mobile_money',$6,$7)`,
            [uid(), sId, stId, ppId, totalFee, `MM-${100 + i}`, acId]
          );
        }
      } else {
        const half = totalFee / 2;
        for (let inst = 0; inst < 2; inst++) {
          const due  = inst === 0 ? '2025-05-09' : '2025-06-13';
          const paid = inst === 0 || i < 8;
          await client.query(
            `INSERT INTO payment_schedules (id,plan_id,school_id,student_id,
                                            installment_num,due_date,amount_due,status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [uid(), ppId, sId, stId, inst + 1, due, half, paid ? 'paid' : 'upcoming']
          );
          if (paid) {
            await client.query(
              `INSERT INTO payments (id,school_id,student_id,plan_id,amount,payment_date,
                                     method,reference,recorded_by)
               VALUES ($1,$2,$3,$4,$5,$6,'bank_transfer',$7,$8)`,
              [uid(), sId, stId, ppId, half, due, `BT-${200 + i}-${inst}`, acId]
            );
          }
        }
      }
    }
    console.log('Fees & payments ✓');

    // ── 23. Store items ───────────────────────────────────────────────────────
    for (const [name, qty, unit, thresh] of [
      ['Chalk Boxes',        80, 'box',    10],
      ['Exercise Books',    200, 'piece',  50],
      ['Ballpoint Pens',    150, 'piece',  30],
      ['Whiteboard Markers', 40, 'piece',  10],
      ['Printer Paper',      25, 'ream',    5],
      ['Hand Sanitiser',     12, 'bottle',  3],
    ]) {
      const siId = uid();
      await client.query(
        `INSERT INTO store_items (id,school_id,name,quantity,unit,low_stock_threshold)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [siId, sId, name, qty, unit, thresh]
      );
      await client.query(
        `INSERT INTO store_transactions (id,school_id,item_id,recorded_by,quantity,type,notes)
         VALUES ($1,$2,$3,$4,$5,'restock','Opening stock Term 3')`,
        [uid(), sId, siId, owId, qty]
      );
    }

    // ── 24. Announcements ─────────────────────────────────────────────────────
    for (const [title, body, audience] of [
      ['Welcome to Term 3 2024/25',
       'We warmly welcome all students and staff back for the final and most important term. Academic excellence is our goal.',
       'all'],
      ['Grade Computation Now Live',
       'Grades are now automatically computed from assessment results. Teachers: please ensure all results are entered before the close of term.',
       'staff'],
      ['End of Term Exams: 14–18 July 2025',
       'The end of term exams will be held from Monday 14th to Friday 18th July 2025. All students must be present.',
       'all'],
    ]) {
      await client.query(
        `INSERT INTO announcements (id,school_id,posted_by,title,body,audience,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [uid(), sId, owId, title, body, audience]
      );
    }

    // ── 25. Timetable for JHS 1 ───────────────────────────────────────────────
    const periods = [
      [1,'07:30','08:10'],[2,'08:10','08:50'],[3,'08:50','09:30'],
      [4,'09:50','10:30'],[5,'10:30','11:10'],[6,'11:10','11:50'],
    ];
    // Fixed daily schedule for JHS 1
    const schedule = [
      [sbMath, sbEng,  sbSci,  sbSoc, sbFr, sbICT], // Mon
      [sbEng,  sbMath, sbSoc,  sbSci, sbICT,sbFr ], // Tue
      [sbSci,  sbFr,   sbMath, sbEng, sbSoc,sbICT], // Wed
      [sbSoc,  sbICT,  sbEng,  sbFr,  sbMath,sbSci],// Thu
      [sbFr,   sbSci,  sbICT,  sbMath,sbEng, sbSoc], // Fri
    ];
    const jhsSubTeacher = { [sbMath]:t1Id,[sbSci]:t1Id,[sbEng]:t2Id,[sbSoc]:t2Id,[sbFr]:t3Id,[sbICT]:t3Id };
    for (let day = 0; day < 5; day++) {
      for (let p = 0; p < periods.length; p++) {
        const sub = schedule[day][p];
        const [pnum, st, et] = periods[p];
        await client.query(
          `INSERT INTO timetable_slots (id,school_id,class_id,subject_id,teacher_id,term_id,
                                        day_of_week,period_num,start_time,end_time)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT DO NOTHING`,
          [uid(), sId, clsJHS1, sub, jhsSubTeacher[sub], currentTerm, day, pnum, st, et]
        );
      }
    }

    await client.query('COMMIT');

    // ── Summary ───────────────────────────────────────────────────────────────
    const asmCount    = allClasses.length * allSubjects.length * 6;
    const resultCount = studentIds.length * allSubjects.length * 6;
    const gradeCount  = studentIds.length * allSubjects.length;
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SEED COMPLETE — Prestige Academy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Password for all accounts: School@1234
  ─────────────────────────────────────────────────────
  OWNER / DIRECTOR   director@prestige.edu
  HEAD (ACADEMICS)   academics@prestige.edu
  TEACHER 1          kwame.asante@prestige.edu
    → JHS 1 class teacher
    → Teaches: Maths + Science  (JHS 1, Primary 3)
  TEACHER 2          ama.boateng@prestige.edu
    → Teaches: English + Social Studies  (JHS 1, Primary 3)
  TEACHER 3          kofi.mensah@prestige.edu
    → Primary 3 class teacher
    → Teaches: French + ICT  (JHS 1, Primary 3)
  TEACHER 4          akosua.darko@prestige.edu
    → Teaches: all subjects  (Primary 1 & 2)
  ACCOUNTANT         accounts@prestige.edu
  ─────────────────────────────────────────────────────
  4 classes · 6 subjects · 3 terms (Term 3 current)
  20 students  (8 JHS 1 · 4 Primary 3 · 4 Primary 2 · 4 Primary 1)
  ${asmCount} assessments  (classwork×2 + homework×1 + class test×2 + exam×1 per subject)
  ~${resultCount} results  (teacher-scoped, theory + practical split)
  ${gradeCount} computed grades  (CW+HW 20% | Tests 20% | Exam 60%)
  ─────────────────────────────────────────────────────
  Grade flow:  Results → POST /grades/compute → Grades → Report card
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
