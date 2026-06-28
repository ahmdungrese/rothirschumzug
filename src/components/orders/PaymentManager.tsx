"use client";
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { BanknotesIcon, XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getCol } from '@/lib/demoMode';

export function PaymentManager({ order, onUpdate, onClose }: { order: any, onUpdate: () => void, onClose: () => void }) {
  const [payments, setPayments] = useState<any[]>(order.payments || []);
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<'bar' | 'ueberweisung' | 'ec-karte' | 'paypal'>('bar');
  const [isSaving, setIsSaving] = useState(false);

  const totalGross = order.totals?.gross || 0;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, totalGross - totalPaid);

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="panel w-full max-w-lg shadow-2xl relative border-t-4 border-t-primary animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 text-text-muted hover:text-text-main">
          <XMarkIcon className="w-6 h-6" />
        </button>

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

        <form onSubmit={addPayment} className="flex gap-2 mb-6 p-4 bg-bg-dark/50 rounded-xl border border-structure/50">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">€</span>
              <input 
                type="number" 
                step="0.01" 
                max={remaining > 0 ? remaining : undefined}
                value={amount} 
                onChange={e => setAmount(Number(e.target.value))} 
                className="input-field pl-8 w-full" 
                placeholder="Betrag"
                required
              />
            </div>
          </div>
          <select 
            value={method} 
            onChange={e => setMethod(e.target.value as any)}
            className="input-field w-36 bg-bg-dark"
          >
            <option value="bar">Bar</option>
            <option value="ueberweisung">Überweisung</option>
            <option value="ec-karte">EC-Karte</option>
            <option value="paypal">PayPal</option>
          </select>
          <button type="submit" disabled={isSaving || !amount} className="btn-primary px-3">
            <PlusIcon className="w-5 h-5" />
          </button>
        </form>

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
    </div>
  );
}
