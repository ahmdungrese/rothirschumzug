"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, getDoc, doc } from 'firebase/firestore';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { DispoModal } from './DispoModal';
import { getCol } from '@/lib/demoMode';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  useEffect(() => {
    // Fetch all confirmed or completed orders that have a movingDate
    const q = query(
      collection(db, getCol('orders')),
      where('status', 'in', ['draft', 'quote', 'confirmed', 'completed', 'invoice_open', 'invoice_overdue', 'invoice_paid'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(fetched);
      setLoading(false);
    });

    // Fetch Settings for vehicles and employees
    getDoc(doc(db, getCol('system'), 'settings')).then(docSnap => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, []);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    // Adjust so Monday is 0
    return day === 0 ? 6 : day - 1;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 relative">
      {/* Background Graphic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-[-1] overflow-hidden">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[2px]" />
      </div>

      <div className="glass-panel flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-main flex items-center gap-3">
            <CalendarDaysIcon className="w-8 h-8 text-primary" /> Einsatzplanung
          </h1>
          <p className="text-text-muted mt-1">Verwalten Sie hier alle operativen Umzüge und Termine.</p>
        </div>
        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-full px-2 py-1 shadow-inner">
          <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-main">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-text-main w-40 text-center tracking-wide">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-main">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="glass-panel min-h-[600px] p-0 overflow-hidden mt-6">
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-7 border-b border-white/10 bg-black/20">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <div key={day} className="p-4 text-center font-bold text-text-muted text-xs uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 auto-rows-fr">
              {blanksArray.map(b => (
                <div key={`blank-${b}`} className="min-h-[120px] p-2 border-b border-r border-white/5 bg-black/10"></div>
              ))}
              
              {daysArray.map(day => {
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Find events for this day
                const dayEvents: any[] = [];
                
                orders.forEach(o => {
                  const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
                  if (effectiveMovingDate) {
                    const movingDateStr = effectiveMovingDate.split('T')[0];
                    const movingDateObj = new Date(movingDateStr);
                    
                    // Bestimme das Erstellungsdatum für kurzfristige Berechnungen
                    let createdAtObj = new Date(); // Fallback auf heute
                    if (o.createdAt) {
                      createdAtObj = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.createdAt);
                    }
                    
                    // 1. Umzugstag (nur bei bestätigten Aufträgen)
                    const isConfirmed = !['draft', 'quote'].includes(o.status);
                    
                    if (movingDateStr === dateStr && isConfirmed) {
                      const isDone = o.status === 'completed' || o.status === 'invoice_open' || o.status === 'invoice_paid';
                      dayEvents.push({
                        id: o.id + '_move',
                        type: 'move',
                        title: 'Umzug: ' + o.customerName,
                        address: o.logistics?.a_city || o.logistics?.loadingAddress?.split(',')[0] || 'Keine Adresse',
                        color: 'bg-orange-600 border-orange-500 text-white hover:bg-orange-500 shadow-md shadow-orange-500/20',
                        orderId: o.id,
                        customerId: o.customerId,
                        isDone,
                        disposition: o.disposition || null
                      });
                    }

                    // 2. Halteverbot (4 Tage vorher, oder am Tag der Angebot-Annahme wenn kurzfristig) - nur bestätigte
                    if (o.logistics?.noParkingZone && isConfirmed) {
                      let hvDate = new Date(movingDateObj);
                      hvDate.setDate(hvDate.getDate() - 4);
                      if (hvDate < createdAtObj) hvDate = new Date(createdAtObj); // Wenn kurzfristig, zeige es am Bestätigungstag

                      const hvDateStr = `${hvDate.getFullYear()}-${String(hvDate.getMonth() + 1).padStart(2, '0')}-${String(hvDate.getDate()).padStart(2, '0')}`;
                      if (hvDateStr === dateStr) {
                        dayEvents.push({
                          id: o.id + '_hv',
                          ticketId: 'halteverbot',
                          type: 'parking',
                          title: 'Halteverbot',
                          address: o.customerName,
                          color: 'bg-yellow-500 border-yellow-400 text-black font-medium hover:bg-yellow-400 shadow-md shadow-yellow-500/20',
                          orderId: o.id,
                          customerId: o.customerId,
                          isDone: !!o.ticketStates?.halteverbot
                        });
                      }
                    }

                    // 3. Karton-Lieferung (4 Wochen / 28 Tage vorher, oder am Tag der Angebot-Annahme wenn kurzfristig) - nur bestätigte
                    if (o.services?.some((s: any) => s.name.toLowerCase().includes('karton')) && isConfirmed) {
                      let boxDate = new Date(movingDateObj);
                      boxDate.setDate(boxDate.getDate() - 28);
                      if (boxDate < createdAtObj) boxDate = new Date(createdAtObj); // Wenn kurzfristig, zeige es direkt am Tag der Unterschrift

                      const boxDateStr = `${boxDate.getFullYear()}-${String(boxDate.getMonth() + 1).padStart(2, '0')}-${String(boxDate.getDate()).padStart(2, '0')}`;
                      if (boxDateStr === dateStr) {
                        dayEvents.push({
                          id: o.id + '_box',
                          ticketId: 'kartons_liefern',
                          type: 'boxes',
                          title: 'Kartons liefern',
                          address: o.customerName,
                          color: 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20',
                          orderId: o.id,
                          customerId: o.customerId,
                          isDone: !!o.ticketStates?.kartons_liefern
                        });
                      }
                    }
                  }

                  // 4. Besichtigungstermine
                  const effectiveViewingDate = o.orderMeta?.viewingDate || o.viewingDate;
                  if (effectiveViewingDate && effectiveViewingDate.split('T')[0] === dateStr) {
                    dayEvents.push({
                      id: o.id + '_view',
                      ticketId: 'viewing_requested',
                      type: 'viewing',
                      title: 'Besichtigung',
                      address: o.customerName,
                      color: 'bg-primary border-primary-hover text-white hover:bg-primary-hover shadow-md shadow-primary/20',
                      orderId: o.id,
                      customerId: o.customerId,
                      isDone: !!o.ticketStates?.viewing_requested
                    });
                  }
                });

                const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                
                return (
                  <div 
                    key={`day-${day}`} 
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`min-h-[120px] p-2 border-b border-r border-white/5 relative group hover:bg-white/[0.04] transition-colors cursor-pointer ${isToday ? 'bg-primary/10' : 'bg-transparent'}`}
                  >
                    <div className={`text-right font-bold text-sm mb-2 ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                      {isToday && <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded mr-2 uppercase tracking-wider">Heute</span>}
                      {day}
                    </div>
                    
                    <div className="space-y-1.5">
                      {dayEvents.map((event: any) => (
                        <Link 
                          key={event.id} 
                          href={event.type === 'move' ? `/dashboard/orders` : `/dashboard/customers/${event.customerId}`}
                          className={`block border p-1.5 rounded-lg text-xs transition-all shadow-sm ${event.color} ${event.isDone ? 'opacity-30 grayscale' : ''}`}
                        >
                          <div className="font-bold truncate flex items-center gap-1">
                            {event.isDone && <CheckIcon className="w-3 h-3 shrink-0" />}
                            <span className={event.isDone ? 'line-through' : ''}>
                              {event.disposition?.movingTimeStr && <span className="mr-1 opacity-80">{event.disposition.movingTimeStr}</span>}
                              {event.title}
                            </span>
                          </div>
                          <div className="opacity-80 truncate mt-0.5">{event.address}</div>
                          {event.type === 'move' && event.disposition && (
                            <div className="mt-1 pt-1 border-t border-current/20 text-[10px] leading-tight flex flex-wrap gap-x-2 gap-y-0.5 opacity-90">
                              {event.disposition.helpers > 0 && <span>{event.disposition.helpers} Helfer</span>}
                              {event.disposition.koffer35t > 0 && <span>{event.disposition.koffer35t}x 3,5t</span>}
                              {event.disposition.lkw7t > 0 && <span>{event.disposition.lkw7t}x 7,5t</span>}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedDateStr && (
        <DispoModal 
          dateStr={selectedDateStr} 
          orders={orders} 
          settings={settings} 
          onClose={() => setSelectedDateStr(null)} 
        />
      )}
    </div>
  );
}
