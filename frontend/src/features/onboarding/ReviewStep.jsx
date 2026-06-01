import React from 'react';

export default function ReviewStep({ data = {}, onConfirm }) {
  const sections = [
    {
      title: 'School Identity',
      items: [
        { label: 'School Name', value: data.schoolName },
        { label: 'Motto', value: data.motto },
        { label: 'Primary Color', value: data.primaryColor },
      ],
    },
    {
      title: 'Academic Structure',
      items: [
        { label: 'Total Levels', value: data.levels?.length || 0 },
        { label: 'Total Classes', value: data.levels?.reduce((sum, l) => sum + l.classes.length, 0) || 0 },
      ],
    },
    {
      title: 'Academic Setup',
      items: [
        { label: 'Academic Year', value: data.academicYear },
        { label: 'Total Subjects', value: data.subjects?.length || 0 },
      ],
    },
    {
      title: 'Staff',
      items: [
        { label: 'Teachers Added', value: data.staff?.length || 0 },
      ],
    },
    {
      title: 'Fees',
      items: [
        { label: 'Fee Items', value: data.feeItems?.length || 0 },
        { label: 'Total Annual Fee', value: data.feeItems?.reduce((sum, f) => sum + f.amount, 0) || 0 },
        { label: 'Payment Plan', value: data.paymentPlan === '50' ? '50-50 (2 installments)' : data.paymentPlan === '33' ? '33-33-33 (3 installments)' : 'Full payment' },
      ],
    },
    {
      title: 'Students',
      items: [
        { label: 'Students Added', value: data.students?.length || 0 },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-700">
          Review your setup below. Click <strong>Confirm & Complete</strong> to finalize onboarding.
        </p>
      </div>

      {/* Review Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">{section.title}</h3>
            <div className="space-y-2">
              {section.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-medium text-gray-800">
                    {typeof item.value === 'string' && item.value.startsWith('#')
                      ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded" style={{ background: item.value }} />
                          {item.value}
                        </span>
                      )
                      : item.value || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation */}
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <p className="text-sm text-gray-700 mb-4">
          ✓ Your school is ready to go! Staff and students can now log in.
        </p>
        <button
          onClick={onConfirm}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
        >
          Confirm & Complete Onboarding
        </button>
      </div>
    </div>
  );
}
