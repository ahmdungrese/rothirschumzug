"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { ExclamationTriangleIcon, ArrowPathIcon, ArrowUturnLeftIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class OrderErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in OrderEditor:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "Unbekannter Systemfehler";
      const isNetworkRelated = errorMsg.toLowerCase().includes("network") || 
                              errorMsg.toLowerCase().includes("offline") || 
                              errorMsg.toLowerCase().includes("fetch") ||
                              errorMsg.toLowerCase().includes("quota");

      return (
        <div className="min-h-[420px] my-6 p-6 sm:p-8 rounded-3xl bg-bg-panel border-2 border-amber-500/30 shadow-2xl max-w-2xl mx-auto text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ExclamationTriangleIcon className="w-9 h-9" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold font-headline text-text-main mb-1.5">
            {this.props.fallbackTitle || "Hinweis zum Auftrags- & Angebots-Editor"}
          </h2>
          <span className="text-xs text-text-muted block mb-4 font-semibold">
            تنبيه أثناء معالجة العرض أو الطلب
          </span>

          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl mb-5 text-xs flex items-center justify-center gap-2">
            <ShieldCheckIcon className="w-4 h-4 shrink-0" />
            <span>Ihre bisherigen Daten in der Datenbank sind sicher und geschützt / بياناتك المسجلة محفوظة بأمان</span>
          </div>

          <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-lg mx-auto mb-4">
            {isNetworkRelated ? (
              "Es gab eine Unterbrechung bei der Übertragung zur Datenbank. Möglicherweise war das Internet kurzzeitig getrennt."
            ) : (
              "Beim Laden einzelner Felder ist ein Anzeigefehler aufgetreten. Bitte laden Sie das Formular neu oder kehren Sie zur Übersicht zurück."
            )}
          </p>

          {this.state.error?.message && (
            <div className="bg-black/30 border border-structure/60 rounded-xl p-3 mb-6 text-left max-w-md mx-auto">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-0.5">
                Technischer Hinweis / تفاصيل الخطأ
              </span>
              <code className="text-xs font-mono text-amber-200/90 break-words block">
                {this.state.error.message}
              </code>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-primary py-2.5 px-5 text-xs font-bold font-headline shadow-md flex items-center gap-1.5"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Erneut versuchen / إعادة المحاولة</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="btn-secondary py-2.5 px-4 text-xs font-bold font-headline"
            >
              Seite neu laden / تحديث
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/dashboard/orders";
                }
              }}
              className="btn-secondary py-2.5 px-4 text-xs font-bold font-headline text-text-muted hover:text-text-main flex items-center gap-1"
            >
              <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
              <span>Zurück / خروج آمن</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
