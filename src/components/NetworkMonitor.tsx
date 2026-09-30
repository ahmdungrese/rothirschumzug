"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  WifiIcon, 
  ExclamationTriangleIcon, 
  ArrowPathIcon,
  CloudArrowDownIcon,
  ServerStackIcon
} from '@heroicons/react/24/outline';

export function NetworkMonitor() {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const [slowConnectionWarning, setSlowConnectionWarning] = useState(false);
  const [slowOpName, setSlowOpName] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);

  // Ping the server to verify real internet connectivity (not just Wi-Fi connection with dead internet)
  const verifyRealConnection = async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setIsServerReachable(false);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch('/icon.png?ping=' + Date.now(), {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const reachable = res.ok;
      setIsServerReachable(reachable);
      setIsOnline(reachable);
      return reachable;
    } catch {
      setIsServerReachable(false);
      return false;
    }
  };

  useEffect(() => {
    // Initial check
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = async () => {
      const alive = await verifyRealConnection();
      if (alive) {
        setIsOnline(true);
        setIsServerReachable(true);
        setShowRestored(true);
        setSlowConnectionWarning(false);
        setTimeout(() => setShowRestored(false), 4000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsServerReachable(false);
      setShowRestored(false);
    };

    // Catch database timeout custom events dispatched anywhere in the app
    const handleDbTimeout = (e: any) => {
      setSlowConnectionWarning(true);
      if (e?.detail?.operationName) {
        setSlowOpName(e.detail.operationName);
      }
    };

    // Warn if reloading while offline
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        e.preventDefault();
        e.returnValue = "Achtung: Keine Internetverbindung! Wenn Sie die Seite neu laden, kann sie ohne Verbindung nicht geöffnet werden.";
        return e.returnValue;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('rothirsch_db_timeout', handleDbTimeout);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Periodic heartbeat every 45 seconds to detect silent dropouts
    const heartbeat = setInterval(() => {
      verifyRealConnection();
    }, 45000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('rothirsch_db_timeout', handleDbTimeout);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeat);
    };
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    const reachable = await verifyRealConnection();
    setIsChecking(false);
    if (reachable) {
      setSlowConnectionWarning(false);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    }
  };

  const hasConnectionProblem = !isOnline || !isServerReachable;

  if (!hasConnectionProblem && !showRestored && !slowConnectionWarning) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] flex flex-col items-center px-4 pt-2 pointer-events-none gap-2 animate-in slide-in-from-top-3 duration-300">
      {/* 1. Offline or No Server Connection Alert */}
      {hasConnectionProblem ? (
        <div className="bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-red-900/40 border border-red-400 flex flex-col sm:flex-row items-center gap-3 pointer-events-auto max-w-2xl w-full">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-200"></span>
            </span>
            <ExclamationTriangleIcon className="w-6 h-6 shrink-0 text-white" />
          </div>

          <div className="flex-1 text-xs sm:text-sm text-center sm:text-left leading-snug">
            <span className="font-bold block text-white text-sm sm:text-base">
              Keine Verbindung zum Server / لا يوجد اتصال بالخادم
            </span>
            <span className="text-red-100">
              Es besteht momentan keine Internetverbindung zur Cloud-Datenbank. Ihre Eingaben bleiben im lokalen Speicher gesichert. Bitte laden Sie die Seite <u>nicht neu</u>.
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualRetry}
            disabled={isChecking}
            className="shrink-0 bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-2 px-3.5 rounded-xl border border-white/30 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Prüfe...' : 'Erneut prüfen'}</span>
          </button>
        </div>
      ) : slowConnectionWarning ? (
        /* 2. Slow Connection / Database Latency Alert */
        <div className="bg-amber-600 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-amber-900/40 border border-amber-400 flex flex-col sm:flex-row items-center gap-3 pointer-events-auto max-w-2xl w-full">
          <ServerStackIcon className="w-6 h-6 shrink-0 text-amber-200 animate-pulse" />
          <div className="flex-1 text-xs sm:text-sm text-center sm:text-left leading-snug">
            <span className="font-bold block text-white">
              {slowOpName ? `${slowOpName}: Lange Antwortzeit / استجابة بطيئة` : 'Lange Antwortzeit der Datenbank / بطء في استجابة قاعدة البيانات'}
            </span>
            <span className="text-amber-100">
              Der Server antwortet langsamer als gewöhnlich (&gt;12 Sek.). Bitte haben Sie einen kurzen Moment Geduld oder prüfen Sie das Internet.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRetry}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-1.5 px-3 rounded-xl border border-white/30 transition cursor-pointer"
            >
              Prüfen
            </button>
            <button
              type="button"
              onClick={() => setSlowConnectionWarning(false)}
              className="text-white/80 hover:text-white text-xs px-2 cursor-pointer"
            >
              Schließen
            </button>
          </div>
        </div>
      ) : showRestored ? (
        /* 3. Restored Connection Toast */
        <div className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl shadow-emerald-900/30 border border-emerald-400 flex items-center gap-2.5 pointer-events-auto animate-out fade-out slide-out-to-top-3 duration-500 delay-2000">
          <WifiIcon className="w-5 h-5 shrink-0 text-white" />
          <div className="text-xs sm:text-sm font-semibold">
            Verbindung wiederhergestellt! Die Datenbank ist wieder online.
          </div>
        </div>
      ) : null}
    </div>
  );
}
