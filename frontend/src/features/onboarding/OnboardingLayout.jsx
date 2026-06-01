import React from 'react';

export default function OnboardingLayout({ 
  currentStep, 
  totalSteps, 
  stepTitle, 
  children, 
  onNext, 
  onBack, 
  nextLabel = 'Next',
  backLabel = 'Back',
  disableNext = false,
  disableBack = false
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full bg-gray-300 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Step {currentStep} of {totalSteps}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Step Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{stepTitle}</h1>
          <p className="text-gray-500 mb-8">Set up your school in a few simple steps</p>

          {/* Content */}
          <div className="mb-12 min-h-96">
            {children}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 justify-between">
            <button
              onClick={onBack}
              disabled={disableBack || currentStep === 1}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {backLabel}
            </button>
            <button
              onClick={onNext}
              disabled={disableNext || currentStep === totalSteps}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
