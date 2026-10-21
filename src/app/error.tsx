"use client";

import React, { useEffect, useState } from "react";
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon, LockClosedIcon, WifiIcon } from "@heroicons/react/24/outline";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Log error internally in browser console for developers only, never display to UI
    console.error("Route error intercepted:", error);
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
  }, [error]);

  const rawMsg = (error?.message || "").toLowerCase();
  const isPermissionError = rawMsg.includes("permission") || rawMsg.includes("berechtigung") || rawMsg.includes("forbidden") || rawMsg.includes("unauthorized");
  const isNetworkError = isOffline || rawMsg.includes("network") || rawMsg.includes("offline") || rawMsg.includes("fetch");

  const handleReset = () => {
    reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-300">
        <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-inner ${
          isPermissionError
            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
            : isNetworkError
            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            : "bg-primary/10 text-primary border border-primary/20"
        }`}>
          {isPermissionError ? (
            <LockClosedIcon className="w-8 h-8" />
          ) : isNetworkError ? (
            <WifiIcon className="w-8 h-8" />
          ) : (
            <ExclamationTriangleIcon className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold font-headline text-slate-900 dark:text-white">
            {isPermissionError
              ? "Keine Berechtigung / غير مصرح بالوصول"
              : isNetworkError
              ? "Verbindungsproblem / مشكلة في الاتصال"
              : "Hinweis zur aktuellen Ansicht / تنبيه في العرض"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {isPermissionError
              ? "Sie verfügen nicht über die erforderlichen Rechte für diesen Bereich. Ihre Daten sind geschützt."
              : isNetworkError
              ? "Die Verbindung zum Server wurde unterbrochen. Bitte überprüfen Sie Ihre Internetverbindung."
              : "Beim Laden dieser Ansicht ist ein Problem aufgetreten. Ihre Daten in der Cloud sind vollständig gesichert."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          {!isPermissionError && (
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-3 px-4 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Erneut versuchen / إعادة المحاولة</span>
            </button>
          )}
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
            <span>Zum Dashboard / للرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
}
