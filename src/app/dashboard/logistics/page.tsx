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
  ExclamationCircleIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Squares2X2Icon,
  QueueListIcon
} from '@heroicons/react/24/outline';
import { generateTickets, SystemTicket } from '@/lib/ticketEngine';
import { toggleTaskCompletion } from '@/lib/taskStateController';
import { TaskScheduleModal } from '@/components/logistics/TaskScheduleModal';
import toast from 'react-hot-toast';

export default function LogisticsPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();

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
  // View Mode: 'grouped' (Pro Kunde - STANDARD) vs 'compact' (Einzelne Symbol-Karten - 2nd Option)
  const [viewMode, setViewMode] = useState<'grouped' | 'compact'>('grouped');
  // Track expanded cards/details by key
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Modal state for scheduling
  const [modalTodo, setModalTodo] = useState<any>(null);
  const [modalOrder, setModalOrder] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleExpandCard = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
      const matchesStatus = statusTab === 'offen' ? !t.done : t.done;
      if (!matchesStatus) return false;

      if (categoryFilter !== 'all') {
        if (categoryFilter === 'viewing' && t.id !== 'viewing_requested') return false;
        if (categoryFilter !== 'viewing' && t.kanbanCategory !== categoryFilter) return false;
      }

      if (searchQuery.trim()) {
        const queryStr = searchQuery.toLowerCase();
        const parentOrder = orders.find(o => o.id === t.orderId);
        const custName = (t.customerName || '').toLowerCase();
        const title = (t.title || '').toLowerCase();
        const orderNum = (parentOrder?.orderNumber || t.orderId || '').toLowerCase();
        const city = `${parentOrder?.logistics?.a_city || ''} ${parentOrder?.logistics?.b_city || ''}`.toLowerCase();
        
        return custName.includes(queryStr) || title.includes(queryStr) || orderNum.includes(queryStr) || city.includes(queryStr);
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

  // Group tasks by orderId for the 'grouped' (Pro Kunde) Standard view mode
  const groupedOrders = useMemo(() => {
    const map = new Map<string, { order: any; customer: any; custName: string; tasks: SystemTicket[] }>();
    sortedTasks.forEach(todo => {
      const key = todo.orderId || todo.customerId || todo.customerName || 'unbekannt';
      if (!map.has(key)) {
        const parentOrder = orders.find(o => o.id === todo.orderId);
        const customer = parentOrder ? customers[parentOrder.customerId] : null;
        const custName = todo.customerName || (customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Kunde');
        map.set(key, {
          order: parentOrder,
          customer,
          custName,
          tasks: []
        });
      }
      map.get(key)!.tasks.push(todo);
    });
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [sortedTasks, orders, customers]);

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
      if (name.includes('bücher') || name.includes('buecher') || name.includes('buch')) {
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
        if (name.includes('bücher') || name.includes('buecher') || name.includes('buch')) {
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

    const breakdownParts: string[] = [];
    if (standard > 0) breakdownParts.push(`${standard}x Standard`);
    if (buecher > 0) breakdownParts.push(`${buecher}x Bücher`);
    if (kleider > 0) breakdownParts.push(`${kleider}x Kleider`);

    return {
      total: standard + buecher + kleider,
      standard,
      buecher,
      kleider,
      seidenpapier,
      klebeband,
      breakdownText: breakdownParts.join(' • ')
    };
  };

  // Symbol & Badge helper for each category (Zero Red, complete info preserved)
  const getCategoryMeta = (todo: SystemTicket, parentOrder: any) => {
    const addressA = [parentOrder?.logistics?.a_street, parentOrder?.logistics?.a_city].filter(Boolean).join(', ');
    const addressB = [parentOrder?.logistics?.b_street, parentOrder?.logistics?.b_city].filter(Boolean).join(', ');

    if (todo.id === 'viewing_requested') {
      return {
        label: 'Besichtigung',
        shortInfo: parentOrder?.orderMeta?.viewingType || 'Vor-Ort',
        detailSubtext: addressA || 'Besichtigungsadresse im Auftrag',
        mapAddress: addressA,
        symbol: 'chair',
        color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
        iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
      };
    }
    switch (todo.kanbanCategory) {
      case 'kartons': {
        const mat = getMaterialsSummary(parentOrder);
        return {
          label: 'Kartons',
          shortInfo: mat.total > 0 ? `${mat.total} Stk.` : 'Material',
          detailSubtext: mat.breakdownText || 'Kartons laut Angebot liefern',
          mapAddress: addressA,
          symbol: 'inventory_2',
          color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25',
          iconBg: 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
        };
      }
      case 'halteverbot': {
        const hvzLoc = parentOrder?.orderMeta?.hvzLocation || (parentOrder?.logistics?.hvz_b && !parentOrder?.logistics?.hvz_a ? 'b' : parentOrder?.logistics?.hvz_a && parentOrder?.logistics?.hvz_b ? 'both' : 'a');
        const hvzMethod = parentOrder?.orderMeta?.hvzMethod || (parentOrder?.logistics?.hvz_external ? 'extern' : 'selbst');
        const locLabel = hvzLoc === 'both' ? 'A & B' : hvzLoc === 'b' ? 'Einzug B' : 'Auszug A';
        const methodLabel = hvzMethod === 'extern' ? 'Extern' : 'Selbst (Rothirsch)';
        const hvzAddr = hvzLoc === 'b' ? (addressB || 'Einzugsadresse') : (addressA || 'Auszugsadresse');
        return {
          label: 'Halteverbot',
          shortInfo: `HVZ (${locLabel})`,
          detailSubtext: `${methodLabel} • ${hvzAddr}`,
          mapAddress: hvzAddr,
          symbol: 'local_parking',
          color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
          iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        };
      }
      case 'moebellift': {
        const liftLoc = parentOrder?.orderMeta?.moebelliftLocation || 'a';
        const liftDur = parentOrder?.orderMeta?.moebelliftDuration || '3';
        const liftAddr = liftLoc === 'b' ? (addressB || 'Einzugsadresse') : (addressA || 'Auszugsadresse');
        return {
          label: 'Möbellift',
          shortInfo: `${liftDur} Std. (${liftLoc === 'b' ? 'Ort B' : 'Ort A'})`,
          detailSubtext: liftAddr,
          mapAddress: liftAddr,
          symbol: 'elevator',
          color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
          iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
        };
      }
      case 'rechnung':
        return {
          label: 'Rechnung',
          shortInfo: 'Abrechnung',
          detailSubtext: todo.title,
          mapAddress: addressA,
          symbol: 'receipt_long',
          color: 'bg-[#6E8F64]/12 text-[#435E3A] dark:text-[#B5D1AC] border-[#6E8F64]/30',
          iconBg: 'bg-[#6E8F64]/15 text-[#527048] dark:text-[#A8C69F]'
        };
      default:
        return {
          label: 'Logistik',
          shortInfo: 'Aufgabe',
          detailSubtext: todo.title,
          mapAddress: addressA,
          symbol: 'task_alt',
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          iconBg: 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        };
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
      formattedDate = new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    } catch {}

    return {
      date: formattedDate,
      time: time || ''
    };
  };

  // Helper to send task-aware WhatsApp message
  const triggerTaskWhatsApp = (todo: SystemTicket, parentOrder: any, custPhone: string, custName: string, scheduled: any, e: React.MouseEvent) => {
    const isViewing = todo.id === 'viewing_requested';
    const isKarton = todo.id === 'kartons_liefern';
    const isHV = todo.id === 'halteverbot';

    if (isViewing) {
      const timeText = parentOrder?.orderMeta?.viewingTime ? ` um ${parentOrder.orderMeta.viewingTime} Uhr` : '';
      handleDirectWhatsApp(custPhone, `Hallo ${custName}, ich bin pünktlich auf dem Weg zu Ihnen für unseren Besichtigungstermin${timeText}. Bis gleich!`, e);
    } else if (isKarton && scheduled) {
      handleDirectWhatsApp(custPhone, `Guten Tag ${custName}, Ihre Umzugskartons werden am ${scheduled.date} ${scheduled.time ? 'im Zeitfenster ' + scheduled.time : ''} geliefert. Viele Grüße, Rothirsch Umzüge`, e);
    } else if (isHV && scheduled) {
      handleDirectWhatsApp(custPhone, `Guten Tag ${custName}, die Halteverbotszone für Ihren Umzug wird am ${scheduled.date} aufgebaut. Viele Grüße, Rothirsch Umzüge`, e);
    } else {
      handleDirectWhatsApp(custPhone, undefined, e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#6E8F64]"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 md:px-8 space-y-5 animate-in fade-in duration-300 pb-16 min-h-screen">
      {/* Clean Header & Search Bar (Light Olive-Sage Green #6E8F64 — Zero Red) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/80 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6E8F64] animate-pulse" />
            <h1 className="text-base sm:text-xl font-extrabold font-headline text-slate-900 dark:text-white">
              Logistik-Einsatzplan
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#4A6642] dark:text-[#B5D1AC] bg-[#6E8F64]/15 px-2.5 py-0.5 rounded-full border border-[#6E8F64]/30">
              {openCount} Offen
            </span>
            {completedCount > 0 && (
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                {completedCount} Erledigt
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle: 1. Pro Kunde (STANDARD) | 2. Symbole (Einzeln) */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-[#6E8F64] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Standard: Aufgaben pro Kunde gebündelt anzeigen"
            >
              <QueueListIcon className="w-3.5 h-3.5" />
              <span>Pro Kunde ({groupedOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-[#6E8F64] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Zweitansicht: Einzelne Symbol-Karten"
            >
              <Squares2X2Icon className="w-3.5 h-3.5" />
              <span>Symbole ({sortedTasks.length})</span>
            </button>
          </div>

          {/* Compact Search Bar */}
          <div className="relative flex-1 sm:w-64">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kunde, Stadt, Auftragsnr..."
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6E8F64] placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Main Status & Category Controls (Light Olive-Sage Green #6E8F64) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Status Switcher: Offene vs Erledigte Aufgaben */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs w-full sm:w-auto shrink-0">
          <button
            onClick={() => setStatusTab('offen')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all cursor-pointer ${
              statusTab === 'offen'
                ? 'bg-[#6E8F64] text-white shadow-xs'
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
                ? 'bg-slate-700 text-white shadow-xs'
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

        {/* Category Filter Pills with Symbols */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {[
            { id: 'all', label: 'Alle', count: categoryCounts.all, dot: 'bg-[#6E8F64]' },
            { id: 'kartons', label: 'Kartons', count: categoryCounts.kartons, dot: 'bg-orange-500' },
            { id: 'halteverbot', label: 'Halteverbot', count: categoryCounts.halteverbot, dot: 'bg-amber-500' },
            { id: 'moebellift', label: 'Möbellift', count: categoryCounts.moebellift, dot: 'bg-blue-500' },
            { id: 'viewing', label: 'Besichtigung', count: categoryCounts.viewing, dot: 'bg-purple-500' },
            { id: 'rechnung', label: 'Rechnungen', count: categoryCounts.rechnung, dot: 'bg-[#6E8F64]' }
          ].map(pill => {
            const isSelected = categoryFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setCategoryFilter(pill.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-headline whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#6E8F64] text-white border-transparent shadow-xs'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-[#6E8F64]/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : pill.dot}`} />
                <span>{pill.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected 
                    ? 'bg-white/20 text-white font-bold' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium'
                }`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {sortedTasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#6E8F64]/15 flex items-center justify-center mx-auto text-[#6E8F64]">
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
      ) : viewMode === 'grouped' ? (
        /* ========================================================================= */
        /* STANDARD VIEW MODE: PRO KUNDE (All customer tasks bundled, 100% content!) */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groupedOrders.map(({ key, order: parentOrder, customer, custName, tasks }) => {
            const custPhone = customer?.phone || parentOrder?.phone || parentOrder?.customerPhone || '';
            const orderNum = parentOrder?.orderNumber || (parentOrder?.id ? `#${parentOrder.id.slice(-5).toUpperCase()}` : '#RH-AUFTRAG');
            const moveDate = parentOrder?.orderMeta?.movingDateFrom 
              ? new Date(parentOrder.orderMeta.movingDateFrom).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
              : 'TBA';
            const route = parentOrder?.logistics?.a_city 
              ? `${parentOrder.logistics.a_city} ➔ ${parentOrder.logistics.b_city || 'Ziel'}`
              : 'Route offen';
            const addressA = [parentOrder?.logistics?.a_street, parentOrder?.logistics?.a_city].filter(Boolean).join(', ');

            return (
              <div
                key={key}
                className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs hover:shadow-md transition-all space-y-3"
              >
                {/* Customer Header Row */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={parentOrder?.customerId ? `/dashboard/customers/${parentOrder.customerId}` : `/dashboard/orders`}
                        className="font-headline font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-[#6E8F64] transition-colors truncate"
                      >
                        {custName}
                      </Link>
                      <span className="text-[10px] font-bold text-slate-400 font-headline shrink-0">
                        {orderNum}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="truncate">{route}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">Umzug: {moveDate}</span>
                    </div>
                  </div>

                  {/* Customer Quick Symbol Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {addressA && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressA)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#6E8F64]/15 hover:text-[#6E8F64] transition-all"
                        title={`Navigation: ${addressA}`}
                      >
                        <MapPinIcon className="w-4 h-4" />
                      </a>
                    )}
                    {custPhone && (
                      <button
                        type="button"
                        onClick={(e) => handleDirectWhatsApp(custPhone, undefined, e)}
                        className="p-1.5 rounded-xl bg-[#6E8F64]/15 text-[#4A6642] dark:text-[#B5D1AC] hover:bg-[#6E8F64] hover:text-white transition-all cursor-pointer"
                        title={`WhatsApp an ${custName}`}
                      >
                        <ChatBubbleLeftRightIcon className="w-4 h-4" />
                      </button>
                    )}
                    {parentOrder?.customerId && (
                      <Link
                        href={`/dashboard/customers/${parentOrder.customerId}`}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[#6E8F64] hover:bg-[#6E8F64]/15 transition-all"
                        title="Kundenakte öffnen"
                      >
                        <UserIcon className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Rich Symbol Rows for each Task of this Customer (Zero Lost Info!) */}
                <div className="space-y-2">
                  {tasks.map(todo => {
                    const rowKey = `grp_${todo.id}_${todo.orderId}`;
                    const isRowExpanded = !!expandedCards[rowKey];
                    const catMeta = getCategoryMeta(todo, parentOrder);
                    const scheduled = getScheduledDateInfo(todo, parentOrder);
                    const isViewing = todo.id === 'viewing_requested';
                    const isLogisticsSchedulable = todo.id === 'kartons_liefern' || todo.id === 'halteverbot' || todo.id === 'moebellift_buchen' || isViewing;

                    return (
                      <div
                        key={todo.id}
                        className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          {/* Left: Symbol + Category + Inline Detail Summary */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${catMeta.iconBg}`}>
                              <span className="material-symbols-outlined text-base">{catMeta.symbol}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  {catMeta.label}
                                </span>
                                <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${catMeta.color}`}>
                                  {catMeta.shortInfo}
                                </span>
                                {scheduled && (
                                  <button
                                    type="button"
                                    onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                                    className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC] border border-[#6E8F64]/30 hover:bg-[#6E8F64]/25 cursor-pointer"
                                    title="Termin ändern"
                                  >
                                    <CalendarDaysIcon className="w-3 h-3" />
                                    <span>{scheduled.date}{scheduled.time ? ` • ${scheduled.time}` : ''}</span>
                                  </button>
                                )}
                              </div>
                              {/* Subtitle showing exact breakdown/address so NO content is ever lost */}
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {catMeta.detailSubtext}
                              </p>
                            </div>
                          </div>

                          {/* Right: Symbol Action Buttons + Light Olive-Sage Green Primary Action */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* 📅 Termin planen/ändern */}
                            {isLogisticsSchedulable && (
                              <button
                                type="button"
                                onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                  scheduled
                                    ? 'bg-[#6E8F64]/15 border-[#6E8F64]/35 text-[#435E3A] dark:text-[#B5D1AC]'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#6E8F64] hover:border-[#6E8F64]/40'
                                }`}
                                title={scheduled ? `Termin ändern (${scheduled.date})` : 'Termin & Zeitfenster planen'}
                              >
                                <CalendarDaysIcon className="w-4 h-4" />
                              </button>
                            )}

                            {/* 📍 Task-specific Maps link */}
                            {catMeta.mapAddress && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(catMeta.mapAddress)}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#6E8F64] hover:border-[#6E8F64]/40 transition-all"
                                title={`In Google Maps öffnen: ${catMeta.mapAddress}`}
                              >
                                <MapPinIcon className="w-4 h-4" />
                              </a>
                            )}

                            {/* 💬 Task-specific WhatsApp message (Unterwegs / Kartons / HVZ) */}
                            {custPhone && (
                              <button
                                type="button"
                                onClick={(e) => triggerTaskWhatsApp(todo, parentOrder, custPhone, custName, scheduled, e)}
                                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#527048] dark:text-[#B5D1AC] hover:bg-[#6E8F64] hover:text-white transition-all cursor-pointer"
                                title={isViewing ? 'WhatsApp: "Ich bin unterwegs" senden' : 'WhatsApp-Terminbestätigung senden'}
                              >
                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                              </button>
                            )}

                            {/* ⌄ Expand full task info */}
                            <button
                              type="button"
                              onClick={(e) => toggleExpandCard(rowKey, e)}
                              className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
                              title="Vollständige Details ein-/ausblenden"
                            >
                              {isRowExpanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                            </button>

                            {/* 🪑 Besichtigung starten (Light Olive-Sage Green) */}
                            {isViewing && parentOrder?.customerId && !todo.done && (
                              <Link
                                href={`/dashboard/customers/${parentOrder.customerId}/edit-order/${parentOrder.id}?step=4`}
                                className="px-2.5 py-1.5 rounded-xl bg-[#6E8F64] hover:bg-[#5C7A53] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all"
                                title="Direkt zu Schritt 4 (Umzugsliste & Möbel) springen"
                              >
                                <span className="material-symbols-outlined text-xs">chair</span>
                                <span className="hidden sm:inline">Besichtigung starten</span>
                              </Link>
                            )}

                            {/* ✓ Erledigt markieren (Light Olive-Sage Green) */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleTask(todo, e)}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                todo.done
                                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                                  : isViewing && parentOrder?.customerId
                                    ? 'bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC] border border-[#6E8F64]/35 hover:bg-[#6E8F64] hover:text-white'
                                    : 'bg-[#6E8F64] hover:bg-[#5C7A53] text-white shadow-xs shadow-[#6E8F64]/20'
                              }`}
                              title={todo.done ? 'Wiedereröffnen' : 'Als erledigt markieren'}
                            >
                              <CheckIcon className="w-3.5 h-3.5" />
                              <span>{todo.done ? 'Offen' : 'Erledigt'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Collapsible full details inside Pro Kunde row */}
                        {isRowExpanded && (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/50 text-[11px] text-slate-600 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-150">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{todo.title}</span>
                              <p className="text-slate-500 mt-0.5">{catMeta.detailSubtext}</p>
                            </div>
                            {isLogisticsSchedulable && (
                              <button
                                type="button"
                                onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                                className="px-2.5 py-1 rounded-lg bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC] font-bold text-[10px] self-start sm:self-auto shrink-0 cursor-pointer"
                              >
                                {scheduled ? `Termin ändern (${scheduled.date} ${scheduled.time})` : '+ Datum & Zeitfenster festlegen'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* OPTION 2: COMPACT SYMBOL CARDS WITH COLLAPSIBLE DETAILS                   */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedTasks.map((todo) => {
            const cardKey = `${todo.id}_${todo.orderId}`;
            const isExpanded = !!expandedCards[cardKey];

            const parentOrder = orders.find(o => o.id === todo.orderId);
            const customer = parentOrder ? customers[parentOrder.customerId] : null;
            const custPhone = customer?.phone || parentOrder?.phone || parentOrder?.customerPhone || '';
            const custName = todo.customerName || (customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Kunde');

            const catMeta = getCategoryMeta(todo, parentOrder);
            const scheduled = getScheduledDateInfo(todo, parentOrder);
            const orderNum = parentOrder?.orderNumber || (todo.orderId ? `#${todo.orderId.slice(-5).toUpperCase()}` : '#RH-AUFTRAG');
            const moveDate = parentOrder?.orderMeta?.movingDateFrom 
              ? new Date(parentOrder.orderMeta.movingDateFrom).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) 
              : 'TBA';
            const route = parentOrder?.logistics?.a_city 
              ? `${parentOrder.logistics.a_city} ➔ ${parentOrder.logistics.b_city || 'Ziel'}`
              : 'Route offen';

            const isLogisticsSchedulable = todo.id === 'kartons_liefern' || todo.id === 'halteverbot' || todo.id === 'moebellift_buchen' || todo.id === 'viewing_requested';
            const isViewing = todo.id === 'viewing_requested';

            return (
              <div
                key={cardKey}
                className={`bg-white dark:bg-slate-900/90 rounded-2xl border transition-all duration-200 p-4 flex flex-col justify-between shadow-xs hover:shadow-md ${
                  todo.done
                    ? 'border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100'
                    : todo.dueDateStatus === 'overdue'
                      ? 'border-amber-400/80 dark:border-amber-500/50'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-[#6E8F64]/50'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${catMeta.color}`}>
                        <span className="material-symbols-outlined text-sm">{catMeta.symbol}</span>
                        <span>{catMeta.label}</span>
                        <span className="opacity-75">• {catMeta.shortInfo}</span>
                      </span>

                      {scheduled ? (
                        <button
                          type="button"
                          onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC] border border-[#6E8F64]/30 hover:bg-[#6E8F64]/25 transition-colors cursor-pointer"
                          title="Termin ändern"
                        >
                          <CalendarDaysIcon className="w-3 h-3" />
                          <span>{scheduled.date}{scheduled.time ? ` • ${scheduled.time}` : ''}</span>
                        </button>
                      ) : todo.dueDateStatus === 'overdue' && !todo.done ? (
                        <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                          <ExclamationCircleIcon className="w-3 h-3" />
                          <span>Fällig</span>
                        </span>
                      ) : null}
                    </div>

                    <span className="text-[10px] font-bold text-slate-400 font-headline shrink-0">
                      {orderNum}
                    </span>
                  </div>

                  {/* Customer & Quick Symbol Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="min-w-0">
                      <Link
                        href={todo.customerId ? `/dashboard/customers/${todo.customerId}` : `/dashboard/orders`}
                        className="font-headline font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-[#6E8F64] transition-colors block truncate"
                      >
                        {custName}
                      </Link>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{route}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">{moveDate}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                        {catMeta.detailSubtext}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isLogisticsSchedulable && (
                        <button
                          type="button"
                          onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                          className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                            scheduled
                              ? 'bg-[#6E8F64]/15 border-[#6E8F64]/35 text-[#435E3A] dark:text-[#B5D1AC]'
                              : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 hover:text-[#6E8F64] hover:bg-[#6E8F64]/15'
                          }`}
                          title={scheduled ? 'Termin ändern' : 'Datum & Zeitfenster planen'}
                        >
                          <CalendarDaysIcon className="w-4 h-4" />
                        </button>
                      )}

                      {catMeta.mapAddress && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(catMeta.mapAddress)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[#6E8F64] hover:bg-[#6E8F64]/15 transition-all"
                          title={`In Google Maps öffnen: ${catMeta.mapAddress}`}
                        >
                          <MapPinIcon className="w-4 h-4" />
                        </a>
                      )}

                      {custPhone && (
                        <button
                          type="button"
                          onClick={(e) => triggerTaskWhatsApp(todo, parentOrder, custPhone, custName, scheduled, e)}
                          className="p-1.5 rounded-xl bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC] hover:bg-[#6E8F64] hover:text-white transition-all cursor-pointer"
                          title={`WhatsApp an ${custName} senden`}
                        >
                          <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => toggleExpandCard(cardKey, e)}
                        className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                          isExpanded
                            ? 'bg-[#6E8F64] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title={isExpanded ? 'Details zuklappen' : 'Details aufklappen'}
                      >
                        {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs animate-in fade-in duration-150">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {todo.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {catMeta.detailSubtext}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Light Olive-Sage Green Action Buttons */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  {!todo.done ? (
                    <>
                      {isViewing && parentOrder?.customerId && (
                        <Link
                          href={`/dashboard/customers/${parentOrder.customerId}/edit-order/${parentOrder.id}?step=4`}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#6E8F64] hover:bg-[#5C7A53] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs shadow-[#6E8F64]/20 transition-all"
                          title="Direkt zu Schritt 4 (Umzugsliste & Möbel) springen"
                        >
                          <span className="material-symbols-outlined text-sm">chair</span>
                          <span>Besichtigung starten</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleToggleTask(todo, e)}
                        className={`${
                          isViewing && parentOrder?.customerId
                            ? 'px-3 py-2 bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC] border border-[#6E8F64]/35 hover:bg-[#6E8F64] hover:text-white'
                            : 'w-full py-2 px-4 bg-[#6E8F64] hover:bg-[#5C7A53] text-white shadow-xs shadow-[#6E8F64]/20'
                        } rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 group active:scale-95 cursor-pointer`}
                      >
                        <CheckIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
                        <span>{isViewing && parentOrder?.customerId ? 'Erledigt' : 'Als erledigt markieren'}</span>
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E8F64]">
                        <CheckIcon className="w-4 h-4" />
                        <span>Erledigt</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleTask(todo, e)}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline font-medium cursor-pointer"
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
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
