import React from 'react';

const MOCK_CHART_DATA = [
  { label: 'St. Johns', value: 1250 },
  { label: 'Bright Future', value: 320 },
  { label: 'Elite', value: 3100 },
  { label: 'Community', value: 45 },
  { label: 'Global', value: 1900 },
];

export default function SimpleBarChart({ data = MOCK_CHART_DATA, title = 'Daily Actions by School', height = 300 }) {
  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = 100 / data.length;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

      <div className="flex items-end justify-between" style={{ height: `${height}px`, gap: '8px' }}>
        {data.map((item, idx) => {
          const heightPercent = (item.value / maxValue) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center">
              {/* Bar */}
              <div className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t transition-all hover:from-indigo-700 hover:to-indigo-500 cursor-pointer group relative" style={{ height: `${heightPercent}%` }}>
                {/* Tooltip */}
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {item.value.toLocaleString()}
                </div>
              </div>

              {/* Label */}
              <p className="text-xs text-gray-600 font-medium text-center mt-2 w-full break-words">{item.label}</p>
            </div>
          );
        })}
      </div>

      {/* Y-axis reference lines */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-xs text-gray-500">
        <span>0</span>
        <span>{(maxValue / 2).toLocaleString()}</span>
        <span>{maxValue.toLocaleString()}</span>
      </div>
    </div>
  );
}
