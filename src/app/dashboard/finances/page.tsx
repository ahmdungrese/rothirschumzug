"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function FinancesPage() {
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['invoice_open', 'invoice_overdue', 'completed'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const open = invoices.filter((inv: any) => {
        const totalGross = inv.totals?.gross || 0;
        let totalPaid = 0;
        if (inv.payments && Array.isArray(inv.payments)) {
          totalPaid = inv.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        }
        return (totalGross - totalPaid) > 0;
      });
      
      setOpenInvoices(open);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalOpenAmount = openInvoices.reduce((sum, inv) => {
    const gross = inv.totals?.gross || 0;
    const paid = inv.payments?.reduce((s: number, p: any) => s + p.amount, 0) || 0;
    return sum + (gross - paid);
  }, 0);

  const filteredInvoices = openInvoices.filter(inv => 
    inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-panel border border-structure p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <BanknotesIcon className="w-8 h-8 text-primary" /> Offene Rechnungen
          </h1>
          <p className="text-text-muted mt-1">Überwachung von Zahlungseingängen und Mahnwesen.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-text-muted font-medium uppercase tracking-wider">Gesamt Offen</div>
            <div className="text-2xl font-bold text-red-400">€ {totalOpenAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="panel min-h-[500px]">
        <div className="mb-4">
          <input 
            type="text" 
            placeholder="Suchen nach Kunde oder Rechnungsnummer..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full md:w-96"
          />
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center p-12 bg-bg-dark rounded-xl border border-structure">
            <BanknotesIcon className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
            <p className="text-white font-semibold">Keine offenen Rechnungen gefunden.</p>
            <p className="text-text-muted text-sm mt-1">Gute Arbeit! Alle Rechnungen sind bezahlt.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-dark text-text-muted text-sm border-b border-structure">
                  <th className="p-4 font-medium">Rechnungsnr.</th>
                  <th className="p-4 font-medium">Kunde</th>
                  <th className="p-4 font-medium">Datum</th>
                  <th className="p-4 font-medium text-right">Brutto</th>
                  <th className="p-4 font-medium text-right text-red-400">Offen</th>
                  <th className="p-4 font-medium text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const gross = inv.totals?.gross || 0;
                  const paid = inv.payments?.reduce((s: number, p: any) => s + p.amount, 0) || 0;
                  const open = gross - paid;
                  const isOverdue = inv.status === 'invoice_overdue';
                  
                  return (
                    <tr key={inv.id} className="border-b border-structure/50 hover:bg-structure/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{inv.invoiceNumber || '-'}</span>
                          {isOverdue && <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Mahnung</span>}
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-white">{inv.customerName || 'Unbekannt'}</td>
                      <td className="p-4 text-text-muted text-sm">
                        {inv.createdAt?.toDate().toLocaleDateString('de-DE') || '-'}
                      </td>
                      <td className="p-4 text-right text-text-muted font-medium">€ {gross.toFixed(2)}</td>
                      <td className="p-4 text-right text-red-400 font-bold">€ {open.toFixed(2)}</td>
                      <td className="p-4 text-right">
                        <Link href={`/dashboard/customers/${inv.customerId}`} className="btn-secondary text-sm">
                          Öffnen
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
