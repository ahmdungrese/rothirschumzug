"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, onSnapshot, where, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TimeTracker } from '@/components/dashboard/TimeTracker';
import Link from 'next/link';
import { PlusIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { profile } = useAuth();
  
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    openItems: 0,
    overdueCount: 0
  });
  
  const [activeTodos, setActiveTodos] = useState<any[]>([]);
  const [logisticsWarnings, setLogisticsWarnings] = useState<any[]>([]);
  const [kanbanOrders, setKanbanOrders] = useState<{
    drafts: any[],
    quotes: any[],
    confirmed: any[],
    invoicing: any[]
  }>({ drafts: [], quotes: [], confirmed: [], invoicing: [] });

  useEffect(() => {
    // Limit to orders from the last 30 days to save Firebase reads
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      let revenue = 0;
      let openSum = 0;
      let overdue = 0;
      let logistics: any[] = [];
      let allTodos: any[] = [];

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      orders.forEach((o: any) => {
        // Financials
        const orderDate = o.createdAt?.toDate() || new Date();
        const isCurrentMonth = orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
        
        const totalGross = o.totals?.gross || 0;
        let totalPaid = 0;
        
        if (o.payments && Array.isArray(o.payments)) {
          o.payments.forEach((p: any) => {
            const pDate = p.date?.toDate() || new Date();
            if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
              revenue += p.amount;
            }
            totalPaid += p.amount;
          });
        } else if (o.status === 'invoice_paid' && isCurrentMonth) {
          revenue += totalGross;
          totalPaid = totalGross;
        }

        const remaining = Math.max(0, totalGross - totalPaid);

        if ((o.status === 'invoice_open' || o.status === 'invoice_overdue') && remaining > 0) {
          openSum += remaining;
        }
        if (o.status === 'invoice_overdue') {
          overdue++;
        }

        // Logistics Warnings (Halteverbot/Möbellift) for confirmed orders/quotes
        if (o.logistics) {
          if (o.logistics.noParkingZone && !o.logistics.noParkingZoneConfirmed) {
            logistics.push({ id: o.id, type: 'Halteverbot', customer: o.customerId });
          }
          if (o.logistics.furnitureLift && !o.logistics.furnitureLiftConfirmed) {
            logistics.push({ id: o.id, type: 'Möbellift', customer: o.customerId });
          }
        }
        // Todos extrahieren
        if (o.status === 'confirmed' && o.todos && Array.isArray(o.todos)) {
          o.todos.forEach((t: any) => {
            if (!t.isDone) {
              allTodos.push({ ...t, orderId: o.id, customerName: o.customerName || 'Kunde', customerId: o.customerId });
            }
          });
        }
      });

      setStats({ monthlyRevenue: revenue, openItems: openSum, overdueCount: overdue });
      setLogisticsWarnings(logistics);
      setActiveTodos(allTodos);
      
      // Kanban Board Data
      setKanbanOrders({
        drafts: orders.filter(o => {
          if (o.status !== 'draft' && o.status !== 'quote') return false;
          const hasName = o.customerName && o.customerName.trim() !== '';
          const hasDate = o.movingDate && o.movingDate.trim() !== '';
          const hasAddress = o.logistics && o.logistics.a_street && o.logistics.a_street.trim() !== '';
          return !(hasName && hasDate && hasAddress);
        }),
        quotes: orders.filter(o => {
          if (o.status !== 'draft' && o.status !== 'quote') return false;
          const hasName = o.customerName && o.customerName.trim() !== '';
          const hasDate = o.movingDate && o.movingDate.trim() !== '';
          const hasAddress = o.logistics && o.logistics.a_street && o.logistics.a_street.trim() !== '';
          return hasName && hasDate && hasAddress;
        }),
        confirmed: orders.filter(o => o.status === 'confirmed'),
        invoicing: orders.filter(o => ['completed', 'invoice_open', 'invoice_overdue'].includes(o.status))
      });
      
    }, (error) => {
      console.error("Error fetching stats", error);
    });

    return () => { unsubscribe(); };
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Zone 1: Kopfbereich & Quick Actions */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-text-muted mt-1">Willkommen zurück, {profile?.displayName || 'Admin'}!</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {profile?.role !== 'admin' && <TimeTracker />}
          
          <Link href="/dashboard/orders/new" className="btn-primary flex items-center justify-center gap-2 py-3 px-6 text-sm font-semibold shadow-lg hover:shadow-xl transition-shadow w-full sm:w-auto">
            <PlusIcon className="w-5 h-5" />
            Neues Angebot
          </Link>
          <Link href="/dashboard/customers?action=new" className="bg-bg-dark border border-structure text-white hover:bg-structure/30 transition-colors rounded-xl flex items-center justify-center gap-2 py-3 px-6 text-sm font-semibold shadow-lg w-full sm:w-auto">
            <PlusIcon className="w-5 h-5 text-text-muted" />
            Neuer Kunde
          </Link>
        </div>
      </section>

      {/* Zone 2: Ampelsystem (Kritische Warnungen) */}
      {(stats.overdueCount > 0 || logisticsWarnings.length > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.overdueCount > 0 && (
            <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl flex items-start gap-4 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500 flex-shrink-0" />
              <div>
                <h3 className="text-red-400 font-bold mb-1 uppercase tracking-wider text-sm">Finanz-Warnung</h3>
                <p className="text-red-200 text-sm">
                  {stats.overdueCount} {stats.overdueCount === 1 ? 'Rechnung ist' : 'Rechnungen sind'} überfällig und im Mahnstatus.
                </p>
                <Link href="/dashboard/finances" className="text-red-400 text-xs font-semibold mt-2 inline-block hover:underline">
                  Jetzt prüfen &rarr;
                </Link>
              </div>
            </div>
          )}
          
          {logisticsWarnings.length > 0 && (
            <div className="bg-orange-900/20 border border-orange-500/30 p-5 rounded-2xl flex items-start gap-4 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
              <ExclamationTriangleIcon className="w-8 h-8 text-orange-500 flex-shrink-0" />
              <div>
                <h3 className="text-orange-400 font-bold mb-1 uppercase tracking-wider text-sm">Logistik-Aktion erforderlich</h3>
                <p className="text-orange-200 text-sm">
                  {logisticsWarnings.length} unbestätigte Logistik-Aufgaben (Halteverbot / Möbellift).
                </p>
                <Link href="/dashboard/orders" className="text-orange-400 text-xs font-semibold mt-2 inline-block hover:underline">
                  Disposition öffnen &rarr;
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Zone 3: Hauptbereich (Rollenbasiert) */}
      {profile?.role === 'admin' ? (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-white border-b border-structure pb-2">Chef-Übersicht (Live-Kennzahlen)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="panel border-t-4 border-t-green-500">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider">Bezahlt (Dieser Monat)</h3>
              <p className="text-3xl font-bold mt-2 text-white">€ {stats.monthlyRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="panel border-t-4 border-t-primary">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider">Offene Posten (Gesamt)</h3>
              <p className="text-3xl font-bold mt-2 text-white">€ {stats.openItems.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="panel border-t-4 border-t-blue-500">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider">Team-Status</h3>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-text-muted">Eingestempelt:</span>
                <span className="text-white font-medium bg-blue-500/20 px-2 py-0.5 rounded text-blue-400">0 Mitarbeiter</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Zone 2.5: Aufgaben Zentrale (Tickets) */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-white border-b border-structure pb-2 flex items-center gap-2">
          <ClipboardDocumentListIcon className="w-6 h-6 text-primary" /> 
          Aufgaben-Zentrale
        </h2>
        <div className="panel border-t-4 border-t-primary">
          <h3 className="font-semibold text-text-main mb-4">Offene System-Tickets ({activeTodos.length})</h3>
          
          {activeTodos.length === 0 ? (
            <div className="bg-bg-dark border border-structure rounded-lg p-6 text-center">
              <p className="text-text-muted text-sm">Alles erledigt! Keine offenen Tickets.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTodos.map(todo => (
                <div key={todo.id} className="bg-bg-dark border border-structure rounded-lg p-4 flex flex-col justify-between shadow-md hover:border-primary/50 transition-colors">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                        Ticket
                      </span>
                    </div>
                    <h4 className="text-white font-medium text-sm leading-snug">{todo.title}</h4>
                    <Link href={`/dashboard/customers/${todo.customerId}`} className="text-text-muted text-xs hover:text-white mt-1 inline-block truncate max-w-[200px]">
                      Für: {todo.customerName}
                    </Link>
                  </div>
                  <div className="mt-4 pt-3 border-t border-structure flex justify-end">
                    <button 
                      onClick={async () => {
                        // Optimistic UI update
                        setActiveTodos(prev => prev.filter(t => t.id !== todo.id));
                        
                        // Finde das zugehörige Order-Dokument
                        const parentOrder = kanbanOrders.confirmed.find(o => o.id === todo.orderId);
                        if (parentOrder && parentOrder.todos) {
                          const updatedTodos = parentOrder.todos.map((t:any) => 
                            t.id === todo.id ? { ...t, isDone: true } : t
                          );
                          try {
                            await updateDoc(doc(db, 'orders', todo.orderId), { todos: updatedTodos });
                          } catch (e) {
                            console.error("Fehler beim Abhaken", e);
                          }
                        }
                      }}
                      className="btn-secondary py-1 px-3 text-xs flex items-center gap-2 hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30"
                    >
                      Als erledigt markieren ✓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Zone 4: Kanban Ticket-System (Auftrags-Pipeline) */}
      <section className="space-y-6 mt-8">
        <h2 className="text-xl font-semibold text-white border-b border-structure pb-2 flex items-center justify-between">
          <span>📋 Ticket-System (Auftrags-Pipeline)</span>
          <span className="text-sm font-normal text-text-muted">Live-Übersicht aller laufenden Projekte</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
          
          {/* Spalte 1: Neu / Fehlende Daten */}
          <div className="bg-bg-dark border border-structure rounded-xl flex flex-col h-[500px]">
            <div className="p-3 border-b border-structure bg-red-900/20 rounded-t-xl shrink-0 flex justify-between items-center">
              <h3 className="font-semibold text-red-400 text-sm truncate">1. Neu / Fehlende Daten</h3>
              <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full shrink-0">{kanbanOrders.drafts.length}</span>
            </div>
            <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {kanbanOrders.drafts.map(order => (
                <Link key={order.id} href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}`} className="block bg-bg-panel border border-structure hover:border-primary/50 transition-colors rounded-lg p-3 shadow-md cursor-pointer">
                  <div className="text-xs text-text-muted mb-1">{new Date(order.createdAt?.toMillis() || Date.now()).toLocaleDateString('de-DE')}</div>
                  <div className="font-semibold text-white truncate">{order.customerName || 'Unbekannt'}</div>
                  <div className="text-sm text-primary font-medium mt-2">€ {order.totals?.gross?.toFixed(2) || '0.00'}</div>
                </Link>
              ))}
              {kanbanOrders.drafts.length === 0 && <p className="text-text-muted text-xs text-center italic py-4">Leer</p>}
            </div>
          </div>

          {/* Spalte 2: Echter Kunde */}
          <div className="bg-bg-dark border border-structure rounded-xl flex flex-col h-[500px]">
            <div className="p-3 border-b border-structure bg-yellow-900/20 rounded-t-xl shrink-0 flex justify-between items-center">
              <h3 className="font-semibold text-yellow-400 text-sm truncate">2. Echter Kunde (In Klärung)</h3>
              <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full shrink-0">{kanbanOrders.quotes.length}</span>
            </div>
            <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {kanbanOrders.quotes.map(order => (
                <Link key={order.id} href={`/dashboard/orders`} className="block bg-bg-panel border border-blue-500/30 hover:border-blue-400 transition-colors rounded-lg p-3 shadow-md cursor-pointer">
                  <div className="text-xs text-blue-400/70 mb-1">{order.orderNumber || 'Angebot'}</div>
                  <div className="font-semibold text-white truncate">{order.customerName || 'Unbekannt'}</div>
                  <div className="text-sm text-blue-400 font-medium mt-2">€ {order.totals?.gross?.toFixed(2) || '0.00'}</div>
                </Link>
              ))}
              {kanbanOrders.quotes.length === 0 && <p className="text-text-muted text-xs text-center italic py-4">Leer</p>}
            </div>
          </div>

          {/* Spalte 3: Vorbereitung (Dispo) */}
          <div className="bg-bg-dark border border-structure rounded-xl flex flex-col h-[500px]">
            <div className="p-3 border-b border-structure bg-green-900/20 rounded-t-xl shrink-0 flex justify-between items-center">
              <h3 className="font-semibold text-green-400 text-sm truncate">3. Vorbereitung (Dispo)</h3>
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full shrink-0">{kanbanOrders.confirmed.length}</span>
            </div>
            <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {kanbanOrders.confirmed.map(order => (
                <Link key={order.id} href={`/dashboard/orders`} className="block bg-bg-panel border border-orange-500/30 hover:border-orange-400 transition-colors rounded-lg p-3 shadow-md cursor-pointer">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs text-orange-400/70">{order.orderNumber || 'Auftrag'}</div>
                    {order.disposition?.movingDate && (
                      <div className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                        {new Date(order.disposition.movingDate).toLocaleDateString('de-DE')}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-white truncate">{order.customerName || 'Unbekannt'}</div>
                  <div className="text-xs text-text-muted mt-2 truncate flex items-center gap-1">
                    📍 {order.logistics?.loadingAddress?.split(',')[0]} &rarr; {order.logistics?.unloadingAddress?.split(',')[0]}
                  </div>
                </Link>
              ))}
              {kanbanOrders.confirmed.length === 0 && <p className="text-text-muted text-xs text-center italic py-4">Leer</p>}
            </div>
          </div>

          {/* Spalte 4: Erledigt / Rechnung */}
          <div className="bg-bg-dark border border-structure rounded-xl flex flex-col h-[500px]">
            <div className="p-3 border-b border-structure bg-purple-900/20 rounded-t-xl shrink-0 flex justify-between items-center">
              <h3 className="font-semibold text-purple-400 text-sm truncate">4. Erledigt / Rechnung</h3>
              <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full shrink-0">{kanbanOrders.invoicing.length}</span>
            </div>
            <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {kanbanOrders.invoicing.map(order => (
                <Link key={order.id} href={`/dashboard/customers/${order.customerId}`} className={`block bg-bg-panel border transition-colors rounded-lg p-3 shadow-md cursor-pointer ${order.status === 'invoice_overdue' ? 'border-red-500/50 hover:border-red-400' : 'border-primary/30 hover:border-primary'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs text-text-muted">{order.invoiceNumber || order.orderNumber || 'Rechnung'}</div>
                    {order.status === 'invoice_overdue' && (
                      <div className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Mahnung</div>
                    )}
                  </div>
                  <div className="font-semibold text-white truncate">{order.customerName || 'Unbekannt'}</div>
                  
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-sm font-medium text-white">€ {order.totals?.gross?.toFixed(2) || '0.00'}</div>
                    <div className={`text-xs font-bold ${order.status === 'invoice_overdue' ? 'text-red-400' : 'text-primary'}`}>
                      Offen: € {Math.max(0, (order.totals?.gross || 0) - (order.payments?.reduce((s:number,p:any)=>s+p.amount,0)||0)).toFixed(2)}
                    </div>
                  </div>
                </Link>
              ))}
              {kanbanOrders.invoicing.length === 0 && <p className="text-text-muted text-xs text-center italic py-4">Leer</p>}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
