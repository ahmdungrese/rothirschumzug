"use client";
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp, writeBatch, serverTimestamp, getDocs, query, collection, where } from 'firebase/firestore';
import { 
  BanknotesIcon, 
  PlusIcon, 
  TrashIcon, 
  XMarkIcon, 
  CheckCircleIcon, 
  CurrencyEuroIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { changeOrderStatus } from '@/lib/orderStateMachine';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';

export function PaymentManager({ order, allOrders = [], freeInvoices = [], onUpdate, onClose }: { order: any, allOrders?: any[], freeInvoices?: any[], onUpdate: () => void, onClose: () => void }) {
  const targetCol = order._collection || 'orders';

  // 1. Find matching counterpart invoice or order
  const matchingInvoice = (targetCol === 'invoices')
    ? order
    : (freeInvoices || []).find((inv: any) =>
        inv.sourceOrderId === order.id ||
        inv.orderId === order.id ||
        inv.id === order.id ||
        (order.invoiceNumber && inv.invoiceNumber === order.invoiceNumber)
      );

  // 2. Authoritative totals: invoice totals take precedence over a 0€ draft order
  const invoiceTotals = matchingInvoice ? calculateOrderTotals(matchingInvoice) : null;
  const orderTotals = calculateOrderTotals(order);
  const effectiveTotals = (invoiceTotals && invoiceTotals.gross > 0) ? invoiceTotals : orderTotals;
  const totalGross = effectiveTotals.gross;
  
  // 3. Combined payments from order and invoice
  const initialPayments = (order.payments && order.payments.length > 0)
    ? order.payments
    : (matchingInvoice?.payments || []);

  const [payments, setPayments] = useState<any[]>(initialPayments);
  
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

  const syncPaymentToFirestore = async (updatedPayments: any[], newStatus: string) => {
    let orderDocId: string | null = null;
    let invoiceDocId: string | null = null;

    if (targetCol === 'invoices') {
      invoiceDocId = order.id;
      orderDocId = order.sourceOrderId || null;
    } else {
      orderDocId = order.id;
      const matchingInvoice = (freeInvoices || []).find((inv: any) =>
        inv.sourceOrderId === order.id ||
        inv.orderId === order.id ||
        inv.id === order.id ||
        (order.invoiceNumber && inv.invoiceNumber === order.invoiceNumber)
      );
      invoiceDocId = matchingInvoice?.id || null;
    }

    // Lookup invoice by invoiceNumber if not found in props
    if (!invoiceDocId && order.invoiceNumber) {
      try {
        const qSnap = await getDocs(query(collection(db, 'invoices'), where('invoiceNumber', '==', order.invoiceNumber)));
        if (!qSnap.empty) {
          invoiceDocId = qSnap.docs[0].id;
        }
      } catch (err) {
        console.error('Error finding invoice for payment sync:', err);
      }
    }

    // Lookup order by orderNumber if not found in props
    if (!orderDocId && targetCol === 'invoices' && (order.sourceOrderNumber || order.orderNumber)) {
      try {
        const qOrderSnap = await getDocs(query(collection(db, 'orders'), where('orderNumber', '==', order.sourceOrderNumber || order.orderNumber)));
        if (!qOrderSnap.empty) {
          orderDocId = qOrderSnap.docs[0].id;
        }
      } catch (err) {
        console.error('Error finding order for payment sync:', err);
      }
    }

    const batch = writeBatch(db);

    // 1. Update the primary document being edited
    batch.update(doc(db, targetCol, order.id), {
      payments: updatedPayments,
      status: newStatus,
      ...((order.totals && order.totals.gross > 0) ? {} : { totals: effectiveTotals }),
      updatedAt: serverTimestamp()
    });

    // 2. Synchronize the counterpart order document
    if (orderDocId && orderDocId !== order.id) {
      batch.update(doc(db, 'orders', orderDocId), {
        payments: updatedPayments,
        status: newStatus,
        totals: effectiveTotals,
        updatedAt: serverTimestamp()
      });
    }

    // 3. Synchronize the counterpart invoice document
    if (invoiceDocId && invoiceDocId !== order.id) {
      batch.update(doc(db, 'invoices', invoiceDocId), {
        payments: updatedPayments,
        status: newStatus,
        totals: effectiveTotals,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
  };

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

    try {
      const hasInvoiceNumber = Boolean(order.invoiceNumber || targetCol === 'invoices' || order.status?.startsWith('invoice_'));
      const newStatus2 = hasInvoiceNumber 
        ? (newTotalPaid >= totalGross ? 'invoice_paid' : 'invoice_open')
        : (newTotalPaid >= totalGross ? 'completed' : (order.status || 'confirmed'));
      
      await syncPaymentToFirestore(updatedPayments, newStatus2);

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

    try {
      const hasInvoiceNumber = Boolean(order.invoiceNumber || targetCol === 'invoices' || order.status?.startsWith('invoice_'));
      const newStatus2 = hasInvoiceNumber
        ? (newTotalPaid >= totalGross ? 'invoice_paid' : 'invoice_open')
        : (order.status || 'confirmed');
      
      await syncPaymentToFirestore(updatedPayments, newStatus2);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <CurrencyEuroIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-slate-900 dark:text-white">
                Zahlung erfassen
              </h3>
              <p className="text-xs text-slate-400">
                {order.invoiceNumber ? `Rechnung: ${order.invoiceNumber}` : `Auftrag: #${order.orderNumber || order.id?.slice(-5).toUpperCase()}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Rechnung</span>
            <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white font-headline">
              € {totalGross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-center">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">Bezahlt</span>
            <span className="font-extrabold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 font-headline">
              € {totalPaid.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className={`p-3.5 rounded-2xl border text-center ${
            remaining > 0
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
          }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${
              remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
            }`}>
              Offen
            </span>
            <span className={`font-extrabold text-sm sm:text-base font-headline ${
              remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
            }`}>
              € {remaining.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Payment Form */}
        {remaining > 0 ? (
          <div className="space-y-3 bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-headline">
                Neue Zahlung verbuchen
              </label>
              {remaining > 0 && amount !== remaining && (
                <button
                  type="button"
                  onClick={() => setAmount(remaining)}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Restbetrag übernehmen (€ {remaining.toFixed(2)})
                </button>
              )}
            </div>

            <form onSubmit={addPayment} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Amount input with integrated prefix addon - ZERO overlap */}
                <div className="sm:col-span-7 flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-500 transition-all shadow-xs">
                  <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700/60 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center select-none shrink-0">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-300 font-mono">€</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remaining > 0 ? remaining : undefined}
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-transparent text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden font-mono"
                    placeholder="0.00"
                  />
                </div>

                {/* Payment method selector */}
                <div className="sm:col-span-5">
                  <select
                    value={method}
                    onChange={e => setMethod(e.target.value as any)}
                    className="w-full h-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40 transition-all shadow-xs"
                  >
                    <option value="bar">Bar (Bargeld)</option>
                    <option value="ueberweisung">Überweisung</option>
                    <option value="ec-karte">EC-Karte / Terminal</option>
                    <option value="paypal">PayPal</option>
                    <option value="guthaben" disabled={availableCredits.length === 0}>Guthaben</option>
                  </select>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSaving || !amount}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Wird gespeichert...</span>
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-4 h-4" />
                    <span>Zahlungseingang jetzt erfassen</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : totalGross > 0 ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <CheckCircleIcon className="w-5 h-5" />
            <span>Rechnung ist vollständig bezahlt.</span>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span>Kein Rechnungsbetrag hinterlegt (0,00 €). Bitte Positionen in der Rechnung prüfen.</span>
          </div>
        )}

        {/* Quick-Transfer Guthaben Buttons */}
        {availableCredits.length > 0 && remaining > 0 && (
          <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
              Verfügbares Kundenguthaben verrechnen
            </div>
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
                      
                      await syncPaymentToFirestore(updatedPayments, newStatus);
                      
                      const actualSourceCol = credit.doc.sourceOrderId ? 'invoices' : 'orders';
                      const sourcePayment = {
                        id: `transfer-${transferId}`,
                        amount: -transferAmount,
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
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>Aus {credit.sourceName} übernehmen</span>
                  <span className="font-mono font-bold">+ € {transferAmount.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Payment History */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 font-headline uppercase tracking-wider">
            <span>Bisherige Zahlungen</span>
            <span>{payments.length} Einträge</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
            {payments.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4 italic">
                Noch keine Zahlungen erfasst.
              </p>
            ) : (
              payments.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                      €
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                        € {p.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="capitalize font-medium text-slate-600 dark:text-slate-300">{p.method}</span>
                        <span>•</span>
                        <span>{p.date ? new Date(p.date.toMillis ? p.date.toMillis() : p.date).toLocaleDateString('de-DE') : 'Unbekannt'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Zahlung löschen"
                    onClick={() => removePayment(p.id)}
                    disabled={isSaving}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                    title="Zahlungseingang stornieren / löschen"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
