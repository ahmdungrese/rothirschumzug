'use client';

import React from 'react';
import { OrderEditorProvider, useOrderEditor } from './editor/OrderEditorContext';
import { Step1Customer } from './editor/Step1Customer';
import { Step2Addresses } from './editor/Step2Addresses';
import { Step3Services } from './editor/Step3Services';
import { Step4Inventory } from './editor/Step4Inventory';
import { Step5Summary } from './editor/Step5Summary';
import { ResponsiveOrderWrapper } from './ResponsiveOrderWrapper';
import { OrderErrorBoundary } from './OrderErrorBoundary';

function OrderEditorContent() {
  const { currentStep, setCurrentStep, isSaving, saveOrder, orderStatus } = useOrderEditor();
  const [unlockedByAdmin, setUnlockedByAdmin] = React.useState(false);
  const isContractLocked = orderStatus === 'confirmed' || orderStatus === 'completed';

  const handleTabClick = (stepNum: number) => {
    setCurrentStep(stepNum);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const steps = [
    { num: 1, icon: 'person', label: 'Kunde' },
    { num: 2, icon: 'local_shipping', label: 'Logistik' },
    { num: 3, icon: 'receipt_long', label: 'Leistungen' },
    { num: 4, icon: 'chair', label: 'Inventar' },
    { num: 5, icon: 'summarize', label: 'Abschluss' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-500 relative pb-32">
      {/* Contract Locked Warning Banner */}
      {isContractLocked && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0">lock</span>
            <div>
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                Vertrag ist bestätigt & geschützt
              </p>
              <p className="text-xs text-text-muted">
                Dieser Auftrag wurde bereits verbindlich bestätigt. Änderungen wirken sich auf den bestehenden Vertrag aus.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUnlockedByAdmin(!unlockedByAdmin)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shrink-0"
          >
            {unlockedByAdmin ? 'Wieder sperren' : 'Zur Bearbeitung entsperren'}
          </button>
        </div>
      )}

      {/* 5-Step Progress Bar (Top) */}
      <div className="bg-bg-dark rounded-2xl border border-structure p-3 flex items-center justify-between shadow-sm mb-6 sticky top-4 z-50 backdrop-blur-xl">
        <div className="flex items-center w-full relative">
          {/* Progress Line */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-structure/50 rounded-full z-0 hidden sm:block" />
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full z-0 transition-all duration-500 hidden sm:block"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />

          <div className="flex items-center justify-between w-full relative z-10 overflow-x-auto hide-scrollbar gap-2 sm:gap-0">
            {steps.map((step) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => handleTabClick(step.num)}
                  className={`flex flex-col items-center gap-2 group transition-all shrink-0 sm:shrink min-w-[70px] sm:min-w-0 ${
                    isActive ? 'text-primary scale-110' : isPast ? 'text-text-main hover:text-primary/70' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${
                    isActive ? 'bg-primary border-primary text-white shadow-primary/30' 
                    : isPast ? 'bg-bg-panel border-primary text-primary' 
                    : 'bg-bg-dark border-structure text-text-muted'
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {isPast ? 'check' : step.icon}
                    </span>
                  </div>
                  <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide font-headline whitespace-nowrap ${isActive ? 'text-primary' : ''}`}>
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor Content Area */}
      <form onSubmit={(e) => { e.preventDefault(); saveOrder(false); }} className="space-y-6">
        {currentStep === 1 && <Step1Customer />}
        {currentStep === 2 && <Step2Addresses />}
        {currentStep === 3 && <Step3Services />}
        {currentStep === 4 && <Step4Inventory />}
        {currentStep === 5 && <Step5Summary />}

        {/* Global Save Actions Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-bg-dark/95 backdrop-blur-xl border-t border-structure p-4 z-40 lg:left-64 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)]">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (currentStep > 1) {
                  handleTabClick(currentStep - 1);
                } else {
                  window.history.back();
                }
              }}
              className="px-6 py-2.5 rounded-full font-bold text-sm bg-white/5 border border-structure hover:bg-white/10 text-text-main transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span className="hidden sm:inline">{currentStep === 1 ? 'Zurück' : 'Vorheriger Schritt'}</span>
            </button>
            <div className="flex items-center gap-3">
              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={() => handleTabClick(currentStep + 1)}
                  className="px-6 py-2.5 rounded-full font-bold text-sm bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-white transition-all shadow-sm flex items-center gap-2"
                >
                  <span className="hidden sm:inline">Nächster Schritt</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => saveOrder(false)}
                  className={`px-8 py-3 rounded-full font-bold text-sm shadow-xl transition-all flex items-center gap-2 ${
                    isSaving
                      ? 'bg-primary/50 text-white/50 cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90 text-white hover:scale-105 hover:shadow-primary/30 shadow-primary/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">
                    {isSaving ? 'sync' : 'save'}
                  </span>
                  {isSaving ? 'Speichert...' : 'Entwurf speichern'}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export function OrderEditor({ orderId }: { orderId?: string }) {
  return (
    <OrderErrorBoundary>
      <OrderEditorProvider orderId={orderId}>
        <OrderEditorContent />
      </OrderEditorProvider>
    </OrderErrorBoundary>
  );
}
