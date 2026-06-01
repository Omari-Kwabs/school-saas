import React from 'react';

export default function Stepper({ steps, current, onStep, children }) {
  const total = steps.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const done    = i < current;
          const active  = i === current;
          const isLast  = i === total - 1;
          return (
            <React.Fragment key={i}>
              <button
                onClick={() => done && onStep?.(i)}
                className={`flex flex-col items-center gap-1 min-w-0 shrink-0 ${done ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                  ${done   ? 'bg-indigo-600 border-indigo-600 text-white'   : ''}
                  ${active ? 'bg-white border-indigo-600 text-indigo-600'   : ''}
                  ${!done && !active ? 'bg-white border-gray-300 text-gray-400' : ''}`}>
                  {done ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : i + 1}
                </span>
                <span className={`text-[10px] font-semibold whitespace-nowrap hidden sm:block
                  ${active ? 'text-indigo-600' : done ? 'text-indigo-400' : 'text-gray-400'}`}>
                  {step}
                </span>
              </button>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-1 transition-colors ${done ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress text */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="font-medium text-gray-600">{steps[current]}</span>
        <span>Step {current + 1} of {total}</span>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}

export function StepperNav({ current, total, onBack, onNext, nextLabel = 'Next', backLabel = 'Back', loading }) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
      <button
        type="button"
        onClick={onBack}
        disabled={current === 0}
        className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={loading}
        className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Saving…' : nextLabel}
      </button>
    </div>
  );
}
