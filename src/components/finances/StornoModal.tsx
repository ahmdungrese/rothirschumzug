"use client";

import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, collection, addDoc, updateDoc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { XMarkIcon, ExclamationTriangleIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface StornoModalProps {
  invoice: any;
  onClose: () => void;
  onSuccess?: (stornoDoc?: any) => void;
}

export function StornoModal({ invoice, onClose, onSuccess }: StornoModalProps) {
  const [reason, setReason] = useState('Rechnungskorrektur / Falsche Positionen');
  const [customReason, setCustomReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!invoice) return null;

  const invoiceNum = invoice.invoiceNumber || 'Rechnung ohne Nummer';
  const parentOrderId = invoice.sourceOrderId || (invoice._collection !== 'invoices' ? invoice.id : null);

  const handleConfirmStorno = async () => {
    setIsProcessing(true);
    const finalReason = reason === 'Sonstiges' ? (customReason || 'Rechnung storniert') : reason;

    try {
      const stornoNumber = `ST-${invoiceNum.replace(/^RE-/, '')}`;
      
      const stornoPayload: any = {
        type: 'invoice',
        isStorno: true,
        stornoFor: invoiceNum,
        invoiceNumber: stornoNumber,
        customerId: invoice.customerId || null,
        sourceOrderId: parentOrderId || null,
        customerName: invoice.customerName || '',
        customerData: invoice.customerData || null,
        orderMeta: invoice.orderMeta || null,
        status: 'invoice_cancelled',
        isCanceled: true,
        stornoReason: finalReason,
        services: invoice.services || [],
        calcInput: invoice.calcInput || null,
        isFlatRate: invoice.isFlatRate || false,
        flatRateNet: invoice.flatRateNet || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // 1. Create Storno Doc in invoices
      const stornoRef = await addDoc(collection(db, 'invoices'), stornoPayload);

      // 2. Mark original invoice as cancelled
      if (invoice.id) {
        const invRef = doc(db, 'invoices', invoice.id);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          await updateDoc(invRef, {
            status: 'invoice_cancelled',
            isCanceled: true,
            stornoReason: finalReason,
            stornoNumber: stornoNumber,
            updatedAt: serverTimestamp()
          });
        }
      }

      // 3. Update parent order in orders collection to rollback status and record history
      if (parentOrderId) {
        const orderRef = doc(db, 'orders', parentOrderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const history = orderData.invoiceHistory || [];
          history.push({
            invoiceNumber: invoiceNum,
            status: 'invoice_cancelled',
            stornoNumber: stornoNumber,
            date: new Date().toISOString(),
            reason: finalReason
          });

          await updateDoc(orderRef, {
            status: 'confirmed', // Cleanly returns to Phase 3: ready to generate a corrected invoice
            invoiceNumber: null,
            invoiceHistory: history,
            updatedAt: serverTimestamp()
          });
        }
      }

      toast.success(`Rechnung ${invoiceNum} erfolgreich storniert! Storno-Beleg ${stornoNumber} erstellt.`);
      
      if (onSuccess) {
        onSuccess({ ...stornoPayload, id: stornoRef.id });
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
              € {(invoice.calcInput?.gross || invoice.totals?.gross || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
