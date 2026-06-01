import React from 'react';

export default function ProgressBar({ currentStep, totalSteps, stepLabels = [] }) {
  return (
    <div className="mb-8">
      {/* Visual bar */}
      <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
        <div
          className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step labels */}
      {stepLabels.length > 0 && (
        <div className="flex justify-between mt-6">
          {stepLabels.map((label, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  idx + 1 <= currentStep
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {idx + 1}
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Text info */}
      <div className="text-sm text-gray-600 mt-4">
        {currentStep} of {totalSteps} complete
      </div>
    </div>
  );
}
