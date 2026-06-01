import React, { useState, useEffect } from 'react';

export default function ToastPrompt({ 
  message = '', 
  actionLabel = 'Take Action',
  onAction = () => {},
  onDismiss = () => {},
  duration = 5000,
  type = 'info'
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  if (!visible) return null;

  const bgColor = type === 'success' ? 'bg-green-50' : type === 'error' ? 'bg-red-50' : 'bg-blue-50';
  const borderColor = type === 'success' ? 'border-green-200' : type === 'error' ? 'border-red-200' : 'border-blue-200';
  const textColor = type === 'success' ? 'text-green-800' : type === 'error' ? 'text-red-800' : 'text-blue-800';
  const buttonColor = type === 'success' ? 'bg-green-600 hover:bg-green-700' : type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} border ${borderColor} p-4 rounded-lg shadow-lg max-w-sm z-50 animate-fade-in`}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className={`${textColor} text-sm font-medium`}>{message}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => {
              onAction();
              setVisible(false);
            }}
            className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg ${buttonColor} transition-colors`}
          >
            {actionLabel}
          </button>
          <button
            onClick={() => {
              setVisible(false);
              onDismiss();
            }}
            className="px-2 py-1 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
