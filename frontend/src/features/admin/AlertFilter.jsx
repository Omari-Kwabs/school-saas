import React, { useState } from 'react';

export default function AlertFilter({ 
  onFilterChange = () => {},
  types = ['Setup Incomplete', 'Low Activity', 'Payment Overdue', 'Data Update', 'Integration Error'],
  severities = ['low', 'medium', 'high']
}) {
  const [selectedTypes, setSelectedTypes] = useState(types);
  const [selectedSeverities, setSelectedSeverities] = useState(severities);

  const handleTypeChange = (type) => {
    const updated = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(updated);
    onFilterChange({ types: updated, severities: selectedSeverities });
  };

  const handleSeverityChange = (severity) => {
    const updated = selectedSeverities.includes(severity)
      ? selectedSeverities.filter(s => s !== severity)
      : [...selectedSeverities, severity];
    setSelectedSeverities(updated);
    onFilterChange({ types: selectedTypes, severities: updated });
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alert Types */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Alert Types</h3>
          <div className="space-y-2">
            {types.map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => handleTypeChange(type)}
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                />
                <span className="text-sm text-gray-700">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Severity Levels */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Severity</h3>
          <div className="space-y-2">
            {severities.map((severity) => (
              <label key={severity} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSeverities.includes(severity)}
                  onChange={() => handleSeverityChange(severity)}
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                />
                <span className="text-sm text-gray-700 capitalize">
                  {severity === 'high' ? '🔴 High' : severity === 'medium' ? '🟡 Medium' : '🔵 Low'}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
