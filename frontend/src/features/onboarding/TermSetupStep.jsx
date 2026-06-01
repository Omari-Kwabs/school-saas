import React, { useState } from 'react';

export default function TermSetupStep({ onSave, initialData = {} }) {
  const [academicYear, setAcademicYear] = useState(initialData.academicYear || '');
  const [terms, setTerms] = useState(initialData.terms || [
    { id: 1, name: 'Term 1', startDate: '', endDate: '' },
    { id: 2, name: 'Term 2', startDate: '', endDate: '' },
    { id: 3, name: 'Term 3', startDate: '', endDate: '' },
  ]);

  function updateTerm(id, field, value) {
    setTerms(terms.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  return (
    <div className="space-y-6">
      {/* Academic Year */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year *</label>
        <input
          type="text"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="e.g., 2024/2025"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Terms */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Terms</h3>
        <div className="space-y-4">
          {terms.map((term) => (
            <div key={term.id} className="border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-gray-800 mb-3">{term.name}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={term.startDate}
                    onChange={(e) => updateTerm(term.id, 'startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={term.endDate}
                    onChange={(e) => updateTerm(term.id, 'endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
        <p className="text-sm text-gray-700">
          You can edit terms later. This sets up your academic calendar.
        </p>
      </div>
    </div>
  );
}
