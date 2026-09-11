"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { KanbanOrderCard } from './KanbanOrderCard';
import Link from 'next/link';

export function KanbanDispositionBoard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [activeMobileCol, setActiveMobileCol] = useState<'neu' | 'verhandlung' | 'bestaetigt' | 'abgeschlossen'>('bestaetigt');

  useEffect(() => {
    const qOrders = query(collection(db, 'orders'));
    const qCustomers = query(collection(db, 'customers'));

    const unsubCustomers = onSnapshot(qCustomers, (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setCustomers(map);
    });

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const timeA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setOrders(list);
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubOrders();
    };
  }, []);

  // Filter orders by search term and source
  const filteredOrders = orders.filter((order) => {
    const cust = customers[order.customerId] || {};
    const name = `${cust.firstName || ''} ${cust.lastName || ''} ${cust.company || ''} ${order.customerName || ''}`.toLowerCase();
    const city = `${order.logistics?.from?.city || ''} ${order.logistics?.to?.city || ''}`.toLowerCase();
    const orderNum = (order.orderNumber || order.id || '').toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || 
                          city.includes(searchQuery.toLowerCase()) ||
                          orderNum.includes(searchQuery.toLowerCase());

    const orderSource = (cust.source || order.orderMeta?.source || order.source || '').toLowerCase();
    const matchesSource = sourceFilter === 'all' || orderSource.includes(sourceFilter.toLowerCase());

    return matchesSearch && matchesSource;
  });

  // Categorize orders into the 4 mutually exclusive columns
  const columnAbgeschlossen = filteredOrders.filter(o => 
    o.status === 'completed' || (o.status && o.status.startsWith('invoice_')) || o.status === 'archived'
  );

  const columnBestaetigt = filteredOrders.filter(o => 
    o.status === 'confirmed'
  );

  const columnVerhandlung = filteredOrders.filter(o => 
    o.status !== 'confirmed' && 
    o.status !== 'completed' && 
    !o.status?.startsWith('invoice_') && 
    o.status !== 'archived' &&
    (o.status === 'quote' || o.status === 'verhandlung' || Boolean(o.orderMeta?.viewingDate || o.viewingDate))
  );

  const columnNeu = filteredOrders.filter(o => 
    !columnAbgeschlossen.includes(o) &&
    !columnBestaetigt.includes(o) &&
    !columnVerhandlung.includes(o)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold font-headline text-slate-900 dark:text-white">
              Einsatzzentrale
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest font-headline">
              Rothirsch v4.0
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Übersicht aller aktiven Umzüge, Statusprüfungen und Logistik-Checklisten
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kunde, Stadt, Auftragsnr..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          {/* New Order Button */}
          <Link
            href="/dashboard/orders/new"
            className="btn-primary py-2 px-4 md:py-2.5 md:px-5 rounded-full text-xs font-bold whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Neuer Auftrag
          </Link>
        </div>
      </div>

      {/* Mobile Phase Quick Selector Pills (Visible on mobile only) */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {[
          { id: 'neu', label: 'Neu', count: columnNeu.length, color: 'bg-primary text-white', dot: 'bg-primary' },
          { id: 'verhandlung', label: 'Verhandlung', count: columnVerhandlung.length, color: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
          { id: 'bestaetigt', label: 'Bestätigt', count: columnBestaetigt.length, color: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
          { id: 'abgeschlossen', label: 'Erledigt', count: columnAbgeschlossen.length, color: 'bg-slate-600 text-white', dot: 'bg-slate-400' },
        ].map(tab => {
          const isSelected = activeMobileCol === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMobileCol(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold font-headline whitespace-nowrap transition-all border shrink-0 ${
                isSelected 
                  ? `${tab.color} border-transparent shadow-sm scale-105` 
                  : 'bg-bg-panel border-structure text-text-muted hover:text-text-main'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : tab.dot}`} />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/20 text-white' : 'bg-structure text-text-muted'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4 Kanban Columns with Mobile Accordion Mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 items-start">
        {/* Column 1: Neu */}
        <div className={`bg-slate-100/70 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex-col transition-all duration-300 md:min-h-[500px] ${
          activeMobileCol === 'neu' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="w-full flex items-center justify-between px-2 select-none">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0"></span>
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-slate-800 dark:text-slate-200">
                Neu
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {columnNeu.length} Leads
              </span>
            </div>
          </div>

          <div className="space-y-3 mt-4 flex-1 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
            {columnNeu.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine neuen Anfragen
              </div>
            ) : (
              columnNeu.map(order => (
                <KanbanOrderCard
                  key={order.id}
                  order={order}
                  customer={customers[order.customerId]}
                  columnId="neu"
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: In Verhandlung */}
        <div className={`bg-amber-50/70 dark:bg-amber-950/20 p-4 rounded-3xl border border-amber-200/80 dark:border-amber-900/40 flex-col transition-all duration-300 md:min-h-[500px] ${
          activeMobileCol === 'verhandlung' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="w-full flex items-center justify-between px-2 select-none">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-slate-800 dark:text-slate-200">
                In Verhandlung
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {columnVerhandlung.length} Aktiv
              </span>
            </div>
          </div>

          <div className="space-y-3 mt-4 flex-1 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
            {columnVerhandlung.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine offenen Angebote
              </div>
            ) : (
              columnVerhandlung.map(order => (
                <KanbanOrderCard
                  key={order.id}
                  order={order}
                  customer={customers[order.customerId]}
                  columnId="verhandlung"
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: Bestätigt */}
        <div className={`bg-emerald-50/70 dark:bg-emerald-950/20 p-4 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/40 flex-col transition-all duration-300 md:min-h-[500px] ${
          activeMobileCol === 'bestaetigt' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="w-full flex items-center justify-between px-2 select-none">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-slate-800 dark:text-slate-200">
                Bestätigt
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {columnBestaetigt.length} Aufträge
              </span>
            </div>
          </div>

          <div className="space-y-3 mt-4 flex-1 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
            {columnBestaetigt.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine bestätigten Umzüge
              </div>
            ) : (
              columnBestaetigt.map(order => (
                <KanbanOrderCard
                  key={order.id}
                  order={order}
                  customer={customers[order.customerId]}
                  columnId="bestaetigt"
                />
              ))
            )}
          </div>
        </div>

        {/* Column 4: Abgeschlossen */}
        <div className={`bg-slate-100/70 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex-col transition-all duration-300 md:min-h-[500px] ${
          activeMobileCol === 'abgeschlossen' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="w-full flex items-center justify-between px-2 select-none">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-slate-800 dark:text-slate-200">
                Abgeschlossen
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {columnAbgeschlossen.length} Erledigt
              </span>
            </div>
          </div>

          <div className="space-y-3 mt-4 flex-1 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
            {columnAbgeschlossen.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine abgeschlossenen Umzüge
              </div>
            ) : (
              columnAbgeschlossen.map(order => (
                <KanbanOrderCard
                  key={order.id}
                  order={order}
                  customer={customers[order.customerId]}
                  columnId="abgeschlossen"
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
