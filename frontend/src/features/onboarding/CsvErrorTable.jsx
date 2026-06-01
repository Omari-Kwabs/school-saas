import React from 'react';

export default function CsvErrorTable({ errors = [] }) {
  if (errors.length === 0) {
    return (
      <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
        <p className="text-green-800 text-sm font-medium">✓ No errors found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Row</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Error</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Suggestion</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error, idx) => (
            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{error.row}</td>
              <td className="px-4 py-3 text-red-600">
                <span className="text-xs font-semibold">✕</span> {error.message}
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs italic">
                {error.suggestion || '—'}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  Error
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
