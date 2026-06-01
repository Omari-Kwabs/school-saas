import React, { useState } from 'react';

export default function SubjectSetupStep({ onSave, initialData = {} }) {
  const [subjects, setSubjects] = useState(initialData.subjects || []);
  const [newSubject, setNewSubject] = useState('');

  function addSubject() {
    if (newSubject.trim()) {
      setSubjects([...subjects, { id: Date.now(), name: newSubject }]);
      setNewSubject('');
    }
  }

  function removeSubject(id) {
    setSubjects(subjects.filter(s => s.id !== id));
  }

  function updateSubject(id, name) {
    setSubjects(subjects.map(s => s.id === id ? { ...s, name } : s));
  }

  const commonSubjects = [
    'Mathematics',
    'English',
    'Science',
    'History',
    'Geography',
    'ICT',
    'PE',
    'Arts',
    'Music',
  ];

  function addCommonSubject(name) {
    if (!subjects.find(s => s.name === name)) {
      setSubjects([...subjects, { id: Date.now(), name }]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Subject */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="Enter subject name"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={addSubject}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Quick Add Common Subjects */}
      <div>
        <p className="text-sm text-gray-600 mb-2">Quick add:</p>
        <div className="flex flex-wrap gap-2">
          {commonSubjects.map((subj) => (
            <button
              key={subj}
              onClick={() => addCommonSubject(subj)}
              disabled={subjects.find(s => s.name === subj)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Subjects List */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Added Subjects ({subjects.length})</p>
        <div className="space-y-2">
          {subjects.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No subjects added yet</p>
          ) : (
            subjects.map((subj) => (
              <div key={subj.id} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-gray-200">
                <input
                  type="text"
                  value={subj.name}
                  onChange={(e) => updateSubject(subj.id, e.target.value)}
                  className="flex-1 px-2 py-1 border-0 text-sm focus:outline-none"
                />
                <button
                  onClick={() => removeSubject(subj.id)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
