"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp, 
  writeBatch 
} from 'firebase/firestore';
import { 
  XMarkIcon, 
  BanknotesIcon, 
  CheckCircleIcon, 
  ReceiptPercentIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';

interface SettleClaimModalProps {
  claim: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SettleClaimModal({ claim, onClose, onSuccess }: SettleClaimModalProps) {
  useModalBackHandler(true, onClose, 'settle-claim-modal');
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [candidateInvoices, setCandidateInvoices] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [settleAmount, setSettleAmount] = useState<number>(Number(claim?.amount) || 0);
  const [settlementMode, setSettlementMode] = useState<'payment' | 'service_deduction'>('payment');
  const [customNote, setCustomNote] = useState<string>('');

  useEffect(() => {
    async function loadInvoices() {
      if (!claim?.customerId && !claim?.orderId) {
        setLoading(false);
        return;
      }

      try {
        const foundDocs: any[] = [];
        const seenIds = new Set<string>();

        // 1. Check invoices collection by customerId
        if (claim.customerId) {
          const invQuery = query(collection(db, 'invoices'), where('customerId', '==', claim.customerId));
          const invSnap = await getDocs(invQuery);
          invSnap.forEach(d => {
            if (!seenIds.has(d.id)) {
              seenIds.add(d.id);
              foundDocs.push({ id: d.id, _collection: 'invoices', ...d.data() });
            }
          });
        }

        // 2. Check orders collection by customerId (orders that have an invoiceNumber or are active)
        if (claim.customerId) {
          const ordQuery = query(collection(db, 'orders'), where('customerId', '==', claim.customerId));
          const ordSnap = await getDocs(ordQuery);
          ordSnap.forEach(d => {
            const data = d.data();
            // Include order if it has an invoiceNumber or status allows billing/payment
            if (data.invoiceNumber || (data.status && data.status.startsWith('invoice_')) || data.status === 'completed' || data.status === 'confirmed') {
              if (!seenIds.has(d.id)) {
                seenIds.add(d.id);
                foundDocs.push({ id: d.id, _collection: 'orders', ...data });
              }
            }
          });
        }

        // 3. Fallback: Check by claim.orderId if available
        if (claim.orderId && !seenIds.has(claim.orderId)) {
          const ordSnap = await getDocs(query(collection(db, 'orders'), where('id', '==', claim.orderId)));
          ordSnap.forEach(d => {
            if (!seenIds.has(d.id)) {
              seenIds.add(d.id);
              foundDocs.push({ id: d.id, _collection: 'orders', ...d.data() });
            }
          });
        }

        // Map and filter active/eligible invoices
        const evaluated = foundDocs
          .filter(docItem => docItem.status !== 'canceled' && docItem.status !== 'invoice_cancelled')
          .map(docItem => {
            const totals = calculateOrderTotals(docItem);
            const totalPaid = calculateTotalPaid(docItem);
            const openAmount = calculateOpenAmount(docItem);
            return {
              ...docItem,
              computedTotals: totals,
              computedPaid: totalPaid,
              computedOpen: openAmount
            };
          });

        // Sort: Invoices with open balances first, then by date
        evaluated.sort((a, b) => (b.computedOpen > 0 ? 1 : 0) - (a.computedOpen > 0 ? 1 : 0));

        setCandidateInvoices(evaluated);

        if (evaluated.length > 0) {
          setSelectedDocId(evaluated[0].id);
          // If claim amount is not set or 0, suggest the open amount of the first invoice
          if (!claim.amount || Number(claim.amount) <= 0) {
            setSettleAmount(evaluated[0].computedOpen > 0 ? evaluated[0].computedOpen : evaluated[0].computedTotals.gross);
          }
        }
      } catch (err) {
        console.error('Error fetching invoices for claim settlement:', err);
        toast.error('Rechnungen konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    }

    loadInvoices();
  }, [claim]);

  const selectedTarget = candidateInvoices.find(c => c.id === selectedDocId);

  const handleSettle = async () => {
    if (!selectedTarget) {
      toast.error('Bitte wähle eine Rechnung oder einen Auftrag aus.');
      return;
    }

    const amountNum = Number(settleAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Bitte gib einen gültigen Verrechnungsbetrag größer 0 € an.');
      return;
    }

    setIsProcessing(true);
    try {
      const targetCol = selectedTarget._collection || 'invoices';
      const cleanCreatorName = profile?.displayName || profile?.email?.split('@')[0] || 'Team';
      const claimTicketShort = claim.id.slice(-5).toUpperCase();
      const settlementLabel = `Schadensregulierung / Kulanz (Ticket #${claimTicketShort})`;
      const noteToSave = customNote.trim() ? `${settlementLabel} - ${customNote.trim()}` : settlementLabel;

      const batch = writeBatch(db);

      if (settlementMode === 'payment') {
        // Mode A: Book as payment with method 'schaden_verrechnung'
        const existingPayments = Array.isArray(selectedTarget.payments) ? selectedTarget.payments : [];
        const newPayment = {
          id: 'claim_settle_' + Date.now(),
          amount: amountNum,
          method: 'schaden_verrechnung',
          note: noteToSave,
          date: Timestamp.now()
        };
        const updatedPayments = [...existingPayments, newPayment];
        const newTotalPaid = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
        const gross = selectedTarget.computedTotals?.gross || calculateOrderTotals(selectedTarget).gross;
        
        const isPaid = newTotalPaid >= (gross - 0.01);
        const newStatus = isPaid ? 'invoice_paid' : (selectedTarget.status || 'invoice_open');

        // Update target doc
        const targetRef = doc(db, targetCol, selectedTarget.id);
        batch.update(targetRef, {
          payments: updatedPayments,
          status: newStatus,
          updatedAt: serverTimestamp()
        });

        // If counterpart exists (e.g. sourceOrderId on invoice or matching invoice in orders)
        if (targetCol === 'invoices' && selectedTarget.sourceOrderId) {
          const counterpartRef = doc(db, 'orders', selectedTarget.sourceOrderId);
          batch.update(counterpartRef, {
            payments: updatedPayments,
            status: newStatus,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Mode B: Add deduction item to services
        const existingServices = Array.isArray(selectedTarget.services) ? selectedTarget.services : [];
        const newService = {
          id: 'claim_deduct_' + Date.now(),
          name: noteToSave,
          quantity: 1,
          unitPrice: -Math.abs(amountNum),
          unit: 'Pauschal',
          isIncluded: false
        };
        const updatedServices = [...existingServices, newService];

        // Recalculate totals
        let net = 0;
        if (selectedTarget.isFlatRate) {
          net = Math.max(0, (Number(selectedTarget.flatRateNet) || 0) - amountNum);
        } else {
          net = updatedServices.reduce((acc, curr) => {
            if (curr.isIncluded) return acc;
            return acc + ((Number(curr.quantity) || 0) * (Number(curr.unitPrice) || 0));
          }, 0);
        }
        net = Math.max(0, Math.round(net * 100) / 100);
        const tax = Math.round(net * 0.19 * 100) / 100;
        const gross = Math.round((net + tax) * 100) / 100;

        const newTotals = { net, tax, gross };

        const targetRef = doc(db, targetCol, selectedTarget.id);
        batch.update(targetRef, {
          services: updatedServices,
          totals: newTotals,
          calcInput: newTotals,
          updatedAt: serverTimestamp()
        });

        if (targetCol === 'invoices' && selectedTarget.sourceOrderId) {
          const counterpartRef = doc(db, 'orders', selectedTarget.sourceOrderId);
          batch.update(counterpartRef, {
            services: updatedServices,
            totals: newTotals,
            calcInput: newTotals,
            updatedAt: serverTimestamp()
          });
        }
      }

      // Update Claim document to 'Erledigt'
      const claimRef = doc(db, 'claims', claim.id);
      batch.update(claimRef, {
        status: 'Erledigt',
        settledAmount: amountNum,
        settledAt: serverTimestamp(),
        settledBy: cleanCreatorName,
        settledInvoiceNumber: selectedTarget.invoiceNumber || selectedTarget.orderNumber || selectedTarget.id,
        settledInvoiceId: selectedTarget.id,
        settlementMethod: settlementMode,
        settlementNote: noteToSave,
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      await logActivity(
        profile?.uid || 'unknown',
        cleanCreatorName,
        'SETTLE_CLAIM',
        `Reklamation #${claimTicketShort} (${amountNum.toFixed(2)} €) mit ${selectedTarget.invoiceNumber || 'Rechnung'} verrechnet`
      );

      toast.success(`Schaden erfolgreich mit ${selectedTarget.invoiceNumber || 'Rechnung'} verrechnet!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error during claim settlement:', err);
      toast.error('Fehler bei der Verrechnung: ' + (err.message || 'Unbekannt'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-structure rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <BanknotesIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block font-headline">
                Schadensregulierung &amp; Kulanz
              </span>
              <h2 className="text-xl font-extrabold text-text-main font-headline mt-0.5">
                Mit Rechnung verrechnen
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Claim Summary Card */}
        <div className="p-4 rounded-2xl bg-black/25 border border-structure/70 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-muted">Kunde:</span>
            <span className="font-bold text-text-main">{claim.customerName || 'Unbekannt'}</span>
          </div>
          <div className="text-xs">
            <span className="text-text-muted block mb-1">Schadensbeschreibung:</span>
            <p className="p-2.5 rounded-xl bg-white/[0.02] border border-structure/50 text-text-main text-xs leading-relaxed italic">
              &quot;{claim.description || 'Keine Beschreibung'}&quot;
            </p>
          </div>
          {claim.insuranceId && (
            <div className="flex justify-between items-center text-xs pt-1 border-t border-structure/40">
              <span className="text-text-muted">Versicherungsvorgang:</span>
              <span className="font-mono text-blue-400 font-semibold">{claim.insuranceId}</span>
            </div>
          )}
        </div>

        {/* Main Form */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-text-muted">Suche Rechnungen des Kunden...</span>
          </div>
        ) : candidateInvoices.length === 0 ? (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
              <span>Keine offenen Rechnungen gefunden</span>
            </div>
            <p className="leading-relaxed opacity-90">
              Für diesen Kunden ist bisher keine Rechnung im System angelegt. Bitte erstelle zuerst eine Rechnung im Kundenprofil, um die Schadenssumme damit verrechnen zu können.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target Invoice Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted font-headline mb-1.5">
                1. Ziel-Rechnung auswählen
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedDocId(newId);
                  const found = candidateInvoices.find(c => c.id === newId);
                  if (found && (!claim.amount || Number(claim.amount) <= 0)) {
                    setSettleAmount(found.computedOpen > 0 ? found.computedOpen : found.computedTotals.gross);
                  }
                }}
                className="input-field py-2.5 px-3.5 w-full bg-bg-dark text-xs font-semibold cursor-pointer"
              >
                {candidateInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber ? `Rechnung ${inv.invoiceNumber}` : `Auftrag ${inv.orderNumber || inv.id.slice(-5)}`}
                    {inv.computedOpen > 0 
                      ? ` • Offen: € ${inv.computedOpen.toFixed(2)} (von € ${inv.computedTotals.gross.toFixed(2)})`
                      : ` • Gesamt: € ${inv.computedTotals.gross.toFixed(2)} (Bereits bezahlt)`}
                  </option>
                ))}
              </select>
            </div>

            {/* Settlement Amount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted font-headline">
                  2. Verrechnungsbetrag (€)
                </label>
                {selectedTarget?.computedOpen > 0 && settleAmount !== selectedTarget.computedOpen && (
                  <button
                    type="button"
                    onClick={() => setSettleAmount(selectedTarget.computedOpen)}
                    className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    Offenen Restbetrag übernehmen (€ {selectedTarget.computedOpen.toFixed(2)})
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedTarget?.computedOpen > 0 ? selectedTarget.computedOpen * 2 : 10000}
                  value={settleAmount || ''}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  className="input-field py-3 pl-4 pr-10 w-full bg-bg-dark font-mono font-bold text-base text-text-main"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-text-muted text-sm">
                  €
                </span>
              </div>
            </div>

            {/* Settlement Method Toggle */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted font-headline">
                3. Buchungs-Art
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSettlementMode('payment')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    settlementMode === 'payment'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'border-structure/70 bg-white/[0.02] text-text-muted hover:border-structure'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-xs">Schadensgutschrift (Zahlung)</span>
                  </div>
                  <span className="text-[10px] text-text-muted leading-tight">
                    Bucht die Schadensregulierung als Zahlungseingang ab. Mindert den offenen Zahlungsbetrag direkt.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettlementMode('service_deduction')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    settlementMode === 'service_deduction'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'border-structure/70 bg-white/[0.02] text-text-muted hover:border-structure'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ReceiptPercentIcon className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-xs">Positionsrabatt (Rechnung)</span>
                  </div>
                  <span className="text-[10px] text-text-muted leading-tight">
                    Fügt der Rechnung einen negativen Kulanzposten hinzu. Mindert Rechnungsbrutto und USt.
                  </span>
                </button>
              </div>
            </div>

            {/* Custom Settlement Note */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted font-headline mb-1.5">
                Zusatznotiz für Buchhaltung / Beleg (Optional)
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="z.B. Einigung mit Kunde am Telefon: 100€ Kulanz wegen Kühlschrank"
                className="input-field py-2 px-3.5 w-full bg-bg-dark text-xs"
              />
            </div>

            {/* Live Calculation Preview Card */}
            {selectedTarget && (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2 text-xs">
                <div className="flex justify-between items-center text-text-muted">
                  <span>Aktueller offener Rechnungsbetrag:</span>
                  <span className="font-mono font-bold text-text-main">
                    € {selectedTarget.computedOpen.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-400 font-bold">
                  <span>Abzug durch Schadensregulierung:</span>
                  <span className="font-mono">
                    - € {Number(settleAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-emerald-500/20 font-extrabold text-sm text-text-main font-headline">
                  <span>Neuer offener Restbetrag:</span>
                  <span className={`font-mono ${Math.max(0, selectedTarget.computedOpen - (settleAmount || 0)) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    € {Math.max(0, selectedTarget.computedOpen - (settleAmount || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 flex justify-end gap-3 border-t border-structure/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-structure hover:bg-white/5 text-text-muted text-xs font-bold transition-colors cursor-pointer"
          >
            Abbrechen
          </button>

          <button
            type="button"
            onClick={handleSettle}
            disabled={isProcessing || candidateInvoices.length === 0 || !settleAmount || settleAmount <= 0}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold font-headline shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Wird verrechnet...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4" />
                <span>Jetzt verbindlich verrechnen</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
