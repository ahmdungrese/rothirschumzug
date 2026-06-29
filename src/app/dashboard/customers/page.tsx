"use client";
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';
import { SmartCustomerCard } from '@/components/customers/SmartCustomerCard';
import { SmartCustomerTable } from '@/components/customers/SmartCustomerTable';
import { QuickCreateCustomer } from '@/components/customers/QuickCreateCustomer';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    // 1. Fetch Customers
    const qCustomers = query(collection(db, getCol('customers')));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      const fetched = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((c: any) => !c.isArchived); // Filter out archived
      setCustomers(fetched);
    }, (error) => {
      console.error("Error fetching customers", error);
    });

    // 2. Fetch Orders (active orders only, skipping archived and cancelled)
    const qOrders = query(collection(db, getCol('orders')));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const fetched = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((o: any) => o.status !== 'archived' && o.status !== 'invoice_cancelled' && o.status !== 'rejected');
      
      // Sort newest first
      fetched.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
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

  // 3. Client-Side Search and Map latest order
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    
    // Map latest order to each customer
    const customersWithOrders = customers.map(customer => {
      // Find the first (newest) order for this customer
      const customerOrders = orders.filter(o => o.customerId === customer.id);
      
      // We want to prioritize "active" action-needed orders if multiple exist
      // e.g., if one is draft and one is completed, draft might be more relevant for action, 
      // but usually taking the newest by creation date is fine for moving companies.
      const latestOrder = customerOrders[0] || null;
      
      return { ...customer, latestOrder };
    });

    // Sort: Bring customers with action needed to the top
    const priorityStatuses = ['draft', 'quote', 'clarification', 'invoice_open', 'invoice_overdue'];
    customersWithOrders.sort((a, b) => {
      const aPriority = a.latestOrder && priorityStatuses.includes(a.latestOrder.status) ? 1 : 0;
      const bPriority = b.latestOrder && priorityStatuses.includes(b.latestOrder.status) ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority; // Priority first
      
      // Then newest order
      const aTime = a.latestOrder?.createdAt?.toMillis?.() || Date.now();
      const bTime = b.latestOrder?.createdAt?.toMillis?.() || Date.now();
      return bTime - aTime;
    });

    // Filter by search query
    if (!q) return customersWithOrders;

    return customersWithOrders.filter(c => {
      const nameMatch = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(q);
      const emailMatch = (c.email || '').toLowerCase().includes(q);
      const phoneMatch = (c.phone || '').toLowerCase().includes(q);
      const cityAMatch = (c.latestOrder?.logistics?.a_city || '').toLowerCase().includes(q);
      const cityBMatch = (c.latestOrder?.logistics?.b_city || '').toLowerCase().includes(q);
      
      return nameMatch || emailMatch || phoneMatch || cityAMatch || cityBMatch;
    });
  }, [customers, orders, searchQuery]);

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
          <p className="text-text-muted mt-1">Smarte Übersicht aller Kunden und ihrer aktuellsten Aufträge.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search Bar (Zero Cost Firebase) */}
          <div className="relative w-full sm:w-[300px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-text-muted" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-full"
              placeholder="Name, Stadt, Telefon..."
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-main"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Create Button */}
          <Link 
            href="/dashboard/orders/new"
            className="btn-primary py-2 px-4 shadow-lg shrink-0 whitespace-nowrap flex items-center"
          >
            <PlusIcon className="w-5 h-5 mr-1" /> Neuer Kunde (via Angebot)
          </Link>
        </div>
      </div>

      {/* Responsive View */}
      <div className="md:hidden">
        {filteredCustomers.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl text-text-muted italic border border-white/5">
            {searchQuery ? "Keine Kunden für diesen Suchbegriff gefunden." : "Noch keine Kunden vorhanden."}
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
