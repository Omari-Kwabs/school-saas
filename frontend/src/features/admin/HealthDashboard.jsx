import React from 'react';
import HealthCard from './HealthCard';

export default function HealthDashboard({ data, onCardClick = () => {} }) {
  const schools    = data?.schools    ?? [];
  const avg_score  = data?.avg_score  ?? 0;
  const activeCount = schools.filter(s => s.payment_activity).length;

  if (!schools.length) {
    return <div className="text-center text-gray-400 py-12">No schools to display.</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Average Setup Score</p>
          <p className="text-3xl font-bold text-indigo-600">{avg_score}%</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Payment Active (30d)</p>
          <p className="text-3xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Schools</p>
          <p className="text-3xl font-bold text-blue-600">{schools.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schools.map(school => (
          <HealthCard
            key={school.school_id}
            schoolName={school.school_name}
            setupScore={school.setup_score}
            paymentActivity={school.payment_activity ? 'Active' : 'Inactive'}
            academicActivity={school.academic_activity ? 'Active' : 'Inactive'}
            onClick={() => onCardClick(school.school_id)}
          />
        ))}
      </div>
    </div>
  );
}
