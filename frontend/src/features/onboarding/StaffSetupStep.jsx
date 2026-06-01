import React, { useState } from 'react';

export default function StaffSetupStep({ onSave, initialData = {}, classes = [] }) {
  const [staff, setStaff] = useState(initialData.staff || []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('teacher');
  const [assignedClass, setAssignedClass] = useState('');

  function addStaff() {
    if (name.trim() && email.trim()) {
      setStaff([...staff, {
        id: Date.now(),
        name,
        email,
        role,
        assignedClass: assignedClass || null,
      }]);
      setName('');
      setEmail('');
      setRole('teacher');
      setAssignedClass('');
    }
  }

  function removeStaff(id) {
    setStaff(staff.filter(s => s.id !== id));
  }

  const roles = ['teacher', 'class_teacher', 'department_head', 'accountant'];

  return (
    <div className="space-y-6">
      {/* Add Staff Form */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="font-semibold text-gray-800 mb-4">Add Staff Member</p>
        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={assignedClass}
              onChange={(e) => setAssignedClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No class assigned</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={addStaff}
            className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            Add Staff
          </button>
        </div>
      </div>

      {/* Staff List */}
      <div>
        <p className="font-semibold text-gray-800 mb-3">Added Staff ({staff.length})</p>
        <div className="space-y-2">
          {staff.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-4">No staff added yet</p>
          ) : (
            staff.map((member) => (
              <div key={member.id} className="flex justify-between items-start bg-white p-3 rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-800">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                  <p className="text-xs text-gray-600 mt-1">Role: <span className="font-medium capitalize">{member.role.replace(/_/g, ' ')}</span></p>
                </div>
                <button
                  onClick={() => removeStaff(member.id)}
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
