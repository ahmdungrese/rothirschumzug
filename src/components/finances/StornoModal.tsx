"use client";

import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, collection, getDoc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { XMarkIcon, ExclamationTriangleIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { calculateOrderTotals } from '@/lib/financeHelpers';

interface StornoModalProps {
  invoice: any;
  onClose: () => void;
  onSuccess?: (stornoDoc?: any) => void;
}

export function StornoModal({ invoice, onClose, onSuccess }: StornoModalProps) {
  const { profile } = useAuth();
  useModalBackHandler(Boolean(invoice), onClose, 'storno-modal');
  const [reason, setReason] = useState('Rechnungskorrektur / Falsche Positionen');
  const [customReason, setCustomReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!invoice) return null;

  const invoiceNum = invoice.activeInvoiceNumber || invoice.invoiceNumber || 'Rechnung ohne Nummer';
  const initialParentOrderId =
    invoice.sourceOrderId ||
    invoice.orderId ||
    (invoice._collection !== 'invoices' ? invoice.id : null);
  const effectiveTotals = calculateOrderTotals(invoice);

  const handleConfirmStorno = async () => {
    setIsProcessing(true);
    const finalReason = reason === 'Sonstiges' ? (customReason || 'Rechnung storniert') : reason;

    try {
      const stornoNumber = `ST-${invoiceNum.replace(/^(RE-|R-|ST-)/, '')}`;

      // 0. Resolve Parent Order & Original Invoice(s) before committing atomic batch
      let resolvedOrderRef: any = null;
      let resolvedOrderData: any = null;

      if (initialParentOrderId) {
        const candidateOrderRef = doc(db, 'orders', initialParentOrderId);
        const candidateOrderSnap = await getDoc(candidateOrderRef);
        if (candidateOrderSnap.exists()) {
          resolvedOrderRef = candidateOrderRef;
          resolvedOrderData = candidateOrderSnap.data();
        }
      }

      if (!resolvedOrderRef && invoiceNum && invoiceNum !== 'Rechnung ohne Nummer') {
        const qOrders = await getDocs(
          query(collection(db, 'orders'), where('invoiceNumber', '==', invoiceNum))
        );
        if (!qOrders.empty) {
          resolvedOrderRef = qOrders.docs[0].ref;
          resolvedOrderData = qOrders.docs[0].data();
        }
      }

      const finalParentOrderId = resolvedOrderRef ? resolvedOrderRef.id : (initialParentOrderId || null);

      const stornoPayload: any = {
        type: 'invoice',
        isStorno: true,
        stornoFor: invoiceNum,
        invoiceNumber: stornoNumber,
        invoiceDate: new Date().toISOString(),
        customerId: invoice.customerId || resolvedOrderData?.customerId || null,
        sourceOrderId: finalParentOrderId,
        customerName: invoice.customerName || resolvedOrderData?.customerName || '',
        customerData: invoice.customerData || invoice.billingAddress || resolvedOrderData?.billingAddress || null,
        logistics: invoice.logistics || resolvedOrderData?.logistics || null,
        orderMeta: invoice.orderMeta || resolvedOrderData?.orderMeta || null,
        status: 'invoice_cancelled',
        isCanceled: true,
        stornoReason: finalReason,
        services: invoice.services || resolvedOrderData?.services || [],
        calcInput: effectiveTotals,
        totals: effectiveTotals,
        isFlatRate: Boolean(invoice.isFlatRate ?? resolvedOrderData?.isFlatRate),
        flatRateNet: invoice.flatRateNet ?? resolvedOrderData?.flatRateNet ?? 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Check if a Storno document with this stornoNumber already exists (e.g. from a previous interrupted click)
      // Note: Firestore rules forbid updating existing docs where isStorno == true, so we reuse it if it exists!
      let existingStornoId: string | null = null;
      const existingStornoSnap = await getDocs(
        query(collection(db, 'invoices'), where('invoiceNumber', '==', stornoNumber))
      );
      if (!existingStornoSnap.empty) {
        const stornoDoc = existingStornoSnap.docs.find(d => d.data()?.isStorno === true) || existingStornoSnap.docs[0];
        existingStornoId = stornoDoc.id;
      }

      // Find all original invoice documents in 'invoices' collection to mark as cancelled
      const invoiceRefsToCancel = new Map<string, any>();
      if (invoice.id) {
        const directInvRef = doc(db, 'invoices', invoice.id);
        const directInvSnap = await getDoc(directInvRef);
        if (directInvSnap.exists() && !directInvSnap.data()?.isStorno) {
          invoiceRefsToCancel.set(directInvSnap.id, directInvRef);
        }
      }
      if (invoiceNum && invoiceNum !== 'Rechnung ohne Nummer') {
        const byNumSnap = await getDocs(
          query(collection(db, 'invoices'), where('invoiceNumber', '==', invoiceNum))
        );
        byNumSnap.docs.forEach(d => {
          if (!d.data()?.isStorno) {
            invoiceRefsToCancel.set(d.id, d.ref);
          }
        });
      }

      // Prepare updated history for parent order
      let baseOrderRollback: any = null;
      if (resolvedOrderRef && resolvedOrderData) {
        const existingHistory = Array.isArray(resolvedOrderData.invoiceHistory)
          ? [...resolvedOrderData.invoiceHistory]
          : [];
        const alreadyInHistory = existingHistory.some(
          (h: any) => h?.invoiceNumber === invoiceNum && h?.status === 'invoice_cancelled'
        );
        if (!alreadyInHistory) {
          existingHistory.push({
            invoiceNumber: invoiceNum,
            status: 'invoice_cancelled',
            stornoNumber: stornoNumber,
            date: new Date().toISOString(),
            reason: finalReason
          });
        }

        baseOrderRollback = {
          status: 'confirmed', // Cleanly returns to Phase 3: ready to generate a corrected invoice
          invoiceCancelled: true,
          activeInvoiceNumber: null,
          stornoNumber: stornoNumber,
          stornoReason: finalReason,
          invoiceHistory: existingHistory,
          'ticketStates.invoice': false,
          'checklistDone.invoice': false,
          updatedAt: serverTimestamp()
        };
      }

      const executeAtomicStorno = async (clearOrderInvoiceNumberField: boolean): Promise<string> => {
        const batch = writeBatch(db);
        let finalStornoId = existingStornoId;

        // 1. Create Storno Doc in invoices (only if not already created)
        if (!finalStornoId) {
          const newStornoRef = doc(collection(db, 'invoices'));
          finalStornoId = newStornoRef.id;
          batch.set(newStornoRef, stornoPayload);
        }

        // 2. Mark original invoice(s) as cancelled
        invoiceRefsToCancel.forEach((invRef) => {
          batch.update(invRef, {
            status: 'invoice_cancelled',
            isCanceled: true,
            stornoReason: finalReason,
            stornoNumber: stornoNumber,
            updatedAt: serverTimestamp()
          });
        });

        // 3. Rollback parent order in orders collection
        if (resolvedOrderRef && baseOrderRollback) {
          const orderUpdatePayload = clearOrderInvoiceNumberField
            ? { ...baseOrderRollback, invoiceNumber: null }
            : { ...baseOrderRollback };
          batch.update(resolvedOrderRef, orderUpdatePayload);
        }

        await batch.commit();
        return finalStornoId!;
      };

      let committedStornoId: string;
      try {
        committedStornoId = await executeAtomicStorno(true);
      } catch (firstErr: any) {
        // Fallback if cloud firestore.rules still enforces immutable order.invoiceNumber
        if (
          resolvedOrderRef &&
          (firstErr?.code === 'permission-denied' ||
            String(firstErr?.message || '').toLowerCase().includes('permission'))
        ) {
          committedStornoId = await executeAtomicStorno(false);
        } else {
          throw firstErr;
        }
      }

      toast.success(`Rechnung ${invoiceNum} erfolgreich storniert! Storno-Beleg ${stornoNumber} erstellt.`);
      
      const cancellerName = profile?.displayName || profile?.email?.split('@')[0] || 'Mitarbeiter';
      await logActivity(
        profile?.uid || 'unknown',
        cancellerName,
        'CANCEL_INVOICE',
        `Rechnung ${invoiceNum} storniert (${stornoNumber}) für ${invoice.customerName || resolvedOrderData?.customerName || 'Kunde'}. Grund: ${finalReason}`
      );

      if (onSuccess) {
        onSuccess({ ...stornoPayload, id: committedStornoId });
      }
      onClose();
    } catch (err: any) {
      console.error('Fehler beim Stornieren:', err);
      toast.error('Fehler beim Stornieren: ' + (err.message || 'Unbekannter Fehler'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-structure rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
              <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">
                GoBD Storno-Workflow
              </span>
              <h2 className="text-xl font-extrabold text-text-main font-headline mt-0.5">
                Rechnung stornieren
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Info Card */}
        <div className="p-4 rounded-2xl bg-black/20 border border-structure/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Rechnungsnummer:</span>
            <span className="font-bold text-text-main font-mono">{invoiceNum}</span>
          </div>
          {invoice.customerName && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Kunde:</span>
              <span className="font-bold text-text-main">{invoice.customerName}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-structure/40">
            <span className="text-text-muted">Rechnungsbetrag:</span>
            <span className="font-bold text-primary">
              € {effectiveTotals.gross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Legal Explanation */}
        <p className="text-xs text-text-muted leading-relaxed">
          Gemäß den steuerlichen GoBD-Grundsätzen wird die Originalrechnung nicht gelöscht, sondern offiziell als storniert markiert. Es wird automatisch ein korrespondierender <strong>Storno-Beleg</strong> erzeugt und der Auftrag wird wieder freigegeben, sodass Sie bei Bedarf sofort eine neue, korrigierte Rechnung ausstellen können.
        </p>

        {/* Reason Select */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-text-main uppercase tracking-wider">
            Stornierungsgrund auswählen:
          </label>
          <div className="space-y-2 text-xs">
            {[
              'Rechnungskorrektur / Falsche Positionen',
              'Kunde hat den Auftrag storniert',
              'Preisanpassung / Nachträglicher Rabatt',
              'Sonstiges'
            ].map((opt) => (
              <label key={opt} className="flex items-center gap-2 p-2.5 rounded-xl border border-structure/50 hover:bg-white/5 cursor-pointer transition-colors text-text-main">
                <input
                  type="radio"
                  name="stornoReason"
                  checked={reason === opt}
                  onChange={() => setReason(opt)}
                  className="accent-primary"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          {reason === 'Sonstiges' && (
            <input
              type="text"
              placeholder="Individuellen Grund angeben..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="input-field w-full text-xs mt-2"
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-structure/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleConfirmStorno}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5"
          >
            <DocumentCheckIcon className="w-4 h-4" />
            <span>{isProcessing ? 'Storniere...' : 'Rechnung jetzt stornieren'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
