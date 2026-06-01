import React from 'react';

export default function DiagnosticPanel({ diagnostics = {} }) {
  const sections = [
    {
      title: 'Data Completeness',
      key: 'dataCompleteness',
      items: [
        { label: 'School Identity', status: 'complete' },
        { label: 'Academic Structure', status: 'complete' },
        { label: 'Staff Records', status: diagnostics.staffCount > 0 ? 'complete' : 'incomplete' },
        { label: 'Student Records', status: diagnostics.studentCount > 0 ? 'complete' : 'incomplete' },
      ],
    },
    {
      title: 'Fee Setup',
      key: 'feeSetup',
      items: [
        { label: 'Fee Structure', status: diagnostics.hasFeesSetup ? 'complete' : 'incomplete' },
        { label: 'Payment Plans', status: diagnostics.hasPaymentPlans ? 'complete' : 'incomplete' },
      ],
    },
    {
      title: 'Academic Readiness',
      key: 'academicReadiness',
      items: [
        { label: 'Subjects Defined', status: diagnostics.subjectCount > 0 ? 'complete' : 'incomplete' },
        { label: 'Classes Assigned', status: diagnostics.classCount > 0 ? 'complete' : 'incomplete' },
        { label: 'Terms Setup', status: diagnostics.termsSetup ? 'complete' : 'incomplete' },
      ],
    },
    {
      title: 'User Activity',
      key: 'userActivity',
      items: [
        { label: 'Staff Logins', status: diagnostics.staffLogins > 0 ? 'complete' : 'pending' },
        { label: 'Student Records', status: diagnostics.studentCount > 0 ? 'complete' : 'pending' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.key} className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{section.title}</h3>
          <div className="space-y-2">
            {section.items.map((item, idx) => {
              const isComplete = item.status === 'complete';
              const bgColor = isComplete ? 'bg-green-50' : item.status === 'pending' ? 'bg-yellow-50' : 'bg-red-50';
              const borderColor = isComplete ? 'border-green-200' : item.status === 'pending' ? 'border-yellow-200' : 'border-red-200';
              const icon = isComplete ? '✓' : item.status === 'pending' ? '⏳' : '✕';
              const iconColor = isComplete ? 'text-green-600' : item.status === 'pending' ? 'text-yellow-600' : 'text-red-600';

              return (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${bgColor} ${borderColor}`}>
                  <p className="text-sm text-gray-700">{item.label}</p>
                  <span className={`text-lg font-bold ${iconColor}`}>{icon}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
