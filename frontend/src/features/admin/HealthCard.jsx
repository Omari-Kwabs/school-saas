import React from 'react';

export default function HealthCard({ 
  schoolName = 'School Name',
  setupScore = 75,
  paymentActivity = 'Active',
  academicActivity = 'Good',
  onClick = () => {}
}) {
  const getColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getColorBg = (score) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getActivityColor = (activity) => {
    if (activity === 'Active') return 'bg-green-100 text-green-800 border-green-300';
    if (activity === 'Low') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow border border-gray-200 p-6 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{schoolName}</h3>
          <p className="text-sm text-gray-500">Health Overview</p>
        </div>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getColorBg(setupScore)}`}>
          <div className="text-center">
            <p className={`text-2xl font-bold ${getColor(setupScore)}`}>{setupScore}%</p>
            <p className="text-xs text-gray-600">Score</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Payment Activity</p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActivityColor(paymentActivity)}`}>
            {paymentActivity === 'Active' ? '💰' : paymentActivity === 'Low' ? '⏳' : '❌'} {paymentActivity}
          </span>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Academic Activity</p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActivityColor(academicActivity)}`}>
            {academicActivity === 'Good' ? '📚' : academicActivity === 'Moderate' ? '⚡' : '⚠️'} {academicActivity}
          </span>
        </div>
      </div>

      <button className="w-full mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
        View Details →
      </button>
    </div>
  );
}
