"use client";

import { useState, useEffect } from 'react';
import { WifiIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export function NetworkMonitor() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    // Initialer Check
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex justify-center animate-in slide-in-from-top-2 duration-300 pointer-events-none">
      {!isOnline ? (
        <div className="bg-red-500 text-white px-4 py-2 mt-2 mx-4 rounded-lg shadow-xl shadow-red-500/20 border border-red-600 flex items-center gap-2 pointer-events-auto">
          <ExclamationTriangleIcon className="w-5 h-5 animate-pulse" />
          <div className="text-sm font-medium">
            <span className="font-bold">Achtung: Keine Internetverbindung!</span> Änderungen können aktuell nicht gespeichert werden. Bitte Seite nicht neu laden!
          </div>
        </div>
      ) : showRestored ? (
        <div className="bg-green-500 text-white px-4 py-2 mt-2 mx-4 rounded-lg shadow-xl shadow-green-500/20 border border-green-600 flex items-center gap-2 pointer-events-auto animate-out fade-out slide-out-to-top-2 duration-500 delay-2000">
          <WifiIcon className="w-5 h-5" />
          <div className="text-sm font-medium">
            Verbindung wiederhergestellt! Du kannst jetzt speichern.
          </div>
        </div>
      ) : null}
    </div>
  );
}
