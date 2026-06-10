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

  const availableVehicles: string[] = settings?.vehicles || [];
  const availableEmployees: string[] = settings?.employees || [];

  // Berechne belegte Ressourcen für diesen Tag (über alle Aufträge)
  const getUsedResources = () => {
    const usedVehicles = new Set<string>();
    const usedEmployees = new Set<string>();
    
    dayOrders.forEach(o => {
      const v = o.disposition?.assignedVehicles || [];
      const e = o.disposition?.assignedEmployees || [];
      v.forEach((x: string) => usedVehicles.add(x));
      e.forEach((x: string) => usedEmployees.add(x));
    });
    return { usedVehicles, usedEmployees };
  };

  const { usedVehicles, usedEmployees } = getUsedResources();

  const handleToggleVehicle = async (orderId: string, vehicle: string, currentAssigned: string[]) => {
    const isAssigned = currentAssigned.includes(vehicle);
    let newAssigned;
    if (isAssigned) {
      newAssigned = currentAssigned.filter(v => v !== vehicle);
    } else {
      if (usedVehicles.has(vehicle)) {
        toast.error(`Fahrzeug "${vehicle}" ist heute schon verplant!`);
        return;
      }
      newAssigned = [...currentAssigned, vehicle];
    }
    await updateDoc(doc(db, getCol('orders'), orderId), {
      'disposition.assignedVehicles': newAssigned
    });
  };

  const handleToggleEmployee = async (orderId: string, employee: string, currentAssigned: string[]) => {
    const isAssigned = currentAssigned.includes(employee);
    let newAssigned;
    if (isAssigned) {
      newAssigned = currentAssigned.filter(e => e !== employee);
    } else {
      if (usedEmployees.has(employee)) {
        toast.error(`Mitarbeiter "${employee}" ist heute schon eingeteilt!`);
        return;
      }
      newAssigned = [...currentAssigned, employee];
    }
    await updateDoc(doc(db, getCol('orders'), orderId), {
      'disposition.assignedEmployees': newAssigned
    });
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-structure shadow-2xl rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-structure bg-bg-dark rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-text-main flex items-center gap-2">
              <TruckIcon className="w-7 h-7 text-primary" /> 
              Ressourcen-Planung
            </h2>
            <p className="text-primary mt-1">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-structure rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6 text-text-main" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {dayTasks.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-white mb-4 border-b border-structure pb-2">Aufgaben für heute</h3>
              <div className="space-y-2">
                {dayTasks.map((task, idx) => (
                  <div key={`${task.id}-${task.type}-${idx}`} className={`flex items-center gap-3 p-3 rounded-lg border ${task.isDone ? 'bg-green-500/10 border-green-500/30 text-text-muted' : 'bg-bg-dark border-structure text-text-main'}`}>
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

          <h3 className="text-lg font-bold text-white mb-4 border-b border-structure pb-2">Umzüge ({dayOrders.length})</h3>
          
          {dayOrders.length === 0 ? (
            <div className="text-center p-12 text-text-muted bg-bg-dark/50 rounded-xl border border-structure/50">Keine Umzüge an diesem Tag.</div>
          ) : (
            <div className="space-y-6">
              {dayOrders.map(order => {
                const assignedVehicles = order.disposition?.assignedVehicles || [];
                const assignedEmployees = order.disposition?.assignedEmployees || [];
                
                return (
                  <div key={order.id} className="bg-bg-dark border border-structure rounded-xl p-5 shadow-inner">
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
                        <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-xs font-bold uppercase">
                          Umzug
                        </span>
                        <PDFDownloadLink
                          document={<EmployeeSheetPDF order={order} customer={{ firstName: order.customerName, lastName: '' }} />}
                          fileName={`Laufzettel_${order.customerName?.replace(/\s+/g, '_') || 'Kunde'}.pdf`}
                          className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-2 hover:bg-primary/20 hover:text-primary mt-2"
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-structure pt-4">
                      {/* Fahrzeuge */}
                      <div>
                        <h4 className="font-semibold text-text-main flex items-center gap-2 mb-3">
                          <TruckIcon className="w-5 h-5 text-text-muted" /> Fahrzeuge zuweisen
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {availableVehicles.map(veh => {
                            const isAssignedToThis = assignedVehicles.includes(veh);
                            const isAssignedOther = !isAssignedToThis && usedVehicles.has(veh);
                            
                            return (
                                <button
                                  key={veh}
                                  onClick={() => handleToggleVehicle(order.id, veh, assignedVehicles)}
                                  disabled={isAssignedOther || profile?.role === 'teamlead'}
                                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                                    isAssignedToThis 
                                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                      : isAssignedOther 
                                        ? 'bg-structure/50 border-structure/50 text-text-muted opacity-50 cursor-not-allowed'
                                        : 'bg-bg-panel border-structure text-text-main hover:border-primary/50'
                                  } ${profile?.role === 'teamlead' && !isAssignedToThis ? 'hidden' : ''}`}
                                >
                                {veh}
                              </button>
                            );
                          })}
                          {availableVehicles.length === 0 && <span className="text-xs text-text-muted">Keine Fahrzeuge in den Einstellungen angelegt.</span>}
                        </div>
                      </div>

                      {/* Mitarbeiter */}
                      <div>
                        <h4 className="font-semibold text-text-main flex items-center gap-2 mb-3">
                          <UserGroupIcon className="w-5 h-5 text-text-muted" /> Team einteilen
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {availableEmployees.map(emp => {
                            const isAssignedToThis = assignedEmployees.includes(emp);
                            const isAssignedOther = !isAssignedToThis && usedEmployees.has(emp);
                            
                            return (
                                <button
                                  key={emp}
                                  onClick={() => handleToggleEmployee(order.id, emp, assignedEmployees)}
                                  disabled={isAssignedOther || profile?.role === 'teamlead'}
                                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                                    isAssignedToThis 
                                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                      : isAssignedOther 
                                        ? 'bg-structure/50 border-structure/50 text-text-muted opacity-50 cursor-not-allowed'
                                        : 'bg-bg-panel border-structure text-text-main hover:border-blue-500/50'
                                  } ${profile?.role === 'teamlead' && !isAssignedToThis ? 'hidden' : ''}`}
                                >
                                {emp}
                              </button>
                            );
                          })}
                          {availableEmployees.length === 0 && <span className="text-xs text-text-muted">Keine Mitarbeiter in den Einstellungen angelegt.</span>}
                        </div>
                      </div>
                      
                      {/* Aufgaben (Checkliste & System) */}
                      {(() => {
                        const systemTickets = generateTickets(order, null).filter(t => t.phase === 2);
                        const manualChecklist = order.checklist || [];
                        const hasTasks = systemTickets.length > 0 || manualChecklist.length > 0;
                        
                        if (!hasTasks) return null;
                        
                        return (
                          <div className="col-span-1 md:col-span-2 border-t border-structure pt-4 mt-2">
                            <h4 className="font-semibold text-text-main flex items-center gap-2 mb-3">
                              <ClipboardDocumentListIcon className="w-5 h-5 text-text-muted" /> Aufgaben (System & Checkliste)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {systemTickets.map((task: any) => (
                                <div key={task.id} className="flex items-center gap-3 p-3 bg-bg-panel border border-structure rounded-lg">
                                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${task.done ? 'bg-green-500 text-white' : 'bg-structure text-transparent'}`}>
                                    <CheckIcon className="w-3 h-3" />
                                  </div>
                                  <span className={`text-sm ${task.done ? 'text-text-muted line-through' : 'text-text-main'}`}>{task.title}</span>
                                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${task.type === 'warning' ? 'bg-red-500/10 text-red-400' : task.type === 'action' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-400'}`}>
                                    System
                                  </span>
                                </div>
                              ))}
                              
                              {manualChecklist.map((task: any) => (
                                <div key={task.id} className="flex items-center gap-3 p-3 bg-bg-panel border border-structure rounded-lg">
                                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${task.done ? 'bg-green-500 text-white' : 'bg-structure text-transparent'}`}>
                                    <CheckIcon className="w-3 h-3" />
                                  </div>
                                  <span className={`text-sm ${task.done ? 'text-text-muted line-through' : 'text-text-main'}`}>{task.text}</span>
                                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-structure/50 text-text-muted uppercase font-bold">
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
