"use client";

import React, { useEffect, useState } from "react";

export default function NotFoundPage() {
  const [statusText, setStatusText] = useState("Seite wird wiederhergestellt & aktualisiert...");

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

    // Smart Fallback 2: Auto-return and hard-refresh so the user never sees a blank white page
    const timer = setTimeout(() => {
      if (document.referrer && document.referrer.includes(window.location.origin)) {
        window.location.replace(document.referrer);
      } else {
        window.location.replace("/dashboard");
      }
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const handleGoBackAndRefresh = () => {
    if (typeof window !== "undefined") {
      if (document.referrer && document.referrer.includes(window.location.origin)) {
        window.location.replace(document.referrer);
      } else {
        window.location.replace("/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-primary"></div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold font-headline text-slate-900 dark:text-white">
            {statusText}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Sie werden automatisch zurückgeleitet und die Daten werden frisch geladen, damit keine Ansicht verloren geht.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGoBackAndRefresh}
          className="w-full py-3 px-6 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer"
        >
          Sofort zurück & Seite aktualisieren
        </button>
      </div>
    </div>
  );
}
