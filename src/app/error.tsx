"use client";

import React, { useEffect } from "react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global route error intercepted:", error);
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-primary"></div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold font-headline text-slate-900 dark:text-white">
            Ansicht wird aktualisiert...
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Die Seite wird automatisch neu geladen, damit alle Daten aktuell bleiben.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
          >
            Erneut versuchen
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/dashboard";
              }
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-bold shadow-md cursor-pointer"
          >
            Zum Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
