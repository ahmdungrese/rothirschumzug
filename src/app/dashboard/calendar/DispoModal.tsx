"use client";

import { useState } from 'react';
import { 
  DocumentArrowDownIcon, 
  XMarkIcon, 
  MapPinIcon, 
  TruckIcon, 
  UserGroupIcon, 
  ClipboardDocumentListIcon, 
  CheckIcon,
  VideoCameraIcon,
  HomeIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { CounterInput } from '@/components/ui/CounterInput';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { EmployeeSheetPDF } from '@/components/pdf/EmployeeSheetPDF';
import { generateTickets } from '@/lib/ticketEngine';
import Link from 'next/link';

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
  const [activeSection, setActiveSection] = useState<'all' | 'moves' | 'viewings' | 'logistics'>('all');

  const displayDate = new Date(dateStr).toLocaleDateString('de-DE', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Filter only moving orders that happen on this day
  const dayOrders = orders.filter(o => {
    const isConfirmed = !['draft', 'quote'].includes(o.status);
    const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
    return effectiveMovingDate?.split('T')[0] === dateStr && isConfirmed;
  });

  // Calculate separate tasks for this day
  const viewingTasks: any[] = [];
  const logisticsTasks: any[] = [];

  orders.forEach(o => {
    let createdAtObj = new Date();
    if (o.createdAt) {
      createdAtObj = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.createdAt);
    }
    
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
          logisticsTasks.push({ 
            id: o.id, 
            type: 'halteverbot', 
            icon: 'block',
            title: 'Halteverbot aufstellen', 
            customer: o.customerName, 
            customerId: o.customerId,
            isDone: !!o.ticketStates?.halteverbot 
          });
        }
      }
    }
    
    // Kartons
    if (o.services?.some((s: any) => s.name?.toLowerCase().includes('karton')) && isConfirmed) {
      const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
      if (effectiveMovingDate) {
        let boxDate = new Date(effectiveMovingDate.split('T')[0]);
        boxDate.setDate(boxDate.getDate() - 28);
        if (boxDate < createdAtObj) boxDate = new Date(createdAtObj);
        const boxDateStr = `${boxDate.getFullYear()}-${String(boxDate.getMonth() + 1).padStart(2, '0')}-${String(boxDate.getDate()).padStart(2, '0')}`;
        if (boxDateStr === dateStr) {
          logisticsTasks.push({ 
            id: o.id, 
            type: 'kartons_liefern', 
            icon: 'package_2',
            title: 'Kartons liefern', 
            customer: o.customerName, 
            customerId: o.customerId,
            isDone: !!o.ticketStates?.kartons_liefern 
          });
        }
      }
    }

    // Möbellift
    if (o.services?.some((s: any) => ['lift', 'möbellift', 'aufzug'].some(kw => s.name?.toLowerCase().includes(kw))) && isConfirmed) {
      const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
      if (effectiveMovingDate) {
        let liftDate = new Date(effectiveMovingDate.split('T')[0]);
        liftDate.setDate(liftDate.getDate() - 3);
        if (liftDate < createdAtObj) liftDate = new Date(createdAtObj);
        const liftDateStr = `${liftDate.getFullYear()}-${String(liftDate.getMonth() + 1).padStart(2, '0')}-${String(liftDate.getDate()).padStart(2, '0')}`;
        if (liftDateStr === dateStr) {
          logisticsTasks.push({
            id: o.id,
            type: 'moebellift_buchen',
            icon: 'elevator',
            title: 'Möbellift reservieren/buchen',
            customer: o.customerName,
            customerId: o.customerId,
            isDone: !!o.ticketStates?.moebellift_buchen
          });
        }
      }
    }

    // Besichtigungen
    const effectiveViewingDate = o.orderMeta?.viewingDate || o.viewingDate;
    if (effectiveViewingDate && effectiveViewingDate.split('T')[0] === dateStr) {
      const isVideo = (o.orderMeta?.viewingType || '').toLowerCase().includes('video');
      viewingTasks.push({ 
        id: o.id, 
        type: 'viewing_requested', 
        isVideo,
        title: isVideo ? 'Videobesichtigung' : 'Vor-Ort-Besichtigung', 
        customer: o.customerName, 
        customerId: o.customerId,
        fullAddress: (o.logistics?.a_city || o.logistics?.a_street) 
          ? `${o.logistics.a_street || ''} ${o.logistics.a_houseNr || ''}, ${o.logistics.a_zip || ''} ${o.logistics.a_city || ''}` 
          : '',
        timeStr: effectiveViewingDate.split('T')[1] ? effectiveViewingDate.split('T')[1].substring(0, 5) : '',
        isDone: !!o.ticketStates?.viewing_requested 
      });
    }
  });

  const handleToggleTask = async (orderId: string, ticketId: string, currentState: boolean) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        [`ticketStates.${ticketId}`]: !currentState
      });
      toast.success(currentState ? 'Aufgabe wieder offen' : 'Aufgabe als erledigt markiert!');
    } catch (error) {
      toast.error('Fehler beim Speichern der Aufgabe.');
    }
  };

  const updateResource = async (orderId: string, field: string, value: number) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        [`disposition.${field}`]: Math.max(0, value)
      });
    } catch (e) {
      toast.error("Fehler beim Speichern");
    }
  };

  // Calculate day totals
  let totalHelpers = 0;
  let totalKoffer35t = 0;
  let totalLkw7t = 0;

  dayOrders.forEach(o => {
    totalHelpers += o.disposition?.helpers || 0;
    totalKoffer35t += o.disposition?.koffer35t || 0;
    totalLkw7t += o.disposition?.lkw7t || 0;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative bg-bg-panel border border-structure w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
        
        {/* Header with Title & KPI Chips */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-5 md:p-6 border-b border-structure bg-bg-card/40 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">local_shipping</span>
              <h2 className="text-xl md:text-2xl font-bold font-headline text-text-main">
                Tages-Planung & Ressourcen
              </h2>
            </div>
            <p className="text-sm font-bold text-[#D91E2A] mt-1 font-headline">
              {displayDate}
            </p>
            
            {/* Global Resource KPIs */}
            {dayOrders.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2.5 text-xs font-semibold">
                <span className="bg-bg-panel border border-structure px-3 py-1.5 rounded-full text-text-main flex items-center gap-1.5 shadow-xs">
                  <UserGroupIcon className="w-4 h-4 text-primary" /> 
                  Helfer gesamt: <strong className="text-primary font-headline text-sm">{totalHelpers}</strong>
                </span>
                <span className="bg-bg-panel border border-structure px-3 py-1.5 rounded-full text-text-main flex items-center gap-1.5 shadow-xs">
                  <TruckIcon className="w-4 h-4 text-orange-500" /> 
                  3,5t LKW: <strong className="text-orange-500 font-headline text-sm">{totalKoffer35t}</strong>
                </span>
                <span className="bg-bg-panel border border-structure px-3 py-1.5 rounded-full text-text-main flex items-center gap-1.5 shadow-xs">
                  <TruckIcon className="w-4 h-4 text-emerald-500" /> 
                  7,5t LKW: <strong className="text-emerald-500 font-headline text-sm">{totalLkw7t}</strong>
                </span>
              </div>
            )}
          </div>

          <button 
            type="button" 
            aria-label="Schließen" 
            onClick={onClose} 
            className="p-2 hover:bg-structure rounded-full transition-colors text-text-muted hover:text-text-main self-end sm:self-auto"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Section Navigation Tabs (Funktionen Trennen) */}
        <div className="px-6 py-2.5 border-b border-structure bg-bg-card/20 flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all font-headline ${
              activeSection === 'all'
                ? 'bg-text-main text-bg-panel'
                : 'text-text-muted hover:text-text-main bg-structure/40'
            }`}
          >
            Alle anzeigen
          </button>

          <button
            onClick={() => setActiveSection('moves')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 font-headline ${
              activeSection === 'moves'
                ? 'bg-[#D91E2A] text-white shadow-xs'
                : 'text-text-muted hover:text-text-main bg-structure/40'
            }`}
          >
            <TruckIcon className="w-3.5 h-3.5" />
            <span>Umzüge ({dayOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('viewings')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 font-headline ${
              activeSection === 'viewings'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-text-muted hover:text-text-main bg-structure/40'
            }`}
          >
            <span className="material-symbols-outlined text-xs">visibility</span>
            <span>Besichtigungen ({viewingTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('logistics')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 font-headline ${
              activeSection === 'logistics'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-text-muted hover:text-text-main bg-structure/40'
            }`}
          >
            <span className="material-symbols-outlined text-xs">inventory_2</span>
            <span>Material & Fristen ({logisticsTasks.length})</span>
          </button>
        </div>
        
        {/* Modal Scroll Content */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">

          {/* SECTION 1: UMZÜGE & FUHRPARK */}
          {(activeSection === 'all' || activeSection === 'moves') && (
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-structure pb-2">
                <h3 className="text-xs uppercase tracking-wider font-bold text-text-muted font-headline flex items-center gap-1.5">
                  <TruckIcon className="w-4 h-4 text-[#D91E2A]" />
                  1. Umzüge & Fuhrpark ({dayOrders.length})
                </h3>
              </div>

              {dayOrders.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted bg-bg-card/40 rounded-2xl border border-structure/60 font-medium">
                  Keine Umzüge für dieses Datum geplant.
                </div>
              ) : (
                <div className="space-y-4">
                  {dayOrders.map(order => {
                    const helpersCount = order.disposition?.helpers || 0;
                    const koffer35tCount = order.disposition?.koffer35t || 0;
                    const lkw7tCount = order.disposition?.lkw7t || 0;
                    const orderNum = order.orderNumber || order.orderIdShort || `#${order.id?.slice(-5).toUpperCase()}`;
                    
                    return (
                      <div 
                        key={order.id} 
                        className="bg-bg-card border border-structure rounded-2xl p-5 shadow-sm space-y-4"
                      >
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              {order.customerId ? (
                                <Link 
                                  href={`/dashboard/customers/${order.customerId}`}
                                  className="text-lg font-bold text-text-main hover:text-[#D91E2A] transition-colors font-headline flex items-center gap-1"
                                >
                                  {order.customerName}
                                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-60" />
                                </Link>
                              ) : (
                                <h4 className="text-lg font-bold text-text-main font-headline">
                                  {order.customerName}
                                </h4>
                              )}
                              <span className="text-[10px] font-bold text-[#D91E2A] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 font-headline">
                                {orderNum}
                              </span>
                            </div>

                            {/* Route details */}
                            <div className="mt-2 space-y-1 text-xs text-text-muted">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                                <span>Beladestelle: <strong className="text-text-main">{order.logistics?.a_city || order.logistics?.loadingAddress || 'Nicht angegeben'}</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                <span>Entladestelle: <strong className="text-text-main">{order.logistics?.b_city || order.logistics?.unloadingAddress || 'Nicht angegeben'}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* PDF Laufzettel Download Button */}
                          <div className="shrink-0 flex items-center">
                            <PDFDownloadLink
                              document={<EmployeeSheetPDF order={order} customer={{ firstName: order.customerName, lastName: '' }} />}
                              fileName={`Laufzettel_${order.customerName?.replace(/\s+/g, '_') || 'Kunde'}.pdf`}
                              className="btn-primary py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs"
                            >
                              {({ loading }) => (
                                <>
                                  <DocumentArrowDownIcon className="w-4 h-4" />
                                  <span>{loading ? 'Generiere...' : 'Laufzettel PDF'}</span>
                                </>
                              )}
                            </PDFDownloadLink>
                          </div>
                        </div>

                        {/* Capacities Counters */}
                        <div className="border-t border-structure pt-3">
                          <div className="text-xs font-bold text-text-muted mb-2 font-headline">
                            Eingeteilte Kapazitäten für diesen Umzug:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-bg-panel border border-structure p-2.5 rounded-xl">
                              <CounterInput 
                                label="Umzugshelfer" 
                                value={helpersCount} 
                                onChange={v => updateResource(order.id, 'helpers', v)} 
                              />
                            </div>
                            <div className="bg-bg-panel border border-structure p-2.5 rounded-xl">
                              <CounterInput 
                                label="Koffer 3,5t" 
                                value={koffer35tCount} 
                                onChange={v => updateResource(order.id, 'koffer35t', v)} 
                              />
                            </div>
                            <div className="bg-bg-panel border border-structure p-2.5 rounded-xl">
                              <CounterInput 
                                label="LKW 7,5t" 
                                value={lkw7tCount} 
                                onChange={v => updateResource(order.id, 'lkw7t', v)} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: BESICHTIGUNGSTERMINE */}
          {(activeSection === 'all' || activeSection === 'viewings') && (
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-structure pb-2">
                <h3 className="text-xs uppercase tracking-wider font-bold text-text-muted font-headline flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-500 text-sm">visibility</span>
                  2. Besichtigungstermine ({viewingTasks.length})
                </h3>
              </div>

              {viewingTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted bg-bg-card/40 rounded-2xl border border-structure/60 font-medium">
                  Keine Besichtigungstermine an diesem Tag.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {viewingTasks.map(task => (
                    <div 
                      key={task.id} 
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        task.isDone 
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' 
                          : 'bg-bg-card border-structure hover:border-amber-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-sm">
                              {task.isVideo ? 'videocam' : 'home'}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 font-headline">
                              {task.title}
                            </span>
                          </div>
                          <div className="font-bold text-sm text-text-main mt-1">
                            {task.customer}
                          </div>
                        </div>

                        {task.timeStr && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-bg-panel border border-structure text-text-main font-headline">
                            {task.timeStr} Uhr
                          </span>
                        )}
                      </div>

                      {task.fullAddress && (
                        <div className="text-xs text-text-muted flex items-center gap-1 truncate">
                          <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-primary" />
                          <span className="truncate">{task.fullAddress}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-structure/60 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={task.isDone}
                            onChange={() => handleToggleTask(task.id, task.type, task.isDone)}
                            className="w-4 h-4 rounded border-structure text-[#D91E2A] focus:ring-[#D91E2A] cursor-pointer"
                          />
                          <span className={`text-[11px] font-semibold ${task.isDone ? 'line-through text-text-muted' : 'text-text-main'}`}>
                            {task.isDone ? 'Erledigt' : 'Als erledigt markieren'}
                          </span>
                        </label>

                        {task.customerId && (
                          <Link 
                            href={`/dashboard/customers/${task.customerId}`}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            Kundenprofil →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: MATERIAL & LOGISTIK CHECKLISTE */}
          {(activeSection === 'all' || activeSection === 'logistics') && (
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-structure pb-2">
                <h3 className="text-xs uppercase tracking-wider font-bold text-text-muted font-headline flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-500 text-sm">inventory_2</span>
                  3. Material & Vorab-Logistik Fristen ({logisticsTasks.length})
                </h3>
              </div>

              {logisticsTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted bg-bg-card/40 rounded-2xl border border-structure/60 font-medium">
                  Keine Material- oder Fristaufgaben für diesen Tag.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {logisticsTasks.map((task, idx) => (
                    <div 
                      key={`${task.id}-${task.type}-${idx}`} 
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                        task.isDone 
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-text-muted' 
                          : 'bg-bg-card border-structure hover:border-primary/50 text-text-main'
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={task.isDone}
                          onChange={() => handleToggleTask(task.id, task.type, task.isDone)}
                          className="w-4 h-4 rounded border-structure text-[#D91E2A] focus:ring-[#D91E2A] cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-text-muted">
                            {task.icon}
                          </span>
                          <span className={`text-xs font-bold font-headline ${task.isDone ? 'line-through opacity-60' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                      </label>

                      {task.customerId ? (
                        <Link 
                          href={`/dashboard/customers/${task.customerId}`}
                          className="text-xs font-semibold text-text-muted hover:text-primary transition-colors truncate max-w-[200px]"
                        >
                          {task.customer} →
                        </Link>
                      ) : (
                        <span className="text-xs font-semibold text-text-muted truncate max-w-[200px]">
                          {task.customer}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
