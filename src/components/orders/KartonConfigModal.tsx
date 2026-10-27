"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { XMarkIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';

export interface KartonItemConfig {
  qty: number;
  price: number;
}

export interface KartonDetailsState {
  s: KartonItemConfig;
  m: KartonItemConfig;
  l: KartonItemConfig;
  xl: KartonItemConfig;
  buecher: KartonItemConfig;
  kleider: KartonItemConfig;
}

export interface KartonConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingService?: any;
  defaultPrices?: {
    s?: number;
    m?: number;
    l?: number;
    xl?: number;
    buecher?: number;
    kleider?: number;
  };
  onSave: (serviceData: {
    name: string;
    quantity: number;
    unitPrice: number;
    unit: string;
    note: string;
    isKartonService: boolean;
    kartonDetails: KartonDetailsState;
  }) => void;
  onRemove?: () => void;
}

const KARTON_TYPES: {
  key: keyof KartonDetailsState;
  name: string;
  sub: string;
  icon: string;
  defaultPrice: number;
}[] = [
  { key: 's', name: 'Umzugskarton S', sub: 'Klein & handlich (Bücher / Schwergut)', icon: 'inventory_2', defaultPrice: 2.50 },
  { key: 'm', name: 'Umzugskarton M', sub: 'Standard Allrounder (Allzweck ca. 60L)', icon: 'inventory_2', defaultPrice: 3.20 },
  { key: 'l', name: 'Umzugskarton L', sub: 'Groß (Wäsche, Spielzeug, Geschirr)', icon: 'inventory_2', defaultPrice: 3.80 },
  { key: 'xl', name: 'Umzugskarton XL', sub: 'Extra Groß (Kissen, Decken, Leichtgut)', icon: 'inventory_2', defaultPrice: 4.50 },
  { key: 'buecher', name: 'Bücherkarton', sub: 'Verstärkter 2-welliger Doppelboden', icon: 'menu_book', defaultPrice: 3.00 },
  { key: 'kleider', name: 'Kleiderkarton', sub: 'Inkl. stabiler Metall-Kleiderstange', icon: 'checkroom', defaultPrice: 12.00 },
];

export function KartonConfigModal({
  isOpen,
  onClose,
  existingService,
  defaultPrices,
  onSave,
  onRemove
}: KartonConfigModalProps) {
  useModalBackHandler(isOpen, onClose);

  const [details, setDetails] = useState<KartonDetailsState>({
    s: { qty: 0, price: 2.50 },
    m: { qty: 0, price: 3.20 },
    l: { qty: 0, price: 3.80 },
    xl: { qty: 0, price: 4.50 },
    buecher: { qty: 0, price: 3.00 },
    kleider: { qty: 0, price: 12.00 },
  });

  const [billingMode, setBillingMode] = useState<'pauschal' | 'stueck'>('pauschal');

  // Initialize state when modal opens or existingService changes
  useEffect(() => {
    if (!isOpen) return;

    const initial: KartonDetailsState = {
      s: { 
        qty: existingService?.kartonDetails?.s?.qty || 0, 
        price: existingService?.kartonDetails?.s?.price ?? defaultPrices?.s ?? 2.50 
      },
      m: { 
        qty: existingService?.kartonDetails?.m?.qty || 0, 
        price: existingService?.kartonDetails?.m?.price ?? defaultPrices?.m ?? 3.20 
      },
      l: { 
        qty: existingService?.kartonDetails?.l?.qty || 0, 
        price: existingService?.kartonDetails?.l?.price ?? defaultPrices?.l ?? 3.80 
      },
      xl: { 
        qty: existingService?.kartonDetails?.xl?.qty || 0, 
        price: existingService?.kartonDetails?.xl?.price ?? defaultPrices?.xl ?? 4.50 
      },
      buecher: { 
        qty: existingService?.kartonDetails?.buecher?.qty || 0, 
        price: existingService?.kartonDetails?.buecher?.price ?? defaultPrices?.buecher ?? 3.00 
      },
      kleider: { 
        qty: existingService?.kartonDetails?.kleider?.qty || 0, 
        price: existingService?.kartonDetails?.kleider?.price ?? defaultPrices?.kleider ?? 12.00 
      },
    };

    // Initialize with 0 for all items (clean start without hardcoded presets)
    setDetails(initial);
    if (existingService?.unit?.toLowerCase() === 'stk') {
      setBillingMode('stueck');
    } else {
      setBillingMode('pauschal');
    }
  }, [isOpen, existingService, defaultPrices]);

  const updateQty = (key: keyof KartonDetailsState, delta: number) => {
    setDetails(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        qty: Math.max(0, (prev[key]?.qty || 0) + delta)
      }
    }));
  };

  const setQtyDirect = (key: keyof KartonDetailsState, val: number) => {
    setDetails(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        qty: Math.max(0, val)
      }
    }));
  };

  const setPriceDirect = (key: keyof KartonDetailsState, val: number) => {
    setDetails(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        price: Math.max(0, val)
      }
    }));
  };

  // Calculations
  const totalCount = useMemo(() => {
    return Object.values(details).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [details]);

  const totalPrice = useMemo(() => {
    return Object.values(details).reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0);
  }, [details]);

  const itemsBreakdown = useMemo(() => {
    const parts: string[] = [];
    if (details.s.qty > 0) parts.push(`${details.s.qty}x S`);
    if (details.m.qty > 0) parts.push(`${details.m.qty}x M`);
    if (details.l.qty > 0) parts.push(`${details.l.qty}x L`);
    if (details.xl.qty > 0) parts.push(`${details.xl.qty}x XL`);
    if (details.buecher.qty > 0) parts.push(`${details.buecher.qty}x Bücher`);
    if (details.kleider.qty > 0) parts.push(`${details.kleider.qty}x Kleider`);
    return parts;
  }, [details]);

  const generatedNote = useMemo(() => {
    if (totalCount === 0) return 'Keine Kartons ausgewählt.';
    return `Bereitstellung von ${totalCount} Umzugskartons vorab. Enthält: ${itemsBreakdown.join(', ')}.`;
  }, [totalCount, itemsBreakdown]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (totalCount <= 0) {
      if (onRemove && existingService) {
        onRemove();
        onClose();
        return;
      }
    }

    if (billingMode === 'stueck') {
      const avgPrice = totalCount > 0 ? Math.round((totalPrice / totalCount) * 100) / 100 : 0;
      onSave({
        name: 'Umzugskartons & Packmaterial',
        quantity: totalCount,
        unitPrice: avgPrice,
        unit: 'Stk',
        note: generatedNote,
        isKartonService: true,
        kartonDetails: details
      });
    } else {
      onSave({
        name: 'Umzugskartons & Packmaterial',
        quantity: 1,
        unitPrice: Math.round(totalPrice * 100) / 100,
        unit: 'Pauschal',
        note: generatedNote,
        isKartonService: true,
        kartonDetails: details
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-bg-panel border border-structure/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-structure bg-bg-dark/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-headline font-bold text-text-main">
                Umzugskartons konfigurieren
              </h2>
              <p className="text-xs text-text-muted">
                Wähle die Stückzahlen und passe bei Bedarf die Einzelpreise an.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: 6 Box Sizes */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {KARTON_TYPES.map(k => {
              const current = details[k.key] || { qty: 0, price: k.defaultPrice };
              const isSelected = current.qty > 0;
              const subtotal = current.qty * current.price;

              return (
                <div
                  key={k.key}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-amber-500/[0.06] border-amber-500/40 shadow-xs'
                      : 'bg-bg-dark/50 border-structure/60 hover:border-structure'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-amber-500' : 'text-text-muted'}`}>
                        {k.icon}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-text-main block">
                          {k.name}
                        </span>
                        <span className="text-[10px] text-text-muted leading-tight block line-clamp-1">
                          {k.sub}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[11px] font-mono font-bold text-amber-500 shrink-0">
                        {subtotal.toFixed(2)} €
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
                    {/* Quantity Selector */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(k.key, -5)}
                        className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-text-main text-[10px] font-bold transition-colors cursor-pointer"
                        title="-5"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => updateQty(k.key, -1)}
                        className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-text-main text-xs font-bold transition-colors cursor-pointer"
                        title="-1"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={current.qty === 0 ? '' : current.qty}
                        placeholder="0"
                        onChange={e => setQtyDirect(k.key, parseInt(e.target.value, 10) || 0)}
                        className="w-12 h-6 rounded-md bg-black/30 border border-structure/80 text-center text-xs font-bold font-mono text-text-main focus:outline-none focus:border-amber-500/60"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(k.key, 1)}
                        className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-text-main text-xs font-bold transition-colors cursor-pointer"
                        title="+1"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => updateQty(k.key, 5)}
                        className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-text-main text-[10px] font-bold transition-colors cursor-pointer"
                        title="+5"
                      >
                        +5
                      </button>
                    </div>

                    {/* Price Input */}
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        step="0.10"
                        min="0"
                        value={current.price}
                        onChange={e => setPriceDirect(k.key, parseFloat(e.target.value) || 0)}
                        className="w-14 h-6 rounded-md bg-black/20 border border-structure/60 text-right pr-1 text-xs font-medium font-mono text-text-muted focus:text-text-main focus:outline-none focus:border-amber-500/60"
                        title="Einzelpreis pro Stück Netto"
                      />
                      <span className="text-[10px] text-text-muted">€/Stk</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Note Preview & Billing Mode */}
          <div className="mt-4 p-3.5 rounded-2xl bg-bg-dark border border-structure/60 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Angebot-Vorschau (Wird in Angebot-Position gedruckt)
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-text-muted text-[10px]">Abrechnung:</span>
                <button
                  type="button"
                  onClick={() => setBillingMode('pauschal')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                    billingMode === 'pauschal' ? 'bg-primary text-white shadow-xs' : 'bg-white/[0.04] text-text-muted hover:text-text-main'
                  }`}
                >
                  Pauschal
                </button>
                <button
                  type="button"
                  onClick={() => setBillingMode('stueck')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                    billingMode === 'stueck' ? 'bg-primary text-white shadow-xs' : 'bg-white/[0.04] text-text-muted hover:text-text-main'
                  }`}
                >
                  Nach Stück
                </button>
              </div>
            </div>
            <p className="text-xs text-text-main font-mono bg-black/20 p-2.5 rounded-xl border border-white/[0.03]">
              {generatedNote}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-structure bg-bg-dark/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-text-muted font-bold">Summe Kartons:</span>
            <span className="text-lg font-extrabold font-headline text-text-main">
              {totalCount} Stk.
            </span>
            <span className="text-xs text-text-muted">•</span>
            <span className="text-lg font-extrabold font-headline text-amber-500">
              {totalPrice.toFixed(2)} €
            </span>
            <span className="text-[10px] text-text-muted">Netto</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {existingService && onRemove && (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-all flex items-center gap-1 cursor-pointer"
                title="Position komplett aus Angebot entfernen"
              >
                <TrashIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Entfernen</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main bg-white/[0.04] hover:bg-white/[0.08] border border-structure transition-all cursor-pointer"
            >
              Abbrechen
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckIcon className="w-4 h-4" />
              <span>Übernehmen ({totalCount} Stk.)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
