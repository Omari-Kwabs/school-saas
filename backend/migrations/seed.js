// Run: node backend/migrations/seed.js
// Seeds "Bright Future Academy" with 100 students, 5 teachers, 2 accountants.
// Skips silently if the school already exists.
//
// Login credentials (password: Password1):
//   owner       : kofi@bfa.edu.gh
//   teachers    : ama@bfa.edu.gh  kwasi@bfa.edu.gh  abena@bfa.edu.gh  grace@bfa.edu.gh  yaw@bfa.edu.gh
//   accountants : kweku@bfa.edu.gh  sandra@bfa.edu.gh

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool   = require('../src/config/db');
const { generateSchedule } = require('../src/utils/scheduleGenerator');

// ── Helpers ──────────────────────────────────────────────────────────────────
function mkDob(year, i) {
  const m = String(1 + (i % 11)).padStart(2, '0');
  const d = String(3 + (i % 25)).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function scoreFor(tier, i, offset = 0) {
  const bases = { strong: [80, 76], average: [55, 52], weak: [30, 28] };
  const spans = { strong: [12, 12], average: [17, 16], weak: [18, 16] };
  const [bt, bp] = bases[tier];
  const [st, sp] = spans[tier];
  const theory    = bt + ((i * 7 + offset) % st);
  const practical = bp + ((i * 5 + offset) % sp);
  return { theory, practical };
}

// ── Family definitions ────────────────────────────────────────────────────────
const FAMILY_DEFS = [
  { key: 'f01', guardian: 'Yaw Mensah',    phone: '+233-24-001-0001' },
  { key: 'f02', guardian: 'Kwasi Asante',  phone: '+233-24-002-0001' },
  { key: 'f03', guardian: 'Kwesi Owusu',   phone: '+233-24-003-0001' },
  { key: 'f04', guardian: 'Kweku Boateng', phone: '+233-24-004-0001' },
  { key: 'f05', guardian: 'Ama Frimpong',  phone: '+233-24-005-0001' },
];

// ── Student definitions ───────────────────────────────────────────────────────
// [code, name, classKey, gender, parent_name, parent_phone, dobYear, famKey|null]
const STUDENT_DEFS = [
  // ── PRIMARY 1 (born 2017-2018) ───────────────────────────────────────────
  ['STU001','Abena Kwarteng',   'p1','female','Ama Kwarteng',      '+233-24-100-0001',2017,null ],
  ['STU002','Kwame Mensah',     'p1','male',  'Yaw Mensah',        '+233-24-001-0001',2018,'f01'],
  ['STU003','Ama Asante',       'p1','female','Kwasi Asante',      '+233-24-002-0001',2017,'f02'],
  ['STU004','Kofi Owusu',       'p1','male',  'Kwesi Owusu',       '+233-24-003-0001',2018,'f03'],
  ['STU005','Yaa Boateng',      'p1','female','Kweku Boateng',     '+233-24-004-0001',2017,'f04'],
  ['STU006','Emmanuel Frimpong','p1','male',  'Ama Frimpong',      '+233-24-005-0001',2018,'f05'],
  ['STU007','Adwoa Agyei',      'p1','female','Kofi Agyei',        '+233-24-101-0001',2017,null ],
  ['STU008','Akwasi Darko',     'p1','male',  'Nana Darko',        '+233-24-102-0001',2018,null ],
  ['STU009','Akua Adjei',       'p1','female','Kwame Adjei',       '+233-24-103-0001',2017,null ],
  ['STU010','Fiifi Antwi',      'p1','male',  'Akua Antwi',        '+233-24-104-0001',2018,null ],
  ['STU011','Efua Osei',        'p1','female','Kweku Osei',        '+233-24-105-0001',2017,null ],
  ['STU012','Kojo Appiah',      'p1','male',  'Kofi Appiah',       '+233-24-106-0001',2018,null ],
  ['STU013','Mansa Asare',      'p1','female','Kwesi Asare',       '+233-24-107-0001',2017,null ],
  ['STU014','Kweku Amoah',      'p1','male',  'Yaa Amoah',         '+233-24-108-0001',2018,null ],
  ['STU015','Esinam Danso',     'p1','female','Kwame Danso',       '+233-24-109-0001',2017,null ],
  ['STU016','Samuel Opoku',     'p1','male',  'Abena Opoku',       '+233-24-110-0001',2018,null ],
  ['STU017','Araba Sarfo',      'p1','female','Kwesi Sarfo',       '+233-24-111-0001',2017,null ],
  // ── PRIMARY 2 (born 2016-2017) ───────────────────────────────────────────
  ['STU018','Afia Amankwah',    'p2','female','Kwame Amankwah',    '+233-24-112-0001',2016,null ],
  ['STU019','Kwadwo Mensah',    'p2','male',  'Yaw Mensah',        '+233-24-001-0001',2016,'f01'],
  ['STU020','Adoma Asante',     'p2','female','Kwasi Asante',      '+233-24-002-0001',2016,'f02'],
  ['STU021','Enoch Nkrumah',    'p2','male',  'Kwame Nkrumah',     '+233-24-113-0001',2017,null ],
  ['STU022','Abena Owusu',      'p2','female','Kwesi Owusu',       '+233-24-003-0001',2016,'f03'],
  ['STU023','Kwesi Tetteh',     'p2','male',  'Akua Tetteh',       '+233-24-114-0001',2017,null ],
  ['STU024','Ewurama Kyei',     'p2','female','Kweku Kyei',        '+233-24-115-0001',2016,null ],
  ['STU025','Daniel Bonsu',     'p2','male',  'Yaa Bonsu',         '+233-24-116-0001',2017,null ],
  ['STU026','Akosua Quansah',   'p2','female','Abena Quansah',     '+233-24-117-0001',2016,null ],
  ['STU027','James Acheampong', 'p2','male',  'Yaw Acheampong',    '+233-24-118-0001',2017,null ],
  ['STU028','Maame Asamoah',    'p2','female','Esi Asamoah',       '+233-24-119-0001',2016,null ],
  ['STU029','Richard Ofori',    'p2','male',  'Kwame Ofori',       '+233-24-120-0001',2017,null ],
  ['STU030','Abenaa Wiredu',    'p2','female','Kofi Wiredu',       '+233-24-121-0001',2016,null ],
  ['STU031','Yaw Nkansah',      'p2','male',  'Akua Nkansah',      '+233-24-122-0001',2017,null ],
  ['STU032','Korkor Bediako',   'p2','female','Ama Bediako',       '+233-24-123-0001',2016,null ],
  ['STU033','Michael Awuni',    'p2','male',  'Kwesi Awuni',       '+233-24-124-0001',2017,null ],
  ['STU034','Adjoa Aidoo',      'p2','female','Yaw Aidoo',         '+233-24-125-0001',2016,null ],
  // ── PRIMARY 3 (born 2015-2016) ───────────────────────────────────────────
  ['STU035','Akua Nkrumah',     'p3','female','Kwame Nkrumah',     '+233-24-126-0001',2015,null ],
  ['STU036','Joseph Osei',      'p3','male',  'Kweku Osei',        '+233-24-127-0001',2016,null ],
  ['STU037','Yaa Frimpong',     'p3','female','Ama Frimpong',      '+233-24-005-0001',2015,'f05'],
  ['STU038','Kobby Darko',      'p3','male',  'Nana Darko',        '+233-24-102-0001',2016,null ],
  ['STU039','Abena Boateng',    'p3','female','Kweku Boateng',     '+233-24-004-0001',2015,'f04'],
  ['STU040','Kwabena Adjei',    'p3','male',  'Kwame Adjei',       '+233-24-103-0001',2016,null ],
  ['STU041','Ama Tetteh',       'p3','female','Akua Tetteh',       '+233-24-114-0001',2015,null ],
  ['STU042','Frank Antwi',      'p3','male',  'Akua Antwi',        '+233-24-104-0001',2016,null ],
  ['STU043','Efua Appiah',      'p3','female','Kofi Appiah',       '+233-24-106-0001',2015,null ],
  ['STU044','Samuel Agyei',     'p3','male',  'Kofi Agyei',        '+233-24-101-0001',2016,null ],
  ['STU045','Adwoa Asare',      'p3','female','Kwesi Asare',       '+233-24-107-0001',2015,null ],
  ['STU046','Emmanuel Amoah',   'p3','male',  'Yaa Amoah',         '+233-24-108-0001',2016,null ],
  ['STU047','Akosua Opoku',     'p3','female','Abena Opoku',       '+233-24-110-0001',2015,null ],
  ['STU048','Kofi Amankwah',    'p3','male',  'Kwame Amankwah',    '+233-24-112-0001',2016,null ],
  ['STU049','Maame Sarfo',      'p3','female','Kwesi Sarfo',       '+233-24-111-0001',2015,null ],
  ['STU050','Kweku Kyei',       'p3','male',  'Kweku Kyei',        '+233-24-115-0001',2016,null ],
  ['STU051','Esinam Bonsu',     'p3','female','Yaa Bonsu',         '+233-24-116-0001',2015,null ],
  // ── JHS 1 (born 2013-2014) ───────────────────────────────────────────────
  ['STU052','Grace Boateng',    'j1','female','Kweku Boateng',     '+233-24-004-0001',2013,'f04'],
  ['STU053','Kwame Owusu',      'j1','male',  'Kwesi Owusu',       '+233-24-003-0001',2014,'f03'],
  ['STU054','Sandra Asante',    'j1','female','Kwasi Asante',      '+233-24-002-0001',2013,'f02'],
  ['STU055','Richard Mensah',   'j1','male',  'Abena Mensah',      '+233-24-128-0001',2014,null ],
  ['STU056','Patience Asare',   'j1','female','Yaw Asare',         '+233-24-129-0001',2013,null ],
  ['STU057','Joseph Darko',     'j1','male',  'Nana Darko',        '+233-24-102-0001',2014,null ],
  ['STU058','Rebecca Frimpong', 'j1','female','Ama Frimpong',      '+233-24-005-0001',2013,'f05'],
  ['STU059','Daniel Tetteh',    'j1','male',  'Akua Tetteh',       '+233-24-114-0001',2014,null ],
  ['STU060','Francisca Adjei',  'j1','female','Kwame Adjei',       '+233-24-103-0001',2013,null ],
  ['STU061','Kwesi Osei',       'j1','male',  'Kweku Osei',        '+233-24-127-0001',2014,null ],
  ['STU062','Abena Nkrumah',    'j1','female','Kwame Nkrumah',     '+233-24-126-0001',2013,null ],
  ['STU063','Yaw Bonsu',        'j1','male',  'Yaa Bonsu',         '+233-24-116-0001',2014,null ],
  ['STU064','Akua Antwi',       'j1','female','Akua Antwi',        '+233-24-104-0001',2013,null ],
  ['STU065','Enoch Kyei',       'j1','male',  'Kweku Kyei',        '+233-24-115-0001',2014,null ],
  ['STU066','Mansa Quansah',    'j1','female','Abena Quansah',     '+233-24-117-0001',2013,null ],
  ['STU067','Akwasi Agyei',     'j1','male',  'Kofi Agyei',        '+233-24-101-0001',2014,null ],
  ['STU068','Afia Amankwah',    'j1','female','Kwame Amankwah',    '+233-24-112-0001',2013,null ],
  // ── JHS 2 (born 2012-2013) ───────────────────────────────────────────────
  ['STU069','Kofi Nkrumah',     'j2','male',  'Kwame Nkrumah',     '+233-24-130-0001',2012,null ],
  ['STU070','Adwoa Mensah',     'j2','female','Abena Mensah',      '+233-24-131-0001',2013,null ],
  ['STU071','Kweku Owusu',      'j2','male',  'Kwesi Owusu Sr.',   '+233-24-132-0001',2012,null ],
  ['STU072','Efua Frimpong',    'j2','female','Kwame Frimpong',    '+233-24-133-0001',2013,null ],
  ['STU073','Emmanuel Darko',   'j2','male',  'Nana Darko',        '+233-24-134-0001',2012,null ],
  ['STU074','Araba Tetteh',     'j2','female','Akua Tetteh',       '+233-24-135-0001',2013,null ],
  ['STU075','Fiifi Adjei',      'j2','male',  'Kwame Adjei',       '+233-24-136-0001',2012,null ],
  ['STU076','Ewurama Osei',     'j2','female','Kweku Osei',        '+233-24-137-0001',2013,null ],
  ['STU077','Samuel Boateng',   'j2','male',  'Kweku Boateng',     '+233-24-138-0001',2012,null ],
  ['STU078','Akosua Antwi',     'j2','female','Akua Antwi',        '+233-24-139-0001',2013,null ],
  ['STU079','Kwabena Asare',    'j2','male',  'Kwesi Asare',       '+233-24-140-0001',2012,null ],
  ['STU080','Korkor Opoku',     'j2','female','Abena Opoku',       '+233-24-141-0001',2013,null ],
  ['STU081','Kojo Sarfo',       'j2','male',  'Kwesi Sarfo',       '+233-24-142-0001',2012,null ],
  ['STU082','Adjoa Acheampong', 'j2','female','Yaw Acheampong',    '+233-24-143-0001',2013,null ],
  ['STU083','Kwesi Amankwah',   'j2','male',  'Kwame Amankwah',    '+233-24-144-0001',2012,null ],
  ['STU084','Maame Bonsu',      'j2','female','Yaa Bonsu',         '+233-24-145-0001',2013,null ],
  // ── JHS 3 (born 2011-2012) ───────────────────────────────────────────────
  ['STU085','Ama Darko',        'j3','female','Nana Darko',        '+233-24-146-0001',2011,null ],
  ['STU086','Kwame Frimpong',   'j3','male',  'Kwame Frimpong',    '+233-24-147-0001',2012,null ],
  ['STU087','Yaa Asante',       'j3','female','Kwasi Asante',      '+233-24-148-0001',2011,null ],
  ['STU088','Richard Owusu',    'j3','male',  'Kwesi Owusu',       '+233-24-149-0001',2012,null ],
  ['STU089','Grace Mensah',     'j3','female','Yaw Mensah',        '+233-24-150-0001',2011,null ],
  ['STU090','Joseph Tetteh',    'j3','male',  'Akua Tetteh',       '+233-24-151-0001',2012,null ],
  ['STU091','Sandra Adjei',     'j3','female','Kwame Adjei',       '+233-24-152-0001',2011,null ],
  ['STU092','Michael Boateng',  'j3','male',  'Kweku Boateng',     '+233-24-153-0001',2012,null ],
  ['STU093','Patience Osei',    'j3','female','Kweku Osei',        '+233-24-154-0001',2011,null ],
  ['STU094','Kofi Antwi',       'j3','male',  'Akua Antwi',        '+233-24-155-0001',2012,null ],
  ['STU095','Rebecca Asare',    'j3','female','Kwesi Asare',       '+233-24-156-0001',2011,null ],
  ['STU096','Daniel Amankwah',  'j3','male',  'Kwame Amankwah',    '+233-24-157-0001',2012,null ],
  ['STU097','Francisca Kyei',   'j3','female','Kweku Kyei',        '+233-24-158-0001',2011,null ],
  ['STU098','Emmanuel Sarfo',   'j3','male',  'Kwesi Sarfo',       '+233-24-159-0001',2012,null ],
  ['STU099','Abena Quansah',    'j3','female','Abena Quansah',     '+233-24-160-0001',2011,null ],
  ['STU100','Kwasi Bonsu',      'j3','male',  'Yaa Bonsu',         '+233-24-161-0001',2012,null ],
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const exists = await client.query("SELECT id FROM schools WHERE code = 'BFA001'");
    if (exists.rows.length) {
      console.log('Seed school already exists — skipping. Delete the school row to re-seed.');
      await client.query('ROLLBACK');
      return;
    }

    const hash = await bcrypt.hash('Password1', 10);

    // ── School ────────────────────────────────────────────────────────────
    const { rows: [school] } = await client.query(`
      INSERT INTO schools (name, code, address, phone, email, plan)
      VALUES ('Bright Future Academy','BFA001','14 Independence Ave, Accra',
              '+233-20-123-4567','info@brightfuture.edu.gh','basic')
      RETURNING id
    `);
    const sid = school.id;

    // ── Users: 1 owner + 5 teachers + 2 accountants ───────────────────────
    const { rows: [owner] } = await client.query(`
      INSERT INTO users (school_id, name, email, password_hash, role)
      VALUES ($1,'Kofi Asante','kofi@bfa.edu.gh',$2,'owner') RETURNING id
    `, [sid, hash]);
    const by = owner.id;

    await client.query(`
      INSERT INTO users (school_id, name, email, password_hash, role) VALUES
        ($1,'Ama Osei',          'ama@bfa.edu.gh',   $2,'teacher'),
        ($1,'Kwasi Frimpong',    'kwasi@bfa.edu.gh', $2,'teacher'),
        ($1,'Abena Darko',       'abena@bfa.edu.gh', $2,'teacher'),
        ($1,'Grace Acheampong',  'grace@bfa.edu.gh', $2,'teacher'),
        ($1,'Yaw Appiah',        'yaw@bfa.edu.gh',   $2,'teacher'),
        ($1,'Kweku Boateng',     'kweku@bfa.edu.gh', $2,'accountant'),
        ($1,'Sandra Amponsah',   'sandra@bfa.edu.gh',$2,'accountant')
    `, [sid, hash]);

    // ── Terms ─────────────────────────────────────────────────────────────
    const { rows: terms } = await client.query(`
      INSERT INTO terms (school_id, name, start_date, end_date, is_current) VALUES
        ($1,'Term 3 2024','2024-09-09','2024-12-06',false),
        ($1,'Term 1 2025','2025-01-13','2025-04-11',true),
        ($1,'Term 2 2025','2025-05-05','2025-07-25',false)
      RETURNING id, name
    `, [sid]);
    const t1 = terms[1]; // Term 1 2025 (current)

    // ── Classes ───────────────────────────────────────────────────────────
    const { rows: classes } = await client.query(`
      INSERT INTO classes (school_id, name, order_num) VALUES
        ($1,'Primary 1',1),($1,'Primary 2',2),($1,'Primary 3',3),
        ($1,'JHS 1',4),    ($1,'JHS 2',5),    ($1,'JHS 3',6)
      RETURNING id, name, order_num
    `, [sid]);
    const classMap = { p1: classes[0], p2: classes[1], p3: classes[2],
                       j1: classes[3], j2: classes[4], j3: classes[5] };
    const jhsClassIds = new Set([classes[3].id, classes[4].id, classes[5].id]);

    // ── Subjects ──────────────────────────────────────────────────────────
    const { rows: subjects } = await client.query(`
      INSERT INTO subjects (school_id, name, code) VALUES
        ($1,'Mathematics',      'MATH'),
        ($1,'English Language', 'ENG'),
        ($1,'Science',          'SCI'),
        ($1,'Social Studies',   'SOC'),
        ($1,'Information Tech', 'ICT')
      RETURNING id, name, code
    `, [sid]);
    const [math, eng, sci] = subjects;

    // ── Families ─────────────────────────────────────────────────────────
    const famMap = {};
    for (const f of FAMILY_DEFS) {
      const { rows: [row] } = await client.query(
        `INSERT INTO families (school_id, guardian_name, phone) VALUES ($1,$2,$3) RETURNING id`,
        [sid, f.guardian, f.phone]
      );
      famMap[f.key] = row.id;
    }

    // ── Students (100) ────────────────────────────────────────────────────
    const students = [];
    for (let i = 0; i < STUDENT_DEFS.length; i++) {
      const [code, name, classKey, gender, parent, phone, dobYear, famKey] = STUDENT_DEFS[i];
      const dob = mkDob(dobYear, i);
      const classId = classMap[classKey].id;
      const famId = famKey ? famMap[famKey] : null;
      const { rows: [s] } = await client.query(`
        INSERT INTO students
          (school_id, family_id, student_code, name, dob, class_id, gender, parent_name, parent_phone)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, class_id, student_code
      `, [sid, famId, code, name, dob, classId, gender, parent, phone]);
      students.push({ ...s, classKey, index: i });
    }

    // ── Fee Items ─────────────────────────────────────────────────────────
    const { rows: feeItems } = await client.query(`
      INSERT INTO fee_items (school_id, name) VALUES
        ($1,'Tuition'),($1,'Development Levy'),($1,'Books'),($1,'Uniform'),($1,'Sports')
      RETURNING id, name
    `, [sid]);
    const [fTuition, fDev, fBooks, fUniform, fSports] = feeItems;

    // ── Fee Structures ────────────────────────────────────────────────────
    const { rows: [fsPrimary] } = await client.query(
      `INSERT INTO fee_structures (school_id, term_id, name) VALUES ($1,$2,'Primary Term 1 2025') RETURNING id`,
      [sid, t1.id]
    );
    const { rows: [fsJHS] } = await client.query(
      `INSERT INTO fee_structures (school_id, term_id, name) VALUES ($1,$2,'JHS Term 1 2025') RETURNING id`,
      [sid, t1.id]
    );

    // Primary: 500+100+80+150 = 830
    for (const [fi, amt] of [[fTuition,500],[fDev,100],[fBooks,80],[fUniform,150]]) {
      await client.query(
        'INSERT INTO fee_structure_items (fee_structure_id, fee_item_id, amount) VALUES ($1,$2,$3)',
        [fsPrimary.id, fi.id, amt]
      );
    }
    await client.query(
      `UPDATE fee_structures SET total_amount=(SELECT SUM(amount) FROM fee_structure_items WHERE fee_structure_id=$1) WHERE id=$1`,
      [fsPrimary.id]
    );

    // JHS: 700+150+100+180+50 = 1180
    for (const [fi, amt] of [[fTuition,700],[fDev,150],[fBooks,100],[fUniform,180],[fSports,50]]) {
      await client.query(
        'INSERT INTO fee_structure_items (fee_structure_id, fee_item_id, amount) VALUES ($1,$2,$3)',
        [fsJHS.id, fi.id, amt]
      );
    }
    await client.query(
      `UPDATE fee_structures SET total_amount=(SELECT SUM(amount) FROM fee_structure_items WHERE fee_structure_id=$1) WHERE id=$1`,
      [fsJHS.id]
    );

    // ── Payment Plans + Payments (all 100 students) ───────────────────────
    const planTypes = ['full', '50_50', 'monthly'];
    let paymentCount = 0;
    for (const s of students) {
      const isJHS   = jhsClassIds.has(s.class_id);
      const fsId    = isJHS ? fsJHS.id   : fsPrimary.id;
      const total   = isJHS ? 1180       : 830;
      const pType   = planTypes[s.index % 3];

      const { rows: [plan] } = await client.query(`
        INSERT INTO payment_plans
          (school_id, student_id, fee_structure_id, term_id, plan_type, total_amount, start_date)
        VALUES ($1,$2,$3,$4,$5,$6,'2025-01-13') RETURNING id
      `, [sid, s.id, fsId, t1.id, pType, total]);

      const schedule = generateSchedule(pType, total, '2025-01-13', '2025-04-11');
      for (const item of schedule) {
        await client.query(`
          INSERT INTO payment_schedules (plan_id, school_id, student_id, installment_num, due_date, amount_due)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [plan.id, sid, s.id, item.installment_num, item.due_date, item.amount_due]);
      }

      // ~80% of students have paid; tier drives how much
      if (s.index % 5 !== 4) {
        const tier = s.index % 3; // 0=full, 1=half, 2=partial
        const paid = tier === 0 ? total
                   : tier === 1 ? Math.round(total * 0.5)
                   : Math.round(total * 0.3);
        const payDate = `2025-01-${13 + (s.index % 12)}`;
        await client.query(`
          INSERT INTO payments
            (school_id, student_id, plan_id, amount, payment_date, method, recorded_by)
          VALUES ($1,$2,$3,$4,$5,'cash',$6)
        `, [sid, s.id, plan.id, paid, payDate, by]);
        paymentCount++;
      }
    }

    // ── Assessments (Term 1 2025) ─────────────────────────────────────────
    const { rows: assessments } = await client.query(`
      INSERT INTO assessments (school_id, subject_id, term_id, title, type, max_score) VALUES
        ($1,$2,$3,'Mathematics Term 1 2025',      'AoL',200),
        ($1,$4,$3,'English Language Term 1 2025', 'AoL',200),
        ($1,$5,$3,'Science Term 1 2025',           'AoL',200),
        ($1,$6,$3,'Social Studies Term 1 2025',    'AoL',200),
        ($1,$7,$3,'Information Tech Term 1 2025',  'AoL',200)
      RETURNING id, subject_id
    `, [sid, math.id, t1.id, eng.id, sci.id, subjects[3].id, subjects[4].id]);

    const assessBySubjectId = {};
    for (const a of assessments) assessBySubjectId[a.subject_id] = a.id;

    // ── Results ───────────────────────────────────────────────────────────
    // Tiers: index%3 → 0=strong, 1=average, 2=weak
    const TIERS = ['strong', 'average', 'weak'];
    let resultCount = 0;

    // Subjects per class level: Primary gets Math+English+Science; JHS gets all 5
    const primarySubjects = [math, eng, sci];
    const jhsSubjects     = subjects; // all 5

    for (const s of students) {
      const tier = TIERS[s.index % 3];
      const subjectList = jhsClassIds.has(s.class_id) ? jhsSubjects : primarySubjects;

      for (let si = 0; si < subjectList.length; si++) {
        const subj = subjectList[si];
        if (!subj) break;
        const assessId = assessBySubjectId[subj.id];
        if (!assessId) continue;
        const { theory, practical } = scoreFor(tier, s.index, si * 3);
        await client.query(`
          INSERT INTO results
            (school_id, student_id, assessment_id, score_theory, score_practical, total_score, recorded_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (school_id, student_id, assessment_id) DO NOTHING
        `, [sid, s.id, assessId, theory, practical, theory + practical, by]);
        resultCount++;
      }
    }

    // ── Feeding Records (Apr 7–11, 2025) ─────────────────────────────────
    const fedDates = ['2025-04-07','2025-04-08','2025-04-09','2025-04-10','2025-04-11'];
    for (const date of fedDates) {
      for (const s of students) {
        const amount = jhsClassIds.has(s.class_id) ? 6.50 : 5.00;
        await client.query(`
          INSERT INTO feeding_records
            (school_id, student_id, class_id, date, amount, recorded_by)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (school_id, student_id, date) DO NOTHING
        `, [sid, s.id, s.class_id, date, amount, by]);
      }
    }

    await client.query('COMMIT');

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Bright Future Academy — Seed Complete              ║
╠══════════════════════════════════════════════════════════════╣
║  School code  :  BFA001                                      ║
║  Password     :  Password1  (all users)                      ║
╠══════════════════════════════════════════════════════════════╣
║  owner        :  kofi@bfa.edu.gh                             ║
║  teachers     :  ama / kwasi / abena / grace / yaw           ║
║                  @bfa.edu.gh                                 ║
║  accountants  :  kweku@bfa.edu.gh  sandra@bfa.edu.gh         ║
╠══════════════════════════════════════════════════════════════╣
║  3 terms  |  6 classes  |  5 subjects  |  100 students       ║
║  5 families  |  2 fee structures  |  100 payment plans       ║
║  ${String(paymentCount).padEnd(3)} payments  |  ${String(resultCount).padEnd(4)} results                        ║
║  5 days feeding records for all 100 students                 ║
╚══════════════════════════════════════════════════════════════╝
    `);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
