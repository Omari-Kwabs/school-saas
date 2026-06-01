import React, { useState, useEffect } from 'react';
import Drawer from './Drawer';
import AdminActionsPanel from './AdminActionsPanel';
import { adminApi } from '../../api/admin';

export default function SchoolDetailView({ isOpen, schoolId, onClose = () => {}, onAction = () => {} }) {
  const [school,  setSchool]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (!isOpen || !schoolId) return;
    setLoading(true);
    setError('');
    setSchool(null);
    adminApi.school(schoolId)
      .then(setSchool)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen, schoolId]);

  const steps = school?.setup_steps
    ? [
        { label: 'Classes',  done: school.setup_steps.classes  },
        { label: 'Terms',    done: school.setup_steps.terms    },
        { label: 'Subjects', done: school.setup_steps.subjects },
        { label: 'Staff',    done: school.setup_steps.staff    },
        { label: 'Fees',     done: school.setup_steps.fees     },
        { label: 'Students', done: school.setup_steps.students },
      ]
    : [];

  const TABS = ['info', 'setup', 'issues'];

  return (
    <Drawer isOpen={isOpen} title="School Details" onClose={onClose}>
      <div className="p-6 space-y-6">
        {loading && <p className="text-center text-gray-400 py-12">Loading…</p>}
        {error   && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

        {school && (
          <>
            {/* Header */}
            <div>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold shrink-0">
                  {school.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{school.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{school.plan} plan · {school.student_count} students · {school.user_count} staff</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${school.setup_score}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-600 shrink-0">{school.setup_score}%</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 border-b-2 font-medium text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab === 'info' ? 'Information' : tab === 'setup' ? 'Setup Status' : 'Issues'}
                  {tab === 'issues' && school.issues?.length > 0 && (
                    <span className="ml-1.5 text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">{school.issues.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                {[
                  ['Code',    school.code],
                  ['Email',   school.email],
                  ['Phone',   school.phone],
                  ['Address', school.address],
                  ['Registered', school.created_at ? new Date(school.created_at).toLocaleDateString() : '—'],
                ].map(([label, value]) => value && (
                  <div key={label}>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-0.5">{label}</p>
                    <p className="text-sm text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'setup' && (
              <div className="space-y-3">
                {steps.map(step => (
                  <div key={step.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{step.label}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      step.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {step.done ? '✓ Done' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'issues' && (
              <div className="space-y-3">
                {!school.issues?.length
                  ? <p className="text-sm text-green-700 bg-green-50 rounded p-3">✓ No issues found</p>
                  : school.issues.map((issue, i) => (
                      <div key={i} className={`rounded-lg p-3 border text-sm ${
                        issue.type === 'billing'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      }`}>
                        {issue.message}
                      </div>
                    ))
                }
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-gray-200 pt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Quick Actions</p>
              <AdminActionsPanel schoolId={schoolId} onAction={onAction} />
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
