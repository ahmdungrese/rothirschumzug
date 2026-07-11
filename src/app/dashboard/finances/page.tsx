"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { BanknotesIcon, DocumentTextIcon, CheckBadgeIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { getCol } from '@/lib/demoMode';
import { PaymentManager } from '@/components/orders/PaymentManager';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';

export default function FinancesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'all'>('open');

  useEffect(() => {
    // All invoices (both for orders and standalone) are now in the invoices collection
    const unsubInvoices = onSnapshot(query(collection(db, getCol('invoices'))), (snapshot) => {
      const allInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter out drafts that are not finalized invoices
      const finalizedInvoices = allInvoices.filter(inv => !!inv.invoiceNumber);

      finalizedInvoices.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      
      setInvoices(finalizedInvoices);
      setLoading(false);
    });

    return () => { unsubInvoices(); };
  }, []);

  // Compute Open Invoices
  const openInvoices = invoices.filter((inv: any) => {
    if (inv.status === 'canceled') return false;
    if (inv.status === 'invoice_cancelled') return false; // Storniert = ausgeglichen
    if (inv.isStorno) return false; // Storno-Belege selbst sind keine offenen Rechnungen
    return calculateOpenAmount(inv) > 0;
  });

  const totalOpenAmount = openInvoices.reduce((sum, inv) => {
    return sum + calculateOpenAmount(inv);
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
          <div className="overflow-x-hidden md:overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="bg-structure/20 text-text-muted border-b border-structure md:table-row">
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs md:table-cell">Rechnungsnr.</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs md:table-cell">Kunde</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs md:table-cell">Status</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs md:table-cell text-right">Brutto</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs md:table-cell text-right text-emerald-400">Bezahlt</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs md:table-cell text-right text-red-400">Offen</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-xs md:table-cell text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {displayedInvoices.map(inv => {
                  const gross = calculateOrderTotals(inv).gross;
                  const paid = calculateTotalPaid(inv);
                  const isCanceled = inv.status === 'canceled' || inv.status === 'invoice_cancelled';
                  const open = calculateOpenAmount(inv);
                  
                  return (
                    <tr key={inv.id} className={`block md:table-row border border-structure md:border-none md:border-b hover:bg-white/[0.02] transition-colors p-4 md:p-0 mb-4 md:mb-0 bg-bg-dark md:bg-transparent rounded-xl md:rounded-none ${isCanceled ? 'opacity-50' : ''}`}>
                      <td className="block md:table-cell p-2 md:p-4 border-b border-structure md:border-none">
                        <div className="flex items-center justify-between md:justify-start">
                          <span className="md:hidden text-text-muted text-xs font-semibold uppercase">Rechnungsnr.</span>
                          <div className="text-right md:text-left">
                            <div className="flex items-center gap-2 justify-end md:justify-start">
                              <DocumentTextIcon className="w-4 h-4 text-primary" />
                              <span className="text-text-main font-bold">{inv.invoiceNumber || '-'}</span>
                            </div>
                            <div className="text-xs text-text-muted mt-1">
                              {inv.createdAt?.toDate().toLocaleDateString('de-DE') || '-'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="block md:table-cell p-2 md:p-4 font-semibold text-text-main border-b border-structure md:border-none">
                        <div className="flex items-center justify-between md:justify-start">
                          <span className="md:hidden text-text-muted text-xs font-semibold uppercase">Kunde</span>
                          <span>{inv.customerName || 'Unbekannt'}</span>
                        </div>
                      </td>
                      <td className="block md:table-cell p-2 md:p-4 border-b border-structure md:border-none">
                        <div className="flex items-center justify-between md:justify-start">
                          <span className="md:hidden text-text-muted text-xs font-semibold uppercase">Status</span>
                          {isCanceled ? (
                            <span className="text-xs text-red-400 flex items-center gap-1 font-bold bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 w-fit">
                              <XCircleIcon className="w-3 h-3" /> Storniert
                            </span>
                          ) : (
                            <StatusBadge status={inv.status} payments={inv.payments} totals={{ gross }} />
                          )}
                        </div>
                      </td>
                      <td className="block md:table-cell p-2 md:p-4 md:text-right text-text-main font-medium border-b border-structure md:border-none">
                        <div className="flex items-center justify-between md:justify-end">
                          <span className="md:hidden text-text-muted text-xs font-semibold uppercase">Brutto</span>
                          <span>€ {gross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td className="block md:table-cell p-2 md:p-4 md:text-right text-emerald-400 font-medium border-b border-structure md:border-none">
                        <div className="flex items-center justify-between md:justify-end">
                          <span className="md:hidden text-text-muted text-xs font-semibold uppercase">Bezahlt</span>
                          <span>€ {paid.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td className="block md:table-cell p-2 md:p-4 md:text-right text-red-400 font-bold border-b border-structure md:border-none">
                        <div className="flex items-center justify-between md:justify-end">
                          <span className="md:hidden text-text-muted text-xs font-semibold uppercase">Offen</span>
                          <span>€ {isCanceled ? '0,00' : open.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td className="block md:table-cell p-2 md:p-4 md:text-right mt-2 md:mt-0">
                        <div className="flex justify-end gap-2 w-full">
                          {!isCanceled && (
                            <button 
                              onClick={() => setSelectedPaymentOrder(inv)}
                              className="btn-secondary border-primary/30 hover:border-primary text-text-main py-2 px-3 text-xs flex-1 md:flex-none flex items-center justify-center gap-1"
                              title="Zahlung erfassen"
                            >
                              <BanknotesIcon className="w-4 h-4" /> Zahlung
                            </button>
                          )}
                          <Link 
                            href={`/dashboard/customers/${inv.customerId}?orderId=${inv.id}&pdfType=invoice`} 
                            className="btn-secondary py-2 px-3 text-xs flex-1 md:flex-none hover:text-primary transition-colors text-center flex items-center justify-center"
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
