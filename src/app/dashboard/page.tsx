"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  XMarkIcon, ArchiveBoxIcon, MapIcon, ArrowUpOnSquareIcon, 
  DocumentTextIcon, TruckIcon, CheckIcon, MapPinIcon, ClockIcon,
  UserIcon, PencilIcon
} from '@heroicons/react/24/outline';
import { getCol } from '@/lib/demoMode';
import { generateTickets, SystemTicket } from '@/lib/ticketEngine';
import { changeOrderStatus } from '@/lib/orderStateMachine';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Theme-aware class helpers
  const card      = isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#171821]/80 border-white/[0.06] text-white';
  const cardHover = isLight ? 'hover:border-primary/40 hover:shadow-lg' : 'hover:border-primary/40 hover:shadow-xl hover:shadow-black/25';
  const col       = isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#161722]/55 border-white/[0.04]';
  const statCard  = isLight ? 'bg-white border-slate-200' : 'bg-[#1a1c24]/50 border-white/5';
  const tabBar    = isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1a1c24]/80 border-white/5';
  const tabActive = isLight ? 'bg-white text-slate-900 shadow border-slate-300' : 'bg-white/10 text-white shadow';
  const tabInact  = isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-white/60' : 'text-text-muted hover:text-white hover:bg-[#1c1d29]';
  const detailPanel = isLight ? 'bg-white border-slate-200 shadow-lg' : 'bg-[#171821]/60 border-white/[0.06] shadow-xl backdrop-blur-md';
  const colHeader = isLight ? 'text-slate-600' : 'text-text-muted';
  const txt       = isLight ? 'text-slate-800' : 'text-white';
  const txtMuted  = isLight ? 'text-slate-500' : 'text-white/70';
  const txtFaint  = isLight ? 'text-slate-400' : 'text-white/50';
  const insetBox  = isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/20 border-white/5';
  const inlineInput = isLight ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400' : 'bg-black/30 border-white/10 text-white placeholder:text-white/20';
  
  const [activeTodos, setActiveTodos] = useState<SystemTicket[]>([]);
  const [kanbanOrders, setKanbanOrders] = useState<{
    drafts: any[],
    quotes: any[],
    confirmed: any[],
    invoicing: any[]
  }>({ drafts: [], quotes: [], confirmed: [], invoicing: [] });
  const [orders, setOrders] = useState<any[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, any>>({});
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [activePhaseTab, setActivePhaseTab] = useState<number>(1);
  const [showAllPhases, setShowAllPhases] = useState<boolean>(false);
  const [dashboardView, setDashboardView] = useState<'pipeline' | 'logistics'>('pipeline');
  const [logisticsFilter, setLogisticsFilter] = useState<'all' | 'viewing' | 'kartons' | 'halteverbot' | 'moebellift' | 'rechnung'>('all');
  
  const getOrderAlerts = (order: any) => {
    const alerts = [];
    const now = new Date();
    
    // 1. Unbearbeitet seit 3 Tagen (für Entwürfe, Angebote, Klärungen)
    if (['draft', 'quote', 'clarification'].includes(order.status)) {
      let updatedAtDate = new Date();
      if (order.updatedAt) {
        updatedAtDate = order.updatedAt?.seconds ? new Date(order.updatedAt.seconds * 1000) : new Date(order.updatedAt);
      } else if (order.createdAt) {
        updatedAtDate = order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt);
      }
      const diff = now.getTime() - updatedAtDate.getTime();
      const diffDays = diff / (1000 * 60 * 60 * 24);
      if (diffDays >= 3) {
        alerts.push({ type: 'inactive', text: 'Seit 3 Tagen unbearbeitet!' });
      }
    }
    
    // 2. Überfällig (Umzugstermin vorbei aber nicht completed/abgeschlossen)
    if (order.status === 'confirmed' && order.orderMeta?.movingDateFrom) {
      const moveDate = new Date(order.orderMeta.movingDateFrom);
      moveDate.setHours(23, 59, 59, 999);
      if (now > moveDate) {
        alerts.push({ type: 'overdue', text: 'Umzug überfällig!' });
      }
    }
    
    // 3. Rechnung überfällig (completed, aber keine Rechnung nach 5 Tagen)
    if (order.status === 'completed' && order.orderMeta?.movingDateFrom) {
      const moveDate = new Date(order.orderMeta.movingDateFrom);
      const diff = now.getTime() - moveDate.getTime();
      const diffDays = diff / (1000 * 60 * 60 * 24);
      if (diffDays >= 5) {
        alerts.push({ type: 'invoice_overdue', text: 'Rechnung überfällig!' });
      }
    }
    
    return alerts;
  };

  useEffect(() => {
    const qOrders = query(collection(db, getCol('orders')));
    const qCustomers = query(collection(db, getCol('customers')));
    
    let currentOrders: any[] = [];
    let currentCustomers: Record<string, any> = {};

    const processDashboardData = () => {
      let allTodos: SystemTicket[] = [];

      currentOrders.forEach((o: any) => {
        const customerData = currentCustomers[o.customerId] || null;
        const systemTickets = generateTickets(o, customerData);
        systemTickets.forEach(t => {
          allTodos.push(t);
        });

        // Manuelle Checklisten-Einträge aus OrderEditor anhängen
        if (o.status === 'confirmed' && o.checklist && Array.isArray(o.checklist)) {
          o.checklist.forEach((t: any) => {
            allTodos.push({ 
              id: `manual_${t.id}`, 
              title: t.text, 
              phase: 2, 
              type: 'info', 
              done: !!t.done, 
              orderId: o.id, 
              customerName: o.customerName || 'Kunde', 
              kanbanCategory: 'general' 
            });
          });
        }
      });

      setActiveTodos(allTodos);
      
      setKanbanOrders({
        drafts: currentOrders.filter(o => {
          if (o.status !== 'draft' && o.status !== 'quote') return false;
          const hasName = o.customerName && o.customerName.trim() !== '';
          const hasDate = o.orderMeta?.movingDateFrom && o.orderMeta.movingDateFrom.trim() !== '';
          const hasAddress = o.logistics?.a_street && o.logistics.a_street.trim() !== '';
          return !(hasName && hasDate && hasAddress);
        }),
        quotes: currentOrders.filter(o => {
          if (o.status !== 'draft' && o.status !== 'quote') return false;
          const hasName = o.customerName && o.customerName.trim() !== '';
          const hasDate = o.orderMeta?.movingDateFrom && o.orderMeta.movingDateFrom.trim() !== '';
          const hasAddress = o.logistics?.a_street && o.logistics.a_street.trim() !== '';
          return hasName && hasDate && hasAddress;
        }),
        confirmed: currentOrders.filter(o => o.status === 'confirmed'),
        invoicing: currentOrders.filter(o => ['completed', 'invoice_open', 'invoice_overdue'].includes(o.status))
      });
    };
    
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      currentOrders = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setOrders(currentOrders);
      processDashboardData();
    });

    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      const cmap: Record<string, any> = {};
      snapshot.docs.forEach(doc => { cmap[doc.id] = { id: doc.id, ...doc.data() }; });
      currentCustomers = cmap;
      setCustomersMap(cmap);
      processDashboardData();
    });

    return () => { 
      unsubOrders(); 
      unsubCustomers(); 
    };
  }, []);

  const markTodoDone = async (todo: SystemTicket, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (todo.systemEvaluated) {
      // Cannot manually check off system evaluated tickets
      return;
    }
    
    // Optimistic UI update
    setActiveTodos(prev => prev.map(t => (t.id === todo.id && t.orderId === todo.orderId) ? { ...t, done: !t.done } : t));
    
    try {
      if (todo.id.startsWith('manual_')) {
        const realId = todo.id.replace('manual_', '');
        const parentOrder = orders.find((o: any) => o.id === todo.orderId);
        if (parentOrder && parentOrder.checklist) {
          const updatedChecklist = parentOrder.checklist.map((t:any) => 
            t.id === realId ? { ...t, done: !todo.done } : t
          );
          await changeOrderStatus(todo.orderId as string, parentOrder.status as any, { 
            userId: user?.uid,
            additionalData: { checklist: updatedChecklist } 
          });
        }
      } else {
        const parentOrder = orders.find((o: any) => o.id === todo.orderId);
        if (parentOrder) {
          const updatedStates = parentOrder.ticketStates || {};
          updatedStates[todo.id] = !todo.done;
          await changeOrderStatus(todo.orderId as string, parentOrder.status as any, { 
            userId: user?.uid,
            additionalData: { ticketStates: updatedStates } 
          });
        }
      }
    } catch (err) {
      console.error("Fehler beim Abhaken", err);
    }
  };

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;

    // Optimistic UI Update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    try {
      await changeOrderStatus(orderId, newStatus as any, { userId: user?.uid });
    } catch (err: any) {
      console.error("Fehler beim Verschieben des Auftrags", err);
      toast.error(err.message || "Fehler beim Verschieben.");
      // Revert optimistic update
      const originalOrder = orders.find(o => o.id === orderId);
      if (originalOrder) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: originalOrder.status } : o));
      }
    }
  };

  const getTicketStatusBadge = (todo: SystemTicket) => {
    if (todo.done) {
      return <span className="bg-green-500/20 text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-green-500/30">ERLEDIGT</span>;
    }
    if (todo.dueDateStatus === 'overdue') {
      return <span className="bg-red-500/20 text-red-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse">ÜBERFÄLLIG</span>;
    }
    if (todo.dueDateStatus === 'due') {
      return <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/30">{todo.dueDateText || 'FÄLLIG'}</span>;
    }
    return <span className="bg-blue-500/20 text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-500/30">NEU / OFFEN</span>;
  };

  const renderTaskCard = (todo: SystemTicket) => {
    const parentOrder = orders.find(o => o.id === todo.orderId);
    const orderDate = parentOrder?.orderMeta?.movingDateFrom ? new Date(parentOrder.orderMeta.movingDateFrom).toLocaleDateString('de-DE') : 'TBA';
    
    return (
      <div 
        key={todo.id + todo.orderId} 
        className={`${card} ${cardHover} border rounded-xl p-3.5 shadow-lg hover:translate-y-[-2px] transition-all duration-300 flex flex-col gap-2.5 ${
          todo.done ? 'opacity-55' : ''
        }`}
      >
        <div className="flex justify-between items-start gap-2">
          <span className={`font-bold text-[13px] tracking-tight break-words flex-1 leading-snug ${isLight ? (todo.done ? 'line-through text-slate-400 text-slate-800' : 'text-slate-800') : (todo.done ? 'line-through text-white/40 text-white' : 'text-white')}`}>
            {todo.customerName}
          </span>
          <div className="shrink-0">
            {getTicketStatusBadge(todo)}
          </div>
        </div>

        <div className={`text-[11px] font-medium leading-relaxed ${todo.done ? (isLight ? 'text-slate-400 line-through' : 'text-white/30 line-through') : (isLight ? 'text-slate-600' : 'text-white/70')}`}>
          {todo.title}
          <div className="mt-2 space-y-0.5 border-l border-white/10 pl-2">
            <div className="text-[10px] text-text-muted">Auszug: <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-white/60'}`}>{parentOrder?.logistics?.a_street?.split(',')[0] || 'Unbekannt'}</span></div>
            {orderDate !== 'TBA' && (
              <div className="text-[10px] text-text-muted">Datum: <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-white/60'}`}>{orderDate}</span></div>
            )}
          </div>
        </div>

        <div className="mt-2 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
          {/* Interactive Checkmark Button */}
          <button 
            onClick={(e) => markTodoDone(todo, e)} 
            disabled={todo.systemEvaluated && todo.done}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 border shadow-md active:scale-95 ${
              todo.done 
                ? 'bg-green-500/10 border-green-500/20 text-green-400 cursor-default' 
                : todo.systemEvaluated 
                  ? 'bg-black/40 border-white/5 text-text-muted/40 cursor-not-allowed opacity-60'
                  : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-white cursor-pointer'
            }`}
            title={todo.systemEvaluated && !todo.done ? "Systemaufgabe (wird automatisch aktualisiert)" : "Als erledigt markieren"}
          >
            <CheckIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{todo.done ? 'Erledigt' : 'Erledigen'}</span>
          </button>

          {todo.actionLink && todo.id !== 'viewing_requested' && (
            <Link 
              href={todo.actionLink}
              onClick={(e) => e.stopPropagation()}
              className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 border shadow-md bg-white/5 border-white/5 text-text-muted hover:bg-white/10 hover:text-white"
              title="Aktion ausführen"
            >
              Los
            </Link>
          )}

          {/* Quick link icon to customer profile */}
          <Link 
            href={`/dashboard/customers/${todo.customerId}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-text-muted hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all cursor-pointer"
            title="Kundenprofil öffnen"
          >
            <UserIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  };

  const renderKanbanCard = (order: any, columnType: 'draft' | 'quote' | 'confirmed' | 'invoicing') => {
    const orderTickets = activeTodos.filter(t => t.orderId === order.id);
    const completedCount = orderTickets.filter(t => t.done).length;
    const totalCount = orderTickets.length;
    const alerts = getOrderAlerts(order);

    return (
      <div 
        draggable
        onDragStart={(e) => handleDragStart(e, order.id)}
        key={order.id} 
        onClick={() => setSelectedOrder(order)} 
        className={`${card} ${cardHover} border rounded-xl p-3.5 hover:translate-y-[-2px] transition-all duration-200 cursor-grab active:cursor-grabbing flex flex-col gap-2.5`}
      >
        {/* Header: Label and Price */}
        <div className="flex justify-between items-center gap-2">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-text-muted">
            Kunden-Ticket
          </span>
          {order.totals?.gross > 0 && (
            <div className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-sm font-mono shrink-0">
              €{order.totals.gross.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>

        {/* Customer Name */}
        <div className={`font-extrabold text-[14px] tracking-tight leading-snug break-words ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {order.customerName || 'Unbekannt'}
        </div>

        {/* Route Details */}
        <div className={`text-[10px] ${isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'text-white/70 bg-black/20 border-white/5'} p-2 rounded-lg flex items-center justify-between gap-2`}>
          <div className="flex flex-col gap-0.5">
            <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-white/90'}`}>{order.logistics?.a_city || '-'}</span>
          </div>
          <div className={`font-bold ${isLight ? 'text-slate-400' : 'text-white/30'}`}>➔</div>
          <div className="flex flex-col gap-0.5">
            <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-white/90'}`}>{order.logistics?.b_city || '-'}</span>
          </div>
        </div>

        {/* Moving Date or Invoicing Status */}
        {columnType === 'invoicing' ? (
          <div className={`text-[10px] font-bold uppercase tracking-wider ${order.status === 'invoice_overdue' ? 'text-red-400' : 'text-emerald-400'}`}>
            {order.status === 'invoice_overdue' ? 'Mahnung offen' : 'Rechnung gestellt'}
          </div>
        ) : order.orderMeta?.movingDateFrom ? (
          <div className={`text-[10px] flex items-center gap-1.5 px-2 py-1 rounded-lg w-max font-medium border ${isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'text-white/80 bg-white/5 border-white/5'}`}>
            <ClockIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span>{new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE')}</span>
          </div>
        ) : null}

        {/* Smart Alerts (Strip emojis) */}
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {alerts.map((alert, idx) => {
              const cleanText = alert.text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();
              return (
                <div 
                  key={idx} 
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shadow-sm ${
                    alert.type === 'overdue' || alert.type === 'invoice_overdue' 
                      ? 'bg-red-500/10 border-red-500/25 text-red-400' 
                      : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
                  }`}
                >
                  {cleanText}
                </div>
              );
            })}
          </div>
        )}

        {/* Signature Status Badge (Strip emojis) */}
        {columnType === 'quote' && (
          <div>
            {order.signatureOrder ? (
              <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-500/20 shadow-sm w-max inline-block font-sans">Digital signiert</span>
            ) : order.externallyConfirmed ? (
              <span className="bg-blue-500/10 text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/20 shadow-sm w-max inline-block font-sans">WhatsApp bestätigt</span>
            ) : (
              <span className="bg-red-500/10 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded border border-red-500/20 shadow-sm w-max inline-block font-sans">Unterschrift fehlt</span>
            )}
          </div>
        )}

        {/* Task Progress Bar */}
        {totalCount > 0 && (
          <div className="mt-1 pt-2 border-t border-white/5">
            <div className="flex justify-between items-center text-[9px] text-text-muted mb-1 font-bold">
              <span>FORTSCHRITT:</span>
              <span>{completedCount}/{totalCount} Aufgaben</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500" 
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Footer: Quick Interactive Action Links */}
        <div className="mt-1.5 pt-2 border-t border-white/5 flex items-center justify-between gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
          <Link 
            href={`/dashboard/customers/${order.customerId}`}
            onClick={(e) => e.stopPropagation()}
            className="px-2.5 py-1 text-[10px] font-bold rounded bg-white/5 border border-white/5 text-text-muted hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer"
          >
            <UserIcon className="w-3.5 h-3.5 shrink-0" /> Profil
          </Link>
          <Link 
            href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}`}
            onClick={(e) => e.stopPropagation()}
            className="px-2.5 py-1 text-[10px] font-bold rounded bg-white/5 border border-white/5 text-text-muted hover:text-yellow-400 hover:bg-yellow-400/10 hover:border-yellow-400/20 transition-all flex items-center gap-1 cursor-pointer"
          >
            <PencilIcon className="w-3.5 h-3.5 shrink-0" /> Bearbeiten
          </Link>
        </div>
      </div>
    );
  };
  const renderLogisticsList = () => {
    const filtered = activeTodos.filter(t => {
      const isLogistics = t.id === 'viewing_requested' || ['kartons', 'halteverbot', 'moebellift', 'rechnung'].includes(t.kanbanCategory as string);
      if (!isLogistics) return false;
      if (logisticsFilter === 'all') return true;
      if (logisticsFilter === 'viewing') return t.id === 'viewing_requested';
      return t.kanbanCategory === logisticsFilter;
    });

    filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.dueDateStatus === 'overdue' && b.dueDateStatus !== 'overdue') return -1;
      if (b.dueDateStatus === 'overdue' && a.dueDateStatus !== 'overdue') return 1;
      return 0;
    });

    return (
      <div className="space-y-4">
        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 pb-2">
          {[
            { id: 'all', label: 'Alle Aufgaben', count: activeTodos.filter(t => t.id === 'viewing_requested' || ['kartons', 'halteverbot', 'moebellift', 'rechnung'].includes(t.kanbanCategory as string)).length },
            { id: 'viewing', label: 'Besichtigungen', count: activeTodos.filter(t => t.id === 'viewing_requested').length },
            { id: 'kartons', label: 'Kartons', count: activeTodos.filter(t => t.kanbanCategory === 'kartons').length },
            { id: 'halteverbot', label: 'Halteverbot', count: activeTodos.filter(t => t.kanbanCategory === 'halteverbot').length },
            { id: 'moebellift', label: 'Möbellift', count: activeTodos.filter(t => t.kanbanCategory === 'moebellift').length },
            { id: 'rechnung', label: 'Rechnungen', count: activeTodos.filter(t => t.kanbanCategory === 'rechnung').length }
          ].map(pill => (
            <button
              key={pill.id}
              onClick={() => setLogisticsFilter(pill.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                logisticsFilter === pill.id
                  ? 'bg-primary border-primary-hover text-white shadow-lg shadow-primary/20'
                  : tabInact
              }`}
            >
              <span>{pill.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                logisticsFilter === pill.id ? 'bg-white/20 text-white' : 'bg-white/5 text-text-muted'
              }`}>{pill.count}</span>
            </button>
          ))}
        </div>

        {/* List View Container */}
        <div className={`${detailPanel} border rounded-2xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Kategorie</th>
                  <th className="py-4 px-6">Kunde</th>
                  <th className="py-4 px-6">Aufgabe</th>
                  <th className="py-4 px-6">Details / Termin</th>
                  <th className="py-4 px-6">Fälligkeit</th>
                  <th className="py-4 px-6 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-sm ${isLight ? 'divide-slate-100 text-slate-800' : 'divide-white/5 text-white/90'}`}>
                {filtered.map(todo => {
                  const parentOrder = orders.find(o => o.id === todo.orderId);
                  const orderDate = parentOrder?.orderMeta?.movingDateFrom ? new Date(parentOrder.orderMeta.movingDateFrom).toLocaleDateString('de-DE') : 'TBA';
                  
                  const catMetaMap: Record<string, { label: string, color: string }> = {
                    viewing_requested: { label: 'Besichtigung', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                    kartons: { label: 'Kartons', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
                    halteverbot: { label: 'Halteverbot', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
                    moebellift: { label: 'Möbellift', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                    rechnung: { label: 'Rechnung', color: 'bg-green-500/10 text-green-400 border-green-500/20' }
                  };
                  const catMeta = catMetaMap[todo.id === 'viewing_requested' ? 'viewing_requested' : (todo.kanbanCategory || 'general')] || { label: 'Logistik', color: 'bg-white/5 text-white/60 border-white/10' };

                  return (
                    <tr 
                      key={todo.id + todo.orderId}
                      className={`hover:bg-white/[0.01] transition-colors group ${todo.done ? 'opacity-50' : ''}`}
                    >
                      {/* Category Badge */}
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${catMeta.color}`}>
                          {catMeta.label}
                        </span>
                      </td>

                      {/* Customer Name */}
                      <td className={`py-4 px-6 font-bold tracking-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {todo.customerName}
                      </td>

                      {/* Task Title */}
                      <td className={`py-4 px-6 text-xs font-medium ${isLight ? 'text-slate-600' : 'text-white/80'}`}>
                        {todo.title}
                      </td>

                      {/* Details / Date */}
                      <td className="py-4 px-6 text-xs text-text-muted">
                        <div className="space-y-1.5 border-l border-white/10 pl-2">
                          <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-white/50'}`}>Umzug am: <span className={`${isLight ? 'text-slate-700' : 'text-white/80'}`}>{orderDate}</span></div>
                          
                          {(() => {
                            const isKarton = todo.id === 'kartons_liefern';
                            const isHV = todo.id === 'halteverbot';
                            const isLift = todo.id === 'moebellift_buchen';
                            const isViewing = todo.id === 'viewing_requested';
                            const isLogisticsTask = isKarton || isHV || isLift || isViewing;

                            if (isLogisticsTask && parentOrder) {
                              const dateField = isKarton ? 'kartonDeliveryDate' : isHV ? 'halteverbotDate' : isLift ? 'moebelliftDate' : 'viewingDate';
                              const timeField = isKarton ? 'kartonDeliveryTime' : isHV ? 'halteverbotTime' : isLift ? 'moebelliftTime' : 'viewingTime';
                              
                              const currentValDate = isKarton ? (parentOrder.orderMeta?.kartonDeliveryDate || '') :
                                isHV ? (parentOrder.orderMeta?.halteverbotDate || '') :
                                isLift ? (parentOrder.orderMeta?.moebelliftDate || '') :
                                (parentOrder.orderMeta?.viewingDate || '');

                              const currentValTime = isKarton ? (parentOrder.orderMeta?.kartonDeliveryTime || '') :
                                isHV ? (parentOrder.orderMeta?.halteverbotTime || '') :
                                isLift ? (parentOrder.orderMeta?.moebelliftTime || '') :
                                (parentOrder.orderMeta?.viewingTime || '');

                              return (
                                <div className="flex flex-col gap-1 mt-1 bg-black/20 p-1.5 rounded border border-white/5">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Termin & Zeit:</span>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="date"
                                      defaultValue={currentValDate}
                                      onBlur={async (e) => {
                                        const val = e.target.value;
                                        if (val !== currentValDate) {
                                          await updateDoc(doc(db, getCol('orders'), parentOrder.id), {
                                            [`orderMeta.${dateField}`]: val, updatedAt: serverTimestamp()
                                          });
                                          toast.success("Datum gespeichert!");
                                        }
                                      }}
                                      className={`${inlineInput} border text-[11px] px-2 py-1 rounded w-28 focus:border-primary outline-none`}
                                    />
                                    <input 
                                      type="text"
                                      placeholder="Zeit (z.B. 10-12 Uhr)"
                                      defaultValue={currentValTime}
                                      onBlur={async (e) => {
                                        const val = e.target.value;
                                        if (val !== currentValTime) {
                                          await updateDoc(doc(db, getCol('orders'), parentOrder.id), {
                                            [`orderMeta.${timeField}`]: val, updatedAt: serverTimestamp()
                                          });
                                          toast.success("Uhrzeit gespeichert!");
                                        }
                                      }}
                                      className={`${inlineInput} border text-[11px] px-2 py-1 rounded w-28 focus:border-primary outline-none`}
                                    />
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div>Auszug: <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-white/70'}`}>{parentOrder?.logistics?.a_city || '-'}</span></div>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Due Status */}
                      <td className="py-4 px-6">
                        {getTicketStatusBadge(todo)}
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {/* Checkbox button */}
                          <button 
                            onClick={(e) => markTodoDone(todo, e)} 
                            disabled={todo.systemEvaluated && todo.done}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 border shadow-sm ${
                              todo.done 
                                ? 'bg-green-500/10 border-green-500/20 text-green-400 cursor-default' 
                                : todo.systemEvaluated 
                                  ? 'bg-black/40 border-white/5 text-text-muted/40 cursor-not-allowed opacity-60'
                                  : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-white cursor-pointer active:scale-95'
                            }`}
                          >
                            <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{todo.done ? 'Erledigt' : 'Erledigen'}</span>
                          </button>

                          {/* Profile Link */}
                          <Link 
                            href={`/dashboard/customers/${todo.customerId}`}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-text-muted hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all"
                            title="Kundenprofil öffnen"
                          >
                            <UserIcon className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-text-muted italic text-xs">
                      Keine anstehenden Aufgaben in dieser Kategorie.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full px-4 md:px-8 space-y-8 animate-in fade-in duration-500 pb-12 relative min-h-screen">
      {/* Background Graphic (Subtle) */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-[-1] overflow-hidden">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[2px]" />
      </div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-4 border-b border-white/5 pb-6">
        <div>
          <h1 className={`text-2xl md:text-4xl font-extrabold tracking-tight ${isLight ? 'text-slate-900' : 'bg-gradient-to-r from-white via-white/90 to-white/50 bg-clip-text text-transparent'}`}>Zentrale Disposition</h1>
          <p className="text-text-muted mt-2 text-sm md:text-base font-medium">Willkommen zurück, <span className="text-primary font-bold">{profile?.displayName || 'Admin'}</span>. Hier ist deine heutige Auslastung.</p>
        </div>
        
        {/* Modern KPI Widgets */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full md:w-auto shrink-0">
          <div className={`${statCard} border p-3 rounded-xl min-w-[120px] shadow-md hover:border-primary/30 transition-all group`}>
            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Angebote</span>
            <div className={`text-xl font-bold group-hover:text-primary transition-colors mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>{orders.filter(o => o.status === 'quote').length}</div>
          </div>
          <div className={`${statCard} border p-3 rounded-xl min-w-[120px] shadow-md hover:border-emerald-500/30 transition-all group`}>
            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Umzüge</span>
            <div className={`text-xl font-bold group-hover:text-emerald-400 transition-colors mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>{orders.filter(o => o.status === 'confirmed').length}</div>
          </div>
          <div className={`${statCard} border p-3 rounded-xl min-w-[120px] shadow-md hover:border-red-500/30 transition-all group`}>
            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Überfällig</span>
            <div className={`text-xl font-bold group-hover:text-red-400 transition-colors mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>{activeTodos.filter(t => !t.done && t.dueDateStatus === 'overdue').length}</div>
          </div>
          <div className={`${statCard} border p-3 rounded-xl min-w-[120px] shadow-md hover:border-purple-500/30 transition-all group`}>
            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Aufgaben</span>
            <div className={`text-xl font-bold group-hover:text-purple-400 transition-colors mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>{activeTodos.filter(t => !t.done).length}</div>
          </div>
        </div>
      </header>

      {/* Dynamic View Tab Switcher */}
      <div className={`flex ${tabBar} border p-1.5 rounded-2xl w-max max-w-full shadow-md shrink-0`}>
        <button
          onClick={() => setDashboardView('pipeline')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            dashboardView === 'pipeline'
              ? 'bg-primary text-white shadow-lg shadow-primary/20 border border-primary-hover'
              : 'text-text-muted hover:text-white'
          }`}
        >
          <span>Kunden-Status</span>
        </button>
        <button
          onClick={() => setDashboardView('logistics')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            dashboardView === 'logistics'
              ? 'bg-primary text-white shadow-lg shadow-primary/20 border border-primary-hover'
              : 'text-text-muted hover:text-white'
          }`}
        >
          <span>Logistik-Aufgaben & To-Dos</span>
          {activeTodos.filter(t => t.id === 'viewing_requested' || ['kartons', 'halteverbot', 'moebellift', 'rechnung'].includes(t.kanbanCategory as string)).filter(t => !t.done).length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
              {activeTodos.filter(t => t.id === 'viewing_requested' || ['kartons', 'halteverbot', 'moebellift', 'rechnung'].includes(t.kanbanCategory as string)).filter(t => !t.done).length}
            </span>
          )}
        </button>
      </div>

      {dashboardView === 'pipeline' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className={`text-base font-extrabold uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
              Kunden-Status
            </h2>
            <span className={`text-[10px] px-2.5 py-1 rounded-xl ${isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/5 border border-white/5 text-text-muted'}`}>
              Drag &amp; Drop zum Verschieben aktiv
            </span>
          </div>

          {/* Adaptive Horizontal Board Layout: stretches to fill full screen if columns fit, scrolls if they overflow! */}
          <div className="flex flex-row gap-5 overflow-x-auto pb-6 pt-2 items-start custom-scrollbar w-full min-h-[500px]">
            
            {/* Neu / Entwurf */}
            <div className={`flex flex-col gap-3.5 p-3.5 ${col} border rounded-2xl h-fit max-h-[85vh] shadow-sm flex-1 min-w-[280px] max-w-[420px] shrink-0`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'draft')}>
              <div className={`flex justify-between items-center px-2 py-1.5 mb-2 w-full border-b pb-2.5 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <h3 className={`font-extrabold text-[11px] uppercase tracking-wider ${colHeader}`}>NEU / ENTWURF</h3>
                </div>
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/5 text-white/60'}`}>{kanbanOrders.drafts.length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                {kanbanOrders.drafts.map(order => renderKanbanCard(order, 'draft'))}
              </div>
            </div>

            {/* Angebot Erstellt */}
            <div className={`flex flex-col gap-3.5 p-3.5 ${col} border rounded-2xl h-fit max-h-[85vh] shadow-sm flex-1 min-w-[280px] max-w-[420px] shrink-0`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'quote')}>
              <div className={`flex justify-between items-center px-2 py-1.5 mb-2 w-full border-b pb-2.5 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                  <h3 className={`font-extrabold text-[11px] uppercase tracking-wider ${colHeader}`}>ANGEBOT ERSTELLT</h3>
                </div>
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/5 text-white/60'}`}>{kanbanOrders.quotes.length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                {kanbanOrders.quotes.map(order => renderKanbanCard(order, 'quote'))}
              </div>
            </div>

            {/* Umzug Bestätigt */}
            <div className={`flex flex-col gap-3.5 p-3.5 ${col} border rounded-2xl h-fit max-h-[85vh] shadow-sm flex-1 min-w-[280px] max-w-[420px] shrink-0 relative`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'confirmed')}>
              <div className={`flex justify-between items-center px-2 py-1.5 mb-2 w-full border-b pb-2.5 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <h3 className={`font-extrabold text-[11px] uppercase tracking-wider ${colHeader}`}>UMZUG BESTÄTIGT</h3>
                </div>
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/5 text-white/60'}`}>{kanbanOrders.confirmed.length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                {kanbanOrders.confirmed.map(order => renderKanbanCard(order, 'confirmed'))}
              </div>
            </div>

            {/* Abgeschlossen */}
            <div className={`flex flex-col gap-3.5 p-3.5 ${col} border rounded-2xl h-fit max-h-[85vh] shadow-sm flex-1 min-w-[280px] max-w-[420px] shrink-0`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'invoice_open')}>
              <div className={`flex justify-between items-center px-2 py-1.5 mb-2 w-full border-b pb-2.5 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <h3 className={`font-extrabold text-[11px] uppercase tracking-wider ${colHeader}`}>ABGESCHLOSSEN</h3>
                </div>
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/5 text-white/60'}`}>{kanbanOrders.invoicing.length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                {kanbanOrders.invoicing.map(order => renderKanbanCard(order, 'invoicing'))}
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className={`text-base font-extrabold uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
            Logistik-Aufgaben &amp; To-Dos
          </h2>
          {renderLogisticsList()}
        </div>
      )}

      {/* MODAL: Customer Pop-Up Profile */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
          <div className="relative glass-panel bg-bg-panel border border-structure w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main transition-colors bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-full p-1"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            
            <div className="p-6 md:p-8 space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-text-main">{selectedOrder.customerName || 'Unbekannt'}</h2>
                <div className="flex gap-4 mt-2 text-sm text-text-muted">
                  {selectedOrder.orderMeta?.movingDateFrom && (
                    <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4" /> {new Date(selectedOrder.orderMeta.movingDateFrom).toLocaleDateString('de-DE')}</span>
                  )}
                  {selectedOrder.orderNumber && (
                    <span className="flex items-center gap-1"><DocumentTextIcon className="w-4 h-4" /> #{selectedOrder.orderNumber}</span>
                  )}
                </div>
              </div>

              {/* Route */}
              <div className="bg-black/5 dark:bg-white/5 rounded-lg p-4 border border-black/10 dark:border-white/10">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Route</h3>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 text-sm">
                  <div className="flex-1">
                    <span className="text-text-muted block text-xs">Auszug</span>
                    <span className="text-text-main font-medium">{selectedOrder.logistics?.a_street || '-'}</span><br/>
                    <span className="text-text-muted text-xs">{selectedOrder.logistics?.a_postalCode} {selectedOrder.logistics?.a_city}</span>
                  </div>
                  <div className="hidden md:flex flex-col items-center justify-center text-primary">
                    <TruckIcon className="w-5 h-5 mb-1" />
                    <div className="h-px w-12 bg-primary/30"></div>
                  </div>
                  <div className="flex-1">
                    <span className="text-text-muted block text-xs">Einzug</span>
                    <span className="text-text-main font-medium">{selectedOrder.logistics?.b_street || '-'}</span><br/>
                    <span className="text-text-muted text-xs">{selectedOrder.logistics?.b_postalCode} {selectedOrder.logistics?.b_city}</span>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Booked Services</h3>
                <ul className="space-y-2">
                  {selectedOrder.services?.map((s: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-text-main">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                      {s.name}
                    </li>
                  ))}
                  {!selectedOrder.services?.length && <li className="text-sm text-text-muted italic">Keine Services definiert</li>}
                </ul>
              </div>

              {/* Checklist / Tasks for this specific order */}
              <div>
                {(() => {
                  const customer = customersMap[selectedOrder.customerId] || null;
                  const tickets = generateTickets(selectedOrder, customer);

                  const isQuoteOrHigher = ['quote', 'confirmed', 'completed', 'invoice_open', 'invoice_paid'].includes(selectedOrder.status);
                  const isConfirmedOrHigher = ['confirmed', 'completed', 'invoice_open', 'invoice_paid'].includes(selectedOrder.status);
                  const isCompletedOrHigher = ['completed', 'invoice_open', 'invoice_paid'].includes(selectedOrder.status);
                  const isInvoiceGenerated = ['invoice_open', 'invoice_paid'].includes(selectedOrder.status) || orders.some(o => o.sourceOrderId === selectedOrder.id);
                  const isSigned = !!selectedOrder.signatureOrder || !!selectedOrder.externallyConfirmed;

                  const phase1Tickets = tickets.filter(t => t.phase === 1);
                  const phase2Tickets = [
                    ...tickets.filter(t => t.id === 'viewing_requested'),
                    {
                      id: 'transition_quote',
                      title: 'Angebot erstellen & senden',
                      phase: 2,
                      done: !!selectedOrder.orderMeta?.quoteCreatedAt || !!selectedOrder.ticketStates?.transition_quote,
                      dueDateStatus: (!!selectedOrder.orderMeta?.quoteCreatedAt || !!selectedOrder.ticketStates?.transition_quote) ? 'neutral' as const : 'due' as const,
                      dueDateText: (!!selectedOrder.orderMeta?.quoteCreatedAt || !!selectedOrder.ticketStates?.transition_quote) ? '' : 'ANGEBOT ERSTELLEN',
                      systemEvaluated: true
                    }
                  ];
                  const phase3Tickets = [
                    {
                      id: 'transition_confirm',
                      title: 'Auftrag bestätigen (Digitale Signatur / WhatsApp)',
                      phase: 3,
                      done: isConfirmedOrHigher || isSigned || !!selectedOrder.ticketStates?.transition_confirm,
                      dueDateStatus: (isQuoteOrHigher && !isConfirmedOrHigher) ? 'due' as const : 'neutral' as const,
                      dueDateText: (isQuoteOrHigher && !isConfirmedOrHigher) ? 'Freigabe ausstehend' : '',
                      systemEvaluated: true
                    }
                  ];
                  const phase4Tickets = [
                    ...tickets.filter(t => t.phase === 2 && t.id !== 'viewing_requested'),
                    ...tickets.filter(t => t.phase === 4),
                    {
                      id: 'transition_complete',
                      title: 'Umzug durchführen & Abnahmeprotokoll',
                      phase: 4,
                      done: isCompletedOrHigher || !!selectedOrder.ticketStates?.transition_complete,
                      dueDateStatus: (isConfirmedOrHigher && !isCompletedOrHigher) ? 'due' as const : 'neutral' as const,
                      dueDateText: (isConfirmedOrHigher && !isCompletedOrHigher) ? 'Umzug anstehend' : '',
                      systemEvaluated: true
                    }
                  ];
                  const phase5Tickets = [
                    ...tickets.filter(t => t.phase === 3),
                    {
                      id: 'transition_invoice',
                      title: 'Rechnung generieren & senden',
                      phase: 5,
                      done: isInvoiceGenerated || !!selectedOrder.ticketStates?.transition_invoice,
                      dueDateStatus: (isCompletedOrHigher && !isInvoiceGenerated) ? 'due' as const : 'neutral' as const,
                      dueDateText: (isCompletedOrHigher && !isInvoiceGenerated) ? 'Rechnung ausstehend' : '',
                      systemEvaluated: true
                    }
                  ];

                  const handleToggleTask = async (todo: any) => {
                    if (todo.systemEvaluated) {
                      toast('Wird automatisch erledigt, sobald das Feld ausgefüllt ist.', { icon: 'ℹ️' });
                      return;
                    }

                    const parentOrder = selectedOrder;
                    const updatedStates = parentOrder.ticketStates || {};
                    const newDone = !todo.done;
                    updatedStates[todo.id] = newDone;

                    let newStatus = parentOrder.status;
                    let extraFields: any = { ticketStates: updatedStates };

                    if (todo.id === 'transition_quote') {
                      if (newDone && parentOrder.status === 'draft') newStatus = 'quote';
                      else if (!newDone && parentOrder.status === 'quote') newStatus = 'draft';
                    } else if (todo.id === 'transition_confirm') {
                      if (newDone && ['draft', 'quote'].includes(parentOrder.status)) {
                        newStatus = 'confirmed';
                        extraFields.externallyConfirmed = true;
                      } else if (!newDone && parentOrder.status === 'confirmed') {
                        newStatus = 'quote';
                        extraFields.externallyConfirmed = false;
                      }
                    } else if (todo.id === 'transition_complete') {
                      if (newDone && ['draft', 'quote', 'confirmed'].includes(parentOrder.status)) {
                        newStatus = 'completed';
                      } else if (!newDone && parentOrder.status === 'completed') {
                        newStatus = 'confirmed';
                      }
                    } else if (todo.id === 'transition_invoice') {
                      if (newDone && ['draft', 'quote', 'confirmed', 'completed'].includes(parentOrder.status)) {
                        newStatus = 'invoice_open';
                      } else if (!newDone && parentOrder.status === 'invoice_open') {
                        newStatus = 'completed';
                      }
                    }

                    extraFields.status = newStatus;
                    extraFields.updatedAt = serverTimestamp();

                    try {
                      let additionalData: any = { ticketStates: updatedStates };
                      if (extraFields.externallyConfirmed !== undefined) {
                        additionalData.externallyConfirmed = extraFields.externallyConfirmed;
                      }
                      await changeOrderStatus(parentOrder.id, newStatus as any, {
                        userId: user?.uid,
                        additionalData
                      });
                      
                      setSelectedOrder((prev: any) => ({
                        ...prev,
                        status: newStatus,
                        ticketStates: updatedStates,
                        externallyConfirmed: extraFields.externallyConfirmed || prev.externallyConfirmed
                      }));
                      toast.success("Phase aktualisiert!");
                    } catch (err: any) {
                      console.error("Fehler beim Umschalten der Aufgabe", err);
                      toast.error(err.message || "Fehler beim Speichern.");
                    }
                  };

                  const phases = [
                    { num: 1, name: '1. Verifizieren', tickets: phase1Tickets },
                    { num: 2, name: '2. Angebot', tickets: phase2Tickets },
                    { num: 3, name: '3. Zusage', tickets: phase3Tickets },
                    { num: 4, name: '4. Umzug', tickets: phase4Tickets },
                    { num: 5, name: '5. Abrechnung', tickets: phase5Tickets },
                  ];

                  const renderPhaseList = (phaseNum: number, name: string, list: any[]) => (
                    <div key={phaseNum} className="space-y-2 bg-black/20 rounded-xl p-4 border border-white/5">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>{name}</span>
                        <span className="text-[10px] text-text-muted normal-case font-normal">{list.filter(t => !t.done).length} offen</span>
                      </h4>
                      <div className="space-y-2">
                        {list.map(todo => {
                          const isKarton = todo.id === 'kartons_liefern';
                          const isHV = todo.id === 'halteverbot';
                          const isLift = todo.id === 'moebellift_buchen';
                          const isViewing = todo.id === 'viewing_requested';

                          return (
                            <div key={todo.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-lg bg-black/10 border border-white/5 transition-all ${todo.done ? 'opacity-50' : ''}`}>
                              <label className="flex items-center gap-3 text-sm cursor-pointer select-none flex-1 font-semibold text-text-main">
                                <input 
                                  type="checkbox" 
                                  checked={todo.done} 
                                  onChange={() => handleToggleTask(todo)}
                                  className="w-4 h-4 rounded border-structure text-primary bg-bg-dark focus:ring-primary focus:ring-offset-bg-panel"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{todo.title}</span>
                                  {todo.dueDateStatus === 'overdue' && (
                                    <span className="bg-red-500/20 text-red-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/20 shadow-sm uppercase">ÜBERFÄLLIG</span>
                                  )}
                                  {todo.dueDateStatus === 'due' && (
                                    <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/20 shadow-sm uppercase">{todo.dueDateText}</span>
                                  )}
                                </div>
                              </label>

                              {/* Quick Access Buttons */}
                              <div className="flex items-center gap-2">
                                {todo.actionLink && todo.id !== 'viewing_requested' && (
                                  <Link href={todo.actionLink} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-white bg-primary/10 hover:bg-primary border border-primary/20 rounded-md transition-all whitespace-nowrap">
                                    Los
                                  </Link>
                                )}
                                {(todo.id === 'confirmation_sent' || todo.id === 'abnahmeprotokoll' || todo.id === 'employee_sheet') && (
                                  <Link href={`/dashboard/customers/${selectedOrder.customerId}`} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500 border border-blue-500/20 rounded-md transition-all whitespace-nowrap">
                                    Zum Kunden
                                  </Link>
                                )}
                              </div>

                              {/* Date Inputs in Modal Phase Manager */}
                              {!todo.done && (isKarton || isHV || isLift || isViewing) && (
                                <div className="flex flex-col gap-1 bg-black/40 p-1.5 rounded border border-white/5 shrink-0 self-start sm:self-auto">
                                  <span className="text-[9px] text-text-muted font-bold uppercase">Termin & Zeit:</span>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="date"
                                      value={
                                        isKarton ? (selectedOrder.orderMeta?.kartonDeliveryDate || '') :
                                        isHV ? (selectedOrder.orderMeta?.halteverbotDate || '') :
                                        isLift ? (selectedOrder.orderMeta?.moebelliftDate || '') :
                                        (selectedOrder.orderMeta?.viewingDate || '')
                                      }
                                      onChange={async (e) => {
                                        const val = e.target.value;
                                        const field = isKarton ? 'kartonDeliveryDate' : isHV ? 'halteverbotDate' : isLift ? 'moebelliftDate' : 'viewingDate';
                                        const orderRef = doc(db, getCol('orders'), selectedOrder.id);
                                        await updateDoc(orderRef, {
                                          [`orderMeta.${field}`]: val,
                                          updatedAt: serverTimestamp()
                                        });
                                        setSelectedOrder((prev: any) => ({
                                          ...prev,
                                          orderMeta: { ...prev?.orderMeta, [field]: val }
                                        }));
                                        toast.success("Datum aktualisiert!");
                                      }}
                                      className="bg-bg-dark text-[11px] text-text-main border border-structure rounded px-1.5 py-0.5 focus:border-primary focus:outline-none"
                                    />
                                    <input 
                                      type="text"
                                      placeholder="Zeit (z.B. 10-12 Uhr)"
                                      value={
                                        isKarton ? (selectedOrder.orderMeta?.kartonDeliveryTime || '') :
                                        isHV ? (selectedOrder.orderMeta?.halteverbotTime || '') :
                                        isLift ? (selectedOrder.orderMeta?.moebelliftTime || '') :
                                        (selectedOrder.orderMeta?.viewingTime || '')
                                      }
                                      onChange={async (e) => {
                                        const val = e.target.value;
                                        const field = isKarton ? 'kartonDeliveryTime' : isHV ? 'halteverbotTime' : isLift ? 'moebelliftTime' : 'viewingTime';
                                        const orderRef = doc(db, getCol('orders'), selectedOrder.id);
                                        await updateDoc(orderRef, {
                                          [`orderMeta.${field}`]: val,
                                          updatedAt: serverTimestamp()
                                        });
                                        setSelectedOrder((prev: any) => ({
                                          ...prev,
                                          orderMeta: { ...prev?.orderMeta, [field]: val }
                                        }));
                                      }}
                                      className="bg-bg-dark text-[11px] text-text-main border border-structure rounded px-1.5 py-0.5 focus:border-primary focus:outline-none placeholder:text-text-muted/50 w-28"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {list.length === 0 && (
                          <div className="text-xs text-text-muted italic">Keine anstehenden Aufgaben in dieser Phase.</div>
                        )}
                      </div>
                    </div>
                  );

                  return (
                    <div className="space-y-4">
                      {/* Header for Checklist */}
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                          Phasen- & Freigabe-Manager
                        </h3>
                        <button 
                          onClick={() => setShowAllPhases(!showAllPhases)} 
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            showAllPhases 
                              ? 'bg-primary text-white border-primary-hover shadow-lg shadow-primary/20' 
                              : 'bg-bg-dark border-structure text-text-muted hover:text-white'
                          }`}
                        >
                          {showAllPhases ? 'Phasen einzeln zeigen' : 'Alle Phasen ausklappen'}
                        </button>
                      </div>

                      {/* Phase Tabs (Only shown if showAllPhases is false) */}
                      {!showAllPhases && (
                        <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
                          {phases.map(p => (
                            <button
                              key={p.num}
                              onClick={() => setActivePhaseTab(p.num)}
                              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                                activePhaseTab === p.num
                                  ? 'bg-bg-panel text-primary shadow-sm border border-structure'
                                  : 'text-text-muted hover:text-text-main hover:bg-white/[0.02]'
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Phase Content Lists */}
                      <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                        {showAllPhases ? (
                          phases.map(p => renderPhaseList(p.num, p.name, p.tickets))
                        ) : (
                          (() => {
                            const active = phases.find(p => p.num === activePhaseTab);
                            return active ? renderPhaseList(active.num, active.name, active.tickets) : null;
                          })()
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-black/10 dark:border-white/10">
                 <Link href={`/dashboard/customers/${selectedOrder.customerId}/edit-order/${selectedOrder.id}`} className="btn-secondary">
                   Auftrag bearbeiten
                 </Link>
                 <Link href={`/dashboard/customers/${selectedOrder.customerId}`} className="btn-primary">
                   Kundenprofil öffnen
                 </Link>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
