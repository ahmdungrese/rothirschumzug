"use client";
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { XMarkIcon, BanknotesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getCol } from '@/lib/demoMode';

export function PaymentModal({ order, onClose }: { order: any, onClose: () => void }) {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<string>('Überweisung');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gross = order.totals?.gross || 0;
  const existingPayments = order.payments || [];
  const paidTotal = existingPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
  const openAmount = Math.max(0, gross - paidTotal);

  const handleAddPayment = async () => {
    if (amount <= 0) {
      toast.error('Betrag muss größer als 0 sein.');
      return;
    }
    setIsSubmitting(true);
    try {
      const newPayment = {
        id: 'pay_' + Date.now(),
        amount,
        method,
        date,
        createdAt: new Date().toISOString()
      };

      const updatedPayments = [...existingPayments, newPayment];
      const newPaidTotal = updatedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
      
      const payload: any = { 
        payments: updatedPayments, 
        updatedAt: serverTimestamp() 
      };

      // Auto-Status-Update if fully paid
      if (newPaidTotal >= gross) {
        payload.status = 'invoice_paid';
      }

      await updateDoc(doc(db, getCol('orders'), order.id), payload);
      toast.success('Zahlung erfolgreich erfasst!');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Fehler beim Speichern der Zahlung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-bg-panel border border-structure p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-main">
          <XMarkIcon className="w-6 h-6" />
        </button>
        
        <h2 className="text-xl font-bold text-text-main mb-2 flex items-center gap-2">
          <BanknotesIcon className="w-6 h-6 text-green-400" />
          Zahlung erfassen
        </h2>
        <p className="text-sm text-text-muted mb-6">Tragen Sie hier eine Teilzahlung oder die volle Summe für Rechnung {order.invoiceNumber} ein.</p>

        <div className="bg-bg-dark border border-structure rounded-xl p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Rechnungssumme:</span>
            <span className="text-text-main font-medium">€ {gross.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Bisher bezahlt:</span>
            <span className="text-green-400 font-medium">€ {paidTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-structure">
            <span className="text-text-main">Offener Restbetrag:</span>
            <span className="text-orange-400">€ {openAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Betrag (€)</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={amount || ''} 
                onChange={(e) => setAmount(parseFloat(e.target.value))} 
                className="input-field flex-1 text-lg font-bold" 
                placeholder="0.00"
              />
              <button 
                onClick={() => setAmount(openAmount)} 
                className="btn-secondary py-2 px-3 text-xs border-primary/50 text-primary hover:bg-primary/10"
              >
                Voll
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Zahlungsmethode</label>
            <select 
              value={method} 
              onChange={(e) => setMethod(e.target.value)} 
              className="input-field w-full"
            >
              <option value="Überweisung">Überweisung</option>
              <option value="Barzahlung">Barzahlung</option>
              <option value="PayPal">PayPal</option>
              <option value="EC-Karte">EC-Karte</option>
              <option value="Kreditkarte">Kreditkarte</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Zahlungsdatum</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="input-field w-full"
            />
          </div>
        </div>

        {existingPayments.length > 0 && (
          <div className="mt-6 border-t border-structure pt-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Bisherige Zahlungen</h4>
            <div className="space-y-2">
              {existingPayments.map((p: any) => (
                <div key={p.id} className="flex justify-between text-xs bg-bg-dark p-2 rounded border border-structure">
                  <span className="text-text-muted">{new Date(p.date).toLocaleDateString('de-DE')} • {p.method}</span>
                  <span className="text-green-400 font-medium">+ € {p.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button 
            onClick={handleAddPayment} 
            disabled={isSubmitting || amount <= 0} 
            className="btn-primary w-full justify-center flex items-center gap-2 py-3"
          >
            <CheckCircleIcon className="w-5 h-5" />
            {isSubmitting ? 'Speichere...' : 'Zahlung speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
