"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, where, Timestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { DocumentCheckIcon, DocumentTextIcon, DocumentIcon, BanknotesIcon, TruckIcon, PlusIcon, ChartBarIcon, CurrencyEuroIcon, CalendarDaysIcon, MagnifyingGlassIcon, FunnelIcon, ClockIcon, DocumentDuplicateIcon, TrashIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { PaymentManager } from '@/components/orders/PaymentManager';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DispoModal } from '@/components/orders/DispoModal';
import { getCol } from '@/lib/demoMode';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<any>(null);
  const [invoiceConfirmOrder, setInvoiceConfirmOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('30days');
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<any>(null);
  const router = useRouter();
  
  // Disposition Modal State
  const [dispoOrder, setDispoOrder] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    let q;
    const colRef = collection(db, getCol('orders'));
    
    if (dateFilter === 'all') {
      q = query(colRef);
    } else {
      const startDate = new Date();
      if (dateFilter === '30days') startDate.setDate(startDate.getDate() - 30);
      else if (dateFilter === '6months') startDate.setMonth(startDate.getMonth() - 6);
      else if (dateFilter === 'thisYear') {
        startDate.setMonth(0, 1);
        startDate.setHours(0,0,0,0);
      }
      q = query(colRef, where('createdAt', '>=', Timestamp.fromDate(startDate)));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setOrders(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dateFilter]);

  const fetchOrders = () => {}; // No-op for PaymentManager compatibility

  const generateInvoice = async (order: any) => {
    setInvoiceConfirmOrder(order);
  };

  const confirmGenerateInvoice = async () => {
    if (!invoiceConfirmOrder) return;
    try {
      const currentInvoices = orders.filter(o => o.invoiceNumber).map(o => {
        const parts = o.invoiceNumber.split('-');
        return parseInt(parts[2] || '0', 10);
      });
      const highestNumber = currentInvoices.length > 0 ? Math.max(...currentInvoices) : 0;
      const nextNumber = highestNumber + 1;
      const prefix = `RE-${new Date().getFullYear()}-`;
      const invoiceNumberString = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

      await updateDoc(doc(db, getCol('orders'), invoiceConfirmOrder.id), {
        status: 'invoice_open',
        invoiceNumber: invoiceNumberString,
        invoiceDate: new Date()
      });
      toast.success("Rechnung erfolgreich finalisiert!");
    } catch (error) {
      console.error("Error generating invoice", error);
      toast.error("Fehler bei der Rechnungserstellung");
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, getCol('orders'), orderId), { status: newStatus });
    } catch (error) {
      console.error("Fehler beim Status-Update", error);
    }
  };

  const duplicateOrder = async (order: any) => {
    try {
      const { id, invoiceNumber, orderNumber, invoiceDate, ...rest } = order;
      const newOrder = {
        ...rest,
        status: 'draft',
        createdAt: Timestamp.now(),
        payments: []
      };
      const docRef = await addDoc(collection(db, getCol('orders')), newOrder);
      toast.success("Auftrag dupliziert!");
      router.push(`/dashboard/customers/${order.customerId}/edit-order/${docRef.id}`);
    } catch (error) {
      console.error("Error duplicating order", error);
      toast.error("Fehler beim Duplizieren");
    }
  };

  const confirmDeleteOrder = async () => {
    if (!deleteConfirmOrder) return;
    try {
      await deleteDoc(doc(db, getCol('orders'), deleteConfirmOrder.id));
      toast.success("Auftrag gelöscht!");
      setDeleteConfirmOrder(null);
    } catch (error) {
      console.error("Error deleting", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const getStatusBadge = (order: any) => {
    const status = order.status;
    
    if (status === 'invoice_open' && order.payments && order.payments.length > 0) {
      const totalGross = order.totals?.gross || 0;
      const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      if (totalPaid > 0 && totalPaid < totalGross) {
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs font-semibold uppercase tracking-wider">Teilweise bezahlt</span>;
      }
    }

    switch(status) {
      case 'draft': return <span className="px-2 py-1 bg-structure text-text-muted rounded text-xs font-semibold uppercase tracking-wider">Entwurf</span>;
      case 'clarification': return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs font-semibold uppercase tracking-wider">In Klärung</span>;
      case 'quote': return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold uppercase tracking-wider">Angebot</span>;
      case 'confirmed': return <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-semibold uppercase tracking-wider">Bestätigt</span>;
      case 'invoice_open': return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-semibold uppercase tracking-wider">Offen</span>;
      case 'invoice_paid': return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold uppercase tracking-wider">Bezahlt</span>;
      case 'invoice_overdue': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold uppercase tracking-wider">Mahnung</span>;
      case 'canceled': return <span className="px-2 py-1 bg-red-900/30 text-red-500 rounded text-xs font-semibold uppercase tracking-wider line-through">Storniert</span>;
      case 'rejected': return <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs font-semibold uppercase tracking-wider line-through">Abgelehnt</span>;
      default: return <span className="px-2 py-1 bg-structure text-text-muted rounded text-xs">{status}</span>;
    }
  };

  // --- Calculations ---
  const openQuotes = orders.filter(o => o.status === 'quote');
  const openQuotesValue = openQuotes.reduce((sum, o) => sum + (o.totals?.gross || 0), 0);
  
  const activeMoves = orders.filter(o => o.status === 'confirmed');
  
  const openInvoices = orders.filter(o => o.status === 'invoice_open' || o.status === 'invoice_overdue');
  const openInvoicesValue = openInvoices.reduce((sum, o) => {
    const gross = o.totals?.gross || 0;
    const paid = (o.payments || []).reduce((pSum: number, p: any) => pSum + p.amount, 0);
    return sum + Math.max(0, gross - paid);
  }, 0);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Aufträge & Disposition</h1>
          <p className="text-text-muted mt-1">Verwalten Sie Angebote, teilen Sie Ressourcen ein und überwachen Sie Finanzen.</p>
        </div>
        <Link 
          href="/dashboard/orders/new" 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/20 w-fit"
        >
          <PlusIcon className="w-5 h-5" />
          Neues Angebot
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-dark rounded-xl p-4 border border-structure shadow-sm hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <DocumentTextIcon className="w-6 h-6" />
            </div>
            <h3 className="text-text-muted font-medium">Offene Angebote</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-text-main">€ {openQuotesValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-sm text-text-muted">{openQuotes.length} Vorgänge</p>
          </div>
        </div>

        <div className="bg-bg-dark rounded-xl p-4 border border-structure shadow-sm hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
              <CurrencyEuroIcon className="w-6 h-6" />
            </div>
            <h3 className="text-text-muted font-medium">Offene Rechnungen</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-text-main">€ {openInvoicesValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-sm text-text-muted">{openInvoices.length} unbezahlt</p>
          </div>
        </div>

        <div className="bg-bg-dark rounded-xl p-4 border border-structure shadow-sm hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <CalendarDaysIcon className="w-6 h-6" />
            </div>
            <h3 className="text-text-muted font-medium">Aktive Umzüge</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-text-main">{activeMoves.length}</p>
            <p className="text-sm text-text-muted">bestätigt</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-bg-dark p-4 rounded-xl border border-structure">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input 
            type="text" 
            placeholder="Suche nach Name, RE-Nummer..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-structure/50 border border-structure rounded-lg pl-10 pr-4 py-2 text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />
        </div>
        <div className="relative w-full sm:w-48">
          <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <select 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-structure/50 border border-structure rounded-lg pl-10 pr-4 py-2 text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="30days">Letzte 30 Tage</option>
            <option value="6months">Letzte 6 Monate</option>
            <option value="thisYear">Dieses Jahr</option>
            <option value="all">Alle Historie</option>
          </select>
        </div>
        <div className="relative w-full sm:w-64">
          <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-structure/50 border border-structure rounded-lg pl-10 pr-4 py-2 text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all">Alle Status</option>
            <option value="quote">Angebote</option>
            <option value="confirmed">Bestätigt (Umzüge)</option>
            <option value="invoice_open">Offene Rechnungen</option>
            <option value="invoice_overdue">In Mahnung</option>
            <option value="invoice_paid">Bezahlt</option>
          </select>
        </div>
      </div>

      <div className="panel border-t-4 border-t-primary shadow-xl overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-structure/30 text-text-muted text-sm border-b border-structure">
                <th className="px-4 py-3 font-medium">Kunde / Details</th>
                <th className="px-4 py-3 font-medium">Nummer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Summe</th>
                <th className="px-4 py-3 font-medium text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-muted italic">Keine Aufträge gefunden.</td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isMovingSoon = order.status === 'confirmed' && order.orderMeta?.movingDateFrom && 
                    new Date(order.orderMeta.movingDateFrom).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
                    
                  return (
                    <tr key={order.id} className="border-b border-structure/50 hover:bg-structure/20 transition-colors group">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/customers/${order.customerId}`} className="hover:text-primary transition-colors block">
                          <div className="font-semibold text-text-main">{order.customerName || `ID: ${order.customerId.slice(0, 8)}...`}</div>
                          {(order.logistics?.a_city || order.logistics?.b_city) && (
                            <div className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                              {order.logistics?.a_city || '?'} &rarr; {order.logistics?.b_city || '?'}
                            </div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-text-main">
                          {order.invoiceNumber ? order.invoiceNumber : (order.orderNumber || '-')}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          {new Date(order.createdAt?.toMillis() || Date.now()).toLocaleDateString('de-DE')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          {getStatusBadge(order)}
                          {isMovingSoon && (
                            <span className="text-[10px] text-orange-400 flex items-center gap-1 font-medium bg-orange-500/10 px-1.5 py-0.5 rounded">
                              <CalendarDaysIcon className="w-3 h-3" /> Umzug bald
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-text-main">€ {order.totals?.gross?.toFixed(2) || '0.00'}</div>
                        {order.payments && order.payments.length > 0 && order.status !== 'invoice_paid' && (
                          <div className="text-xs text-primary font-bold mt-0.5">
                            Offen: € {Math.max(0, (order.totals?.gross || 0) - order.payments.reduce((sum: number, p: any) => sum + p.amount, 0)).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                          {order.status === 'quote' && (
                            <button 
                              onClick={() => setDispoOrder(order)}
                              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
                              title="Bestätigen & Disponieren"
                            >
                              <TruckIcon className="w-4 h-4" /> <span className="hidden sm:inline">Dispo</span>
                            </button>
                          )}
                          
                          {order.status === 'confirmed' && (
                            <button 
                              onClick={() => generateInvoice(order)}
                              className="btn-secondary border-primary/50 text-primary py-1.5 px-3 text-xs flex items-center gap-1"
                              title="Rechnung finalisieren"
                            >
                              <DocumentCheckIcon className="w-4 h-4" /> <span className="hidden sm:inline">Rechnung</span>
                            </button>
                          )}

                          {order.invoiceNumber && (
                            <div className="flex items-center gap-2">
                              <select 
                                value={order.status} 
                                onChange={(e) => updateStatus(order.id, e.target.value)}
                                className="bg-bg-dark border border-structure text-xs rounded px-2 py-1.5 text-text-muted focus:border-primary w-24 sm:w-auto"
                              >
                                <option value="invoice_open">Offen</option>
                                <option value="invoice_paid">Bezahlt</option>
                                <option value="invoice_overdue">Mahnung</option>
                                <option value="canceled">Storno</option>
                              </select>
                              <button 
                                onClick={() => setSelectedPaymentOrder(order)}
                                className="btn-secondary py-1.5 px-2 text-xs flex items-center justify-center text-text-muted hover:text-primary"
                                title="Zahlungen verwalten"
                              >
                                <BanknotesIcon className="w-4 h-4" />
                              </button>
                              <Link 
                                href={`/dashboard/customers/${order.customerId}?orderId=${order.id}&pdfType=invoice`} 
                                className="btn-secondary py-1.5 px-2 text-xs flex items-center justify-center text-text-muted hover:text-text-main"
                                title="Zur Kundenakte / PDF"
                              >
                                <DocumentIcon className="w-4 h-4" />
                              </Link>
                            </div>
                          )}
                          
                          {/* Fallback for other statuses to view customer */}
                          {!order.invoiceNumber && order.status !== 'quote' && order.status !== 'confirmed' && (
                             <Link 
                               href={`/dashboard/customers/${order.customerId}`} 
                               className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-text-muted hover:text-text-main"
                               title="Details ansehen"
                             >
                               Details
                             </Link>
                          )}

                          {/* New Quick Actions */}
                          {order.customerEmail && (
                            <a 
                              href={`mailto:${order.customerEmail}?subject=Ihr Auftrag`}
                              className="btn-secondary py-1.5 px-2 text-xs flex items-center justify-center text-text-muted hover:text-blue-400"
                              title="E-Mail senden"
                            >
                              <EnvelopeIcon className="w-4 h-4" />
                            </a>
                          )}
                          <button 
                            onClick={() => duplicateOrder(order)}
                            className="btn-secondary py-1.5 px-2 text-xs flex items-center justify-center text-text-muted hover:text-primary"
                            title="Auftrag duplizieren"
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                          {(!order.invoiceNumber || order.status === 'canceled' || order.status === 'draft') && (
                            <button 
                              onClick={() => setDeleteConfirmOrder(order)}
                              className="btn-secondary py-1.5 px-2 text-xs flex items-center justify-center text-text-muted hover:text-red-500"
                              title="Auftrag löschen"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dispoOrder && (
        <DispoModal 
          order={dispoOrder} 
          onClose={() => setDispoOrder(null)} 
        />
      )}

      {selectedPaymentOrder && (
        <PaymentManager 
          order={selectedPaymentOrder} 
          onUpdate={fetchOrders} 
          onClose={() => setSelectedPaymentOrder(null)} 
        />
      )}

      <ConfirmModal 
        isOpen={invoiceConfirmOrder !== null}
        title="Rechnung finalisieren"
        message="Möchten Sie dieses Dokument wirklich finalisieren? Es wird eine feste Rechnungsnummer (RE-2026-XXXX) vergeben und das Dokument wird für Änderungen gesperrt."
        confirmText="Finalisieren"
        isDestructive={false}
        onConfirm={confirmGenerateInvoice}
        onCancel={() => setInvoiceConfirmOrder(null)}
      />

      <ConfirmModal 
        isOpen={deleteConfirmOrder !== null}
        title="Auftrag löschen"
        message="Möchten Sie diesen Auftrag wirklich unwiderruflich löschen?"
        confirmText="Löschen"
        isDestructive={true}
        onConfirm={confirmDeleteOrder}
        onCancel={() => setDeleteConfirmOrder(null)}
      />
    </div>
  );
}
