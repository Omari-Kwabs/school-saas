import React from 'react';
import ProgressBar from './ProgressBar';

export default function OnboardingTable({ schools = [], onRowClick = () => {} }) {
  if (!schools.length) {
    return <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">No schools found.</div>;
  }

  const currentStepLabel = (school) => {
    const first = school.steps?.find(s => !s.done);
    return first ? first.label : 'Complete';
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">School Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Current Step</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Registered</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {schools.map(row => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.id)}
                className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{row.name}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-800">{currentStepLabel(row)}</p>
                  <p className="text-xs text-gray-400">Step {row.current_step} of 8</p>
                </td>
                <td className="px-6 py-4 w-40">
                  <ProgressBar percentage={row.progress} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(row.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  {row.status === 'complete' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                      ✓ Complete
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                      ⏳ In Progress
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-600">
        {schools.length} school{schools.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
