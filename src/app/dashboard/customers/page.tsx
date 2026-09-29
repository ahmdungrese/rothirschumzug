"use client";
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { SmartCustomerCard } from '@/components/customers/SmartCustomerCard';
import { SmartCustomerTable } from '@/components/customers/SmartCustomerTable';
import { QuickCreateCustomer } from '@/components/customers/QuickCreateCustomer';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';

type CustomerFilterTab = 'all' | 'confirmed' | 'negotiation' | 'draft' | 'invoiced';
type CustomerSortOption = 'activity' | 'moving_date' | 'name_asc' | 'created_desc';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<CustomerFilterTab>('all');
  const [sortBy, setSortBy] = useState<CustomerSortOption>('activity');
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    // 1. Fetch Customers
    const qCustomers = query(collection(db, 'customers'));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      const fetched = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((c: any) => !c.isArchived);
      setCustomers(fetched);
    }, (error) => {
      console.error("Error fetching customers", error);
    });

    // 2. Fetch Orders
    const qOrders = query(collection(db, 'orders'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const fetched = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((o: any) => o.status !== 'archived' && o.status !== 'invoice_cancelled' && o.status !== 'rejected');
      
      setOrders(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders", error);
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubOrders();
    };
  }, []);

  // Map latest order to each customer
  const customersWithOrders = useMemo(() => {
    return customers.map(customer => {
      const customerOrders = orders.filter(o => o.customerId === customer.id);
      customerOrders.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      const latestOrder = customerOrders[0] || null;
      return { ...customer, latestOrder, allOrders: customerOrders };
    });
  }, [customers, orders]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: customersWithOrders.length,
      confirmed: customersWithOrders.filter(c => c.latestOrder?.status === 'confirmed').length,
      negotiation: customersWithOrders.filter(c => ['quote', 'clarification'].includes(c.latestOrder?.status)).length,
      draft: customersWithOrders.filter(c => c.latestOrder?.status === 'draft').length,
      invoiced: customersWithOrders.filter(c => ['invoice_open', 'invoice_overdue'].includes(c.latestOrder?.status)).length,
    };
  }, [customersWithOrders]);

  // Filter & Sort
  const filteredCustomers = useMemo(() => {
    let result = [...customersWithOrders];

    // 1. Status Filter Tab
    if (filterTab === 'confirmed') {
      result = result.filter(c => c.latestOrder?.status === 'confirmed');
    } else if (filterTab === 'negotiation') {
      result = result.filter(c => ['quote', 'clarification'].includes(c.latestOrder?.status));
    } else if (filterTab === 'draft') {
      result = result.filter(c => c.latestOrder?.status === 'draft');
    } else if (filterTab === 'invoiced') {
      result = result.filter(c => ['invoice_open', 'invoice_overdue'].includes(c.latestOrder?.status));
    }

    // 2. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => {
        const nameMatch = `${c.firstName || ''} ${c.lastName || ''} ${c.company || ''}`.toLowerCase().includes(q);
        const emailMatch = (c.email || '').toLowerCase().includes(q);
        const phoneMatch = (c.phone || '').toLowerCase().includes(q);
        const cityAMatch = (c.latestOrder?.logistics?.a_city || '').toLowerCase().includes(q);
        const cityBMatch = (c.latestOrder?.logistics?.b_city || '').toLowerCase().includes(q);
        return nameMatch || emailMatch || phoneMatch || cityAMatch || cityBMatch;
      });
    }

    // 3. Sorting
    result.sort((a, b) => {
      if (sortBy === 'activity') {
        const timeA = a.latestOrder?.updatedAt?.toMillis?.() || a.latestOrder?.createdAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const timeB = b.latestOrder?.updatedAt?.toMillis?.() || b.latestOrder?.createdAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      }
      if (sortBy === 'moving_date') {
        const rawA = a.latestOrder?.orderMeta?.movingDateFrom || a.latestOrder?.movingDate;
        const rawB = b.latestOrder?.orderMeta?.movingDateFrom || b.latestOrder?.movingDate;
        if (rawA && !rawB) return -1;
        if (!rawA && rawB) return 1;
        if (rawA && rawB) return new Date(rawA).getTime() - new Date(rawB).getTime();
        return 0;
      }
      if (sortBy === 'name_asc') {
        const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
        const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'created_desc') {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      }
      return 0;
    });

    return result;
  }, [customersWithOrders, filterTab, searchQuery, sortBy]);

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto relative pb-20">
      {/* Background Graphic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-[-1] overflow-hidden">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[2px]" />
      </div>

      {/* Header & Controls */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center z-10 relative">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-main flex items-center gap-3">
            Kunden Control Center
          </h1>
          <p className="text-text-muted mt-1 text-sm">Übersicht aller Kunden, strukturierte Status-Filter & smarte Aktivitäts-Sortierung.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Create Button */}
          <Link 
            href="/dashboard/orders/new"
            className="btn-primary py-2 px-4 shadow-lg shrink-0 whitespace-nowrap flex items-center"
          >
            <PlusIcon className="w-5 h-5 mr-1" /> Neuer Kunde (via Angebot)
          </Link>
        </div>
      </div>

      {/* Filter Tabs & Search & Sort Bar */}
      <div className="bg-white dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        {/* Row 1: Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Alle Kunden', count: counts.all, dot: 'bg-slate-400' },
            { id: 'confirmed', label: 'Bestätigt (Aktiv)', count: counts.confirmed, dot: 'bg-[#6E8F64]' },
            { id: 'negotiation', label: 'In Verhandlung', count: counts.negotiation, dot: 'bg-amber-500' },
            { id: 'draft', label: 'Entwürfe', count: counts.draft, dot: 'bg-slate-500' },
            { id: 'invoiced', label: 'Offene Zahlungen', count: counts.invoiced, dot: 'bg-red-500' },
          ].map(tab => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as CustomerFilterTab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  active
                    ? 'bg-primary text-white border-transparent shadow-sm'
                    : 'bg-slate-100/70 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : tab.dot}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  active ? 'bg-black/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Search Input & Sort Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Search box */}
          <div className="relative flex-1 sm:max-w-md">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, Stadt, Telefon, E-Mail..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-xs text-text-muted flex items-center gap-1">
              <ArrowsUpDownIcon className="w-3.5 h-3.5" />
              Sortierung:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as CustomerSortOption)}
              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-text-main focus:outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer"
            >
              <option value="activity">Letzte Aktivität (Neueste Aktion zuerst)</option>
              <option value="moving_date">Nächster Umzugstermin</option>
              <option value="name_asc">Kundenname (A - Z)</option>
              <option value="created_desc">Neueste Kunden (Erstelldatum)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Responsive View */}
      <div className="md:hidden">
        {filteredCustomers.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl text-text-muted italic border border-white/5">
            {searchQuery ? "Keine Kunden für diesen Suchbegriff gefunden." : "Keine Kunden in dieser Kategorie vorhanden."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredCustomers.map(customer => (
              <SmartCustomerCard 
                key={customer.id} 
                customer={customer} 
                latestOrder={customer.latestOrder} 
              />
            ))}
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <SmartCustomerTable customers={filteredCustomers} />
      </div>

      {/* New Customer Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-panel border border-structure p-6 rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-main">Neuen Kunden anlegen</h2>
              <button onClick={() => setShowNewModal(false)} className="text-text-muted hover:text-text-main">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <QuickCreateCustomer onClose={() => setShowNewModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
