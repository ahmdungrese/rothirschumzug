"use client";

import React, { useState } from 'react';
import { calculateOrderTotals, calculateTotalPaid, calculateOpenAmount } from '@/lib/financeHelpers';
import { evaluateOrderLogistics } from '@/lib/orderValidation';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { useRouter } from 'next/navigation';
import { calculateRoute } from '@/lib/routeCalculator';

interface CustomerPremiumProfileProps {
  customer: any;
  orders: any[];
  onEditCustomer: () => void;
  onOpenMessageModal: (order: any) => void;
  onOpenPaymentModal: (order: any) => void;
  onOpenProtocolModal: (order: any) => void;
  onOpenDispoModal: (order: any) => void;
  onOpenSignatureModal?: (order: any) => void;
  onViewPdf: (order: any, type: string) => void;
  onRefresh?: () => void;
}

export function CustomerPremiumProfile({
  customer,
  orders,
  onEditCustomer,
  onOpenMessageModal,
  onOpenPaymentModal,
  onOpenProtocolModal,
  onOpenDispoModal,
  onOpenSignatureModal,
  onViewPdf,
  onRefresh,
}: CustomerPremiumProfileProps) {
  const router = useRouter();
  const [isUpdatingChecklist, setIsUpdatingChecklist] = useState(false);
  const [checklistGuidanceItem, setChecklistGuidanceItem] = useState<any>(null);

  // Active or newest order
  const activeOrder = orders.find(o => o.status !== 'archived') || orders[0] || null;

  // Logistics & Route extraction
  const orderLogistics = activeOrder?.logistics || {};
  const aStreet = orderLogistics.a_street || orderLogistics.from?.street || orderLogistics.auszug?.street || '';
  const aHouseNr = orderLogistics.a_houseNr || orderLogistics.from?.houseNr || orderLogistics.auszug?.houseNr || '';
  const aZip = orderLogistics.a_zip || orderLogistics.from?.zip || orderLogistics.auszug?.zip || '';
  const aCity = orderLogistics.a_city || orderLogistics.from?.city || orderLogistics.auszug?.city || '';
  const aFloor = orderLogistics.a_floor || orderLogistics.from?.floor || '';
  const aElevator = orderLogistics.a_elevator ?? orderLogistics.from?.hasElevator;
  const aAddressFull = `${aStreet} ${aHouseNr}, ${aZip} ${aCity}`.trim().replace(/^,\s*|,\s*$/g, '');
  const hasA = Boolean(aStreet || aCity);

  const bStreet = orderLogistics.b_street || orderLogistics.to?.street || orderLogistics.einzug?.street || '';
  const bHouseNr = orderLogistics.b_houseNr || orderLogistics.to?.houseNr || orderLogistics.einzug?.houseNr || '';
  const bZip = orderLogistics.b_zip || orderLogistics.to?.zip || orderLogistics.einzug?.zip || '';
  const bCity = orderLogistics.b_city || orderLogistics.to?.city || orderLogistics.einzug?.city || '';
  const bFloor = orderLogistics.b_floor || orderLogistics.to?.floor || '';
  const bElevator = orderLogistics.b_elevator ?? orderLogistics.to?.hasElevator;
  const bAddressFull = `${bStreet} ${bHouseNr}, ${bZip} ${bCity}`.trim().replace(/^,\s*|,\s*$/g, '');
  const hasB = Boolean(bStreet || bCity);

  const bothAddressesPresent = hasA && hasB;
  const googleMapsRouteUrl = bothAddressesPresent 
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(aAddressFull)}&destination=${encodeURIComponent(bAddressFull)}` 
    : null;

  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number, durationMinutes: number } | null>(
    activeOrder?.routeInfo || activeOrder?.logistics?.routeInfo || null
  );

  const handleCalculateRoute = async () => {
    if (!hasA || !hasB) {
      toast.error('Bitte zuerst Beladestelle und Entladestelle im Angebot eintragen.');
      return;
    }

    setIsCalculatingRoute(true);
    try {
      const res = await calculateRoute(aAddressFull, bAddressFull);
      if (res) {
        setRouteInfo(res);
        if (activeOrder?.id) {
          const orderRef = doc(db, 'orders', activeOrder.id);
          await updateDoc(orderRef, {
            'routeInfo': res,
            'logistics.routeInfo': res,
            'logistics.distanceKm': res.distanceKm
          });
        }
        toast.success(`Route berechnet: ${res.distanceKm} km (ca. ${res.durationMinutes} Min)`);
      } else {
        toast.error('Route konnte nicht automatisch berechnet werden. Bitte Adressen prüfen.');
      }
    } catch (err) {
      toast.error('Fehler bei der Routenberechnung.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Name formatting
  const fullName = customer 
    ? `${customer.salutation ? customer.salutation + ' ' : ''}${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.company || 'Kunde ohne Name'
    : 'Kunde';

  // Logistics & finance evaluation
  const totals = activeOrder ? calculateOrderTotals(activeOrder) : { net: 0, tax: 0, gross: 0 };
  const totalPaid = activeOrder ? calculateTotalPaid(activeOrder) : 0;
  const openAmount = activeOrder ? calculateOpenAmount(activeOrder) : 0;
  const logisticsEval = activeOrder ? evaluateOrderLogistics(activeOrder, customer) : null;

  // Checklist items
  const checklist = logisticsEval?.checklist || [];
  const completedCount = checklist.filter(c => c.done).length;

  // Handle checklist item click
  const handleChecklistClick = (item: any) => {
    // Address completeness requires form entry in the editor
    if (item.id === 'address') {
      if (!item.done) {
        setChecklistGuidanceItem(item);
      } else {
        toast('Adressen sind vollständig im Formular erfasst.', { icon: '✅' });
      }
      return;
    }

    // Operational items & signature toggle directly
    toggleManualItem(item.id, item.done);
  };

  // Toggle manual checklist item status in Firebase
  const toggleManualItem = async (itemId: string, currentVal: boolean) => {
    if (!activeOrder || isUpdatingChecklist) return;
    setIsUpdatingChecklist(true);

    try {
      const orderRef = doc(db, 'orders', activeOrder.id);
      const updateData: any = {};
      let message = 'Status aktualisiert';

      if (itemId === 'signature') {
        const next = !currentVal;
        updateData['status'] = next ? 'confirmed' : 'quote';
        updateData['isManuallySigned'] = next;
        updateData['contractSigned'] = next;
        updateData['updatedAt'] = new Date();
        message = next ? 'Auftrag bestätigt (Status: Bestätigt)' : 'Auftrag zurück auf "In Verhandlung" gesetzt';
      } else if (itemId === 'hvz') {
        const next = !currentVal;
        updateData['logistics.hvzConfirmed'] = next;
        updateData['checklistDone.hvz'] = next;
        message = next ? 'Halteverbot (HVZ) als erledigt markiert' : 'Halteverbot (HVZ) als ausstehend markiert';
      } else if (itemId === 'kartons') {
        const next = !currentVal;
        updateData['logistics.boxesDelivered'] = next;
        updateData['checklistDone.kartons'] = next;
        message = next ? 'Kartons als geliefert markiert' : 'Kartons als ausstehend markiert';
      } else if (itemId === 'moebellift') {
        const next = !currentVal;
        updateData['logistics.liftReserved'] = next;
        updateData['checklistDone.moebellift'] = next;
        message = next ? 'Möbellift als reserviert markiert' : 'Möbellift als ausstehend markiert';
      }

      await updateDoc(orderRef, updateData);
      toast.success(message);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setIsUpdatingChecklist(false);
    }
  };

  // Dynamic next step logic based on order status
  const getNextStep = () => {
    if (!activeOrder) {
      return {
        title: 'Erstes Angebot erstellen',
        desc: 'Für diesen Kunden wurde noch kein Umzugsangebot angelegt.',
        btnText: 'Angebot jetzt anlegen',
        action: () => router.push(`/dashboard/customers/${customer.id}/new-order`)
      };
    }
    if (activeOrder.status === 'draft') {
      return {
        title: 'Angebot fertigstellen & versenden',
        desc: 'Dieser Auftrag ist als "Entwurf" gespeichert. Schließen Sie die Kalkulation ab und senden Sie das Angebot an den Kunden.',
        btnText: 'Entwurf öffnen / Angebot versenden',
        action: () => router.push(`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`)
      };
    }
    if (!logisticsEval?.angebotStatus.isSigned) {
      return {
        title: 'Vertragsbestätigung einholen',
        desc: 'Angebot liegt beim Kunden. Bestätigung digital oder per Unterschrift erfassen.',
        btnText: 'Vertrag bestätigen / signieren',
        action: () => onOpenSignatureModal ? onOpenSignatureModal(activeOrder) : router.push(`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`)
      };
    }
    if (!logisticsEval?.isComplete) {
      return {
        title: 'Logistik & Halteverbot vorbereiten',
        desc: 'Offene Punkte in der Checkliste (z.B. HVZ oder Kartons) finalisieren.',
        btnText: 'Planung öffnen',
        action: () => onOpenDispoModal(activeOrder)
      };
    }
    if (activeOrder.status === 'confirmed') {
      return {
        title: 'Umzug durchführen & Laufzettel drucken',
        desc: 'Alle Vorbereitungen abgeschlossen. Teamleiter-Laufzettel bereit.',
        btnText: 'Laufzettel drucken',
        action: () => onViewPdf(activeOrder, 'employee')
      };
    }
    return {
      title: 'Rechnung erstellen & abschließen',
      desc: 'Umzug erledigt. Schlussrechnung für die Buchhaltung generieren.',
      btnText: 'Rechnung generieren',
      action: () => onViewPdf(activeOrder, 'invoice')
    };
  };

  const nextStep = getNextStep();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1.5 font-headline">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeOrder?.status === 'confirmed' ? 'Aktiver Umzug' : 'Kundenprofil'}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Kunden-ID: #{customer?.id?.slice(-5).toUpperCase() || 'KD'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-headline tracking-tight">
            {fullName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onEditCustomer}
            className="px-4 py-2.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            Daten bearbeiten
          </button>

          {activeOrder && (
            <Link
              href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
              className="px-5 py-2.5 rounded-full font-bold text-xs bg-[#D91E2A] hover:bg-[#b51822] text-white shadow-md shadow-[#D91E2A]/25 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">edit_document</span>
              Angebot bearbeiten
            </Link>
          )}

          <Link
            href={`/dashboard/customers/${customer.id}/new-order`}
            className="btn-secondary py-2.5 px-5 rounded-full font-bold text-xs flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Neues Angebot
          </Link>
        </div>
      </div>

      {/* 5 Quick Action Circular Cards */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
            Schnellaktionen (Quick Actions)
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {/* 1. Nachricht senden */}
          <button
            type="button"
            onClick={() => onOpenMessageModal(activeOrder)}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-lg transition-all group flex flex-col items-center text-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
              <span className="material-symbols-outlined text-2xl">mail</span>
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
              Nachricht senden
            </span>
          </button>

          {/* 2. Zahlung erfassen */}
          <button
            type="button"
            onClick={() => onOpenPaymentModal(activeOrder)}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-lg transition-all group flex flex-col items-center text-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
              Zahlung erfassen
            </span>
          </button>

          {/* 3. Protokoll erstellen */}
          <button
            type="button"
            onClick={() => onOpenProtocolModal(activeOrder)}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-lg transition-all group flex flex-col items-center text-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
              <span className="material-symbols-outlined text-2xl">assignment_turned_in</span>
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
              Protokoll erstellen
            </span>
          </button>

          {/* 4. Laufzettel drucken */}
          <button
            type="button"
            onClick={() => onViewPdf(activeOrder, 'employee')}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-lg transition-all group flex flex-col items-center text-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
              <span className="material-symbols-outlined text-2xl">print</span>
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
              Laufzettel drucken
            </span>
          </button>

          {/* 5. Rechnung generieren */}
          <Link
            href={activeOrder ? `/dashboard/customers/${customer.id}/edit-invoice/${activeOrder.id}` : '#'}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-lg transition-all group flex flex-col items-center text-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
              Rechnung erstellen
            </span>
          </Link>
        </div>
      </section>

      {/* Main Content Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Metrics + Operative Checklist */}
        <div className="lg:col-span-7 space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Financial Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-primary shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                  Finanzen
                </span>
                <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-headline">
                  €{totals.gross.toLocaleString('de-DE')}
                </span>
                <span className="text-xs font-semibold text-slate-400">Gesamt</span>
              </div>
              <div className="pt-2 flex items-center gap-2">
                {openAmount > 0 ? (
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    €{openAmount.toLocaleString('de-DE')} Ausstehend
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Vollständig bezahlt
                  </span>
                )}
              </div>
            </div>

            {/* Logistics Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-blue-500 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                  Umzugstermin & Route
                </span>
                <span className="material-symbols-outlined text-blue-500">local_shipping</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-headline">
                {logisticsEval?.movingDateDisplay || 'Kein Datum'}
              </div>
              <div className="pt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="material-symbols-outlined text-sm text-blue-500">near_me</span>
                  <span className="truncate">{logisticsEval?.routeDisplay || 'Keine Route'}</span>
                </span>
                {(orderLogistics.estimatedVolume || activeOrder?.estimatedCbm) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                    {orderLogistics.estimatedVolume || activeOrder?.estimatedCbm} m³
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Full Logistics: Beladestelle, Entladestelle & Route berechnen */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">route</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white">
                    Logistik: Beladestelle & Entladestelle
                  </h3>
                  <p className="text-xs text-slate-400">
                    Auszugs- und Einzugsadressen inkl. Etagen & Routenberechnung
                  </p>
                </div>
              </div>

              {/* Route Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCalculateRoute}
                  disabled={isCalculatingRoute || !bothAddressesPresent}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
                >
                  <span className="material-symbols-outlined text-base">
                    {isCalculatingRoute ? 'sync' : 'straighten'}
                  </span>
                  <span>{isCalculatingRoute ? 'Berechne...' : 'Route berechnen'}</span>
                </button>

                {googleMapsRouteUrl ? (
                  <a
                    href={googleMapsRouteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                    title="Google Maps Routenplanung öffnen"
                  >
                    <span className="material-symbols-outlined text-base text-[#D91E2A]">pin_drop</span>
                    <span>Auf Maps öffnen</span>
                  </a>
                ) : null}
              </div>
            </div>

            {/* Route Result Banner if calculated */}
            {routeInfo && (
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2 font-bold flex-wrap">
                  <span className="material-symbols-outlined text-blue-600">local_shipping</span>
                  <span>Strecke: {routeInfo.distanceKm} km</span>
                  <span className="text-blue-500">•</span>
                  <span>Fahrzeit: ca. {Math.floor(routeInfo.durationMinutes / 60) > 0 ? `${Math.floor(routeInfo.durationMinutes / 60)} Std. ` : ''}{routeInfo.durationMinutes % 60} Min.</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-500/20 px-2 py-0.5 rounded">
                  OSRM Berechnet
                </span>
              </div>
            )}

            {/* Address Grid: Beladestelle (A) & Entladestelle (B) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Beladestelle (Auszug) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1 font-headline">
                    <span className="material-symbols-outlined text-base">home_pin</span>
                    Beladestelle (Auszug A)
                  </span>
                  {hasA ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Erfasst
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">warning</span>
                      Nicht erfasst
                    </span>
                  )}
                </div>

                {hasA ? (
                  <div className="space-y-1.5">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {aStreet ? `${aStreet} ${aHouseNr}` : 'Straße ohne Hausnummer'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {aZip} {aCity}
                    </p>
                    <div className="pt-1 flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Etage: {aFloor || 'EG / k.A.'}</span>
                      <span>•</span>
                      <span>Aufzug: {aElevator ? 'Ja' : 'Nein'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center space-y-2">
                    <p className="text-xs text-slate-400 italic">
                      Noch keine Beladestelle eingetragen.
                    </p>
                    {activeOrder && (
                      <Link
                        href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                      >
                        <span className="material-symbols-outlined text-xs">add_location</span>
                        <span>Beladestelle jetzt eintragen</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Entladestelle (Einzug) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-headline">
                    <span className="material-symbols-outlined text-base">where_to_vote</span>
                    Entladestelle (Einzug B)
                  </span>
                  {hasB ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Erfasst
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">warning</span>
                      Nicht erfasst
                    </span>
                  )}
                </div>

                {hasB ? (
                  <div className="space-y-1.5">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {bStreet ? `${bStreet} ${bHouseNr}` : 'Straße ohne Hausnummer'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {bZip} {bCity}
                    </p>
                    <div className="pt-1 flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Etage: {bFloor || 'EG / k.A.'}</span>
                      <span>•</span>
                      <span>Aufzug: {bElevator ? 'Ja' : 'Nein'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center space-y-2">
                    <p className="text-xs text-slate-400 italic">
                      Noch keine Entladestelle eingetragen.
                    </p>
                    {activeOrder && (
                      <Link
                        href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                      >
                        <span className="material-symbols-outlined text-xs">add_location</span>
                        <span>Entladestelle jetzt eintragen</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Helper banner if both or either is missing */}
            {!bothAddressesPresent && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-amber-600 shrink-0">info</span>
                  <span>Die Route und Kilometer werden berechnet, sobald Beladestelle und Entladestelle im Formular hinterlegt sind.</span>
                </span>
                {activeOrder && (
                  <Link
                    href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                    className="font-bold text-primary hover:underline shrink-0 flex items-center gap-1"
                  >
                    <span>Im Angebot erfassen</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Operative Checklist */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white">
                  Operative Logistik-Checkliste
                </h3>
                <p className="text-xs text-slate-400">Aufgaben und Planung für diesen Umzug (Bedarfsgesteuert)</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary font-headline">
                {completedCount}/{checklist.length} Erledigt
              </span>
            </div>
            <div className="space-y-2.5">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleChecklistClick(item)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer select-none group ${
                    item.done
                      ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      : item.isAutomated
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-300 dark:border-amber-700/60 shadow-sm hover:border-primary hover:shadow-md'
                        : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700/50 shadow-sm hover:border-primary hover:shadow-md'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    item.done 
                      ? 'bg-emerald-500 text-white shadow-sm' 
                      : item.isAutomated
                        ? 'border-2 border-dashed border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                        : 'border-2 border-slate-300 dark:border-slate-600 text-transparent group-hover:border-primary'
                  }`}>
                    <span className="material-symbols-outlined text-base">
                      {item.done ? 'check' : item.isAutomated ? 'edit_note' : 'check'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-sm ${
                        item.done 
                          ? 'line-through text-slate-400 dark:text-slate-500' 
                          : 'text-slate-800 dark:text-slate-200 group-hover:text-primary'
                      }`}>
                        {item.label}
                      </span>
                      {item.isAutomated && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          Formular
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                      {item.done 
                        ? (item.isAutomated ? 'Automatisch geprüft & vollständig' : 'Erledigt')
                        : (item.missingReason || (item.isAutomated ? 'Wird automatisch geprüft (Klicken zum Ausfüllen)' : 'Ausstehend (Klicken zum Umschalten)'))}
                    </span>
                  </div>

                  {!item.done && (item.isAutomated || (!hasA && !hasB)) ? (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 group-hover:bg-primary group-hover:text-white px-3 py-1.5 rounded-xl transition-all shrink-0">
                      <span>Ausfüllen</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                  ) : !item.done ? (
                    <span className="material-symbols-outlined text-amber-500 text-sm shrink-0">
                      pending
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-emerald-500 text-base shrink-0">
                      verified
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Hero "Nächster Schritt" + Contact Info */}
        <div className="lg:col-span-5 space-y-6">
          {/* Hero Next Step Card with 5-Phases Pipeline */}
          <div className="bg-primary text-white p-6 md:p-8 rounded-3xl shadow-xl shadow-primary/20 relative overflow-hidden space-y-6">
            <div className="relative z-10 space-y-6">
              
              {/* 5-Phasen Pipeline Visualisierung */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/70">
                  <span>Auftrags-Pipeline (5 Phasen)</span>
                </div>
                <div className="flex items-center justify-between relative">
                  {/* Background Line */}
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/20 -translate-y-1/2 rounded-full z-0"></div>
                  
                  {/* Phase 1: Entwurf */}
                  <div className="relative z-10 flex flex-col items-center gap-1 group" title="Phase 1: Datenerfassung & Entwurf">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${!activeOrder || activeOrder.status === 'draft' ? 'bg-white text-primary border-white scale-110 shadow-lg' : 'bg-primary border-white text-white'}`}>
                      1
                    </div>
                  </div>

                  {/* Phase 2: Angebot */}
                  <div className="relative z-10 flex flex-col items-center gap-1 group" title="Phase 2: Angebot versendet / Warten auf Antwort">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${activeOrder && ['quote', 'clarification'].includes(activeOrder.status) ? 'bg-white text-primary border-white scale-110 shadow-lg' : activeOrder && ['confirmed', 'completed', 'invoice_open', 'invoice_paid'].includes(activeOrder.status) ? 'bg-primary border-white text-white' : 'bg-primary border-white/40 text-white/40'}`}>
                      2
                    </div>
                  </div>

                  {/* Phase 3: Bestätigt */}
                  <div className="relative z-10 flex flex-col items-center gap-1 group" title="Phase 3: Auftrag bestätigt">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${activeOrder?.status === 'confirmed' && !logisticsEval?.isComplete ? 'bg-white text-primary border-white scale-110 shadow-lg' : activeOrder && ['confirmed', 'completed', 'invoice_open', 'invoice_paid'].includes(activeOrder.status) && logisticsEval?.isComplete ? 'bg-primary border-white text-white' : 'bg-primary border-white/40 text-white/40'}`}>
                      3
                    </div>
                  </div>

                  {/* Phase 4: Logistik & Umzug */}
                  <div className="relative z-10 flex flex-col items-center gap-1 group" title="Phase 4: Operative Logistik bereit">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${activeOrder?.status === 'confirmed' && logisticsEval?.isComplete ? 'bg-white text-primary border-white scale-110 shadow-lg' : activeOrder && ['completed', 'invoice_open', 'invoice_paid'].includes(activeOrder.status) ? 'bg-primary border-white text-white' : 'bg-primary border-white/40 text-white/40'}`}>
                      4
                    </div>
                  </div>

                  {/* Phase 5: Abschluss */}
                  <div className="relative z-10 flex flex-col items-center gap-1 group" title="Phase 5: Abgeschlossen & Rechnungsstellung">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${activeOrder && ['completed', 'invoice_open', 'invoice_paid'].includes(activeOrder.status) ? 'bg-white text-primary border-white scale-110 shadow-lg' : 'bg-primary border-white/40 text-white/40'}`}>
                      5
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/20 pt-4"></div>

              {/* Action Box */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/80 font-headline">
                  Nächster Schritt in Pipeline
                </span>
              </div>

              <h3 className="text-2xl font-bold font-headline leading-snug">
                {nextStep.title}
              </h3>
              <p className="text-xs text-white/80 leading-relaxed">
                {nextStep.desc}
              </p>

              {/* Action Button */}
              <button
                type="button"
                onClick={nextStep.action}
                className="w-full py-4 px-6 rounded-full bg-white text-primary font-extrabold text-sm hover:bg-white/90 transition-all shadow-lg flex items-center justify-center gap-2 group"
              >
                {nextStep.btnText}
                <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>

          {/* Contact Details Card */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white">
              Kontaktdaten
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <span className="material-symbols-outlined text-primary text-xl">phone</span>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Telefon</span>
                  <a href={`tel:${customer?.phone}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-primary">
                    {customer?.phone || 'Keine Telefonnummer'}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <span className="material-symbols-outlined text-primary text-xl">mail</span>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">E-Mail</span>
                  <a href={`mailto:${customer?.email}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-primary">
                    {customer?.email || 'Keine E-Mail-Adresse'}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <span className="material-symbols-outlined text-primary text-xl">home</span>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Adresse</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {customer?.street ? `${customer.street}, ${customer.zip || ''} ${customer.city || ''}` : 'Keine Adresse'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alle Angebote & Aufträge dieses Kunden */}
      <section className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">inventory_2</span>
              Alle Angebote & Aufträge ({orders.length})
            </h3>
            <p className="text-xs text-slate-400">Hier können Sie jedes Angebot direkt bearbeiten, den Status einsehen oder Rechnungen erstellen</p>
          </div>

          <Link
            href={`/dashboard/customers/${customer.id}/new-order`}
            className="btn-primary py-2 px-4 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Neues Angebot anlegen
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Keine Aufträge oder Angebote vorhanden.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders.map((ord: any) => {
              const ordTotals = calculateOrderTotals(ord);
              const ordNumber = ord.orderNumber || ord.orderIdShort || (ord.id ? `#${ord.id.slice(-5).toUpperCase()}` : '#AUFTRAG');
              const dateDisplay = ord.logistics?.movingDate || ord.createdAt?.toDate?.()?.toLocaleDateString('de-DE') || 'Kein Datum';
              const routeDisplay = ord.logistics?.a_city && ord.logistics?.b_city 
                ? `${ord.logistics.a_city} ➔ ${ord.logistics.b_city}`
                : 'Lokaler Auftrag';

              const getStatusBadge = (st: string) => {
                switch (st) {
                  case 'draft':
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">Entwurf</span>;
                  case 'quote':
                  case 'verhandlung':
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">Angebot versendet</span>;
                  case 'confirmed':
                  case 'bestaetigt':
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Bestätigt</span>;
                  case 'completed':
                  case 'abgeschlossen':
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 border border-slate-500/20">Abgeschlossen</span>;
                  default:
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{st || 'Offen'}</span>;
                }
              };

              return (
                <div key={ord.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-900 dark:text-white font-headline">
                        {ordNumber}
                      </span>
                      {getStatusBadge(ord.status)}
                      <span className="text-xs font-bold text-primary">
                        €{ordTotals.gross.toLocaleString('de-DE')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                        {dateDisplay}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">near_me</span>
                        {routeDisplay}
                      </span>
                      {ord.logistics?.estimatedVolume && (
                        <span>{ord.logistics.estimatedVolume} m³</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    {/* Angebot bearbeiten Button */}
                    <Link
                      href={`/dashboard/customers/${customer.id}/edit-order/${ord.id}`}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#D91E2A] text-white hover:bg-[#b51822] transition-all flex items-center gap-1.5 shadow-sm shadow-[#D91E2A]/20"
                    >
                      <span className="material-symbols-outlined text-sm">edit_document</span>
                      Angebot bearbeiten
                    </Link>

                    {/* PDF Vorschau */}
                    <button
                      type="button"
                      onClick={() => onViewPdf(ord, 'order')}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                      PDF
                    </button>

                    {/* Rechnung */}
                    <Link
                      href={`/dashboard/customers/${customer.id}/edit-invoice/${ord.id}`}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">receipt_long</span>
                      Rechnung
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Guidance Modal for Automated Checklist Items */}
      {checklistGuidanceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">
                  {checklistGuidanceItem.id === 'address' ? 'edit_location_alt' : 'history_edu'}
                </span>
              </div>
              <div className="flex-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Automatische System-Prüfung
                </span>
                <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white mt-1">
                  {checklistGuidanceItem.label}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                Dieses Feld kann nicht manuell per Klick abgehakt werden.
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {checklistGuidanceItem.missingReason || 'Das System setzt dieses Häkchen automatisch, sobald die entsprechenden Pflichtangaben im Kunden- oder Auftragsformular hinterlegt sind.'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {activeOrder && (
                <Link
                  href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                  onClick={() => setChecklistGuidanceItem(null)}
                  className="w-full py-3 px-4 rounded-xl bg-primary text-white font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  <span className="material-symbols-outlined text-base">edit_document</span>
                  <span>Jetzt im Angebot ausfüllen</span>
                </Link>
              )}

              {checklistGuidanceItem.id === 'address' && (
                <button
                  type="button"
                  onClick={() => {
                    setChecklistGuidanceItem(null);
                    onEditCustomer();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">person</span>
                  <span>Kundendaten bearbeiten</span>
                </button>
              )}

              {checklistGuidanceItem.id === 'signature' && onOpenSignatureModal && activeOrder && (
                <button
                  type="button"
                  onClick={() => {
                    const ord = activeOrder;
                    setChecklistGuidanceItem(null);
                    onOpenSignatureModal(ord);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">draw</span>
                  <span>Jetzt digital signieren</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setChecklistGuidanceItem(null)}
                className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
