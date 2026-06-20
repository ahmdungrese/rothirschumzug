"use client";

import { DocumentArrowDownIcon, XMarkIcon, MapPinIcon, TruckIcon, UserGroupIcon, ClipboardDocumentListIcon, CheckIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { EmployeeSheetPDF } from '@/components/pdf/EmployeeSheetPDF';
import { getCol } from '@/lib/demoMode';
import { generateTickets } from '@/lib/ticketEngine';

export function DispoModal({ 
  dateStr, 
  orders, 
  settings, 
  onClose 
}: { 
  dateStr: string; 
  orders: any[]; 
  settings: any; 
  onClose: () => void 
}) {
  const { profile } = useAuth();
  const displayDate = new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  // Filter only moving orders (no boxes or viewings) that happen on this day
  const dayOrders = orders.filter(o => {
    const isConfirmed = !['draft', 'quote'].includes(o.status);
    const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
    return effectiveMovingDate?.split('T')[0] === dateStr && isConfirmed;
  });

  // Calculate Tasks (Boxes, Parking, Viewings)
  const dayTasks: any[] = [];
  orders.forEach(o => {
    let createdAtObj = new Date();
    if (o.createdAt) createdAtObj = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.createdAt);
    
    const isConfirmed = !['draft', 'quote'].includes(o.status);
    
    // Halteverbot
    if (o.logistics?.noParkingZone && isConfirmed) {
      const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
      if (effectiveMovingDate) {
        let hvDate = new Date(effectiveMovingDate.split('T')[0]);
        hvDate.setDate(hvDate.getDate() - 4);
        if (hvDate < createdAtObj) hvDate = new Date(createdAtObj);
        const hvDateStr = `${hvDate.getFullYear()}-${String(hvDate.getMonth() + 1).padStart(2, '0')}-${String(hvDate.getDate()).padStart(2, '0')}`;
        if (hvDateStr === dateStr) {
          dayTasks.push({ id: o.id, type: 'halteverbot', title: 'Halteverbot aufstellen', customer: o.customerName, isDone: !!o.ticketStates?.halteverbot });
        }
      }
    }
    
    // Kartons
    if (o.services?.some((s: any) => s.name.toLowerCase().includes('karton')) && isConfirmed) {
      const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
      if (effectiveMovingDate) {
        let boxDate = new Date(effectiveMovingDate.split('T')[0]);
        boxDate.setDate(boxDate.getDate() - 28);
        if (boxDate < createdAtObj) boxDate = new Date(createdAtObj);
        const boxDateStr = `${boxDate.getFullYear()}-${String(boxDate.getMonth() + 1).padStart(2, '0')}-${String(boxDate.getDate()).padStart(2, '0')}`;
        if (boxDateStr === dateStr) {
          dayTasks.push({ id: o.id, type: 'kartons_liefern', title: 'Kartons liefern', customer: o.customerName, isDone: !!o.ticketStates?.kartons_liefern });
        }
      }
    }

    // Besichtigung
    const effectiveViewingDate = o.orderMeta?.viewingDate || o.viewingDate;
    if (effectiveViewingDate && effectiveViewingDate.split('T')[0] === dateStr) {
      dayTasks.push({ id: o.id, type: 'viewing_requested', title: 'Besichtigungstermin', customer: o.customerName, isDone: !!o.ticketStates?.viewing_requested });
    }
  });

  const handleToggleTask = async (orderId: string, ticketId: string, currentState: boolean) => {
    try {
      await updateDoc(doc(db, getCol('orders'), orderId), {
        [`ticketStates.${ticketId}`]: !currentState
      });
      toast.success(currentState ? 'Aufgabe wieder offen' : 'Aufgabe als erledigt markiert!');
    } catch (error) {
      toast.error('Fehler beim Speichern der Aufgabe.');
    }
  };

  const updateResource = async (orderId: string, field: string, value: number) => {
    try {
      await updateDoc(doc(db, getCol('orders'), orderId), {
        [`disposition.${field}`]: Math.max(0, value)
      });
    } catch (e) {
      toast.error("Fehler beim Speichern");
    }
  };

  // Summen berechnen
  let totalHelpers = 0;
  let totalKoffer35t = 0;
  let totalLkw7t = 0;

  dayOrders.forEach(o => {
    totalHelpers += o.disposition?.helpers || 0;
    totalKoffer35t += o.disposition?.koffer35t || 0;
    totalLkw7t += o.disposition?.lkw7t || 0;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative glass-panel bg-[#131D26]/90 w-full max-w-5xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(143,22,39,0.15)]">
        <div className="flex justify-between items-start p-6 border-b border-white/10 bg-black/20 rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-text-main flex items-center gap-2">
              <TruckIcon className="w-7 h-7 text-primary" /> 
              Ressourcen-Planung
            </h2>
            <p className="text-primary mt-1">{displayDate}</p>
            
            {dayOrders.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
                <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-text-main flex items-center gap-2 shadow-sm">
                  <UserGroupIcon className="w-4 h-4 text-primary" /> Gesamt Helfer: <span className="text-primary text-base">{totalHelpers}</span>
                </span>
                <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-text-main flex items-center gap-2 shadow-sm">
                  <TruckIcon className="w-4 h-4 text-orange-400" /> Gesamt 3,5t: <span className="text-orange-400 text-base">{totalKoffer35t}</span>
                </span>
                <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-text-main flex items-center gap-2 shadow-sm">
                  <TruckIcon className="w-4 h-4 text-green-400" /> Gesamt 7,5t: <span className="text-green-400 text-base">{totalLkw7t}</span>
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors mt-1 border border-white/10">
            <XMarkIcon className="w-5 h-5 text-text-main" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {dayTasks.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm uppercase tracking-wider font-bold text-text-muted mb-4 border-b border-white/10 pb-2">Aufgaben für heute</h3>
              <div className="space-y-2">
                {dayTasks.map((task, idx) => (
                  <div key={`${task.id}-${task.type}-${idx}`} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${task.isDone ? 'bg-green-500/10 border-green-500/30 text-text-muted' : 'bg-black/20 border-white/10 text-text-main hover:bg-white/5'}`}>
                    <input 
                      type="checkbox" 
                      checked={task.isDone}
                      onChange={() => handleToggleTask(task.id, task.type, task.isDone)}
                      className="w-5 h-5 rounded border-structure text-primary focus:ring-primary focus:ring-offset-bg-panel cursor-pointer"
                    />
                    <div className="flex-1 flex justify-between items-center">
                      <span className={`font-medium ${task.isDone ? 'line-through' : ''}`}>{task.title}</span>
                      <span className="text-xs opacity-80">{task.customer}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-sm uppercase tracking-wider font-bold text-text-muted mb-4 border-b border-white/10 pb-2">Umzüge ({dayOrders.length})</h3>
          
          {dayOrders.length === 0 ? (
            <div className="text-center p-12 text-text-muted bg-black/20 rounded-xl border border-white/5">Keine Umzüge an diesem Tag.</div>
          ) : (
            <div className="space-y-6">
              {dayOrders.map(order => {
                const helpersCount = order.disposition?.helpers || 0;
                const koffer35tCount = order.disposition?.koffer35t || 0;
                const lkw7tCount = order.disposition?.lkw7t || 0;
                
                return (
                  <div key={order.id} className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-text-main mb-2">{order.customerName}</h3>
                        <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
                          <MapPinIcon className="w-4 h-4 text-orange-400" />
                          <span>Von: {order.logistics?.a_city || order.logistics?.loadingAddress || 'Unbekannt'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-text-muted">
                          <MapPinIcon className="w-4 h-4 text-green-400" />
                          <span>Nach: {order.logistics?.b_city || order.logistics?.unloadingAddress || 'Unbekannt'}</span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-xs font-bold uppercase shadow-sm">
                          Umzug
                        </span>
                        <PDFDownloadLink
                          document={<EmployeeSheetPDF order={order} customer={{ firstName: order.customerName, lastName: '' }} />}
                          fileName={`Laufzettel_${order.customerName?.replace(/\s+/g, '_') || 'Kunde'}.pdf`}
                          className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-2 mt-2"
                        >
                          {({ loading }) => (
                            <>
                              <DocumentArrowDownIcon className="w-4 h-4" />
                              {loading ? 'Lädt...' : 'Laufzettel (PDF)'}
                            </>
                          )}
                        </PDFDownloadLink>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-white/10 pt-4">
                      {/* Kapazitäten anpassen */}
                      <div className="col-span-1 md:col-span-2">
                        <h4 className="font-semibold text-text-main flex items-center gap-2 mb-3">
                          <UserGroupIcon className="w-5 h-5 text-primary" /> Benötigte Kapazitäten
                        </h4>
                        <p className="text-xs text-text-muted mb-4">Diese Werte werden automatisch aus deiner initialen Planung (Auftrags-Editor) übernommen. Du kannst sie hier bei Bedarf anpassen.</p>
                        
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center justify-between p-3 border border-white/10 rounded-xl bg-black/20 min-w-[200px]">
                            <span className="font-medium text-sm">Umzugshelfer</span>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => updateResource(order.id, 'helpers', helpersCount - 1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-text-main transition-colors">-</button>
                              <span className="font-bold w-4 text-center">{helpersCount}</span>
                              <button type="button" onClick={() => updateResource(order.id, 'helpers', helpersCount + 1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-text-main transition-colors">+</button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 border border-white/10 rounded-xl bg-black/20 min-w-[200px]">
                            <span className="font-medium text-sm">Koffer 3,5 Tonnen</span>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => updateResource(order.id, 'koffer35t', koffer35tCount - 1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-text-main transition-colors">-</button>
                              <span className="font-bold w-4 text-center">{koffer35tCount}</span>
                              <button type="button" onClick={() => updateResource(order.id, 'koffer35t', koffer35tCount + 1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-text-main transition-colors">+</button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 border border-white/10 rounded-xl bg-black/20 min-w-[200px]">
                            <span className="font-medium text-sm">LKW 7,5 Tonnen</span>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => updateResource(order.id, 'lkw7t', lkw7tCount - 1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-text-main transition-colors">-</button>
                              <span className="font-bold w-4 text-center">{lkw7tCount}</span>
                              <button type="button" onClick={() => updateResource(order.id, 'lkw7t', lkw7tCount + 1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-text-main transition-colors">+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Aufgaben (Checkliste & System) */}
                      {(() => {
                        const systemTickets = generateTickets(order, null).filter(t => t.phase === 2);
                        const manualChecklist = order.checklist || [];
                        const hasTasks = systemTickets.length > 0 || manualChecklist.length > 0;
                        
                        if (!hasTasks) return null;
                        
                        return (
                          <div className="col-span-1 md:col-span-2 border-t border-white/10 pt-4 mt-2">
                            <h4 className="font-semibold text-text-main flex items-center gap-2 mb-3">
                              <ClipboardDocumentListIcon className="w-5 h-5 text-primary" /> Aufgaben (System & Checkliste)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {systemTickets.map((task: any) => (
                                <div key={task.id} className="flex items-center gap-3 p-3 bg-black/20 border border-white/10 rounded-lg">
                                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${task.done ? 'bg-green-500 text-white' : 'bg-white/10 text-transparent'}`}>
                                    <CheckIcon className="w-3 h-3" />
                                  </div>
                                  <span className={`text-sm ${task.done ? 'text-text-muted line-through' : 'text-text-main'}`}>{task.title}</span>
                                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${task.type === 'warning' ? 'bg-red-500/10 text-red-400' : task.type === 'action' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-400'}`}>
                                    System
                                  </span>
                                </div>
                              ))}
                              
                              {manualChecklist.map((task: any) => (
                                <div key={task.id} className="flex items-center gap-3 p-3 bg-black/20 border border-white/10 rounded-lg">
                                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${task.done ? 'bg-green-500 text-white' : 'bg-white/10 text-transparent'}`}>
                                    <CheckIcon className="w-3 h-3" />
                                  </div>
                                  <span className={`text-sm ${task.done ? 'text-text-muted line-through' : 'text-text-main'}`}>{task.text}</span>
                                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-text-muted uppercase font-bold border border-white/5">
                                    Manuell
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
