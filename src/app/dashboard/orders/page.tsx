"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import { 
  DocumentTextIcon, 
  BanknotesIcon, 
  PlusIcon, 
  DocumentPlusIcon, 
  AdjustmentsHorizontalIcon, 
  PencilSquareIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowsUpDownIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  CurrencyEuroIcon,
  CheckCircleIcon,
  TruckIcon,
  EllipsisVerticalIcon,
  FolderOpenIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { PaymentManager } from '@/components/orders/PaymentManager';
import { OrderDetailsDrawer } from '@/components/dashboard/OrderDetailsDrawer';
import { SignatureModal } from '@/components/orders/SignatureModal';
import { PdfModal } from '@/components/ui/PdfModal';
import { calculateOrderTotals, calculateTotalPaid } from '@/lib/financeHelpers';

type SortOption = 'urgency' | 'created_desc' | 'amount_desc' | 'name_asc';
type StatusFilterTab = 'all' | 'confirmed' | 'quote' | 'draft' | 'completed';

function getOrderMoveDate(order: any): Date | null {
  const raw = order.orderMeta?.movingDateFrom || order.movingDate || order.logistics?.movingDate;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function getMoveUrgencyBadge(order: any) {
  const d = getOrderMoveDate(order);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'Heute', className: 'bg-[#6E8F64] text-white shadow-xs font-bold' };
  if (diffDays === 1) return { label: 'Morgen', className: 'bg-orange-500 text-white shadow-xs font-bold' };
  if (diffDays > 1 && diffDays <= 7) return { label: `in ${diffDays} Tg.`, className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-semibold' };
  if (diffDays < 0) return { label: `vor ${Math.abs(diffDays)} Tg.`, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium' };
  return null;
}

interface OrderActionsDropdownProps {
  order: any;
  onOpenPdf: (order: any) => void;
  onOpenDrawer: (order: any) => void;
  onOpenSign: (order: any) => void;
  onOpenPayment: (order: any) => void;
}

function OrderActionsDropdown({
  order,
  onOpenPdf,
  onOpenDrawer,
  onOpenSign,
  onOpenPayment,
}: OrderActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 224; // w-56
      const menuHeight = 240;
      const x = Math.max(12, rect.right - menuWidth);
      const spaceBelow = window.innerHeight - rect.bottom;
      const y = spaceBelow < menuHeight ? Math.max(10, rect.top - menuHeight - 6) : rect.bottom + 6;
      setCoords({ x, y });
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleScroll() {
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const editUrl = order.customerId 
    ? `/dashboard/customers/${order.customerId}/edit-order/${order.id}` 
    : `/dashboard/orders/new?orderId=${order.id}`;

  const invoiceUrl = order.customerId
    ? `/dashboard/customers/${order.customerId}/edit-invoice/${order.id}`
    : null;

  const canSign = ['quote', 'clarification'].includes(order.status) && 
    !(order.signature || order.orderMeta?.customerSignature || order.orderMeta?.signedContractScan);

  const canInvoice = ['confirmed', 'completed'].includes(order.status) && !order.invoiceNumber && Boolean(invoiceUrl);

  const hasPayments = Boolean(order.invoiceNumber || order.status?.startsWith('invoice_') || (order.payments && order.payments.length > 0));

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors inline-flex items-center justify-center cursor-pointer border border-slate-200/80 dark:border-slate-700 shadow-2xs"
        title="Aktionen"
      >
        <EllipsisVerticalIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.y, left: coords.x }}
          className="w-56 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 dark:divide-slate-800 text-left"
        >
          {/* Main Actions */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenPdf(order);
              }}
              className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
            >
              <DocumentTextIcon className="w-4 h-4 mr-2.5 text-[#6E8F64]" />
              <span>PDF Vorschau & Druck</span>
            </button>

            <Link
              href={editUrl}
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <PencilSquareIcon className="w-4 h-4 mr-2.5 text-blue-500" />
              <span>Angebot bearbeiten</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenDrawer(order);
              }}
              className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2.5 text-[#6E8F64]" />
              <span>Cockpit & Prüfung</span>
            </button>
          </div>

          {/* Contextual Next Step */}
          {(canSign || canInvoice || hasPayments) && (
            <div className="py-1">
              {canSign && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSign(order);
                  }}
                  className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-left cursor-pointer"
                >
                  <PencilSquareIcon className="w-4 h-4 mr-2.5 text-amber-500" />
                  <span>Digital Signieren</span>
                </button>
              )}

              {canInvoice && (
                <Link
                  href={invoiceUrl!}
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors text-left"
                >
                  <DocumentPlusIcon className="w-4 h-4 mr-2.5 text-emerald-500" />
                  <span>Rechnung erstellen</span>
                </Link>
              )}

              {hasPayments && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenPayment(order);
                  }}
                  className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                >
                  <BanknotesIcon className="w-4 h-4 mr-2.5 text-blue-500" />
                  <span>Zahlungen verwalten</span>
                </button>
              )}
            </div>
          )}

          {/* Customer Link */}
          {order.customerId && (
            <div className="py-1">
              <Link
                href={`/dashboard/customers/${order.customerId}`}
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center px-3.5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
              >
                <FolderOpenIcon className="w-4 h-4 mr-2.5 text-slate-400" />
                <span>Kundenakte öffnen</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [customersMap, setCustomersMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<any>(null);
  const [drawerOrder, setDrawerOrder] = useState<any | null>(null);
  const [signOrder, setSignOrder] = useState<any | null>(null);
  const [pdfOrder, setPdfOrder] = useState<any | null>(null);
  const [pdfModalType, setPdfModalType] = useState<'order' | 'contract' | 'invoice'>('order');

  // Filter & Search & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<StatusFilterTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('urgency');

  useEffect(() => {
    // 1. Fetch Orders
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['draft', 'clarification', 'quote', 'confirmed', 'completed', 'canceled', 'rejected'])
    );
    
    const unsubOrders = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter(o => o.type !== 'invoice' && !o.isStorno);
        
      setOrders(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders", error);
      setLoading(false);
    });

    // 2. Fetch Customers for accurate PDF names and modal data
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const map = new Map<string, any>();
      snapshot.docs.forEach(doc => {
        map.set(doc.id, { id: doc.id, ...doc.data() });
      });
      setCustomersMap(map);
    });

    return () => {
      unsubOrders();
      unsubCustomers();
    };
  }, []);

  const handleOpenPdf = (order: any) => {
    let type: 'order' | 'contract' | 'invoice' = 'order';
    if (order.invoiceNumber) {
      type = 'invoice';
    } else if (['confirmed', 'completed'].includes(order.status) || order.isManuallySigned || order.contractSigned) {
      type = 'contract';
    }
    setPdfModalType(type);
    setPdfOrder(order);
  };

  // Status badge styling
  const getStatusBadge = (order: any) => {
    if (order.invoiceNumber || (order.invoiceHistory && order.invoiceHistory.length > 0)) {
      return (
        <span className="px-2.5 py-0.5 bg-slate-500/15 text-slate-600 dark:text-slate-400 rounded-md text-[11px] font-bold uppercase tracking-wider border border-slate-500/20 whitespace-nowrap">
          Abgerechnet
        </span>
      );
    }

    const status = order.status;
    
    if (status === 'invoice_open' && order.payments && order.payments.length > 0) {
      const totalGross = calculateOrderTotals(order).gross;
      const totalPaid = calculateTotalPaid(order);
      if (totalPaid > 0 && totalPaid < totalGross) {
        return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-md text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">Teilw. bezahlt</span>;
      }
    }

    switch(status) {
      case 'draft': return <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-semibold uppercase tracking-wider border border-slate-200 dark:border-slate-700 whitespace-nowrap">Entwurf</span>;
      case 'clarification': return <span className="px-2.5 py-0.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-md text-[11px] font-semibold uppercase tracking-wider border border-purple-500/20 whitespace-nowrap">In Klärung</span>;
      case 'quote': return <span className="px-2.5 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-md text-[11px] font-semibold uppercase tracking-wider border border-blue-500/20 whitespace-nowrap">Angebot</span>;
      case 'confirmed': return <span className="px-2.5 py-0.5 bg-[#6E8F64]/20 text-[#435E3A] dark:text-[#A8C69F] rounded-md text-[11px] font-bold uppercase tracking-wider border border-[#6E8F64]/30 whitespace-nowrap">Bestätigt</span>;
      case 'completed': return <span className="px-2.5 py-0.5 bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#A8C69F] rounded-md text-[11px] font-semibold uppercase tracking-wider border border-[#6E8F64]/20 whitespace-nowrap">Erledigt</span>;
      case 'canceled': return <span className="px-2.5 py-0.5 bg-red-900/20 text-red-500 rounded-md text-[11px] font-semibold uppercase tracking-wider line-through border border-red-500/20 whitespace-nowrap">Storniert</span>;
      case 'rejected': return <span className="px-2.5 py-0.5 bg-red-900/20 text-red-400 rounded-md text-[11px] font-semibold uppercase tracking-wider line-through border border-red-500/20 whitespace-nowrap">Abgelehnt</span>;
      default: return <span className="px-2.5 py-0.5 bg-structure text-text-muted rounded-md text-[11px] font-semibold whitespace-nowrap">{status}</span>;
    }
  };

  // KPI Computations
  const stats = useMemo(() => {
    let totalGross = 0;
    let confirmedSum = 0;
    let quoteSum = 0;
    let draftSum = 0;

    let confirmedCount = 0;
    let quoteCount = 0;
    let draftCount = 0;
    let completedCount = 0;

    orders.forEach(o => {
      const gross = calculateOrderTotals(o).gross || 0;
      totalGross += gross;

      if (o.status === 'confirmed') {
        confirmedCount++;
        confirmedSum += gross;
      } else if (['quote', 'clarification'].includes(o.status)) {
        quoteCount++;
        quoteSum += gross;
      } else if (o.status === 'draft') {
        draftCount++;
        draftSum += gross;
      } else if (['completed', 'canceled', 'rejected'].includes(o.status) || Boolean(o.invoiceNumber)) {
        completedCount++;
      }
    });

    return {
      all: orders.length,
      totalGross,
      confirmedCount,
      confirmedSum,
      quoteCount,
      quoteSum,
      draftCount,
      draftSum,
      completedCount,
    };
  }, [orders]);

  // Filtered & Sorted orders
  const processedOrders = useMemo(() => {
    let result = [...orders];

    // 1. Status Filter Tab
    if (filterTab === 'confirmed') {
      result = result.filter(o => o.status === 'confirmed');
    } else if (filterTab === 'quote') {
      result = result.filter(o => ['quote', 'clarification'].includes(o.status));
    } else if (filterTab === 'draft') {
      result = result.filter(o => o.status === 'draft');
    } else if (filterTab === 'completed') {
      result = result.filter(o => ['completed', 'canceled', 'rejected'].includes(o.status) || Boolean(o.invoiceNumber));
    }

    // 2. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(o => {
        const name = (o.customerName || '').toLowerCase();
        const num = (o.orderNumber || o.invoiceNumber || o.id || '').toLowerCase();
        const cityA = (o.logistics?.a_city || '').toLowerCase();
        const cityB = (o.logistics?.b_city || '').toLowerCase();
        return name.includes(q) || num.includes(q) || cityA.includes(q) || cityB.includes(q);
      });
    }

    // 3. Smart Sorting
    result.sort((a, b) => {
      if (sortBy === 'urgency') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dateA = getOrderMoveDate(a);
        const dateB = getOrderMoveDate(b);

        const isAUpcoming = dateA && dateA.getTime() >= today.getTime();
        const isBUpcoming = dateB && dateB.getTime() >= today.getTime();

        if (isAUpcoming && isBUpcoming) return dateA.getTime() - dateB.getTime();
        if (isAUpcoming && !isBUpcoming) return -1;
        if (!isAUpcoming && isBUpcoming) return 1;

        if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
        if (a.status !== 'confirmed' && b.status === 'confirmed') return 1;

        const isAQuote = ['quote', 'clarification'].includes(a.status);
        const isBQuote = ['quote', 'clarification'].includes(b.status);
        if (isAQuote && !isBQuote) return -1;
        if (!isAQuote && isBQuote) return 1;

        if (a.status === 'draft' && b.status !== 'draft') return -1;
        if (a.status !== 'draft' && b.status === 'draft') return 1;

        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tB - tA;
      }

      if (sortBy === 'created_desc') {
        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tB - tA;
      }

      if (sortBy === 'amount_desc') {
        const amtA = a.totals?.gross || 0;
        const amtB = b.totals?.gross || 0;
        return amtB - amtA;
      }

      if (sortBy === 'name_asc') {
        const nameA = (a.customerName || '').toLowerCase();
        const nameB = (b.customerName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }

      return 0;
    });

    return result;
  }, [orders, filterTab, searchQuery, sortBy]);

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 max-w-7xl mx-auto">
      
      {/* Top Header Card (Matching finances/page.tsx layout) */}
      <div className="bg-bg-panel border border-structure p-5 md:p-6 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold font-headline text-text-main flex items-center gap-2.5">
                <DocumentTextIcon className="w-7 h-7 text-primary" />
                Angebote & Aufträge
              </h1>
            </div>
            <p className="text-xs md:text-sm text-text-muted mt-1">
              Verwalten Sie alle Umzugsangebote, bearbeiten Sie Kalkulationen und steuern Sie Aufträge direkt über das Cockpit.
            </p>
          </div>

          <Link 
            href="/dashboard/orders/new" 
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold text-xs shadow-md shadow-primary/20 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            Neues Angebot
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Bestätigt */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Bestätigte Aufträge
            </span>
            <div className="w-8 h-8 rounded-full bg-[#6E8F64]/15 flex items-center justify-center">
              <CheckCircleIcon className="w-4 h-4 text-[#6E8F64]" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-[#435E3A] dark:text-[#A8C69F]">
            € {stats.confirmedSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            {stats.confirmedCount} aktive Aufträge terminiert / in Durchführung
          </span>
        </div>

        {/* KPI 2: In Verhandlung */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              In Verhandlung / Angebote
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <DocumentTextIcon className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-blue-600 dark:text-blue-400">
            € {stats.quoteSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            {stats.quoteCount} Angebote versendet & offen
          </span>
        </div>

        {/* KPI 3: Entwürfe */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Entwürfe in Arbeit
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-500/10 flex items-center justify-center">
              <PencilSquareIcon className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-slate-700 dark:text-slate-300">
            € {stats.draftSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            {stats.draftCount} Entwürfe noch nicht versendet
          </span>
        </div>

        {/* KPI 4: Gesamtvolumen */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Gesamtvolumen (Aktiv)
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <CurrencyEuroIcon className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-text-main">
            € {stats.totalGross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            Aus {stats.all} Gesamtvorgängen
          </span>
        </div>
      </section>

      {/* Main Content Area: Filter Bar + Compact Table */}
      <div className="bg-bg-panel border border-structure rounded-3xl overflow-hidden shadow-sm">
        
        {/* Filter Bar & Search (Matching finances/page.tsx) */}
        <div className="p-4 md:p-5 border-b border-structure bg-bg-dark/40 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-bg-panel border border-structure rounded-2xl">
            {[
              { id: 'all', label: 'Alle', count: stats.all },
              { id: 'confirmed', label: 'Bestätigt', count: stats.confirmedCount },
              { id: 'quote', label: 'Angebote', count: stats.quoteCount },
              { id: 'draft', label: 'Entwürfe', count: stats.draftCount },
              { id: 'completed', label: 'Erledigt', count: stats.completedCount },
            ].map(tab => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id as StatusFilterTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-headline transition-all flex items-center gap-2 ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-muted hover:text-text-main hover:bg-structure/30'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-structure text-text-muted'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input & Sort Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64 md:w-72">
              <MagnifyingGlassIcon className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Suche nach Kunde, Nr., Ort..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bg-panel border border-structure rounded-xl pl-9 pr-8 py-2 text-xs text-text-main placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 shrink-0">
              <ArrowsUpDownIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-bg-panel border border-structure rounded-xl px-2.5 py-2 text-xs text-text-main focus:border-primary outline-none font-medium cursor-pointer shadow-xs"
              >
                <option value="urgency">Dringlichkeit</option>
                <option value="created_desc">Neueste zuerst</option>
                <option value="amount_desc">Höchste Summe</option>
                <option value="name_asc">Kunde (A - Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Compact Table View (Single-line per order, matching finances/page.tsx) */}
        {processedOrders.length === 0 ? (
          <div className="text-center p-14 m-6 rounded-2xl bg-bg-dark/50 border border-structure">
            <DocumentTextIcon className="w-12 h-12 text-text-muted/40 mx-auto mb-3" />
            <h3 className="text-text-main font-bold font-headline text-base">Keine Aufträge gefunden</h3>
            <p className="text-xs text-text-muted mt-1">
              {searchQuery ? "Keine Treffer für deine Suchkriterien." : "In dieser Kategorie befinden sich aktuell keine Aufträge."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-structure bg-bg-dark/30 text-text-muted">
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] font-headline whitespace-nowrap">Nr.</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] font-headline whitespace-nowrap">Kunde</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] font-headline whitespace-nowrap">Route</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] font-headline whitespace-nowrap">Umzugstermin</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] font-headline whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] font-headline text-right whitespace-nowrap">Summe (Brutto)</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] font-headline text-right whitespace-nowrap">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-structure">
                {processedOrders.map((order) => {
                  const urgencyBadge = getMoveUrgencyBadge(order);
                  const moveDate = getOrderMoveDate(order);
                  const gross = calculateOrderTotals(order).gross || 0;
                  const totalPaid = calculateTotalPaid(order);
                  const openAmount = Math.max(0, gross - totalPaid);

                  const orderNumDisplay = order.invoiceNumber 
                    ? order.invoiceNumber 
                    : (order.orderNumber || (order.status === 'quote' ? 'Angebot' : 'Entwurf'));

                  const routeDisplay = (order.logistics?.a_city || order.logistics?.b_city)
                    ? `${order.logistics?.a_city || '?'} ➔ ${order.logistics?.b_city || '?'}`
                    : '-';

                  return (
                    <tr 
                      key={order.id} 
                      className="hover:bg-structure/20 transition-colors"
                    >
                      {/* 1. Nummer */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <DocumentTextIcon className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <span className="font-bold font-headline text-text-main block">
                              {orderNumDisplay}
                            </span>
                            <span className="text-[10px] text-text-muted block">
                              {new Date(order.createdAt?.toMillis() || Date.now()).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Kunde */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {order.customerId ? (
                          <Link 
                            href={`/dashboard/customers/${order.customerId}`}
                            className="font-semibold text-text-main hover:text-primary transition-colors inline-flex items-center gap-1 group"
                            title="Kundenakte öffnen"
                          >
                            <span>{order.customerName || `Kunde ID: ${order.customerId?.slice(0, 8)}...`}</span>
                            <ArrowTopRightOnSquareIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                          </Link>
                        ) : (
                          <span className="font-semibold text-text-main">{order.customerName || 'Kunde'}</span>
                        )}
                      </td>

                      {/* 3. Route */}
                      <td className="py-3 px-4 whitespace-nowrap text-text-muted font-medium">
                        {routeDisplay}
                      </td>

                      {/* 4. Umzugstermin */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {moveDate ? (
                          <div className="flex items-center gap-1.5">
                            <CalendarDaysIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-semibold text-text-main">
                              {moveDate.toLocaleDateString('de-DE')}
                            </span>
                            {urgencyBadge && (
                              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${urgencyBadge.className}`}>
                                {urgencyBadge.label}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted italic text-[11px]">Nach Absprache</span>
                        )}
                      </td>

                      {/* 5. Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(order)}
                          {order.payments && order.payments.length > 0 && (
                            <span className="text-[10px] text-text-muted bg-structure/50 px-1.5 py-0.2 rounded-full border border-structure flex items-center gap-1 font-medium">
                              <BanknotesIcon className="w-3 h-3 text-[#6E8F64]" />
                              {order.payments.length}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Summe (Brutto) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-text-main">
                        <div>
                          <span className="font-bold font-headline block">
                            € {gross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {order.payments && order.payments.length > 0 && order.status !== 'invoice_paid' && (
                            <span className="text-[10px] text-primary font-bold block">
                              Offen: € {openAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Aktionen: 3-Punkte Menü */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex justify-end">
                          <OrderActionsDropdown
                            order={order}
                            onOpenPdf={handleOpenPdf}
                            onOpenDrawer={setDrawerOrder}
                            onOpenSign={setSignOrder}
                            onOpenPayment={setSelectedPaymentOrder}
                          />
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

      {/* PDF Modal (Instant Preview & Download) */}
      {pdfOrder && (
        <PdfModal
          order={pdfOrder}
          customer={customersMap.get(pdfOrder.customerId) || pdfOrder.billingAddress || { firstName: pdfOrder.customerName || 'Kunde', lastName: '' }}
          type={pdfModalType}
          onClose={() => setPdfOrder(null)}
        />
      )}

      {/* Payment Manager Modal */}
      {selectedPaymentOrder && (
        <PaymentManager 
          order={selectedPaymentOrder} 
          onUpdate={() => {}} 
          onClose={() => setSelectedPaymentOrder(null)} 
        />
      )}

      {/* Order Details Cockpit Drawer */}
      {drawerOrder && (
        <OrderDetailsDrawer
          order={drawerOrder}
          customer={customersMap.get(drawerOrder.customerId)}
          onClose={() => setDrawerOrder(null)}
          onRefresh={() => {
            const updated = orders.find(o => o.id === drawerOrder.id);
            if (updated) setDrawerOrder(updated);
          }}
        />
      )}

      {/* Signature Modal */}
      {signOrder && (
        <SignatureModal
          order={signOrder}
          onClose={() => setSignOrder(null)}
          onSigned={async () => {
            try {
              if (signOrder.status !== 'confirmed') {
                await updateDoc(doc(db, 'orders', signOrder.id), {
                  status: 'confirmed'
                });
              }
              toast.success('Auftrag erfolgreich unterschrieben und bestätigt!');
            } catch (err) {
              console.error(err);
            }
            setSignOrder(null);
          }}
        />
      )}
    </div>
  );
}
