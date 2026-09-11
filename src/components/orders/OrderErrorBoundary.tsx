"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

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
      return (
        <div className="min-h-[450px] my-8 p-6 sm:p-10 rounded-2xl bg-bg-panel border-2 border-red-500/30 shadow-2xl max-w-3xl mx-auto text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mx-auto mb-5 shadow-lg">
            <span className="material-symbols-outlined text-3xl">warning</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-headline text-text-main mb-2">
            {this.props.fallbackTitle || "Hinweis zum Angebots-Editor"}
          </h2>

          <p className="text-sm text-text-muted max-w-xl mx-auto mb-6">
            Ein unerwarteter Anzeigefehler ist aufgetreten. Deine bisherigen Daten in der Datenbank sind sicher. 
            Bitte prüfe, ob alle Pflichtfelder (z. B. Kundenname oder Adressen) gültig ausgefüllt wurden.
          </p>

          {this.state.error?.message && (
            <div className="bg-black/30 border border-structure/60 rounded-xl p-3.5 mb-6 text-left max-w-lg mx-auto">
              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider block mb-1">
                Fehler-Details
              </span>
              <code className="text-xs font-mono text-red-300 break-words block">
                {this.state.error.message}
              </code>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-primary py-2.5 px-6 text-xs font-bold font-headline shadow-md shadow-primary/20"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="btn-secondary py-2.5 px-5 text-xs font-bold font-headline"
            >
              Seite neu laden
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary py-2.5 px-5 text-xs font-bold font-headline text-text-muted hover:text-text-main"
            >
              Zurück
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
