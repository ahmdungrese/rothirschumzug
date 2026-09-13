"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  CheckIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { generateTickets, SystemTicket } from '@/lib/ticketEngine';
import toast from 'react-hot-toast';

export default function LogisticsPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeTodos, setActiveTodos] = useState<SystemTicket[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [logisticsFilter, setLogisticsFilter] = useState<'all' | 'viewing' | 'kartons' | 'halteverbot' | 'moebellift' | 'rechnung'>('all');

  const tabBar = isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1a1c24]/80 border-white/5';
  const tabInact = isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-white/60' : 'text-text-muted hover:text-white hover:bg-[#1c1d29]';
  const detailPanel = isLight ? 'bg-white border-slate-200 shadow-lg' : 'bg-[#171821]/60 border-white/[0.06] shadow-xl backdrop-blur-md';
  const inlineInput = isLight ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400' : 'bg-black/30 border-white/10 text-white placeholder:text-white/20';

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
              id: `manual_${o.id}_${i}`, 
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
      setOrders(currentOrders);
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
      processData();
    });

    return () => {
      unsubOrders();
      unsubCustomers();
    };
  }, []);

  const markTodoDone = async (todo: SystemTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    if (todo.systemEvaluated && todo.done) return;
    
    // Optimistic UI
    setActiveTodos(prev => prev.map(t => (t.id === todo.id && t.orderId === todo.orderId) ? { ...t, done: !t.done } : t));
    
    try {
      if (todo.id.startsWith('manual_')) {
        const realId = todo.id.replace('manual_', '');
        const parentOrder = orders.find(o => o.id === todo.orderId);
        if (parentOrder && parentOrder.checklist) {
          const updatedChecklist = parentOrder.checklist.map((item: any) => 
            item.id === realId ? { ...item, done: !item.done } : item
          );
          await updateDoc(doc(db, 'orders', todo.orderId), {
            checklist: updatedChecklist,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        const stateKey = \	state_\\;
        await updateDoc(doc(db, 'orders', todo.orderId), {
          [\manualStates.\\]: !todo.done,
          updatedAt: serverTimestamp()
        });
      }
      toast.success(todo.done ? "Markierung entfernt" : "Als erledigt markiert!");
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Speichern");
      setActiveTodos(prev => prev.map(t => (t.id === todo.id && t.orderId === todo.orderId) ? { ...t, done: !todo.done } : t));
    }
  };

  const getTicketStatusBadge = (t: SystemTicket) => {
    if (t.done) return <span className="bg-green-500/10 text-green-400 text-[9px] font-bold px-2 py-0.5 rounded border border-green-500/20">Erledigt</span>;
    if (t.dueDateStatus === 'overdue') return <span className="bg-red-500/10 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded border border-red-500/20 shadow-sm animate-pulse">oeberfllig</span>;
    if (t.dueDateStatus === 'due_soon') return <span className="bg-yellow-500/10 text-yellow-400 text-[9px] font-bold px-2 py-0.5 rounded border border-yellow-500/20">Bald fllig</span>;
    return <span className={\	ext-[9px] font-bold px-2 py-0.5 rounded border \\}>Offen</span>;
  };

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
    return 0;
  });

  return (
    <div className="w-full max-w-full px-4 md:px-8 space-y-8 animate-in fade-in duration-500 pb-12 relative min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-4 border-b border-white/5 pb-6">
        <div>
          <h1 className={\	ext-2xl md:text-4xl font-extrabold tracking-tight \\}>
            Logistik-Aufgaben & To-Dos
          </h1>
          <p className="text-text-muted mt-2 text-sm font-medium">Verwalte hier alle operativen Aufgaben für bestätigte Aufträge und Besichtigungen.</p>
        </div>
      </header>

      <div className="space-y-6">
        <div className={\lex gap-2 overflow-x-auto pb-2 custom-scrollbar p-1.5 rounded-2xl w-max max-w-full shadow-md \\}>
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
              className={\px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border \\}
            >
              <span>{pill.label}</span>
              <span className={\	ext-[10px] px-1.5 py-0.5 rounded-full \\}>{pill.count}</span>
            </button>
          ))}
        </div>

        <div className={\\ border rounded-2xl overflow-hidden\}>
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
              <tbody className={\divide-y text-sm \\}>
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
                      className={\hover:bg-white/[0.01] transition-colors group \\}
                    >
                      <td className="py-4 px-6">
                        <span className={\px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border \\}>
                          {catMeta.label}
                        </span>
                      </td>

                      <td className={\py-4 px-6 font-bold tracking-tight \\}>
                        {todo.customerName}
                      </td>

                      <td className={\py-4 px-6 text-xs font-medium \\}>
                        {todo.title}
                      </td>

                      <td className="py-4 px-6 text-xs text-text-muted">
                        <div className="space-y-1.5 border-l border-white/10 pl-2">
                          <div className={\	ext-[10px] \\}>Umzug am: <span className={\\\}>{orderDate}</span></div>
                          
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
                                    {isViewing ? (
                                      <input
                                        type="datetime-local"
                                        defaultValue={['requested', 'erledigt_fotos'].includes(parentOrder.orderMeta?.viewingDate || '') ? '' : (parentOrder.orderMeta?.viewingDate?.slice(0, 16) || '')}
                                        onBlur={async (e) => {
                                          const val = e.target.value;
                                          if (val !== parentOrder.orderMeta?.viewingDate) {
                                            await updateDoc(doc(db, 'orders', parentOrder.id), {
                                              'orderMeta.viewingDate': val, viewingDate: val, updatedAt: serverTimestamp()
                                            });
                                            toast.success("Besichtigungstermin gespeichert!");
                                          }
                                        }}
                                        className={\\ border text-[11px] px-2 py-1 rounded w-36 focus:border-primary outline-none\}
                                      />
                                    ) : (
                                      <>
                                        <input 
                                          type="date"
                                          defaultValue={currentValDate}
                                          onBlur={async (e) => {
                                            const val = e.target.value;
                                            if (val !== currentValDate) {
                                              await updateDoc(doc(db, 'orders', parentOrder.id), {
                                                [\orderMeta.\\]: val, updatedAt: serverTimestamp()
                                              });
                                              toast.success("Datum gespeichert!");
                                            }
                                          }}
                                          className={\\ border text-[11px] px-2 py-1 rounded w-28 focus:border-primary outline-none\}
                                        />
                                        <input 
                                          type="text"
                                          placeholder="Zeit (z.B. 10-12 Uhr)"
                                          defaultValue={currentValTime}
                                          onBlur={async (e) => {
                                            const val = e.target.value;
                                            if (val !== currentValTime) {
                                              await updateDoc(doc(db, 'orders', parentOrder.id), {
                                                [\orderMeta.\\]: val, updatedAt: serverTimestamp()
                                              });
                                              toast.success("Uhrzeit gespeichert!");
                                            }
                                          }}
                                          className={\\ border text-[11px] px-2 py-1 rounded w-28 focus:border-primary outline-none\}
                                        />
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div>Auszug: <span className={\ont-semibold \\}>{parentOrder?.logistics?.a_city || '-'}</span></div>
                            );
                          })()}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {getTicketStatusBadge(todo)}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={(e) => markTodoDone(todo, e)} 
                            disabled={todo.systemEvaluated && todo.done}
                            className={\px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 border shadow-sm \\}
                          >
                            <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{todo.done ? 'Erledigt' : 'Erledigen'}</span>
                          </button>

                          <Link 
                            href={\/dashboard/customers/\\}
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
    </div>
  );
}
