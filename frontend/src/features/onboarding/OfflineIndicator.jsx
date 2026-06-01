import React, { useState, useEffect } from 'react';

export default function OfflineIndicator({ isOnline = true }) {
  const [show, setShow] = useState(!isOnline);

  useEffect(() => {
    const handleOnline = () => setShow(false);
    const handleOffline = () => setShow(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (show) {
    return (
      <div className="fixed top-4 right-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg shadow-lg flex items-center gap-2 z-40">
        <span className="text-red-600 text-lg">●</span>
        <span className="text-sm font-medium text-red-800">You're offline</span>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg shadow-lg flex items-center gap-2 z-40 animate-fade-in">
      <span className="text-green-600 text-lg">●</span>
      <span className="text-sm font-medium text-green-800">Connected</span>
    </div>
  );
}
