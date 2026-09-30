"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function NotFoundPage() {
  const [statusText, setStatusText] = useState("Seite nicht gefunden");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const path = window.location.pathname || "";

    // Smart Fallback 1: If this was an edit-order or edit-invoice link, route directly to the universal editor with orderId
    const editOrderMatch = path.match(/\/edit-order\/([^/?#]+)/);
    if (editOrderMatch && editOrderMatch[1]) {
      setStatusText("Öffne Angebots-Editor...");
      window.location.replace(`/dashboard/orders/new?orderId=${encodeURIComponent(editOrderMatch[1])}`);
      return;
    }

    const editInvoiceMatch = path.match(/\/edit-invoice\/([^/?#]+)/);
    if (editInvoiceMatch && editInvoiceMatch[1]) {
      setStatusText("Öffne Rechnungs-Editor...");
      window.location.replace(`/dashboard/orders/new?orderId=${encodeURIComponent(editInvoiceMatch[1])}&type=invoice`);
      return;
    }
  }, []);

  const handleGoBack = () => {
    if (typeof window !== "undefined") {
      if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.origin)) {
        window.history.back();
      } else {
        window.location.href = "/dashboard";
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold font-headline">
          404
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold font-headline text-slate-900 dark:text-white">
            {statusText}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Die aufgerufene Ansicht konnte nicht gefunden werden oder wurde verschoben.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={handleGoBack}
            className="w-full py-3 px-6 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Zurück zur vorherigen Ansicht</span>
          </button>
          <Link
            href="/dashboard"
            className="w-full py-2.5 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
