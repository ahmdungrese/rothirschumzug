"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { KanbanOrderCard } from './KanbanOrderCard';
import { OrderDetailsDrawer } from './OrderDetailsDrawer';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

function getDaysUntilMove(order: any): number | null {
  const rawDate = order.orderMeta?.movingDateFrom || order.movingDate || order.logistics?.movingDate;
  if (!rawDate) return null;
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getViewingUrgency(order: any): 'upcoming' | 'overdue' | 'none' {
  const v = order.orderMeta?.viewingDate || order.viewingDate;
  if (!v || v === 'erledigt_fotos') return 'none';
  const d = new Date(v.split('T')[0]);
  if (isNaN(d.getTime())) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  return 'upcoming';
}

export function KanbanDispositionBoard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [activeMobileCol, setActiveMobileCol] = useState<'neu' | 'verhandlung' | 'bestaetigt' | 'abgeschlossen'>('bestaetigt');
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<any | null>(null);

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
      setOrders(list);
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubOrders();
    };
  }, []);

  // Filter orders by search query and source
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
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
  }, [orders, customers, searchQuery, sourceFilter]);

  // Intelligent logical sorting per column
  const { 
    columnNeu, 
    columnVerhandlung, 
    upcomingBestaetigt,
    pastBestaetigt,
    columnBestaetigt, 
    columnAbgeschlossen 
  } = useMemo(() => {
    // 1. Column Abgeschlossen
    const colAbgeschlossen = filteredOrders.filter(o => 
      o.status === 'completed' || (o.status && o.status.startsWith('invoice_')) || o.status === 'archived'
    );
    // Sort: Unbilled moves first, then newest completed
    colAbgeschlossen.sort((a, b) => {
      const aHasInvoice = Boolean(a.invoiceNumber || (a.status && a.status.startsWith('invoice_')));
      const bHasInvoice = Boolean(b.invoiceNumber || (b.status && b.status.startsWith('invoice_')));
      if (!aHasInvoice && bHasInvoice) return -1;
      if (aHasInvoice && !bHasInvoice) return 1;

      const dateA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const dateB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return dateB - dateA;
    });

    // 2. Column Bestätigt: Separate upcoming moves vs past moves
    const colBestaetigt = filteredOrders.filter(o => o.status === 'confirmed');
    const upcoming: any[] = [];
    const past: any[] = [];

    colBestaetigt.forEach(o => {
      const diff = getDaysUntilMove(o);
      if (diff !== null && diff < 0) {
        past.push(o);
      } else {
        upcoming.push(o);
      }
    });

    // Upcoming: Strictly chronological by movingDateFrom (earliest move date first)
    upcoming.sort((a, b) => {
      const diffA = getDaysUntilMove(a);
      const diffB = getDaysUntilMove(b);
      if (diffA !== null && diffB !== null) return diffA - diffB;
      if (diffA !== null && diffB === null) return -1;
      if (diffA === null && diffB !== null) return 1;
      return (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0);
    });

    // Past moves: most recent past move first
    past.sort((a, b) => {
      const diffA = getDaysUntilMove(a);
      const diffB = getDaysUntilMove(b);
      if (diffA !== null && diffB !== null) return diffB - diffA;
      return 0;
    });

    // 3. Column In Verhandlung
    const colVerhandlung = filteredOrders.filter(o => 
      o.status !== 'confirmed' && 
      o.status !== 'completed' && 
      !o.status?.startsWith('invoice_') && 
      o.status !== 'archived' &&
      (o.status === 'quote' || o.status === 'verhandlung' || Boolean(o.orderMeta?.viewingDate || o.viewingDate))
    );
    
    // Sort: Upcoming viewing date first, then moving date urgency
    colVerhandlung.sort((a, b) => {
      const urgA = getViewingUrgency(a);
      const urgB = getViewingUrgency(b);
      if (urgA === 'upcoming' && urgB !== 'upcoming') return -1;
      if (urgA !== 'upcoming' && urgB === 'upcoming') return 1;
      if (urgA === 'overdue' && urgB === 'none') return -1;
      if (urgA === 'none' && urgB === 'overdue') return 1;

      const moveA = a.orderMeta?.movingDateFrom || a.movingDate || '';
      const moveB = b.orderMeta?.movingDateFrom || b.movingDate || '';
      if (moveA && moveB) {
        return new Date(moveA).getTime() - new Date(moveB).getTime();
      }
      return 0;
    });

    // 4. Column Neu
    const colNeu = filteredOrders.filter(o => 
      !colAbgeschlossen.includes(o) &&
      !colBestaetigt.includes(o) &&
      !colVerhandlung.includes(o)
    );
    colNeu.sort((a, b) => {
      const moveA = a.orderMeta?.movingDateFrom || a.movingDate || '';
      const moveB = b.orderMeta?.movingDateFrom || b.movingDate || '';
      if (moveA && !moveB) return -1;
      if (!moveA && moveB) return 1;
      if (moveA && moveB) {
        return new Date(moveA).getTime() - new Date(moveB).getTime();
      }
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    return {
      columnNeu: colNeu,
      columnVerhandlung: colVerhandlung,
      upcomingBestaetigt: upcoming,
      pastBestaetigt: past,
      columnBestaetigt: colBestaetigt,
      columnAbgeschlossen: colAbgeschlossen,
    };
  }, [filteredOrders]);

  // Keep selectedOrderForDrawer fresh if orders update
  useEffect(() => {
    if (selectedOrderForDrawer) {
      const fresh = orders.find(o => o.id === selectedOrderForDrawer.id);
      if (fresh) setSelectedOrderForDrawer(fresh);
    }
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Ultra-Slim Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-bold font-headline text-slate-900 dark:text-white">
            Disposition
          </h2>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700/60">
            {filteredOrders.length} Aufträge
          </span>
        </div>

        {/* Compact Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kunde, Stadt, Auftragsnr..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white placeholder:text-slate-400"
          />
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
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-headline whitespace-nowrap transition-all border shrink-0 ${
                isSelected 
                  ? `${tab.color} border-transparent shadow-xs scale-102` 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : tab.dot}`} />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {/* Column 1: Neu */}
        <div className={`bg-slate-100/70 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex-col transition-all duration-300 md:min-h-[500px] ${
          activeMobileCol === 'neu' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="w-full flex items-center justify-between px-1 select-none mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-headline text-slate-800 dark:text-slate-200">
                1. Neu
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {columnNeu.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[75vh] pr-1 custom-scrollbar">
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
                  onSelect={(ord) => setSelectedOrderForDrawer(ord)}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: In Verhandlung */}
        <div className={`bg-amber-50/50 dark:bg-amber-950/15 p-3.5 rounded-2xl border border-amber-200/70 dark:border-amber-900/30 flex-col transition-all duration-300 md:min-h-[500px] ${
          activeMobileCol === 'verhandlung' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="w-full flex items-center justify-between px-1 select-none mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-headline text-slate-800 dark:text-slate-200">
                2. In Verhandlung
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              {columnVerhandlung.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[75vh] pr-1 custom-scrollbar">
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
                  onSelect={(ord) => setSelectedOrderForDrawer(ord)}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: Bestätigt */}
        <div className={`bg-[#6E8F64]/8 dark:bg-[#6E8F64]/12 p-3.5 rounded-2xl border border-[#6E8F64]/30 dark:border-[#6E8F64]/25 flex-col transition-all duration-300 md:min-h-[500px] ${
          activeMobileCol === 'bestaetigt' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="w-full flex items-center justify-between px-1 select-none mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6E8F64] shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-headline text-slate-800 dark:text-slate-200">
                3. Bestätigt
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-[#435E3A] dark:text-[#B5D1AC] border border-[#6E8F64]/30">
              {columnBestaetigt.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[75vh] pr-1 custom-scrollbar">
            {columnBestaetigt.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine bestätigten Umzüge
              </div>
            ) : (
              <>
                {/* Upcoming moves sorted by date urgency */}
                {upcomingBestaetigt.map(order => (
                  <KanbanOrderCard
                    key={order.id}
                    order={order}
                    customer={customers[order.customerId]}
                    columnId="bestaetigt"
                    onSelect={(ord) => setSelectedOrderForDrawer(ord)}
                  />
                ))}

                {/* Past moves kept cleanly at the bottom without any number badge */}
                {pastBestaetigt.length > 0 && (
                  <div className="pt-3 mt-2 border-t border-dashed border-slate-300 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[14px]">history</span>
                      <span>Vergangene Termine</span>
                    </div>
                    {pastBestaetigt.map(order => (
                      <KanbanOrderCard
                        key={order.id}
                        order={order}
                        customer={customers[order.customerId]}
                        columnId="bestaetigt"
                        onSelect={(ord) => setSelectedOrderForDrawer(ord)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 4: Abgeschlossen */}
        <div className={`bg-slate-100/70 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex-col transition-all duration-300 md:min-h-[500px] ${
          activeMobileCol === 'abgeschlossen' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="w-full flex items-center justify-between px-1 select-none mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-headline text-slate-800 dark:text-slate-200">
                4. Erledigt
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {columnAbgeschlossen.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[75vh] pr-1 custom-scrollbar">
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
                  onSelect={(ord) => setSelectedOrderForDrawer(ord)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Slide-Over Order Details Drawer */}
      {selectedOrderForDrawer && (
        <OrderDetailsDrawer
          order={selectedOrderForDrawer}
          customer={customers[selectedOrderForDrawer.customerId]}
          onClose={() => setSelectedOrderForDrawer(null)}
          onRefresh={() => {
            // Firestore real-time listener will auto-update
          }}
        />
      )}
    </div>
  );
}
