const ROLE_PRIVILEGES = {
  owner: [
    'finance:read','finance:write','academic:read','academic:write',
    'attendance:write','reports:read','users:manage','classes:manage',
    'timetable:manage','announcements:post','store:manage',
    'feeding:write','roles:manage','calendar:manage',
  ],
  teacher:             ['academic:read','academic:write','attendance:write','reports:read'],
  class_teacher:       ['academic:read','academic:write','attendance:write','reports:read'],
  department_head:     ['academic:read','academic:write','attendance:write','reports:read'],
  headmaster_academics:['finance:read','academic:read','academic:write','attendance:write','reports:read','timetable:manage','announcements:post','calendar:manage'],
  headmaster_admin:    ['finance:read','academic:read','attendance:write','reports:read','users:manage','classes:manage','timetable:manage','announcements:post','calendar:manage'],
  accountant:          ['finance:read','finance:write','feeding:write'],
  bursar:              ['finance:read','finance:write','feeding:write'],
};

const ROLE_LABELS = {
  owner:               'Proprietor / Director',
  teacher:             'Teacher',
  class_teacher:       'Class Teacher',
  department_head:     'Department Head',
  headmaster_academics:'Headmaster (Academics)',
  headmaster_admin:    'Headmaster (Admin)',
  accountant:          'Accountant',
  bursar:              'Bursar',
};

// Seeds all 8 system roles + their privileges for a school.
// Safe to call multiple times (uses ON CONFLICT DO UPDATE / DO NOTHING).
module.exports = async function seedRoles(client, school_id) {
  for (const [roleName, privileges] of Object.entries(ROLE_PRIVILEGES)) {
    const roleRes = await client.query(
      `INSERT INTO school_roles (school_id, name, label, is_system)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (school_id, name) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`,
      [school_id, roleName, ROLE_LABELS[roleName]]
    );
    const roleId = roleRes.rows[0].id;
    await client.query('DELETE FROM role_privileges WHERE role_id = $1', [roleId]);
    for (const p of privileges) {
      await client.query(
        `INSERT INTO role_privileges (role_id, privilege) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roleId, p]
      );
    }
  }
};
