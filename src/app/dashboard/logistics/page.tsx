"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  CheckIcon,
  UserIcon,
  CalendarDaysIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ExclamationCircleIcon,
  ShoppingCartIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  TruckIcon,
  HomeIcon
} from '@heroicons/react/24/outline';
import { generateTickets, SystemTicket } from '@/lib/ticketEngine';
import { toggleTaskCompletion } from '@/lib/taskStateController';
import { TaskScheduleModal } from '@/components/logistics/TaskScheduleModal';
import toast from 'react-hot-toast';

export default function LogisticsPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeTodos, setActiveTodos] = useState<SystemTicket[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Status Tab: 'offen' (default) vs 'erledigt'
  const [statusTab, setStatusTab] = useState<'offen' | 'erledigt'>('offen');
  // Category Filter
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'viewing' | 'kartons' | 'halteverbot' | 'moebellift' | 'rechnung'>('all');
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state for scheduling
  const [modalTodo, setModalTodo] = useState<any>(null);
  const [modalOrder, setModalOrder] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const qOrders = query(collection(db, 'orders'));
    const qCustomers = query(collection(db, 'customers'));
    
    let currentOrders: any[] = [];
    let currentCustomers: Record<string, any> = {};

    const processData = () => {
      let allTodos: SystemTicket[] = [];

      currentOrders.forEach((o: any) => {
        const customerData = currentCustomers[o.customerId] || null;
        const systemTickets = generateTickets(o, customerData);
        systemTickets.forEach(t => {
          allTodos.push(t);
        });

        if (o.status === 'confirmed' && o.checklist && Array.isArray(o.checklist)) {
          o.checklist.forEach((t: any, i: number) => {
            allTodos.push({ 
              id: `manual_${t.id || i}`, 
              title: t.text, 
              phase: 2, 
              type: 'info', 
              done: !!t.done, 
              orderId: o.id, 
              customerId: o.customerId,
              customerName: o.customerName || 'Kunde', 
              kanbanCategory: 'general' 
            });
          });
        }
      });

      setActiveTodos(allTodos);
      setOrders(currentOrders);
      setLoading(false);
    };

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      currentOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      processData();
    });

    const unsubCustomers = onSnapshot(qCustomers, (snap) => {
      currentCustomers = {};
      snap.docs.forEach(d => {
        currentCustomers[d.id] = { id: d.id, ...d.data() };
      });
      setCustomers({ ...currentCustomers });
      processData();
    });

    return () => {
      unsubOrders();
      unsubCustomers();
    };
  }, []);

  // Filter tasks to only logistics-relevant items
  const logisticsTasks = useMemo(() => {
    return activeTodos.filter(t => {
      const isRelevant = t.id === 'viewing_requested' || ['kartons', 'halteverbot', 'moebellift', 'rechnung'].includes(t.kanbanCategory as string);
      return isRelevant;
    });
  }, [activeTodos]);

  // Count open and completed
  const openCount = logisticsTasks.filter(t => !t.done).length;
  const completedCount = logisticsTasks.filter(t => t.done).length;

  // Realtime category counts for segmented pills
  const categoryCounts = useMemo(() => {
    const base = logisticsTasks.filter(t => statusTab === 'offen' ? !t.done : t.done);
    return {
      all: base.length,
      viewing: base.filter(t => t.id === 'viewing_requested').length,
      kartons: base.filter(t => t.kanbanCategory === 'kartons').length,
      halteverbot: base.filter(t => t.kanbanCategory === 'halteverbot').length,
      moebellift: base.filter(t => t.kanbanCategory === 'moebellift').length,
      rechnung: base.filter(t => t.kanbanCategory === 'rechnung').length,
    };
  }, [logisticsTasks, statusTab]);

  // Filter based on statusTab, category, and search query
  const filteredTasks = useMemo(() => {
    return logisticsTasks.filter(t => {
      // 1. Status Filter (Offen vs Erledigt)
      const matchesStatus = statusTab === 'offen' ? !t.done : t.done;
      if (!matchesStatus) return false;

      // 2. Category Filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'viewing' && t.id !== 'viewing_requested') return false;
        if (categoryFilter !== 'viewing' && t.kanbanCategory !== categoryFilter) return false;
      }

      // 3. Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const parentOrder = orders.find(o => o.id === t.orderId);
        const custName = (t.customerName || '').toLowerCase();
        const title = (t.title || '').toLowerCase();
        const orderNum = (parentOrder?.orderNumber || t.orderId || '').toLowerCase();
        const city = `${parentOrder?.logistics?.a_city || ''} ${parentOrder?.logistics?.b_city || ''}`.toLowerCase();
        
        return custName.includes(query) || title.includes(query) || orderNum.includes(query) || city.includes(query);
      }

      return true;
    });
  }, [logisticsTasks, statusTab, categoryFilter, searchQuery, orders]);

  // Sort: Overdue first, then by phase
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (a.dueDateStatus === 'overdue' && b.dueDateStatus !== 'overdue') return -1;
      if (b.dueDateStatus === 'overdue' && a.dueDateStatus !== 'overdue') return 1;
      if (a.dueDateStatus === 'due' && b.dueDateStatus !== 'due') return -1;
      return 0;
    });
  }, [filteredTasks]);

  // Handle task completion toggle
  const handleToggleTask = async (todo: SystemTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    const parentOrder = orders.find(o => o.id === todo.orderId) || { id: todo.orderId };
    
    // Optimistic UI update
    setActiveTodos(prev => prev.map(t => (t.id === todo.id && t.orderId === todo.orderId) ? { ...t, done: !t.done } : t));

    try {
      const result = await toggleTaskCompletion(parentOrder, todo.id);
      if (result.newState) {
        toast.success(`"${todo.title}" als erledigt markiert!`);
      } else {
        toast.success(`"${todo.title}" wieder als offen markiert!`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Fehler beim Aktualisieren der Aufgabe.');
      setActiveTodos(prev => prev.map(t => (t.id === todo.id && t.orderId === todo.orderId) ? { ...t, done: !todo.done } : t));
    }
  };

  // Open modal to schedule appointment
  const openScheduleModal = (todo: SystemTicket, parentOrder: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalTodo(todo);
    setModalOrder(parentOrder);
    setIsModalOpen(true);
  };

  // WhatsApp direct helper
  const handleDirectWhatsApp = (phone: string, text?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!phone) {
      toast.error('Keine Telefonnummer beim Kunden hinterlegt!');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '49' + cleanPhone.substring(1) : cleanPhone;
    const url = text 
      ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${intlPhone}`;
    window.open(url, '_blank');
  };

  // Material summary helper for kartons
  const getMaterialsSummary = (order: any) => {
    const materials = order?.logistics?.materials || [];
    let standard = 0;
    let buecher = 0;
    let kleider = 0;
    let seidenpapier = 0;
    let klebeband = 0;

    materials.forEach((m: any) => {
      const name = (m.name || m.type || '').toLowerCase();
      const count = parseInt(m.quantity || m.count || 0) || 0;
      if (name.includes('bÃ¼cher') || name.includes('buecher') || name.includes('buch')) {
        buecher += count;
      } else if (name.includes('kleider')) {
        kleider += count;
      } else if (name.includes('seiden') || name.includes('packpapier')) {
        seidenpapier += count;
      } else if (name.includes('klebe') || name.includes('band')) {
        klebeband += count;
      } else if (name.includes('karton') || name.includes('standard')) {
        standard += count;
      }
    });

    if (Array.isArray(order?.services)) {
      order.services.forEach((s: any) => {
        const name = (s.name || '').toLowerCase();
        const count = parseInt(s.quantity || s.count || 0) || 0;
        if (name.includes('bÃ¼cher') || name.includes('buecher') || name.includes('buch')) {
          buecher += count;
        } else if (name.includes('kleider')) {
          kleider += count;
        } else if (name.includes('seiden') || name.includes('packpapier')) {
          seidenpapier += count;
        } else if (name.includes('klebe') || name.includes('band')) {
          klebeband += count;
        } else if (name.includes('karton') || name.includes('standard') || name.includes('umzugskarton')) {
          standard += count;
        }
      });
    }

    return {
      total: standard + buecher + kleider,
      standard,
      buecher,
      kleider,
      seidenpapier,
      klebeband
    };
  };

  // Badge helpers
  const getCategoryMeta = (todo: SystemTicket) => {
    if (todo.id === 'viewing_requested') {
      return { label: 'Besichtigung', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
    }
    switch (todo.kanbanCategory) {
      case 'kartons':
        return { label: 'Kartons', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' };
      case 'halteverbot':
        return { label: 'Halteverbot', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20' };
      case 'moebellift':
        return { label: 'Möbellift', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'rechnung':
        return { label: 'Rechnung', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      default:
        return { label: 'Logistik', color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
    }
  };

  // Scheduled date & time display helper
  const getScheduledDateInfo = (todo: SystemTicket, parentOrder: any) => {
    if (!parentOrder) return null;
    const isKarton = todo.id === 'kartons_liefern';
    const isHV = todo.id === 'halteverbot';
    const isLift = todo.id === 'moebellift_buchen';
    const isViewing = todo.id === 'viewing_requested';

    let date = '';
    let time = '';

    if (isKarton) {
      date = parentOrder.orderMeta?.kartonDeliveryDate || parentOrder.logistics?.boxDeliveryDate || '';
      time = parentOrder.orderMeta?.kartonDeliveryTime || '';
    } else if (isHV) {
      date = parentOrder.orderMeta?.halteverbotDate || parentOrder.logistics?.hvzDate || '';
      time = parentOrder.orderMeta?.halteverbotTime || '';
    } else if (isLift) {
      date = parentOrder.orderMeta?.moebelliftDate || '';
      time = parentOrder.orderMeta?.moebelliftTime || '';
    } else if (isViewing) {
      const v = parentOrder.orderMeta?.viewingDate || parentOrder.viewingDate || '';
      if (v && v !== 'requested' && v !== 'erledigt_fotos') {
        date = v.split('T')[0] || v;
        time = parentOrder.orderMeta?.viewingTime || (v.includes('T') ? v.split('T')[1]?.slice(0, 5) : '');
      }
    }

    if (!date) return null;

    let formattedDate = date;
    try {
      formattedDate = new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {}

    return {
      date: formattedDate,
      time: time || 'Ohne Zeitangabe'
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 md:px-8 space-y-6 animate-in fade-in duration-300 pb-16 min-h-screen">
      {/* Modern Compact Header & Search Bar (matches Kanban Disposition Board) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/80 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h1 className="text-base sm:text-xl font-extrabold font-headline text-slate-900 dark:text-white">
              Logistik-Einsatzplan
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
              {openCount} Offen
            </span>
            {completedCount > 0 && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {completedCount} Erledigt
              </span>
            )}
          </div>
        </div>

        {/* Compact Search Bar */}
        <div className="relative w-full sm:w-72">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kunde, Stadt, Auftragsnr..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Main Status & Category Controls (Segmented Pill Slider) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Status Switcher: Offene vs Erledigte Aufgaben */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs w-full sm:w-auto shrink-0">
          <button
            onClick={() => setStatusTab('offen')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all cursor-pointer ${
              statusTab === 'offen'
                ? 'bg-primary text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Offene Aufgaben</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              statusTab === 'offen' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {openCount}
            </span>
          </button>

          <button
            onClick={() => setStatusTab('erledigt')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all cursor-pointer ${
              statusTab === 'erledigt'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Erledigte Aufgaben</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              statusTab === 'erledigt' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {completedCount}
            </span>
          </button>
        </div>

        {/* Mobile & Desktop Category Filter Pills (Aligned with Kanban Disposition style) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {[
            { id: 'all', label: 'Alle', count: categoryCounts.all, dot: 'bg-primary' },
            { id: 'kartons', label: 'Kartons', count: categoryCounts.kartons, dot: 'bg-orange-500' },
            { id: 'halteverbot', label: 'Halteverbot', count: categoryCounts.halteverbot, dot: 'bg-yellow-500' },
            { id: 'moebellift', label: 'Möbellift', count: categoryCounts.moebellift, dot: 'bg-blue-500' },
            { id: 'viewing', label: 'Besichtigungen', count: categoryCounts.viewing, dot: 'bg-purple-500' },
            { id: 'rechnung', label: 'Rechnungen', count: categoryCounts.rechnung, dot: 'bg-emerald-500' }
          ].map(pill => {
            const isSelected = categoryFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setCategoryFilter(pill.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-headline whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white dark:bg-slate-900' : pill.dot}`} />
                <span>{pill.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected 
                    ? 'bg-white/20 dark:bg-black/20 text-white dark:text-slate-900 font-bold' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium'
                }`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Cards Grid */}
      {sortedTasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <CheckIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {statusTab === 'offen' ? 'Keine offenen Aufgaben!' : 'Keine erledigten Aufgaben.'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {statusTab === 'offen'
              ? 'Großartig! Alle logistischen Vorbereitungen für Ihre Aufträge sind aktuell abgeschlossen.'
              : 'Erledigte Aufgaben werden hier archiviert, sobald Sie diese in der Liste abhaken.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {sortedTasks.map((todo) => {
            const parentOrder = orders.find(o => o.id === todo.orderId);
            const customer = parentOrder ? customers[parentOrder.customerId] : null;
            const custPhone = customer?.phone || parentOrder?.phone || parentOrder?.customerPhone || '';
            const custName = todo.customerName || (customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Kunde');

            const addressA = [parentOrder?.logistics?.a_street, parentOrder?.logistics?.a_city].filter(Boolean).join(', ');
            const addressB = [parentOrder?.logistics?.b_street, parentOrder?.logistics?.b_city].filter(Boolean).join(', ');

            const catMeta = getCategoryMeta(todo);
            const scheduled = getScheduledDateInfo(todo, parentOrder);
            const orderNum = parentOrder?.orderNumber || (todo.orderId ? `#${todo.orderId.slice(-5).toUpperCase()}` : '#RH-AUFTRAG');
            const moveDate = parentOrder?.orderMeta?.movingDateFrom 
              ? new Date(parentOrder.orderMeta.movingDateFrom).toLocaleDateString('de-DE') 
              : 'TBA';
            const route = parentOrder?.logistics?.a_city 
              ? `${parentOrder.logistics.a_city} ➔ ${parentOrder.logistics.b_city || 'Ziel'}`
              : 'Route nicht angegeben';

            const isLogisticsSchedulable = todo.id === 'kartons_liefern' || todo.id === 'halteverbot' || todo.id === 'moebellift_buchen' || todo.id === 'viewing_requested';

            const isKarton = todo.id === 'kartons_liefern';
            const isHV = todo.id === 'halteverbot';
            const isLift = todo.id === 'moebellift_buchen';
            const isViewing = todo.id === 'viewing_requested';

            const matSummary = isKarton ? getMaterialsSummary(parentOrder) : null;

            const hvzLoc = parentOrder?.orderMeta?.hvzLocation || (parentOrder?.logistics?.hvz_b && !parentOrder?.logistics?.hvz_a ? 'b' : parentOrder?.logistics?.hvz_a && parentOrder?.logistics?.hvz_b ? 'both' : 'a');
            const hvzMethod = parentOrder?.orderMeta?.hvzMethod || (parentOrder?.logistics?.hvz_external ? 'extern' : 'selbst');
            const hvzAddress = hvzLoc === 'b' ? (addressB || 'Einzugsadresse') : (addressA || 'Auszugsadresse');

            const liftLoc = parentOrder?.orderMeta?.moebelliftLocation || 'a';
            const liftAddress = liftLoc === 'b' ? (addressB || 'Einzugsadresse') : (addressA || 'Auszugsadresse');
            const liftDuration = parentOrder?.orderMeta?.moebelliftDuration || '3';
            const liftEndTime = parentOrder?.orderMeta?.moebelliftEndTime || '';

            return (
              <div
                key={todo.id + todo.orderId}
                className={`bg-white dark:bg-slate-900/90 rounded-2xl sm:rounded-3xl border transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                  todo.done
                    ? 'border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100'
                    : todo.dueDateStatus === 'overdue'
                      ? 'border-red-400/80 dark:border-red-500/50 ring-1 ring-red-400/20'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Card Top: Badges & Customer Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${catMeta.color}`}>
                        {catMeta.label}
                      </span>
                      {todo.dueDateStatus === 'overdue' && !todo.done && (
                        <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse flex items-center gap-1">
                          <ExclamationCircleIcon className="w-3 h-3" />
                          <span>Überfällig</span>
                        </span>
                      )}
                      {todo.dueDateStatus === 'due' && !todo.done && (
                        <span className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-500/20">
                          {todo.dueDateText || 'Bald fällig'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 font-headline">
                      {orderNum}
                    </span>
                  </div>

                  {/* Customer & Route */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={todo.customerId ? `/dashboard/customers/${todo.customerId}` : `/dashboard/orders`}
                        className="font-headline font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <span className="line-clamp-1">{todo.customerName}</span>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        {custPhone && (
                          <button
                            type="button"
                            onClick={(e) => handleDirectWhatsApp(custPhone, undefined, e)}
                            className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 hover:bg-emerald-100 transition-all shrink-0 cursor-pointer"
                            title={`WhatsApp mit ${custName} öffnen`}
                          >
                            <ChatBubbleLeftRightIcon className="w-4 h-4" />
                          </button>
                        )}
                        {todo.customerId && (
                          <Link
                            href={`/dashboard/customers/${todo.customerId}`}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                            title="Kundenprofil öffnen"
                          >
                            <UserIcon className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{route}</span>
                      </span>
                      <span>•</span>
                      <span>Umzug: <strong className="text-slate-700 dark:text-slate-300">{moveDate}</strong></span>
                    </div>
                  </div>

                  {/* Task Title */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {todo.title}
                    </p>
                  </div>

                  {/* Task Specific Logistics Enhancement */}
                  {isKarton && matSummary && (
                    <div className="p-3 rounded-2xl bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-orange-600 dark:text-orange-400 text-lg">inventory_2</span>
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {matSummary.total > 0 ? `${matSummary.total} Kartons aus Angebot` : 'Materialbedarf'}
                          </span>
                          {matSummary.total > 0 && (
                            <p className="text-[11px] text-slate-500">
                              {matSummary.standard > 0 ? `${matSummary.standard}x Standard` : ''}
                              {matSummary.buecher > 0 ? ` • ${matSummary.buecher}x Bücher` : ''}
                              {matSummary.kleider > 0 ? ` • ${matSummary.kleider}x Kleider` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isHV && (
                    <div className="p-3 rounded-2xl bg-yellow-50/70 dark:bg-yellow-950/20 border border-yellow-200/60 dark:border-yellow-900/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                          {hvzMethod === 'extern' ? (
                            <>
                              <BuildingOfficeIcon className="w-3 h-3 text-slate-500" />
                              <span>Externe Firma</span>
                            </>
                          ) : (
                            <>
                              <TruckIcon className="w-3 h-3 text-primary" />
                              <span>Selbst aufstellen (Rothirsch)</span>
                            </>
                          )}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
                          {hvzLoc === 'b' ? (
                            <>
                              <HomeIcon className="w-3 h-3" />
                              <span>Einzugsort (B)</span>
                            </>
                          ) : hvzLoc === 'both' ? (
                            <>
                              <ArrowPathIcon className="w-3 h-3" />
                              <span>Beide (A & B)</span>
                            </>
                          ) : (
                            <>
                              <BuildingOfficeIcon className="w-3 h-3" />
                              <span>Auszugsort (A)</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-yellow-200/60 dark:border-yellow-900/30">
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                          <span className="truncate">{hvzAddress}</span>
                        </span>
                        {hvzAddress && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hvzAddress)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-0.5 rounded-lg bg-yellow-200/80 dark:bg-yellow-900/60 hover:brightness-110 text-yellow-900 dark:text-yellow-200 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                            title="In Google Maps öffnen"
                          >
                            <MapPinIcon className="w-3 h-3" />
                            <span>Maps</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {isLift && (
                    <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 flex items-center gap-1">
                          {liftLoc === 'b' ? (
                            <>
                              <HomeIcon className="w-3 h-3" />
                              <span>Einzugsort (B)</span>
                            </>
                          ) : (
                            <>
                              <BuildingOfficeIcon className="w-3 h-3" />
                              <span>Auszugsort (A)</span>
                            </>
                          )}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                          <ClockIcon className="w-3 h-3 text-blue-500" />
                          <span>{parentOrder?.orderMeta?.moebelliftTime ? `${parentOrder.orderMeta.moebelliftTime} - ${liftEndTime} (${liftDuration} Std.)` : `Dauer: ${liftDuration} Std.`}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-900/30">
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{liftAddress}</span>
                        </span>
                        {liftAddress && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(liftAddress)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-0.5 rounded-lg bg-blue-200/80 dark:bg-blue-900/60 hover:brightness-110 text-blue-900 dark:text-blue-200 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                            title="In Google Maps öffnen"
                          >
                            <MapPinIcon className="w-3 h-3" />
                            <span>Maps</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {isViewing && (
                    <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200">
                          {parentOrder?.orderMeta?.viewingType || 'Vor-Ort Besichtigung'}
                        </span>
                        {addressA && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressA)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-0.5 rounded-lg bg-purple-200/80 dark:bg-purple-900/60 hover:brightness-110 text-purple-900 dark:text-purple-200 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                            title="Besichtigungsort in Google Maps öffnen"
                          >
                            <MapPinIcon className="w-3 h-3" />
                            <span>Maps</span>
                          </a>
                        )}
                      </div>

                      {addressA && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="truncate">{addressA}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/30 flex items-center gap-2">
                        {parentOrder?.customerId && (
                          <Link
                            href={`/dashboard/customers/${parentOrder.customerId}/edit-order/${parentOrder.id}?step=4`}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-primary text-white text-[11px] font-bold flex items-center justify-center gap-1 hover:brightness-110 shadow-xs transition-all"
                            title="Direkt zu Schritt 4 (Umzugsliste & Möbel) springen"
                          >
                            <span className="material-symbols-outlined text-xs">chair</span>
                            <span>Besichtigung starten (Umzugsliste)</span>
                          </Link>
                        )}

                        {custPhone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              const timeText = parentOrder?.orderMeta?.viewingTime ? ` um ${parentOrder.orderMeta.viewingTime} Uhr` : '';
                              handleDirectWhatsApp(custPhone, `Hallo ${custName}, ich bin pünktlich auf dem Weg zu Ihnen für unseren Besichtigungstermin${timeText}. Bis gleich!`, e);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 hover:bg-emerald-700 transition-colors shrink-0"
                            title="Ich bin unterwegs senden"
                          >
                            <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                            <span>Unterwegs</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Details / Scheduled Termin Section */}
                  {isLogisticsSchedulable && (
                    <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <CalendarDaysIcon className="w-3.5 h-3.5 text-primary" />
                          <span>Termin & Uhrzeit</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                          className="text-[11px] font-bold text-primary hover:text-primary-hover transition-colors"
                        >
                          {scheduled ? 'Ändern' : 'Planen'}
                        </button>
                      </div>

                      {scheduled ? (
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-bold">
                              <CalendarDaysIcon className="w-3.5 h-3.5" />
                              <span>{scheduled.date}</span>
                            </div>
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                              <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span>{scheduled.time}</span>
                            </div>
                          </div>

                          {custPhone && isKarton && (
                            <button
                              type="button"
                              onClick={(e) => handleDirectWhatsApp(custPhone, `Guten Tag ${custName}, Ihre Umzugskartons werden am ${scheduled.date} ${scheduled.time !== 'Ohne Zeitangabe' ? 'im Zeitfenster ' + scheduled.time : ''} geliefert. Viele Grüße, Rothirsch Umzüge`, e)}
                              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                              title="Termin via WhatsApp bestätigen"
                            >
                              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          )}

                          {custPhone && isHV && (
                            <button
                              type="button"
                              onClick={(e) => handleDirectWhatsApp(custPhone, `Guten Tag ${custName}, die Halteverbotszone für Ihren Umzug wird am ${scheduled.date} aufgebaut. Viele Grüße, Rothirsch Umzüge`, e)}
                              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                              title="Termin via WhatsApp bestätigen"
                            >
                              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                          className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all text-xs font-medium text-center flex items-center justify-center gap-1.5"
                        >
                          <CalendarDaysIcon className="w-4 h-4" />
                          <span>Datum & Zeitfenster festlegen</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Bottom: Action Button */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  {!todo.done ? (
                    <button
                      type="button"
                      onClick={(e) => handleToggleTask(todo, e)}
                      className="w-full py-2.5 px-4 rounded-xl sm:rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 group active:scale-95 cursor-pointer"
                    >
                      <CheckIcon className="w-4 h-4 transition-transform group-hover:scale-125" />
                      <span>Als erledigt markieren</span>
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckIcon className="w-4 h-4" />
                        <span>Erledigt</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleTask(todo, e)}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline font-medium"
                      >
                        Wiedereröffnen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Schedule Modal */}
      {isModalOpen && modalTodo && modalOrder && (
        <TaskScheduleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          todo={modalTodo}
          parentOrder={modalOrder}
          onSaved={() => {
            // Realtime listener in Firestore automatically re-triggers snapshot
          }}
        />
      )}
    </div>
  );
}
