import React from 'react';

export default function OnboardingDashboard({ 
  setupProgress = 0, 
  issues = [], 
  onFixIssue = () => {},
  tips = []
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Onboarding Dashboard</h1>
          <p className="text-gray-600 mt-2">Complete your school setup and get ready to go live</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Setup Progress Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Setup Progress</h2>
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="transform -rotate-90 w-24 h-24">
                      <circle cx="48" cy="48" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle
                        cx="48"
                        cy="48"
                        r="45"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="8"
                        strokeDasharray={`${2.827 * setupProgress} 282.7`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-2xl font-bold text-gray-900">{setupProgress}%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-3">You're almost there! Complete the following:</p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className={setupProgress >= 20 ? 'line-through text-gray-400' : ''}>✓ School Identity</li>
                    <li className={setupProgress >= 40 ? 'line-through text-gray-400' : ''}>✓ Academic Structure</li>
                    <li className={setupProgress >= 60 ? 'line-through text-gray-400' : ''}>✓ Staff Setup</li>
                    <li className={setupProgress >= 80 ? 'line-through text-gray-400' : ''}>✓ Student Import</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Issues List */}
            {issues.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Issues to Address</h2>
                <div className="space-y-3">
                  {issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start justify-between bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="flex gap-3">
                        <span className="text-red-600 text-xl">⚠</span>
                        <div>
                          <p className="font-medium text-gray-900">{issue.title}</p>
                          <p className="text-sm text-gray-600 mt-1">{issue.message}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onFixIssue(issue.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap ml-4"
                      >
                        Fix
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <button className="px-4 py-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium">
                  Record Attendance
                </button>
                <button className="px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium">
                  Record Payment
                </button>
                <button className="px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium">
                  Create Assessment
                </button>
                <button className="px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium">
                  Post Announcement
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar - Tips */}
          <div className="bg-white rounded-xl shadow-lg p-6 h-fit">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Tips</h3>
            <div className="space-y-4">
              {tips.map((tip, idx) => (
                <div key={idx} className="pb-4 border-b border-gray-200 last:border-b-0">
                  <p className="text-sm font-medium text-gray-900">{tip.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{tip.text}</p>
                </div>
              ))}
              {tips.length === 0 && (
                <ul className="text-xs text-gray-600 space-y-2">
                  <li>• Start by recording student attendance daily</li>
                  <li>• Set up fee payment reminders</li>
                  <li>• Create assessments regularly</li>
                  <li>• Engage parents with announcements</li>
                  <li>• Track student performance trends</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
