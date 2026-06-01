import React, { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline]     = useState(navigator.onLine);
  const [showBack, setShowBack]     = useState(false);

  useEffect(() => {
    function goOnline()  { setIsOnline(true);  setShowBack(true); }
    function goOffline() { setIsOnline(false); setShowBack(false); }
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Auto-hide the "back online" confirmation after 3 s
  useEffect(() => {
    if (!showBack) return;
    const t = setTimeout(() => setShowBack(false), 3000);
    return () => clearTimeout(t);
  }, [showBack]);

  if (isOnline && !showBack) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: isOnline ? '#27ae60' : '#c0392b',
      color: '#fff', textAlign: 'center',
      padding: '10px 16px', fontSize: 14, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    }}>
      {isOnline
        ? '✓ Back online'
        : '⚠ You\'re offline — data cannot be saved or refreshed. Unsaved drafts are kept locally.'}
    </div>
  );
}
