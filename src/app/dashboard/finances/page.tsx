"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { BanknotesIcon, DocumentTextIcon, CheckBadgeIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { getCol } from '@/lib/demoMode';
import { PaymentManager } from '@/components/orders/PaymentManager';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function FinancesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'all'>('open');

  useEffect(() => {
    // Fetch all orders that have an invoiceNumber.
    const q = query(
      collection(db, getCol('orders'))
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allInvoices = allOrders.filter((o: any) => !!o.invoiceNumber);
      
      // Sort by date descending
      allInvoices.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      
      setInvoices(allInvoices);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute Open Invoices
  const openInvoices = invoices.filter((inv: any) => {
    if (inv.status === 'canceled') return false;
    const gross = inv.totals?.gross || inv.calcInput?.gross || 0;
    const paid = (inv.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
    return (gross - paid) > 0;
  });

  const totalOpenAmount = openInvoices.reduce((sum, inv) => {
    const gross = inv.totals?.gross || inv.calcInput?.gross || 0;
    const paid = inv.payments?.reduce((s: number, p: any) => s + p.amount, 0) || 0;
    return sum + (gross - paid);
  }, 0);

  // Apply Search & Tab Filter
  const displayedInvoices = (activeTab === 'open' ? openInvoices : invoices).filter(inv => 
    (inv.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header & KPI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-panel border border-structure p-6 rounded-xl shadow-lg relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-main flex items-center gap-3">
            <BanknotesIcon className="w-8 h-8 text-primary" /> Rechnungen
          </h1>
          <p className="text-text-muted mt-1">Verwalten Sie hier alle offenen und abgeschlossenen Rechnungen.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-bg-dark border border-structure px-6 py-4 rounded-xl shadow-inner">
          <div className="p-3 bg-red-500/10 rounded-full">
            <ExclamationCircleIcon className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="text-xs text-text-muted font-medium uppercase tracking-wider">Gesamt Offen</div>
            <div className="text-2xl font-bold text-red-400">€ {totalOpenAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="panel min-h-[500px] p-0 overflow-hidden">
        
        {/* Tabs & Search Header */}
        <div className="p-4 border-b border-structure bg-bg-dark/50 flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Tabs */}
          <div className="flex bg-structure/30 p-1 rounded-lg w-full md:w-auto">
            <button
              onClick={() => setActiveTab('open')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'open' 
                  ? 'bg-bg-panel text-text-main shadow border border-structure/50' 
                  : 'text-text-muted hover:text-text-main hover:bg-structure/50'
              }`}
            >
              Offene Rechnungen
              <span className={`ml-2 text-xs py-0.5 px-2 rounded-full ${activeTab === 'open' ? 'bg-primary/20 text-primary' : 'bg-structure text-text-muted'}`}>
                {openInvoices.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'all' 
                  ? 'bg-bg-panel text-text-main shadow border border-structure/50' 
                  : 'text-text-muted hover:text-text-main hover:bg-structure/50'
              }`}
            >
              Alle Rechnungen
              <span className={`ml-2 text-xs py-0.5 px-2 rounded-full ${activeTab === 'all' ? 'bg-primary/20 text-primary' : 'bg-structure text-text-muted'}`}>
                {invoices.length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="w-full md:w-80">
            <input 
              type="text" 
              placeholder="Suche nach Kunde oder RE-Nummer..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-structure/50 border border-structure rounded-lg px-4 py-2 text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        {/* Table Area */}
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>
        ) : displayedInvoices.length === 0 ? (
          <div className="text-center p-12 bg-bg-dark m-4 rounded-xl border border-structure">
            {activeTab === 'open' ? (
              <>
                <CheckBadgeIcon className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
                <p className="text-text-main font-semibold text-lg">Keine offenen Rechnungen!</p>
                <p className="text-text-muted mt-1">Gute Arbeit, alle Kunden haben bezahlt.</p>
              </>
            ) : (
              <>
                <DocumentTextIcon className="w-12 h-12 text-text-muted/50 mx-auto mb-3" />
                <p className="text-text-main font-semibold">Keine Rechnungen gefunden.</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-structure/20 text-text-muted border-b border-structure">
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs">Rechnungsnr.</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs">Kunde</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right">Brutto</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right text-emerald-400">Bezahlt</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right text-red-400">Offen</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-structure">
                {displayedInvoices.map(inv => {
                  const gross = inv.totals?.gross || inv.calcInput?.gross || 0;
                  const paid = inv.payments?.reduce((s: number, p: any) => s + p.amount, 0) || 0;
                  const open = Math.max(0, gross - paid);
                  const isCanceled = inv.status === 'canceled';
                  
                  return (
                    <tr key={inv.id} className={`hover:bg-white/[0.02] transition-colors ${isCanceled ? 'opacity-50' : ''}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <DocumentTextIcon className="w-4 h-4 text-primary" />
                          <span className="text-text-main font-bold">{inv.invoiceNumber || '-'}</span>
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          {inv.createdAt?.toDate().toLocaleDateString('de-DE') || '-'}
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-text-main">{inv.customerName || 'Unbekannt'}</td>
                      <td className="p-4">
                        {isCanceled ? (
                          <span className="text-xs text-red-400 flex items-center gap-1 font-bold bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 w-fit">
                            <XCircleIcon className="w-3 h-3" /> Storniert
                          </span>
                        ) : (
                          <StatusBadge status={inv.status} payments={inv.payments} totals={{ gross }} />
                        )}
                      </td>
                      <td className="p-4 text-right text-text-main font-medium">€ {gross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-emerald-400 font-medium">€ {paid.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-red-400 font-bold">€ {isCanceled ? '0,00' : open.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {!isCanceled && (
                            <button 
                              onClick={() => setSelectedPaymentOrder(inv)}
                              className="btn-secondary border-primary/30 hover:border-primary text-text-main py-1.5 px-3 text-xs flex items-center gap-1"
                              title="Zahlung erfassen"
                            >
                              <BanknotesIcon className="w-4 h-4" /> Zahlung
                            </button>
                          )}
                          <Link 
                            href={`/dashboard/customers/${inv.customerId}?orderId=${inv.id}&pdfType=invoice`} 
                            className="btn-secondary py-1.5 px-3 text-xs hover:text-primary transition-colors"
                          >
                            Öffnen
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPaymentOrder && (
        <PaymentManager 
          order={selectedPaymentOrder} 
          onUpdate={() => {}} 
          onClose={() => setSelectedPaymentOrder(null)} 
        />
      )}
    </div>
  );
}
