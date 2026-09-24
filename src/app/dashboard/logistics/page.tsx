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
  ExclamationCircleIcon,
  ChatBubbleLeftRightIcon,
  BuildingOfficeIcon,
  TruckIcon,
  HomeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Squares2X2Icon,
  QueueListIcon,
  CubeIcon,
  DocumentTextIcon
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
  // View Mode: 'compact' (Compact Symbol Cards with Accordion) vs 'grouped' (Bundled by Customer/Order)
  const [viewMode, setViewMode] = useState<'compact' | 'grouped'>('compact');
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

  // Group tasks by orderId for the 'grouped' view mode
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

    return {
      total: standard + buecher + kleider,
      standard,
      buecher,
      kleider,
      seidenpapier,
      klebeband
    };
  };

  // Symbol & Badge helper for each category (Zero Red, clean icons & concise labels)
  const getCategoryMeta = (todo: SystemTicket, parentOrder: any) => {
    if (todo.id === 'viewing_requested') {
      return {
        label: 'Besichtigung',
        shortInfo: parentOrder?.orderMeta?.viewingType || 'Vor-Ort',
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
          symbol: 'inventory_2',
          color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25',
          iconBg: 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
        };
      }
      case 'halteverbot': {
        const hvzLoc = parentOrder?.orderMeta?.hvzLocation || (parentOrder?.logistics?.hvz_b && !parentOrder?.logistics?.hvz_a ? 'b' : parentOrder?.logistics?.hvz_a && parentOrder?.logistics?.hvz_b ? 'both' : 'a');
        const locLabel = hvzLoc === 'both' ? 'A & B' : hvzLoc === 'b' ? 'Ort B' : 'Ort A';
        return {
          label: 'Halteverbot',
          shortInfo: `HVZ (${locLabel})`,
          symbol: 'local_parking',
          color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
          iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        };
      }
      case 'moebellift': {
        const liftDur = parentOrder?.orderMeta?.moebelliftDuration || '3';
        return {
          label: 'Möbellift',
          shortInfo: `${liftDur} Std.`,
          symbol: 'elevator',
          color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
          iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
        };
      }
      case 'rechnung':
        return {
          label: 'Rechnung',
          shortInfo: 'Abrechnung',
          symbol: 'receipt_long',
          color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
          iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        };
      default:
        return {
          label: 'Logistik',
          shortInfo: 'Aufgabe',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 md:px-8 space-y-5 animate-in fade-in duration-300 pb-16 min-h-screen">
      {/* Clean Header & Search Bar (Zero Red — Emerald & Slate Palette) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/80 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-base sm:text-xl font-extrabold font-headline text-slate-900 dark:text-white">
              Logistik-Einsatzplan
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
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
          {/* View Mode Toggle: Einzelkarten (Compact Symbols) vs Nach Kunde bündeln */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Kompakte Symbol-Karten"
            >
              <Squares2X2Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Symbole</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Aufgaben pro Kunde zusammenfassen"
            >
              <QueueListIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pro Kunde ({groupedOrders.length})</span>
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
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Main Status & Category Controls (Segmented Pill Slider — Emerald/Slate, No Red) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Status Switcher: Offene vs Erledigte Aufgaben */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs w-full sm:w-auto shrink-0">
          <button
            onClick={() => setStatusTab('offen')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all cursor-pointer ${
              statusTab === 'offen'
                ? 'bg-emerald-600 text-white shadow-xs'
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
                ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
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
            { id: 'all', label: 'Alle', count: categoryCounts.all, dot: 'bg-emerald-500' },
            { id: 'kartons', label: 'Kartons', count: categoryCounts.kartons, dot: 'bg-orange-500' },
            { id: 'halteverbot', label: 'Halteverbot', count: categoryCounts.halteverbot, dot: 'bg-amber-500' },
            { id: 'moebellift', label: 'Möbellift', count: categoryCounts.moebellift, dot: 'bg-blue-500' },
            { id: 'viewing', label: 'Besichtigung', count: categoryCounts.viewing, dot: 'bg-purple-500' },
            { id: 'rechnung', label: 'Rechnungen', count: categoryCounts.rechnung, dot: 'bg-emerald-500' }
          ].map(pill => {
            const isSelected = categoryFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setCategoryFilter(pill.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-headline whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-transparent shadow-xs'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-500/40'
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
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-600">
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
        /* VIEW MODE 2: GROUPED BY CUSTOMER / ORDER (Zero Redundancy, Ultra-Clean)   */
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
                        className="font-headline font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-emerald-600 transition-colors truncate"
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
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 transition-all"
                        title={`Navigation: ${addressA}`}
                      >
                        <MapPinIcon className="w-4 h-4" />
                      </a>
                    )}
                    {custPhone && (
                      <button
                        type="button"
                        onClick={(e) => handleDirectWhatsApp(custPhone, undefined, e)}
                        className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 hover:bg-emerald-100 transition-all cursor-pointer"
                        title={`WhatsApp an ${custName}`}
                      >
                        <ChatBubbleLeftRightIcon className="w-4 h-4" />
                      </button>
                    )}
                    {parentOrder?.customerId && (
                      <Link
                        href={`/dashboard/customers/${parentOrder.customerId}`}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 hover:bg-emerald-500/10 transition-all"
                        title="Kundenakte öffnen"
                      >
                        <UserIcon className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Compact Symbol Rows for each Task of this Customer */}
                <div className="space-y-2">
                  {tasks.map(todo => {
                    const catMeta = getCategoryMeta(todo, parentOrder);
                    const scheduled = getScheduledDateInfo(todo, parentOrder);
                    const isViewing = todo.id === 'viewing_requested';
                    const isLogisticsSchedulable = todo.id === 'kartons_liefern' || todo.id === 'halteverbot' || todo.id === 'moebellift_buchen' || isViewing;

                    return (
                      <div
                        key={todo.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50"
                      >
                        {/* Left: Symbol + Category + Short Info */}
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
                            </div>
                            {scheduled && (
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                <CalendarDaysIcon className="w-3 h-3" />
                                {scheduled.date} {scheduled.time && `• ${scheduled.time}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Symbol Action Buttons + Green Primary Action */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isLogisticsSchedulable && (
                            <button
                              type="button"
                              onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                scheduled
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-500/40'
                              }`}
                              title={scheduled ? `Termin ändern (${scheduled.date})` : 'Termin planen'}
                            >
                              <CalendarDaysIcon className="w-4 h-4" />
                            </button>
                          )}

                          {isViewing && parentOrder?.customerId && !todo.done && (
                            <Link
                              href={`/dashboard/customers/${parentOrder.customerId}/edit-order/${parentOrder.id}?step=4`}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all"
                              title="Besichtigung starten (Umzugsliste)"
                            >
                              <span className="material-symbols-outlined text-xs">chair</span>
                              <span className="hidden sm:inline">Besichtigung starten</span>
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleToggleTask(todo, e)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              todo.done
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20'
                            }`}
                            title={todo.done ? 'Wiedereröffnen' : 'Als erledigt markieren'}
                          >
                            <CheckIcon className="w-3.5 h-3.5" />
                            <span>{todo.done ? 'Offen' : 'Erledigt'}</span>
                          </button>
                        </div>
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
        /* VIEW MODE 1 (DEFAULT): COMPACT SYMBOL CARDS WITH COLLAPSIBLE DETAILS      */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedTasks.map((todo) => {
            const cardKey = `${todo.id}_${todo.orderId}`;
            const isExpanded = !!expandedCards[cardKey];

            const parentOrder = orders.find(o => o.id === todo.orderId);
            const customer = parentOrder ? customers[parentOrder.customerId] : null;
            const custPhone = customer?.phone || parentOrder?.phone || parentOrder?.customerPhone || '';
            const custName = todo.customerName || (customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Kunde');

            const addressA = [parentOrder?.logistics?.a_street, parentOrder?.logistics?.a_city].filter(Boolean).join(', ');
            const addressB = [parentOrder?.logistics?.b_street, parentOrder?.logistics?.b_city].filter(Boolean).join(', ');

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

            const targetMapAddress = isHV ? hvzAddress : isLift ? liftAddress : addressA;

            return (
              <div
                key={cardKey}
                className={`bg-white dark:bg-slate-900/90 rounded-2xl border transition-all duration-200 p-4 flex flex-col justify-between shadow-xs hover:shadow-md ${
                  todo.done
                    ? 'border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100'
                    : todo.dueDateStatus === 'overdue'
                      ? 'border-amber-400/80 dark:border-amber-500/50'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40'
                }`}
              >
                {/* 1. COMPACT TOP BAR: Symbol Badge + Scheduled Pill + Order Number */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Category Symbol Pill */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${catMeta.color}`}>
                        <span className="material-symbols-outlined text-sm">{catMeta.symbol}</span>
                        <span>{catMeta.label}</span>
                        <span className="opacity-75">• {catMeta.shortInfo}</span>
                      </span>

                      {/* Scheduled Date Badge or Fällig Indicator */}
                      {scheduled ? (
                        <button
                          type="button"
                          onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors cursor-pointer"
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

                  {/* 2. CUSTOMER ROW + SYMBOL TOOLBAR (Replaces bulky boxes!) */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="min-w-0">
                      <Link
                        href={todo.customerId ? `/dashboard/customers/${todo.customerId}` : `/dashboard/orders`}
                        className="font-headline font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-emerald-600 transition-colors block truncate"
                      >
                        {custName}
                      </Link>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{route}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">{moveDate}</span>
                      </div>
                    </div>

                    {/* Quick Action Symbol Toolbar (Symbole) */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* 📅 Termin Symbol */}
                      {isLogisticsSchedulable && (
                        <button
                          type="button"
                          onClick={(e) => openScheduleModal(todo, parentOrder, e)}
                          className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                            scheduled
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500/30 text-emerald-600'
                              : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 hover:text-emerald-600 hover:bg-emerald-500/10'
                          }`}
                          title={scheduled ? 'Termin ändern' : 'Datum & Zeitfenster planen'}
                        >
                          <CalendarDaysIcon className="w-4 h-4" />
                        </button>
                      )}

                      {/* 📍 Maps Symbol */}
                      {targetMapAddress && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetMapAddress)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 hover:bg-emerald-500/10 transition-all"
                          title={`In Google Maps öffnen: ${targetMapAddress}`}
                        >
                          <MapPinIcon className="w-4 h-4" />
                        </a>
                      )}

                      {/* 💬 WhatsApp Symbol */}
                      {custPhone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            if (isViewing) {
                              const timeText = parentOrder?.orderMeta?.viewingTime ? ` um ${parentOrder.orderMeta.viewingTime} Uhr` : '';
                              handleDirectWhatsApp(custPhone, `Hallo ${custName}, ich bin pünktlich auf dem Weg zu Ihnen für unseren Besichtigungstermin${timeText}. Bis gleich!`, e);
                            } else if (isKarton && scheduled) {
                              handleDirectWhatsApp(custPhone, `Guten Tag ${custName}, Ihre Umzugskartons werden am ${scheduled.date} ${scheduled.time ? 'im Zeitfenster ' + scheduled.time : ''} geliefert. Viele Grüße, Rothirsch Umzüge`, e);
                            } else {
                              handleDirectWhatsApp(custPhone, undefined, e);
                            }
                          }}
                          className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 hover:bg-emerald-100 transition-all cursor-pointer"
                          title={`WhatsApp an ${custName} senden`}
                        >
                          <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        </button>
                      )}

                      {/* ⌄ Accordion Toggle Symbol (Details ein-/ausblenden) */}
                      <button
                        type="button"
                        onClick={(e) => toggleExpandCard(cardKey, e)}
                        className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                          isExpanded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title={isExpanded ? 'Details zuklappen' : 'Details aufklappen'}
                      >
                        {isExpanded ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 3. COLLAPSIBLE DETAILS DRAWER (Only visible when user clicks ⌄) */}
                  {isExpanded && (
                    <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs animate-in fade-in duration-150">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {todo.title}
                      </p>

                      {isKarton && matSummary && (
                        <div className="p-2.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/40 text-[11px] text-slate-700 dark:text-slate-300">
                          <span className="font-bold block">Material-Aufschlüsselung ({matSummary.total} Stk.):</span>
                          <span>
                            {matSummary.standard > 0 ? `${matSummary.standard}x Standard ` : ''}
                            {matSummary.buecher > 0 ? `• ${matSummary.buecher}x Bücher ` : ''}
                            {matSummary.kleider > 0 ? `• ${matSummary.kleider}x Kleider` : ''}
                            {matSummary.total === 0 ? 'Noch keine Kartons im Angebot eingetragen' : ''}
                          </span>
                        </div>
                      )}

                      {isHV && (
                        <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-[11px] space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200">
                            <span>Aufstellung: {hvzMethod === 'extern' ? 'Externe Firma' : 'Selbst (Rothirsch)'}</span>
                            <span>Ort: {hvzLoc === 'b' ? 'Einzug (B)' : hvzLoc === 'both' ? 'Beide (A & B)' : 'Auszug (A)'}</span>
                          </div>
                          {hvzAddress && <p className="text-slate-500 truncate">📍 {hvzAddress}</p>}
                        </div>
                      )}

                      {isLift && (
                        <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 text-[11px] space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200">
                            <span>Ort: {liftLoc === 'b' ? 'Einzug (B)' : 'Auszug (A)'}</span>
                            <span>{parentOrder?.orderMeta?.moebelliftTime ? `${parentOrder.orderMeta.moebelliftTime} - ${liftEndTime} (${liftDuration} Std.)` : `Dauer: ${liftDuration} Std.`}</span>
                          </div>
                          {liftAddress && <p className="text-slate-500 truncate">📍 {liftAddress}</p>}
                        </div>
                      )}

                      {isViewing && addressA && (
                        <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/40 text-[11px] text-slate-700 dark:text-slate-300">
                          <span className="font-bold block">{parentOrder?.orderMeta?.viewingType || 'Vor-Ort Besichtigung'}</span>
                          <span className="truncate block">📍 {addressA}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. CARD BOTTOM: GREEN PRIMARY BUTTONS ("Besichtigung starten" & "Als erledigt markieren") */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  {!todo.done ? (
                    <>
                      {isViewing && parentOrder?.customerId && (
                        <Link
                          href={`/dashboard/customers/${parentOrder.customerId}/edit-order/${parentOrder.id}?step=4`}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs shadow-emerald-600/20 transition-all"
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
                            ? 'px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
                            : 'w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20'
                        } rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 group active:scale-95 cursor-pointer`}
                      >
                        <CheckIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
                        <span>{isViewing && parentOrder?.customerId ? 'Erledigt' : 'Als erledigt markieren'}</span>
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
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
          onSaved={() => {
            // Realtime listener in Firestore automatically re-triggers snapshot
          }}
        />
      )}
    </div>
  );
}
