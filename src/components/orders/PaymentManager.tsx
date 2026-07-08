"use client";
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { BanknotesIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/ui/Modal';
import { getCol } from '@/lib/demoMode';
import { changeOrderStatus } from '@/lib/orderStateMachine';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';

export function PaymentManager({ order, allOrders = [], freeInvoices = [], onUpdate, onClose }: { order: any, allOrders?: any[], freeInvoices?: any[], onUpdate: () => void, onClose: () => void }) {
  const isFreeInvoice = order._collection === 'invoices';
  const targetCol = isFreeInvoice ? 'invoices' : 'orders';
  const totalGross = calculateOrderTotals(order).gross;
  
  const [payments, setPayments] = useState<any[]>(order.payments || []);
  
  const totalPaid = calculateTotalPaid({ payments }); // Using temporary object for the state array
  const remaining = Math.max(0, totalGross - totalPaid);
  
  // Finde verfügbare Guthabenquellen (andere stornierte/abgeschlossene Aufträge oder Rechnungen mit positiven Zahlungen)
  const availableCredits = [...allOrders, ...freeInvoices]
    .filter(doc => doc.id !== order.id) // Nicht dieses Dokument
    .map(doc => {
      const docPaid = (doc.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const isCancelled = doc.status === 'canceled' || doc.status === 'invoice_cancelled';
      // Ein Guthaben ist verfügbar, wenn das Dokument storniert ist und noch Geld hat,
      // oder wenn es 'completed' ist, keine aktive Rechnung hat und noch Geld hat.
      const hasCredit = docPaid > 0 && (isCancelled || (doc.status === 'completed' && !doc.invoiceNumber));
      
      // Bestimme den Namen für die Anzeige
      let sourceName = '';
      if (doc.invoiceHistory && doc.invoiceHistory.length > 0) {
        sourceName = `Storno ${doc.invoiceHistory[doc.invoiceHistory.length - 1].invoiceNumber}`;
      } else if (doc.invoiceNumber) {
        sourceName = `Rechnung ${doc.invoiceNumber} (Storniert)`;
      } else {
        sourceName = `Auftrag ${doc.orderNumber || doc.id.substring(0, 4)}`;
      }

      return { doc, docPaid, hasCredit, sourceName };
    })
    .filter(item => item.hasCredit);

  const [amount, setAmount] = useState<number | ''>(remaining > 0 ? remaining : '');
  const [method, setMethod] = useState<'bar' | 'ueberweisung' | 'ec-karte' | 'paypal' | 'guthaben'>('bar');
  const [isSaving, setIsSaving] = useState(false);

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    
    // Prevent adding more than what is open
    if (amount > remaining) {
      alert(`Sie können maximal ${remaining.toFixed(2)} € hinzufügen.`);
      setAmount(remaining);
      return;
    }

    setIsSaving(true);
    const newPayment = {
      id: Date.now().toString(),
      amount: Number(amount),
      method,
      date: Timestamp.now()
    };
    const updatedPayments = [...payments, newPayment];
    
    // Auto-update status if fully paid
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    let newStatus = order.status;
    if (newTotalPaid >= totalGross && order.status !== 'canceled') {
      newStatus = 'invoice_paid';
    } else if (newTotalPaid > 0 && newTotalPaid < totalGross && order.status === 'draft') {
      newStatus = 'quote'; // At least it's an active quote if someone paid a deposit
    }

    try {
      if (isFreeInvoice) {
        // Free invoices don't go through the state machine – just update directly
        const newStatus = newTotalPaid >= totalGross ? 'paid' : 'open';
        await updateDoc(doc(db, getCol(targetCol), order.id), { payments: updatedPayments, status: newStatus });
      } else {
        await changeOrderStatus(order.id, newStatus as any, {
          additionalData: { payments: updatedPayments }
        });
      }
      setPayments(updatedPayments);
      setAmount(remaining - Number(amount) > 0 ? remaining - Number(amount) : '');
      onUpdate();
    } catch (error) {
      console.error("Fehler beim Speichern der Zahlung", error);
    } finally {
      setIsSaving(false);
    }
  };

  const removePayment = async (id: string) => {
    setIsSaving(true);
    const updatedPayments = payments.filter(p => p.id !== id);
    
    // Re-evaluate status
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    let newStatus = order.status;
    if (newTotalPaid < totalGross && order.status === 'invoice_paid') {
      newStatus = 'invoice_open';
    }

    try {
      if (isFreeInvoice) {
        const newStatus2 = updatedPayments.reduce((s: number, p: any) => s + p.amount, 0) >= totalGross ? 'paid' : 'open';
        await updateDoc(doc(db, getCol(targetCol), order.id), { payments: updatedPayments, status: newStatus2 });
      } else {
        await changeOrderStatus(order.id, newStatus as any, {
          additionalData: { payments: updatedPayments }
        });
      }
      setPayments(updatedPayments);
      setAmount(totalGross - newTotalPaid);
      onUpdate();
    } catch (error) {
      console.error("Fehler beim Löschen der Zahlung", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6 border-t-4 border-t-primary rounded-2xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <BanknotesIcon className="w-6 h-6 text-primary" />
            Zahlungen verwalten
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-bg-dark p-3 rounded-xl border border-structure text-center">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Rechnung</div>
            <div className="font-semibold text-text-main">€ {totalGross.toFixed(2)}</div>
          </div>
          <div className="bg-bg-dark p-3 rounded-xl border border-structure text-center border-b-2 border-b-green-500">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Bezahlt</div>
            <div className="font-semibold text-green-400">€ {totalPaid.toFixed(2)}</div>
          </div>
          <div className="bg-bg-dark p-3 rounded-xl border border-structure text-center border-b-2 border-b-primary">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Offen</div>
            <div className="font-semibold text-primary">€ {remaining.toFixed(2)}</div>
          </div>
        </div>

        {remaining > 0 ? (
          <>
          <form onSubmit={addPayment} className="flex gap-2 mb-4 h-11">
            <div className="relative flex-1 h-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">€</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining > 0 ? remaining : undefined}
                required
                value={amount}
                onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
                className="input-field w-full h-full pl-8 font-mono"
                placeholder="0.00"
              />
            </div>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as any)}
              className="input-field h-full max-w-[140px] text-sm"
            >
              <option value="bar">Bar</option>
              <option value="ueberweisung">Überweisung</option>
              <option value="ec-karte">EC-Karte</option>
              <option value="paypal">PayPal</option>
              <option value="guthaben" disabled={availableCredits.length === 0}>Guthaben</option>
            </select>
            <button type="submit" aria-label="Zahlung hinzufügen" disabled={isSaving || !amount} className="btn-primary h-full px-4 rounded-xl">
              <PlusIcon className="w-6 h-6" />
            </button>
          </form>

          {/* Quick-Transfer Guthaben Buttons */}
          {availableCredits.length > 0 && remaining > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-1">Verfügbares Guthaben</div>
              {availableCredits.map(credit => {
                const transferAmount = Math.min(credit.docPaid, remaining);
                return (
                  <button
                    key={credit.doc.id}
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      if (!confirm(`Möchten Sie ${transferAmount.toFixed(2)} € aus ${credit.sourceName} verrechnen?`)) return;
                      setIsSaving(true);
                      
                      try {
                        const transferDate = Timestamp.now();
                        const transferId = Date.now().toString();
                        
                        // 1. Zahlung zum aktuellen Auftrag hinzufügen
                        const newPayment = {
                          id: transferId,
                          amount: transferAmount,
                          method: 'guthaben',
                          date: transferDate,
                          note: `Verrechnet von ${credit.sourceName}`
                        };
                        const updatedPayments = [...payments, newPayment];
                        const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
                        
                        let newStatus = order.status;
                        if (newTotalPaid >= totalGross && order.status !== 'canceled') {
                          newStatus = 'invoice_paid';
                        }
                        
                        await updateDoc(doc(db, targetCol, order.id), {
                          payments: updatedPayments,
                          status: newStatus
                        });
                        if (newStatus !== order.status && targetCol === 'orders') {
                          await changeOrderStatus(order.id, newStatus);
                        }
                        
                        // 2. Gegenbuchung beim Quell-Auftrag/Rechnung einfügen
                        const actualSourceCol = credit.doc.sourceOrderId ? 'invoices' : 'orders';
                        
                        const sourcePayment = {
                          id: `transfer-${transferId}`,
                          amount: -transferAmount, // Negative amount removes credit
                          method: 'guthaben',
                          date: transferDate,
                          note: `Verrechnet auf Rechnung ${order.invoiceNumber || order.id.substring(0,4)}`
                        };
                        const updatedSourcePayments = [...(credit.doc.payments || []), sourcePayment];
                        await updateDoc(doc(db, actualSourceCol, credit.doc.id), {
                          payments: updatedSourcePayments
                        });
                        
                        setPayments(updatedPayments);
                        setAmount('');
                        onUpdate();
                      } catch (e: any) {
                        alert("Fehler bei der Verrechnung: " + e.message);
                      }
                      setIsSaving(false);
                    }}
                    className="btn-secondary w-full justify-center flex items-center gap-2 text-xs py-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  >
                    Verrechnung mit Guthaben ({transferAmount.toFixed(2)} €) aus {credit.sourceName}
                  </button>
                );
              })}
            </div>
          )}
          </>
        ) : (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center text-green-400 text-sm font-semibold">
            Rechnung ist vollständig bezahlt.
          </div>
        )}

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {payments.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-4 italic">Noch keine Zahlungen erfasst.</p>
          ) : (
            payments.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-bg-dark border border-structure rounded-lg">
                <div>
                  <div className="font-medium text-text-main">€ {p.amount.toFixed(2)}</div>
                  <div className="text-xs text-text-muted flex items-center gap-2 mt-1">
                    <span className="capitalize">{p.method}</span> •
                    <span>{p.date ? new Date(p.date.toMillis()).toLocaleDateString('de-DE') : 'Unbekannt'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Zahlung löschen"
                  onClick={() => removePayment(p.id)}
                  disabled={isSaving}
                  className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </Modal>
  );
}
