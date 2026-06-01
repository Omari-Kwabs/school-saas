const PLAN_META = {
  trial: {
    label: 'Trial',
    description: '4 months free — full access to all standard features',
    features: [
      'Student & class management',
      'Grades, results & report cards',
      'Attendance tracking',
      'Fee management & payments',
      'Timetable & class scheduling',
      'Announcements & memos',
      'Staff accounts & roles',
      'Store & feeding records',
    ],
  },
  basic: {
    label: 'Basic',
    description: 'Core academic and fee management for day-to-day operations',
    features: [
      'Student & class management',
      'Grades, results & report cards',
      'Attendance tracking',
      'Fee management & payments',
      'Timetable & class scheduling',
      'Staff accounts & roles',
    ],
  },
  premium: {
    label: 'Premium',
    description: 'Full platform including advanced analytics and intelligence',
    features: [
      'Everything in Basic',
      'Announcements & memos',
      'Store & feeding records',
      'Teacher Performance Analytics',
      'Student Intelligence & Risk Assessment',
    ],
  },
};

module.exports = PLAN_META;
