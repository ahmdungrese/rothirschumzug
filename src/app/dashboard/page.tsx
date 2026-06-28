"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  XMarkIcon, ArchiveBoxIcon, MapIcon, ArrowUpOnSquareIcon, 
  DocumentTextIcon, TruckIcon, CheckIcon, MapPinIcon, ClockIcon
} from '@heroicons/react/24/outline';
import { getCol } from '@/lib/demoMode';
import { generateTickets, SystemTicket } from '@/lib/ticketEngine';

export default function DashboardPage() {
  const { profile } = useAuth();
  
  const [activeTodos, setActiveTodos] = useState<SystemTicket[]>([]);
  const [kanbanOrders, setKanbanOrders] = useState<{
    drafts: any[],
    quotes: any[],
    confirmed: any[],
    invoicing: any[]
  }>({ drafts: [], quotes: [], confirmed: [], invoicing: [] });
  const [orders, setOrders] = useState<any[]>([]);
  
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

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
          if (!t.done) {
            allTodos.push(t);
          }
        });

        // Manuelle Checklisten-Einträge aus OrderEditor anhängen
        if (o.status === 'confirmed' && o.checklist && Array.isArray(o.checklist)) {
          o.checklist.forEach((t: any) => {
            if (!t.done) {
              allTodos.push({ 
                id: `manual_${t.id}`, 
                title: t.text, 
                phase: 2, 
                type: 'info', 
                done: false, 
                orderId: o.id, 
                customerName: o.customerName || 'Kunde', 
                kanbanCategory: 'general' 
              });
            }
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
      processDashboardData();
    });

    return () => { 
      unsubOrders(); 
      unsubCustomers(); 
    };
  }, []);

  const markTodoDone = async (todo: SystemTicket, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Optimistic UI update
    setActiveTodos(prev => prev.filter(t => t.id !== todo.id || t.orderId !== todo.orderId));
    
    try {
      if (todo.id.startsWith('manual_')) {
        const realId = todo.id.replace('manual_', '');
        const parentOrder = orders.find((o: any) => o.id === todo.orderId);
        if (parentOrder && parentOrder.checklist) {
          const updatedChecklist = parentOrder.checklist.map((t:any) => 
            t.id === realId ? { ...t, done: true } : t
          );
          await updateDoc(doc(db, getCol('orders'), todo.orderId as string), { checklist: updatedChecklist });
        }
      } else {
        const parentOrder = orders.find((o: any) => o.id === todo.orderId);
        if (parentOrder) {
          const updatedStates = parentOrder.ticketStates || {};
          updatedStates[todo.id] = true;
          await updateDoc(doc(db, getCol('orders'), todo.orderId as string), { ticketStates: updatedStates });
        }
      }
    } catch (err) {
      console.error("Fehler beim Abhaken", err);
    }
  };

  const getDueDateBadge = (status?: 'neutral' | 'due' | 'overdue', text?: string) => {
    if (status === 'overdue') return <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.5)] border border-red-500/30">{text}</span>;
    if (status === 'due') return <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded shadow-[0_0_8px_rgba(234,179,8,0.3)] border border-yellow-500/30">{text}</span>;
    return null;
  };

  const renderTaskCard = (todo: SystemTicket) => {
    const parentOrder = orders.find(o => o.id === todo.orderId);
    const orderDate = parentOrder?.orderMeta?.movingDateFrom ? new Date(parentOrder.orderMeta.movingDateFrom).toLocaleDateString('de-DE') : 'TBA';
    
    return (
      <div key={todo.id + todo.orderId} className="kanban-card">
        <div className="flex justify-between items-start mb-2">
          <span className="font-semibold text-text-main text-sm truncate">{todo.customerName}</span>
          {getDueDateBadge(todo.dueDateStatus, todo.dueDateText)}
        </div>
        <div className="text-xs text-text-muted mb-2 flex-1">
          {todo.title}
          <div className="mt-1 text-[10px] text-text-muted/70">Auszug: {parentOrder?.logistics?.a_street?.split(',')[0] || 'Unbekannt'}</div>
          {orderDate !== 'TBA' && <div className="mt-0.5 text-[10px] text-text-muted/70">Datum: {orderDate}</div>}
        </div>
        <div className="mt-3 flex justify-between items-center border-t border-white/5 pt-2">
          <button onClick={(e) => markTodoDone(todo, e)} className="text-text-muted hover:text-green-400 transition-colors">
            <CheckIcon className="w-5 h-5" />
          </button>
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px] text-white">
            {todo.customerName?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 relative min-h-screen">
      {/* Background Graphic (Subtle) */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-[-1] overflow-hidden">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[2px]" />
      </div>

      <header className="flex justify-between items-center pt-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-main">Dashboard</h1>
          <p className="text-text-muted mt-1 text-sm">Willkommen zurück, {profile?.displayName || 'Admin'}!</p>
        </div>
      </header>

      {/* A. OPERATIVE AUFGABEN-LOGISTIK */}
      <section className="glass-panel p-4 md:p-6">
        <h2 className="text-sm md:text-base font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          A. Operative Aufgaben-Logistik (To-Dos)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 min-h-[300px]">
          {/* Kartons */}
          <div className="kanban-col">
            <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="font-semibold text-text-main text-xs uppercase flex items-center gap-2"><ArchiveBoxIcon className="w-4 h-4 text-orange-400" /> KARTONS (LIEFERN)</h3>
              <span className="text-[10px] text-text-muted">{activeTodos.filter(t => t.kanbanCategory === 'kartons').length} Aufg.</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {activeTodos.filter(t => t.kanbanCategory === 'kartons').map(renderTaskCard)}
            </div>
          </div>
          {/* Halteverbot */}
          <div className="kanban-col">
            <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="font-semibold text-text-main text-xs uppercase flex items-center gap-2"><MapIcon className="w-4 h-4 text-yellow-400" /> HALTEVERBOT (BEANTRAGEN)</h3>
              <span className="text-[10px] text-text-muted">{activeTodos.filter(t => t.kanbanCategory === 'halteverbot').length} Aufg.</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {activeTodos.filter(t => t.kanbanCategory === 'halteverbot').map(renderTaskCard)}
            </div>
          </div>
          {/* Möbellift */}
          <div className="kanban-col">
            <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="font-semibold text-text-main text-xs uppercase flex items-center gap-2"><ArrowUpOnSquareIcon className="w-4 h-4 text-blue-400" /> MÖBELLIFT (BUCHEN)</h3>
              <span className="text-[10px] text-text-muted">{activeTodos.filter(t => t.kanbanCategory === 'moebellift').length} Aufg.</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {activeTodos.filter(t => t.kanbanCategory === 'moebellift').map(renderTaskCard)}
            </div>
          </div>
          {/* Rechnung */}
          <div className="kanban-col">
            <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="font-semibold text-text-main text-xs uppercase flex items-center gap-2"><DocumentTextIcon className="w-4 h-4 text-green-400" /> RECHNUNG (ERSTELLEN)</h3>
              <span className="text-[10px] text-text-muted">{activeTodos.filter(t => t.kanbanCategory === 'rechnung').length} Aufg.</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {activeTodos.filter(t => t.kanbanCategory === 'rechnung').map(renderTaskCard)}
            </div>
          </div>
        </div>
      </section>

      {/* B. VERTRIEBS-PIPELINE */}
      <section className="glass-panel p-4 md:p-6 mt-8">
        <h2 className="text-sm md:text-base font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          B. Vertriebs-Pipeline (Kunden-Status)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 min-h-[400px]">
          
          {/* Neu / Entwurf */}
          <div className="kanban-col">
             <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="font-semibold text-text-main text-xs uppercase">NEU / ENTWURF</h3>
              <span className="text-[10px] text-text-muted">{kanbanOrders.drafts.length} Aufg.</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {kanbanOrders.drafts.map(order => (
                <div key={order.id} onClick={() => setSelectedOrder(order)} className="kanban-card group border-red-500/20 hover:border-red-400/50">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Customer Ticket</span>
                  <div className="font-semibold text-text-main mt-1 truncate group-hover:text-red-500 dark:group-hover:text-red-300 transition-colors">{order.customerName || 'Unbekannt'}</div>
                  <div className="mt-3 flex justify-between items-center border-t border-black/5 dark:border-white/5 pt-2">
                     <CheckIcon className="w-4 h-4 text-text-muted/50 group-hover:text-text-muted transition-colors" />
                     <div className="w-5 h-5 rounded-full bg-structure flex items-center justify-center text-[8px] text-white">
                        {order.customerName?.charAt(0) || 'U'}
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Angebot Erstellt */}
          <div className="kanban-col">
             <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="font-semibold text-text-main text-xs uppercase">ANGEBOT ERSTELLT</h3>
              <span className="text-[10px] text-text-muted">{kanbanOrders.quotes.length} Aufg.</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {kanbanOrders.quotes.map(order => (
                <div key={order.id} onClick={() => setSelectedOrder(order)} className="kanban-card group border-yellow-500/20 hover:border-yellow-400/50">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Customer Ticket</span>
                  <div className="font-semibold text-text-main mt-1 truncate group-hover:text-yellow-600 dark:group-hover:text-yellow-300 transition-colors">{order.customerName || 'Unbekannt'}</div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-500/70 mt-1">€ {order.totals?.gross?.toFixed(2) || '0.00'}</div>
                  <div className="mt-3 flex justify-between items-center border-t border-black/5 dark:border-white/5 pt-2">
                     <CheckIcon className="w-4 h-4 text-text-muted/50 group-hover:text-text-muted transition-colors" />
                     <div className="w-5 h-5 rounded-full bg-structure flex items-center justify-center text-[8px] text-white">
                        {order.customerName?.charAt(0) || 'U'}
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Umzug Bestätigt */}
          <div className="kanban-col relative">
             <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="font-semibold text-text-main text-xs uppercase">UMZUG BESTÄTIGT</h3>
              <span className="text-[10px] text-text-muted">{kanbanOrders.confirmed.length} Aufg.</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {kanbanOrders.confirmed.map(order => (
                <div key={order.id} onClick={() => setSelectedOrder(order)} className="kanban-card group border-primary/30 hover:border-primary/60 bg-primary/5">
                  <span className="text-[10px] text-primary/70 uppercase tracking-wider">Customer Ticket</span>
                  <div className="font-semibold text-text-main mt-1 truncate group-hover:text-primary-hover transition-colors">{order.customerName || 'Unbekannt'}</div>
                  {order.orderMeta?.movingDateFrom && (
                    <div className="text-[10px] text-text-muted mt-1 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded inline-block">
                      {new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE')}
                    </div>
                  )}
                  <div className="mt-3 flex justify-between items-center border-t border-black/5 dark:border-white/5 pt-2">
                     <CheckIcon className="w-4 h-4 text-text-muted/50 group-hover:text-text-muted transition-colors" />
                     <div className="w-5 h-5 rounded-full bg-structure flex items-center justify-center text-[8px] text-white">
                        {order.customerName?.charAt(0) || 'U'}
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Abgeschlossen */}
          <div className="kanban-col">
             <div className="flex justify-between items-center px-1 mb-2">
              <h3 className="font-semibold text-text-main text-xs uppercase">ABGESCHLOSSEN</h3>
              <span className="text-[10px] text-text-muted">{kanbanOrders.invoicing.length} Aufg.</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {kanbanOrders.invoicing.map(order => (
                <div key={order.id} onClick={() => setSelectedOrder(order)} className="kanban-card group border-green-500/20 hover:border-green-400/50">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Customer Ticket</span>
                  <div className="font-semibold text-text-main mt-1 truncate group-hover:text-green-600 dark:group-hover:text-green-300 transition-colors">{order.customerName || 'Unbekannt'}</div>
                  <div className={`text-[10px] mt-1 font-bold ${order.status === 'invoice_overdue' ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-500/70'}`}>
                    {order.status === 'invoice_overdue' ? 'MAHNUNG OFFEN' : 'RECHNUNG GESTELLT'}
                  </div>
                  <div className="mt-3 flex justify-between items-center border-t border-black/5 dark:border-white/5 pt-2">
                     <CheckIcon className="w-4 h-4 text-text-muted/50 group-hover:text-text-muted transition-colors" />
                     <div className="w-5 h-5 rounded-full bg-structure flex items-center justify-center text-[8px] text-white">
                        {order.customerName?.charAt(0) || 'U'}
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

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
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Checklist (Aktive To-Dos)</h3>
                <div className="space-y-2 bg-black/5 dark:bg-black/20 rounded-lg p-3 border border-black/10 dark:border-white/5">
                  {activeTodos.filter(t => t.orderId === selectedOrder.id).map(todo => (
                    <div key={todo.id} className="flex items-center justify-between group">
                      <label className="flex items-center gap-3 cursor-pointer text-sm text-text-main group-hover:text-primary transition-colors">
                        <input 
                          type="checkbox" 
                          checked={false} 
                          onChange={() => markTodoDone(todo)}
                          className="w-4 h-4 rounded border-structure bg-bg-dark text-primary focus:ring-primary focus:ring-offset-bg-panel"
                        />
                        {todo.title}
                      </label>
                      {getDueDateBadge(todo.dueDateStatus, todo.dueDateText)}
                    </div>
                  ))}
                  {activeTodos.filter(t => t.orderId === selectedOrder.id).length === 0 && (
                    <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                      <CheckIcon className="w-4 h-4" /> Alle System-Aufgaben erledigt!
                    </div>
                  )}
                </div>
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
