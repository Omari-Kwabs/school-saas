import React, { useState } from 'react';

export default function StudentImportStep({ onSave, initialData = {} }) {
  const [students, setStudents] = useState(initialData.students || []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [classId, setClassId] = useState('');
  const [csvError, setCsvError] = useState('');
  const [csvPreview, setCsvPreview] = useState([]);

  function addStudent() {
    if (name.trim() && classId.trim()) {
      setStudents([...students, {
        id: Date.now(),
        name,
        email: email || '',
        classId,
      }]);
      setName('');
      setEmail('');
    }
  }

  function removeStudent(id) {
    setStudents(students.filter(s => s.id !== id));
  }

  function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        const lines = text.split('\n').filter((line) => line.trim());
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

        const nameIdx = headers.indexOf('name');
        const emailIdx = headers.indexOf('email');
        const classIdx = headers.indexOf('class');

        if (nameIdx === -1 || classIdx === -1) {
          setCsvError('CSV must have "name" and "class" columns');
          return;
        }

        const imported = lines.slice(1).map((line, idx) => {
          const cells = line.split(',').map((c) => c.trim());
          return {
            id: Date.now() + idx,
            name: cells[nameIdx] || '',
            email: emailIdx >= 0 ? cells[emailIdx] : '',
            classId: cells[classIdx] || '',
          };
        }).filter((s) => s.name);

        setCsvPreview(imported);
        setCsvError('');
      } catch (err) {
        setCsvError('Failed to parse CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function importCsvPreview() {
    setStudents([...students, ...csvPreview]);
    setCsvPreview([]);
  }

  return (
    <div className="space-y-6">
      {/* Manual Add */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="font-semibold text-gray-800 mb-4">Add Student Manually</p>
        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Student name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder="Class/Grade"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={addStudent}
            className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            Add Student
          </button>
        </div>
      </div>

      {/* CSV Import */}
      <div className="border border-gray-200 rounded-lg p-4">
        <p className="font-semibold text-gray-800 mb-2">Or Import CSV</p>
        <p className="text-xs text-gray-600 mb-3">Required columns: name, class. Optional: email</p>
        <input
          type="file"
          accept=".csv"
          onChange={handleCsvUpload}
          className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
        />
        {csvError && <p className="text-sm text-red-600 mt-2">{csvError}</p>}
      </div>

      {/* CSV Preview */}
      {csvPreview.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <p className="font-semibold text-gray-800 mb-3">Preview: {csvPreview.length} students</p>
          <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
            {csvPreview.map((s) => (
              <p key={s.id} className="text-sm text-gray-700">{s.name} - {s.classId}</p>
            ))}
          </div>
          <button
            onClick={importCsvPreview}
            className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
          >
            Import All
          </button>
        </div>
      )}

      {/* Students List */}
      <div>
        <p className="font-semibold text-gray-800 mb-3">Imported Students ({students.length})</p>
        <div className="max-h-48 overflow-y-auto space-y-2">
          {students.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-4">No students added yet</p>
          ) : (
            students.map((student) => (
              <div key={student.id} className="flex justify-between items-start bg-white p-2 rounded-lg border border-gray-200 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{student.name}</p>
                  <p className="text-xs text-gray-600">{student.classId}</p>
                </div>
                <button
                  onClick={() => removeStudent(student.id)}
                  className="text-red-600 hover:text-red-700"
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
