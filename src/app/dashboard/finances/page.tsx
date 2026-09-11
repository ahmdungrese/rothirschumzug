"use client";
import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { 
  BanknotesIcon, 
  DocumentTextIcon, 
  CheckBadgeIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  CurrencyEuroIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { PaymentManager } from '@/components/orders/PaymentManager';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';

export default function FinancesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'all' | 'paid' | 'overdue'>('open');

  useEffect(() => {
    // All invoices (both for orders and standalone) are stored in the invoices collection
    const unsubInvoices = onSnapshot(query(collection(db, 'invoices')), (snapshot) => {
      const allInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter out drafts that are not finalized invoices
      const finalizedInvoices = allInvoices.filter(inv => !!inv.invoiceNumber);

      finalizedInvoices.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      
      setInvoices(finalizedInvoices);
      setLoading(false);
    });

    return () => { unsubInvoices(); };
  }, []);

  // Overdue calculation helper
  const isInvoiceOverdue = (inv: any) => {
    if (inv.status === 'canceled' || inv.status === 'invoice_cancelled' || inv.isStorno) return false;
    if (calculateOpenAmount(inv) <= 0) return false;
    if (inv.status === 'invoice_overdue') return true;
    
    const createdDate = inv.createdAt?.toDate ? inv.createdAt.toDate() : (inv.createdAt ? new Date(inv.createdAt) : null);
    if (inv.dueDate) {
      return new Date(inv.dueDate).getTime() < Date.now();
    }
    if (createdDate) {
      const defaultDue = new Date(createdDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      return defaultDue.getTime() < Date.now();
    }
    return false;
  };

  // KPI Computations
  const stats = useMemo(() => {
    let totalGross = 0;
    let totalPaid = 0;
    let totalOpen = 0;
    let openCount = 0;
    let paidCount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    invoices.forEach(inv => {
      const isCanceled = inv.status === 'canceled' || inv.status === 'invoice_cancelled' || inv.isStorno;
      if (isCanceled) return;

      const gross = calculateOrderTotals(inv).gross;
      const paid = calculateTotalPaid(inv);
      const open = calculateOpenAmount(inv);

      totalGross += gross;
      totalPaid += paid;
      totalOpen += open;

      if (open > 0) {
        openCount++;
        if (isInvoiceOverdue(inv)) {
          overdueCount++;
          overdueAmount += open;
        }
      } else if (gross > 0 && paid >= gross) {
        paidCount++;
      }
    });

    return {
      totalGross,
      totalPaid,
      totalOpen,
      openCount,
      paidCount,
      overdueCount,
      overdueAmount,
      totalCount: invoices.length
    };
  }, [invoices]);

  // Tab Filtering
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const isCanceled = inv.status === 'canceled' || inv.status === 'invoice_cancelled' || inv.isStorno;
      const openAmount = calculateOpenAmount(inv);
      const gross = calculateOrderTotals(inv).gross;
      const paid = calculateTotalPaid(inv);

      // Tab constraint
      if (activeTab === 'open') {
        if (isCanceled || openAmount <= 0) return false;
      } else if (activeTab === 'paid') {
        if (isCanceled || openAmount > 0 || gross === 0 || paid < gross) return false;
      } else if (activeTab === 'overdue') {
        if (!isInvoiceOverdue(inv)) return false;
      }

      // Search constraint
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesCustomer = (inv.customerName || '').toLowerCase().includes(query);
        const matchesNumber = (inv.invoiceNumber || '').toLowerCase().includes(query);
        return matchesCustomer || matchesNumber;
      }

      return true;
    });
  }, [invoices, activeTab, searchTerm]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* Top Header */}
      <div className="bg-bg-panel border border-structure p-5 md:p-6 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold font-headline text-text-main flex items-center gap-2.5">
                <BanknotesIcon className="w-7 h-7 text-primary" />
                Rechnungen & Finanzen
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest font-headline">
                Rothirsch v4.0
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Fakturierungsübersicht, Zahlungsabgleich und offene Kundenforderungen in Echtzeit
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gesamt Offen */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Gesamt Offen
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-primary">
            € {stats.totalOpen.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            {stats.openCount} offene Rechnung{stats.openCount === 1 ? '' : 'en'} ausstehend
          </span>
        </div>

        {/* KPI 2: Bereits Bezahlt */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Bereits Vereinnahmt
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckBadgeIcon className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-emerald-500">
            € {stats.totalPaid.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            {stats.paidCount} Rechnungen vollständig beglichen
          </span>
        </div>

        {/* KPI 3: Fakturiertes Volumen */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Fakturiert (Brutto)
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <CurrencyEuroIcon className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-text-main">
            € {stats.totalGross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            Aus {stats.totalCount} Rechnungsbelegen
          </span>
        </div>

        {/* KPI 4: Überfällig */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Überfällig ({'>'}14 Tage)
            </span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stats.overdueCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-structure text-text-muted'}`}>
              <ClockIcon className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl lg:text-3xl font-bold font-headline ${stats.overdueCount > 0 ? 'text-amber-500' : 'text-text-main'}`}>
            {stats.overdueCount} <span className="text-sm font-normal text-text-muted">({(stats.overdueAmount > 0 ? `€ ${stats.overdueAmount.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '0 €')})</span>
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            {stats.overdueCount > 0 ? 'Mahnungen prüfen oder Kontaktieren' : 'Keine überfälligen Rechnungen'}
          </span>
        </div>
      </section>

      {/* Main Content Area: Controls + Table */}
      <div className="bg-bg-panel border border-structure rounded-3xl overflow-hidden shadow-sm">
        
        {/* Filter Bar & Search */}
        <div className="p-4 md:p-5 border-b border-structure bg-bg-dark/40 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-bg-panel border border-structure rounded-2xl">
            <button
              onClick={() => setActiveTab('open')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold font-headline transition-all flex items-center gap-2 ${
                activeTab === 'open'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-main hover:bg-structure/30'
              }`}
            >
              Offen
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'open' ? 'bg-white/20 text-white' : 'bg-structure text-text-muted'
              }`}>
                {stats.openCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold font-headline transition-all flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-main hover:bg-structure/30'
              }`}
            >
              Alle
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-structure text-text-muted'
              }`}>
                {stats.totalCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('paid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold font-headline transition-all flex items-center gap-2 ${
                activeTab === 'paid'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-main hover:bg-structure/30'
              }`}
            >
              Bezahlt
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'paid' ? 'bg-white/20 text-white' : 'bg-structure text-text-muted'
              }`}>
                {stats.paidCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold font-headline transition-all flex items-center gap-2 ${
                activeTab === 'overdue'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-main hover:bg-structure/30'
              }`}
            >
              Überfällig
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'overdue' ? 'bg-white/20 text-white' : stats.overdueCount > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-structure text-text-muted'
              }`}>
                {stats.overdueCount}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <MagnifyingGlassIcon className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Suche nach Kunde oder RE-Nr...." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg-panel border border-structure rounded-xl pl-9 pr-4 py-2 text-xs text-text-main placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Invoice Table / View */}
        {loading ? (
          <div className="flex justify-center items-center p-20">
            <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-primary rounded-full"></div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center p-14 m-6 rounded-2xl bg-bg-dark/50 border border-structure">
            {activeTab === 'open' ? (
              <>
                <CheckBadgeIcon className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
                <h3 className="text-text-main font-bold font-headline text-base">Keine offenen Rechnungen!</h3>
                <p className="text-xs text-text-muted mt-1">Alle Rechnungsbeträge wurden vollständig ausgeglichen.</p>
              </>
            ) : activeTab === 'overdue' ? (
              <>
                <CheckBadgeIcon className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
                <h3 className="text-text-main font-bold font-headline text-base">Keine überfälligen Rechnungen</h3>
                <p className="text-xs text-text-muted mt-1">Alle Kunden zahlen pünktlich innerhalb der Zahlungsfrist.</p>
              </>
            ) : (
              <>
                <DocumentTextIcon className="w-12 h-12 text-text-muted/40 mx-auto mb-3" />
                <h3 className="text-text-main font-bold font-headline text-base">Keine Rechnungen gefunden</h3>
                <p className="text-xs text-text-muted mt-1">Überprüfe deine Suchkriterien oder erstelle neue Rechnungen in den Aufträgen.</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-structure bg-bg-dark/30 text-text-muted">
                  <th className="py-3.5 px-5 font-bold uppercase tracking-wider text-[10px] font-headline">Rechnungsnr.</th>
                  <th className="py-3.5 px-5 font-bold uppercase tracking-wider text-[10px] font-headline">Kunde</th>
                  <th className="py-3.5 px-5 font-bold uppercase tracking-wider text-[10px] font-headline">Status</th>
                  <th className="py-3.5 px-5 font-bold uppercase tracking-wider text-[10px] font-headline">Datum / Frist</th>
                  <th className="py-3.5 px-5 font-bold uppercase tracking-wider text-[10px] font-headline text-right">Brutto</th>
                  <th className="py-3.5 px-5 font-bold uppercase tracking-wider text-[10px] font-headline text-right">Bezahlt</th>
                  <th className="py-3.5 px-5 font-bold uppercase tracking-wider text-[10px] font-headline text-right">Offen</th>
                  <th className="py-3.5 px-5 font-bold uppercase tracking-wider text-[10px] font-headline text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-structure">
                {filteredInvoices.map(inv => {
                  const gross = calculateOrderTotals(inv).gross;
                  const paid = calculateTotalPaid(inv);
                  const isCanceled = inv.status === 'canceled' || inv.status === 'invoice_cancelled' || inv.isStorno;
                  const open = calculateOpenAmount(inv);
                  const overdue = isInvoiceOverdue(inv);

                  const createdStr = inv.createdAt?.toDate 
                    ? inv.createdAt.toDate().toLocaleDateString('de-DE') 
                    : (inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('de-DE') : '-');

                  return (
                    <tr 
                      key={inv.id} 
                      className={`hover:bg-structure/20 transition-colors ${isCanceled ? 'opacity-50' : ''}`}
                    >
                      {/* Rechnungsnr */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <DocumentTextIcon className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <span className="font-bold font-headline text-text-main block">
                              {inv.invoiceNumber || '-'}
                            </span>
                            {inv.isStorno && (
                              <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">
                                Storno-Beleg
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kunde */}
                      <td className="py-3.5 px-5">
                        {inv.customerId ? (
                          <Link 
                            href={`/dashboard/customers/${inv.customerId}`}
                            className="font-semibold text-text-main hover:text-primary transition-colors inline-flex items-center gap-1 group"
                          >
                            <span>{inv.customerName || 'Unbekannter Kunde'}</span>
                            <ArrowTopRightOnSquareIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                          </Link>
                        ) : (
                          <span className="font-semibold text-text-main">{inv.customerName || 'Unbekannt'}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        {isCanceled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-headline bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-wider">
                            <XCircleIcon className="w-3 h-3" /> Storniert
                          </span>
                        ) : overdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-headline bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                            <ClockIcon className="w-3 h-3" /> Überfällig
                          </span>
                        ) : (
                          <StatusBadge status={inv.status} payments={inv.payments} totals={{ gross }} />
                        )}
                      </td>

                      {/* Datum */}
                      <td className="py-3.5 px-5 whitespace-nowrap text-text-muted">
                        {createdStr}
                      </td>

                      {/* Brutto */}
                      <td className="py-3.5 px-5 text-right font-medium text-text-main whitespace-nowrap">
                        € {gross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Bezahlt */}
                      <td className="py-3.5 px-5 text-right font-semibold text-emerald-500 whitespace-nowrap">
                        € {paid.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Offen */}
                      <td className="py-3.5 px-5 text-right font-bold whitespace-nowrap">
                        <span className={open > 0 ? (overdue ? 'text-amber-500 font-headline' : 'text-primary font-headline') : 'text-text-muted'}>
                          € {isCanceled ? '0,00' : open.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Aktionen */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCanceled && (
                            <button 
                              onClick={() => setSelectedPaymentOrder(inv)}
                              className="px-2.5 py-1 rounded-xl text-xs font-semibold font-headline bg-primary/10 hover:bg-primary text-primary hover:text-white transition-all border border-primary/20 flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Zahlung verbuchen"
                            >
                              <BanknotesIcon className="w-3.5 h-3.5" />
                              Zahlung
                            </button>
                          )}
                          <Link 
                            href={`/dashboard/customers/${inv.customerId || ''}?orderId=${inv.id}&pdfType=invoice`} 
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold font-headline bg-structure/50 hover:bg-structure text-text-main transition-colors border border-structure flex items-center gap-1 shadow-2xs"
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

      {/* Payment Manager Modal */}
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

