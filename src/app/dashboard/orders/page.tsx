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
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getCol } from '@/lib/demoMode';
import { SmartOrderTable } from '@/components/orders/SmartOrderTable';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
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
      const angeboteOnly = fetched.filter((o: any) => !o.invoiceNumber); // EXCLUDE INVOICES
      angeboteOnly.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      setOrders(angeboteOnly);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders", error);
      setLoading(false);
    });

    const unsubscribeCustomers = onSnapshot(query(collection(db, getCol('customers'))), (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(fetched);
      setLoadingCustomers(false);
    }, (error) => {
      console.error("Error fetching customers", error);
      setLoadingCustomers(false);
    });

    return () => {
      unsubscribe();
      unsubscribeCustomers();
    };
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
      toast.success("Angebot gelöscht!");
      setDeleteConfirmOrder(null);
    } catch (error) {
      console.error("Error deleting", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const handleStorno = async (order: any) => {
    if (confirm("Möchten Sie diese Rechnung wirklich stornieren?")) {
      try {
        await updateDoc(doc(db, getCol('orders'), order.id), { status: 'canceled' });
        toast.success("Erfolgreich storniert");
      } catch (error) {
        console.error("Fehler", error);
        toast.error("Fehler beim Stornieren");
      }
    }
  };


  // --- Calculations ---
  const openQuotes = orders.filter(o => o.status === 'quote');
  const openQuotesValue = openQuotes.reduce((sum, o) => sum + (o.totals?.gross || o.calcInput?.gross || 0), 0);
  
  const activeMoves = orders.filter(o => o.status === 'confirmed');

  const filteredOrders = orders.filter(order => {
    const customer = customers.find(c => c.id === order.customerId);
    const displayName = customer 
      ? (customer.type === 'firma' ? customer.lastName : `${customer.firstName || ''} ${customer.lastName || ''}`.trim())
      : (order.customerName || '');

    const matchesSearch = 
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading || loadingCustomers) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Angebote & Disposition</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => setStatusFilter(statusFilter === 'quote' ? 'all' : 'quote')}
          className={`bg-bg-dark rounded-xl p-4 border shadow-sm transition-colors cursor-pointer ${statusFilter === 'quote' ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-structure hover:border-blue-500/50'}`}
        >
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

        <div 
          onClick={() => setStatusFilter(statusFilter === 'confirmed' ? 'all' : 'confirmed')}
          className={`bg-bg-dark rounded-xl p-4 border shadow-sm transition-colors cursor-pointer ${statusFilter === 'confirmed' ? 'border-primary ring-1 ring-primary/50' : 'border-structure hover:border-primary/50'}`}
        >
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
            <option value="draft">Entwürfe</option>
            <option value="quote">Offene Angebote</option>
            <option value="confirmed">Bestätigt (Umzüge)</option>
            <option value="completed">Abgeschlossen</option>
            <option value="canceled">Storniert</option>
          </select>
        </div>
      </div>

      <SmartOrderTable 
        orders={filteredOrders} 
        customers={customers}
        onGenerateInvoice={generateInvoice}
        onUpdateStatus={updateStatus}
        onDuplicate={duplicateOrder}
        onDelete={setDeleteConfirmOrder}
        onDispo={setDispoOrder}
        onStorno={handleStorno}
      />

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
        title="Angebot löschen"
        message="Möchten Sie dieses Angebot wirklich unwiderruflich löschen?"
        confirmText="Löschen"
        isDestructive={true}
        onConfirm={confirmDeleteOrder}
        onCancel={() => setDeleteConfirmOrder(null)}
      />
    </div>
  );
}
