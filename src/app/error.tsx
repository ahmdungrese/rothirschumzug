"use client";

import React, { useEffect, useState } from "react";
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from "@heroicons/react/24/outline";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    console.error("Route error intercepted:", error);
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
  }, [error]);

  const handleReset = () => {
    reset();
  };

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shadow-inner">
          <ExclamationTriangleIcon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold font-headline text-slate-900 dark:text-white">
            {isOffline ? "Keine Internetverbindung / لا يوجد اتصال" : "Hinweis zur aktuellen Ansicht"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {isOffline ? (
              "Es besteht momentan keine Verbindung zum Internet oder Cloud-Server. Bitte stellen Sie eine Verbindung her, bevor Sie fortfahren."
            ) : (
              "Beim Laden dieser Ansicht ist ein Problem aufgetreten. Ihre gespeicherten Daten sind sicher in der Cloud geschützt."
            )}
          </p>
        </div>

        {error?.message && !isOffline && (
          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 text-left border border-slate-200 dark:border-slate-700/60 max-w-sm mx-auto">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
              Fehlercode:
            </span>
            <code className="text-xs font-mono text-red-500 dark:text-red-400 break-words block">
              {error.message}
            </code>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 py-3 px-4 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>Erneut versuchen</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/dashboard";
              }
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Zum Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
