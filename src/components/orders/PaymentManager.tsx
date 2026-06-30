"use client";
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { BanknotesIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/ui/Modal';
import { getCol } from '@/lib/demoMode';

export function PaymentManager({ order, onUpdate, onClose }: { order: any, onUpdate: () => void, onClose: () => void }) {
  const totalGross = order.totals?.gross ?? order.calcInput?.gross ?? 0;
  
  const [payments, setPayments] = useState<any[]>(order.payments || []);
  
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, totalGross - totalPaid);
  
  const [amount, setAmount] = useState<number | ''>(remaining > 0 ? remaining : '');
  const [method, setMethod] = useState<'bar' | 'ueberweisung' | 'ec-karte' | 'paypal'>('bar');
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
      await updateDoc(doc(db, getCol('orders'), order.id), {
        payments: updatedPayments,
        status: newStatus
      });
      setPayments(updatedPayments);
      setAmount('');
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
      await updateDoc(doc(db, getCol('orders'), order.id), {
        payments: updatedPayments,
        status: newStatus
      });
      setPayments(updatedPayments);
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
          {order.invoiceNumber && (
            <p className="text-sm text-text-muted mt-1 ml-8">Rechnung: {order.invoiceNumber}</p>
          )}
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
          <form onSubmit={addPayment} className="grid grid-cols-[1fr_140px_auto] gap-3 mb-6 p-4 bg-bg-dark/50 rounded-xl border border-structure/50 items-center shadow-inner">
            <div className="relative h-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-lg">€</span>
              <input 
                type="number" 
                step="0.01" 
                max={remaining > 0 ? remaining : undefined}
                value={amount} 
                onChange={e => setAmount(Number(e.target.value))} 
                className="input-field pl-10 w-full h-full text-xl font-bold text-white bg-black/40 border-primary/40 focus:border-primary shadow-inner" 
                placeholder="Betrag"
                required
              />
            </div>
            <select
              aria-label="Zahlungsmethode"
              value={method}
              onChange={e => setMethod(e.target.value as any)}
              className="input-field w-full h-full bg-bg-dark font-medium text-sm"
            >
              <option value="bar">Bar</option>
              <option value="ueberweisung">Überweisung</option>
              <option value="ec-karte">EC-Karte</option>
              <option value="paypal">PayPal</option>
            </select>
            <button type="submit" aria-label="Zahlung hinzufügen" disabled={isSaving || !amount} className="btn-primary h-full px-4 rounded-xl">
              <PlusIcon className="w-6 h-6" />
            </button>
          </form>
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
