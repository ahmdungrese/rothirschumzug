"use client";

import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

interface CustomerFastOfferEditorProps {
  order: any;
  onSaveSuccess?: () => void;
  onClose?: () => void;
}

export function CustomerFastOfferEditor({ order, onSaveSuccess, onClose }: CustomerFastOfferEditorProps) {
  // Service Toggles and Prices
  const [hasTransport, setHasTransport] = useState(true);
  const [transportPrice, setTransportPrice] = useState<number>(order.transportPrice || 850);

  const [hasMontage, setHasMontage] = useState(false);
  const [montagePrice, setMontagePrice] = useState<number>(order.montagePrice || 250);

  const [hasPackservice, setHasPackservice] = useState(false);
  const [packservicePrice, setPackservicePrice] = useState<number>(order.packservicePrice || 180);

  const [hasHVZ, setHasHVZ] = useState(false);
  const [hvzPrice, setHvzPrice] = useState<number>(order.hvzPrice || 120);

  const [hasMoebellift, setHasMoebellift] = useState(false);
  const [moebelliftPrice, setMoebelliftPrice] = useState<number>(order.moebelliftPrice || 150);

  const [hasLagerung, setHasLagerung] = useState(false);
  const [lagerungPrice, setLagerungPrice] = useState<number>(order.lagerungPrice || 100);

  // Simplified Truck / Volume Estimation
  const [truckChoice, setTruckChoice] = useState<'1_transporter' | '1_lkw' | '2_lkw' | 'custom'>(
    order.truckChoice || '1_lkw'
  );
  const [estimatedCbm, setEstimatedCbm] = useState<number>(order.estimatedCbm || 30);

  // External / Manual Signature
  const [isManuallySigned, setIsManuallySigned] = useState<boolean>(
    !!(order.isManuallySigned || order.signatures?.customer)
  );

  const [isSaving, setIsSaving] = useState(false);

  // Initialize from order data if available
  useEffect(() => {
    if (order) {
      if (order.services) {
        setHasMontage(!!(order.services.montage || order.services.demontage));
        if (order.services.montagePrice) setMontagePrice(order.services.montagePrice);

        setHasPackservice(!!order.services.packservice);
        if (order.services.packservicePrice) setPackservicePrice(order.services.packservicePrice);

        setHasHVZ(!!order.services.halteverbot);
        if (order.services.hvzPrice) setHvzPrice(order.services.hvzPrice);

        setHasMoebellift(!!order.services.moebellift);
        if (order.services.moebelliftPrice) setMoebelliftPrice(order.services.moebelliftPrice);

        setHasLagerung(!!order.services.lagerung);
        if (order.services.lagerungPrice) setLagerungPrice(order.services.lagerungPrice);
      }
    }
  }, [order]);

  // Calculate live financial totals
  const calculateNet = () => {
    let sum = 0;
    if (hasTransport) sum += Number(transportPrice) || 0;
    if (hasMontage) sum += Number(montagePrice) || 0;
    if (hasPackservice) sum += Number(packservicePrice) || 0;
    if (hasHVZ) sum += Number(hvzPrice) || 0;
    if (hasMoebellift) sum += Number(moebelliftPrice) || 0;
    if (hasLagerung) sum += Number(lagerungPrice) || 0;
    return sum;
  };

  const netTotal = calculateNet();
  const taxTotal = Math.round(netTotal * 0.19 * 100) / 100;
  const grossTotal = Math.round((netTotal + taxTotal) * 100) / 100;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      
      const updatedServices = {
        ...(order.services || {}),
        transport: hasTransport,
        transportPrice,
        montage: hasMontage,
        demontage: hasMontage,
        montagePrice,
        packservice: hasPackservice,
        packservicePrice,
        halteverbot: hasHVZ,
        hvzPrice,
        moebellift: hasMoebellift,
        moebelliftPrice,
        lagerung: hasLagerung,
        lagerungPrice,
      };

      const updatedTotals = {
        net: netTotal,
        tax: taxTotal,
        gross: grossTotal,
      };

      const updatePayload: any = {
        services: updatedServices,
        totals: updatedTotals,
        truckChoice,
        estimatedCbm,
        isManuallySigned,
        status: isManuallySigned && order.status === 'draft' ? 'confirmed' : (order.status || 'quote'),
        updatedAt: new Date(),
      };

      await updateDoc(orderRef, updatePayload);
      toast.success('Angebot & Leistungen erfolgreich aktualisiert!');
      if (onSaveSuccess) onSaveSuccess();
      if (onClose) onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Fehler beim Speichern: ' + (err.message || 'Unbekannt'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-headline font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">tune</span>
            Leistungen & Angebot anpassen
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Leistungen mit einem Klick aktivieren/deaktivieren. Preise berechnen sich sofort neu.
          </p>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* Services Grid (Toggles) */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
          1. Enthaltene Leistungen (Toggles)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Basis Transport */}
          <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
            hasTransport ? 'bg-primary/5 border-primary/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
          }`}>
            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
              <input 
                type="checkbox" 
                checked={hasTransport} 
                onChange={(e) => setHasTransport(e.target.checked)}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-slate-300"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">Basis-Umzug (Transport)</span>
                <span className="text-[11px] text-slate-500">LKW & Träger für Be- und Entladung</span>
              </div>
            </label>
            <div className="flex items-center gap-1 w-28">
              <input 
                type="number" 
                value={transportPrice}
                onChange={(e) => setTransportPrice(Number(e.target.value))}
                disabled={!hasTransport}
                className="w-full text-right px-2 py-1 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <span className="text-xs font-bold text-slate-500">€</span>
            </div>
          </div>

          {/* Montage & Demontage */}
          <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
            hasMontage ? 'bg-primary/5 border-primary/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
          }`}>
            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
              <input 
                type="checkbox" 
                checked={hasMontage} 
                onChange={(e) => setHasMontage(e.target.checked)}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-slate-300"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">De- & Remontage</span>
                <span className="text-[11px] text-slate-500">Möbel abbauen und wieder aufbauen</span>
              </div>
            </label>
            <div className="flex items-center gap-1 w-28">
              <input 
                type="number" 
                value={montagePrice}
                onChange={(e) => setMontagePrice(Number(e.target.value))}
                disabled={!hasMontage}
                className="w-full text-right px-2 py-1 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <span className="text-xs font-bold text-slate-500">€</span>
            </div>
          </div>

          {/* Packservice */}
          <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
            hasPackservice ? 'bg-primary/5 border-primary/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
          }`}>
            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
              <input 
                type="checkbox" 
                checked={hasPackservice} 
                onChange={(e) => setHasPackservice(e.target.checked)}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-slate-300"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">Packservice</span>
                <span className="text-[11px] text-slate-500">Einpacken & Auspacken von Kartons</span>
              </div>
            </label>
            <div className="flex items-center gap-1 w-28">
              <input 
                type="number" 
                value={packservicePrice}
                onChange={(e) => setPackservicePrice(Number(e.target.value))}
                disabled={!hasPackservice}
                className="w-full text-right px-2 py-1 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <span className="text-xs font-bold text-slate-500">€</span>
            </div>
          </div>

          {/* Halteverbotszone (HVZ) */}
          <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
            hasHVZ ? 'bg-primary/5 border-primary/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
          }`}>
            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
              <input 
                type="checkbox" 
                checked={hasHVZ} 
                onChange={(e) => setHasHVZ(e.target.checked)}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-slate-300"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">Halteverbotszone (HVZ)</span>
                <span className="text-[11px] text-slate-500">Genehmigung & Schilder aufstellen</span>
              </div>
            </label>
            <div className="flex items-center gap-1 w-28">
              <input 
                type="number" 
                value={hvzPrice}
                onChange={(e) => setHvzPrice(Number(e.target.value))}
                disabled={!hasHVZ}
                className="w-full text-right px-2 py-1 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <span className="text-xs font-bold text-slate-500">€</span>
            </div>
          </div>

          {/* Möbellift */}
          <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
            hasMoebellift ? 'bg-primary/5 border-primary/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
          }`}>
            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
              <input 
                type="checkbox" 
                checked={hasMoebellift} 
                onChange={(e) => setHasMoebellift(e.target.checked)}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-slate-300"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">Möbellift / Außenaufzug</span>
                <span className="text-[11px] text-slate-500">Für hohe Etagen ohne Fahrstuhl</span>
              </div>
            </label>
            <div className="flex items-center gap-1 w-28">
              <input 
                type="number" 
                value={moebelliftPrice}
                onChange={(e) => setMoebelliftPrice(Number(e.target.value))}
                disabled={!hasMoebellift}
                className="w-full text-right px-2 py-1 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <span className="text-xs font-bold text-slate-500">€</span>
            </div>
          </div>

          {/* Lagerung */}
          <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
            hasLagerung ? 'bg-primary/5 border-primary/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
          }`}>
            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
              <input 
                type="checkbox" 
                checked={hasLagerung} 
                onChange={(e) => setHasLagerung(e.target.checked)}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-slate-300"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">Zwischenlagerung</span>
                <span className="text-[11px] text-slate-500">Möbellagerung pro Monat</span>
              </div>
            </label>
            <div className="flex items-center gap-1 w-28">
              <input 
                type="number" 
                value={lagerungPrice}
                onChange={(e) => setLagerungPrice(Number(e.target.value))}
                disabled={!hasLagerung}
                className="w-full text-right px-2 py-1 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <span className="text-xs font-bold text-slate-500">€</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Simplified Truck & Volume Selection */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
          2. Fuhrpark & Volumen (Praxisnahe Schnell-Auswahl)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: '1_transporter', label: '1x Sprinter 3.5t', desc: '~15-20 m³' },
            { id: '1_lkw', label: '1x LKW 7.5t', desc: '~35 m³' },
            { id: '2_lkw', label: '2x Fahrzeuge', desc: '~60 m³' },
            { id: 'custom', label: 'Individuell', desc: 'Manuelle Angabe' },
          ].map((truck) => (
            <button
              key={truck.id}
              type="button"
              onClick={() => setTruckChoice(truck.id as any)}
              className={`p-3 rounded-xl border text-left transition-all ${
                truckChoice === truck.id 
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm' 
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="text-xs font-bold">{truck.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{truck.desc}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Geschätztes Volumen (nach Fotos/Erfahrung):
          </label>
          <div className="flex items-center gap-1.5 w-32">
            <input 
              type="number" 
              value={estimatedCbm}
              onChange={(e) => setEstimatedCbm(Number(e.target.value))}
              className="w-full text-center py-1 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <span className="text-xs font-bold text-slate-500">m³</span>
          </div>
        </div>
      </div>

      {/* 3. External / WhatsApp Signature Toggle */}
      <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600 text-2xl">verified</span>
          <div>
            <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200 block">
              Vertragsbestätigung (Manuell / Extern unterschrieben)
            </span>
            <span className="text-xs text-emerald-700/80 dark:text-emerald-400">
              Kunde hat per WhatsApp/Mail zugesagt oder den Ausdruck unterschrieben zurückgesendet.
            </span>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input 
            type="checkbox" 
            checked={isManuallySigned}
            onChange={(e) => setIsManuallySigned(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* Financial Summary & Save Bar */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Netto</span>
            <span className="text-lg font-bold text-slate-800 dark:text-slate-200">€{netTotal.toLocaleString('de-DE')}</span>
          </div>
          <span className="text-slate-300 font-bold">+</span>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">19% MwSt</span>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">€{taxTotal.toLocaleString('de-DE')}</span>
          </div>
          <span className="text-slate-300 font-bold">=</span>
          <div className="bg-primary/10 px-4 py-1.5 rounded-2xl border border-primary/20">
            <span className="text-[10px] uppercase font-bold text-primary block">Gesamtpreis Brutto</span>
            <span className="text-2xl font-extrabold text-primary font-headline">€{grossTotal.toLocaleString('de-DE')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary py-3 px-8 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/40 flex items-center gap-2 w-full sm:w-auto"
        >
          {isSaving ? (
            <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-base">check_circle</span>
          )}
          <span>Angebot jetzt speichern</span>
        </button>
      </div>
    </div>
  );
}
