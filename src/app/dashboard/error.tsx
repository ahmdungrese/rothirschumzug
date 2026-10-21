"use client";

import React, { useEffect, useState } from "react";
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon, LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Only logged in developer console, never rendered to screen
    console.error("Dashboard error boundary caught:", error);
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }
  }, [error]);

  const rawMsg = (error?.message || "").toLowerCase();
  const isPermissionError =
    rawMsg.includes("permission") ||
    rawMsg.includes("berechtigung") ||
    rawMsg.includes("forbidden") ||
    rawMsg.includes("unauthorized");

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[460px]">
      <div className="max-w-lg w-full bg-bg-panel border border-structure rounded-3xl p-6 sm:p-8 text-center shadow-xl space-y-5 animate-in fade-in duration-300">
        <div
          className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-inner ${
            isPermissionError
              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
          }`}
        >
          {isPermissionError ? (
            <LockClosedIcon className="w-8 h-8" />
          ) : (
            <ExclamationTriangleIcon className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold font-headline text-text-main">
            {isPermissionError
              ? "Keine Berechtigung für diesen Bereich / غير مصرح بالوصول"
              : isOffline
              ? "Keine Verbindung zum Server / لا يوجد اتصال بالإنترنت"
              : "Hinweis zur aktuellen Ansicht / تنبيه في تحميل الصفحة"}
          </h2>
          <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
            {isPermissionError
              ? "Ihr Benutzerkonto verfügt nicht über die erforderliche Rolle für diese Seite. Bitte wenden Sie sich an Ihren Administrator."
              : isOffline
              ? "Die Internetverbindung wurde kurzzeitig unterbrochen. Ihre Daten sind in der Datenbank sicher hinterlegt."
              : "Beim Laden dieser Ansicht ist ein Problem aufgetreten. Ihre bisher erfassten Daten sind sicher geschützt."}
          </p>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 max-w-sm mx-auto">
          <ShieldCheckIcon className="w-4 h-4 shrink-0" />
          <span>Ihre gespeicherten Daten sind sicher in der Cloud / بياناتك محفوظة بأمان</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 justify-center">
          {!isPermissionError && (
            <button
              type="button"
              onClick={() => reset()}
              className="btn-primary py-2.5 px-5 text-xs font-bold font-headline flex items-center justify-center gap-1.5 shadow-md"
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
            className="btn-secondary py-2.5 px-5 text-xs font-bold font-headline flex items-center justify-center gap-1.5"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Zum Dashboard / للرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
}
